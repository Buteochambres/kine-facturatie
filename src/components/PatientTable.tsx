"use client";

import { useEffect, useState } from "react";

type Patient = {
  id: number;
  naam: string;
  email: string | null;
  taal: "NL" | "FR";
};

export default function PatientTable() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newNaam, setNewNaam] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTaal, setNewTaal] = useState<"NL" | "FR">("FR");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij ophalen.");
      setPatients(data.patients);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addPatient() {
    if (!newNaam.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam: newNaam, email: newEmail, taal: newTaal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij toevoegen.");
      setNewNaam("");
      setNewEmail("");
      setNewTaal("FR");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function updatePatient(id: number, email: string, taal: "NL" | "FR") {
    setError(null);
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, taal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij bijwerken.");
      setPatients((prev) => prev.map((p) => (p.id === id ? data.patient : p)));
    } catch (err: any) {
      setError(err.message);
      load();
    }
  }

  async function removePatient(id: number) {
    if (!confirm("Deze patiënt verwijderen?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fout bij verwijderen.");
      setPatients((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h2>Patiënten (naam → e-mail &amp; taal)</h2>
      <p className="muted">
        Deze lijst bepaalt naar welk e-mailadres en in welke taal een factuur verstuurd wordt. De naam
        moet exact overeenkomen met de naam op de factuur van CareConnect.
      </p>

      {loading ? (
        <p className="muted">Laden...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Taal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <PatientRow key={p.id} patient={p} onSave={updatePatient} onDelete={removePatient} />
            ))}
            <tr>
              <td>
                <input value={newNaam} onChange={(e) => setNewNaam(e.target.value)} placeholder="Naam" />
              </td>
              <td>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="E-mail" />
              </td>
              <td>
                <select value={newTaal} onChange={(e) => setNewTaal(e.target.value as "NL" | "FR")}>
                  <option value="FR">FR</option>
                  <option value="NL">NL</option>
                </select>
              </td>
              <td>
                <button className="primary" onClick={addPatient} disabled={adding || !newNaam.trim()}>
                  Toevoegen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function PatientRow({
  patient,
  onSave,
  onDelete,
}: {
  patient: Patient;
  onSave: (id: number, email: string, taal: "NL" | "FR") => void;
  onDelete: (id: number) => void;
}) {
  const [email, setEmail] = useState(patient.email ?? "");
  const [taal, setTaal] = useState<"NL" | "FR">(patient.taal);
  const [dirty, setDirty] = useState(false);

  return (
    <tr>
      <td>{patient.naam}</td>
      <td>
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setDirty(true);
          }}
        />
      </td>
      <td>
        <select
          value={taal}
          onChange={(e) => {
            setTaal(e.target.value as "NL" | "FR");
            setDirty(true);
          }}
        >
          <option value="FR">FR</option>
          <option value="NL">NL</option>
        </select>
      </td>
      <td className="row">
        <button
          disabled={!dirty}
          onClick={() => {
            onSave(patient.id, email, taal);
            setDirty(false);
          }}
        >
          Opslaan
        </button>
        <button className="danger" onClick={() => onDelete(patient.id)}>
          Verwijder
        </button>
      </td>
    </tr>
  );
}
