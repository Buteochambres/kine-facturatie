import { NextRequest, NextResponse } from "next/server";
import { createPatient, listPatients } from "@/lib/db";

export async function GET() {
  try {
    const patients = await listPatients();
    return NextResponse.json({ patients });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij ophalen patiënten." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { naam, email, taal } = body ?? {};
    if (!naam || typeof naam !== "string" || !naam.trim()) {
      return NextResponse.json({ error: "Naam is verplicht." }, { status: 400 });
    }
    if (taal !== "NL" && taal !== "FR") {
      return NextResponse.json({ error: "Taal moet NL of FR zijn." }, { status: 400 });
    }
    const patient = await createPatient(naam, email ?? "", taal);
    return NextResponse.json({ patient });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij aanmaken patiënt." }, { status: 500 });
  }
}
