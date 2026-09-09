
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.business import Business
from app.models.saved_route import SavedRoute
from app.models.user import User
from app.schemas.business import (
    WEEKDAY_LABELS,
    DailyRoute,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
    RouteStop,
    SavedRouteCreate,
    SavedRouteResponse,
    WeeklyRouteRequest,
    WeeklyRouteResponse,
)
from app.services.osrm_routing_service import get_real_route
from app.services.reference_point_service import get_reference_point, set_reference_point
from app.services.route_planner import (
    RoutePoint,
    plan_route,
    plan_weekly_routes,
    total_distance_km,
)

router = APIRouter(
    prefix="/routes",
    tags=["routes"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/reference-point")
async def read_reference_point(db: AsyncSession = Depends(get_db)) -> dict:
    """Devuelve el punto de referencia configurado (dirección base desde la
    que se calculan rutas, distancias y costos), para que el frontend lo
    muestre en el mapa como marcador de origen."""
    reference = await get_reference_point(db)
    return {"label": reference.label, "lat": reference.lat, "lng": reference.lng}


class SetReferencePointRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=500)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


@router.put("/reference-point")
async def update_reference_point(
    payload: SetReferencePointRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    """Actualiza el punto de referencia (por ejemplo, con la ubicación GPS
    exacta obtenida desde el navegador). Restringido a administradores
    porque afecta el cálculo de distancias/costos de todo el sistema.
    Aplica de inmediato a cualquier cálculo futuro, sin reiniciar nada."""
    reference = await set_reference_point(
        db, label=payload.label, lat=payload.lat, lng=payload.lng
    )
    return {"label": reference.label, "lat": reference.lat, "lng": reference.lng}


async def _load_businesses_or_404(
    business_ids, db: AsyncSession
) -> list[Business]:
    stmt = select(Business).where(Business.id.in_(business_ids))
    result = await db.execute(stmt)
    businesses = result.scalars().all()

    if not businesses:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ninguno de los IDs proporcionados corresponde a un negocio existente",
        )

    found_ids = {str(b.id) for b in businesses}
    missing_ids = [str(bid) for bid in business_ids if str(bid) not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Negocios no encontrados: {', '.join(missing_ids)}",
        )

    return businesses


@router.post("/optimize", response_model=RouteOptimizeResponse)
async def optimize_route(
    payload: RouteOptimizeRequest, db: AsyncSession = Depends(get_db)
) -> RouteOptimizeResponse:
    businesses = await _load_businesses_or_404(payload.business_ids, db)

    if payload.start_lat is not None and payload.start_lng is not None:
        start_lat, start_lng = payload.start_lat, payload.start_lng
    else:
        # Punto de referencia configurado (oficina/base de operaciones), en
        # vez del centro geográfico de la zona: el vendedor siempre sale del
        # mismo punto físico, sin importar en qué zona estén los negocios.
        reference = await get_reference_point(db)
        start_lat, start_lng = reference.lat, reference.lng

    business_by_id = {str(b.id): b for b in businesses}
    points = [RoutePoint(id=str(b.id), lat=b.lat, lng=b.lng) for b in businesses]

    ordered_route = plan_route(start_lat=start_lat, start_lng=start_lng, points=points)

    stops = [
        RouteStop(
            order=stop.order,
            business=business_by_id[stop.point.id],
            distance_from_previous_km=stop.distance_from_previous_km,
            cumulative_distance_km=stop.cumulative_distance_km,
        )
        for stop in ordered_route
    ]

    # Ruta real por calles (OSRM), best-effort: punto de partida + cada
    # parada en el orden ya decidido arriba.
    real_route = await get_real_route(
        [(start_lat, start_lng)] + [(s.point.lat, s.point.lng) for s in ordered_route]
    )

    return RouteOptimizeResponse(
        start_lat=start_lat,
        start_lng=start_lng,
        total_distance_km=total_distance_km(ordered_route),
        stops=stops,
        real_distance_km=real_route.distance_km if real_route else None,
        real_duration_minutes=real_route.duration_minutes if real_route else None,
        route_geometry=real_route.geometry if real_route else None,
    )


@router.post("/optimize-week", response_model=WeeklyRouteResponse)
async def optimize_weekly_route(
    payload: WeeklyRouteRequest, db: AsyncSession = Depends(get_db)
) -> WeeklyRouteResponse:
    """Reparte los negocios seleccionados en 5 rutas (Lunes a Viernes),
    agrupando por sector geográfico alrededor del punto de partida para que
    cada día cubra una zona compacta en vez de saltar por toda la ciudad."""
    businesses = await _load_businesses_or_404(payload.business_ids, db)

    if payload.start_lat is not None and payload.start_lng is not None:
        start_lat, start_lng = payload.start_lat, payload.start_lng
    else:
        reference = await get_reference_point(db)
        start_lat, start_lng = reference.lat, reference.lng

    business_by_id = {str(b.id): b for b in businesses}
    points = [RoutePoint(id=str(b.id), lat=b.lat, lng=b.lng) for b in businesses]

    weekly_routes = plan_weekly_routes(
        start_lat=start_lat, start_lng=start_lng, points=points, num_days=5
    )

    days = []
    for day_index, day_route in enumerate(weekly_routes):
        real_route = None
        if day_route:
            real_route = await get_real_route(
                [(start_lat, start_lng)] + [(s.point.lat, s.point.lng) for s in day_route]
            )
        days.append(
            DailyRoute(
                day_label=WEEKDAY_LABELS[day_index],
                total_distance_km=total_distance_km(day_route),
                stops=[
                    RouteStop(
                        order=stop.order,
                        business=business_by_id[stop.point.id],
                        distance_from_previous_km=stop.distance_from_previous_km,
                        cumulative_distance_km=stop.cumulative_distance_km,
                    )
                    for stop in day_route
                ],
                real_distance_km=real_route.distance_km if real_route else None,
                real_duration_minutes=real_route.duration_minutes if real_route else None,
                route_geometry=real_route.geometry if real_route else None,
            )
        )

    return WeeklyRouteResponse(start_lat=start_lat, start_lng=start_lng, days=days)


# ---------------------------------------------------------------------------
# Rutas guardadas
# ---------------------------------------------------------------------------
@router.post("/saved", response_model=SavedRouteResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_route(
    payload: SavedRouteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavedRouteResponse:
    """Guarda el conjunto de negocios seleccionados bajo un nombre, para
    poder recalcularlo y reutilizarlo después. Se guardan solo los IDs
    (no un resultado congelado), así que cada vez que se "carga" una ruta
    guardada, se recalcula con el punto de referencia y los datos
    actuales -- nunca queda desactualizada."""
    saved = SavedRoute(
        name=payload.name,
        business_ids=[str(bid) for bid in payload.business_ids],
        created_by_id=current_user.id,
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return SavedRouteResponse(
        id=saved.id,
        name=saved.name,
        business_ids=saved.business_ids,
        created_by_id=saved.created_by_id,
        created_by_name=current_user.full_name,
        created_at=saved.created_at,
    )


@router.get("/saved", response_model=list[SavedRouteResponse])
async def list_saved_routes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SavedRouteResponse]:
    """Lista las rutas guardadas. Los administradores ven todas (de
    cualquier vendedor); los vendedores solo ven las suyas."""
    stmt = select(SavedRoute).order_by(SavedRoute.created_at.desc())
    if current_user.role.value != "admin":
        stmt = stmt.where(SavedRoute.created_by_id == current_user.id)

    result = await db.execute(stmt)
    saved_routes = result.scalars().all()

    # Un solo query extra para resolver los nombres de los creadores.
    creator_ids = {r.created_by_id for r in saved_routes if r.created_by_id}
    creators = {}
    if creator_ids:
        users_result = await db.execute(select(User).where(User.id.in_(creator_ids)))
        creators = {u.id: u.full_name for u in users_result.scalars().all()}

    return [
        SavedRouteResponse(
            id=r.id,
            name=r.name,
            business_ids=r.business_ids,
            created_by_id=r.created_by_id,
            created_by_name=creators.get(r.created_by_id),
            created_at=r.created_at,
        )
        for r in saved_routes
    ]


# BUG CORREGIDO: mismo problema que en businesses.py -- ver esa nota.
@router.delete(
    "/saved/{saved_route_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
async def delete_saved_route(
    saved_route_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    saved = await db.get(SavedRoute, saved_route_id)
    if saved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta no encontrada")

    # Un vendedor solo puede borrar sus propias rutas guardadas; un admin
    # puede borrar cualquiera.
    if current_user.role.value != "admin" and saved.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes eliminar una ruta guardada por otro usuario",
        )

    await db.delete(saved)
    await db.commit()
