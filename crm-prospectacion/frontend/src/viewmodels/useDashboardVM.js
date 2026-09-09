
import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../api/businessApi.js";

export function useDashboardVM() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDashboardSummary();
      setSummary(data);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.detail || "No se pudieron cargar las métricas."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return {
    summary,
    isLoading,
    errorMessage,
    reload: loadSummary,
  };
}

export default useDashboardVM;
