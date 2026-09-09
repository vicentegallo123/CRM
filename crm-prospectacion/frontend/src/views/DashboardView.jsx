import { useState } from "react";
import { useAuthVM } from "../viewmodels/useAuthVM.js";
import { useMapRoutesVM } from "../viewmodels/useMapRoutesVM.js";
import { useDashboardVM } from "../viewmodels/useDashboardVM.js";
import LoginView from "./LoginView.jsx";
import Sidebar from "../components/Sidebar.jsx";
import MapView from "../components/MapView.jsx";
import KanbanBoard from "../components/KanbanBoard.jsx";
import DashboardMetrics from "../components/DashboardMetrics.jsx";
import AddBusinessModal from "../components/AddBusinessModal.jsx";
import BusinessDetailModal from "../components/BusinessDetailModal.jsx";

function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Cargando…</p>
    </div>
  );
}

const TABS = [
  { key: "mapa", label: "🗺️ Mapa" },
  { key: "kanban", label: "📋 Pipeline" },
  { key: "dashboard", label: "📊 Dashboard" },
];

// Coincide con el valor por defecto de settings.REFERENCE_POINT_LABEL en
// el backend: mientras el punto de referencia siga siendo exactamente
// este texto, significa que el usuario todavía no lo ha ajustado con su
// ubicación GPS real, así que mostramos un aviso sugiriéndolo.
const DEFAULT_REFERENCE_LABEL = "Av Unión 126, Col. Americana, Guadalajara, Jal.";

