# Quest Agent – in Shopify installieren

Es gibt drei Wege. Alle lassen deinen veröffentlichten Shop unverändert, bis du selbst auf **Veröffentlichen** klickst.

| Weg | Datei | Wann |
| --- | --- | --- |
| **A – eigenes Theme „Quest Agent“** (empfohlen) | `quest-agent-shopify-theme.zip` | Der ganze Shop im Quest-Agent-Design: Startseite, Produkt- und Abo-Seiten, Warenkorb, Kollektionen, Suche, Blog, Konto, 404 – hell und dunkel |
| **B – Horizon mit eingebauter Landingpage** | `dist/horizon-quest-agent-theme.zip` (wird lokal gebaut) | Du willst Shopifys Horizon-Theme behalten und nur die Startseite ersetzen |
| **C – Section in dein Theme einbauen** | `quest-agent-shopify-sections.zip` | Du hast ein angepasstes Theme und willst es behalten |

## Weg A – eigenes Theme „Quest Agent“

`quest-agent-shopify-theme.zip` ist ein vollständiges Online-Store-2.0-Theme, komplett im Quest-Agent-Design und frei von Fremdcode. Alle Sections sind im Theme-Editor einstellbar.

**Enthalten:**

- **Startseite:**
  - **Intro:** Das Beispielvideo durchläuft sofort beim Öffnen alle Phasen (Recherche → Skript → Stimme → Schnitt → Prüfung → Freigabe → Upload). Danach zählen Beispiel-Analytics hoch (Aufrufe, Wiedergabezeit, Abonnenten, Klickrate), als „Beispiel“ gekennzeichnet.
  - **Loop in neun Schritten:** läuft von selbst durch, sobald er sichtbar ist. Jeder Schritt ist anklickbar, dazu gibt es Pause, „Nächster Schritt“ und „Überspringen“. Es gibt keinen langen Scrollweg mehr.
  - **Dashboard-Vorschau:** Alle Bereiche der Seitenleiste sind klickbar: Übersicht, Systeme, Pipeline (live), Freigaben mit Player, Versionen, Beitragstexten je Plattform und Prüfung, Kalender, Analytics, Agents mit Live-Protokoll, Verbindungen und Abo. Dazu kommt der **Quest-Chat** mit Beispielfragen. Eine automatische Tour zeigt alles, bis man selbst klickt.
  - die Plattformen YouTube, Instagram und TikTok als Handys mit Upload-Fortschritt
  - Vorteile, Preise mit Kauf-Buttons, FAQ und Abschluss
  - ein „roter Faden“, der beim Scrollen mitläuft
- **Header:** Hell/Dunkel-Umschalter, **Suche mit Live-Vorschlägen**, **Anmelden** (führt zur App, nicht zum Shop-Konto), Warenkorb mit Zähler, mobiles Menü.
- **Anmelden-Seite:** Anmeldeformular und darunter das klickbare Dashboard. Sie funktioniert ohne Einrichtung, siehe unten.
- **Warenkorb:** als Seitenpanel (AJAX, ohne Neuladen) und als eigene Seite, mit „So geht es nach dem Kauf weiter“. Die Preise berechnet immer Shopify.
- **Rechtliches:** Der Footer verlinkt automatisch alle Texte aus *Einstellungen → Richtlinien*, zum Beispiel Impressum, Datenschutz, AGB und Widerruf. Die Rechtstext-Seiten sind im Theme-Design gestaltet.
- **Produktseite:** Abo-Optionen (Selling Plans), Varianten, Galerie, „Direkt zur Kasse“ und optional Express-Zahlung.
- **Weitere Seiten:** Kollektionen, Suche, Kontakt, Blog/Artikel, Kundenkonto, Passwortseite, 404, Geschenkkarte.

### Hochladen

1. Shopify-Admin → **Onlineshop → Themes** → **Importieren → Theme hochladen**.
2. `quest-agent-shopify-theme.zip` wählen (nicht entpacken) → **Datei hochladen**. Das Theme landet unveröffentlicht in der Theme-Bibliothek.
3. **Anpassen** öffnen und die Startseite in der Vorschau (Desktop und Handy) prüfen.

### Einrichten (einmalig)

1. **Anmelden – nichts anzulegen:**
   - *Anmelden* führt ohne weitere Einrichtung zur Anmelde-Seite des Themes (`/collections/all?view=anmelden`). Die Vorlage heißt im Editor „Kollektion · anmelden“.
   - Solange die App nicht online ist, sagt die Seite das beim Absenden offen. Es wird nichts übertragen.
   - Sobald die App gehostet ist, trägst du ihre Anmelde-Adresse unter **Anpassen → Theme-Einstellungen → Anmelden & Konto → Link zur App-Anmeldung** ein. Dann führt *Anmelden* direkt dorthin.
   - Frühere Anleitungen nannten eine Seite „Dashboard“ mit der Vorlage `page.dashboard`. Diese Seite ist nicht mehr nötig; die Vorlage gibt es aber weiterhin, wenn du sie zusätzlich nutzen willst.
