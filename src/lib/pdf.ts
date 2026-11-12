import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
// Let op: we importeren rechtstreeks de interne lib i.p.v. het package-root
// ("pdf-parse"), omdat pdf-parse/index.js een 'debug mode' bevat die bij het
// inladen (afhankelijk van hoe de module gerequire't wordt) een eigen
// testbestand probeert in te lezen. De interne module hieronder heeft dat
// neveneffect niet.
// @ts-ignore -- geen types voor dit interne pad
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const INVOICE_NR_RE = /Factuur\s+(\d+)/;
const PAGE_RE = /Pagina\s+(\d+)\s*\/\s*(\d+)/;
const DATE_RE = /Factuurdatum\s+([\d/]+)/;
const TOTAL_RE = /Totaal te betalen:\s*€?\s*([\d.,]+)/;

export type Invoice = {
  nummer: string;
  pages: number[]; // 0-indexed paginanummers in het originele bestand
  patient: string;
  datum: string;
  bedrag: string;
  emailOpFactuur: string | null;
};

/**
 * Lees de tekst van elke pagina apart uit een PDF-buffer, in paginavolgorde.
 */
async function extractPerPageText(buffer: Buffer): Promise<string[]> {
  const pageTexts: string[] = [];

  function pagerender(pageData: any) {
    const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(renderOptions).then((textContent: any) => {
      let lastY;
      let text = "";
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }
      pageTexts.push(text);
      return text;
    });
  }

  await pdfParse(buffer, { pagerender });
  return pageTexts;
}

function extractPatientName(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx] === "Patiënt" || lines[idx].startsWith("Patiënt")) {
      const candidate = lines[idx + 1];
      if (candidate && !candidate.toLowerCase().startsWith("kinesitherapeut")) {
        return candidate;
      }
    }
  }
  return null;
}

function findPatientEmailOnInvoice(text: string, practiceEmail: string): string | null {
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;
  const practice = practiceEmail.toLowerCase();
  for (const addr of matches) {
    const lower = addr.toLowerCase();
    // pdf.js plakt tekstlabels soms zonder spatie aan de waarde vast (bv.
    // "E-mailanouska@kinevanleeuwen.be"), waardoor het praktijkadres als
    // langere string wordt herkend dan het eigenlijke adres. Vergelijk dus
    // op "eindigt met" i.p.v. exacte gelijkheid.
    if (!lower.endsWith(practice)) {
      return addr;
    }
  }
  return null;
}

type RawGroup = { nummer: string; pages: number[]; text: string };

export async function parseBulkInvoicePdf(
  buffer: Buffer,
  practiceEmail: string
): Promise<Invoice[]> {
  const pageTexts = await extractPerPageText(buffer);
  const groups: RawGroup[] = [];
  let current: RawGroup | null = null;

  pageTexts.forEach((text, i) => {
    const nrMatch = text.match(INVOICE_NR_RE);
    const pageMatch = text.match(PAGE_RE);
    const nr = nrMatch ? nrMatch[1] : null;
    const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;

    if (nr && (!current || nr !== current.nummer || pageNum === 1)) {
      current = { nummer: nr, pages: [], text: "" };
      groups.push(current);
    } else if (!current) {
      current = { nummer: `onbekend-${i + 1}`, pages: [], text: "" };
      groups.push(current);
    }
    current!.pages.push(i);
    current!.text += "\n" + text;
  });

  return groups.map((inv) => {
    const datumMatch = inv.text.match(DATE_RE);
    const totalMatch = inv.text.match(TOTAL_RE);
    return {
      nummer: inv.nummer,
      pages: inv.pages,
      patient: extractPatientName(inv.text) ?? "ONBEKEND",
      datum: datumMatch ? datumMatch[1] : "",
      bedrag: totalMatch ? totalMatch[1] : "",
      emailOpFactuur: findPatientEmailOnInvoice(inv.text, practiceEmail),
    };
  });
}

export type PaymentInfo = {
  bedrag: string;
  factuurnummer: string;
  patient: string;
};

