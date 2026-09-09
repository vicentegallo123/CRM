
import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const ZONES = ["Zapopan", "Guadalajara"];

export const CATEGORIES = [
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
];

export const STAGES = ["nuevo", "contactado", "visitado", "cliente", "descartado"];

export const PURCHASE_FREQUENCIES = ["semanal", "quincenal", "mensual"];

const ACCESS_TOKEN_KEY = "crm_access_token";
const REFRESH_TOKEN_KEY = "crm_refresh_token";

// Nota: para simplificar el ejemplo se usa localStorage. En un despliegue
// real de alta seguridad, evalúa usar cookies httpOnly + SameSite=strict
// gestionadas por el propio backend en vez de almacenamiento accesible
// desde JavaScript, para mitigar robo de tokens vía XSS.
export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSessionTokens({ access_token, refresh_token }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
    timeout: 300000,
});

// Adjunta el JWT a cada request saliente.
apiClient.interceptors.request.use((requestConfig) => {
  const token = getAccessToken();
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

// Si el access token expiró (401), intenta renovarlo una sola vez con el
// refresh token antes de reintentar la petición original.
let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        refreshPromise = refreshPromise || apiClient.post("/auth/refresh", {
          refresh_token: refreshToken,
        });
        const { data } = await refreshPromise;
        refreshPromise = null;
        setSessionTokens({ access_token: data.access_token });
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        clearSession();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Registra un nuevo usuario (vendedor por defecto).
 */
export async function registerUser({ email, fullName, password, role }) {
  const response = await apiClient.post("/auth/register", {
    email,
    full_name: fullName,
    password,
    role: role || "vendedor",
  });
  return response.data;
}

/**
 * Inicia sesión y persiste los tokens de acceso/refresh.
 */
export async function loginUser({ email, password }) {
  const response = await apiClient.post("/auth/login", { email, password });
  setSessionTokens(response.data);
  return response.data;
}

export async function logoutUser() {
  clearSession();
}

export async function fetchCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data;
}

/**
 * Obtiene la lista de productos de café (lista de precios Nudo Verde),
 * usada como selección al capturar una muestra dejada en una visita.
 */
export async function fetchCoffeeCatalog() {
  const response = await apiClient.get("/businesses/coffee-catalog");
  return response.data; // string[]
}

/**
 * Obtiene negocios aplicando filtros opcionales de zona, categoría,
 * búsqueda de texto y estatus de visita.
 */
export async function fetchBusinesses(filters = {}) {
  const params = {};
  if (filters.zone) params.zone = filters.zone;
  if (filters.category) params.category = filters.category;
  if (filters.search) params.search = filters.search;
  if (typeof filters.visited === "boolean") params.visited = filters.visited;
  if (filters.limit) params.limit = filters.limit;
  if (filters.offset) params.offset = filters.offset;

  const response = await apiClient.get("/businesses", { params });
  return response.data; // { total, items }
}

export async function createBusiness(payload) {
  const response = await apiClient.post("/businesses", payload);
  return response.data;
}

export async function updateBusiness(businessId, payload) {
  const response = await apiClient.put(`/businesses/${businessId}`, payload);
  return response.data;
}

export async function deleteBusiness(businessId) {
  await apiClient.delete(`/businesses/${businessId}`);
}

export async function markAsVisited(businessId, visited = true) {
  return updateBusiness(businessId, { visited });
}

/**
 * Dispara el scraping de Google Maps para una categoría y zona dadas.
 * `maxDistanceKm`, si se especifica, descarta (sin guardar) los negocios
 * que Google devolvió pero que quedan fuera de ese radio exacto respecto
 * al punto de referencia fijo.
 */
export async function triggerScraper({ category, zone, maxResults, maxDistanceKm }) {
  const response = await apiClient.post("/scraper/run", {
    category,
    zone,
    max_results: maxResults || null,
    max_distance_km: maxDistanceKm || null,
  });
  return response.data;
}

/**
 * Solicita al backend el orden óptimo de visita para los IDs seleccionados
 * (una sola ruta, sin dividir por días).
 */
export async function optimizeRoute({ businessIds, startLat, startLng }) {
  const response = await apiClient.post("/routes/optimize", {
    business_ids: businessIds,
    start_lat: startLat ?? null,
    start_lng: startLng ?? null,
  });
  return response.data;
}

/**
 * Solicita al backend repartir los negocios seleccionados en 5 rutas
 * (Lunes a Viernes), agrupadas por sector geográfico compacto.
 */
export async function optimizeWeeklyRoute({ businessIds, startLat, startLng }) {
  const response = await apiClient.post("/routes/optimize-week", {
    business_ids: businessIds,
    start_lat: startLat ?? null,
    start_lng: startLng ?? null,
  });
  return response.data; // { start_lat, start_lng, days: [{ day_label, total_distance_km, stops }] }
}

/**
 * Guarda el conjunto de negocios seleccionados bajo un nombre, para
 * poder recalcularlo y reutilizarlo después.
 */
export async function saveRoute({ name, businessIds }) {
  const response = await apiClient.post("/routes/saved", {
    name,
    business_ids: businessIds,
  });
  return response.data;
}

/**
 * Lista las rutas guardadas (las propias si es vendedor, todas si es admin).
 */
export async function fetchSavedRoutes() {
  const response = await apiClient.get("/routes/saved");
  return response.data;
}

/**
 * Elimina una ruta guardada.
 */
export async function deleteSavedRoute(savedRouteId) {
  await apiClient.delete(`/routes/saved/${savedRouteId}`);
}

/**
 * Obtiene el punto de referencia configurado en el backend (dirección
 * base desde la que se calculan distancias, rutas y costos).
 */
export async function fetchReferencePoint() {
  const response = await apiClient.get("/routes/reference-point");
  return response.data; // { label, lat, lng }
}

/**
 * Actualiza el punto de referencia (por ejemplo, con la ubicación GPS
 * exacta obtenida del navegador). Requiere rol admin en el backend, ya
 * que afecta el cálculo de todo el sistema.
 */
export async function updateReferencePoint({ label, lat, lng }) {
  const response = await apiClient.put("/routes/reference-point", { label, lat, lng });
  return response.data; // { label, lat, lng }
}

/**
 * Descarga el reporte de negocios en Excel (respetando los filtros
 * activos) y dispara la descarga en el navegador.
 */
export async function downloadBusinessesReport(filters = {}) {
  const params = {};
  if (filters.zone) params.zone = filters.zone;
  if (filters.category) params.category = filters.category;
  if (filters.search) params.search = filters.search;
  if (typeof filters.visited === "boolean") params.visited = filters.visited;

  const response = await apiClient.get("/reports/businesses.xlsx", {
    params,
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "prospectos_zmg.xlsx";

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Obtiene el resumen de métricas agregadas del pipeline de ventas
 * (totales, avance por etapa, conversión, ingreso mensual estimado y
 * sugerencias) para el dashboard.
 */
export async function fetchDashboardSummary() {
  const response = await apiClient.get("/dashboard/summary");
  return response.data;
}

export default apiClient;
