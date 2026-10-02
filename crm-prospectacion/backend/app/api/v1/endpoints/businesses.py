
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.business import Business, CategoryEnum, StageEnum, ZoneEnum
from app.models.user import User
from app.schemas.business import (
    BusinessCreate,
    BusinessListResponse,
    BusinessResponse,
    BusinessUpdate,
)
from app.services.coffee_catalog import calculate_sample_cost, get_catalog_names
from app.services.reference_point_service import ReferencePoint, get_reference_point
from app.services.route_planner import haversine_km

router = APIRouter(
    prefix="/businesses",
    tags=["businesses"],
    dependencies=[Depends(get_current_user)],  # todo el router exige sesión válida
)


@router.get("/coffee-catalog", response_model=List[str])
async def list_coffee_catalog() -> List[str]:
    """Lista de productos de café (lista de precios Nudo Verde) para que
    el frontend los ofrezca como selección al capturar una muestra --
    elegir un nombre exacto de esta lista es lo que permite calcular su
    costo real automáticamente."""
    return get_catalog_names()


def _to_response_with_distance(
    business: Business, reference: ReferencePoint, assignee_names: dict | None = None
) -> BusinessResponse:
    response = BusinessResponse.model_validate(business)
    distance_km = haversine_km(reference.lat, reference.lng, business.lat, business.lng)
    response.distance_km = round(distance_km, 2)
    # Costo estimado de la visita: ida y vuelta desde el punto de
    # referencia, al costo por km configurado en settings.COST_PER_KM.
    response.visit_cost_estimate = round(distance_km * 2 * settings.COST_PER_KM, 2)
    response.sample_cost = calculate_sample_cost(business.coffee_offered, business.sample_grams)
    if assignee_names and business.assigned_to_id:
        response.assigned_to_name = assignee_names.get(business.assigned_to_id)
    return response


@router.get("", response_model=BusinessListResponse)
async def list_businesses(
    zone: Optional[ZoneEnum] = Query(default=None, description="Filtrar por zona"),
    category: Optional[CategoryEnum] = Query(default=None, description="Filtrar por giro"),
    stage: Optional[StageEnum] = Query(default=None, description="Filtrar por etapa del pipeline"),
    is_client: Optional[bool] = Query(default=None, description="Filtrar solo clientes"),
    search: Optional[str] = Query(default=None, description="Búsqueda por nombre/dirección/servicios"),
    visited: Optional[bool] = Query(default=None, description="Filtrar por estatus de visita"),
    show_all: bool = Query(
        default=False,
        description="Si es admin, ver los prospectos de TODOS los vendedores (no solo los propios)",
    ),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BusinessListResponse:
    stmt = select(Business)

    if zone is not None:
        stmt = stmt.where(Business.zone == zone)
    if category is not None:
        stmt = stmt.where(Business.category == category)
    if stage is not None:
        stmt = stmt.where(Business.stage == stage)
    if is_client is not None:
        stmt = stmt.where(Business.is_client == is_client)
    if visited is not None:
        stmt = stmt.where(Business.visited == visited)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Business.name.ilike(pattern),
                Business.address.ilike(pattern),
                Business.products_services.ilike(pattern),
            )
        )

    # Visibilidad multi-usuario: un vendedor solo ve lo suyo + lo sin
    # asignar; un admin ve todo (o puede pedir explícitamente ver todo
    # con show_all=true, aunque por defecto ya ve todo).
    if current_user.role.value != "admin":
        stmt = stmt.where(
            or_(
                Business.assigned_to_id == current_user.id,
                Business.assigned_to_id.is_(None),
            )
        )

    count_stmt = stmt.with_only_columns(Business.id)
    total_result = await db.execute(count_stmt)
    total = len(total_result.scalars().all())

    stmt = stmt.order_by(Business.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    reference = await get_reference_point(db)
    assignee_names = await _resolve_assignee_names(items, db)
    return BusinessListResponse(
        total=total,
        items=[_to_response_with_distance(b, reference, assignee_names) for b in items],
    )


def _assert_can_access_business(business: Business, current_user: User) -> None:
    """Misma regla de visibilidad multi-usuario que list_businesses: un
    vendedor solo puede ver/editar lo suyo o lo sin asignar; un admin
    puede todo."""
    if current_user.role.value == "admin":
        return
    if business.assigned_to_id not in (None, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Negocio no encontrado")


async def _resolve_assignee_names(businesses, db: AsyncSession) -> dict:
    """Resuelve en un solo query los nombres de los vendedores asignados a
    la lista de negocios dada, para no hacer N consultas individuales."""
    assignee_ids = {b.assigned_to_id for b in businesses if b.assigned_to_id}
    if not assignee_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(assignee_ids)))
    return {u.id: u.full_name for u in result.scalars().all()}


@router.get("/{business_id}", response_model=BusinessResponse)
async def get_business(
    business_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BusinessResponse:
    business = await db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Negocio no encontrado")
    _assert_can_access_business(business, current_user)
    reference = await get_reference_point(db)
    assignee_names = await _resolve_assignee_names([business], db)
    return _to_response_with_distance(business, reference, assignee_names)


@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(
    payload: BusinessCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BusinessResponse:
    business = Business(**payload.model_dump(), assigned_to_id=current_user.id)
    db.add(business)
    await db.commit()
    await db.refresh(business)
    reference = await get_reference_point(db)
    return _to_response_with_distance(business, reference, {current_user.id: current_user.full_name})


@router.put("/{business_id}", response_model=BusinessResponse)
async def update_business(
    business_id: uuid.UUID,
    payload: BusinessUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BusinessResponse:
    business = await db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Negocio no encontrado")
    _assert_can_access_business(business, current_user)

    update_data = payload.model_dump(exclude_unset=True)

    # Si esta actualización marca el negocio como visitado, registra el
    # momento exacto -- salvo que el propio payload ya traiga un valor
    # explícito para last_visited_at (no es el caso hoy, pero deja la
    # puerta abierta a corregirlo manualmente en el futuro).
    if update_data.get("visited") is True and "last_visited_at" not in update_data:
        update_data["last_visited_at"] = datetime.now(timezone.utc)

    # Si un vendedor interactúa con un negocio que todavía no tiene dueño,
    # se lo "reclama" automáticamente -- así, en cuanto alguien empieza a
    # trabajarlo, deja de aparecer como disponible para los demás.
    if business.assigned_to_id is None:
        business.assigned_to_id = current_user.id

    for field, value in update_data.items():
        setattr(business, field, value)

    await db.commit()
    await db.refresh(business)
    reference = await get_reference_point(db)
    assignee_names = await _resolve_assignee_names([business], db)
    return _to_response_with_distance(business, reference, assignee_names)


# BUG CORREGIDO: `-> None` como anotacion de retorno hace que FastAPI
# infiera un response_model (NoneType) que su chequeo interno trata como
# "si hay modelo". Combinado con status_code=204 (que no debe llevar
# cuerpo), esto revienta con "AssertionError: Status code 204 must not
# have a response body" en cuanto se importa el modulo. La correccion es
# declarar response_model=None explicitamente.
@router.delete(
    "/{business_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def delete_business(
    business_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    business = await db.get(Business, business_id)
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Negocio no encontrado")

    await db.execute(delete(Business).where(Business.id == business_id))
    await db.commit()


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_businesses(
    business_ids: List[uuid.UUID],
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    if not business_ids:
        raise HTTPException(status_code=400, detail="business_ids no puede estar vacío")

    result = await db.execute(delete(Business).where(Business.id.in_(business_ids)))
    await db.commit()
    return {"deleted": result.rowcount}
