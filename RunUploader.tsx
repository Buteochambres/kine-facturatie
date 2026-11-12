"use client";

import { useRef, useState } from "react";
import type { PreviewInvoice } from "@/app/api/preview/route";

type SendResult = {
  factuurnummer: string;
  patient: string;
  email: string;
  status: "sent" | "failed" | "overgeslagen";
  error?: string;
};

export default function RunUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [invoices, setInvoices] = useState<PreviewInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResults(null);
    setError(null);
    setInvoices(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij inlezen PDF.");
      setInvoices(data.invoices);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateInvoice(index: number, patch: Partial<PreviewInvoice>) {
    setInvoices((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function sendAll() {
    if (!file || !invoices) return;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoices", JSON.stringify(invoices));
      const res = await fetch("/api/send", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij verzenden.");
      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setFile(null);
    setInvoices(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const missingEmailCount = invoices?.filter((i) => !i.email).length ?? 0;

  return (
    <div className="card">
      <h2>Nieuwe run</h2>
      <p className="muted">
        Upload de verzamel-PDF met alle facturen van deze maand uit CareConnect. De tool splitst ze
        automatisch, zoekt het e-mailadres en de taal per patiënt op, en laat je alles controleren
        voordat er iets verstuurd wordt.
      </p>

      {!invoices && (
        <div className="row">
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFileChosen} disabled={loading} />
          {loading && <span className="muted">Bezig met inlezen...</span>}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {invoices && !results && (
        <>
          <table>
            <thead>
              <tr>
                <th>Factuur</th>
                <th>Patiënt</th>
                <th>Bedrag</th>
                <th>E-mail</th>
                <th>Taal</th>
                <th>Bron</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => (
                <tr key={`${inv.factuurnummer}-${idx}`}>
                  <td>{inv.factuurnummer}</td>
                  <td>{inv.patient}</td>
                  <td>{inv.bedrag ? `€${inv.bedrag}` : "-"}</td>
                  <td>
                    <input
                      value={inv.email}
                      placeholder="geen e-mail gevonden"
                      onChange={(e) => updateInvoice(idx, { email: e.target.value, bron: "onbekend" })}
                    />
                  </td>
                  <td>
                    <select value={inv.taal} onChange={(e) => updateInvoice(idx, { taal: e.target.value as "NL" | "FR" })}>
                      <option value="FR">FR</option>
                      <option value="NL">NL</option>
                    </select>
                  </td>
                  <td>
                    {inv.email ? (
                      <span className={`badge ${inv.bron === "database" ? "ok" : "warn"}`}>
                        {inv.bron === "database" ? "patiëntendatabase" : inv.bron === "factuur" ? "van factuur" : "handmatig"}
                      </span>
                    ) : (
                      <span className="badge err">ontbreekt</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {missingEmailCount > 0 && (
            <p className="error-text">
              {missingEmailCount} factu{missingEmailCount === 1 ? "ur" : "ren"} zonder e-mailadres — deze worden
              overgeslagen bij verzending, of vul het adres hierboven handmatig in.
            </p>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="primary" onClick={sendAll} disabled={sending}>
              {sending ? "Bezig met versturen..." : `Verstuur ${invoices.length} facturen`}
            </button>
            <button onClick={reset} disabled={sending}>
              Annuleren
            </button>
          </div>
        </>
      )}

      {results && (
        <>
          <table>
            <thead>
              <tr>
                <th>Factuur</th>
                <th>Patiënt</th>
                <th>E-mail</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={`${r.factuurnummer}-${idx}`}>
                  <td>{r.factuurnummer}</td>
                  <td>{r.patient}</td>
                  <td>{r.email || "-"}</td>
                  <td>
                    {r.status === "sent" && <span className="badge ok">verstuurd</span>}
                    {r.status === "failed" && <span className="badge err">mislukt{r.error ? `: ${r.error}` : ""}</span>}
                    {r.status === "overgeslagen" && <span className="badge warn">overgeslagen</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="primary" onClick={reset}>
              Nieuwe run starten
            </button>
          </div>
        </>
      )}
    </div>
  );
}
