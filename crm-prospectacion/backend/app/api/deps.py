
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.db.session import get_db
from app.models.user import RoleEnum, User

# tokenUrl solo se usa para generar la documentación interactiva de Swagger.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No se pudieron validar las credenciales",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
    except JWTError:
        raise CREDENTIALS_EXCEPTION

    if payload.token_type != TOKEN_TYPE_ACCESS:
        raise CREDENTIALS_EXCEPTION

    try:
        user_id = uuid.UUID(payload.sub)
    except ValueError:
        raise CREDENTIALS_EXCEPTION

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise CREDENTIALS_EXCEPTION

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador para esta acción",
        )
    return current_user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
