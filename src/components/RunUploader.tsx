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

function parseAmount(str: string): number | null {
  if (!str) return null;
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatAmount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/**
 * Groepeert facturen met exact dezelfde patiëntnaam samen tot één factuur:
 * pagina's worden samengevoegd (dus één PDF-bijlage, één e-mail), bedragen
 * worden opgeteld (indien numeriek interpreteerbaar) en factuurnummers/data
 * worden samengevoegd ter info.
 */
function mergeBySamePatient(list: PreviewInvoice[]): PreviewInvoice[] {
  const groups = new Map<string, PreviewInvoice[]>();
  for (const inv of list) {
    const key = inv.patient.trim().toLowerCase();
    const arr = groups.get(key) ?? [];
    arr.push(inv);
    groups.set(key, arr);
  }

  const result: PreviewInvoice[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const pages = group.flatMap((g) => g.pages).sort((a, b) => a - b);
    const factuurnummer = group.map((g) => g.factuurnummer).join(" + ");
    const datum = Array.from(new Set(group.map((g) => g.datum).filter(Boolean))).join(", ");
    const amounts = group.map((g) => parseAmount(g.bedrag));
    const bedrag = amounts.every((a) => a !== null)
      ? formatAmount(amounts.reduce((sum, a) => sum! + a!, 0))
      : group.map((g) => g.bedrag).filter(Boolean).join(" + ");

    result.push({ ...group[0], factuurnummer, pages, datum, bedrag });
  }
  return result;
}

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

  function removeInvoice(index: number) {
    setInvoices((prev) => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function mergeSamePatient() {
    setInvoices((prev) => (prev ? mergeBySamePatient(prev) : prev));
  }

  async function printInvoice(inv: PreviewInvoice) {
    if (!file) return;
    setError(null);
    // Open het nieuwe tabblad meteen, synchroon bij de klik — anders blokkeren
    // sommige browsers (o.a. Safari) de pop-up omdat die pas ná de fetch zou
    // openen.
    const newWindow = window.open("", "_blank");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pages", JSON.stringify(inv.pages));
      const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? `Fout bij openen PDF (status ${res.status}).`);
      }
      if (!data.pdfBase64) {
        throw new Error("Geen PDF-data ontvangen.");
      }

      const byteChars = atob(data.pdfBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setError(err.message);
      // Toon de fout ook in het geopende venster zelf i.p.v. het stilletjes te
      // sluiten, anders lijkt het alsof er niets gebeurt.
      if (newWindow) {
        newWindow.document.write(
          `<pre style="font-family: -apple-system, sans-serif; padding: 20px; white-space: pre-wrap;">Fout bij openen van de factuur:\n\n${err.message}</pre>`
        );
      }
    }
  }

  const duplicatePatientCount = (() => {
    if (!invoices) return 0;
    const counts = new Map<string, number>();
    for (const inv of invoices) {
      const key = inv.patient.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.values()).filter((c) => c > 1).length;
  })();

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
                <th></th>
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
                  <td className="row">
                    <button onClick={() => printInvoice(inv)} disabled={sending}>
                      Afdrukken
                    </button>
                    <button className="danger" onClick={() => removeInvoice(idx)} disabled={sending}>
                      Verwijder
                    </button>
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

          {duplicatePatientCount > 0 && (
            <p className="muted">
              {duplicatePatientCount} patiënt{duplicatePatientCount === 1 ? "" : "en"} met meerdere facturen in deze
              batch. Klik op "Samenvoegen per patiënt" om die te bundelen tot één e-mail met één PDF-bijlage per
              patiënt (bedragen worden opgeteld).
            </p>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="primary" onClick={sendAll} disabled={sending}>
              {sending ? "Bezig met versturen..." : `Verstuur ${invoices.length} facturen`}
            </button>
            <button onClick={mergeSamePatient} disabled={sending || duplicatePatientCount === 0}>
              Samenvoegen per patiënt
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
