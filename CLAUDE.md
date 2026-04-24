# CLAUDE.md – Projektübersicht für neue Chat-Sessions

Architektur-Doku, damit ein neuer Chat sofort weiterarbeiten kann.

## Projektkontext

Interaktives Mathe-Lernspiel (Thema: Kreise) für den Schulunterricht. Aufbau als **Escape-Room-artiges Abenteuer** mit 5 Räumen, linearer Aufgaben-Progression und Cross-Room-Lookups. Vanilla HTML/CSS/JS, kein Build-Tool, kein Framework.

Entwickler: Manuel Benz (Lehrer, wenig Programmiererfahrung). GitHub: `Manuel-Benz/Spiel_Kreise_1`.

## Dateistruktur

```
index.html        ← 2 Canvases + 2 SVG-Layer (hinten + vorne) mit Deko-Gruppen pro Raum
style.css         ← Layout, Stage-Styling, Inventar, Drag-Preview, Octopus-Overrides
script.js         ← Räume, Türen, Figur, Deko-Generatoren, Input/Loop, Inventar, Hindernisse, Tiefensortierung
assets/
  plant_*.svg     ← Pflanzen (tulpe, blume, yucca, geranie, setzling, kraeuter, gras, blattpflanze, strauch)
  bush_1..4.svg   ← Detail-Büsche im Garten
  skeleton_3.svg  ← Tanzendes Skelett im Keller
  table_1.svg     ← Kleiner Holztisch (im Hauptraum, Inline-SVG)
  table_2.svg     ← Grosser Schreibtisch (im Büro, Inline-SVG, helleres Holz)
  lamp_lava_1.svg ← Lavalampe-Original (3D-Verläufe; im Spiel: vereinfachte Inline-Variante)
  octopus_1.svg   ← Tintenfisch (im Fitnessraum, Inline-SVG; Mund path4647 dunkelrot)
  bathtub_1/2.svg ← Badewannen (im Fitnessraum, Inline-SVG)
  duck_1.svg      ← Quietscheente (im Fitnessraum, auf bathtub_1)
  toilet_1.svg    ← WC Seitenansicht (im Fitnessraum, Inline-SVG)
  toilet_2_1/2.svg← WC Frontansicht, 2 Varianten (im Fitnessraum, shared CSS-Klassen)
  bookshelf_1.svg ← Original (im Spiel als Inline-SVG, nicht das File)
  skeleton_1/2.svg, human_1_left.svg ← nicht aktiv
CLAUDE.md         ← diese Datei
```

**Cache-Busting** in `index.html`: aktuell `style.css?v=22`, `script.js?v=65`. Bei Änderungen hochzählen — sonst lädt der Browser die alte Version.

## Rendering-Ebenen (hinten → vorne)

Vier Ebenen, damit Pflanzen perspektivisch VOR oder HINTER der Figur erscheinen können:

1. `#game-canvas` (`ctxRaum`) — Zimmer (Wände, Boden, Decke), Türen, Raum-spezifisches Canvas-Drawing (Garten-Zaun + Sonne, rasterisierte Detail-Büsche).
2. `#object-layer` (SVG, viewBox `0 0 1600 900`) — pro Raum eine Gruppe `<g data-raum="…">`. Bookshelf, Skelett, Sträucher, Pflanzen-Originale, Tische.
3. `#figure-canvas` (`ctxFigur`) — nur die animierte Figur.
4. `#object-layer-vorne` (SVG, gleiche viewBox) — Klone aller `[data-fv]`-Elemente. Pro Frame togglet JS Sichtbarkeit zwischen Rück- und Front-Ebene → Pflanze überdeckt Figur, sobald `figur.fv > pflanze.fv`.

In `draw()` wird `let ctx` zwischen `ctxRaum` und `ctxFigur` umgeschaltet:

```js
function draw() {
    ctx = ctxRaum;  clearRect; zeichneZimmer(); zeichneTueren(); zeichneObjekte();
    ctx = ctxFigur; clearRect; zeichneFigur();
    aktualisierePflanzenTiefe();
}
```

`resizeCanvas()` setzt beide Canvases auf dieselbe DPR-aware Pixelgrösse. Klicks landen nur auf `#game-canvas`; `#figure-canvas` und beide SVGs haben `pointer-events: none`.

## Koordinatensystem & Perspektive

