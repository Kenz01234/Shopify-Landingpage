# Herkunft und Lizenzen der Demo-Medien

Alle Dateien in diesem Ordner sind **Demo-Material** für den lokalen Demo-Modus. Sie werden in der Oberfläche als Demo gekennzeichnet und dürfen **nicht** als echte Kundenproduktion ausgegeben werden.

| Dateien | Inhalt | Herkunft | Lizenz / Hinweis |
| --- | --- | --- | --- |
| `demo-<motiv>-landscape.mp4`, `demo-<motiv>-short.mp4` | 7–14-sekündige Beispielclips (960×540 bzw. 540×960) mit Titel, Ken-Burns-Bewegung und gesprochenem Beispieltext | Erzeugt mit `scripts/generate-demo-media.tsx`: Motiv aus `components/art/niche-scene.tsx` (eigene, im Code gezeichnete SVG-Grafik), Rendering über Playwright/Chromium, Kodierung mit ffmpeg (H.264/AAC) | Grafik: eigenes Werk des Projekts. Stimme: siehe unten. |
| `voice-demo-*.mp3` | Hörproben der drei Demo-Stimmen | Piper TTS (`piper-tts` 1.8.0), Stimmen `de-thorsten-low` und `de-kerstin-low` aus https://github.com/rhasspy/piper/releases/tag/v0.0.2 | Modellkarten nennen **CC0** für die Trainingsdatensätze (Thorsten-Voice bzw. Kerstin). Beide Modelle wurden laut Modellkarte von einer US-englischen Basisstimme („Ryan“) feinjustiert – deren Lizenzlage vor einer **kommerziellen** Nutzung prüfen. Hier nur als lokale Demo-Platzhalter. **Keine ElevenLabs-Stimmen.** |
| `scenes/*.svg` | Die fünf Nischen-Motive als eigenständige SVGs (für Thumbnail-Entwürfe und Shopify) | Export aus `components/art/niche-scene.tsx` über `scripts/export-scenes.tsx` | Eigenes Werk des Projekts. |
| `manifest.json` | Technische Metadaten (Größe, Dauer, Auflösung) | automatisch erzeugt | – |

Die Demo-Vertonung spricht einen **Beispieltext**, nicht das jeweilige Skript des Auftrags. Das steht auch in der Freigabe-Ansicht.

Neu erzeugen (optional, Voraussetzungen im Skriptkopf):

```bash
npx tsx scripts/export-scenes.tsx
PIPER_BIN=/pfad/zu/piper PIPER_VOICES=/pfad/zu/stimmen npx tsx scripts/generate-demo-media.tsx
```

Die vom Auftraggeber gelieferten Designreferenzen (`Quest-Agent-Startseite.png`, `Quest-Agent-Sprites.png`) wurden nur als visuelle Richtung genutzt und sind **nicht** in die Website eingebaut.
