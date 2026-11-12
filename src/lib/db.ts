import { Pool } from "pg";

// Eén gedeelde connection pool voor de hele app (serverless-vriendelijk: pg
// hergebruikt connecties binnen dezelfde functie-instantie).
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global._pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL ontbreekt — zet die in je .env.local of Vercel project settings.");
    }
    global._pgPool = new Pool({ connectionString });
  }
  return global._pgPool;
}

export type Patient = {
  id: number;
  naam: string;
  email: string | null;
  taal: "NL" | "FR";
};

export async function listPatients(): Promise<Patient[]> {
  const pool = getPool();
  const { rows } = await pool.query<Patient>(
    "SELECT id, naam, email, taal FROM patients ORDER BY naam ASC"
  );
  return rows;
}

export async function createPatient(naam: string, email: string, taal: "NL" | "FR"): Promise<Patient> {
  const pool = getPool();
  const { rows } = await pool.query<Patient>(
    `INSERT INTO patients (naam, email, taal) VALUES ($1, $2, $3)
     ON CONFLICT (naam) DO UPDATE SET email = EXCLUDED.email, taal = EXCLUDED.taal, updated_at = now()
     RETURNING id, naam, email, taal`,
    [naam.trim(), email.trim(), taal]
  );
  return rows[0];
}

export async function updatePatient(id: number, email: string, taal: "NL" | "FR"): Promise<Patient> {
  const pool = getPool();
  const { rows } = await pool.query<Patient>(
    `UPDATE patients SET email = $2, taal = $3, updated_at = now() WHERE id = $1
     RETURNING id, naam, email, taal`,
    [id, email.trim(), taal]
  );
  return rows[0];
}

export async function deletePatient(id: number): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM patients WHERE id = $1", [id]);
}

export async function findPatientByName(naam: string): Promise<Patient | null> {
  const pool = getPool();
  const { rows } = await pool.query<Patient>(
    "SELECT id, naam, email, taal FROM patients WHERE lower(naam) = lower($1) LIMIT 1",
    [naam]
  );
  return rows[0] ?? null;
}

export async function logSentInvoice(entry: {
  factuurnummer: string;
  patient: string;
  email: string;
  bedrag: string;
  taal: string;
  status: "sent" | "failed";
  error?: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO sent_invoices (factuurnummer, patient, email, bedrag, taal, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entry.factuurnummer, entry.patient, entry.email, entry.bedrag, entry.taal, entry.status, entry.error ?? null]
  );
}
