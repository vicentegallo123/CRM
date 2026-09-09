# CRM de Prospectación · Scraping · Rutas — Zona Metropolitana de Guadalajara

Sistema para prospectar negocios (Zapopan y Guadalajara), extraerlos de
Google Maps con Playwright, guardarlos en PostgreSQL, y planear rutas de
visita optimizadas sobre un mapa interactivo.

## Arquitectura

```
backend/   FastAPI + SQLAlchemy 2.0 (async) + Playwright + Alembic
frontend/  React (Vite) + Tailwind + Leaflet, patrón MVVM
db/        Scripts SQL de referencia e inicialización de Postgres
```

- **Backend**: Clean Architecture -> `api/endpoints` (routers) → `services`
  (lógica de negocio: scraper, optimizador de rutas) → `models` (ORM) →
  `schemas` (Pydantic).
- **Frontend**: MVVM -> `views` (pantallas) usan `components` (JSX puro,
  sin lógica) que reciben todo desde `viewmodels/useMapRoutesVM.js` (hook
  que concentra estado, llamadas API y cálculo de rutas).
- **Seguridad**: JWT (access + refresh), contraseñas con bcrypt, roles
  `admin`/`vendedor`, rate limiting básico, cabeceras de seguridad HTTP.

---

## Opción A: Levantar todo con Docker (recomendado)

Requiere Docker y Docker Compose instalados.

```bash
# 1. Clona/descomprime el proyecto y entra a la carpeta raíz
cd crm-prospectacion

# 2. Copia el archivo de variables de entorno del backend
cp backend/.env.example backend/.env
#    (opcional) edita backend/.env y cambia SECRET_KEY por un valor único:
#    python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# 3. Levanta los tres servicios: Postgres+PostGIS, backend, frontend
docker compose up --build
```

Esto hace, en orden:

1. Crea el contenedor `db` (imagen `postgis/postgis:16-3.4`) y ejecuta
   `db/init/001_extensions.sql` como superusuario (habilita PostGIS).
2. Construye el contenedor `backend`, instala Playwright + Chromium, y al
   arrancar (`docker-entrypoint.sh`) espera a que Postgres esté listo y
   corre `alembic upgrade head` para crear/actualizar el esquema exacto
   definido en los modelos SQLAlchemy.
3. Construye el `frontend` (Vite build) y lo sirve con Nginx.

Servicios expuestos:
| Servicio | URL |
|---|---|
| API (docs interactivas) | http://localhost:8000/docs |
| Frontend | http://localhost:5173 |
| Postgres | localhost:5432 |

Para detener todo: `docker compose down` (agrega `-v` si además quieres
borrar el volumen de datos de Postgres).

---

## Opción B: Ejecución manual por consola (sin Docker)

### 1. Base de datos (PostgreSQL)

Necesitas un PostgreSQL 16+ corriendo. Con PostGIS instalado en el
servidor (opcional; el modelo actual usa columnas Float para lat/lng, así
que la app funciona igual sin PostGIS).

```bash
# Crea el rol y la base de datos (ajusta usuario/contraseña a tu gusto)
psql -U postgres -c "CREATE USER crm_user WITH PASSWORD 'crm_password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE crm_prospectacion OWNER crm_user;"
psql -U postgres -d crm_prospectacion -c "GRANT ALL ON SCHEMA public TO crm_user;"

# (opcional, requiere superusuario) habilita PostGIS
psql -U postgres -d crm_prospectacion -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Luego crea el esquema (tablas, enums, índices) con **cualquiera** de estas
dos vías equivalentes:

**Vía Alembic (recomendada — mantiene control de versiones del esquema):**

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # ajusta las credenciales si las cambiaste arriba
alembic upgrade head
```

**Vía SQL directo (alternativa manual, sin Alembic):**

```bash
psql -U postgres -d crm_prospectacion -f db/schema_reference.sql
```

> Ambas vías generan exactamente el mismo esquema: tablas `businesses` y
> `users`, con los mismos tipos `ENUM` (`category_enum`, `zone_enum`,
> `role_enum`), los mismos índices, y los mismos valores por defecto. Esto
> fue verificado ejecutando la aplicación real contra ambos.

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv && source venv/bin/activate   # si no lo hiciste arriba
pip install -r requirements.txt
playwright install --with-deps chromium   # navegador que usa el scraper

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

La API queda disponible en `http://localhost:8000`, con documentación
interactiva (Swagger) en `http://localhost:8000/docs`.

Al arrancar, la app también ejecuta `Base.metadata.create_all` como
salvaguarda (crea tablas si no existen), pero el flujo recomendado para
mantener el esquema sincronizado con cambios futuros en los modelos es
Alembic (`alembic revision --autogenerate -m "mensaje"` y luego
`alembic upgrade head`).

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Se abre en `http://localhost:5173`. Si el backend corre en una URL
distinta a `http://localhost:8000/api/v1`, crea un archivo `.env` en
`frontend/` con:

```
VITE_API_BASE_URL=http://tu-backend:8000/api/v1
```

---

## Primer uso: crear un usuario y probar el flujo completo

```bash
# 1. Registra un usuario admin
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zmg.mx","full_name":"Admin ZMG","password":"CambiaEsto123","role":"admin"}'

# 2. Inicia sesión y obtén el token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zmg.mx","password":"CambiaEsto123"}'

# 3. Dispara el scraper (usa el access_token del paso anterior)
curl -X POST http://localhost:8000/api/v1/scraper/run \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"category":"cafeteria","zone":"Zapopan","max_results":20}'

# 4. Optimiza una ruta con los negocios encontrados
curl -X POST http://localhost:8000/api/v1/routes/optimize \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"business_ids": ["<id1>", "<id2>"]}'
```

O simplemente entra al frontend en `http://localhost:5173`. La primera
pantalla pide iniciar sesión o registrarte (usa el formulario, no hace
falta `curl`); una vez dentro, usa la barra lateral para filtrar/scrapear
y el mapa para seleccionar negocios y calcular la ruta.

---

## Notas de seguridad para producción

- **Cambia `SECRET_KEY`** en `backend/.env` (nunca uses el valor de
  ejemplo). Genera uno con:
  `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`.
- El rate limiting incluido es en memoria por proceso; si despliegas con
  varios workers/réplicas necesitas moverlo a Redis (sliding window
  distribuido) o a un API Gateway/Nginx.
- Considera mover los tokens JWT del `localStorage` del frontend a cookies
  `httpOnly` + `SameSite=Strict` si te preocupa el robo de tokens vía XSS.
- Restringe `BACKEND_CORS_ORIGINS` (en `app/core/config.py`) al dominio
  real de tu frontend en producción.
