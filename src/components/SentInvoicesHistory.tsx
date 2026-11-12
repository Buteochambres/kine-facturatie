"use client";

import { useEffect, useState } from "react";

type SentInvoiceLogEntry = {
  id: number;
  factuurnummer: string;
  patient: string;
  email: string;
  bedrag: string | null;
  taal: string | null;
  status: "sent" | "failed";
  error: string | null;
  sent_at: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SentInvoicesHistory() {
  const [entries, setEntries] = useState<SentInvoiceLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sent-invoices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij ophalen geschiedenis.");
      setEntries(data.invoices);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && entries === null) {
      load();
    }
  }, [open, entries]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Geschiedenis verstuurde facturen</h2>
        <button onClick={() => setOpen((o) => !o)}>{open ? "Verberg" : "Toon"}</button>
      </div>

      {open && (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            Overzicht van elke factuur die ooit via deze tool verstuurd is (of waarbij dat mislukte),
            met datum, patiënt, e-mailadres en status.
          </p>

          <div className="row" style={{ marginBottom: 12 }}>
            <button onClick={load} disabled={loading}>
              {loading ? "Bezig..." : "Vernieuwen"}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          {entries && entries.length === 0 && <p className="muted">Nog geen facturen verstuurd.</p>}

          {entries && entries.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Factuur</th>
                  <th>Patiënt</th>
                  <th>E-mail</th>
                  <th>Bedrag</th>
                  <th>Taal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.sent_at)}</td>
                    <td>{e.factuurnummer}</td>
                    <td>{e.patient}</td>
                    <td>{e.email}</td>
                    <td>{e.bedrag ? `€${e.bedrag}` : "-"}</td>
                    <td>{e.taal ?? "-"}</td>
                    <td>
                      {e.status === "sent" ? (
                        <span className="badge ok">verstuurd</span>
                      ) : (
                        <span className="badge err">mislukt{e.error ? `: ${e.error}` : ""}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
