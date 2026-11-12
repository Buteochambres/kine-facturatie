import { NextRequest, NextResponse } from "next/server";
import { extractPagesAsPdf } from "@/lib/pdf";
import { sendInvoiceEmail } from "@/lib/mail";
import { logSentInvoice } from "@/lib/db";
import type { PreviewInvoice } from "@/app/api/preview/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const invoicesRaw = formData.get("invoices");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
    }
    if (!invoicesRaw || typeof invoicesRaw !== "string") {
      return NextResponse.json({ error: "Geen facturenlijst ontvangen." }, { status: 400 });
    }

    const invoices: PreviewInvoice[] = JSON.parse(invoicesRaw);
    const arrayBuffer = await file.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);

    const results: Array<{ factuurnummer: string; patient: string; email: string; status: "sent" | "failed" | "overgeslagen"; error?: string }> = [];

    for (const inv of invoices) {
      if (!inv.email) {
        results.push({ factuurnummer: inv.factuurnummer, patient: inv.patient, email: "", status: "overgeslagen", error: "Geen e-mailadres." });
        continue;
      }
      try {
        const pdfBytes = await extractPagesAsPdf(originalBytes, inv.pages, {
          bedrag: inv.bedrag,
          factuurnummer: inv.factuurnummer,
          patient: inv.patient,
        });
        await sendInvoiceEmail({
          to: inv.email,
          taal: inv.taal,
          patient: inv.patient,
          nummer: inv.factuurnummer,
          datum: inv.datum,
          bedrag: inv.bedrag,
          pdfBuffer: Buffer.from(pdfBytes),
          pdfFilename: `factuur-${inv.factuurnummer}.pdf`,
        });
        await logSentInvoice({
          factuurnummer: inv.factuurnummer,
          patient: inv.patient,
          email: inv.email,
          bedrag: inv.bedrag,
          taal: inv.taal,
          status: "sent",
        });
        results.push({ factuurnummer: inv.factuurnummer, patient: inv.patient, email: inv.email, status: "sent" });
      } catch (err: any) {
        const message = err?.message ?? "Onbekende fout.";
        await logSentInvoice({
          factuurnummer: inv.factuurnummer,
          patient: inv.patient,
          email: inv.email,
          bedrag: inv.bedrag,
          taal: inv.taal,
          status: "failed",
          error: message,
        });
        results.push({ factuurnummer: inv.factuurnummer, patient: inv.patient, email: inv.email, status: "failed", error: message });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij verzenden." }, { status: 500 });
  }
}
