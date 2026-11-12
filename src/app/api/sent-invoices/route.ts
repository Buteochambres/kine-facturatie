import { NextResponse } from "next/server";
import { listSentInvoices } from "@/lib/db";

export async function GET() {
  try {
    const invoices = await listSentInvoices();
    return NextResponse.json({ invoices });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij ophalen geschiedenis." }, { status: 500 });
  }
}
