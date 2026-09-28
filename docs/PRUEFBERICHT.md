# Prüfbericht

Stand: 27.09.2026. Alle Angaben beziehen sich auf Läufe in der lokalen Entwicklungsumgebung dieses Projekts. Nichts davon ist ein öffentliches Deployment. Es wurden **keine** echten Zahlungen, YouTube-Uploads, ElevenLabs-Aufrufe oder Änderungen an einer n8n-Instanz ausgelöst.

Die Einteilung ist streng:

- **Lokal bestanden** = Befehl ausgeführt, Ergebnis gesehen.
- **Ungetestet** = nicht ausgeführt, meist weil Zugangsdaten oder ein echtes Konto fehlen.
- **Offen** = bekannte Einschränkung oder Entscheidung.

## Umgebung

| Komponente | Version |
| --- | --- |
| Node.js | 22.22.2 |
| PostgreSQL (nativ) | 16.13 |
| PostgreSQL (Docker) | `postgres:16-alpine` |
| Docker / Compose | 29.3.1 / v2 |
| Next.js / React | 16.3.6 / 19.3 |
| Prisma | 7.10 (Treiber-Adapter `@prisma/adapter-pg`) |
| Better Auth | 1.7.6 |
| Vitest | 5.0.2 |
| Shopify Theme Check | `@shopify/theme-check-node` 3.29 |
| Playwright | 1.56.1, nur Chromium |
| TypeScript | 5.9 |

