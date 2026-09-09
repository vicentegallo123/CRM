"""
Punto de entrada de la API FastAPI.

Ejecutar en desarrollo con:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

NOTA IMPORTANTE SOBRE EL ORDEN DE MIDDLEWARES:
En Starlette/FastAPI, el middleware que se agrega AL FINAL con
`app.add_middleware(...)` termina siendo el más "externo" (envuelve a
todos los demás). Si `CORSMiddleware` no es el último en agregarse, un
error lanzado dentro de OTRO middleware (rate limiting, trusted host,
etc.) nunca llega a pasar por CORS, y el navegador reporta el fallo como
"bloqueado por política CORS" aunque la causa real sea otra (ej. un 500 o
un 429). Por eso aquí `CORSMiddleware` se agrega deliberadamente al
final: así envuelve a todo lo demás y siempre añade sus encabezados,
incluso a respuestas de error generadas por otros middlewares.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.db.session import init_db

logger = logging.getLogger("crm_prospectacion")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crea las tablas si no existen.
    await init_db()
    yield
    # Shutdown: sin recursos adicionales que liberar por ahora.


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Agrega cabeceras de seguridad estándar a toda respuesta HTTP."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


# --- Orden deliberado: cada `add_middleware` envuelve a los anteriores.
# CORS se agrega AL FINAL para ser la capa más externa (ver nota arriba). ---
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Datos de entrada inválidos", "errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Nunca se filtra el detalle interno/stacktrace al cliente; se registra en logs.
    logger.exception("Error no controlado procesando %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Ocurrió un error interno. Intenta de nuevo más tarde."},
    )


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok", "project": settings.PROJECT_NAME}
