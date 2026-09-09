"""
Punto único de verdad para leer y escribir el punto de referencia fijo
(oficina/base de operaciones). Todo el resto del sistema (cálculo de
distancias, optimizador de rutas, dashboard, reportes y scraper) debe
obtener el punto de referencia a través de este módulo, nunca leyendo
`settings.REFERENCE_POINT_*` directamente -- así, cuando el usuario lo
actualiza desde la app, el cambio aplica en todos lados de inmediato, sin
reiniciar el servidor ni tocar variables de entorno.

Si todavía no se ha configurado ningún punto desde la app (tabla vacía),
se usa el valor por defecto de `settings` como respaldo inicial.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.reference_point import SINGLETON_ID, ReferencePointSetting


@dataclass
class ReferencePoint:
    label: str
    lat: float
    lng: float


async def get_reference_point(db: AsyncSession) -> ReferencePoint:
    """Devuelve el punto de referencia guardado en la base de datos, o el
    valor por defecto de `settings` si el usuario todavía no ha configurado
    ninguno desde la app."""
    result = await db.execute(
        select(ReferencePointSetting).where(ReferencePointSetting.id == SINGLETON_ID)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return ReferencePoint(label=row.label, lat=row.lat, lng=row.lng)

    return ReferencePoint(
        label=settings.REFERENCE_POINT_LABEL,
        lat=settings.REFERENCE_POINT_LAT,
        lng=settings.REFERENCE_POINT_LNG,
    )


async def set_reference_point(
    db: AsyncSession, label: str, lat: float, lng: float
) -> ReferencePoint:
    """Crea o actualiza (upsert) el punto de referencia único guardado en
    la base de datos."""
    result = await db.execute(
        select(ReferencePointSetting).where(ReferencePointSetting.id == SINGLETON_ID)
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = ReferencePointSetting(id=SINGLETON_ID, label=label, lat=lat, lng=lng)
        db.add(row)
    else:
        row.label = label
        row.lat = lat
        row.lng = lng

    await db.commit()
    await db.refresh(row)
    return ReferencePoint(label=row.label, lat=row.lat, lng=row.lng)
