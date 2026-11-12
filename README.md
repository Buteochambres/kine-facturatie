# Facturatie-tool — Kiné van Leeuwen

Interne webtool voor het maandelijks versturen van facturen. Je upload één
PDF (de verzamel-export uit CareConnect met alle facturen van de maand), de
tool splitst die automatisch in losse facturen, zoekt per patiënt het
e-mailadres en de taal (NL/FR) op in een eigen database, laat je alles
controleren, en verstuurt dan pas de losse facturen per e-mail.

Niets wordt automatisch verstuurd zonder dat je het eerst gezien hebt.

## Wat je nodig hebt (allemaal gratis, allemaal via de website — geen Terminal)

1. Een GitHub-account — https://github.com/signup
2. Een Vercel-account (inloggen kan direct met je GitHub-account) — https://vercel.com/signup
3. Een Neon-account (gratis Postgres-database, inloggen kan ook met GitHub) — https://neon.tech
4. De SMTP-gegevens van anouska@kinevanleeuwen.be (host, poort, gebruikersnaam, wachtwoord) — die vraag je op bij je hostingprovider/domeinregistrar als je ze niet meer hebt.

Je hoeft lokaal niets te installeren (geen Node.js, geen Terminal-commando's).
De paar keer dat hieronder "lokaal" iets genoemd wordt, is dat optioneel.

## Stap 1 — Code naar GitHub

1. Pak dit zip-bestand lokaal uit (dubbelklikken, geen Terminal nodig) tot je
   een map `kine-facturatie-tool` hebt met daarin `package.json`, `src/`, enz.
2. Ga naar https://github.com/new en maak een nieuwe **private** repository,
   bv. genaamd `kine-facturatie-tool`. Vink niets extra aan (geen README,
   geen .gitignore — die hebben we al).
3. Op de pagina van je nieuwe (lege) repository zie je een link
   "**uploading an existing file**" — klik daarop.
4. Sleep de **inhoud** van de uitgepakte map (dus `package.json`, de map
   `src`, de map `sql`, enz. — niet de map `kine-facturatie-tool` zelf) in
   het uploadvak. GitHub ondersteunt uploaden van meerdere bestanden/mappen
   tegelijk via drag-and-drop.
5. Klik onderaan op "Commit changes".

Je code staat nu op GitHub, zonder dat je ooit een git-commando hoefde te
typen.

## Stap 2 — Database op Neon

1. Ga naar https://console.neon.tech en maak een nieuw project (bv.
   `kine-facturatie`).
2. Neon toont je een **connection string**, iets als
   `postgresql://neondb_owner:WACHTWOORD@ep-iets-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   Kopieer die volledig — die heb je in stap 3 nodig als `DATABASE_URL`.
3. Ga in het Neon-dashboard naar "**SQL Editor**" (in het linkermenu).
4. Open in deze projectmap het bestand `sql/schema.sql`, kopieer de hele
   inhoud, plak die in de Neon SQL Editor, en klik op "Run". Dit maakt de
   twee tabellen aan (`patients` en `sent_invoices`). Geen Terminal nodig.

**Veiligheidstip:** als je ooit een databasewachtwoord in een screenshot,
chat of document hebt gedeeld, reset het dan even via Neon → je project →
Settings → Reset password, en werk de `DATABASE_URL` overal bij.

## Stap 3 — Deployen op Vercel

1. Ga naar https://vercel.com/new en kies "Import" bij de GitHub-repository
   die je in stap 1 hebt aangemaakt (geef Vercel toegang tot GitHub als dat
   gevraagd wordt).
2. Vercel herkent dit automatisch als een Next.js-project. Klap "Environment
   Variables" open en vul deze waarden in (één per regel, naam en waarde):

   | Naam | Waarde |
   |---|---|
   | `DATABASE_URL` | de connection string uit stap 2 |
   | `APP_PASSWORD` | een zelfgekozen wachtwoord om in te loggen op de tool |
   | `SESSION_SECRET` | een lange, willekeurige tekst (bv. 40+ willekeurige tekens — alles is goed, dit wordt enkel gebruikt om sessies te ondertekenen) |
   | `SMTP_HOST` | van je hostingprovider |
   | `SMTP_PORT` | meestal `587` |
   | `SMTP_USER` | meestal `anouska@kinevanleeuwen.be` |
   | `SMTP_PASSWORD` | het wachtwoord van die mailbox |
   | `FROM_NAME` | bv. `Kiné van Leeuwen` |
   | `PRACTICE_EMAIL` | `anouska@kinevanleeuwen.be` |

3. Klik op "Deploy". Na een paar minuten krijg je een live URL, iets als
   `https://kine-facturatie-tool.vercel.app`.

