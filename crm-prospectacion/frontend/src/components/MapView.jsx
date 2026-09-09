
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import L from "leaflet";

// Iconos por defecto de Leaflet (se pierden al empaquetar con Vite si no
// se reconfiguran manualmente las rutas de los assets).
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
  className: "hue-rotate-90",
});

const referenceIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
  className: "hue-rotate-180",
});

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

export default function MapView({
  businesses,
  selectedIds,
  routeStops,
  onToggleSelected,
  onToggleVisited,
  referencePoint,
  onOpenDetail,
  routeGeometry,
  realDistanceKm,
  realDurationMinutes,
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
        <Marker position={[referencePoint.lat, referencePoint.lng]} icon={referenceIcon}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold text-gray-900">📍 Punto de partida</p>
              <p className="text-gray-600">{referencePoint.label}</p>
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
            icon={isSelected ? selectedIcon : defaultIcon}
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

      {isRealRoute && realDistanceKm != null && (
        <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-xs font-medium shadow-lg">
          🚗 {realDistanceKm} km por calles reales · ~{Math.round(realDurationMinutes)} min manejando
        </div>
      )}
    </MapContainer>
  );
}