## Ausgeführte Befehle und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `npm run typecheck` | ✅ keine Fehler |
| `npm run build` | ✅ Produktions-Build erfolgreich |
| `npm test` (Vitest) | ✅ **59 von 59** Tests in 11 Dateien bestanden, ca. 15 s. Jeder Lauf nutzt eine frisch angelegte Test-Datenbank (`quest_agent_test_run_<Zeitstempel>`), die danach gelöscht wird. |
| `npx playwright test` (gegen `next start` + Worker) | ✅ **21 von 21** Tests bestanden, ca. 2,4 min. Zwei Läufe direkt nacheinander waren beide grün. |
| `npm run setup` auf leerer Datenbank | ✅ Migration `20260927150829_init` und Demo-Seed erfolgreich. Erneuter Aufruf ist idempotent: Seed wird übersprungen, keine Fehler. |
| `npx tsx prisma/seed.ts --reset` bei laufendem Worker, 3× | ✅ ohne Fehler. Danach sind alle Demo-Systeme aktiv und haben keine doppelten Slot-Aufträge. |
| `docker compose up --build` auf leeren Volumes | ✅ `db` gesund, `migrate` hat Migration und Seed ausgeführt, `app` antwortet mit HTTP 200, `worker` läuft (Heartbeat). Hinweis zum Build siehe „Offen“. |
| `docker compose restart` | ✅ ein zuvor im Funnel angelegtes System („Tiefsee Test“) und der Login dieses Kontos waren danach erhalten |
| Nativer Neustart von App und Worker | ✅ Login eines vor dem Neustart angelegten Funnel-Kontos: HTTP 200. System „Tiefsee Test“ ist aktiv, mit 2 Referenzkanälen und 5 Slots. |
| Secret-Suche in `.next/static` | ✅ 0 Treffer für die Werte von `BETTER_AUTH_SECRET`, `DEMO_PASSWORD`, `CREDENTIALS_ENCRYPTION_KEY` und `DATABASE_URL` |
| Secret-Suche in den App- und Worker-Logs | ✅ 0 Treffer für `BETTER_AUTH_SECRET` und `DEMO_PASSWORD` |
| `node scripts/build-project-zip.mjs` + Prüfung des entpackten ZIPs | ✅ 268 Dateien. Enthält kein `.env`, kein `node_modules`, kein `.next` und kein `generated/`. 0 Treffer für den Wert von `BETTER_AUTH_SECRET`. |
| `node scripts/build-shopify-zip.mjs` | ✅ `quest-agent-shopify-sections.zip`, 98 KB |
| `npm run shopify:theme` | ✅ `quest-agent-shopify-theme.zip`: das eigene Theme „Quest Agent“ mit 73 Dateien, 166 KB, hochladbar über „Theme hochladen“ |
| `npm run shopify:theme:check` | ✅ **13 von 13** bestanden, darunter:<br>• Theme Check und Upload-Regeln<br>• Rendern von 28 Seiten<br>• Warenkorb, Abo und Kasse im Browser<br>• Hero-Ablauf und automatischer Loop<br>• klickbares Dashboard mit Chat<br>• Anmelden ohne Datenversand, Suche mit Vorschlägen, Rechtstexte<br>• Handy, ohne JavaScript, Editor-Simulation, Bildrate<br>Einzelheiten in [shopify/INSTALLATION.md](../shopify/INSTALLATION.md#geprüft-weg-a). |
| `npm run shopify:horizon` | ✅ `dist/horizon-quest-agent-theme.zip`, 1,4 MB. Enthält Shopify Horizon 4.2.0 von GitHub und die Section als Startseite. Nur für den eigenen Shop bestimmt (Horizon-Lizenz), daher nicht im Repository. |
| `npm run shopify:check` | ✅ **20 von 20** bestanden (Section-Paket und Horizon). Einzelheiten in [shopify/INSTALLATION.md](../shopify/INSTALLATION.md#geprüft-weg-b-und-c). |

## Abnahmeszenarien (Abschnitt 11 des Auftrags)

| # | Szenario | Status | Nachweis |
| --- | --- | --- | --- |
| 1 | Frischer lokaler Start, Migration und Seed | ✅ lokal bestanden | `npm run setup` auf leerer Datenbank; `docker compose up --build` auf leeren Volumes |
| 2 | Registrierung, Login, Logout, Demo-Einstieg; Demo-Konten nicht im Produktionsbetrieb aktiv | ✅ lokal bestanden | E2E `funnel` (Registrierung), `account` (Passwort-Login und Logout, danach ist `/app` gesperrt), `helpers.demoLogin` (Demo-Einstieg), `a11y` (Fehlermeldungen). Ohne `DEMO_MODE=true` legt der Seed keine Demo-Konten an. In Produktion bricht der Start mit `DEMO_MODE` ab, außer `ALLOW_DEMO_IN_PRODUCTION` ist gesetzt (`lib/env.ts`). |
| 3 | System mit Nische, zwei Referenzkanälen und getrennten Longform- und Shorts-Zeitplänen | ✅ lokal bestanden | E2E `funnel`: Wizard mit „Video-Slots (Longform)“ und „Shorts-Slots“, zwei Kanäle |
| 4 | Nach Reload und Serverneustart bleiben System und Konfiguration erhalten | ✅ lokal bestanden | E2E `funnel` (Reload); nativer Neustart und `docker compose restart` (siehe oben) |
| 5 | Demo-Auftrag läuft über den Worker bis zur Freigabe; Status kommt aus dem Backend | ✅ lokal bestanden | E2E `approval` Test 2 (Worker bis `awaiting_approval`, Kontingent verbucht); Unit `worker.test.ts` |
| 6 | Inhaltsänderung erzeugt eine neue Version und entzieht der alten Freigabe die Gültigkeit | ✅ lokal bestanden | E2E `approval` Test 1 (neue Version); Unit `review.test.ts` („entzieht einer Freigabe die Gültigkeit …“, „lehnt Freigabe einer veralteten Version ab“) |
| 7 | Freigabe plant ein; ohne Freigabe keine Veröffentlichung, auch bei fälligem Slot | ✅ lokal bestanden | E2E `approval` Test 1; Unit `publishing.test.ts` („veröffentlicht ohne Freigabe nichts …“) |
| 8 | Demo-Veröffentlichung nachvollziehbar und sichtbar simuliert; Demo-Zeitsteuerung | ✅ lokal bestanden | E2E `approval` Test 1: Kalender → „Fällige Demo-Jobs ausführen“ → Worker setzt Publication auf `simulated`, Job auf `published` |
| 9 | Pausieren: keine neuen Zyklen, geplante Veröffentlichungen zurückhalten | ✅ lokal bestanden | Unit `publishing.test.ts` („hält … bei pausiertem System zurück“, „pausierte Systeme erzeugen keine neuen Zyklen“); E2E `account` (Pausieren und Fortsetzen über die Oberfläche, bleibt nach Reload erhalten) |
| 10 | Kontingente auch bei parallelen Requests nicht überschreitbar; Wiederholungen buchen nicht doppelt | ✅ lokal bestanden | Unit `quota.test.ts` (40 parallele Reservierungen, Idempotenz, doppeltes Absenden, Retry) |
| 11 | Zweiter Benutzer kann fremde Systeme, Jobs, Medien und Adminfunktionen weder lesen noch ändern, auch nicht per manipulierter URL | ✅ lokal bestanden | E2E `isolation` (404 für fremde Seiten und APIs inkl. Medien und Thumbnails, 404 für Admin, 403 bei fremder Herkunft, 401 ohne Anmeldung); Unit `tenancy.test.ts` |
| 12 | Doppelte Webhooks, verspätete Ergebnisse und Worker-Neustart führen nicht zu doppelten Aufträgen oder Credits | ✅ lokal bestanden | Unit `webhooks.test.ts` (n8n-Duplikate, verspätete und fremde Läufe, Stripe-Idempotenz und Reihenfolge); `worker.test.ts` (abgelaufene Lease nach Absturz, gleichzeitige Claims); `publishing.test.ts` (kein erneuter Upload nach Absturz, Abgleich) |
| 13 | Planwechsel und Kündigung im Demo-Modus bedienbar und persistent; echte Zahlung getrennt | ✅ Demo lokal bestanden · ⚪ echte Zahlung ungetestet | Unit `billing.test.ts`; E2E `funnel` (Demo-Checkout), `account` (Kündigen und Zurücknehmen, bleibt nach Reload erhalten). Stripe-Testmodus siehe „Ungetestet“. |
| 14 | Desktop und Mobil bei 360, 390, 768 und 1440 px; keine abgeschnittene Navigation, kein abgeschnittener Kalender, keine abgeschnittenen Dialoge | ✅ lokal bestanden (mit Einschränkung) | E2E `responsive`: 8 Tests, 9 öffentliche und 11 App-Seiten je Breite ohne horizontalen Überlauf, mobile Menüs bedienbar. Dialoge wurden in diesen Breiten nur stichprobenartig per Screenshot geprüft, nicht systematisch. |
| 15 | Alle sichtbaren Buttons wirken sinnvoll; Tastatur, Fokus, reduzierte Bewegung, Lade- und Fehlerzustände | 🟡 teilweise automatisiert | E2E `a11y`: Skip-Link, Fokus bis zum CTA, Hero bei `prefers-reduced-motion` schrittweise bedienbar, Dunkelmodus bleibt erhalten, Formularfehler. Die Hauptabläufe sind durch die übrigen E2E-Tests abgedeckt. Es gibt **keinen** automatisierten Klick-Test aller Buttons. Nicht angebundene Live-Funktionen sind im Demo-Modus deaktiviert oder als „Demo“ gekennzeichnet. |
| 16 | Keine Secrets im Frontend, in Logs oder im ZIP; Build und Tests ausführen | ✅ lokal bestanden | Secret-Suchen siehe oben; Build, Vitest, Playwright |

## Im Zuge der Prüfung gefundene und behobene Fehler

- **Race zwischen Demo-Seed und laufendem Scheduler.**
  - Symptom: `seed --reset` brach sporadisch mit `Unique constraint failed … ProductionJob_idempotencyKey_key` ab, weil der Scheduler dieselben Slots schon belegt hatte.
  - Fix: Der Seed legt Systeme pausiert an und aktiviert sie erst am Ende.
  - Betrifft auch „Demo zurücksetzen“ im Admin-Bereich bei laufendem Worker.
- **Freigabe-Bestätigung verschwand.**
  - Symptom: „Eingeplant für …“ blitzte nur auf, weil nach dem Neuladen der Daten der Freigegeben-Zustand die Bestätigung ersetzte. Der E2E-Test schlug deshalb in 2 von 3 Gesamtläufen fehl.
  - Fix: Der serverseitige Zustand zeigt jetzt dauerhaft „Eingeplant für &lt;Termin&gt;“.
- **Hero-Animation.** Ein Klick auf „Den Loop entdecken“ während Phase 0 hielt den Timer an. Behoben.
- **Horizontaler Überlauf bei 360 px.** Header-Button, Übersichts-Grid und Buttons ohne Umbruch verursachten Überlauf. Behoben.
- **Seitenleiste im Kundenbereich.** Der Hintergrund endete bei langen Seiten nach einer Bildschirmhöhe. Behoben.
- **Shopify: Theme-Stile drangen in die Section ein.**
  - Symptom: Horizon setzt Schrift, Größe, Farbe und Abstände direkt auf `body`, `h1`–`h4`, `p`, `a`, `ul` und `summary`. Der Style-Vergleich fand 510 bis 549 Abweichungen. Im Dunkel-Schema wären `h3` und `h4` in Horizons Textfarbe erschienen und damit kaum lesbar gewesen.
  - Fix: Alle Regeln sind unter `.qa-section` verankert, dazu kommt eine eigene Typografie-Basis. Danach gibt es 0 Abweichungen.
- **Shopify-Editor: doppelte Instanzen.**
  - Symptom: Bei jedem Neuladen der Section im Theme-Editor lief das Skript erneut. Nach dreimaligem Neuladen gab es 4 parallele Animationen und Listener.
  - Fix: Die Listener werden jetzt nur einmal registriert, und pro Section läuft genau eine Instanz.
- **Shopify-Schriften.** Die Schriftdateien werden jetzt über `asset_url` eingebunden, statt über relative Pfade im CSS.
- **Eigenes Shopify-Theme.** Diese Fehler fanden Screenshots, Browser-Prüfungen in der lokalen Vorschau und die Durchsicht des Codes. Alle sind behoben. Die sichtbaren Fehler prüft `npm run shopify:theme:check` seitdem automatisch:
  - **Header:** Er scrollte mit weg. Ursache war `position: sticky` am inneren Element statt am Shopify-Section-Wrapper.
  - **Roter Faden:** Er lief quer durch Texte und Karten. Jetzt verläuft er nur im freien Rand und wird ausgeblendet, wenn dort kein Platz ist.
  - **Footer:** Die Spalten standen untereinander, weil die Regel `1.4fr repeat(auto-fit, …)` ungültig ist.
  - **Sprungmarken in URL-Feldern:** Werte wie `#preise` in Feldern vom Typ `url` hätte Shopify beim Upload abgelehnt. Diese Felder sind jetzt Textfelder.
  - **Handy – seitliches Scrollen:** Die Startseite war 20 px breiter als der Bildschirm, die Warenkorbseite 31 px. Dadurch wurde das Warenkorb-Panel abgeschnitten. Ursache waren Raster-Spalten ohne `minmax(0, …)`.
  - **Handy – Randabstand:** Seitentitel klebten am Rand, weil `padding` den Container-Innenabstand überschrieb.
  - **Mobiles Menü:** Die Ankündigungsleiste lag darüber und verdeckte den Schließen-Knopf.
  - **Hell/Dunkel:** Der erste Klick wechselte von „System“ zu „Hell“, sichtbar passierte nichts. Jetzt wechselt jeder Klick sichtbar.
  - **Plattform-Handys:**
    - Der Upload-Ring sprang, statt sich zu füllen. Farbverläufe lassen sich nicht animieren, deshalb laufen Ring und Prozentzahl jetzt über `@property`.
    - „online“ erschien schon während des Uploads.
  - **Produktseite:**
    - Eine ausverkaufte Startvariante blockierte die Beschriftung „In den Warenkorb“ für alle Varianten.
    - Der Streichpreis ließ sich nach einem Variantenwechsel nicht einblenden.
- **Rückmeldung aus dem echten Shop (Screenshots des Auftraggebers).** Behoben:
  - **Loop:** Er hakte beim Scrollen und dauerte lange. Er läuft jetzt zeitgesteuert von selbst, ist anklickbar, pausierbar und überspringbar; der lange Scrollweg ist entfallen.
  - **Anmelden:** Der Button führte auf „Hier ist der Faden gerissen“ (404), weil die Seite „Dashboard“ im Shop nicht angelegt war. Jetzt gibt es eine eigene Anmelde-Seite, die ohne Einrichtung funktioniert.
  - **Dashboard:** Nur drei Tabs waren klickbar. Jetzt öffnen sich alle Bereiche der Seitenleiste, dazu kommen Analytics, Agents und Chat. Das Dashboard steht jetzt vor „Ein Short, drei Plattformen“.

## Ungetestet (bewusst, fehlende Zugänge oder Auftrag)

- **n8n live:** kein Workflow und keine Webhook-URL vorhanden. Getestet sind nur der Vertrag (HMAC, Zeitfenster, Idempotenz) und der Demo-Adapter. Die laufende n8n-Produktion wurde nicht angefasst.
- **ElevenLabs:** kein API-Schlüssel. Der Adapter ist geschrieben, wurde aber nie gegen die API ausgeführt.
- **YouTube Data API und Google OAuth:** keine Client-ID. Kein echter Upload.
- **Stripe:** kein Testmodus-Schlüssel. Checkout, Portal und Webhook-Signaturprüfung sind gegen die Stripe-Bibliothek implementiert. Die Webhook-Verarbeitung ist per Unit-Test mit Testereignissen geprüft, die über `stripe.webhooks.generateTestHeaderString` signiert wurden, **nicht** gegen Stripe selbst.
- **Echter Shopify-Shop:** Aus dieser Umgebung gibt es keinen Shopify-Zugang. Deshalb sind nicht verifiziert:
  - Shopifys eigene Validierung beim Hochladen
  - der echte Theme-Editor
  - echte Selling Plans und der Checkout
  - beim Horizon-Weg die Kombination mit Horizons Header und Footer

  Nachgebildet wurde:
  - **Eigenes Theme:** eine lokale Vorschau mit LiquidJS, Beispieldaten und einer nachgebauten Warenkorb-API samt Section Rendering (`npm run shopify:preview`, `npm run shopify:theme:check`).
  - **Section-Paket:** Theme Check auf Horizon plus Section, Upload-Regeln, Horizons CSS samt Scroll-Container und die Editor-Events (`npm run shopify:check`).
- **Andere Browser:** Firefox und Safari/WebKit wurden nicht getestet, nur Chromium.
- **Screenreader:** Tests mit NVDA oder VoiceOver wurden nicht durchgeführt.
- **Lighthouse und Performance-Messung:** nicht durchgeführt. Geprüft wurde im Code nur, dass die Animationen `transform`, `opacity` und beim roten Faden die SVG-Strichlänge (`stroke-dashoffset`) nutzen, also keine Layout-Eigenschaften, und dass sie reduzierte Bewegung respektieren.
- **E-Mail-Versand:** nicht angebunden. Die Verifizierung ist aus.
- **Last- und Dauerbetrieb** mit vielen Mandanten: nicht getestet.

## Offen / Hinweise

- **Docker-Build in dieser Umgebung.** Die Sandbox leitet ausgehenden Verkehr über einen Proxy mit eigener CA. Für den Build wurde deshalb eine temporäre Kopie des `Dockerfile` verwendet. Sie ergänzt nur das CA-Zertifikat und die Proxy-Variablen und wurde mit `--network host` gebaut. Sie liegt nicht im Repository. Das `Dockerfile` im Repository ist sonst identisch, wurde aber ohne diese Ergänzung in dieser Umgebung nicht gebaut.
- **pg-Warnung.** In der Vitest-Ausgabe erscheint `DeprecationWarning: Calling client.query() when the client is already executing a query …` (pg 8).
  - Quelle ist das Zusammenspiel von `@prisma/adapter-pg` und `pg` bei Transaktionen, nicht der Projektcode. Die eigenen Abfragen in `occupiedSlots` laufen bereits sequenziell.
  - Derzeit harmlos. Beim Update auf `pg@9` beobachten.
- **Compose ist nur für lokal gedacht.** `compose.yaml` enthält lokale Standardwerte für `BETTER_AUTH_SECRET` und `CREDENTIALS_ENCRYPTION_KEY` sowie den Demo-Modus. Das ist nicht für einen Produktivbetrieb gedacht.
- **Demo-Medien.** Die Piper-Stimmen basieren laut Modellkarte auf einer englischen Basisstimme. Deren Lizenz ist vor einer kommerziellen Nutzung zu prüfen (siehe `storage/fixtures/HERKUNFT.md`).
- **Offene Produktentscheidungen:** Preise, Steuern, Überarbeitungen und Kontingentregeln siehe [ANNAHMEN.md](ANNAHMEN.md).
- **Rechtstexte** sind Entwürfe mit markierten Lücken.

## Screenshots

Die Screenshots erzeugt `tests/e2e/screenshots.spec.ts` automatisch gegen die laufende App (keine generierten Bilder). Sie liegen unter [`docs/screenshots/`](screenshots/):

| Bereich | Desktop (1440 px) | Mobil (390 px) |
| --- | --- | --- |
| Startseite | `desktop-startseite.png`, `desktop-startseite-dunkel.png` | `mobil-startseite.png` |
| Loop-Demo im Freigabe-Moment | `desktop-startseite-loop-freigabe.png` | `mobil-startseite-loop-freigabe.png` |
| Konfigurator | `desktop-startseite-konfigurator.png` | `mobil-startseite-konfigurator.png` |
| Wizard (Schritt 1, Kanal-Validierung) | `desktop-wizard-schritt1.png`, `desktop-wizard-validierung.png` | `mobil-wizard-schritt1.png`, `mobil-wizard-validierung.png` |
| Freigabe | `desktop-freigabe.png` | `mobil-freigabe.png` |
| Kalender | `desktop-kalender.png` | `mobil-kalender.png` |
| Übersicht, Produktion, Abo | `desktop-uebersicht.png`, `desktop-produktion.png`, `desktop-abo.png` | `mobil-uebersicht.png`, `mobil-produktion.png`, `mobil-abo.png` |
| Shopify-Section mit Horizons CSS (ohne Horizons Header) | `shopify-horizon-desktop-hell.png` | `shopify-horizon-mobil-dunkel.png` |
| Eigenes Shopify-Theme, Startseite (Hero, Loop, Plattformen, Dashboard, Preise) | `shopify-theme-desktop-hell-start-01-hero.png` … `-05-preise.png`, `shopify-theme-desktop-dunkel-start-01-hero.png` | `shopify-theme-mobil-dunkel-start-01-hero.png` |
| Eigenes Shopify-Theme, Anmelde-Seite mit Dashboard-Vorschau | `shopify-theme-desktop-dunkel-anmelden.png` | – |
| Eigenes Shopify-Theme, Produkt (Abo) und Warenkorb-Panel | `shopify-theme-desktop-hell-produkt-abo.png`, `shopify-theme-desktop-dunkel-warenkorb-panel.png` | `shopify-theme-mobil-hell-warenkorb-panel.png` |

## Erneut prüfen

```bash
npm run typecheck && npm test
npm run build && npm run start      # Terminal 1
npm run worker                      # Terminal 2 (Playwright startet sonst selbst einen)
npx playwright test                 # setzt nur die Demo-Konten zurück
```
