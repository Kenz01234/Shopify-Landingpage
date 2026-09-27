# Quest Agent – Shopify-Section installieren

Dieses Paket ist ein **Section-Integrationspaket**, **kein vollständiges Shopify-Theme**. Es lässt sich nicht als Theme importieren, sondern wird in ein bestehendes Online-Store-2.0-Theme (z. B. Dawn) eingebaut. Arbeite immer in einer **Theme-Kopie** und veröffentliche erst nach der Prüfung.

## Inhalt

```text
sections/quest-agent-landing.liquid     Section mit Schema (Texte, Farben, Bilder, Links, Blöcke)
assets/quest-agent.css                  Styles, vollständig unter .qa-section gekapselt
assets/quest-agent.js                   Loop-Animation, Scroll-Einblendungen, Theme-Editor-Events
assets/quest-agent-scene-*.svg          Fünf Beispielmotive (eigene Grafiken, frei im Projekt nutzbar)
assets/quest-agent-inter-tight.woff2    Schrift (SIL Open Font License)
assets/quest-agent-instrument-serif-italic.woff2  Schrift (SIL Open Font License)
templates/page.quest-agent.json         Seitenvorlage mit vorbefüllten Vorteilen, Ablauf und FAQ
LIZENZ-SCHRIFTEN-OFL.txt                Lizenztext der Schriften (nicht hochladen, nur aufbewahren)
```

## Einbau (Theme-Code-Editor)

1. Shopify-Admin → **Onlineshop → Themes** → beim gewünschten Theme **… → Duplizieren**.
2. Bei der Kopie **… → Code bearbeiten**.
3. Unter **Sections** → *Neue Section hinzufügen* → Name `quest-agent-landing` → Inhalt von `sections/quest-agent-landing.liquid` vollständig einfügen → Speichern.
4. Unter **Assets** → *Asset hochladen*: alle Dateien aus `assets/` hochladen (CSS, JS, SVGs, WOFF2).
5. Unter **Templates** → *Neue Vorlage hinzufügen* → Typ **page**, Name `quest-agent`, Format **JSON** → Inhalt von `templates/page.quest-agent.json` einfügen → Speichern.
6. **Onlineshop → Seiten → Seite hinzufügen** (z. B. „Quest Agent“) → rechts unter *Theme-Vorlage* `page.quest-agent` wählen → Speichern.
7. In der Theme-Kopie **Anpassen** öffnen, die Seite auswählen und die Section konfigurieren (siehe unten).
8. Vorschau auf Desktop und Mobil prüfen, danach die Kopie veröffentlichen.

Alternativ per Shopify CLI (in einem lokal ausgecheckten Theme): Dateien in die gleichnamigen Theme-Ordner kopieren und `shopify theme push --unpublished` bzw. `shopify theme dev` verwenden.

> Die Section kann auch auf anderen Seiten (z. B. Startseite) über **Section hinzufügen → Quest Agent Landing** eingefügt werden. Sie rendert **keine eigene Navigation** – Header und Footer bleiben die des Themes.

## Wichtige Einstellungen

| Bereich | Einstellung | Hinweis |
| --- | --- | --- |
| Hero | Texte, Buttons | **Primärer Button – Link** leer lassen = Button wird als „nicht eingerichtet“ gekennzeichnet (keine Fake-Links). |
| Loop-Demo | Beispielmotiv / eigene Bilder | Motive sind als Beispielgrafik markiert. Eigene Bilder über die Bildauswahl. |
| Preise | Namen, Preise, Mengen, Links | Link je Plan: zur Quest-Agent-App (z. B. `https://app.deine-domain.de/registrieren?plan=studio`) **oder** zu einem echten Shopify-Abo-Produkt. Ohne Link: „Kauf noch nicht eingerichtet“. |
| FAQ / Vorteile / Ablauf | Blöcke | Frei sortier-, ergänz- und löschbar. |
| Farben | Schema hell/dunkel/automatisch, Akzent | Automatisch folgt der Systemeinstellung der Besucher:innen. |

## Theme-Editor-Verhalten

Die Section reagiert auf `shopify:section:load`, `shopify:section:unload`, `shopify:section:select` (Loop startet neu) und `shopify:block:select` (ausgewählter Block wird sichtbar/aufgeklappt). Animationen respektieren `prefers-reduced-motion`; ohne JavaScript bleiben alle Inhalte sichtbar.

## Verkaufsweg und Abrechnung

Die Section verkauft nichts selbst. Es gibt zwei saubere Wege – **nicht beide parallel**:

1. **Verkauf in der Quest-Agent-App (empfohlen für den Start):** Buttons verlinken zur App. Abrechnung über den in der App vorbereiteten Stripe-Adapter; Zugang wird dort nur nach serverseitig bestätigter Zahlung freigeschaltet.
2. **Verkauf über Shopify:** Es wird eine Abo-App mit **Selling Plans** benötigt (z. B. Shopify Subscriptions), echte Abo-Produkte und eine serverseitige Synchronisierung der Berechtigungen in die Quest-Agent-App (Webhook/Order → Organisation → Plan). Diese Synchronisierung ist **noch nicht umgesetzt** und müsste gesondert beauftragt werden.

Ohne Konfiguration sind Kaufaktionen sichtbar als „nicht eingerichtet“ markiert.

## Geprüft

- Shopify **Theme Check** (`@shopify/theme-check-node` 3.29.1) auf einem Minimal-Theme mit dieser Section: **0 Befunde**.
- Lokale Render-Vorschau mit LiquidJS (Shopify-Filter nachgebildet) in hell und dunkel, 1440 px und 390 px.
- **Nicht** in einem echten Shopify-Shop getestet (kein Shopify-Zugang in dieser Umgebung).
