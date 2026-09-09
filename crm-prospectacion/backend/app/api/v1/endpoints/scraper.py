
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.business import Business
from app.models.user import User
from app.schemas.business import ScraperRequest, ScraperResponse
from app.services.gmaps_scraper import run_scraper
from app.services.reference_point_service import get_reference_point
from app.services.route_planner import haversine_km

router = APIRouter(
    prefix="/scraper",
    tags=["scraper"],
    dependencies=[Depends(get_current_user)],  # solo usuarios autenticados pueden lanzar scraping
)


@router.post("/run", response_model=ScraperResponse)
async def run_scraper_endpoint(
    payload: ScraperRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScraperResponse:
    reference = await get_reference_point(db)
    try:
        scraped = await run_scraper(
            category=payload.category.value,
            zone=payload.zone.value,
            max_results=payload.max_results,
            near_reference_point=payload.max_distance_km is not None,
            ref_lat=reference.lat,
            ref_lng=reference.lng,
            ref_label=reference.label,
        )
    except Exception as exc:  # pragma: no cover - depende del entorno del navegador
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error ejecutando el scraper: {exc}",
        ) from exc

    if not scraped:
        return ScraperResponse(
            query=f"{payload.category.value} en {payload.zone.value}",
            zone=payload.zone,
            category=payload.category,
            found=0,
            inserted=0,
            skipped_duplicates=0,
            skipped_out_of_range=0,
            businesses=[],
        )

    # Filtro exacto por radio desde el punto de referencia configurado.
    skipped_out_of_range = 0
    if payload.max_distance_km is not None:
        filtered = []
        for item in scraped:
            if item.lat is None or item.lng is None:
                filtered.append(item)  # se descarta después por falta de coords
                continue
            distance = haversine_km(reference.lat, reference.lng, item.lat, item.lng)
            if distance <= payload.max_distance_km:
                filtered.append(item)
            else:
                skipped_out_of_range += 1
        scraped = filtered

    # Cargar duplicados existentes (misma zona + nombre) para no insertar dos veces.
    existing_stmt = select(Business.name).where(Business.zone == payload.zone)
    existing_result = await db.execute(existing_stmt)
    existing_names = {name.lower().strip() for name in existing_result.scalars().all()}

    inserted_businesses = []
    skipped = 0

    for item in scraped:
        if item.lat is None or item.lng is None:
            skipped += 1
            continue

        if item.name.lower().strip() in existing_names:
            skipped += 1
            continue

        business = Business(
            name=item.name,
            category=payload.category,
            zone=payload.zone,
            lat=item.lat,
            lng=item.lng,
            address=item.address,
            phone=item.phone,
            website=item.website,
            products_services=item.products_services,
            rating=item.rating,
            source_url=item.source_url,
            assigned_to_id=current_user.id,
        )
        db.add(business)
        inserted_businesses.append(business)
        existing_names.add(item.name.lower().strip())

    if inserted_businesses:
        await db.commit()
        for business in inserted_businesses:
            await db.refresh(business)

    return ScraperResponse(
        query=f"{payload.category.value} en {payload.zone.value}",
        zone=payload.zone,
        category=payload.category,
        found=len(scraped) + skipped_out_of_range,
        inserted=len(inserted_businesses),
        skipped_duplicates=skipped,
        skipped_out_of_range=skipped_out_of_range,
        businesses=inserted_businesses,
    )
