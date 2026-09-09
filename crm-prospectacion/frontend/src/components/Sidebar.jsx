
import { useState } from "react";
import { CATEGORIES, ZONES } from "../api/businessApi.js";

const CATEGORY_LABELS = {
  cafeteria: "Cafetería",
  funeraria: "Funeraria",
  escuela: "Escuela",
  restaurante: "Restaurante",
  farmacia: "Farmacia",
  gimnasio: "Gimnasio",
  ferreteria: "Ferretería",
  consultorio_medico: "Consultorio médico",
  despacho_contable: "Despacho contable",
  hotel: "Hotel",
  cooperativa: "Cooperativa",
  otro: "Otro",
};

export default function Sidebar({
  filters,
  onUpdateFilter,
  onResetFilters,
  businesses,
  totalCount,
  selectedIds,
  onToggleSelected,
  onClearSelection,
  onRunScraper,
  onComputeRoute,
  onComputeWeeklyRoute,
  isLoadingBusinesses,
  isScraping,
  isOptimizing,
  isOptimizingWeek,
  isExportingReport,
  errorMessage,
  onClearError,
  routeTotalDistanceKm,
  weeklyRoute,
  selectedDayIndex,
  onSelectDay,
  referencePoint,
  isUpdatingReferencePoint,
  onUseCurrentLocationAsReferencePoint,
  currentUser,
  onLogout,
  onDownloadReport,
  onDeleteBusiness,
  onOpenDetail,
  isMobileOpen,
  onMobileClose,
  savedRoutes,
  isSavingRoute,
  onSaveRoute,
  onLoadSavedRoute,
  onDeleteSavedRoute,
  isCollapsed,
  zones,
  isDrawingZone,
  onStartDrawingZone,
  onUpdateZoneColor,
  onRenameZone,
  onDeleteZone,
}) {
  const [scraperZone, setScraperZone] = useState(ZONES[0]);
  const [scraperCategory, setScraperCategory] = useState(CATEGORIES[0]);
  const [scraperMaxResults, setScraperMaxResults] = useState(30);
  const [scraperMaxDistanceKm, setScraperMaxDistanceKm] = useState("");
  const [lastScraperResult, setLastScraperResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const handleRunScraper = async (event) => {
    event.preventDefault();
    setLastScraperResult(null);
    const result = await onRunScraper({
      category: scraperCategory,
      zone: scraperZone,
      maxResults: Number(scraperMaxResults) || undefined,
      maxDistanceKm: Number(scraperMaxDistanceKm) || undefined,
    });
    if (result) setLastScraperResult(result);
  };

  return (
    <>
      {/* Fondo oscuro detrás del panel en móvil, para cerrar al tocar afuera.
          z-index muy alto a propósito: Leaflet asigna z-index internos a
          sus capas/controles que de otro modo podrían quedar por encima
          de este fondo, dejando el mapa visible y "clickeable" a través
          del menú -- justo el bug reportado. */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[9990] bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`scroll-slim fixed inset-y-0 left-0 z-[9991] flex h-full w-80 max-w-[88vw] flex-col gap-4 overflow-y-auto bg-brand-50 p-4 shadow-2xl transition-all duration-200 ease-in-out lg:static lg:z-auto lg:max-w-none lg:shadow-none ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isCollapsed
            ? "lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:border-0 lg:p-0 lg:opacity-0"
            : "lg:w-96 lg:translate-x-0 lg:opacity-100"
        }`}
      >
        {/* Botón de cerrar, solo visible en móvil */}
        <button
          type="button"
          onClick={onMobileClose}
          className="absolute right-3 top-3 rounded p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-700 lg:hidden"
          aria-label="Cerrar panel"
        >
          ✕
        </button>

        {/* Encabezado / sesión */}
        <div className="flex items-center justify-between rounded-xl bg-brand-900 px-4 py-3.5 pr-6 text-white">
          <div>
            <p className="font-display text-base font-bold leading-tight">CRM Prospectación</p>
            <p className="text-xs text-brand-300">Zona Metropolitana de Guadalajara</p>
            {currentUser && (
              <p className="mt-1 text-xs text-brand-200">
                {currentUser.full_name} · <span className="capitalize">{currentUser.role}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded px-2 py-1 text-xs font-medium text-brand-200 hover:bg-white/10 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>

        {errorMessage && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <span>{errorMessage}</span>
          <button type="button" onClick={onClearError} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* Scraper */}
      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-display text-sm font-semibold text-brand-900">Buscar nuevos prospectos</h2>
        <form onSubmit={handleRunScraper} className="flex flex-col gap-2">
          <select
            value={scraperCategory}
            onChange={(e) => setScraperCategory(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>
          <select
            value={scraperZone}
            onChange={(e) => setScraperZone(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
          >
            {ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={200}
            value={scraperMaxResults}
            onChange={(e) => setScraperMaxResults(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
            placeholder="Máx. resultados"
          />
          <input
            type="number"
            min={0.1}
            max={100}
            step={0.5}
            value={scraperMaxDistanceKm}
            onChange={(e) => setScraperMaxDistanceKm(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
            placeholder="Radio exacto desde el punto de partida (km, opcional)"
          />
          <button
            type="submit"
            disabled={isScraping}
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isScraping ? "Buscando en Google Maps…" : "Buscar en Google Maps"}
          </button>
        </form>
        {lastScraperResult && (
          <p className="mt-2 text-xs text-gray-500">
            Encontrados: {lastScraperResult.found} · Nuevos: {lastScraperResult.inserted} ·
            Duplicados: {lastScraperResult.skipped_duplicates}
            {lastScraperResult.skipped_out_of_range > 0 && (
              <> · Fuera de rango: {lastScraperResult.skipped_out_of_range}</>
            )}
          </p>
        )}
      </section>

      {/* Filtros */}
      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-brand-900">Filtrar prospectos</h2>
          <button type="button" onClick={onResetFilters} className="text-xs text-brand-600 hover:underline">
            Limpiar
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre, dirección o servicio…"
            value={filters.search}
            onChange={(e) => onUpdateFilter("search", e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
          />
          <select
            value={filters.zone}
            onChange={(e) => onUpdateFilter("zone", e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
          >
            <option value="">Todas las zonas</option>
            {ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(e) => onUpdateFilter("category", e.target.value)}
            className="rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-2 py-1.5 text-sm"
          >
            <option value="">Todos los giros</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Selección / ruta */}
      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-brand-900">
            Ruta ({selectedIds.length} seleccionados)
          </h2>
          <button type="button" onClick={onClearSelection} className="text-xs text-brand-600 hover:underline">
            Vaciar
          </button>
        </div>
        {referencePoint && (
          <p className="mb-1 text-xs text-gray-500">
            📍 Punto de partida: <span className="font-medium">{referencePoint.label}</span>
            <br />
            <span className="text-gray-400">Tip: arrastra el pin morado en el mapa para moverlo</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => onUseCurrentLocationAsReferencePoint()}
          disabled={isUpdatingReferencePoint}
          className="mb-2 w-full rounded border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          {isUpdatingReferencePoint
            ? "Obteniendo ubicación GPS…"
            : "🎯 Usar mi ubicación actual como punto de partida"}
        </button>
        <button
          type="button"
          onClick={onComputeRoute}
          disabled={isOptimizing || selectedIds.length === 0}
          className="w-full rounded bg-brand-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isOptimizing ? "Calculando ruta…" : "Calcular ruta óptima (1 día)"}
        </button>
        <button
          type="button"
          onClick={onComputeWeeklyRoute}
          disabled={isOptimizingWeek || selectedIds.length === 0}
          className="mt-2 w-full rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {isOptimizingWeek ? "Generando ruta semanal…" : "📅 Generar ruta semanal (Lun-Vie)"}
        </button>

        {weeklyRoute && (
          <div className="mt-3">
            <div className="flex gap-1">
              {weeklyRoute.days.map((day, index) => (
                <button
                  key={day.day_label}
                  type="button"
                  onClick={() => onSelectDay(index)}
                  className={`flex-1 rounded px-1 py-1 text-xs font-medium ${
                    index === selectedDayIndex
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {day.day_label.slice(0, 3)}
                  <span className="block text-[10px] opacity-80">({day.stops.length})</span>
                </button>
              ))}
            </div>
            {weeklyRoute.days[selectedDayIndex] && (
              <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                <p className="mb-1 font-semibold">
                  {weeklyRoute.days[selectedDayIndex].day_label} ·{" "}
                  {weeklyRoute.days[selectedDayIndex].total_distance_km.toFixed(2)} km
                </p>
                <ol className="list-inside list-decimal space-y-0.5">
                  {weeklyRoute.days[selectedDayIndex].stops.map((stop) => (
                    <li key={stop.business.id} className="truncate">
                      {stop.business.name}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {!weeklyRoute && routeTotalDistanceKm != null && (
          <p className="mt-2 text-xs text-gray-600">
            Distancia total estimada: <strong>{routeTotalDistanceKm.toFixed(2)} km</strong>
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            const name = window.prompt("¿Cómo quieres llamar a esta ruta?");
            if (name && name.trim()) onSaveRoute(name.trim());
          }}
          disabled={isSavingRoute || selectedIds.length === 0}
          className="mt-2 w-full rounded-lg border border-brand-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isSavingRoute ? "Guardando…" : "💾 Guardar esta selección como ruta"}
        </button>
      </section>

      {/* Zonas dibujadas a mano sobre el mapa */}
      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-display text-sm font-semibold text-brand-900">🖊️ Zonas en el mapa</h2>

        {!isDrawingZone ? (
          <button
            type="button"
            onClick={onStartDrawingZone}
            className="mb-2 w-full rounded border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            + Dibujar zona nueva
          </button>
        ) : (
          <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
            Marca los vértices haciendo clic en el mapa. Usa los controles que aparecen arriba del mapa para finalizar o cancelar.
          </p>
        )}

        {zones.length === 0 ? (
          <p className="text-xs text-gray-400">Todavía no has dibujado ninguna zona.</p>
        ) : (
          <ul className="space-y-1.5">
            {zones.map((zone) => (
              <li
                key={zone.id}
                className="flex items-center gap-2 rounded border border-gray-100 px-2 py-1.5"
              >
                <input
                  type="color"
                  value={zone.color}
                  onChange={(e) => onUpdateZoneColor(zone.id, e.target.value)}
                  title="Cambiar color"
                  className="h-6 w-6 cursor-pointer rounded border border-gray-200"
                />
                <span className="flex-1 truncate text-xs font-medium text-gray-700">
                  {zone.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt("Nuevo nombre para la zona", zone.name);
                    if (name) onRenameZone(zone.id, name);
                  }}
                  title="Renombrar"
                  className="text-xs text-gray-400 hover:text-brand-600"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar la zona "${zone.name}"?`)) onDeleteZone(zone.id);
                  }}
                  title="Eliminar"
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rutas guardadas */}
      {savedRoutes.length > 0 && (
        <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-display text-sm font-semibold text-brand-900">📂 Mis rutas guardadas</h2>
          <ul className="space-y-1">
            {savedRoutes.map((saved) => (
              <li
                key={saved.id}
                className="flex items-center justify-between rounded border border-gray-100 px-2 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">{saved.name}</p>
                  <p className="text-gray-400">
                    {saved.business_ids.length} paradas
                    {saved.created_by_name ? ` · ${saved.created_by_name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadSavedRoute(saved)}
                    className="text-brand-600 hover:underline"
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSavedRoute(saved.id)}
                    className="text-red-500 hover:underline"
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reporte descargable */}
      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-display text-sm font-semibold text-brand-900">Reporte de prospectos</h2>
        <p className="mb-2 text-xs text-gray-500">
          Descarga en Excel los negocios que cumplen los filtros actuales, incluyendo
          descripción del giro y las notas de menú/precios que hayas capturado.
        </p>
        <button
          type="button"
          onClick={onDownloadReport}
          disabled={isExportingReport}
          className="w-full rounded border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        >
          {isExportingReport ? "Generando reporte…" : "⬇ Descargar reporte (Excel)"}
        </button>
      </section>

      {/* Lista de prospectos */}
      <section className="flex-1">
        <h2 className="mb-2 font-display text-sm font-semibold text-brand-900">
          Prospectos ({businesses.length} de {totalCount})
        </h2>
        {isLoadingBusinesses ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : businesses.length === 0 ? (
          <p className="text-sm text-gray-500">Sin resultados. Ajusta los filtros o busca prospectos nuevos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {businesses.map((business) => {
              const isSelected = selectedIds.includes(business.id);
              const isExpanded = expandedId === business.id;
              return (
                <li
                  key={business.id}
                  className={`rounded-md border p-2 text-sm transition-colors ${
                    isSelected
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-brand-300"
                  } ${business.visited ? "opacity-60" : ""}`}
                >
                  <div className="cursor-pointer" onClick={() => onToggleSelected(business.id)}>
                    <p className="font-medium text-gray-900">{business.name}</p>
                    <p className="text-xs text-gray-500">
                      {CATEGORY_LABELS[business.category] || business.category} · {business.zone}
                      {business.distance_km != null && <> · 📍 {business.distance_km} km</>}
                    </p>
                    {business.address && (
                      <p className="truncate text-xs text-gray-400">{business.address}</p>
                    )}
                    {business.visited && (
                      <span className="text-xs font-medium text-green-600">✓ Visitado</span>
                    )}
                  </div>

                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : business.id);
                      }}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {isExpanded ? "Ocultar ▲" : "Vista rápida ▼"}
                    </button>
                    {onOpenDetail && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(business);
                        }}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        🔍 Ver detalle completo
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-1 rounded bg-white/70 p-2 text-xs text-gray-700">
                      {business.assigned_to_name && (
                        <p>
                          <span className="font-semibold">Vendedor asignado: </span>
                          👤 {business.assigned_to_name}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold">Descripción / giro: </span>
                        {business.products_services || "Sin descripción capturada."}
                      </p>
                      <p>
                        <span className="font-semibold">Menú / precios / notas: </span>
                        {business.notes || "Aún sin notas. Visita el negocio y agrega precios aquí."}
                      </p>
                      {business.phone && (
                        <p>
                          <span className="font-semibold">Tel: </span>
                          {business.phone}
                        </p>
                      )}
                      {business.website && (
                        <p>
                          <span className="font-semibold">Web: </span>
                          <a
                            href={business.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {business.website}
                          </a>
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = window.confirm(
                            `¿Eliminar "${business.name}" de forma permanente? Esta acción no se puede deshacer.`
                          );
                          if (confirmed) await onDeleteBusiness(business.id);
                        }}
                        className="mt-2 w-full rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      </aside>
    </>
  );
}