Logische Bühne **1600 × 900** (16:9). Stage-Grösse via `resizeCanvas`.

**Zimmer-Geometrie** (alle Räume gleich, nur Farben/Deko unterscheiden sich):

```js
const ZIMMER = {
    decke:       [[0,0],[300,100],[1300,100],[1600,0]],
    boden:       [[0,900],[300,600],[1300,600],[1600,900]],
    linkeWand:   [[0,0],[300,100],[300,600],[0,900]],
    rechteWand:  [[1600,0],[1300,100],[1300,600],[1600,900]],
    hintereWand: [[300,100],[1300,100],[1300,600],[300,600]],
};
```

Fluchtpunkt ca. (800, 225). Horizont y=225 (fv=1). **Perspektive-Skala `s = 1 - 0.45·fv`**.

```js
bodenPunkt(fu, fv)     // fu 0..1 links→rechts, fv 0..1 vorne→hinten → screen (x, y)
screenZuBoden(x, y)    // inverse, liefert null ausserhalb Boden
linkeWandPunkt(u, v)   // u 0..1 Tiefe, v 0..1 Boden→Decke → screen
rechteWandPunkt(u, v)
fuellePolygon(polygon, farbe, nahtlos = false)  // nahtlos: 1px-Stroke in Fillfarbe gegen Subpixelsäume (nur Garten)
```

## Figur

```js
figur = { fu, fv, zielFu, zielFv, richtung, geschwindigkeit:0.016, gehphase:0, ankunft:null }
const GEHPHASE_SCHRITT = 0.36, BEIN_HUB = 0.22, FIGUR_SKALA = 1.0;
const FIGUR_FU_MIN = 0.06, FIGUR_FU_MAX = 0.94;
const FIGUR_FV_MIN = 0,    FIGUR_FV_MAX = 0.97;
```

Komplett schwarz, Augen + Mund weiss, keine Haare/Schuhe/Ohren. `zeichneFigur()` (top-down): Beine mit Sinus-Gehanimation, Körper (Seitenansicht 10 % schmaler), Arme (frontal beidseits, seitlich mit Schwung), Hals, Kopf, Gesicht. Nase frontal um `Math.PI/12` rotiert. Kopf sitzt 5·s tiefer als geometrisch ideal, damit die Hals-Rundungen vom Kopf überdeckt werden.

`figur.richtung` zeigt immer in die TATSÄCHLICHE Laufrichtung — beim Slide um ein Hindernis dreht sich die Figur entsprechend.

## Räume (5 Stück, Tabelle)

| ID | Name | Türen → Ziel | Wandfarben | Inhalt |
|---|---|---|---|---|
| `haupt` | Hauptraum | A→Büro, B→Fitness, L→Garten, geheim→Keller | b90/b90, Wände b70 | Bookshelf + 6 Pflanzen + Tisch1 mit Lavalampe |
| `buero` | Büro | Pfeil→Haupt, F→Fitness | b90/b90, Wände b70 | Tisch2 mit Tischlampe + Demo-Notizzettel am Boden |
| `fitness` | Fitnessraum | Pfeil→Haupt, B→Büro | b90/b90, Wände b70 | Tintenfisch hinten-rechts |
| `garten` | Garten | H→Haupt | Himmel + Wiese + rechte Hauswand | 12 Sträucher + 4 Detail-Büsche, Sonne, Zaun |
| `keller` | Keller | H→Haupt | b80/b90, Wände b80, sehr dunkel | Tanzendes Skelett hinten-rechts |

`aktuellerRaum` hält die aktive ID. `wechsleRaum(zielId)`:
- merkt `vonRaum`, setzt `aktuellerRaum = zielId`
- blendet alle `<g data-raum>` ausser dem Ziel auf `display:none` — **in beiden SVG-Ebenen** (Rück + Front)
- Eintrittsposition = `laufziel` der Tür im Zielraum, deren `ziel === vonRaum` (Fallback `RAUM_EINTRITT = {fu:0.5, fv:0.3}`)
- `eintrittsRichtung(fu, fv)` setzt `figur.richtung` "in den Raum hinein"
- ruft `draw()`

Klick-Pipeline (`pointerdown`): zuerst Tür-Polygone → `starteRaumwechsel()` (Fade) — sonst aktive Objekte → Aufgabe/Aufnehmen — sonst `screenZuBoden` → Figur läuft hin.

## Türen

