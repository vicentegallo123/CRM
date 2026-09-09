"""
Ruteo real por calles (estilo Waze/Google Maps) usando OSRM (Open Source
Routing Machine), un motor de rutas gratuito y de código abierto.

Este servicio NO decide el ORDEN de las paradas (eso lo sigue haciendo
`route_planner.py` con la heurística de vecino más cercano); solo toma un
orden ya decidido y le pide a OSRM la ruta REAL por calles entre esos
puntos, en ese orden -- distancia real de manejo, tiempo estimado real, y
la geometría de la ruta (para dibujarla siguiendo las calles en el mapa,
en vez de líneas rectas).

Usa el servidor público de demostración de OSRM por defecto
(router.project-osrm.org), que es gratuito pero no está pensado para
tráfico intensivo de producción. Por eso todo este servicio está diseñado
para fallar de forma segura: si OSRM no responde (sin internet, límite de
uso, servidor caído), se registra un aviso y se devuelve `None` en vez de
tronar -- el resto de la app sigue funcionando con distancias en línea
recta como respaldo.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("crm_prospectacion.osrm")


@dataclass
class RealRoute:
    distance_km: float
    duration_minutes: float
    # Lista de [lat, lng] siguiendo las calles reales, en orden.
    geometry: List[List[float]]


async def get_real_route(points: Sequence[Tuple[float, float]]) -> Optional[RealRoute]:
    """Pide a OSRM la ruta real por calles que pasa, EN ORDEN, por cada
    punto de `points` (tuplas de (lat, lng)). Devuelve `None` si hay menos
    de 2 puntos, o si OSRM no responde por cualquier motivo -- nunca lanza
    una excepción hacia quien lo llama, para que un fallo de este servicio
    externo jamás rompa el cálculo de rutas del sistema."""
    if len(points) < 2:
        return None

    # OSRM espera "lng,lat" (al revés de como solemos pensar en lat/lng),
    # separando cada punto con ";".
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in points)
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{coords_str}"
    params = {"overview": "full", "geometries": "geojson"}

    try:
        async with httpx.AsyncClient(timeout=settings.OSRM_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            logger.warning("OSRM no devolvió una ruta válida: %s", data.get("code"))
            return None

        route = data["routes"][0]
        # GeoJSON viene como [lng, lat] por punto; lo invertimos a [lat, lng]
        # para que coincida con lo que espera Leaflet en el frontend.
        geometry = [
            [coord[1], coord[0]] for coord in route["geometry"]["coordinates"]
        ]

        return RealRoute(
            distance_km=round(route["distance"] / 1000, 2),
            duration_minutes=round(route["duration"] / 60, 1),
            geometry=geometry,
        )
    except Exception as exc:  # noqa: BLE001 - fallo externo, nunca debe tronar la app
        logger.warning("No se pudo obtener ruta real de OSRM: %s", exc)
        return None
