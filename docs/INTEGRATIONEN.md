# Integrationen – Stand, Simulation und nächste Schritte

Stand: 27.09.2026. Diese Datei trennt klar zwischen **lokal funktionsfähig**, **simuliert** und **vorbereitet, aber ungetestet**. Es liegen keine echten Zugangsdaten, n8n-Endpunkte, Workflow-Exports, OAuth-Konfigurationen oder Zahlungsprodukt-IDs vor – keine davon wurde erfunden.

## Überblick

| Bereich | Lokal (Demo-Modus) | Live-Adapter im Code | Live getestet? | Was für den Live-Betrieb fehlt |
| --- | --- | --- | --- | --- |
| Konto, Mandanten, Rollen | **echt** (Better Auth, PostgreSQL) | – | lokal getestet | E-Mail-Versand (Verifizierung, Passwort-Reset), Rechtstexte |
| Systeme, Wizard, Kalender, Kontingente, Freigaben | **echt** | – | lokal getestet | – |
| Worker (Jobs, Scheduler, Publisher) | **echt**, Produktionsschritte simuliert | `worker/` | lokal getestet | Betrieb als Dienst (systemd/Container), Monitoring |
| Recherche/Skript/Schnitt | **simuliert** (`providers/demo/production.ts`) | `providers/n8n.ts` + `app/api/webhooks/n8n` | Vertrag lokal mit signierten Test-Callbacks getestet, **kein** echter n8n-Aufruf | Webhook-URL, gemeinsames Geheimnis, n8n-Workflow, der den Vertrag erfüllt; Lizenzklärung |
| KI-Stimme | **simuliert** (lokale Piper-Hörproben, CC0-Datensätze) | `providers/elevenlabs.ts` | **ungetestet** | API-Schlüssel, Modell-ID, Voice-ID-Auswahl |
| Veröffentlichung YouTube | **simuliert** (`status = simulated`) | `providers/youtube.ts` + `app/api/connections/[platform]` | **ungetestet** | Google-Cloud-Projekt, OAuth-Client, ggf. Verifizierung/Audit, ausdrücklich freigegebener Live-Test |
| Veröffentlichung Instagram (Reels) | **simuliert** | `providers/instagram.ts` + signierte Medienlinks (`app/api/public-media`) | **ungetestet** | Meta-App mit Instagram-Login, App Review, Instagram-Professional-Konto, öffentlich erreichbare HTTPS-`APP_URL` |
| Veröffentlichung TikTok | **simuliert** | `providers/tiktok.ts` | **ungetestet** | TikTok-Developer-App mit Content Posting API (Direct Post), App-Audit (sonst nur private Beiträge), UX-Vorgaben von TikTok |
| Zahlung | **simuliert** (Demo-Billing) | `providers/stripe.ts` + `app/api/webhooks/stripe` | Signaturprüfung/Idempotenz/Reihenfolge lokal mit Stripe-SDK-Testsignaturen getestet, **kein** API-Aufruf | Stripe-Testschlüssel, Preis-IDs, Webhook-Endpunkt; später Live-Freigabe |
| Telegram | – | – | – | bewusst nicht gebaut (späterer Zugang) |
| Discord, Windows-EXE | – | – | – | nicht beauftragt, nicht gebaut |
| Shopify-Theme | Theme bzw. Section-Paket | `shopify/`, `npm run shopify:check` | Theme Check, Upload-Regeln, Style-Isolation und Editor-Simulation lokal; **nicht** in einem echten Shop | Theme hochladen und im echten Editor prüfen |
| Shopify als Verkaufsweg | Webhook-Verarbeitung lokal mit selbst signierten Test-Webhooks getestet | `lib/billing/shopify.ts` + `app/api/webhooks/shopify` | **kein** echter Shop-Webhook | Abo-Produkte (z. B. Shopify Subscriptions), Webhooks `orders/paid` + `orders/cancelled`, Signaturschlüssel, SKU-Zuordnung, gehostete App, E-Mail-Verifizierung |