Jede Tür hat `polygon`, `ziel`, `laufziel: {fu, fv}`, optional `label`/`secret`/`pfeil`/`schloss`/`akzeptiert`.

- **Hauptraum:** A, B an hinterer Wand (x 460–640 / 960–1140), L an linker Wand, geheim an rechter Wand (`secret: true`, wandfarben).
- **Büro/Fitness:** `zurueck` als 2D-Pfeil unten am Bildrand (`PFEIL_POLYGON`); seitliche Durchgangstür F bzw. B.
- **Garten/Keller:** einzelne Rück-Tür auf Seitenwand.

**Türen-Schlösser:** `schloss: "<id>"` macht Tür gesperrt, bis der Schlüssel in `spielstand.freigeschalteteTueren` liegt. `zeichneSchloss()` malt ein weisses Schloss unten in der Tür (NICHT auf `secret`-Türen). Aktuell verschlossen: Geheim-Tür im Hauptraum (`schloss: "keller_schluessel"`).

## Farb-Palette

Graustufen `GRAU.bX` (X=0..100, b0=weiss, b100=schwarz):

```js
GRAU = { b0:"#ffffff", b20:"#cccccc", b40:"#999999", b50:"#808080",
         b60:"#666666", b70:"#4d4d4d", b80:"#333333", b90:"#1a1a1a", b100:"#000000" };
```

Globale Farben (Türen, Figur) in `FARBEN`. Raum-Wandfarben in `RAEUME[id].farben`. Body-Background: schwarz.

## Möbel & Deko pro Raum

### Hauptraum

Inline-SVG-Reihenfolge in `<g data-raum="haupt">`:
1. **Bookshelf** an hinterer Wand (Inline-SVG `<g id="bookshelf" transform="translate(650 310) scale(0.5)" filter="url(#grell)">`). 5 Regale, Pflanzen in Regal 1 + 5. Sättigungs-Filter `#grell` (`feColorMatrix saturate 2`).
2. **Möbel-Gruppe** `<g id="haupt-moebel">` — VOR den Pflanzen, damit Pflanzen mit kleinerem fv (näher zur Kamera) in Render-Order über dem Tisch landen:
   - **Tisch 1** (`assets/table_1.svg`): Anker bottom-left = SVG (262.6, 578) → Screen (270, 640), σ=0.82 (schmaler als 1.0, damit der Tisch Tür A nicht überdeckt). Foot fv≈0.87. `data-fv="0.87"`. Rechtes Bein um +47 SVG-Units verschoben (x=494.5) für perspektivische Ausrichtung; Beindetails per `matrix(-1,0,0,1,749.3,0)` gespiegelt. **Perspektiv-Fix**: Back-Right der Tischplatte auf SVG x=509 verlängert (war 456), damit die rechte Kante zum Raum-Fluchtpunkt (800, 225) konvergiert (ein Tisch LINKS vom VP muss nach rechts-oben laufen). Back-Left leicht auf x=298. **Slab-Strip** rechts aktuell `M 509 495 L 482.2 516.7 L 482.2 524.7 L 509 503 Z` — Front exakt an Tischplatten-Front-Right-Ecke (482.2, 516.7) angedockt, Back synchron auf x=509.
   - **Lavalampe** auf Tisch 1: vereinfachte flache-Farben-Variante von `lamp_lava_1.svg` (Original hat viele Inkscape-Verläufe; hier nur Vase-Glaskolben + Lava-Blobs + Sockel + Metallkappe). Pfade weiterhin im Lampen-Koordinatensystem (Sockelmitte 375/728, Höhe ~222px). Wrapper `translate(362 584) scale(0.30) translate(-375 -728)` schrumpft auf 30 % und positioniert auf Tischplatte. `data-fv="0.87"`.
3. **Pflanzen** (`<g id="plants">`, 6 Stück) — Transform-Muster: `translate(bx, by) scale(σ) translate(-256, -512)` verankert Topfboden (256, 512) im viewBox an Bodenpunkt. Formel: `σ = s · basisBreite / 512` (mit Inhaltsratio z.B. blume 52 %, yucca 88 %, kraeuter 99 %). Jede Pflanze hat `data-fv` für Tiefensortierung:

