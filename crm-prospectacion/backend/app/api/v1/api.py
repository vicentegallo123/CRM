
from fastapi import APIRouter

from app.api.v1.endpoints import auth, businesses, dashboard, reports, routes, scraper

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(businesses.router)
api_router.include_router(scraper.router)
api_router.include_router(routes.router)
api_router.include_router(reports.router)
api_router.include_router(dashboard.router)
