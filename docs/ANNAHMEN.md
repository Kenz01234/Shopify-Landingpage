# Annahmen und offene Entscheidungen

Diese Punkte sind im Code als **konfigurierbare Annahmen** umgesetzt (`lib/plans.ts`, Admin-Bereich „Konfiguration & Annahmen“). Sie sind **keine endgültigen Konditionen** und dürfen nicht als solche beworben werden.

## Pakete (vorläufig, exakt wie vorgegeben)

| Plan | Monatspreis | Longform | Shorts |
| --- | ---: | --- | ---: |
| Starter | 60 € | 15 Videos à 7 Minuten | 30 |
| Studio | 100 € | 30 Videos à 10 Minuten | 30 |

Rechnerisch: Starter 105 Longform-Minuten (≈ 0,57 € je Minute), Studio 300 Longform-Minuten (≈ 0,33 € je Minute) – also rund 2,86-mal die Minuten für 1,67-mal den Preis. **Die tatsächlichen Produktionskosten pro Minute (Rendering, Stimme, Modelle, Speicher) sind vor einem bezahlten Launch zu messen.**

## Offene Produktentscheidungen

| Thema | Umsetzung in dieser Version (Annahme) | Zu entscheiden |
| --- | --- | --- |
| Steuerdarstellung | Preise ohne Angabe „brutto/netto“ | Brutto/Netto, Kleinunternehmerregelung, Reverse Charge |
| Maximale Shorts-Länge | 15–60 Sekunden | Tatsächliches Limit je Plan |
| Systeme pro Konto | höchstens 5 aktive Systeme | Anzahl Kanäle/Systeme je Plan |
| Kanalzuordnung | ein YouTube-Kanal je Organisation | Mehrere Kanäle je Konto? |
| Überarbeitungen | max. 2 pro Auftrag, ohne zusätzliches Kontingent | Anzahl, ggf. kostenpflichtige Zusatzrevisionen |
| Kontingentverbrauch | Reservierung beim Anlegen, Verbrauch bei Fertigstellung der ersten finalen Version; Abbruch/Verwerfen **vor** Fertigstellung gibt frei, danach bleibt verbraucht | Ob verworfene fertige Videos zählen |
| Technische Wiederholungen | zählen nie doppelt | – |
| Übertrag ungenutzter Mengen | nein, Verfall zum Periodenende | Übertrag ja/nein, Obergrenze |
| Abrechnungszeitraum | ab Abo-Beginn, monatlich (nicht Kalendermonat) | Jahresabo? |
| Planwechsel | Upgrade sofort (Kontingent wird angehoben), Downgrade zum Periodenende | Anteilige Berechnung (Proration) |
| Kündigung | zum Ende des laufenden Zeitraums, zurücknehmbar | Mindestlaufzeit, Kündigungsfrist |
| Zahlungsausfall | „Zahlung offen“: keine neue Produktion, Veröffentlichungen zurückgehalten | Karenzzeit, Mahnlauf |
| Wartezeiten | Planungshorizont 7 Tage im Voraus | Produktionsvorlauf je Slot, SLA |
| Pausieren | keine neuen Zyklen; geplante Veröffentlichungen werden zurückgehalten; verstrichene Termine brauchen neue Bestätigung | – |
| Verpasster Slot ohne Freigabe | nie veröffentlichen; nächster freier Slot wird vorgeschlagen und muss bestätigt werden | – |
| Verspätete Veröffentlichung (z. B. Worker-Ausfall) | über 60 Minuten nach dem Termin wird nicht mehr automatisch veröffentlicht, sondern neu bestätigt | Toleranz |
| Mindestvorlauf für Termine | 2 Minuten | – |
| Termine in der Zukunft | höchstens 180 Tage | – |
| Freigabemodus | finale Freigabe immer Pflicht; optional Thema oder Skript vorab | – |
| KI-Kennzeichnung | Beschreibungen erhalten einen Hinweis auf KI-Unterstützung; YouTube-Flag `containsSyntheticMedia` im Live-Adapter | Rechtlich/plattformseitig prüfen |
| Rechte an Material | Quellen und Material mit Rechtestatus; unbekannt bleibt unbekannt | Prozess für Lizenzklärung, Haftung |
| Zeitzonen | Standard Europe/Berlin, je System änderbar; Speicherung in UTC; Sommerzeit-Lücke → +1 h, doppelte Zeit → erstes Auftreten | – |
| E-Mail-Verifizierung | aus (kein Mailversand angebunden) | Anbieter, Pflicht zur Verifizierung |
| Rechtstexte | Entwürfe mit markierten Lücken | Unternehmensdaten, rechtliche Prüfung |

## Verkaufsweg

- **Annahme:** Verkauf in der eigenen App (Stripe-Adapter vorbereitet). Die Shopify-Section verlinkt konfigurierbar auf die App oder auf echte Shopify-Abo-Produkte.
- **Nicht beides parallel:** Wird Shopify als Abrechnungsplattform gewählt, braucht es eine Abo-App (Selling Plans) und eine serverseitige Synchronisierung der Berechtigungen – nicht umgesetzt.

## Kosten, die vor dem Launch zu klären sind

Hosting (VM/Container, Datenbank), Speicher/Bandbreite, Rendering, KI-Stimme, Sprachmodelle, E-Mail, Zahlungsgebühren, n8n-Lizenz (Enterprise/OEM), ggf. Shopify-Plan und Abo-App. Details und Abgrenzung in [INTEGRATIONEN.md](INTEGRATIONEN.md#kostenpunkte-getrennt-keine-erfundenen-zahlen).

## Marken und Aussagen

- Eigenes Logo (Schleife mit Abspiel-Dreieck und „rotem Faden“), kein umgestaltetes YouTube-Logo, keine behauptete Partnerschaft.
- Keine Erfolgsgeschichten, Umsatzzahlen, Reichweiten- oder Einnahmengarantien. Die Monetarisierung wird als mögliches Ziel beschrieben, nicht als Versprechen.
- „Unbegrenzt“ wird nirgends verwendet; Kontingente sind überall begrenzt.