Umschalten erfolgt ausschließlich über Umgebungsvariablen (`PRODUCTION_PROVIDER`, `VOICE_PROVIDER`, `PUBLISH_PROVIDER` für YouTube, `INSTAGRAM_PROVIDER`, `TIKTOK_PROVIDER`, `BILLING_PROVIDER`) – je Plattform einzeln. Demo- und Live-Adapter erfüllen dieselben Verträge (`providers/types.ts`). Fehlende Konfiguration führt zu einer verständlichen Fehlermeldung – nie zu einem stillen „Erfolg“.

## n8n

**Grundsatz:** Quest Agent ruft einen vom Betreiber konfigurierten Webhook auf. Es wird **keine Workflow-ID angenommen** und **kein produktiver Workflow verändert**. Telegram/Saskia, Radar und Mara aus früheren Unterlagen sind kein aktueller Live-Nachweis und in dieser Version nicht angebunden.

### Auftrag an n8n (App → n8n)

`POST {N8N_JOB_WEBHOOK_URL}`

Header:

- `content-type: application/json`
- `x-quest-timestamp: <Unix-Sekunden>`
- `x-quest-signature: sha256=<HMAC-SHA256(N8N_SHARED_SECRET, "<timestamp>.<body>")>`
- `idempotency-key: <Auftragsschlüssel>:a<Versuch>:r<Revision>`

Body (gekürzt):

```json
{
  "jobId": "cm…",
  "orgId": "cm…",
  "systemId": "cm…",
  "format": "longform",
  "attempt": 0,
  "revision": 0,
  "revisionNote": null,
  "config": { "niche": "Weltall & Wissen", "audience": "…", "language": "de", "tone": "spannend", "style": "doku",
              "voiceKey": "<ElevenLabs-Voice-ID>", "longformMinutes": 10, "shortSeconds": 45,
              "reviewMode": "final_only", "referenceChannels": ["https://www.youtube.com/@…"], "configVersion": 3 },
  "topic": null,
  "script": null,
  "callbackUrl": "https://<APP_URL>/api/webhooks/n8n"
}
```

**Nur diese Antwort zählt als Start:** HTTP 2xx mit `{ "accepted": true, "runId": "<eindeutig>" }`. „HTTP-Aufruf gesendet“ allein ist kein Start. 401/403 → dauerhafter Fehler; 429/5xx/Timeout → begrenzte Wiederholung mit Backoff.

### Rückmeldungen (n8n → App)

`POST {APP_URL}/api/webhooks/n8n` mit derselben Signatur (Zeitfenster ±5 Minuten).

```json
{ "eventId": "eindeutig-je-meldung", "jobId": "cm…", "runId": "<aus der Annahme>", "seq": 1, "type": "status", "status": "scripting" }
{ "eventId": "…", "jobId": "cm…", "runId": "…", "seq": 4, "type": "result",
  "result": { "topic": "…", "title": "…", "description": "…", "script": "…", "tags": ["…"], "thumbnailText": "…",
              "sources": [{ "id": "s1", "type": "fact", "title": "…", "url": "https://…", "rightsStatus": "not_applicable" },
                          { "id": "m1", "type": "footage", "title": "…", "rightsStatus": "unknown" }],
              "media": [{ "kind": "video", "url": "https://cdn.example/…mp4", "durationSec": 598, "rightsStatus": "own_production" }] } }
{ "eventId": "…", "jobId": "cm…", "runId": "…", "seq": 2, "type": "error", "error": { "code": "TTS", "message": "…", "retryable": true } }
```

Verarbeitung (`lib/webhooks/n8n.ts`, getestet in `tests/unit/webhooks.test.ts`):

- Doppelte `eventId` → `200 { duplicate: true }`, keine zweite Wirkung.
- Fremder/alter `runId` → ignoriert (veralteter Lauf). `seq` ≤ zuletzt verarbeitet → ignoriert (verspätet/vertauscht).
- Abgebrochene oder bereits abgeschlossene Aufträge → ignoriert.
- `result` → Status `quality_check`; der Worker lädt Medien **kontrolliert** (nur `https`, nur Hosts aus `ASSET_DOWNLOAD_ALLOWED_HOSTS`, keine privaten Netze, keine Weiterleitungen, Größenlimit) und erstellt die Inhaltsversion. Texte aus fremden Quellen werden nie als Anweisungen ausgeführt.
- `error` → gleiche Wiederholungslogik wie intern; es wird **kein** Kontingent neu gebucht.
- Keine Rückmeldung innerhalb `N8N_EXTERNAL_TIMEOUT_MIN` → Auftrag „fehlgeschlagen“, manuell wiederholbar.

