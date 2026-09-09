import { useState } from "react";
import { CATEGORIES, ZONES, STAGES } from "../api/businessApi.js";

export default function AddBusinessModal({ isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    name: "",
    zone: ZONES[0],
    category: CATEGORIES[0],
    address: "",
    stage: "nuevo",
    is_client: false,
    phone: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = Object.keys(formData).reduce((acc, key) => {
      acc[key] = formData[key] === "" ? null : formData[key];
      return acc;
    }, {});

    payload.lat = 20.659698;
    payload.lng = -103.349609;

    const success = await onSave(payload);

    if (success) {
      onClose();
      setFormData({
        name: "",
        zone: ZONES[0],
        category: CATEGORIES[0],
        address: "",
        stage: "nuevo",
        is_client: false,
        phone: "",
        notes: "",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Agregar Prospecto Manual</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del Negocio *</label>
            <input
              required
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-500 focus:ring-brand-500"
              placeholder="Ej. Cafetería La Principal"
            />
          </div>

          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">Zona</label>
              <select name="zone" value={formData.zone} onChange={handleChange} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-500 focus:ring-brand-500">
                {ZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <select name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm capitalize focus:border-brand-500 focus:ring-brand-500">
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c.replace(/_/g, " ")}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección</label>
            <input
              type="text"
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-500 focus:ring-brand-500"
              placeholder="Ej. Av. Chapultepec 123"
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700">Etapa inicial</label>
              <select name="stage" value={formData.stage} onChange={handleChange} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm capitalize focus:border-brand-500 focus:ring-brand-500">
                {STAGES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="w-1/2 pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" name="is_client" checked={formData.is_client} onChange={handleChange} />
                ¿Ya es cliente?
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2">
              {isSaving ? "Guardando..." : "Guardar Prospecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
