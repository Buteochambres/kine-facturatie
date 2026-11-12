"use client";

import { useRouter } from "next/navigation";
import RunUploader from "@/components/RunUploader";
import PatientTable from "@/components/PatientTable";
import SentInvoicesHistory from "@/components/SentInvoicesHistory";

export default function HomePage() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Facturatie — Kiné van Leeuwen</h1>
        <button onClick={logout}>Uitloggen</button>
      </div>

      <RunUploader />
      <PatientTable />
      <SentInvoicesHistory />
    </div>
  );
}
