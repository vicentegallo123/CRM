
CREATE EXTENSION IF NOT EXISTS postgis;

-- -----------------------------------------------------------------------------
-- Tipos ENUM (los valores son EXACTAMENTE los que usa la API/JSON, no los
-- nombres en mayúsculas de los enums de Python -- ver `values_callable`
-- en los modelos SQLAlchemy).
-- -----------------------------------------------------------------------------
CREATE TYPE category_enum AS ENUM (
    'cafeteria',
    'funeraria',
    'escuela',
    'restaurante',
    'farmacia',
    'gimnasio',
    'ferreteria',
    'consultorio_medico',
    'despacho_contable',
    'hotel',
    'cooperativa',
    'otro'
);

CREATE TYPE zone_enum AS ENUM (
    'Zapopan',
    'Guadalajara'
);

CREATE TYPE role_enum AS ENUM (
    'admin',
    'vendedor'
);

-- -----------------------------------------------------------------------------
-- Tabla: businesses
-- -----------------------------------------------------------------------------
CREATE TABLE businesses (
    id                  UUID PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    category            category_enum NOT NULL,
    zone                zone_enum NOT NULL,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    address             VARCHAR(500),
    phone               VARCHAR(50),
    website             VARCHAR(500),
    products_services   TEXT,
    rating              DOUBLE PRECISION,
    source_url          VARCHAR(1000),
    visited             BOOLEAN NOT NULL DEFAULT FALSE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_businesses_category ON businesses (category);
CREATE INDEX ix_businesses_zone ON businesses (zone);
CREATE INDEX ix_businesses_zone_category ON businesses (zone, category);
CREATE INDEX ix_businesses_lat_lng ON businesses (lat, lng);

-- -----------------------------------------------------------------------------
-- Tabla: users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID PRIMARY KEY,
    email               VARCHAR(255) NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    hashed_password     VARCHAR(255) NOT NULL,
    role                role_enum NOT NULL DEFAULT 'vendedor',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

-- -----------------------------------------------------------------------------
-- Nota sobre generación de UUID: la aplicación genera los UUID en Python
-- (uuid.uuid4()) antes de insertar, por lo que no es necesario un DEFAULT
-- a nivel de base de datos. Si vas a insertar filas manualmente por SQL sin
-- pasar por la API, puedes generarlos con gen_random_uuid() (requiere la
-- extensión pgcrypto) o uuid_generate_v4() (requiere uuid-ossp), por ejemplo:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   INSERT INTO users (id, email, full_name, hashed_password, role)
--   VALUES (gen_random_uuid(), 'admin@zmg.mx', 'Admin', '<hash_bcrypt>', 'admin');
-- =============================================================================
