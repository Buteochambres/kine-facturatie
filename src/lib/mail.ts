import nodemailer from "nodemailer";

type Taal = "NL" | "FR";

const TEMPLATES: Record<Taal, { subject: (nr: string) => string; body: (patient: string, nr: string, datum: string, bedrag: string) => string }> = {
  NL: {
    subject: (nr) => `Factuur ${nr} - Kiné van Leeuwen`,
    body: (patient, nr, datum, bedrag) =>
      `Beste ${patient},\n\n` +
      `In bijlage vindt u factuur ${nr}${datum ? ` van ${datum}` : ""}${bedrag ? ` ter waarde van €${bedrag}` : ""}.\n\n` +
      `Met vriendelijke groeten,\nAnouska van Leeuwen\nKiné van Leeuwen`,
  },
  FR: {
    subject: (nr) => `Facture ${nr} - Kiné van Leeuwen`,
    body: (patient, nr, datum, bedrag) =>
      `Cher/Chère ${patient},\n\n` +
      `Veuillez trouver ci-joint la facture ${nr}${datum ? ` du ${datum}` : ""}${bedrag ? ` d'un montant de €${bedrag}` : ""}.\n\n` +
      `Bien cordialement,\nAnouska van Leeuwen\nKiné van Leeuwen`,
  },
};

export function subjectFor(taal: Taal, nummer: string): string {
  return TEMPLATES[taal].subject(nummer);
}

export function bodyFor(taal: Taal, patient: string, nummer: string, datum: string, bedrag: string): string {
  return TEMPLATES[taal].body(patient, nummer, datum, bedrag);
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("SMTP-instellingen ontbreken — zet SMTP_HOST, SMTP_USER en SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendInvoiceEmail(params: {
  to: string;
  taal: Taal;
  patient: string;
  nummer: string;
  datum: string;
  bedrag: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<void> {
  const transport = getTransport();
  const fromName = process.env.FROM_NAME ?? "Kiné van Leeuwen";
  const fromAddress = process.env.PRACTICE_EMAIL ?? process.env.SMTP_USER!;

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: params.to,
    subject: subjectFor(params.taal, params.nummer),
    text: bodyFor(params.taal, params.patient, params.nummer, params.datum, params.bedrag),
    attachments: [
      {
        filename: params.pdfFilename,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
