
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional, get_user_by_email
from app.core.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.auth import (
    AccessTokenResponse,
    RefreshRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GENERIC_LOGIN_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Email o contraseña incorrectos",
)


MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 5 * 60  # 5 minutos
_failed_attempts: dict[str, list[float]] = {}


def _register_failed_attempt(email: str) -> None:
    now = time.monotonic()
    attempts = [t for t in _failed_attempts.get(email, []) if now - t < LOCKOUT_SECONDS]
    attempts.append(now)
    _failed_attempts[email] = attempts


def _is_locked_out(email: str) -> tuple[bool, int]:
    now = time.monotonic()
    attempts = [t for t in _failed_attempts.get(email, []) if now - t < LOCKOUT_SECONDS]
    _failed_attempts[email] = attempts
    if len(attempts) >= MAX_LOGIN_ATTEMPTS:
        remaining = int(LOCKOUT_SECONDS - (now - attempts[0]))
        return True, max(remaining, 1)
    return False, 0


def _clear_failed_attempts(email: str) -> None:
    _failed_attempts.pop(email, None)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegister,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> UserResponse:
    existing = await get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario registrado con ese email",
        )

    # BUG DE SEGURIDAD CORREGIDO: antes, /auth/register era un endpoint
    # público que aceptaba `role` directamente del cliente -- cualquier
    # persona sin sesión podía crearse una cuenta con role="admin" y
    # tener control total del sistema. Ahora:
    #   - Si NO existe ningún usuario todavía (primer arranque del
    #     sistema), se permite crear ese primer usuario libremente y
    #     siempre como admin (bootstrap).
    #   - Si YA existe al menos un usuario, solo un admin autenticado
    #     puede crear cuentas nuevas, y el rol siempre lo decide ese
    #     admin (el valor que mande un llamante no-admin se ignora).
    total_users = await db.scalar(select(func.count()).select_from(User))

    if total_users == 0:
        role = RoleEnum.ADMIN
    else:
        if current_user is None or current_user.role != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un administrador puede crear nuevas cuentas",
            )
        role = payload.role or RoleEnum.VENDEDOR

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    locked, retry_after = _is_locked_out(payload.email)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Demasiados intentos fallidos. Espera "
                f"{max(retry_after // 60, 1)} minuto(s) antes de volver a intentar."
            ),
        )

    user = await get_user_by_email(db, payload.email)

    # Siempre se ejecuta verify_password aunque el usuario no exista, para
    # que el tiempo de respuesta no delate si el email está registrado.
    dummy_hash = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8pXbrQzcuqQnT2GIcE7Z7WLbXKfLKa"
    password_ok = verify_password(payload.password, user.hashed_password if user else dummy_hash)

    if user is None or not password_ok or not user.is_active:
        _register_failed_attempt(payload.email)
        raise GENERIC_LOGIN_ERROR

    _clear_failed_attempts(payload.email)

    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_access_token(
    payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> AccessTokenResponse:
    try:
        token_data = decode_token(payload.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    if token_data.token_type != TOKEN_TYPE_REFRESH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token proporcionado no es un refresh token",
        )

    try:
        user_id = uuid.UUID(token_data.sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )

    new_access_token = create_access_token(subject=str(user.id), role=user.role.value)
    return AccessTokenResponse(access_token=new_access_token)


@router.get("/me", response_model=UserResponse)
async def read_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user