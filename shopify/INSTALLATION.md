# Quest Agent – in Shopify installieren

Es gibt zwei Wege. Beide lassen deinen bestehenden, veröffentlichten Shop unverändert, bis du selbst auf **Veröffentlichen** klickst.

| Weg | Datei | Wann |
| --- | --- | --- |
| **A – komplettes Theme hochladen** (am einfachsten) | `horizon-quest-agent-theme.zip` | Neuer Shop oder Shop mit Shopify Horizon, noch ohne eigene Anpassungen |
| **B – Section in dein Theme einbauen** | `quest-agent-shopify-sections.zip` | Du hast bereits ein angepasstes Theme (z. B. Horizon, Dawn oder ein anderes Online-Store-2.0-Theme) und willst es behalten |

## Weg A – komplettes Theme hochladen

`horizon-quest-agent-theme.zip` ist Shopifys Theme **Horizon** (Version 4.2.0) mit fertig eingebauter Quest-Agent-Landingpage als **Startseite**. Header, Footer, Produkt-, Warenkorb- und alle übrigen Shop-Seiten bleiben ganz normal Horizon.

1. Shopify-Admin → **Onlineshop → Themes**.
2. Rechts neben „Theme Store besuchen“ auf **Importieren → Theme hochladen** klicken.
3. **Datei hinzufügen** → `horizon-quest-agent-theme.zip` wählen → **Datei hochladen**. Nicht entpacken, die ZIP direkt hochladen (1,4 MB, Limit 50 MB).
4. Das Theme erscheint unten in der **Theme-Bibliothek** und ist noch **nicht veröffentlicht**.
5. Beim neuen Theme auf **Anpassen** klicken. Die Startseite zeigt die Quest-Agent-Landingpage. Links in der Seitenleiste „Quest Agent Landing“ anklicken, um Texte, Preise, FAQ, Farben (hell, dunkel oder automatisch) und Links einzustellen (siehe [Wichtige Einstellungen](#wichtige-einstellungen)).
6. Oben rechts die Vorschau auf Desktop und Handy prüfen.
7. Erst wenn alles passt: bei dem Theme auf **Veröffentlichen** klicken.

Gut zu wissen:

- **Menüs, Produkte und Seiten** gehören zum Shop, nicht zum Theme. Sie erscheinen automatisch auch im neuen Theme.
- **Logo, Favicon und Theme-Farben** aus einem bisherigen Theme werden nicht übernommen. Du stellst sie unter *Anpassen → Theme-Einstellungen* neu ein.
- **Seite statt Startseite:** Soll die Landingpage auf eine eigene Seite, lege unter **Onlineshop → Seiten** eine Seite an und wähle als Theme-Vorlage `page.quest-agent`. Die Startseite kannst du dann im Editor mit anderen Sections füllen.
- **Lizenz:** Horizon © Shopify Inc. Dieses abgeleitete Theme ist nur für **deinen eigenen Shop** bestimmt. Es darf nicht weitergegeben, verkauft oder veröffentlicht werden. Der Lizenztext liegt im Theme unter `snippets/horizon-license.liquid`. Deshalb liegt die ZIP auch nicht im Repository.
- **Neu erzeugen**, zum Beispiel für eine neuere Horizon-Version: `npm run shopify:theme`. Das Skript klont Horizon von GitHub und baut `dist/horizon-quest-agent-theme.zip`.

## Weg B – Section in dein bestehendes Theme einbauen

`quest-agent-shopify-sections.zip` ist ein **Section-Paket, kein vollständiges Theme**. Über „Theme hochladen“ lehnt Shopify es ab. Die Dateien werden stattdessen im Code-Editor eingefügt. Arbeite in einer **Theme-Kopie**.

### Inhalt

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

### Einbau (Theme-Code-Editor)

1. Shopify-Admin → **Onlineshop → Themes** → beim gewünschten Theme **… → Duplizieren**.
2. Bei der Kopie **… → Code bearbeiten**.
3. Unter **Sections** → *Neue Section hinzufügen* → Name `quest-agent-landing`. Den vorgegebenen Inhalt löschen und den Inhalt von `sections/quest-agent-landing.liquid` vollständig einfügen → Speichern.
4. Unter **Assets** → *Asset hochladen*: alle Dateien aus `assets/` hochladen (1 CSS, 1 JS, 5 SVGs, 2 WOFF2).
5. Unter **Templates** → *Neue Vorlage hinzufügen* → Typ **page**, Name `quest-agent`, Format **JSON**. Den Inhalt durch `templates/page.quest-agent.json` ersetzen → Speichern.
6. **Onlineshop → Seiten → Seite hinzufügen** (z. B. „Quest Agent“) → rechts unter *Theme-Vorlage* `page.quest-agent` wählen → Speichern.
7. In der Theme-Kopie **Anpassen** öffnen, oben die Seite auswählen und die Section konfigurieren.
8. Vorschau auf Desktop und Mobil prüfen, danach die Kopie veröffentlichen.

Alternativ per Shopify CLI in einem lokal ausgecheckten Theme: Dateien in die gleichnamigen Theme-Ordner kopieren und `shopify theme push --unpublished` bzw. `shopify theme dev` verwenden.

Die Section lässt sich auch auf anderen Seiten einsetzen, zum Beispiel auf der Startseite: **Anpassen → Section hinzufügen → „Quest Agent Landing“**. Sie rendert **keine eigene Navigation**. Header und Footer bleiben die des Themes.

## Wichtige Einstellungen

| Bereich | Einstellung | Hinweis |
| --- | --- | --- |
| Hero | Texte, Buttons | Bleibt **Primärer Button – Link** leer, wird der Button als „nicht eingerichtet“ gekennzeichnet. Es gibt keine Fake-Links. |
| Loop-Demo | Beispielmotiv / eigene Bilder | Die Motive sind als Beispielgrafik markiert. Eigene Bilder wählst du über die Bildauswahl. |
| Preise | Namen, Preise, Mengen, Links | Link je Plan: zur Quest-Agent-App (z. B. `https://app.deine-domain.de/registrieren?plan=studio`) **oder** zu einem echten Shopify-Abo-Produkt. Ohne Link erscheint „Kauf noch nicht eingerichtet“. |
| FAQ / Vorteile / Ablauf | Blöcke | Frei sortierbar, ergänzbar und löschbar. |
| Farben | Schema hell/dunkel/automatisch, Akzent | „Automatisch“ folgt der Systemeinstellung der Besucher:innen. |

## Verhalten im Theme-Editor

- Nach jeder Änderung lädt der Editor die Section neu. Die Demo startet dann sauber mit genau einer Animation, auch wenn der Editor das Skript erneut ausführt.
- **Section auswählen** startet die Loop-Demo von vorn.
- **Block auswählen:** Ein FAQ-Eintrag klappt auf, ein Vorteil oder Ablaufschritt wird sofort eingeblendet.
- **Section entfernen** beendet Timer und Beobachter ohne Fehler.
- Die Animationen respektieren `prefers-reduced-motion`. Ohne JavaScript bleiben alle Inhalte sichtbar.

## Verkaufsweg und Abrechnung

Die Section verkauft nichts selbst. Es gibt zwei saubere Wege, **nicht beide parallel**:

1. **Verkauf in der Quest-Agent-App (empfohlen für den Start):** Die Buttons verlinken zur App. Abgerechnet wird über den in der App vorbereiteten Stripe-Adapter. Den Zugang schaltet die App erst frei, wenn die Zahlung serverseitig bestätigt ist.
2. **Verkauf über Shopify:** Dafür braucht es eine Abo-App mit **Selling Plans** (z. B. Shopify Subscriptions), echte Abo-Produkte und eine serverseitige Synchronisierung der Berechtigungen in die Quest-Agent-App (Webhook/Order → Organisation → Plan). Diese Synchronisierung ist **noch nicht umgesetzt** und müsste gesondert beauftragt werden.

Ohne Konfiguration sind Kaufaktionen sichtbar als „nicht eingerichtet“ markiert.

## Geprüft

`npm run shopify:check` führt alle folgenden Prüfungen aus (20 von 20 bestanden):

- **Shopify Theme Check** (`@shopify/theme-check-node`):
  - Das Section-Paket in einem Minimal-Theme hat **0 Befunde**.
  - Horizon mit Section hat **0 Fehler** und keine Hinweise in Quest-Agent-Dateien. Die 6 übrigen Hinweise stammen aus Horizon selbst.
- **Upload-Regeln:** Alle Werte im JSON-Template passen zu ihren Setting-Typen (Auswahl, Bereich, Farbe, URL, Rich-Text). Blocklimits und Preset sind vorhanden.
- **Style-Isolation gegen Horizon:**
  - Methode: Die berechneten Styles jedes Elements werden verglichen, einmal die Section allein und einmal in Horizons Seitenstruktur mit Horizons `base.css`. Horizons CSS-Variablen sind dabei mit auffälligen Testwerten belegt.
  - Ergebnis: **0 Abweichungen** bei 360, 390, 768 und 1440 px, hell und dunkel. Horizon verändert also weder Schriften noch Farben noch Abstände der Section.
- **Schriften:** Laden über `asset_url`, ohne fehlgeschlagene Requests.
- **Theme-Editor-Simulation:** Die Events `shopify:section:load` (dreimal, inklusive erneuter Skriptausführung), `shopify:section:select`, `shopify:block:select` und `shopify:section:unload` verhalten sich wie oben beschrieben.
- **Horizons Scroll-Container:** Ab 990 px scrollt in Horizon `.page-wrapper` statt des Fensters. Einblendungen und „Den Loop entdecken“ funktionieren dort.

**Nicht geprüft:** Die Prüfungen liefen nicht in einem echten Shopify-Shop, denn in dieser Umgebung gibt es keinen Shopify-Zugang. Deshalb nicht verifiziert sind:

- Shopifys eigene Validierung beim Hochladen
- der echte Theme-Editor
- Horizons Header und Footer zusammen mit der Section

Falls beim Hochladen eine Meldung erscheint, bitte den genauen Text weitergeben.