### Lizenz

Die offizielle n8n-OEM-Seite (https://n8n.io/oem/) ordnet laut den mitgelieferten Unterlagen die Nutzung als Backend einem Enterprise-Modell und das Einbetten des Editors dem OEM-Angebot zu. **Vor einem bezahlten Kundensystem ist die Lizenz verbindlich mit n8n zu klären.** Die Community Edition ist nicht pauschal als kostenpflichtiges Kundensystem weiterverkaufbar. Die lokale Demo nutzt n8n gar nicht.

## ElevenLabs

- Endpunkte im Adapter: `GET https://api.elevenlabs.io/v2/voices`, `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` mit Header `xi-api-key` und Body `{ text, model_id }`.
- Schlüssel ausschließlich serverseitig (`ELEVENLABS_API_KEY`), nie im Browser, nie in Logs.
- Voice-IDs nur aus der API bzw. der Allowlist `ELEVENLABS_VOICE_IDS`. Es werden keine Voice-IDs aus Lizenz- oder Modellnamen abgeleitet. Die Modell-ID muss gesetzt werden (`ELEVENLABS_MODEL_ID`).
- „Verbindung prüfen“ unter *Verbindungen* ruft `/v2/voices` auf, ohne den Schlüssel preiszugeben.
- Kombination möglich: `PRODUCTION_PROVIDER=demo` + `VOICE_PROVIDER=elevenlabs` vertont Demo-Skripte echt (verbraucht ElevenLabs-Kontingent).
- **Status: ungetestet.** Die offizielle Dokumentation war aus dieser Umgebung nicht abrufbar (Netzwerkrichtlinie); die Endpunkte wurden per Websuche gegen die öffentlichen Doku-Seiten abgeglichen (https://elevenlabs.io/docs/api-reference/text-to-speech/convert). Vor Livegang erneut prüfen.

## YouTube

- **OAuth 2.0** (Authorization Code, `access_type=offline`, `prompt=consent`), Start unter *Verbindungen* → `POST /api/connections/youtube/start`, Rückkehr über `GET /api/connections/youtube/callback` mit `state`-Prüfung (HttpOnly-Cookie). **Es wird nie ein Google-Passwort abgefragt.**
- Minimale Scopes: `youtube.upload` (Upload) und `youtube.readonly` (Kanalzuordnung, Abgleich).
- Tokens werden mit AES-256-GCM (`CREDENTIALS_ENCRYPTION_KEY`) verschlüsselt je Kunde gespeichert. Ablauf → Refresh; `invalid_grant` → Status „Zugriff widerrufen“, Veröffentlichungen werden zurückgehalten.
- Upload erst zum freigegebenen Termin per Resumable Upload (`snippet,status`, `privacyStatus: public`, `selfDeclaredMadeForKids: false`, `containsSyntheticMedia: true`).
- **Keine blinden Wiederholungen:** Nach Start der Upload-Sitzung gilt jede unklare Antwort als `reconciling`. Der Abgleich sucht in den letzten Uploads des Kanals nach der Markierung (Tag `qa-<id>`). Nicht gefunden → „fehlgeschlagen“ mit Hinweis, bewusst neu einzuplanen. Ein Worker-Absturz während `publishing` führt ebenfalls zu `reconciling`, nie zu einem zweiten Upload.
- Vor jedem Upload werden aktive Berechtigung (Abo), gültige Freigabe genau dieser Version, Kanalzuordnung, Slot und Systemstatus erneut geprüft.
- Hinweise aus der Recherche (Websuche; die offizielle Seite https://developers.google.com/youtube/v3/docs/videos/insert war aus dieser Umgebung nicht abrufbar): Uploads aus **nicht verifizierten** API-Projekten (nach 28.07.2020 erstellt) werden auf „privat“ beschränkt, bis ein Audit erfolgt ist. Laut Sekundärquellen wurde die Quota-Berechnung für `videos.insert` 2025/2026 geändert (eigener Upload-Topf) – **vor dem Livegang in der offiziellen Revision History prüfen**.
- **Status: ungetestet. Keine echten Uploads.** Ein Live-Test braucht eine ausdrückliche Freigabe.

## Mehrere Plattformen (YouTube, Instagram, TikTok)

- Longform geht immer zu **YouTube**. Shorts gehen je System wahlweise zu **YouTube Shorts**, **Instagram Reels** und **TikTok** (Wizard, Schritt 3). Jeder Auftrag speichert die Auswahl im Konfigurations-Snapshot; spätere Änderungen gelten nur für neue Aufträge.
- Eine Freigabe plant **eine** Veröffentlichung (Termin, Slot, Freigabe) mit **einem Ziel je Plattform** (`PublicationTarget`). Jede Plattform hat eigenen Status, eigene Beitrags-ID und eine sofort gespeicherte Upload-ID (Instagram-Container, TikTok-`publish_id`).
- Der Worker veröffentlicht Plattform für Plattform. Unklare Antworten und Abstürze führen zum **Abgleich**, nie zu einem zweiten Upload; offene Plattformen werden danach fortgesetzt. Schlägt eine Plattform fehl, bleiben die anderen veröffentlicht; „Erneut versuchen“ wiederholt **nur** die fehlgeschlagenen.
- Ein Short zählt **einmal** im Kontingent, egal auf wie vielen Plattformen er erscheint (Annahme, siehe ANNAHMEN.md).
- Beitragstext für Instagram/TikTok: eigenes Feld in der Freigabe (max. 2.200 Zeichen); leer = aus Titel und Tags abgeleitet. n8n kann optional `caption` liefern.
- Demo: Verbindungen und Veröffentlichungen je Plattform werden simuliert; Szenario „Instagram lehnt den Upload ab“ beim manuellen Short.

## Instagram (Reels)

- **Instagram API mit Instagram-Login** (`graph.instagram.com`, Version über `INSTAGRAM_GRAPH_VERSION`). OAuth: `https://www.instagram.com/oauth/authorize` → Token-Tausch → Langzeit-Token (ca. 60 Tage, wird vor Ablauf verlängert). Scopes: `instagram_business_basic`, `instagram_business_content_publish`. Nur **Professional-Konten** (Business/Creator).
- Ablauf: Container anlegen (`POST /{ig-user-id}/media`, `media_type=REELS`, `video_url`, `caption`) → Status abfragen (`GET /{container-id}?fields=status_code` bis `FINISHED`) → `POST /{ig-user-id}/media_publish` mit `creation_id`. Status `ERROR`/`EXPIRED` → fehlgeschlagen; noch in Arbeit → Abgleich übernimmt.
- Instagram lädt das Video **selbst herunter**: dafür erzeugt die App einen **signierten, befristeten Link** (`/api/public-media/<token>`, 2 Stunden, HMAC). `APP_URL` muss öffentlich per HTTPS erreichbar sein.
- Quelle: Meta-Dokumentation „Publish Content using the Instagram Platform“ (https://developers.facebook.com/docs/instagram-platform/content-publishing/) – aus dieser Umgebung nicht direkt abrufbar, Ablauf per Websuche bestätigt. Tageslimit für Veröffentlichungen und App-Review-Anforderungen **vor dem Livegang in der aktuellen Doku prüfen**.
- **Status: ungetestet. Keine echten Beiträge.**

## TikTok

- **Content Posting API, Direct Post** mit `FILE_UPLOAD`: `creator_info/query` → `video/init` (Stückelung 5–64 MB, letztes Stück bis 128 MB, Dateien unter 5 MB am Stück) → `PUT` auf die `upload_url` → `status/fetch` bis `PUBLISH_COMPLETE`. OAuth über `https://www.tiktok.com/v2/auth/authorize/`, Scopes `user.info.basic`, `video.publish`; Token laufen nach 24 h ab und werden per Refresh-Token erneuert.
- **Wichtig:** Solange TikTok die App nicht geprüft hat, sind Beiträge nur **privat** sichtbar (`SELF_ONLY`) – deshalb ist `TIKTOK_PRIVACY_LEVEL=SELF_ONLY` der Standard. TikTok verlangt für geprüfte Apps, dass Nutzer:innen die Sichtbarkeit selbst wählen und Hinweise zu kommerziellen Inhalten bestätigen; diese Auswahl muss vor dem Livegang in der Freigabe ergänzt werden.
- Quellen: TikTok for Developers, „Direct Post“ (https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) und „Media Transfer Guide“ (https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide) – per Websuche geprüft.
- **Status: ungetestet. Keine echten Beiträge.**

## Shopify als Verkaufsweg

- Kunden kaufen **Starter** oder **Studio** im Shop (empfohlen als Abo-Produkt, z. B. mit der App „Shopify Subscriptions“). Der Kauf schaltet den Plan in der App frei – **der Zugang entsteht nie über den Browser**, sondern nur über signaturgeprüfte Webhooks an `POST /api/webhooks/shopify`:
  - `orders/paid` → Plan über SKU oder Varianten-ID (`SHOPIFY_PLAN_STARTER`, `SHOPIFY_PLAN_STUDIO`, kommagetrennt; Studio schlägt Starter), Zeitraum ab Zahlung + 1 Monat. Folgebestellungen eines Abos verlängern; verspätete ältere Bestellungen ändern nichts.
  - `orders/cancelled` → beendet den Zugang, wenn der aktuelle Zeitraum aus dieser Bestellung stammt. Erstattungen (`refunds/create`) werden bewusst **nicht** automatisch verarbeitet – bitte manuell prüfen.
- Echtheit: HMAC-SHA256 über den unveränderten Body (`X-Shopify-Hmac-Sha256`, Schlüssel `SHOPIFY_WEBHOOK_SECRET`) und erwartete Shop-Domain (`SHOPIFY_SHOP_DOMAIN`). Idempotenz über `X-Shopify-Webhook-Id` und je Bestellung.
- Zuordnung über die E-Mail-Adresse der Bestellung – **nur zu Konten mit bestätigter E-Mail** (im lokalen Demo-Modus gelockert). Wer vor der Registrierung kauft, bekommt den Plan beim Registrieren bzw. beim Bestätigen der E-Mail. **Voraussetzung für den Livebetrieb: E-Mail-Versand und -Bestätigung einrichten.**
- Über den Shop gekaufte Abos zeigt die App an; Planwechsel und Kündigung verweisen auf das Kundenkonto des Shops (keine doppelte Verwaltung).
- Einrichtung im Shop: Webhooks unter *Einstellungen → Benachrichtigungen → Webhooks* für „Bestellungszahlung“ und „Bestellungsstornierung“ (Format JSON) auf `https://<app-domain>/api/webhooks/shopify`; der dort angezeigte Signaturschlüssel ist `SHOPIFY_WEBHOOK_SECRET`.
- **Status:** lokal mit selbst signierten Test-Webhooks getestet (Signatur, Shop-Domain, Duplikate, Plan-Erkennung, Kauf vor Registrierung, Verlängerung, Stornierung). **Nicht** mit einem echten Shop.
- **Nicht parallel mit Stripe:** Bei aktivem Stripe-Abo wird ein Shop-Kauf nicht automatisch übernommen, sondern als Hinweis gemeldet.

## Stripe

- Checkout (`mode: subscription`, `client_reference_id = orgId`, Metadaten), Kundenportal für Planwechsel/Kündigung/Zahlungsdaten.
- **Zugang entsteht nie über eine Browser-Erfolgs-URL.** Maßgeblich sind signaturgeprüfte Webhooks (`POST /api/webhooks/stripe`):
  - `customer.subscription.created|updated|deleted` → Status, Plan (über Preis-ID), Periode, `cancel_at_period_end` übernehmen.
  - `checkout.session.completed` → nur Verknüpfung Organisation ↔ Stripe-Kunde.
  - `invoice.paid` / `invoice.payment_failed` → informativ; der Status folgt über `customer.subscription.updated`.
- Idempotenz über `event.id` (Tabelle `WebhookEvent`), Reihenfolgeschutz über `event.created` (ältere Ereignisse werden ignoriert).
- Seit API-Version **2025-03-31 („basil“)** liegen `current_period_start/end` an den Subscription-Items; der Adapter liest dort (mit Rückfall auf das alte Feld). Quelle: Stripe-Changelog (https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end), per Websuche geprüft.
- Live-Schlüssel (`sk_live_…`) sind blockiert, solange nicht bewusst `ALLOW_STRIPE_LIVE=true` gesetzt wird.
- **Status:** Webhook-Verarbeitung lokal mit `stripe.webhooks.generateTestHeaderString` getestet (Signatur, Duplikat, Reihenfolge, `past_due`). **Nicht** gegen die Stripe-API getestet – es liegen keine Testschlüssel vor.
- **Keine parallele Abrechnung über Shopify und Stripe.** Es ist genau ein Verkaufsweg zu wählen.

### Demo-Billing-Regeln (lokal)

Upgrade sofort (Kontingent der laufenden Periode wird angehoben), Downgrade zum Periodenende, Kündigung zum Periodenende (zurücknehmbar), simulierte fehlgeschlagene Verlängerung → „Zahlung offen“ (keine neue Produktion, Veröffentlichungen werden zurückgehalten), „Zahlung nachholen“ → aktiv mit neuer Periode. Perioden richten sich nach dem Abo-Beginn, nicht nach dem Kalendermonat.

## Sicherheit (Kurzüberblick)

- Mandantentrennung: jede Abfrage filtert serverseitig nach der Organisation der Session; fremde IDs führen zu 404. Getestet in `tests/unit/tenancy.test.ts` und `tests/e2e/isolation.spec.ts`.
- Schreibende API-Aufrufe prüfen die Herkunft (Same-Origin, CSRF-Schutz); Session-Cookies sind HttpOnly, `SameSite=Lax`, bei HTTPS `Secure`.
- Admin-Routen prüfen die Rolle serverseitig (Nicht-Admins erhalten 404).
- Geheimnisse nur serverseitig; Frontend-Bundle wurde auf Geheimnisse geprüft (siehe Prüfbericht).
- Sicherheits-Header (u. a. `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Referenzkanäle werden nur syntaktisch validiert – im Demo-Modus finden keine externen Abrufe statt.

## Hosting und Betrieb

- **Empfehlung für den Start:** eine VM oder Container-Umgebung mit Node 22, PostgreSQL 16 und einem dauerhaft laufenden Worker-Prozess (z. B. per `compose.yaml` oder systemd). Die Domain kann bei Cloudflare bleiben (DNS, optional Proxy/TLS vor der App).
- **Nicht** als statische Cloudflare-Seite deploybar: Die App braucht PostgreSQL, einen Node-Server und einen Worker. Ein echtes Cloudflare-Workers-Ziel würde andere Adapter, Treiber und Laufzeitgrenzen erfordern und wurde nicht umgesetzt. Die Marketingseite ließe sich später separat statisch hosten.
- Keine Domain- oder DNS-Einstellung wurde verändert. Nichts wurde öffentlich deployt.

### Kostenpunkte (getrennt; keine erfundenen Zahlen)

| Posten | Hinweis |
| --- | --- |
| Website/Domain (Cloudflare) | Laut mitgelieferten Unterlagen: statische Assets kostenlos, Workers Paid ab 5 US-Dollar/Monat (Stand der Unterlagen). |
| Shopify (falls genutzt) | Laut mitgelieferten Unterlagen: Basic 36 €/Monat bzw. 27 €/Monat bei jährlicher Zahlung; Abo-App ggf. zusätzlich. |
| VM/Container für App + Worker | Anbieterabhängig – zu messen/anzufragen. |
| PostgreSQL (verwaltet oder selbst betrieben) | Anbieterabhängig. |
| Speicher/Bandbreite für Medien | Abhängig von Videolängen und Aufbewahrung. |
| Rendering (Video/Shorts) | Größter variabler Posten – vor bezahltem Launch pro Video messen. |
| KI-Stimme (ElevenLabs) | Zeichenkontingent je Plan des Betreibers. |
| Sprachmodelle/Recherche | Abhängig vom n8n-Workflow. |
| n8n-Lizenz | Vor Live-Verkauf klären (siehe oben). |
| E-Mail-Versand | Für Verifizierung/Benachrichtigungen noch nicht eingebunden. |
| Zahlungsgebühren (Stripe) | Pro Transaktion laut Stripe-Konditionen. |

Hosting-Kosten sind **nicht** gleich Produktionskosten. Die Starter-/Studio-Preise sind Vorschläge; die Studio-Stufe bietet rechnerisch rund 2,86-mal die Longform-Minuten für 1,67-mal den Preis – die tatsächlichen Produktionskosten pro Minute müssen vor einem bezahlten Launch gemessen werden.