2. **Rechtstexte:**
   - Impressum, Datenschutzerklärung, AGB, Widerrufsrecht und die **Kündigungsrichtlinie** legst du unter **Einstellungen → Richtlinien** an. Die Kündigungsrichtlinie braucht Shopify für Abos.
   - Der Footer verlinkt sie automatisch in der Spalte „Rechtliches“.
   - **Kontaktseite:** Seite „Kontakt“ mit der Theme-Vorlage `page.contact` anlegen.
3. **Pläne als Abo-Produkte:**
   - Die App **Shopify Subscriptions** installieren.
   - Zwei Produkte anlegen, **Starter** und **Studio**, jeweils mit **SKU** (z. B. `QA-STARTER`, `QA-STUDIO`) und einem monatlichen Abo-Plan.
   - Im Editor auf der Startseite die Section **Preise** öffnen und bei jedem Plan-Block das passende Produkt wählen. Preis und Abo-Plan kommen dann direkt aus Shopify, und der Button legt den Plan in den Warenkorb.
   - Ohne gewähltes Produkt steht dort ehrlich „Kauf noch nicht eingerichtet“.
4. **Freischaltung in der App:** Ein Kauf schaltet den Plan in der Quest-Agent-App frei, sobald die App gehostet ist und die Shop-Webhooks eingerichtet sind:
   - Webhooks „Bestellungszahlung“ und „Bestellungsstornierung“ auf `https://<app-domain>/api/webhooks/shopify`
   - SKUs in `SHOPIFY_PLAN_STARTER` / `SHOPIFY_PLAN_STUDIO`
   - Details: [`docs/INTEGRATIONEN.md`](../docs/INTEGRATIONEN.md#shopify-als-verkaufsweg)
   - Den Hinweis dazu (dieselbe E-Mail-Adresse verwenden) zeigt das Theme auf Produktseite und im Warenkorb. Du änderst ihn unter *Theme-Einstellungen → Warenkorb*.
5. Erst wenn alles passt: **Veröffentlichen**.

### „Anmelden“ – App-Konto und Shop-Konto sind zwei Dinge

- **Anmelden** im Header führt zur Quest-Agent-App (Dashboard, Freigaben, Kalender). Das Ziel stellst du wie oben beschrieben ein.
- **„Mit Shop anmelden“** ist die Anmeldung für **Shopify-Kundenkonten**. Die steuert Shopify, nicht das Theme: **Einstellungen → Kundenkonten**. Sie ist nur für Bestellungen und die Abo-Verwaltung im Shop gedacht.
- Das Theme blendet das Shop-Konto im Header standardmäßig **aus**. Einblenden kannst du es unter *Theme-Einstellungen → Anmelden & Konto*.

### Wichtige Theme-Einstellungen

| Bereich | Einstellung |
| --- | --- |
| Farben & Modus | Standard hell / dunkel / automatisch (Systemeinstellung), Umschalter im Header an/aus, Akzentfarben |
| Logo & Marke | eigenes Logo oder Bildmarke mit Schriftzug, Favicon |
| Anmelden & Konto | Beschriftung und Ziel von *Anmelden*, Shop-Konto im Header |
| Warenkorb | Seitenpanel oder eigene Seite, Hinweis nach dem Kauf |
| Animationen | alle Animationen, roter Faden, Fortschrittsbalken (einzeln abschaltbar; `prefers-reduced-motion` wird immer respektiert) |

Die Navigation im Header besteht aus **Sprungmarken** (z. B. `#preise`), die von jeder Seite zur passenden Stelle der Startseite führen. Alternativ zeigt der Header ein Shopify-Menü (Section *Header → Navigation*).

### Lokal ansehen und prüfen

- `npm run shopify:preview` startet eine **lokale Vorschau** mit Beispieldaten unter http://localhost:4545. Sie enthält Beispiel-Abo-Produkte, einen Warenkorb, der wirklich funktioniert, und eine Checkout-Attrappe.
- `npm run shopify:theme:check` führt alle Prüfungen aus (siehe unten). Mit `-- --screenshots <Ordner>` entstehen zusätzlich Screenshots aller Seiten, hell und dunkel, auf Desktop und Handy.
- `npm run shopify:theme` baut `quest-agent-shopify-theme.zip` neu.

### Geprüft (Weg A)

`npm run shopify:theme:check` – **alle 13 Prüfungen bestanden** (davon eine Messung der Bildrate als Richtwert):

- **Shopify Theme Check** (offizielles Werkzeug, alle Theme-Dateien): 0 Befunde.
- **Upload-Regeln:** 27 Sections und 23 Templates, inklusive Section-Gruppen und globaler Einstellungen. Geprüft werden:
  - Typen und Standardwerte
  - Blöcke und Presets
  - URL-Felder: Sprungmarken wie `#preise` liegen bewusst in Textfeldern, weil Shopify sie in URL-Feldern ablehnt.
- **Keine Zugangsdaten** im Theme.
- **Rendern:** 28 Seiten, darunter:
  - die Anmelde-Seite
  - Rechtstexte
  - Suche mit und ohne Treffer
  - alle Kundenkonto-Vorlagen, Passwort und Geschenkkarte

  Geprüft ist auch der Zustand ohne verknüpfte Produkte.
- **Browser:**
  - Keine JavaScript-Fehler.
  - Warenkorb: Schnellkauf mit Abo-Plan, Menge ändern, Entfernen, Section Rendering auf der Warenkorbseite.
  - Produktseite: Variante mit Preis und Streichpreis; ausverkaufte Variante sperrt den Kauf.
  - „Direkt zur Kasse“ führt mit dem Abo zur Kasse.
  - Hell/Dunkel wechselt sichtbar und bleibt gespeichert.
  - Mobiles Menü: Der Schließen-Knopf ist nicht verdeckt.
  - **Hero:** Die Phasen laufen durch, danach zählen die Beispielzahlen hoch.
  - **Loop:**
    - läuft ohne Scrollen von selbst weiter
    - ein angeklickter Schritt erscheint sofort
    - Pause hält an
    - „Nächster Schritt“ geht einen Schritt weiter
    - „Überspringen“ springt zum nächsten Bereich
  - **Dashboard:**
    - Alle 9 Bereiche öffnen sich.
    - Eigenes Klicken beendet die Tour.
    - Freigeben zählt die offenen Freigaben herunter und plant das Video im Kalender ein.
    - Der Analytics-Zeitraum wechselt Zahlen und Verlauf.
    - Der Chat antwortet und legt den gewünschten Auftrag in die Pipeline.
  - **Anmelden:** Der Hinweis erscheint, und E-Mail und Passwort werden nachweislich nirgendwohin gesendet.
  - **Suche:** Das Overlay öffnet mit Live-Vorschlägen und schließt mit Escape.
  - **Footer:** Die Rechtstexte sind verlinkt.
- **Handy (360 px):** Keine Seite scrollt seitlich, und alle Texte haben Abstand zum Rand.
- **Ohne JavaScript und mit reduzierter Bewegung** bleibt nichts unsichtbar.
- **Theme-Editor-Simulation:**
  - Alle Sections werden entladen und neu geladen.
  - Das Skript wird erneut ausgeführt, ohne dass sich etwas doppelt registriert.
  - Die Dashboard-Navigation funktioniert danach, und ein ausgewählter FAQ-Block klappt auf.
  - Ein im Editor ausgewählter Loop-Schritt wird angezeigt und angehalten.
- **Scroll-Bildrate** (Richtwert, headless ohne Grafikkarte): etwa 55 Bilder pro Sekunde beim Durchscrollen der Startseite.

**Nicht geprüft:** Die Prüfungen liefen nicht in einem echten Shop, denn in dieser Umgebung gibt es keinen Shopify-Zugang. Die lokale Vorschau bildet Shopify mit LiquidJS nach. Ungetestet sind deshalb:

- Shopifys Upload-Validierung
- der echte Theme-Editor
- echte Selling Plans und der Checkout
- Shopifys Zahlungs-Icons
- die Anmelde-Seite über `?view=anmelden`. Shopify-Doku und Vorschau sprechen dafür, dass alternative Templates so aufgerufen werden, im echten Shop geprüft ist es aber nicht.

Nach dem Hochladen bitte die Vorschau prüfen und eine eventuelle Fehlermeldung wörtlich weitergeben.

## Weg B – Horizon mit eingebauter Landingpage

`horizon-quest-agent-theme.zip` ist Shopifys Theme **Horizon** (Version 4.2.0) mit fertig eingebauter Quest-Agent-Landingpage als **Startseite**. Header, Footer, Produkt-, Warenkorb- und alle übrigen Shop-Seiten bleiben ganz normal Horizon.

1. Shopify-Admin → **Onlineshop → Themes**.
2. Rechts neben „Theme Store besuchen“ auf **Importieren → Theme hochladen** klicken.
3. **Datei hinzufügen** → `horizon-quest-agent-theme.zip` wählen → **Datei hochladen**. Nicht entpacken, die ZIP direkt hochladen (1,4 MB, Limit 50 MB).
4. Das Theme erscheint unten in der **Theme-Bibliothek** und ist noch **nicht veröffentlicht**.
5. Beim neuen Theme auf **Anpassen** klicken. Die Startseite zeigt die Quest-Agent-Landingpage. Links in der Seitenleiste „Quest Agent Landing“ anklicken, um Texte, Preise, FAQ, Farben (hell, dunkel oder automatisch) und Links einzustellen (siehe [Einstellungen der Section](#einstellungen-der-section-weg-b-und-c)).
6. Oben rechts die Vorschau auf Desktop und Handy prüfen.
7. Erst wenn alles passt: bei dem Theme auf **Veröffentlichen** klicken.

Gut zu wissen:

- **Menüs, Produkte und Seiten** gehören zum Shop, nicht zum Theme. Sie erscheinen automatisch auch im neuen Theme.
- **Logo, Favicon und Theme-Farben** aus einem bisherigen Theme werden nicht übernommen. Du stellst sie unter *Anpassen → Theme-Einstellungen* neu ein.
- **Seite statt Startseite:** Soll die Landingpage auf eine eigene Seite, lege unter **Onlineshop → Seiten** eine Seite an und wähle als Theme-Vorlage `page.quest-agent`. Die Startseite kannst du dann im Editor mit anderen Sections füllen.
- **Lizenz:** Horizon © Shopify Inc. Dieses abgeleitete Theme ist nur für **deinen eigenen Shop** bestimmt. Es darf nicht weitergegeben, verkauft oder veröffentlicht werden. Der Lizenztext liegt im Theme unter `snippets/horizon-license.liquid`. Deshalb liegt die ZIP auch nicht im Repository.
- **Erzeugen:** `npm run shopify:horizon`. Das Skript klont Horizon von GitHub und baut `dist/horizon-quest-agent-theme.zip`.

## Weg C – Section in dein bestehendes Theme einbauen

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

### Einstellungen der Section (Weg B und C)

| Bereich | Einstellung | Hinweis |
| --- | --- | --- |
| Hero | Texte, Buttons | Bleibt **Primärer Button – Link** leer, wird der Button als „nicht eingerichtet“ gekennzeichnet. Es gibt keine Fake-Links. |
| Loop-Demo | Beispielmotiv / eigene Bilder | Die Motive sind als Beispielgrafik markiert. Eigene Bilder wählst du über die Bildauswahl. |
| Preise | Namen, Preise, Mengen, Links | Link je Plan: zur Quest-Agent-App (z. B. `https://app.deine-domain.de/registrieren?plan=studio`) **oder** zu einem echten Shopify-Abo-Produkt. Ohne Link erscheint „Kauf noch nicht eingerichtet“. |
| FAQ / Vorteile / Ablauf | Blöcke | Frei sortierbar, ergänzbar und löschbar. |
| Farben | Schema hell/dunkel/automatisch, Akzent | „Automatisch“ folgt der Systemeinstellung der Besucher:innen. |

### Verhalten im Theme-Editor (Weg B und C)

- Nach jeder Änderung lädt der Editor die Section neu. Die Demo startet dann sauber mit genau einer Animation, auch wenn der Editor das Skript erneut ausführt.
- **Section auswählen** startet die Loop-Demo von vorn.
- **Block auswählen:** Ein FAQ-Eintrag klappt auf, ein Vorteil oder Ablaufschritt wird sofort eingeblendet.
- **Section entfernen** beendet Timer und Beobachter ohne Fehler.
- Die Animationen respektieren `prefers-reduced-motion`. Ohne JavaScript bleiben alle Inhalte sichtbar.

## Verkaufsweg und Abrechnung

Es gibt zwei saubere Wege, **nicht beide parallel**:

1. **Verkauf über Shopify (Weg A, empfohlen):** Die Pläne sind Abo-Produkte im Shop. Die App schaltet den Plan über signaturgeprüfte Shop-Webhooks frei. Ist in der App bereits ein Stripe-Abo aktiv, wird ein Shop-Kauf nicht automatisch übernommen, sondern als Hinweis gemeldet. Details: [`docs/INTEGRATIONEN.md`](../docs/INTEGRATIONEN.md#shopify-als-verkaufsweg).
2. **Verkauf in der Quest-Agent-App:** Die Buttons verlinken zur App, abgerechnet wird über den vorbereiteten Stripe-Adapter.

Ohne Konfiguration sind Kaufaktionen sichtbar als „nicht eingerichtet“ markiert.

### Geprüft (Weg B und C)

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