| Pflanze | fu | fv | bw | r (Hindernis) |
|---|---|---|---|---|
| tulpe | 0.15 | 0.12 | 175 | 0.05 |
| blume | 0.87 | 0.15 | 175 | 0.05 |
| kraeuter | 0.85 | 0.45 | 92 | 0.025 |
| setzling | 0.12 | 0.50 | 118 | 0.035 |
| geranie | 0.94 | 0.78 | 100 | 0.03 |
| yucca | 0.034 | 0.79 | 104 | 0.03 |

Bookshelf hat zusätzliche Interaktion via `OBJEKTE.haupt[0]`: `aufgabe: "bookshelf_umfang"` (Aufgaben-Overlay) + `akzeptiert.notizzettel` (Drop-Target).

### Büro

- **Tisch 2** (`assets/table_2.svg`, L-Schreibtisch mit Schubladen): Anker = front-left-leg-Fuss SVG (311, 613) → Screen (240, 700), σ=0.55. Steht vorderlinks. **Helle Holz-Palette**: Original-Wood-Hex-Codes wurden global ersetzt (z.B. `#512F18→#8B6740`, `#C77137→#DEAA6F` usw.). Metallbeine (Grautöne) und Schubladengriffe (`#D1C6BF`) bleiben.
- **Tischlampe** auf Tisch 2 (handgezeichnet inline, klassische Schreibtisch-Lampe, V7):
  - Schirm = Trapez schmal oben, breit unten. Anker Standfuss-Mitte = Screen (340, 495).
  - **Stange** geht komplett bis in den Standfuss-Mittelpunkt durch (Höhe 125), wird unten vom Standfuss überdeckt → keine Lücke.
  - **Schirm um -20° gedreht** (gegenuhrzeigersinn = Bottom kippt nach RECHTS) um Stem-Top (340, 370). Lichtkegel-Boden HORIZONTAL bei y=505, Lichtfleck-Mitte x=389 passend zum stärkeren Neigungswinkel.
  - **Schirm = genau 2 Flächen + oberer Rand**: Licht-Hälfte rechts `#987230` (`M 340 370 L 352 370 L 366 425 Q 353 431 340 431 Z`), Schatten-Hälfte links `#7a5a20` (`M 328 370 L 340 370 L 340 431 Q 327 431 314 425 Z`). Unterkanten beider Hälften folgen der Boden-Ellipse als quadratischer Bezier, Treffpunkt bei Peak (340, 431). Kontrollpunkte via De Casteljau-Split der Außenkontur-Bezier `Q 340 437` bei t=0.5: (327, 431) und (353, 431).
  - **Aussenkontur in zwei Stroke-Pfaden**, jede Seite in ihrer eigenen Flächenfarbe → keine sichtbare Mittellinie (weicher Übergang).
  - **Lichtkegel-Oberkante** als Bezier `Q 363 433` (rotierter Außenkontur-Kontrollpunkt) statt gerader Sehne → halbtransparenter Lichtkegel (`#fff5b8` opacity 0.20) ragt nicht in den Schirm rein.
- **Demo-Notizzettel** am Boden (`OBJEKTE.buero[0]`): per `zeichnen`-Callback als Brief aufs Canvas gemalt (Datum oben-rechts, Anrede, 3 Textzeilen mit abnehmender Länge, Unterschrift-Zickzack unten), `aufnehmen: "notizzettel"`. Drop auf Bookshelf zeigt Hinweis-Overlay.

### Fitnessraum

- **Tintenfisch** (`assets/octopus_1.svg`) inline importiert, hinten-rechts. Anker `<svg class="octopus" x="970" y="408" width="440" height="330" viewBox="0 0 640.08 479.93">`. CSS in `style.css`:
  - `.octopus *:not(#path4647) { stroke: none !important }` — entfernt schwarze Outlines global, AUSSER beim Mund.
  - **Augen-Pupillen** (path3950, path3950-4): NICHT der Mund — die Pfade liegen IM Auge. Behalten Inline-`fill:#000`.
  - **Mund** (`#path4647`): offene Kurve, nur Stroke, Farbe `#5a0000` (dunkelrot). Auch in `assets/octopus_1.svg` auf dunkelrot gesetzt.
