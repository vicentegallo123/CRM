
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useMemo } from "react";
import L from "leaflet";


const BASE_ICON_URLS = {
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
};

const referenceIcon = new L.Icon({
  ...BASE_ICON_URLS,
  iconSize: [34, 55],
  iconAnchor: [17, 55],
  popupAnchor: [1, -46],
  shadowSize: [55, 55],
  className: "hue-rotate-180 saturate-150",
});


const STAGE_FILTER_CLASS = {
  nuevo: "", // azul por defecto: "todavía sin tocar"
  contactado: "hue-rotate-[45deg] saturate-150",
  visitado: "hue-rotate-[270deg] saturate-150",
  cliente: "hue-rotate-90 saturate-150",
  descartado: "grayscale brightness-75",
};

const STAGE_LABELS = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  visitado: "Visitado",
  cliente: "Cliente",
  descartado: "Descartado",
};


const STAGE_SWATCH = {
  nuevo: "#3b82f6",
  contactado: "#f59e0b",
  visitado: "#8b5cf6",
  cliente: "#22c55e",
  descartado: "#9ca3af",
};

const businessIconCache = new Map();


function getBusinessIcon(stage, isSelected) {
  const key = `${stage || "nuevo"}-${isSelected}`;
  if (businessIconCache.has(key)) return businessIconCache.get(key);

  const stageClass = STAGE_FILTER_CLASS[stage] ?? "";
  const selectedClass = isSelected ? "drop-shadow-[0_0_6px_rgba(37,99,235,0.9)]" : "";
  const className = [stageClass, selectedClass].filter(Boolean).join(" ") || undefined;

  const icon = new L.Icon({
    ...BASE_ICON_URLS,
    iconSize: isSelected ? [30, 49] : [25, 41],
    iconAnchor: isSelected ? [15, 49] : [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className,
  });

  businessIconCache.set(key, icon);
  return icon;
}

const ZMG_CENTER = [20.7011, -103.3706]; // punto medio aproximado entre Zapopan y GDL
const DEFAULT_ZOOM = 12;

/**
 * Ajusta automáticamente el encuadre del mapa cuando cambia la lista de
 * puntos visibles (nuevos resultados de scraping, cambio de filtros, etc).
 */
function FitBoundsOnChange({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);

  return null;
}

/** Captura clics en el mapa mientras se está dibujando una zona nueva.
 * No renderiza nada visible -- solo escucha el evento. */
function DrawClickCatcher({ active, onPoint }) {
  useMapEvents({
    click(e) {
      if (active) onPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  businesses,
  selectedIds,
  routeStops,
  onToggleSelected,
  onToggleVisited,
  referencePoint,
  onMoveReferencePoint,
  onOpenDetail,
  routeGeometry,
  realDistanceKm,
  realDurationMinutes,
  zones,
  isDrawingZone,
  drawingPoints,
  onDrawPoint,
  onUndoDrawPoint,
  onFinishDrawingZone,
  onCancelDrawingZone,
}) {
  // Si OSRM devolvió la ruta real por calles, se dibuja esa (sigue las
  // calles de verdad, como Waze/Google Maps). Si no está disponible
  // (sin internet, servicio caído), se dibuja una línea recta entre
  // puntos como respaldo -- la app nunca se rompe por esto.
  const routePositions = useMemo(() => {
    if (routeGeometry && routeGeometry.length > 0) {
      return routeGeometry;
    }
    const businessPositions = (routeStops || []).map((stop) => [
      stop.business.lat,
      stop.business.lng,
    ]);
    if (referencePoint && businessPositions.length > 0) {
      return [[referencePoint.lat, referencePoint.lng], ...businessPositions];
    }
    return businessPositions;
  }, [routeStops, referencePoint, routeGeometry]);

  const isRealRoute = Boolean(routeGeometry && routeGeometry.length > 0);

  const orderByBusinessId = useMemo(() => {
    const map = new Map();
    (routeStops || []).forEach((stop) => map.set(stop.business.id, stop.order));
    return map;
  }, [routeStops]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={ZMG_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full rounded-lg"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBoundsOnChange points={businesses} />

        {referencePoint && (
          <Marker
            position={[referencePoint.lat, referencePoint.lng]}
            icon={referenceIcon}
            draggable={Boolean(onMoveReferencePoint)}
            eventHandlers={
              onMoveReferencePoint
                ? {
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      onMoveReferencePoint(lat, lng);
                    },
                  }
                : undefined
            }
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">📍 Punto de partida</p>
                <p className="text-gray-600">{referencePoint.label}</p>
                {onMoveReferencePoint && (
                  <p className="mt-1 text-xs text-gray-400">
                    Arrastra este pin para prospectar desde otra zona
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {businesses.map((business) => {
          const isSelected = selectedIds.includes(business.id);
          const order = orderByBusinessId.get(business.id);

          return (
            <Marker
              key={business.id}
              position={[business.lat, business.lng]}
              icon={getBusinessIcon(business.stage, isSelected)}
              eventHandlers={{
                click: () => onToggleSelected(business.id),
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-gray-900">
                    {order ? `${order}. ` : ""}
                    {business.name}
                  </p>
                  <p className="text-gray-600">{business.address || "Sin dirección registrada"}</p>
                  <p className="text-gray-500 capitalize">
                    {business.category.replace(/_/g, " ")} · {business.zone}
                  </p>
                  {business.phone && <p className="text-gray-600">Tel: {business.phone}</p>}
                  {business.rating != null && (
                    <p className="text-amber-600">★ {business.rating.toFixed(1)}</p>
                  )}
                  {business.products_services && (
                    <p className="text-gray-600">
                      <span className="font-medium">Descripción: </span>
                      {business.products_services}
                    </p>
                  )}
                  {business.notes && (
                    <p className="text-gray-600">
                      <span className="font-medium">Menú/precios: </span>
                      {business.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => onToggleSelected(business.id)}
                      className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      {isSelected ? "Quitar de ruta" : "Agregar a ruta"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleVisited(business.id, !business.visited)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {business.visited ? "Marcar pendiente" : "Marcar visitado"}
                    </button>
                    {onOpenDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(business)}
                        className="rounded border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        🔍 Detalle
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#2563eb",
              weight: 4,
              opacity: 0.8,
              // Ruta de respaldo (línea recta) se dibuja punteada, para
              // dejar claro visualmente que no sigue las calles reales.
              dashArray: isRealRoute ? undefined : "8 6",
            }}
          />
        )}

        {/* Zonas guardadas (polígonos dibujados a mano por el usuario) */}
        {(zones || []).map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.points}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.15,
              weight: 2,
            }}
          >
            <Popup>
              <p className="font-semibold text-gray-900">{zone.name}</p>
            </Popup>
          </Polygon>
        ))}

        {/* Zona en construcción (mientras el usuario va marcando vértices) */}
        {isDrawingZone && (
          <>
            <DrawClickCatcher active={isDrawingZone} onPoint={onDrawPoint} />
            {drawingPoints && drawingPoints.length > 0 && (
              <Polygon
                positions={drawingPoints}
                pathOptions={{ color: "#111827", dashArray: "6 4", fillOpacity: 0.05 }}
              />
            )}
          </>
        )}

        {isRealRoute && realDistanceKm != null && (
          <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-xs font-medium shadow-lg">
            🚗 {realDistanceKm} km por calles reales · ~{Math.round(realDurationMinutes)} min manejando
          </div>
        )}
      </MapContainer>

      {/* Leyenda de colores por etapa -- fuera del MapContainer para que
          no capture clics del mapa (z-index alto, posición fija). */}
      {!isDrawingZone && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-[11px] shadow-lg">
          <p className="mb-1 font-semibold text-gray-700">Etapa del prospecto</p>
          <div className="grid grid-cols-1 gap-0.5">
            {Object.entries(STAGE_LABELS).map(([stage, label]) => (
              <div key={stage} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STAGE_SWATCH[stage] }}
                />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controles flotantes mientras se dibuja una zona nueva */}
      {isDrawingZone && (
        <div className="absolute top-4 left-1/2 z-[1000] flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium shadow-lg">
          <span className="text-gray-600">
            Haz clic en el mapa para marcar los vértices ({(drawingPoints || []).length})
          </span>
          <button
            type="button"
            onClick={onUndoDrawPoint}
            disabled={!drawingPoints || drawingPoints.length === 0}
            className="rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 disabled:opacity-40"
          >
            ↩️ Deshacer
          </button>
          <button
            type="button"
            onClick={onFinishDrawingZone}
            disabled={!drawingPoints || drawingPoints.length < 3}
            className="rounded bg-brand-600 px-2 py-1 text-white hover:bg-brand-700 disabled:opacity-40"
          >
            ✅ Finalizar zona
          </button>
          <button
            type="button"
            onClick={onCancelDrawingZone}
            className="rounded bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100"
          >
            ✕ Cancelar
          </button>
        </div>
      )}
    </div>
  );
}