function parseAmountToNumber(str: string): number | null {
  if (!str) return null;
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bouwt de payload voor een EPC-betalings-QR-code (SEPA Credit Transfer,
 * standaard EPC069-12) — het type QR-code dat Belgische/Europese bankapps
 * herkennen om automatisch een overschrijving klaar te zetten.
 */
function buildEpcQrPayload(opts: { iban: string; name: string; amount: number | null; remittance: string }): string {
  const iban = opts.iban.replace(/\s+/g, "").toUpperCase();
  const amountLine = opts.amount !== null ? `EUR${opts.amount.toFixed(2)}` : "";
  const lines = [
    "BCD", // Service Tag
    "002", // Versie
    "1", // Tekenset (1 = UTF-8)
    "SCT", // SEPA Credit Transfer
    "", // BIC — optioneel, niet nodig binnen SEPA
    opts.name.slice(0, 70), // Naam begunstigde
    iban,
    amountLine,
    "", // Purpose code — optioneel
    "", // Gestructureerde mededeling — niet gebruikt
    opts.remittance.slice(0, 140), // Vrije mededeling
  ];
  return lines.join("\n");
}

/**
 * Voegt een extra pagina toe aan het PDF-document met een betaal-QR-code en
 * de bankgegevens in tekst — enkel als PRACTICE_IBAN en PRACTICE_ACCOUNT_NAME
 * zijn ingesteld. Ontbreken die, dan wordt er niets toegevoegd (geen fout).
 */
async function appendPaymentPage(doc: PDFDocument, payment: PaymentInfo, pageSize: [number, number]): Promise<void> {
  const iban = process.env.PRACTICE_IBAN;
  const accountName = process.env.PRACTICE_ACCOUNT_NAME;
  if (!iban || !accountName) return;

  const amount = parseAmountToNumber(payment.bedrag);
  const remittance = `Factuur ${payment.factuurnummer} - ${payment.patient}`;
  const qrPayload = buildEpcQrPayload({ iban, name: accountName, amount, remittance });

  const qrPngBuffer = await QRCode.toBuffer(qrPayload, { type: "png", width: 300, margin: 1 });
  const qrImage = await doc.embedPng(qrPngBuffer);

  const [width, height] = pageSize;
  const page = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 80;
  page.drawText("Betaal deze factuur", { x: 50, y, size: 18, font: fontBold });
  y -= 36;
  page.drawText("Scan de QR-code hieronder met de betaalapp van uw bank om", { x: 50, y, size: 11, font });
  y -= 16;
  page.drawText("deze factuur snel en correct te betalen.", { x: 50, y, size: 11, font });

  const qrSize = 200;
  const qrY = Math.max(40, y - 40 - qrSize);
  page.drawImage(qrImage, { x: 50, y: qrY, width: qrSize, height: qrSize });

  let textY = qrY + qrSize - 10;
  const textX = 50 + qrSize + 40;
  page.drawText("Of maak handmatig over naar:", { x: textX, y: textY, size: 11, font: fontBold });
  textY -= 22;
  page.drawText(`Naam: ${accountName}`, { x: textX, y: textY, size: 11, font });
  textY -= 18;
  page.drawText(`IBAN: ${iban.replace(/\s+/g, "").toUpperCase()}`, { x: textX, y: textY, size: 11, font });
  textY -= 18;
  if (amount !== null) {
    page.drawText(`Bedrag: €${amount.toFixed(2).replace(".", ",")}`, { x: textX, y: textY, size: 11, font });
    textY -= 18;
  }
  page.drawText(`Mededeling: ${remittance}`, { x: textX, y: textY, size: 11, font });
}

/**
 * Bouw een nieuw PDF-bestand met enkel de opgegeven pagina's van het
 * originele bulk-bestand (0-indexed). Als `payment` is meegegeven én
 * PRACTICE_IBAN/PRACTICE_ACCOUNT_NAME zijn ingesteld, wordt er een extra
 * betaalpagina met QR-code achteraan toegevoegd.
 */
export async function extractPagesAsPdf(
  originalBytes: Uint8Array,
  pageIndices: number[],
  payment?: PaymentInfo
): Promise<Uint8Array> {
  const src = await PDFDocument.load(originalBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pageIndices);
  copied.forEach((p) => out.addPage(p));

  if (payment) {
    const first = out.getPages()[0];
    const size: [number, number] = first ? [first.getWidth(), first.getHeight()] : [595.28, 841.89];
    await appendPaymentPage(out, payment, size);
  }

  return out.save();
}
