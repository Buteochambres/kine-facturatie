import { NextRequest, NextResponse } from "next/server";
import { parseBulkInvoicePdf } from "@/lib/pdf";
import { findPatientByName } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export type PreviewInvoice = {
  factuurnummer: string;
  pages: number[];
  patient: string;
  datum: string;
  bedrag: string;
  email: string;
  taal: "NL" | "FR";
  bron: "database" | "factuur" | "onbekend";
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
    }

    const practiceEmail = process.env.PRACTICE_EMAIL ?? "";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const invoices = await parseBulkInvoicePdf(buffer, practiceEmail);

    const results: PreviewInvoice[] = [];
    for (const inv of invoices) {
      const patient = await findPatientByName(inv.patient);
      let email = "";
      let taal: "NL" | "FR" = "FR";
      let bron: PreviewInvoice["bron"] = "onbekend";

      if (patient?.email) {
        email = patient.email;
        taal = patient.taal;
        bron = "database";
      } else if (inv.emailOpFactuur) {
        email = inv.emailOpFactuur;
        bron = "factuur";
      }

      results.push({
        factuurnummer: inv.nummer,
        pages: inv.pages,
        patient: inv.patient,
        datum: inv.datum,
        bedrag: inv.bedrag,
        email,
        taal,
        bron,
      });
    }

    return NextResponse.json({ invoices: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij verwerken PDF." }, { status: 500 });
  }
}
