
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "CRM Prospectación ZMG"
    API_V1_STR: str = "/api/v1"

    # Base de datos (PostgreSQL + PostGIS opcional). Driver: psycopg (v3),
    # no asyncpg -- ver nota en requirements.txt sobre por que.
    POSTGRES_USER: str = "crm_user"
    POSTGRES_PASSWORD: str = "crm_password"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "crm_prospectacion"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Seguridad / Autenticación
    SECRET_KEY: str = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION_1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 horas
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 días

    # Rate limiting básico (requests por minuto por IP)
    RATE_LIMIT_PER_MINUTE: int = 60

    # Scraper
    SCRAPER_HEADLESS: bool = True
    SCRAPER_MAX_RESULTS: int = 40
    SCRAPER_TIMEOUT_MS: int = 45000

    # Punto de referencia fijo (oficina/base de operaciones) usado como
    # punto de partida por defecto para el optimizador de rutas, cuando el
    # cliente no especifica start_lat/start_lng explícitos.
    # Dirección: Av Unión 126, Col. Americana, Lafayette, 44140 Guadalajara, Jal.
    # NOTA: estas coordenadas son una aproximación de la zona (Colonia
    # Americana / Lafayette). Para precisión exacta a nivel de portón,
    # ábrela en Google Maps, haz clic derecho sobre el punto exacto y
    # copia las coordenadas que aparecen arriba del menú; luego actualiza
    # REFERENCE_POINT_LAT/REFERENCE_POINT_LNG en tu archivo .env.
    REFERENCE_POINT_LABEL: str = "Av Unión 126, Col. Americana, Guadalajara, Jal."
    REFERENCE_POINT_LAT: float = 20.6750
    REFERENCE_POINT_LNG: float = -103.3697

    # Costo estimado por kilómetro recorrido (combustible + desgaste),
    # usado para calcular el "costo de visita" de cada negocio: se asume
    # un viaje de ida y vuelta desde el punto de referencia fijo. Ajusta
    # este valor en tu .env según el costo real de tu vehículo/combustible
    # (moneda: la que uses para tus propios reportes, ej. MXN).
    COST_PER_KM: float = 3.5

    # Motor de rutas reales por calles (OSRM). Se usa el servidor público
    # de demostración de OSRM por defecto -- es gratuito pero NO pensado
    # para uso intensivo en producción (puede tener límites de uso o
    # caerse ocasionalmente). Si eso pasa, la app simplemente sigue
    # funcionando con líneas rectas (distancia en línea recta), sin
    # romperse. Para uso serio a futuro, considera self-hostear tu propio
    # servidor OSRM y cambiar esta URL en tu .env.
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    OSRM_TIMEOUT_SECONDS: float = 8.0

    # Coordenadas aproximadas de centro de cada zona (fallback histórico,
    # ya no se usa como punto de partida por defecto de las rutas, pero se
    # conserva por si se necesita en el futuro).
    ZONE_CENTERS: dict = {
        "Zapopan": {"lat": 20.7214, "lng": -103.3910},
        "Guadalajara": {"lat": 20.6767, "lng": -103.3475},
    }

    VALID_ZONES: List[str] = ["Zapopan", "Guadalajara"]
    VALID_CATEGORIES: List[str] = [
        "cafeteria",
        "funeraria",
        "escuela",
        "restaurante",
        "farmacia",
        "gimnasio",
        "ferreteria",
        "consultorio_medico",
        "despacho_contable",
        "hotel",
        "cooperativa",
        "otro",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
