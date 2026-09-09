
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.business import CategoryEnum, PurchaseFrequencyEnum, StageEnum, ZoneEnum


class BusinessBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: CategoryEnum
    zone: ZoneEnum
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    products_services: Optional[str] = None
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    source_url: Optional[str] = None
    notes: Optional[str] = None
    stage: StageEnum = StageEnum.NUEVO
    coffee_offered: Optional[str] = None
    sample_grams: Optional[float] = Field(default=None, ge=0)
    is_client: bool = False
    purchase_amount: Optional[float] = Field(default=None, ge=0)
    purchase_frequency: Optional[PurchaseFrequencyEnum] = None
    next_contact_date: Optional[datetime] = None


class BusinessCreate(BusinessBase):
    pass


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[CategoryEnum] = None
    zone: Optional[ZoneEnum] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    products_services: Optional[str] = None
    rating: Optional[float] = None
    visited: Optional[bool] = None
    notes: Optional[str] = None
    stage: Optional[StageEnum] = None
    coffee_offered: Optional[str] = None
    sample_grams: Optional[float] = Field(default=None, ge=0)
    is_client: Optional[bool] = None
    purchase_amount: Optional[float] = Field(default=None, ge=0)
    purchase_frequency: Optional[PurchaseFrequencyEnum] = None
    next_contact_date: Optional[datetime] = None


class BusinessResponse(BusinessBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    visited: bool = False
    last_visited_at: Optional[datetime] = None
    # Distancia en línea recta (km) desde el punto de referencia fijo.
    # Se calcula en el endpoint al momento de responder; no es una columna
    # de la base de datos.
    distance_km: Optional[float] = None
    # Costo estimado de visitar este negocio (ida y vuelta desde el punto
    # de referencia fijo, usando settings.COST_PER_KM). Igual que
    # distance_km, se calcula al vuelo, no se guarda en la base de datos.
    visit_cost_estimate: Optional[float] = None
    # Vendedor "dueño" del prospecto. assigned_to_name se resuelve en el
    # endpoint (join contra users), no es una columna de businesses.
    assigned_to_id: Optional[uuid.UUID] = None
    assigned_to_name: Optional[str] = None
    # Costo real de la muestra (gramos × precio del catálogo Nudo Verde).
    # Se calcula en el endpoint; None si el texto de coffee_offered no
    # coincide exactamente con ningún producto del catálogo.
    sample_cost: Optional[float] = None


class BusinessListResponse(BaseModel):
    total: int
    items: List[BusinessResponse]


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------
class ScraperRequest(BaseModel):
    category: CategoryEnum
    zone: ZoneEnum
    max_results: Optional[int] = Field(default=None, ge=1, le=200)
    max_distance_km: Optional[float] = Field(
        default=None,
        ge=0.1,
        le=100,
        description=(
            "Radio máximo (en km) desde el punto de referencia fijo. Si se "
            "especifica, la búsqueda en Google Maps se centra explícitamente "
            "cerca del punto de referencia (en vez de la zona completa) para "
            "maximizar resultados relevantes dentro del radio, y además se "
            "descarta matemáticamente cualquier resultado que quede fuera."
        ),
    )


class ScraperResponse(BaseModel):
    query: str
    zone: ZoneEnum
    category: CategoryEnum
    found: int
    inserted: int
    skipped_duplicates: int
    skipped_out_of_range: int = 0
    businesses: List[BusinessResponse]


# ---------------------------------------------------------------------------
# Optimizador de rutas
# ---------------------------------------------------------------------------
class RouteOptimizeRequest(BaseModel):
    business_ids: List[uuid.UUID] = Field(..., min_length=1)
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None


class RouteStop(BaseModel):
    order: int
    business: BusinessResponse
    distance_from_previous_km: float
    cumulative_distance_km: float


class RouteOptimizeResponse(BaseModel):
    start_lat: float
    start_lng: float
    total_distance_km: float
    stops: List[RouteStop]
    # --- Ruta real por calles (OSRM), opcional: si el servicio de rutas no
    # responde (sin internet, límite del servidor público gratuito, etc.),
    # estos campos quedan en None y el frontend simplemente dibuja la línea
    # recta entre puntos como respaldo -- la app sigue funcionando igual.
    real_distance_km: Optional[float] = None
    real_duration_minutes: Optional[float] = None
    # Lista de [lat, lng] siguiendo las calles reales, lista para dibujar
    # directamente como polilínea en Leaflet.
    route_geometry: Optional[List[List[float]]] = None


# ---------------------------------------------------------------------------
# Ruta semanal (Lunes a Viernes)
# ---------------------------------------------------------------------------
WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]


class WeeklyRouteRequest(BaseModel):
    business_ids: List[uuid.UUID] = Field(..., min_length=1)
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None


class DailyRoute(BaseModel):
    day_label: str
    total_distance_km: float
    stops: List[RouteStop]
    real_distance_km: Optional[float] = None
    real_duration_minutes: Optional[float] = None
    route_geometry: Optional[List[List[float]]] = None


class WeeklyRouteResponse(BaseModel):
    start_lat: float
    start_lng: float
    days: List[DailyRoute]


# ---------------------------------------------------------------------------
# Rutas guardadas
# ---------------------------------------------------------------------------
class SavedRouteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    business_ids: List[uuid.UUID] = Field(..., min_length=1)


class SavedRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    business_ids: List[str]
    created_by_id: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Dashboard de métricas
# ---------------------------------------------------------------------------
class CountBreakdown(BaseModel):
    label: str
    count: int


class ReminderItem(BaseModel):
    business_id: uuid.UUID
    business_name: str
    next_contact_date: datetime
    days_overdue: int  # positivo = ya se pasó de fecha; 0 = es hoy; negativo = aún faltan días


class DashboardSummary(BaseModel):
    total_businesses: int
    visited_count: int
    not_visited_count: int
    clients_count: int
    conversion_rate_pct: float
    estimated_monthly_revenue_units: float
    total_sample_grams: float
    total_sample_cost: float
    total_visit_cost_estimate: float
    by_stage: List[CountBreakdown]
    by_category: List[CountBreakdown]
    by_zone: List[CountBreakdown]
    stale_visits_count: int
    reminders: List[ReminderItem]
    suggestions: List[str]

