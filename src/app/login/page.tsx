"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Inloggen mislukt.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <h2>Inloggen</h2>
        <form onSubmit={onSubmit}>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
          </div>
          <button className="primary" type="submit" disabled={loading || !password}>
            {loading ? "Bezig..." : "Inloggen"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    </div>
  );
}
