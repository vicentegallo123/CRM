"""
Optimizador de rutas de visita.

Dado un punto de partida (lat/lng) y una lista de negocios seleccionados,
ordena los negocios secuencialmente usando una heurística de "vecino más
cercano" (Nearest Neighbor), que en la práctica da muy buenos resultados
para recorridos urbanos de decenas de puntos y es O(n^2), suficientemente
rápido para el tamaño de listas que maneja este CRM (prospectación diaria,
no miles de puntos).

Si en el futuro se requiere una solución más cercana al óptimo del TSP,
este módulo puede sustituirse por una implementación con 2-opt sin cambiar
la interfaz pública (`plan_route`).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Sequence


EARTH_RADIUS_KM = 6371.0088


@dataclass
class RoutePoint:
    id: str
    lat: float
    lng: float


@dataclass
class RouteStopResult:
    point: RoutePoint
    order: int
    distance_from_previous_km: float
    cumulative_distance_km: float


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en línea recta (km) entre dos coordenadas geográficas."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def plan_route(
    start_lat: float, start_lng: float, points: Sequence[RoutePoint]
) -> List[RouteStopResult]:
    """Ordena `points` minimizando la distancia recorrida partiendo de
    (start_lat, start_lng) usando la heurística de vecino más cercano.

    Devuelve la secuencia ordenada junto con la distancia (km) desde la
    parada anterior y la distancia acumulada hasta ese punto.
    """
    remaining = list(points)
    ordered: List[RouteStopResult] = []

    current_lat, current_lng = start_lat, start_lng
    cumulative = 0.0
    order = 1

    while remaining:
        nearest_index = 0
        nearest_distance = math.inf

        for i, point in enumerate(remaining):
            distance = haversine_km(current_lat, current_lng, point.lat, point.lng)
            if distance < nearest_distance:
                nearest_distance = distance
                nearest_index = i

        nearest_point = remaining.pop(nearest_index)
        cumulative += nearest_distance

        ordered.append(
            RouteStopResult(
                point=nearest_point,
                order=order,
                distance_from_previous_km=round(nearest_distance, 3),
                cumulative_distance_km=round(cumulative, 3),
            )
        )

        current_lat, current_lng = nearest_point.lat, nearest_point.lng
        order += 1

    return ordered


def total_distance_km(route: List[RouteStopResult]) -> float:
    if not route:
        return 0.0
    return route[-1].cumulative_distance_km


def bearing_degrees(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Ángulo (0-360°) desde el punto 1 hacia el punto 2, medido en sentido
    horario desde el norte. Se usa para agrupar negocios en "sectores"
    geográficos compactos alrededor de un punto de partida fijo."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lng2 - lng1)

    x = math.sin(delta_lambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(
        delta_lambda
    )
    theta = math.atan2(x, y)
    return (math.degrees(theta) + 360) % 360


def plan_weekly_routes(
    start_lat: float,
    start_lng: float,
    points: Sequence[RoutePoint],
    num_days: int = 5,
) -> List[List[RouteStopResult]]:
    """Reparte `points` en `num_days` grupos geográficamente compactos
    (usando un "barrido angular" alrededor del punto de partida, similar a
    cómo se particiona un territorio de reparto entre varios días/rutas) y
    calcula, para cada día, el orden óptimo de visita con `plan_route`.

    Esto evita que un mismo día salte de un extremo a otro de la ciudad:
    cada día cubre un sector angular contiguo visto desde la oficina/base
    de operaciones (el punto de partida).

    Devuelve una lista de `num_days` listas de `RouteStopResult` (una por
    día). Si hay menos negocios que días, algunos días quedan vacíos.
    """
    if not points:
        return [[] for _ in range(num_days)]

    # Ordena los puntos por su ángulo (bearing) respecto al punto de
    # partida, de forma que negocios geográficamente cercanos entre sí
    # queden contiguos en la lista.
    sorted_points = sorted(
        points,
        key=lambda p: bearing_degrees(start_lat, start_lng, p.lat, p.lng),
    )

    total = len(sorted_points)
    effective_days = min(num_days, total) or 1
    base_size, remainder = divmod(total, effective_days)

    day_groups: List[List[RoutePoint]] = []
    index = 0
    for day_index in range(effective_days):
        # Reparte el residuo entre los primeros grupos para que ningún día
        # quede desproporcionadamente más cargado que otro.
        group_size = base_size + (1 if day_index < remainder else 0)
        day_groups.append(sorted_points[index : index + group_size])
        index += group_size

    # Completa con grupos vacíos si num_days > cantidad de negocios.
    while len(day_groups) < num_days:
        day_groups.append([])

    return [
        plan_route(start_lat=start_lat, start_lng=start_lng, points=group)
        for group in day_groups
    ]
