
import { useState } from "react";
import { useAuthVM } from "../viewmodels/useAuthVM.js";

const inputClass =
  "w-full rounded-lg border border-brand-200 bg-white px-3.5 py-2.5 text-sm text-brand-900 placeholder:text-brand-900/35 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function LoginView({ authVM }) {
  const { login, register, isSubmitting, authError, clearAuthError } = authVM;
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ email: "", fullName: "", password: "", role: "vendedor" });

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearAuthError();
    if (mode === "login") {
      await login({ email: form.email, password: form.password });
    } else {
      await register(form);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-brand-50 lg:flex-row">
      {/* Panel izquierdo: identidad, visible siempre pero compacto en móvil */}
      <div className="flex flex-col justify-between bg-brand-900 px-6 py-8 text-brand-50 lg:w-2/5 lg:px-12 lg:py-12">
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-white">
            CRM Prospectación 
          </p>
          <p className="mt-1 text-sm text-brand-200">
            Cafeterías, hoteles, restaurantes y más en Zapopan y Guadalajara.
          </p>
        </div>
        <div className="mt-8 hidden lg:block">
          <p className="max-w-xs font-display text-2xl font-semibold leading-snug text-white">
            Cada visita cuenta. Organiza tu ruta, tu pipeline y tu equipo en un solo lugar.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-brand-200">
            <li>· Encuentra prospectos nuevos cerca de ti</li>
            <li>· Planea tu ruta del día por calles reales</li>
            <li>· Da seguimiento sin duplicar esfuerzo con tu equipo</li>
          </ul>
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex rounded-lg bg-brand-100 p-1">
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setMode("login");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-white text-brand-900 shadow-sm" : "text-brand-700"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setMode("register");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-white text-brand-900 shadow-sm" : "text-brand-700"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {authError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-700">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  placeholder="Ej. Ana Pérez"
                  value={form.fullName}
                  onChange={handleChange("fullName")}
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-700">Correo</label>
              <input
                type="email"
                required
                placeholder="tu@correo.com"
                value={form.email}
                onChange={handleChange("email")}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-700">Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={handleChange("password")}
                className={inputClass}
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-700">Rol</label>
                <select
                  value={form.role}
                  onChange={handleChange("role")}
                  className={inputClass}
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting
                ? "Procesando…"
                : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