- **Badezimmer-Assets** (aus `assets/` inline importiert, Renderreihenfolge hinten → vorn):
  - `toilet_2_1` hinten-rechts (Frontansicht, grauer Schatten-Layer): (805, 537) 105×138
  - `toilet_2_2` hinten-links (Frontansicht, weiß): (273, 545) 110×145
  - `bathtub_2` hinten-mitte (kleiner, klares Wasser `#FCFCFC`): (588, 535) 200×125
  - `toilet_1` mitte (Seitenansicht, inline styles): (446, 608) 110×142
  - `bathtub_1` vorne-links (groß, blaues Wasser `#A7C5EA`): (40, 670) 300×188
  - `duck_1` auf bathtub_1 schwimmend: (150, 696) 70×74
  - **Shared `<style>` Block** im `<g data-raum="fitness">` für `.st1-.st10` (von toilet_2_1/toilet_2_2 geerbte CSS-Klassen), einmalig definiert.

### Garten (Spezialfall)

Decke + linkeWand + hintereWand alle Himmelsblau → `zeichneZimmer()` füllt einen einzigen `fillRect` mit Himmel, dann werden Boden (nahtlos) und rechte Hauswand drübergezeichnet. So entstehen keine Subpixel-Säume.

`zeichneGartenZaun()` (auf `ctxRaum`) Renderreihenfolge:
1. `zeichneSonne()` (gelber Kreis + 12 Strahlen, (1200, 200), r=42)
2. Horizont-Silhouetten (Büsche 1/4/7) — werden gleich vom Gras halb verdeckt
3. Grashorizont + linke Wiese (beide `nahtlos: true`)
4. Horizont-Büsche mit `vor: true` (Büsche 2/3/5/6) — voll sichtbar
5. Nah-Büsche (Canvas-Ellipsen, 3 Stück)
6. **bush_4** (Detail-Busch, `drawImage`) auf linker Wiese
7. **bush_1** + **bush_3** (Detail-Büsche) hinter Hintenzaun
8. Zaun hinten (9 Pfosten + 2 Verstrebungen, y=420–600)
9. **bush_2** (Detail-Busch) oberhalb des Zauns, voll sichtbar
10. Zaun links (`linkeWandPunkt(u, v)`, 8 Pfosten, perspektivisch)
11. Rechte Hauswand nachzeichnen (clippt Detail-Büsche, die über x=1300 ragen)

**Detail-Büsche** (`BUESCHE`): SVGs aus `bush_1..4.svg` als `Image`-Objekte geladen (`ladeBuschBild`) und per `drawImage` auf den Canvas gerastert (damit der Zaun sie verdecken kann — was mit `<image href>` in der mittleren SVG-Ebene nicht ginge).

**bush_4**-Konturen: Die SVG-Datei hat am äusseren `<g>` `stroke-width="25" stroke-linejoin="round" stroke-linecap="round"`, jeder Pfad zusätzlich `stroke="{sein eigener fill}"` — Pfade „puffen" minimal, KEINE schwarze Outline.

**Sträucher im Garten** (12 Stück, im SVG-Layer `<g data-raum="garten">`) durch `baueGartenDeko()` beim Start erzeugt. 4 Varianten (`STRAUCH_VARIANTEN`) mit unterschiedlichen Blatt-Auswahlen und Grüntönen. Pfade aus `plant_strauch.svg` (Boden entfernt, 5 Blatt-Cluster + 1 Ast-Pfad).

### Keller

- Wände/Decke/Boden in dunklen Grautönen (b80/b100/b90)
- **Skelett** aus `skeleton_3.svg` via `<image href>`, perspektivisch hinten-rechts (fu=0.90, fv=0.85, Füsse bei (1236, 645)). Grösse 177×250.
- Farb-Invertierung via SVG-Filter `#invert` (schwarz → weiss).
- Schaukel-Animation: `<animateTransform type="rotate">` um die Füsse, ±6°, 2.5 s.

## Hindernis-System (Kollision)

`HINDERNISSE[raumId]` ist ein Array von Hindernissen. Jedes ist entweder ein **Kreis** mit `{ fu, fv, r }` oder eine **Ellipse** mit `{ fu, fv, rx, ry }`. Funktionen `istImHindernis`, `slideUmHindernis`, `setzeFigurZiel` benutzen `h.rx ?? h.r` und `h.ry ?? h.r` → Kreise mit `r` bleiben rückwärts-kompatibel.

