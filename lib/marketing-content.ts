/** Inhalte der öffentlichen Seiten – zentral, damit Website und Shopify-Section konsistent bleiben. */

export const LOOP_STEPS = [
  { key: "setup", title: "Nische & Vorbilder", text: "Du legst Thema, Zielgruppe und Referenzkanäle fest. Einmal – nicht jede Woche.", who: "du" },
  { key: "topics", title: "Themenvorschläge", text: "Aus Nische und Stil-Signalen entstehen passende Themen. Auf Wunsch bestätigst du sie vorab.", who: "quest" },
  { key: "research", title: "Recherche & Rohmaterial", text: "Fakten, Quellen und Bildmaterial werden gesammelt – mit Herkunft und Rechtestatus.", who: "quest" },
  { key: "script", title: "Skript", text: "Ein eigenes Skript in deinem Ton. Keine Kopie der Vorbilder.", who: "quest" },
  { key: "voice", title: "KI-Voiceover", text: "Eine KI-Stimme spricht das Skript. Du sprichst nichts selbst ein.", who: "quest" },
  { key: "edit", title: "Schnitt & Video", text: "Bild, Musik, Untertitel – das Longform-Video entsteht.", who: "quest" },
  { key: "shorts", title: "Shorts", text: "Hochkant-Clips für den Short-Feed, im eigenen Rhythmus.", who: "quest" },
  { key: "check", title: "Automatische Prüfung", text: "Länge, Titel, riskante Aussagen, Quellen und Rechte werden geprüft – als Hilfe, nicht als Freigabe.", who: "quest" },
  { key: "approve", title: "Deine Freigabe", text: "Du prüfst, änderst oder gibst frei. Ohne dich geht nichts online.", who: "du" },
  { key: "upload", title: "Geplanter Upload", text: "Freigegebenes landet im Kalender und wird zum Termin veröffentlicht.", who: "quest" },
  { key: "next", title: "Nächster Zyklus", text: "Der Loop plant den nächsten Slot – innerhalb deines Kontingents.", who: "quest" },
] as const;

export const FAQ = [
  {
    q: "Was muss ich selbst tun?",
    a: "Einmal dein System einrichten: Nische, Zielgruppe, Referenzkanäle, Stimme, Mengen und Uploadplan. Danach prüfst du die Ergebnisse und gibst sie frei – oder forderst Änderungen an. Recherche, Skript, Vertonung und Schnitt übernimmt Quest.",
  },
  {
    q: "Muss ich vor die Kamera oder selbst sprechen?",
    a: "Nein. Quest Agent ist für Faceless-Kanäle gebaut: Die Videos kommen ohne Gesicht aus, gesprochen wird von einer KI-Stimme. Du wählst die Stimme, sprichst aber nichts ein.",
  },
  {
    q: "Wie funktioniert die Freigabe?",
    a: "Jedes Ergebnis landet in deiner Freigabe-Inbox: Video, Shorts, Titel, Beschreibung, Thumbnail-Entwurf, Skript und Quellenhinweise. Du kannst Texte bearbeiten, Änderungen anfordern, verwerfen oder freigeben. Eine Freigabe gilt genau für die geprüfte Version – änderst du danach etwas, musst du erneut freigeben. Die automatische Prüfung ist nur eine Hilfe, keine Freigabe.",
  },
  {
    q: "Wie werden Uploads geplant?",
    a: "Du legst Wochentage, Uhrzeiten und Zeitzone fest – für Videos und Shorts getrennt. Freigegebene Inhalte werden in den nächsten passenden Slot eingeplant. Verstreicht ein Termin ohne Freigabe, wird nichts veröffentlicht; Quest schlägt einen neuen Termin vor, den du bestätigst. Sommer- und Winterzeit werden berücksichtigt.",
  },
  {
    q: "Kann ich mit dem Kanal Geld verdienen?",
    a: "Das Ziel vieler Kanäle ist es, die Voraussetzungen des YouTube-Partnerprogramms zu erfüllen und Werbeeinnahmen zu erzielen. Ob und wann das gelingt, hängt von YouTube, deinen Inhalten und deinem Publikum ab. Quest Agent garantiert weder Reichweite noch Einnahmen oder eine Zulassung – es nimmt dir wiederkehrende Produktionsarbeit ab.",
  },
  {
    q: "Wie verwalte ich mein Abo?",
    a: "Im Kundenbereich unter „Abo“ siehst du Plan, Abrechnungszeitraum, Verbrauch und reservierte Mengen. Dort kannst du den Plan wechseln oder zum Periodenende kündigen. In dieser Vorschau werden Zahlungen simuliert – es wird nichts abgebucht.",
  },
  {
    q: "Werden die Inhalte meiner Vorbilder kopiert?",
    a: "Nein. Referenzkanäle liefern Stil-Signale wie Themenfelder, Länge und Tonalität. Skripte werden eigenständig erstellt. Gefundenes Bildmaterial wird mit Herkunft und Rechtestatus markiert – ein gefundener Clip ist nicht automatisch lizenziert.",
  },
  {
    q: "Was ist in der Demo echt und was simuliert?",
    a: "Echt sind Konto, Datenbank, Worker, Freigaben, Kalender und Kontingente. Simuliert werden Recherche, Stimme, Schnitt, YouTube-Upload und Zahlung – sichtbar gekennzeichnet.",
  },
] as const;

export const YOU_DO = ["Richtung vorgeben: Nische, Vorbilder, Rhythmus", "Ergebnisse prüfen", "Freigeben – oder Änderungen anfordern"];
export const QUEST_DOES = [
  "Themen vorschlagen",
  "Recherchieren & Quellen zuordnen",
  "Skripte schreiben",
  "KI-Stimme vertonen",
  "Video schneiden",
  "Shorts erstellen",
  "Automatisch prüfen",
  "Termine planen & nächsten Zyklus starten",
];
