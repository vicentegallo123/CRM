
function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-brand-700/70">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent || "text-brand-900"}`}>
        {value}
      </p>
    </div>
  );
}

function BreakdownBars({ title, items }) {
  const max = items.length > 0 ? Math.max(...items.map((i) => i.count)) : 0;
  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <p className="font-display mb-3 text-sm font-semibold text-brand-900">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-brand-400">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-0.5 flex items-center justify-between text-xs text-brand-700">
                <span>{item.label}</span>
                <span className="font-medium text-brand-900">{item.count}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-brand-50">
                <div
                  className="h-2 rounded-full bg-brand-600"
                  style={{ width: max > 0 ? `${(item.count / max) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardMetrics({
  summary,
  isLoading,
  errorMessage,
  onReload,
  onDownloadReport,
  isExportingReport,
}) {
  if (isLoading && !summary) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-brand-500">
        Cargando métricas…
      </div>
    );
  }

  if (errorMessage && !summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-red-600">
        <p>{errorMessage}</p>
        <button
          type="button"
          onClick={onReload}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="scroll-slim h-full overflow-y-auto p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-brand-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          {onDownloadReport && (
            <button
              type="button"
              onClick={onDownloadReport}
              disabled={isExportingReport}
              className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              {isExportingReport ? "Generando…" : "⬇ Descargar reporte (Excel)"}
            </button>
          )}
          <button
            type="button"
            onClick={onReload}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas de totales */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Prospectos totales" value={summary.total_businesses} />
        <StatCard label="Visitados" value={summary.visited_count} />
        <StatCard label="Sin visitar" value={summary.not_visited_count} accent="text-amber-600" />
        <StatCard label="Clientes" value={summary.clients_count} accent="text-green-600" />
        <StatCard
          label="Tasa de conversión"
          value={`${summary.conversion_rate_pct}%`}
          accent="text-brand-700"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <StatCard
          label="Consumo mensual estimado (clientes)"
          value={(summary.estimated_monthly_revenue_units ?? 0).toLocaleString("es-MX", {
            maximumFractionDigits: 2,
          })}
          accent="text-green-700"
        />
        <StatCard
          label="Visitas sin seguimiento (+30 días)"
          value={summary.stale_visits_count ?? 0}
          accent={summary.stale_visits_count > 0 ? "text-red-600" : "text-brand-900"}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatCard
          label="Café regalado en muestras (g)"
          value={(summary.total_sample_grams ?? 0).toLocaleString("es-MX")}
          accent="text-amber-700"
        />
        <StatCard
          label="Costo real del café regalado (Nudo Verde)"
          value={`$${(summary.total_sample_cost ?? 0).toLocaleString("es-MX", {
            maximumFractionDigits: 2,
          })}`}
          accent="text-amber-800"
        />
        <StatCard
          label="Costo total estimado de visitas realizadas"
          value={(summary.total_visit_cost_estimate ?? 0).toLocaleString("es-MX", {
            maximumFractionDigits: 2,
          })}
          accent="text-red-700"
        />
      </div>

      {/* Desgloses */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownBars title="Por etapa" items={summary.by_stage ?? []} />
        <BreakdownBars title="Por giro" items={summary.by_category ?? []} />
        <BreakdownBars title="Por zona" items={summary.by_zone ?? []} />
      </div>

      {/* Recordatorios de próximo contacto */}
      {(summary.reminders ?? []).length > 0 && (
        <div className="mb-6 rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <p className="font-display mb-3 text-sm font-semibold text-brand-900">
            📅 Recordatorios de contacto
          </p>
          <ul className="divide-y divide-brand-50">
            {summary.reminders.map((r) => (
              <li key={r.business_id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-brand-900">{r.business_name}</span>
                {r.days_overdue > 0 ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Vencido hace {r.days_overdue} día{r.days_overdue !== 1 ? "s" : ""}
                  </span>
                ) : r.days_overdue === 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Hoy
                  </span>
                ) : (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                    En {Math.abs(r.days_overdue)} día{Math.abs(r.days_overdue) !== 1 ? "s" : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sugerencias */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <p className="font-display mb-2 text-sm font-semibold text-brand-900">💡 Sugerencias</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-brand-800">
          {(summary.suggestions ?? []).map((s, index) => (
            <li key={index}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
