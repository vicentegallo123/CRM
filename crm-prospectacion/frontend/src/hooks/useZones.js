
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "crm_prospect_zones";
const PALETTE = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777"];

function loadZones() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}


export function useZones() {
  const [zones, setZones] = useState(loadZones);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  }, [zones]);

  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    setDrawingPoints([]);
  }, []);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setDrawingPoints([]);
  }, []);

  const addPoint = useCallback((lat, lng) => {
    setDrawingPoints((prev) => [...prev, [lat, lng]]);
  }, []);

  const undoLastPoint = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  const finishDrawing = useCallback(
    (name) => {
      if (drawingPoints.length < 3 || !name || !name.trim()) return false;
      const color = PALETTE[zones.length % PALETTE.length];
      const newZone = {
        id: `zone-${Date.now()}`,
        name: name.trim(),
        color,
        points: drawingPoints,
      };
      setZones((prev) => [...prev, newZone]);
      setIsDrawing(false);
      setDrawingPoints([]);
      return true;
    },
    [drawingPoints, zones.length]
  );

  const updateZoneColor = useCallback((zoneId, color) => {
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, color } : z)));
  }, []);

  const renameZone = useCallback((zoneId, name) => {
    if (!name || !name.trim()) return;
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, name: name.trim() } : z)));
  }, []);

  const deleteZone = useCallback((zoneId) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  return {
    zones,
    isDrawing,
    drawingPoints,
    startDrawing,
    cancelDrawing,
    addPoint,
    undoLastPoint,
    finishDrawing,
    updateZoneColor,
    renameZone,
    deleteZone,
  };
}

export default useZones;