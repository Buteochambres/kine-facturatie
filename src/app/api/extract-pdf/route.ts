import { NextRequest, NextResponse } from "next/server";
import { extractPagesAsPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

// Haalt enkel de opgegeven pagina's van de geüploade verzamel-PDF op, als
// losse PDF (als base64 in JSON, i.p.v. een ruwe binaire respons — dat bleek
// op Vercel tot een onduidelijke serverfout te leiden). Gebruikt om een
// factuur te kunnen bekijken/afdrukken zonder 'm te versturen.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pagesRaw = formData.get("pages");
    const factuurnummer = formData.get("factuurnummer");
    const patient = formData.get("patient");
    const bedrag = formData.get("bedrag");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
    }
    if (!pagesRaw || typeof pagesRaw !== "string") {
      return NextResponse.json({ error: "Geen pagina's opgegeven." }, { status: 400 });
    }

    const pages: number[] = JSON.parse(pagesRaw);
    const arrayBuffer = await file.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);
    const payment =
      typeof factuurnummer === "string" && typeof patient === "string" && typeof bedrag === "string"
        ? { factuurnummer, patient, bedrag }
        : undefined;
    const pdfBytes = await extractPagesAsPdf(originalBytes, pages, payment);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    return NextResponse.json({ pdfBase64 });
  } catch (err: any) {
    console.error("extract-pdf error:", err);
    return NextResponse.json({ error: err.message ?? "Fout bij genereren PDF." }, { status: 500 });
  }
}
