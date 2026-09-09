
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.business import Business
from app.schemas.business import DashboardSummary
from app.services.dashboard_service import compute_dashboard_summary
from app.services.reference_point_service import get_reference_point

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummary:
    result = await db.execute(select(Business))
    businesses = result.scalars().all()
    reference = await get_reference_point(db)
    return compute_dashboard_summary(businesses, reference)
