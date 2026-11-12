-- Draai dit één keer op je Postgres-database (bv. via de Neon SQL-editor,
-- of "npm run db:init" nadat DATABASE_URL is ingesteld).

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    naam TEXT NOT NULL UNIQUE,
    email TEXT,
    taal TEXT NOT NULL DEFAULT 'FR' CHECK (taal IN ('NL', 'FR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optioneel: geschiedenis van verstuurde facturen, puur informatief.
CREATE TABLE IF NOT EXISTS sent_invoices (
    id SERIAL PRIMARY KEY,
    factuurnummer TEXT NOT NULL,
    patient TEXT NOT NULL,
    email TEXT NOT NULL,
    bedrag TEXT,
    taal TEXT,
    status TEXT NOT NULL, -- 'sent' | 'failed'
    error TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
