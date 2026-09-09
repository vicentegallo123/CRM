"""
Cálculo de métricas agregadas del pipeline de ventas (dashboard) y
generación de sugerencias accionables basadas en reglas simples sobre los
datos actuales (sin necesidad de un modelo de ML: son observaciones
directas sobre la distribución de negocios, visitas y clientes).
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Sequence

from app.core.config import settings
from app.models.business import Business, StageEnum
from app.schemas.business import CountBreakdown, DashboardSummary, ReminderItem
from app.services.coffee_catalog import calculate_sample_cost
from app.services.reference_point_service import ReferencePoint
from app.services.route_planner import haversine_km

# Factor para convertir un consumo periódico a un equivalente mensual
# aproximado, usado solo para el estimado de ingresos del dashboard.
_MONTHLY_FACTOR = {
    "semanal": 4.33,
    "quincenal": 2.166,
    "mensual": 1.0,
}

_STALE_VISIT_DAYS = 30
_REMINDER_LOOKAHEAD_DAYS = 3  # muestra recordatorios vencidos y los que vencen en los próximos N días

_CATEGORY_LABELS = {
    "cafeteria": "Cafetería",
    "funeraria": "Funeraria",
    "escuela": "Escuela",
    "restaurante": "Restaurante",
    "farmacia": "Farmacia",
    "gimnasio": "Gimnasio",
    "ferreteria": "Ferretería",
    "consultorio_medico": "Consultorio médico",
    "despacho_contable": "Despacho contable",
    "hotel": "Hotel",
    "cooperativa": "Cooperativa",
    "otro": "Otro",
}

_STAGE_LABELS = {
    StageEnum.NUEVO: "Nuevo",
    StageEnum.CONTACTADO: "Contactado",
    StageEnum.VISITADO: "Visitado",
    StageEnum.CLIENTE: "Cliente",
    StageEnum.DESCARTADO: "Descartado",
}


def _sorted_breakdown(counter: Counter, label_map: dict | None = None) -> list[CountBreakdown]:
    items = sorted(counter.items(), key=lambda kv: kv[1], reverse=True)
    return [
        CountBreakdown(label=(label_map.get(key, str(key)) if label_map else str(key)), count=count)
        for key, count in items
    ]


def compute_dashboard_summary(
    businesses: Sequence[Business], reference: ReferencePoint
) -> DashboardSummary:
    total = len(businesses)
    now = datetime.now(timezone.utc)

    visited_count = sum(1 for b in businesses if b.visited)
    clients_count = sum(1 for b in businesses if b.is_client)
    conversion_rate = round((clients_count / total * 100), 1) if total else 0.0

    stage_counter = Counter(b.stage for b in businesses)
    category_counter = Counter(b.category.value for b in businesses)
    zone_counter = Counter(b.zone.value for b in businesses)

    estimated_monthly_revenue = 0.0
    for b in businesses:
        if b.is_client and b.purchase_amount and b.purchase_frequency:
            factor = _MONTHLY_FACTOR.get(b.purchase_frequency.value, 0.0)
            estimated_monthly_revenue += b.purchase_amount * factor

    # Totales de café regalado en muestras y de costo de visitas (ida y
    # vuelta desde el punto de referencia configurado). Solo se cuenta el
    # costo de las visitas que YA se hicieron (visited=True); las
    # pendientes todavía no representan un gasto real.
    total_sample_grams = sum(b.sample_grams or 0.0 for b in businesses)
    total_sample_cost = sum(
        calculate_sample_cost(b.coffee_offered, b.sample_grams) or 0.0 for b in businesses
    )
    total_visit_cost_estimate = 0.0
    for b in businesses:
        if b.visited:
            distance_km = haversine_km(reference.lat, reference.lng, b.lat, b.lng)
            total_visit_cost_estimate += distance_km * 2 * settings.COST_PER_KM

    stale_cutoff = now - timedelta(days=_STALE_VISIT_DAYS)
    stale_visits = [
        b
        for b in businesses
        if b.visited
        and not b.is_client
        and b.last_visited_at is not None
        and b.last_visited_at < stale_cutoff
    ]

    # Recordatorios: negocios con una fecha de "próximo contacto" ya vencida
    # o que vence pronto. Se excluyen los descartados (ya no tiene caso
    # recordarle al vendedor que los contacte).
    reminder_cutoff = now + timedelta(days=_REMINDER_LOOKAHEAD_DAYS)
    reminder_candidates = [
        b
        for b in businesses
        if b.next_contact_date is not None
        and b.next_contact_date <= reminder_cutoff
        and b.stage != StageEnum.DESCARTADO
    ]
    reminder_candidates.sort(key=lambda b: b.next_contact_date)
    reminders = [
        ReminderItem(
            business_id=b.id,
            business_name=b.name,
            next_contact_date=b.next_contact_date,
            days_overdue=(now.date() - b.next_contact_date.date()).days,
        )
        for b in reminder_candidates[:20]
    ]

    suggestions: list[str] = []

    overdue_count = sum(1 for r in reminders if r.days_overdue > 0)
    if overdue_count > 0:
        suggestions.append(
            f"Tienes {overdue_count} recordatorio{'s' if overdue_count != 1 else ''} de contacto "
            f"vencido{'s' if overdue_count != 1 else ''} -- revisa la sección de Recordatorios."
        )

    not_visited = total - visited_count
    if not_visited > 0:
        suggestions.append(
            f"Tienes {not_visited} prospecto{'s' if not_visited != 1 else ''} sin visitar todavía."
        )

    if stale_visits:
        suggestions.append(
            f"{len(stale_visits)} negocio{'s' if len(stale_visits) != 1 else ''} "
            f"visitado{'s' if len(stale_visits) != 1 else ''} hace más de {_STALE_VISIT_DAYS} días "
            "y aún no son clientes -- considera darles seguimiento."
        )

    nuevo_count = stage_counter.get(StageEnum.NUEVO, 0)
    if nuevo_count > 0:
        suggestions.append(
            f"{nuevo_count} prospecto{'s' if nuevo_count != 1 else ''} en la etapa 'Nuevo' "
            "esperando primer contacto."
        )

    if category_counter:
        top_category, top_count = category_counter.most_common(1)[0]
        suggestions.append(
            f"'{_CATEGORY_LABELS.get(top_category, top_category)}' es tu giro con más "
            f"prospectos ({top_count}) -- podría ser tu mercado más fuerte."
        )

    if zone_counter and len(zone_counter) > 1:
        least_zone, least_count = min(zone_counter.items(), key=lambda kv: kv[1])
        suggestions.append(
            f"{least_zone} tiene pocos prospectos ({least_count}) -- "
            "podría valer la pena buscar más ahí."
        )

    if total > 0 and clients_count == 0:
        suggestions.append(
            "Aún no tienes ningún negocio marcado como cliente. Actualiza la etapa a "
            "'Cliente' en el tablero cuando alguno empiece a comprarte."
        )

    if not suggestions:
        suggestions.append("Todo al día: no hay pendientes urgentes en este momento.")

    return DashboardSummary(
        total_businesses=total,
        visited_count=visited_count,
        not_visited_count=not_visited,
        clients_count=clients_count,
        conversion_rate_pct=conversion_rate,
        estimated_monthly_revenue_units=round(estimated_monthly_revenue, 2),
        total_sample_grams=round(total_sample_grams, 1),
        total_sample_cost=round(total_sample_cost, 2),
        total_visit_cost_estimate=round(total_visit_cost_estimate, 2),
        by_stage=_sorted_breakdown(stage_counter, _STAGE_LABELS),
        by_category=_sorted_breakdown(category_counter, _CATEGORY_LABELS),
        by_zone=_sorted_breakdown(zone_counter),
        stale_visits_count=len(stale_visits),
        reminders=reminders,
        suggestions=suggestions,
    )
