
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.business import Business, CategoryEnum, ZoneEnum
from app.services.reference_point_service import get_reference_point
from app.services.report_generator import build_businesses_report

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/businesses.xlsx")
async def download_businesses_report(
    zone: Optional[ZoneEnum] = Query(default=None),
    category: Optional[CategoryEnum] = Query(default=None),
    search: Optional[str] = Query(default=None),
    visited: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> Response:
    stmt = select(Business)

    if zone is not None:
        stmt = stmt.where(Business.zone == zone)
    if category is not None:
        stmt = stmt.where(Business.category == category)
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

    stmt = stmt.order_by(Business.zone, Business.category, Business.name)
    result = await db.execute(stmt)
    businesses = result.scalars().all()

    reference = await get_reference_point(db)
    file_bytes = build_businesses_report(businesses, reference)
    filename = f"prospectos_zmg_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
