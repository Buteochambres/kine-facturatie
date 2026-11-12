// Gebruikt de Web Crypto API (globalThis.crypto.subtle) i.p.v. Node's
// 'crypto'-module, zodat dit ook probleemloos werkt in de Edge Runtime
// waarin middleware.ts draait.

export const SESSION_COOKIE = "kine_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen
export const SESSION_MAX_AGE_SECONDS = MAX_AGE_MS / 1000;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET ontbreekt — zet die in je .env.local of Vercel project settings.");
  }
  return secret;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Maak een ondertekende sessiewaarde: "<verlooptijd>.<hmac>" */
export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + MAX_AGE_MS;
  const hmac = await hmacHex(String(expires), getSecret());
  return `${expires}.${hmac}`;
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expiresStr, hmac] = token.split(".");
  if (!expiresStr || !hmac) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmacHex(expiresStr, getSecret());
  return timingSafeEqual(hmac, expected);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD ontbreekt — zet die in je .env.local of Vercel project settings.");
  }
  // Lengtes verschillen mag hier lekken (het wachtwoord zelf niet) — dit is
  // geen high-security multi-tenant login, enkel een gedeeld toegangswachtwoord.
  return timingSafeEqual(candidate, expected);
}
