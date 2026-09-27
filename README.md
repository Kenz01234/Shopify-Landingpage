# Quest Agent

**Dein Faceless-Kanal. Läuft für dich.** – Website, Kundenbereich, Backend und Worker für ein automatisiertes Faceless-YouTube-System mit menschlicher Freigabe.

- Helle (und dunkle) animierte Website im Konzept **„Der rote Faden“**: Hero mit interaktiver Loop-Demo, Loop-Erklärung, Konfigurator als Funnel-Einstieg, Freigabe-Demo, Preise, FAQ.
- Vollständiger Kundenbereich: Übersicht, System-Wizard, Produktion (Live-Status), Freigabe-Inbox mit Editor und Versionen, Kalender, Medienbibliothek, Verbindungen, Abo, Konto – plus kleiner Admin-Bereich.
- Echtes Backend: PostgreSQL (Prisma), Better Auth (gehashte Passwörter, HttpOnly-Session-Cookies), serverseitige Mandantentrennung, transaktionale Kontingente, persistenter Worker mit Leases, Scheduler und Publisher.
- **Demo-Modus**: Recherche, KI-Stimme, Schnitt, YouTube-Upload und Zahlung werden sichtbar simuliert – Daten und Abläufe sind aber echt und bleiben nach Reload und Neustart erhalten.
- Vorbereitete Live-Adapter: n8n, ElevenLabs, YouTube Data API, Stripe (siehe [docs/INTEGRATIONEN.md](docs/INTEGRATIONEN.md)).
- Zusätzlich: **Shopify-Section-Paket** unter [`shopify/`](shopify/INSTALLATION.md) bzw. `quest-agent-shopify-sections.zip` (kein vollständiges Theme).

## Schnellstart A – Docker Compose (empfohlen)

Voraussetzung: Docker mit Compose v2.

```bash
docker compose up --build
```

- App: http://localhost:3000 – Demo-Einstieg: http://localhost:3000/demo
- Compose startet PostgreSQL, führt Migrationen und das Demo-Seeding aus (`migrate`), startet App und Worker.
- Daten liegen im Volume `pgdata` und überstehen Neustarts (`docker compose restart`).
- Compose läuft bewusst im Demo-Modus – **nicht** für den Produktivbetrieb.

## Schnellstart B – ohne Docker (Node 22 + PostgreSQL 16)

```bash
cp .env.example .env            # Werte prüfen, BETTER_AUTH_SECRET setzen
# Datenbank anlegen (Beispiel): createuser -P quest && createdb -O quest quest_agent
npm ci
npm run setup                   # prisma generate + migrate deploy + Demo-Seed (idempotent)
npm run build
npm run start                   # App auf http://localhost:3000
npm run worker                  # zweites Terminal: Worker (Jobs, Scheduler, Veröffentlichung)
```

Für die Entwicklung statt `build`/`start`: `npm run dev`.

## Demo-Konten (nur lokal, nur mit `DEMO_MODE=true`)

| Konto | E-Mail | Zweck |
| --- | --- | --- |
| Demo-Kundin | `kunde@demo.questagent.local` | Studio-Plan, zwei Systeme, Aufträge in allen Zuständen |
| Zweiter Kunde | `zweiter@demo.questagent.local` | Eigener Mandant zum Prüfen der Datentrennung |
| Admin | `admin@demo.questagent.local` | Admin-Bereich |

Passwort: Wert von `DEMO_PASSWORD` (Standard in `.env.example`: `QuestDemo-2026!`). Bequemer: http://localhost:3000/demo. Ohne `DEMO_MODE=true` legt das Seed keine Demo-Konten an und der Demo-Einstieg ist deaktiviert. `npm run db:seed -- --reset` baut **nur** die Demo-Konten neu auf (echte Konten bleiben unberührt).

## Kernabläufe zum Ausprobieren

1. **Funnel:** Startseite → Konfigurator („Mit diesem Setup starten“) → Registrierung → Demo-Abo aktivieren → Wizard ist vorbefüllt → System speichern.
2. **Produktion:** System öffnen → „Auftrag anlegen“ (Demo-Szenarien: normal, technischer Fehler mit Wiederholung, dauerhafter Providerfehler) → Live-Status aus dem Backend.
3. **Freigabe:** Freigaben → Ergebnis öffnen → Video/Short abspielen, Texte bearbeiten (neue Version), Termin wählen → „Freigeben & einplanen“.
4. **Veröffentlichung (simuliert):** Kalender → „Fällige Demo-Jobs ausführen“ (Demo-Zeitsteuerung) → der Worker simuliert die Veröffentlichung. Ohne Freigabe wird auch bei fälligem Slot nichts veröffentlicht.
5. **Abo:** Plan wechseln, kündigen, Verlängerung fehlschlagen lassen, Periode beenden – alles simuliert und persistent.

## Tests

```bash
npm test               # Vitest: 59 Backend-Tests auf je Lauf neu angelegter Test-DB (quest_agent_test_run_*)
npm run typecheck
npx playwright test    # 21 E2E-Tests gegen laufende App (+ Worker; startet ggf. selbst) – setzt nur Demo-Konten zurück
```

Ergebnisse und Befehle: [docs/PRUEFBERICHT.md](docs/PRUEFBERICHT.md). Screenshots der tatsächlichen Umsetzung: [`docs/screenshots/`](docs/screenshots/).

## Projektstruktur

```text
app/                 Next.js App Router: (marketing), (auth), app/ (Kundenbereich), admin/, api/
components/          UI: marketing/, app/, ui/, art/ (SVG-Motive), brand/, theme/
lib/                 Domäne: Auth, Mandanten, Kontingente, Zustandsautomat, Freigaben, Zeit/DST, Billing …
providers/           Verträge + Demo-Adapter + n8n, ElevenLabs, YouTube, Stripe
worker/              Worker-Prozess: Pipeline, Scheduler, Publisher
prisma/              Schema, Migrationen, Seed
storage/fixtures/    Demo-Medien mit Herkunftsnachweis (HERKUNFT.md)
tests/unit|e2e/      Vitest und Playwright
shopify/             Section-Integrationspaket + INSTALLATION.md
docs/                INTEGRATIONEN, PRUEFBERICHT, ANNAHMEN, Screenshots
scripts/             Demo-Medien, Szenen-Export, ZIP-Erstellung
```

## Weitere Dokumente

- [docs/INTEGRATIONEN.md](docs/INTEGRATIONEN.md) – was lokal funktioniert, was simuliert ist, was für Live-n8n, ElevenLabs, YouTube, Zahlungen fehlt; Hosting und Kosten.
- [docs/ANNAHMEN.md](docs/ANNAHMEN.md) – offene Produktentscheidungen und Kostenpunkte.
- [docs/PRUEFBERICHT.md](docs/PRUEFBERICHT.md) – ausgeführte Befehle und Ergebnisse.
- [shopify/INSTALLATION.md](shopify/INSTALLATION.md) – Einbau der Section in eine Theme-Kopie.

## Hinweise

- Quest Agent ist ein unabhängiges Produkt und steht in keiner Verbindung zu YouTube oder Google.
- Keine Garantie für Reichweite, Einnahmen oder eine Zulassung zum YouTube-Partnerprogramm.
- Rechtstexte (Impressum, Datenschutz, AGB) sind **Entwürfe mit markierten Lücken**.
- Keine öffentlichen Deployments, echten Uploads, Zahlungen oder Änderungen an produktiven n8n-Workflows wurden vorgenommen.
