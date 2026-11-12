import { NextRequest, NextResponse } from "next/server";
import { extractPagesAsPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

// Haalt enkel de opgegeven pagina's van de geüploade verzamel-PDF op, als
// losse PDF — gebruikt om een factuur te kunnen bekijken/afdrukken zonder
// 'm te versturen.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pagesRaw = formData.get("pages");
    const factuurnummer = formData.get("factuurnummer");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
    }
    if (!pagesRaw || typeof pagesRaw !== "string") {
      return NextResponse.json({ error: "Geen pagina's opgegeven." }, { status: 400 });
    }

    const pages: number[] = JSON.parse(pagesRaw);
    const arrayBuffer = await file.arrayBuffer();
    const originalBytes = new Uint8Array(arrayBuffer);
    const pdfBytes = await extractPagesAsPdf(originalBytes, pages);

    const safeName =
      typeof factuurnummer === "string" && factuurnummer
        ? factuurnummer.replace(/[^a-zA-Z0-9_-]/g, "_")
        : "factuur";

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factuur-${safeName}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij genereren PDF." }, { status: 500 });
  }
}