```js
const HINDERNISSE = {
    haupt: [
        { fu: 0.034, fv: 0.79, r: 0.03 },             // Kreis (Pflanze yucca)
        { fu: 0.10,  fv: 0.88, rx: 0.14, ry: 0.12 },  // Ellipse (Tisch 1, deckt Back-Area mit ab)
        // ...
    ],
    buero:   [{...}, {...}, {...}],                   // 3 Kreise entlang der Diagonale für L-Schreibtisch
    fitness: [{ fu: 0.85, fv: 0.80, r: 0.08 }],       // Octopus
};
```

- `istImHindernis(fu, fv)`: `(dfu/rx)² + (dfv/ry)² < 1` (Ellipsen-Gleichung).
- `setzeFigurZiel(fu, fv)`: liegt das Ziel innerhalb, schiebt es radial nach aussen auf 1.05 × Ellipsen-Rand und clamped auf den Laufbereich. Safety Net für Tür-Laufziele nahe Pflanzen.
- `slideUmHindernis(ux, uy, schritt)`:
  1. Sucht das blockierende Hindernis (in Laufrichtung, senkrechter Versatz ≤ max(rx, ry) + 0.02).
  2. Tangenten-Richtung senkrecht zum **Ellipsen-Gradient** an Figur-Position (für Kreise = alte Kreis-Tangente).
  3. Bevorzugt die Seite mit positivem Dot zur Laufrichtung.
  4. **Wand-Fallback:** verlässt die bevorzugte Seite den Laufbereich oder führt in ein anderes Hindernis → ANDERE Seite probieren. Nur wenn beide blockiert sind, stoppt die Figur.
- **Safety-Net** in `aktualisiereFigur`: vor jedem Schritt wird geprüft, ob die Figur in einem Hindernis ist (z.B. nach einer Hindernis-Anpassung). Falls ja → radial nach aussen schieben + clamp.

Pflanzen-Radien orientieren sich am Fussabdruck (Topfbasis), nicht am Blattwerk → Figur kann knapp vorbei, der Körper verschwindet perspektivisch hinter den Blättern (siehe Tiefensortierung).

## Tiefensortierung (data-fv-Toggle)

Architektur-Problem: Der Figur-Canvas liegt fix zwischen den SVG-Ebenen. Damit Pflanzen je nach Tiefe VOR oder HINTER der Figur erscheinen können, liegen sie in zwei Ebenen:

1. Jede Pflanze (und Tisch1 + Lavalampe) hat ein `data-fv="…"`-Attribut.
2. `klonePflanzenVorne()` läuft einmal beim Start (via `baueRaumDeko()`): für jede `<g data-raum>` in der Rück-Ebene wird eine gleichnamige Gruppe in der Front-Ebene erzeugt, und ALLE `[data-fv]`-Elemente werden hineingeklont.
3. `aktualisierePflanzenTiefe()` läuft am Ende jedes `draw()`:
   - Für jedes `[data-fv]` in Rück-Ebene: `display: none`, wenn `figur.fv > pflanze.fv`. Sonst sichtbar.
   - In Front-Ebene umgekehrt.

Bookshelf, Skelett, Sträucher, Tisch2 haben KEIN `data-fv` und bleiben nur in der Rück-Ebene — sie stehen perspektivisch immer hinter der Figur.

`wechsleRaum()` togglet `<g data-raum>`-Sichtbarkeit in BEIDEN SVG-Ebenen simultan.

## Spielstand

```js
const spielstand = {
    geloesteAufgaben: new Set(),       // IDs gelöster Aufgaben
    freigeschalteteTueren: new Set(),  // eingesammelte Schlüssel-IDs
    inventar: {},                      // gefundene Zahlen / Infos (Cross-Room-Lookup)
    gegenstaende: new Set(),           // physische Inventar-Gegenstände
};
```

**Dev-Helfer in der Browserkonsole:**
```js
freischalten("keller_schluessel")
verschliessen("keller_schluessel")
gegenstandHinzufuegen("notizzettel")
gegenstandEntfernen("notizzettel")
verbrauche("notizzettel")              // Alias — praktisch in akzeptiert-Callbacks
spielstand                              // aktueller Zustand inspizieren
```

## Aufgaben + Overlay

```js
const AUFGABEN = {
    aufgabeId: {
        frage:     "Text oder (spielstand) => string",  // Funktion → Cross-Room-Lookup
        formel:    "U = 2 \\pi r",                       // KaTeX (optional)
        fragetext: "Detailfrage mit Werten (in cm).",   // optional
        loesung:   31.4,                                 // Zahl
        toleranz:  0.2,
        bei_richtig: {
            schluessel:     "keller_schluessel",         // optional → freigeschalteteTueren
            inventar:       { umfang_demo_cm: 31.4 },    // optional → spielstand.inventar
            belohnung_text: "Richtig! ...",              // optional
        },
    },
};
```

