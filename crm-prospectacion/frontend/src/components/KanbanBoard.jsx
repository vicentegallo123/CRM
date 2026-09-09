
import { useState } from "react";

const STAGE_COLUMNS = [
  { key: "nuevo", label: "Nuevo", color: "border-brand-300" },
  { key: "contactado", label: "Contactado", color: "border-blue-300" },
  { key: "visitado", label: "Visitado", color: "border-amber-300" },
  { key: "cliente", label: "Cliente", color: "border-green-300" },
  { key: "descartado", label: "Descartado", color: "border-red-300" },
];

const FREQUENCY_LABELS = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

function BusinessCard({ business, isExpanded, onToggleExpand, onSave, onDelete, onDragStart, onOpenDetail, coffeeCatalog }) {
  const [coffeeOffered, setCoffeeOffered] = useState(business.coffee_offered || "");
  const [useCustomCoffee, setUseCustomCoffee] = useState(
    Boolean(business.coffee_offered) && !(coffeeCatalog || []).includes(business.coffee_offered)
  );
  const [sampleGrams, setSampleGrams] = useState(business.sample_grams ?? "");
  const [isClient, setIsClient] = useState(business.is_client || false);
  const [purchaseAmount, setPurchaseAmount] = useState(business.purchase_amount ?? "");
  const [purchaseFrequency, setPurchaseFrequency] = useState(business.purchase_frequency || "");
  const [notes, setNotes] = useState(business.notes || "");
  const [nextContactDate, setNextContactDate] = useState(
    business.next_contact_date ? business.next_contact_date.slice(0, 10) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(business.id, {
      coffee_offered: coffeeOffered || null,
      sample_grams: sampleGrams === "" ? null : Number(sampleGrams),
      is_client: isClient,
      purchase_amount: purchaseAmount === "" ? null : Number(purchaseAmount),
      purchase_frequency: isClient && purchaseFrequency ? purchaseFrequency : null,
      notes: notes || null,
      next_contact_date: nextContactDate ? new Date(nextContactDate).toISOString() : null,
      stage: isClient ? "cliente" : business.stage,
    });
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (typeof onDelete !== "function") {
      window.alert(
        "No se pudo eliminar: falta conectar la acción de borrado. Revisa que DashboardView.jsx pase onDeleteBusiness a KanbanBoard."
      );
      return;
    }
    const confirmed = window.confirm(
      `¿Eliminar "${business.name}" de forma permanente? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setIsDeleting(true);
    await onDelete(business.id);
    setIsDeleting(false);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, business.id)}
      className="cursor-grab rounded-xl border border-brand-100 bg-white p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="cursor-pointer" onClick={() => onToggleExpand(business.id)}>
        <p className="font-medium text-gray-900">{business.name}</p>
        <p className="text-xs text-gray-500">
          {business.category} · {business.zone}
          {business.distance_km != null && <> · {business.distance_km} km</>}
          {business.visit_cost_estimate != null && (
            <> · ${business.visit_cost_estimate} por visita</>
          )}
        </p>
        {business.assigned_to_name && (
          <p className="text-xs text-gray-400">👤 {business.assigned_to_name}</p>
        )}
        {business.sample_grams != null && (
          <p className="text-xs text-amber-700">
            ☕ Muestra dejada: {business.sample_grams} g
            {business.sample_cost != null && ` · $${business.sample_cost} MXN`}
          </p>
        )}
        {business.is_client && (
          <span className="text-xs font-medium text-green-600">
            ✓ Cliente
            {business.purchase_amount
              ? ` · ${business.purchase_amount} (${FREQUENCY_LABELS[business.purchase_frequency] || ""})`
              : ""}
          </span>
        )}
        {business.next_contact_date && (
          <p
            className={`text-xs font-medium ${
              new Date(business.next_contact_date) < new Date()
                ? "text-red-600"
                : "text-blue-600"
            }`}
          >
            📅 Próximo contacto: {business.next_contact_date.slice(0, 10)}
          </p>
        )}
      </div>

      {onOpenDetail && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(business);
          }}
          className="mt-1 text-xs font-medium text-brand-700 hover:underline"
        >
          🔍 Ver detalle completo
        </button>
      )}

      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2" onClick={(e) => e.stopPropagation()}>
          <label className="block text-xs font-medium text-gray-600">
            Café ofrecido / mostrado
            {useCustomCoffee ? (
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={coffeeOffered}
                  onChange={(e) => setCoffeeOffered(e.target.value)}
                  placeholder="Escribe el nombre del café"
                  className="w-full rounded border border-gray-300 p-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomCoffee(false);
                    setCoffeeOffered("");
                  }}
                  title="Elegir de la lista de precios en vez de escribir"
                  className="shrink-0 rounded border border-gray-300 px-2 text-xs text-gray-500 hover:bg-gray-50"
                >
                  ↩
                </button>
              </div>
            ) : (
              <select
                value={coffeeOffered}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setUseCustomCoffee(true);
                    setCoffeeOffered("");
                  } else {
                    setCoffeeOffered(e.target.value);
                  }
                }}
                className="mt-1 w-full rounded border border-gray-300 p-1.5 text-xs"
              >
                <option value="">Selecciona un producto…</option>
                {(coffeeCatalog || []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom__">Otro (escribir manualmente)</option>
              </select>
            )}
            {!useCustomCoffee && coffeeOffered && (
              <p className="mt-1 text-[11px] text-gray-400">
                Elegir de la lista permite calcular el costo real de la muestra.
              </p>
            )}
          </label>

          <label className="block text-xs font-medium text-gray-600">
            Gramos dejados como muestra
            <input
              type="number"
              min={0}
              step={10}
              value={sampleGrams}
              onChange={(e) => setSampleGrams(e.target.value)}
              placeholder="Ej. 250"
              className="mt-1 w-full rounded border border-gray-300 p-1.5 text-xs"
            />
            {business.sample_cost != null && (
              <p className="mt-1 text-[11px] font-medium text-amber-700">
                Costo real guardado: ${business.sample_cost} MXN
              </p>
            )}
          </label>

          <label className="block text-xs font-medium text-gray-600">
            Volver a contactar el
            <input
              type="date"
              value={nextContactDate}
              onChange={(e) => setNextContactDate(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 p-1.5 text-xs"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={isClient}
              onChange={(e) => setIsClient(e.target.checked)}
            />
            Se volvió cliente
          </label>

          {isClient && (
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="Cantidad (kg, $, etc.)"
                className="w-1/2 rounded border border-gray-300 p-1.5 text-xs"
              />
              <select
                value={purchaseFrequency}
                onChange={(e) => setPurchaseFrequency(e.target.value)}
                className="w-1/2 rounded border border-gray-300 p-1.5 text-xs"
              >
                <option value="">Frecuencia…</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
          )}

          <label className="block text-xs font-medium text-gray-600">
            Comentarios
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-gray-300 p-1.5 text-xs"
              placeholder="Notas de la visita, contacto, próximos pasos…"
            />
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded bg-brand-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSaving ? "Guardando…" : "Guardar"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full rounded border border-red-300 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? "Eliminando…" : "🗑 Eliminar tarjeta"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({
  businesses,
  onUpdateBusinessDetails,
  onDeleteBusiness,
  onOpenDetail,
  coffeeCatalog,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const handleDragStart = (event, businessId) => {
    event.dataTransfer.setData("text/plain", businessId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (event, stage) => {
    event.preventDefault();
    setDragOverStage(null);
    const businessId = event.dataTransfer.getData("text/plain");
    if (!businessId) return;
    await onUpdateBusinessDetails(businessId, { stage });
  };

  const toggleExpand = (businessId) => {
    setExpandedId((prev) => (prev === businessId ? null : businessId));
  };

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {STAGE_COLUMNS.map((column) => {
        const columnBusinesses = businesses.filter((b) => b.stage === column.key);
        const isDragOver = dragOverStage === column.key;

        return (
          <div
            key={column.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(column.key);
            }}
            onDragLeave={() => setDragOverStage((prev) => (prev === column.key ? null : prev))}
            onDrop={(e) => handleDrop(e, column.key)}
            className={`flex w-64 flex-shrink-0 flex-col rounded-xl border-t-4 bg-brand-100/40 sm:w-72 ${column.color} ${
              isDragOver ? "ring-2 ring-brand-400" : ""
            }`}
          >
            <div className="flex items-center justify-between p-3">
              <h3 className="font-display text-sm font-semibold text-brand-900">{column.label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-600 shadow-sm">
                {columnBusinesses.length}
              </span>
            </div>
            <div className="scroll-slim flex-1 space-y-2 overflow-y-auto px-2 pb-3">
              {columnBusinesses.length === 0 ? (
                <p className="px-2 text-xs text-brand-400">Arrastra prospectos aquí.</p>
              ) : (
                columnBusinesses.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    isExpanded={expandedId === business.id}
                    onToggleExpand={toggleExpand}
                    onSave={onUpdateBusinessDetails}
                    onDelete={onDeleteBusiness}
                    onDragStart={handleDragStart}
                    onOpenDetail={onOpenDetail}
                    coffeeCatalog={coffeeCatalog}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
