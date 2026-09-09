
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

const STAGE_STYLES = {
  nuevo: "bg-brand-100 text-brand-800",
  contactado: "bg-blue-100 text-blue-800",
  visitado: "bg-amber-100 text-amber-800",
  cliente: "bg-green-100 text-green-800",
  descartado: "bg-red-100 text-red-700",
};

const STAGE_LABELS = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  visitado: "Visitado",
  cliente: "Cliente",
  descartado: "Descartado",
};

const FREQUENCY_LABELS = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

function Field({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-xs font-medium text-brand-500">{label}</p>
      <p className="text-sm text-brand-900">{value}</p>
    </div>
  );
}

export default function BusinessDetailModal({ business, onClose }) {
  if (!business) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between border-b border-brand-100 pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-900">{business.name}</h2>
            <p className="text-sm text-brand-500">
              {CATEGORY_LABELS[business.category] || business.category} · {business.zone}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STAGE_STYLES[business.stage] || "bg-brand-100 text-brand-800"
              }`}
            >
              {STAGE_LABELS[business.stage] || business.stage}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendedor asignado" value={business.assigned_to_name} />
          <Field
            label="¿Es cliente?"
            value={business.is_client ? "Sí ✓" : "No"}
          />
          <Field
            label="Distancia desde tu punto de partida"
            value={business.distance_km != null ? `${business.distance_km} km` : null}
          />
          <Field
            label="Costo estimado de visita"
            value={
              business.visit_cost_estimate != null ? `$${business.visit_cost_estimate}` : null
            }
          />
          <Field label="¿Visitado?" value={business.visited ? "Sí" : "No"} />
          <Field
            label="Última visita"
            value={
              business.last_visited_at
                ? new Date(business.last_visited_at).toLocaleString("es-MX")
                : null
            }
          />
          <Field
            label="Próximo contacto"
            value={
              business.next_contact_date
                ? new Date(business.next_contact_date).toLocaleDateString("es-MX")
                : null
            }
          />
          <Field label="Rating" value={business.rating != null ? `★ ${business.rating}` : null} />
        </div>

        {business.is_client && (business.purchase_amount || business.purchase_frequency) && (
          <div className="mt-3 rounded-xl bg-green-50 p-3">
            <p className="text-xs font-medium text-green-700">Consumo</p>
            <p className="text-sm text-green-900">
              {business.purchase_amount ?? "—"}{" "}
              {business.purchase_frequency
                ? `(${FREQUENCY_LABELS[business.purchase_frequency] || business.purchase_frequency})`
                : ""}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3 border-t border-brand-100 pt-3">
          <Field label="Dirección" value={business.address} />
          <Field label="Teléfono" value={business.phone} />
          {business.website && (
            <div>
              <p className="text-xs font-medium text-brand-500">Sitio web</p>
              <a
                href={business.website}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-brand-600 hover:underline"
              >
                {business.website}
              </a>
            </div>
          )}
          <Field label="Descripción / giro" value={business.products_services} />
          <Field label="Café ofrecido / mostrado" value={business.coffee_offered} />
          <Field
            label="Muestra dejada"
            value={business.sample_grams != null ? `${business.sample_grams} g` : null}
          />
          <Field
            label="Costo real de la muestra"
            value={business.sample_cost != null ? `$${business.sample_cost} MXN` : null}
          />
          <Field label="Notas / comentarios" value={business.notes} />
        </div>
      </div>
    </div>
  );
}