`zeigeAufgabe(id)` baut Aufgaben-UI ins `#overlay-inhalt` (KaTeX-Formel via CDN, Input, Prüfen-Button, Feedback). `pruefeAntwort()` vergleicht per Toleranz (Komma → Punkt normalisiert). Bei Erfolg: `geloesteAufgaben.add()`, Schlüssel/Inventar aus `bei_richtig`, Input + Button deaktivieren.

`zeigeOverlayText(text)` für einfachen Info-Text (z.B. „Tür verschlossen."). Schliessen via ×-Button, Klick auf dunklen Hintergrund oder `Esc`.

**Aktuelle Demo-Aufgabe:** `bookshelf_umfang` — Klick aufs Bücherregal, Umfang bei r=5 cm. Bei Erfolg: `keller_schluessel` + Inventar-Eintrag.

## Inventar + Drag & Drop

```js
const GEGENSTAENDE = {
    notizzettel: { name: "Notizzettel", icon: `<svg ...>` },  // Brief-Icon: Datum oben-rechts, Anrede, 3 Textzeilen abnehmender Länge, Unterschrift-Zickzack
};
```

Inventar-Zustand: `spielstand.gegenstaende` (Set von IDs). Rendert in `#inventar` (Panel rechts oben), hidden wenn leer.

Objekte in `OBJEKTE[raumId]` bekommen optional:
- `aufnehmen: "gegenstand_id"` — Klick → Figur läuft zum `laufziel` → `nimmAufGegenstand()` fügt ins Inventar, markiert `obj.aufgenommen = true`.
- `akzeptiert: { gegenstand_id: (s, id) => {...} }` — Drop-Target. Callback entscheidet, ob der Gegenstand verbraucht wird (`verbrauche(id)`).
- `zeichnen: (ctx) => {...}` — Canvas-Rendering (wenn das Objekt keinen SVG-Anteil hat).

Türen können auch `akzeptiert` haben (z.B. Schlüssel auf Schloss).

**Drag & Drop** ist Pointer-basiert (kein HTML5-DnD), damit Touch und Canvas-Drop funktionieren:
- `pointerdown` auf Inventar-Slot → `starteDrag()` mit `setPointerCapture`
- `#drag-preview` (position: fixed) folgt der Maus
- `pointerup` → `versucheDrop(clientX, clientY, id)` prüft, ob ein Objekt oder eine Tür unter der Maus `akzeptiert[id]` hat → Figur läuft hin → Callback

## Laufen + Raumwechsel-Fade

**Laufen vor Interaktion:** Klick auf Tür/Objekt startet NICHT sofort die Aktion. Stattdessen läuft die Figur zum `laufziel`. `figur.ankunft` ist ein einmaliger Callback, der beim Ankommen ausgelöst wird:

```js
figur.ankunft = () => starteRaumwechsel("buero");        // bei Tür-Klick
figur.ankunft = () => zeigeAufgabe("bookshelf_umfang");  // bei Objekt-Klick
figur.ankunft = () => nimmAufGegenstand(obj);            // bei Aufnehm-Objekt
```

Klick auf Boden, `wechsleRaum`, oder Stop wegen Hindernis verwirft `ankunft`.

**Fade-Transition:** `starteRaumwechsel(zielId)` blendet `#fade`-Div schwarz ein (220 ms), ruft `wechsleRaum`, blendet aus. `wechselInGang`-Flag blockt Klicks während der Transition.

## Sound (Web Audio, keine Dateien)

Schrittsounds live via Web Audio API: weisser Noise-Burst durch Tiefpassfilter zum dumpfen „Thud". Vier Varianten in `SCHRITT_VARIANTEN` (220–310 Hz, 80–100 ms, Gain 0.17–0.22) round-robin + ±3 % Frequenz-Jitter pro Schritt.

`audioCtx` wird beim ersten `pointerdown` via `ensureAudio()` initialisiert (Safari/Chrome starten oft `suspended` → `audioCtx.resume()`). `spieleSchritt()` feuert in `aktualisiereFigur`, wenn die Gehphase π oder 2π überquert. `beendeSchrittWennInLuft()` beim Ankommen.

Konsolen-Helfer: `soundAnAus(true|false)`, `soundTest()`.

## Input / Loop

```
Seitenladen → requestAnimationFrame → baueRaumDeko() → resizeCanvas() → loop()
loop(): aktualisiereFigur() → draw() → requestAnimationFrame(loop)
canvas.pointerdown:
    → Tür-Polygone? → figur läuft hin → ankunft = starteRaumwechsel()
    → OBJEKTE? → figur läuft hin → ankunft = zeigeAufgabe() oder nimmAufGegenstand()
    → sonst: screenZuBoden → setzeFigurZiel() (mit Clamp + Snap aus Hindernissen)
window.resize → resizeCanvas()
```

## Deko-Generatoren (JS-seitig)

```js
makeSVG(tag, attrs, kinder)        // SVG-Element-Factory (namespaced)
erzeugeStrauch({fu, fv, bw, v})    // <g> mit transformierter Strauch-Grafik
baueGartenDeko()                   // füllt <g data-raum="garten"> mit 12 Sträuchern (idempotent)
baueRaumDeko()                     // Dispatch + klonePflanzenVorne(); 1× beim Start
klonePflanzenVorne()               // klont alle [data-fv]-Elemente in #object-layer-vorne
ladeBuschBild(src)                 // cached Image-Loader für Detail-Büsche
zeichneBuschBild(def)              // rendert einen Detail-Busch via drawImage
```

Init-Reihenfolge: **`baueRaumDeko()` VOR `resizeCanvas()`**.

## Stolpersteine

- **Cache-Busting:** bei Änderungen an `script.js` oder `style.css` das `?v=N` in `index.html` hochzählen. Sonst hängt die alte Version im Browser-Cache.
- **Pflanzen-/Tisch-Position ändern:** `HINDERNISSE` (Kollision) UND `data-fv` im HTML (Tiefensortierung) UND Transform (Rendering) müssen synchron bleiben.
- **Möbel vor Pflanzen im DOM:** Tisch1 + Lavalampe sind in `<g id="haupt-moebel">` VOR `<g id="plants">` — sonst überdeckt der Tisch die davor stehenden Pflanzen.
- **`<image href>` in SVG** unter file://: nicht zuverlässig für externe SVG-Referenzen (skeleton_1 lud nicht). Inline-SVG ist Fallback.
- **Detail-Büsche per `drawImage`** statt `<image href>` — damit der Zaun sie verdecken kann (würde in der SVG-Mittel-Ebene nicht gehen).
- **SVG-Filter `filter="url(#name)"`** statt CSS-Filter — robuster (#grell für Bookshelf-Sättigung, #invert für Skelett-Farbinversion).
- **Body-CSS:** `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none` — verhindert Scroll/Verschieben.
- **Startbildschirm** ist in `index.html` ausgeklammert; Auto-Start am Ende von `script.js`.

## Roadmap

**Aktueller Stand:** Infrastruktur, Spielstand, Aufgaben-UI, Inventar + Drag & Drop, Kollision (Kreise + Ellipsen) + Tiefensortierung — alles drin. Demo-Aufgabe `bookshelf_umfang` mit Cross-Room-Lookup funktioniert.

**Phase 4: Inhalte (mit Manuel)**
- 10–15 Kreis-Aufgaben (Umfang, Fläche, Durchmesser, Radius)
- Linearer Lösungsweg I → II → III → IV, aber Infos aus Raum A werden in Raum C gebraucht
- 5 Räume mit zusätzlichen Möbeln/Aufgaben-Objekten ausstatten

**Phase 5 Restpunkte (nach Phase 4)**
- Hinweise bei falscher Antwort (pro Aufgabe konfigurierbar)
- `localStorage` für Fortschritt (erst nach Phase 4 sinnvoll)

## Git-Workflow

Remote: `https://github.com/Manuel-Benz/Spiel_Kreise_1`. Solo auf `main`.

Nach jedem Schritt:
```bash
git status                             # was hat sich geändert
git diff                               # konkrete Änderungen ansehen (optional)
git add index.html script.js style.css CLAUDE.md   # explizit, nicht "git add ."
git commit -m "Kurze Beschreibung"
git push
```

`git pull` ist nur nötig, wenn du auf github.com direkt editiert hast oder von einem anderen Rechner kommst.
