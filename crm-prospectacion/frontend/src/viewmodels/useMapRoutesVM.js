
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBusiness,
  deleteBusiness,
  deleteSavedRoute,
  downloadBusinessesReport,
  fetchBusinesses,
  fetchCoffeeCatalog,
  fetchReferencePoint,
  fetchSavedRoutes,
  markAsVisited,
  optimizeRoute,
  optimizeWeeklyRoute,
  saveRoute,
  triggerScraper,
  updateBusiness,
  updateReferencePoint,
} from "../api/businessApi.js";

const INITIAL_FILTERS = {
  zone: "",
  category: "",
  search: "",
};

export function useMapRoutesVM() {
  const [businesses, setBusinesses] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [selectedIds, setSelectedIds] = useState([]);
  const [route, setRoute] = useState(null);
  const [weeklyRoute, setWeeklyRoute] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [referencePoint, setReferencePoint] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [coffeeCatalog, setCoffeeCatalog] = useState([]);

  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimizingWeek, setIsOptimizingWeek] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [isUpdatingReferencePoint, setIsUpdatingReferencePoint] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadBusinesses = useCallback(async () => {
    setIsLoadingBusinesses(true);
    setErrorMessage(null);
    try {
      const data = await fetchBusinesses({
        zone: filters.zone || undefined,
        category: filters.category || undefined,
        search: filters.search || undefined,
        limit: 500,
      });
      setBusinesses(data.items);
      setTotalCount(data.total);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudieron cargar los negocios."
      );
    } finally {
      setIsLoadingBusinesses(false);
    }
  }, [filters.zone, filters.category, filters.search]);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    fetchReferencePoint()
      .then(setReferencePoint)
      .catch(() => setReferencePoint(null));
  }, []);

  const loadSavedRoutes = useCallback(async () => {
    try {
      const data = await fetchSavedRoutes();
      setSavedRoutes(data);
    } catch {
      setSavedRoutes([]);
    }
  }, []);

  useEffect(() => {
    loadSavedRoutes();
  }, [loadSavedRoutes]);

  useEffect(() => {
    fetchCoffeeCatalog()
      .then(setCoffeeCatalog)
      .catch(() => setCoffeeCatalog([]));
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const toggleSelected = useCallback((businessId) => {
    setRoute(null);
    setWeeklyRoute(null);
    setSelectedIds((prev) =>
      prev.includes(businessId)
        ? prev.filter((id) => id !== businessId)
        : [...prev, businessId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setRoute(null);
    setWeeklyRoute(null);
  }, []);

  const runScraper = useCallback(
    async ({ category, zone, maxResults, maxDistanceKm }) => {
      setIsScraping(true);
      setErrorMessage(null);
      try {
        const result = await triggerScraper({ category, zone, maxResults, maxDistanceKm });
        await loadBusinesses();
        return result;
      } catch (err) {
        setErrorMessage(
          err?.response?.data?.detail || "Ocurrió un error al ejecutar el scraper."
        );
        return null;
      } finally {
        setIsScraping(false);
      }
    },
    [loadBusinesses]
  );

  const computeRoute = useCallback(async () => {
    if (selectedIds.length === 0) {
      setErrorMessage("Selecciona al menos un negocio para calcular la ruta.");
      return;
    }
    setIsOptimizing(true);
    setErrorMessage(null);
    try {
      const result = await optimizeRoute({ businessIds: selectedIds });
      setRoute(result);
      setWeeklyRoute(null);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudo calcular la ruta óptima."
      );
    } finally {
      setIsOptimizing(false);
    }
  }, [selectedIds]);

  const computeWeeklyRoute = useCallback(async () => {
    if (selectedIds.length === 0) {
      setErrorMessage("Selecciona al menos un negocio para generar la ruta semanal.");
      return;
    }
    setIsOptimizingWeek(true);
    setErrorMessage(null);
    try {
      const result = await optimizeWeeklyRoute({ businessIds: selectedIds });
      setWeeklyRoute(result);
      setRoute(null);
      setSelectedDayIndex(0);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudo generar la ruta semanal."
      );
    } finally {
      setIsOptimizingWeek(false);
    }
  }, [selectedIds]);

  // Guarda la selección actual de negocios bajo un nombre, para poder
  // recargarla después sin tener que volver a elegir uno por uno.
  const saveCurrentRoute = useCallback(
    async (name) => {
      if (selectedIds.length === 0) {
        setErrorMessage("Selecciona al menos un negocio antes de guardar la ruta.");
        return false;
      }
      setIsSavingRoute(true);
      setErrorMessage(null);
      try {
        await saveRoute({ name, businessIds: selectedIds });
        await loadSavedRoutes();
        return true;
      } catch (err) {
        setErrorMessage(
          err?.response?.data?.detail || "No se pudo guardar la ruta."
        );
        return false;
      } finally {
        setIsSavingRoute(false);
      }
    },
    [selectedIds, loadSavedRoutes]
  );

  // Carga una ruta guardada: pone esos negocios como seleccionados (los
  // que ya no existan se ignoran silenciosamente) para que el usuario
  // pueda darle "Calcular ruta óptima" de inmediato.
  const loadSavedRouteSelection = useCallback(
    (savedRouteEntry) => {
      const validIds = savedRouteEntry.business_ids.filter((id) =>
        businesses.some((b) => b.id === id)
      );
      if (validIds.length === 0) {
        setErrorMessage(
          "Ninguno de los negocios de esa ruta guardada sigue disponible en tu lista actual."
        );
        return;
      }
      setSelectedIds(validIds);
      setRoute(null);
      setWeeklyRoute(null);
    },
    [businesses]
  );

  const removeSavedRoute = useCallback(
    async (savedRouteId) => {
      try {
        await deleteSavedRoute(savedRouteId);
        setSavedRoutes((prev) => prev.filter((r) => r.id !== savedRouteId));
        return true;
      } catch (err) {
        setErrorMessage(
          err?.response?.data?.detail || "No se pudo eliminar la ruta guardada."
        );
        return false;
      }
    },
    []
  );

  const toggleVisited = useCallback(
    async (businessId, visited) => {
      try {
        const updated = await markAsVisited(businessId, visited);
        setBusinesses((prev) =>
          prev.map((b) => (b.id === businessId ? updated : b))
        );
      } catch (err) {
        setErrorMessage(
          err?.response?.data?.detail || "No se pudo actualizar el estatus de visita."
        );
      }
    },
    []
  );

  // Actualiza cualquier combinación de campos del pipeline de un negocio
  // (etapa, café ofrecido, si es cliente, consumo, notas, etc.) y refleja
  // el resultado real que regresa el backend (incluye distance_km y
  // last_visited_at recalculados) en el estado local, sin recargar toda
  // la lista.
  const updateBusinessDetails = useCallback(async (businessId, patch) => {
    try {
      const updated = await updateBusiness(businessId, patch);
      setBusinesses((prev) =>
        prev.map((b) => (b.id === businessId ? updated : b))
      );
      return updated;
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudo guardar el cambio."
      );
      return null;
    }
  }, []);

  // Elimina un negocio por completo (borrado permanente). El backend
  // restringe esta acción a usuarios con rol admin; si un vendedor lo
  // intenta, recibirá un 403 que se muestra como error normal.
  const removeBusiness = useCallback(async (businessId) => {
    try {
      await deleteBusiness(businessId);
      setBusinesses((prev) => prev.filter((b) => b.id !== businessId));
      setSelectedIds((prev) => prev.filter((id) => id !== businessId));
      return true;
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudo eliminar el negocio."
      );
      return false;
    }
  }, []);

  // Crea un negocio manualmente (formulario "+ Nuevo Prospecto"). Igual
  // que el resto de las escrituras, refleja en el estado local exactamente
  // lo que devuelve el backend (con distance_km/visit_cost_estimate ya
  // calculados), sin necesidad de recargar toda la lista.
  const createManualBusiness = useCallback(async (payload) => {
    setIsCreatingBusiness(true);
    setErrorMessage(null);
    try {
      const created = await createBusiness(payload);
      setBusinesses((prev) => [created, ...prev]);
      setTotalCount((prev) => prev + 1);
      return true;
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudo crear el negocio."
      );
      return false;
    } finally {
      setIsCreatingBusiness(false);
    }
  }, []);

  // Pide permiso de ubicación al navegador (API nativa de Geolocalización)
  // y guarda la posición GPS exacta como el nuevo punto de partida. Es la
  // forma más precisa de fijar el punto de referencia: basta con estar
  // parado en el lugar exacto (la oficina, el negocio, etc.) y presionar
  // el botón -- nada de coordenadas aproximadas ni copiar/pegar.
  const useCurrentLocationAsReferencePoint = useCallback(async (label) => {
    if (!("geolocation" in navigator)) {
      setErrorMessage("Este navegador no soporta geolocalización.");
      return false;
    }

    setIsUpdatingReferencePoint(true);
    setErrorMessage(null);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      const updated = await updateReferencePoint({
        label: label || "Mi ubicación actual (GPS)",
        lat: latitude,
        lng: longitude,
      });
      setReferencePoint(updated);
      // La distancia/costo de cada negocio depende del punto de
      // referencia, así que recargamos la lista para reflejar los nuevos
      // valores calculados por el backend.
      await loadBusinesses();
      return true;
    } catch (err) {
      if (err && err.code === 1) {
        // GeolocationPositionError.PERMISSION_DENIED
        setErrorMessage(
          "Se negó el permiso de ubicación. Actívalo en la configuración del navegador para usar esta función."
        );
      } else if (err && typeof err.code === "number") {
        setErrorMessage("No se pudo obtener tu ubicación GPS. Intenta de nuevo.");
      } else {
        setErrorMessage(
          err?.response?.data?.detail || "No se pudo actualizar el punto de partida."
        );
      }
      return false;
    } finally {
      setIsUpdatingReferencePoint(false);
    }
  }, [loadBusinesses]);

  const selectedBusinesses = useMemo(
    () => businesses.filter((b) => selectedIds.includes(b.id)),
    [businesses, selectedIds]
  );

  const routeOrderedBusinesses = useMemo(() => {
    if (!route) return [];
    return route.stops.map((stop) => stop.business);
  }, [route]);

  const activeWeeklyDay = useMemo(() => {
    if (!weeklyRoute) return null;
    return weeklyRoute.days[selectedDayIndex] || null;
  }, [weeklyRoute, selectedDayIndex]);

  // Lo que efectivamente debe mostrar el mapa: si hay una ruta semanal
  // activa, las paradas del día seleccionado; si no, la ruta simple de un
  // solo recorrido (si existe).
  const displayedRouteStops = useMemo(() => {
    if (activeWeeklyDay) return activeWeeklyDay.stops;
    if (route) return route.stops;
    return [];
  }, [activeWeeklyDay, route]);

  const displayedTotalDistanceKm = activeWeeklyDay
    ? activeWeeklyDay.total_distance_km
    : route?.total_distance_km ?? null;

  // Ruta real por calles (OSRM), si el servicio externo respondió; si no,
  // queda null y el mapa dibuja la línea recta de respaldo (ver MapView).
  const displayedRouteGeometry = activeWeeklyDay
    ? activeWeeklyDay.route_geometry ?? null
    : route?.route_geometry ?? null;
  const displayedRealDistanceKm = activeWeeklyDay
    ? activeWeeklyDay.real_distance_km ?? null
    : route?.real_distance_km ?? null;
  const displayedRealDurationMinutes = activeWeeklyDay
    ? activeWeeklyDay.real_duration_minutes ?? null
    : route?.real_duration_minutes ?? null;

  const clearError = useCallback(() => setErrorMessage(null), []);

  const downloadReport = useCallback(async () => {
    setIsExportingReport(true);
    setErrorMessage(null);
    try {
      await downloadBusinessesReport({
        zone: filters.zone || undefined,
        category: filters.category || undefined,
        search: filters.search || undefined,
      });
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudo descargar el reporte."
      );
    } finally {
      setIsExportingReport(false);
    }
  }, [filters.zone, filters.category, filters.search]);

  return {
    // datos
    businesses,
    totalCount,
    filters,
    selectedIds,
    selectedBusinesses,
    route,
    routeOrderedBusinesses,
    weeklyRoute,
    selectedDayIndex,
    activeWeeklyDay,
    displayedRouteStops,
    displayedTotalDistanceKm,
    displayedRouteGeometry,
    displayedRealDistanceKm,
    displayedRealDurationMinutes,
    referencePoint,
    savedRoutes,
    coffeeCatalog,

    // estados de carga
    isLoadingBusinesses,
    isScraping,
    isOptimizing,
    isOptimizingWeek,
    isExportingReport,
    isCreatingBusiness,
    isUpdatingReferencePoint,
    isSavingRoute,
    errorMessage,

    // acciones
    updateFilter,
    resetFilters,
    toggleSelected,
    clearSelection,
    runScraper,
    computeRoute,
    computeWeeklyRoute,
    setSelectedDayIndex,
    toggleVisited,
    updateBusinessDetails,
    removeBusiness,
    createManualBusiness,
    useCurrentLocationAsReferencePoint,
    saveCurrentRoute,
    loadSavedRouteSelection,
    removeSavedRoute,
    reloadBusinesses: loadBusinesses,
    clearError,
    downloadReport,
  };
}

export default useMapRoutesVM;
