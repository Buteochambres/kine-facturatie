import { NextRequest, NextResponse } from "next/server";
import { deletePatient, updatePatient } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Ongeldig id." }, { status: 400 });
    }
    const body = await request.json();
    const { email, taal } = body ?? {};
    if (taal !== "NL" && taal !== "FR") {
      return NextResponse.json({ error: "Taal moet NL of FR zijn." }, { status: 400 });
    }
    const patient = await updatePatient(id, email ?? "", taal);
    return NextResponse.json({ patient });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij bijwerken patiënt." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Ongeldig id." }, { status: 400 });
    }
    await deletePatient(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Fout bij verwijderen patiënt." }, { status: 500 });
  }
}