function Dashboard({ authVM }) {
  const vm = useMapRoutesVM();
  const dashboardVM = useDashboardVM();
  const [activeTab, setActiveTab] = useState("mapa");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Colapso de la barra lateral en escritorio (pantallas lg+). En móvil se
  // usa isSidebarOpen (panel deslizable); en escritorio, isSidebarCollapsed
  // simplemente la oculta para dejar más espacio al mapa/tablero.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [detailBusiness, setDetailBusiness] = useState(null);
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(false);

  const handleUpdateBusinessDetails = async (businessId, patch) => {
    const updated = await vm.updateBusinessDetails(businessId, patch);
    if (updated) dashboardVM.reload();
    return updated;
  };

  const handleCreateBusiness = async (payload) => {
    const success = await vm.createManualBusiness(payload);
    if (success) dashboardVM.reload(); // Recargar el dashboard si se crea con éxito
    return success;
  };

  // Al eliminar una tarjeta (desde el Kanban o la barra lateral), además
  // de quitarla de la lista, refrescamos las métricas del dashboard para
  // que dejen de contarla de inmediato.
  const handleDeleteBusiness = async (businessId) => {
    const success = await vm.removeBusiness(businessId);
    if (success) dashboardVM.reload();
    return success;
  };

  const handleUseCurrentLocation = async () => {
    const success = await vm.useCurrentLocationAsReferencePoint();
    if (success) setLocationBannerDismissed(true);
    return success;
  };

  const showLocationBanner =
    !locationBannerDismissed &&
    vm.referencePoint &&
    vm.referencePoint.label === DEFAULT_REFERENCE_LABEL;

  // Al elegir una pestaña en móvil, cierra el panel deslizable
  // automáticamente -- si el usuario ya decidió a dónde ir, no tiene
  // sentido que el menú se quede estorbando encima.
  const handleSelectTab = (tabKey) => {
    setActiveTab(tabKey);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-screen flex-col lg:flex-row">
      <Sidebar
        filters={vm.filters}
        onUpdateFilter={vm.updateFilter}
        onResetFilters={vm.resetFilters}
        businesses={vm.businesses}
        totalCount={vm.totalCount}
        selectedIds={vm.selectedIds}
        onToggleSelected={vm.toggleSelected}
        onClearSelection={vm.clearSelection}
        onRunScraper={vm.runScraper}
        onComputeRoute={vm.computeRoute}
        onComputeWeeklyRoute={vm.computeWeeklyRoute}
        isLoadingBusinesses={vm.isLoadingBusinesses}
        isScraping={vm.isScraping}
        isOptimizing={vm.isOptimizing}
        isOptimizingWeek={vm.isOptimizingWeek}
        isExportingReport={vm.isExportingReport}
        errorMessage={vm.errorMessage}
        onClearError={vm.clearError}
        routeTotalDistanceKm={vm.displayedTotalDistanceKm}
        weeklyRoute={vm.weeklyRoute}
        selectedDayIndex={vm.selectedDayIndex}
        onSelectDay={vm.setSelectedDayIndex}
        referencePoint={vm.referencePoint}
        currentUser={authVM.user}
        onLogout={authVM.logout}
        onDownloadReport={vm.downloadReport}
        isUpdatingReferencePoint={vm.isUpdatingReferencePoint}
        onUseCurrentLocationAsReferencePoint={handleUseCurrentLocation}
        onDeleteBusiness={handleDeleteBusiness}
        onOpenDetail={setDetailBusiness}
        isMobileOpen={isSidebarOpen}
        onMobileClose={() => setIsSidebarOpen(false)}
        savedRoutes={vm.savedRoutes}
        isSavingRoute={vm.isSavingRoute}
        onSaveRoute={vm.saveCurrentRoute}
        onLoadSavedRoute={vm.loadSavedRouteSelection}
        onDeleteSavedRoute={vm.removeSavedRoute}
        isCollapsed={isSidebarCollapsed}
      />
      <main className="flex h-full flex-1 flex-col overflow-hidden bg-brand-50">
        {/* Navegación por pestañas, menú móvil y botón de nuevo prospecto */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-white px-3 py-2">
          <div className="flex items-center gap-1">
            {/* Botón de menú, solo visible en móvil (abre la barra lateral) */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 text-brand-700 hover:bg-brand-50 lg:hidden"
              aria-label="Abrir menú"
            >
              ☰
            </button>
            {/* Botón de colapsar/expandir, solo visible en escritorio */}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden rounded-lg p-2 text-brand-700 hover:bg-brand-50 lg:block"
              aria-label={isSidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              title={isSidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
            >
              {isSidebarCollapsed ? "☰" : "✕"}
            </button>
            <div className="ml-1 flex gap-1 overflow-x-auto rounded-lg bg-brand-50 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSelectTab(tab.key)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-white text-brand-900 shadow-sm"
                      : "text-brand-600 hover:text-brand-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            + Nuevo Prospecto
          </button>
        </div>

        {/* Aviso: sugiere fijar la ubicación GPS exacta mientras el punto
            de referencia siga siendo el valor por defecto del sistema. */}
        {showLocationBanner && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <span>
              📍 Tu punto de partida todavía es una ubicación aproximada. Para que las
              distancias y costos sean exactos, actívalo con tu GPS.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={vm.isUpdatingReferencePoint}
                className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {vm.isUpdatingReferencePoint ? "Obteniendo…" : "🎯 Usar mi ubicación"}
              </button>
              <button
                type="button"
                onClick={() => setLocationBannerDismissed(true)}
                className="text-xs text-amber-700 hover:underline"
              >
                Ahora no
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden p-2 lg:p-4">
          {activeTab === "mapa" && (
            <MapView
              businesses={vm.businesses}
              selectedIds={vm.selectedIds}
              routeStops={vm.displayedRouteStops}
              onToggleSelected={vm.toggleSelected}
              onToggleVisited={vm.toggleVisited}
              referencePoint={vm.referencePoint}
              onOpenDetail={setDetailBusiness}
              routeGeometry={vm.displayedRouteGeometry}
              realDistanceKm={vm.displayedRealDistanceKm}
              realDurationMinutes={vm.displayedRealDurationMinutes}
            />
          )}

          {activeTab === "kanban" && (
            <KanbanBoard
              businesses={vm.businesses}
              onUpdateBusinessDetails={handleUpdateBusinessDetails}
              onDeleteBusiness={handleDeleteBusiness}
              onOpenDetail={setDetailBusiness}
              coffeeCatalog={vm.coffeeCatalog}
            />
          )}

          {activeTab === "dashboard" && (
            <DashboardMetrics
              summary={dashboardVM.summary}
              isLoading={dashboardVM.isLoading}
              errorMessage={dashboardVM.errorMessage}
              onReload={dashboardVM.reload}
              onDownloadReport={vm.downloadReport}
              isExportingReport={vm.isExportingReport}
            />
          )}
        </div>
      </main>

      {/* Modal para agregar negocio manualmente */}
      <AddBusinessModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleCreateBusiness}
        isSaving={vm.isCreatingBusiness}
      />

      {/* Modal de detalle completo, compartido entre Mapa/Kanban/Sidebar */}
      <BusinessDetailModal business={detailBusiness} onClose={() => setDetailBusiness(null)} />
    </div>
  );
}

export default function DashboardView() {
  const authVM = useAuthVM();

  if (authVM.isCheckingSession) {
    return <LoadingScreen />;
  }

  if (!authVM.isAuthenticated) {
    return <LoginView authVM={authVM} />;
  }

  return <Dashboard authVM={authVM} />;
}
