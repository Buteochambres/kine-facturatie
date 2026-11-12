import { PDFDocument } from "pdf-lib";
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

/**
 * Bouw een nieuw PDF-bestand met enkel de opgegeven pagina's van het
 * originele bulk-bestand (0-indexed).
 */
export async function extractPagesAsPdf(originalBytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(originalBytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pageIndices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}
