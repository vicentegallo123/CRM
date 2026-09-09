
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hotel' AND enumtypid = 'category_enum'::regtype) THEN
        ALTER TYPE category_enum ADD VALUE 'hotel';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cooperativa' AND enumtypid = 'category_enum'::regtype) THEN
        ALTER TYPE category_enum ADD VALUE 'cooperativa';
    END IF;
END $$;

-- --- Enum de etapa del pipeline (stage_enum) ---
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_enum') THEN
        CREATE TYPE stage_enum AS ENUM ('nuevo', 'contactado', 'visitado', 'cliente', 'descartado');
    END IF;
END $$;

-- --- Enum de frecuencia de compra (purchase_frequency_enum) ---
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_frequency_enum') THEN
        CREATE TYPE purchase_frequency_enum AS ENUM ('semanal', 'quincenal', 'mensual');
    END IF;
END $$;

-- --- Columnas del pipeline de ventas en businesses (migración 0003) ---
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stage stage_enum NOT NULL DEFAULT 'nuevo';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS coffee_offered TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_client BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS purchase_amount DOUBLE PRECISION;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS purchase_frequency purchase_frequency_enum;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_businesses_stage ON businesses (stage);

-- --- Próximo contacto (migración 0004) ---
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS next_contact_date TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_businesses_next_contact_date ON businesses (next_contact_date);

-- --- Gramos de muestra (migración 0005) ---
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sample_grams DOUBLE PRECISION;

-- --- Punto de referencia configurable (migración 0006) ---
CREATE TABLE IF NOT EXISTS reference_point_settings (
    id SERIAL PRIMARY KEY,
    label VARCHAR(500) NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Verificación final: muestra todas las columnas de businesses ---
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'businesses'
ORDER BY column_name;