Dat is alles — de tool staat live. Je kan de env-variabelen later altijd nog
aanpassen via Vercel → je project → Settings → Environment Variables (daarna
wel even opnieuw deployen via "Redeploy", dat knopje staat op het
Deployments-tabblad).

## Stap 4 — Eerste gebruik

1. Open je live URL en log in met het `APP_PASSWORD` dat je hebt ingesteld.
2. Voeg onderaan de pagina je patiënten toe: naam (exact zoals op de
   CareConnect-factuur), e-mailadres, en taal (NL/FR). Dit moet je maar één
   keer per patiënt doen — nieuwe patiënten voeg je toe zodra ze opduiken.
3. Test de tool het beste eerst met jezelf als "patiënt" (voeg je eigen naam
   en je eigen e-mailadres toe) voordat je 'm op echte patiënten loslaat.
4. Upload de verzamel-PDF van de maand. De tool toont een overzicht per
   factuur: patiënt, bedrag, gevonden e-mailadres en taal. Je kan alles nog
   aanpassen voor je verstuurt.
5. Klik op "Verstuur" — elke factuur wordt als los PDF-bijlage gemaild naar
   het bijhorende adres, in de juiste taal.

## Hoe de tool het e-mailadres bepaalt

Voor elke factuur:

1. Eerst wordt gekeken of de patiëntnaam al in je database staat — zo ja,
   dat e-mailadres en die taal worden gebruikt.
2. Zo niet, wordt gekeken of er toevallig een e-mailadres op de factuur zelf
   staat (dat is bij CareConnect-facturen zelden het geval — meestal staat
   daar enkel het adres van de praktijk zelf op, en dat wordt genegeerd).
3. Vind de tool niets, dan blijft het veld leeg en kan je het handmatig
   invullen vóór verzending. Facturen zonder e-mailadres worden bij
   verzending automatisch overgeslagen (niet verstuurd naar een leeg adres).

## Veiligheid

- Er is één gedeeld wachtwoord (`APP_PASSWORD`) om in te loggen — geen
  individuele accounts. Alleen wie het wachtwoord kent komt binnen.
- `SMTP_PASSWORD` en `DATABASE_URL` staan enkel als environment variables in
  Vercel's eigen, beveiligde instellingen — nergens anders.
- Zet de GitHub-repository op **private** (stap 1), zodat de code (en de
  structuur van de tool) niet publiek zichtbaar is.

## Lokaal draaien (optioneel, voor wie toch wil testen voor deployment)

Dit is niet nodig om de tool te gebruiken — alles hierboven werkt zonder dit.
Enkel handig als je lokaal wil debuggen.

```
npm install
cp .env.example .env.local   # vul de waarden aan
npm run db:init              # enkel als je de SQL-editor in stap 2 hebt overgeslagen
npm run dev
```

Open dan http://localhost:3000.

## Projectstructuur

```
src/
  app/
    page.tsx              dashboard (upload + patiëntenlijst)
    login/page.tsx         inlogpagina
    api/
      login, logout        sessie-cookie
      patients              CRUD patiëntendatabase
      preview               PDF inlezen & splitsen, voorvertoning
      send                  effectief versturen per e-mail
  components/
    RunUploader.tsx         upload → controle → verzenden
    PatientTable.tsx        patiëntendatabase beheren
  lib/
    pdf.ts                  PDF-parsing/splitsing (pdf-parse + pdf-lib)
    mail.ts                 e-mailsjablonen (NL/FR) + SMTP-verzending
    db.ts                   Postgres-toegang
    auth.ts                 wachtwoord-login/sessie (Web Crypto, Edge-compatibel)
  middleware.ts             beveiligt alle routes behalve /login
sql/schema.sql               databasetabellen
```

## Mogelijke uitbreidingen later

- Een overzichtspagina van `sent_invoices` (wie kreeg wat, wanneer, gelukt of niet).
- Een waarschuwing vooraf als een factuur een patiëntnaam heeft die niet in de database staat.
- Automatisch een kopie naar anouska@kinevanleeuwen.be sturen bij elke verzending.
