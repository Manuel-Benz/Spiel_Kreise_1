# CLAUDE.md – Projektübersicht für neue Chat-Sessions

Dieses Dokument erklärt Claude die Architektur des Projekts, damit ein neuer Chat sofort weiterarbeiten kann.

## Projektkontext

Ein interaktives Mathe-Lernspiel für den Schulunterricht (Thema: Kreise), aufgebaut als **Escape-Room-artiges Abenteuer**: 5 Räume, lineare Aufgaben-Progression mit Cross-Room-Lookups.

Gebaut als **Vanilla HTML/CSS/JS** – kein Build-Tool, kein Framework.
Entwickler: Manuel Benz (Lehrer, wenig Programmiererfahrung).
GitHub-Repo: `Manuel-Benz/Spiel_Kreise_1`.

## Dateistruktur

```
index.html        ← 2 Canvases + 2 SVG-Layer (hinten + vorne) mit Deko-Gruppen pro Raum
style.css         ← Layout, Stage-Styling, Canvas/SVG-Positionierung, Inventar & Drag-Preview
script.js         ← Räume, Türen, Figur, Deko-Generatoren, Input, Loop, Inventar, Kollision, Tiefensortierung
assets/           ← SVG-Dateien
  plant_*.svg     ← Einzelpflanzen (tulpe, blume, yucca, geranie, setzling, kraeuter, gras, blattpflanze, strauch)
  bush_1..4.svg   ← Detail-Büsche für Garten
  bookshelf_1.svg ← (noch nicht aktiv verwendet, Inline-SVG in HTML)
  skeleton_3.svg  ← Tanzendes Skelett im Keller
  skeleton_1/2.svg← nicht aktiv (laden unter file:// unzuverlässig)
  human_1_left.svg← (nicht aktiv)
CLAUDE.md         ← diese Datei
```

Cache-Busting in `index.html`: aktuell `style.css?v=17`, `script.js?v=58` — bei Änderungen hochzählen.

## Rendering-Ebenen (hinten → vorne)

**Zwei Canvases und zwei SVG-Ebenen** — die zweite SVG-Ebene liegt ÜBER dem Figur-Canvas, damit Pflanzen perspektivisch VOR der Figur sichtbar werden können:

1. `#game-canvas` (`ctxRaum`) — Zimmer (Wände, Boden, Decke), Türen, sowie **Raum-spezifisches Canvas-Drawing** (Garten-Zaun, Sonne, Gebüsch, rasterisierte Detail-Büsche)
2. `#object-layer` (SVG, viewBox `0 0 1600 900`) — pro Raum eine Deko-Gruppe `<g data-raum="…">`; JS blendet per `display` um. Bookshelf, Skelett, Sträucher und Pflanzen-Originale sitzen hier.
3. `#figure-canvas` (`ctxFigur`) — nur die animierte Figur
4. `#object-layer-vorne` (SVG, gleiche viewBox) — Klone der Pflanzen mit `data-fv`; per Frame togglet JS pro Pflanze Sichtbarkeit zwischen Rück- und Front-Ebene

In `script.js` wird `let ctx` (mutable) in `draw()` zwischen `ctxRaum` und `ctxFigur` umgeschaltet:

```js
function draw() {
    ctx = ctxRaum;  clearRect; zeichneZimmer(); zeichneTueren(); zeichneObjekte();
    ctx = ctxFigur; clearRect; zeichneFigur();
    aktualisierePflanzenTiefe();   // SVG-Pflanzen zwischen vorne/hinten togglen
}
```

`resizeCanvas()` setzt beide Canvases auf dieselbe DPR-aware Pixelgrösse. Klicks landen auf `#game-canvas`; `#figure-canvas` und beide SVGs haben `pointer-events: none`.

## Koordinatensystem

Logisch: **1600 × 900** (16:9). Stage-Grösse wird in JS berechnet (`resizeCanvas`).

```js
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
```

## Zimmer-Geometrie (perspektivisches 2D-Zimmer)

Alle Räume teilen sich dieselbe Geometrie; nur Farben und Deko unterscheiden sich.

```js
const ZIMMER = {
    decke:       [[0,0],[300,100],[1300,100],[1600,0]],
    boden:       [[0,900],[300,600],[1300,600],[1600,900]],
    linkeWand:   [[0,0],[300,100],[300,600],[0,900]],
    rechteWand:  [[1600,0],[1300,100],[1300,600],[1600,900]],
    hintereWand: [[300,100],[1300,100],[1300,600],[300,600]],
};
```

Fluchtpunkt ca. (800, 225). Horizont y=225 (fv=1). Perspektive-Skala **`s = 1 - 0.45·fv`**.

### Boden- & Wand-Koordinaten

```js
bodenPunkt(fu, fv)     // fu 0..1 links→rechts, fv 0..1 vorne→hinten
screenZuBoden(x, y)    // inverse, liefert null ausserhalb Boden
linkeWandPunkt(u, v)   // u 0..1 Tiefe, v 0..1 Boden→Decke
rechteWandPunkt(u, v)
```

### fuellePolygon-Signatur

```js
fuellePolygon(polygon, farbe, nahtlos = false)
```

`nahtlos: true` fügt einen 1-px-Stroke in der Fill-Farbe hinzu → schliesst Subpixel-Säume zu gleichfarbigen Nachbar-Polygonen. Nur im Garten nötig (gleichfarbige Himmel- und Grasflächen); andere Räume nutzen den Default (feine Eckenlinie bleibt sichtbar).

## Raum-System

Aktuell **5 Räume** über das `RAEUME`-Objekt konfiguriert:

| ID | Name | Türen → Ziel | Besonderheiten |
|---|---|---|---|
| `haupt` | Hauptraum | A→Büro, B→Fitness, L→Garten, geheim→Keller | Bookshelf + 6 Pflanzen (mit Tiefensortierung + Kollision) |
| `buero` | Büro | Pfeil→Haupt, F→Fitness | warmes Braun, Holzboden, Demo-Notizzettel am Boden |
| `fitness` | Fitnessraum | Pfeil→Haupt, B→Büro | kühles Blau |
| `garten` | Garten | H→Haupt | Himmel, Wiese, Zaun, Sonne, 12 Sträucher + 4 Detail-Büsche (bush_1..4) |
| `keller` | Keller | H→Haupt | dunkel, tanzendes Skelett hinten rechts |

`aktuellerRaum` hält die aktive ID. `wechsleRaum(zielId)`:
- merkt sich `vonRaum = aktuellerRaum`, setzt `aktuellerRaum = zielId`
- blendet alle `<g data-raum>` ausser dem Ziel auf `display:none` — **in beiden SVG-Ebenen** (Rück- und Front-Layer)
- **Eintrittsposition richtungsabhängig:** Sucht im Zielraum die Tür, deren `ziel === vonRaum`, und nutzt deren `laufziel` als Figur-Position. Fallback: `RAUM_EINTRITT = {fu: 0.5, fv: 0.3}`
- `eintrittsRichtung(fu, fv)` setzt `figur.richtung` so, dass die Figur „in den Raum" schaut (fu<0.2 → rechts, fu>0.8 → links, fv>0.8 → vorne, fv<0.2 → hinten)
- ruft `draw()`

Klick-Handler prüft **zuerst Tür-Polygone** → `starteRaumwechsel()` (Fade), dann interaktive Objekte → Aufgabe/Aufnehmen, sonst Bodenpunkt → Figur läuft.

## Türen pro Raum

Jede Tür hat `polygon`, `ziel` (Raum-ID), `laufziel: {fu, fv}` (Zielpunkt vor der Tür), optional `label`/`secret`/`pfeil`/`schloss`/`akzeptiert`.

- **Hauptraum:** A, B an hinterer Wand (x 460–640 / 960–1140), L an linker Wand (`seitenTuerPolygon(linkeWandPunkt)`), geheim an rechter Wand (kleiner, wandfarben).
- **Büro / Fitness:** `zurueck` als **2D-Pfeil** unten am Bildrand (`PFEIL_POLYGON`, y=820–880, "fake 3D" flach). Dazu seitliche Durchgangstür (F bzw. B).
- **Garten / Keller:** einzelne Rück-Tür an rechter bzw. linker Wand.
- **Gap zwischen Tür A und Tür B im Hauptraum:** x = 640..960 (hier sitzt das Bookshelf).

## Farb-Palette

Graustufen-Palette `GRAU.bX` (X=0..100, `b0`=weiss, `b100`=schwarz):

```js
GRAU = { b0:"#ffffff", b20:"#cccccc", b40:"#999999", b50:"#808080",
         b60:"#666666", b70:"#4d4d4d", b80:"#333333", b90:"#1a1a1a", b100:"#000000" };
```

Figur- und Tür-Farben global in `FARBEN`. Raum-Wandfarben in `RAEUME[id].farben` (decke/boden/hintereWand/linkeWand/rechteWand).

Body-Background: schwarz (`#000`).

## Figur (abstrakt)

Komplett schwarz, Augen + Mund weiss. Keine Haare/Schuhe/Ohren.

```js
figur = { fu, fv, zielFu, zielFv, richtung, geschwindigkeit:0.016, gehphase:0, ankunft:null }
const GEHPHASE_SCHRITT = 0.36, BEIN_HUB = 0.22, FIGUR_SKALA = 1.0;
```

Laufbereich-Clamp (damit der Körper nicht in die Wände ragt):

```js
const FIGUR_FU_MIN = 0.06, FIGUR_FU_MAX = 0.94;
const FIGUR_FV_MIN = 0,    FIGUR_FV_MAX = 0.97;
```

`zeichneFigur()` (top-down): Beine mit Sinus-Gehanimation, Körper (Seitenansicht breiter), Arme (frontal beidseits, seitlich mit Schwung), Hals, Kopf, Gesicht. **Nase-Rotation frontal: `Math.PI/12` (15°).** Kopf sitzt ein kleines Stück (`5*s`) tiefer als geometrisch ideal, damit die Hals-Rundungen vom Kopf überdeckt werden.

Bei Bewegung zeigt `figur.richtung` immer in die **tatsächliche** Laufrichtung — beim Slide um ein Hindernis dreht sich die Figur entsprechend.

## Bookshelf (Hauptraum, hintere Wand)

Inline-SVG in `index.html` unter `<g data-raum="haupt">`. Container:
```
<g id="bookshelf" transform="translate(650 310) scale(0.5)" filter="url(#grell)">
```

5 Regale, handgezeichnet mit `<rect>`, Pflanzen (Gras, Blattpflanze) in Regal 1 und 5.

**Sättigungs-Filter** `#grell` in `<defs>` (`feColorMatrix saturate 2`).

Zusätzliche Interaktionen über `OBJEKTE.haupt[0]`:
- `aufgabe: "bookshelf_umfang"` — Aufgaben-Overlay bei Klick (Phase 3)
- `akzeptiert: { notizzettel: (s) => zeigeOverlayText("…r = 5 cm") }` — Drop-Target für Drag & Drop vom Inventar (Phase 6)

## Pflanzen im Hauptraum (6 Stück)

Inline-SVG-Gruppen in `<g id="plants">` (Wrapper innerhalb von `<g data-raum="haupt">`), inhaltskorrigiert skaliert. Transform-Muster: `translate(bx, by) scale(σ) translate(-256, -512)` — verankert Topfboden (256, 512) im viewBox an Bodenpunkt.

Formel: `σ = s · basisBreite / 512`. Sichtbare Breite berücksichtigt **Inhaltsratio** (z. B. blume 52 %, yucca 88 %, kraeuter 99 %).

Jede Pflanze hat ein **`data-fv`-Attribut** (ihre fv-Koordinate), damit die Tiefensortierung weiss, ob die Figur davor oder dahinter läuft. Positionen:

| Pflanze | fu | fv | bw | r (Kollision) |
|---|---|---|---|---|
| tulpe | 0.15 | 0.12 | 175 | 0.05 |
| blume | 0.87 | 0.15 | 175 | 0.05 |
| kraeuter | 0.85 | 0.45 | 92 | 0.025 |
| setzling | 0.12 | 0.50 | 118 | 0.035 |
| geranie | 0.94 | 0.78 | 100 | 0.03 |
| yucca | 0.08 | 0.85 | 104 | 0.03 |

Radien orientieren sich am Fussabdruck (Topfbasis), nicht am Blattwerk. So kann die Figur knapp an den Pflanzen vorbeilaufen; ihr Körper verschwindet perspektivisch hinter den Blättern.

## Garten (Spezialfall)

Im Garten sind decke, linkeWand und hintereWand alle Himmelsblau. `zeichneZimmer()` hat deshalb einen **Sonderweg**: statt drei separater Polygone (mit sichtbaren Säumen) füllt ein einziger `fillRect` den ganzen Hintergrund mit Himmel, dann werden Boden (nahtlos) und rechte Hauswand als Polygone drübergezeichnet.

Rendering in `zeichneGartenZaun()` (auf `ctxRaum`):

**Reihenfolge:**
1. `zeichneSonne()` — gelber Kreis + 12 Strahlen bei (1200, 200), r=42
2. **Horizont-Silhouetten** (ohne `vor`-Flag, Büsche 1/4/7) — werden gleich vom Gras halb verdeckt
3. **Grashorizont** + **linke Wiese** — beide mit `nahtlos: true` (schliesst Gras-Säume)
4. **Horizont-Büsche mit `vor: true`** (Büsche 2/3/5/6) — stehen auf dem Gras, voll sichtbar
5. **Nah-Büsche** (Canvas-Ellipsen) auf linker Wiese (3 Stück)
6. **bush_4** (Detail-Busch, SVG via `drawImage`) — auf linker Wiese
7. **bush_1** + **bush_3** (Detail-Büsche) — hinter Hintenzaun
8. **Zaun hinten** — 9 Pfosten + 2 Verstrebungen, y=420–600 (verdeckt Teile der hinteren Büsche)
9. **bush_2** (Detail-Busch) — oberhalb des Zauns, voll sichtbar
10. **Zaun links** — perspektivisch via `linkeWandPunkt(u, v)`, 8 Pfosten
11. **Rechte Hauswand nachzeichnen** — damit Detail-Büsche, die über x=1300 ragen, sauber abgeschnitten werden

**Horizont-Büsche** (`GEBUESCH_HORIZONT`): Array von `{cx, cy, b, f, vor?}`. `vor: true` → nach Gras gezeichnet (voll sichtbar).

**Detail-Büsche** (`BUESCHE`): SVGs aus `assets/bush_1..4.svg`, als `Image`-Objekte geladen (`ladeBuschBild`) und per `ctx.drawImage` auf den Zimmer-Canvas gerastert. Konfig-Objekt:
```js
BUESCHE = {
    linksWiese:  { src: "assets/bush_4.svg", cx, baseY, breite, hoehe },
    hintenTief:  { src: "assets/bush_1.svg", ... },
    hintenGanz:  { src: "assets/bush_2.svg", ... },
    hintenHalb:  { src: "assets/bush_3.svg", ... },
}
```
`baseY` ist die Fusslinie auf dem Bildschirm. Renderreihenfolge entscheidet, ob der Zaun den Busch verdeckt (bush_1/3 vor dem Zaun gezeichnet = Zaun-Verdeckung; bush_2 nach dem Zaun = voll sichtbar).

**bush_4 Konturen:** Die SVG-Datei hat am äusseren `<g>` `stroke-width="25" stroke-linejoin="round" stroke-linecap="round"` gesetzt. Jeder Pfad hat zusätzlich `stroke="{sein eigener fill}"` — dadurch „puffen" die Pfade minimal, aber es entsteht KEINE sichtbare schwarze Outline (angrenzende Flächen behalten ihr Farbgefühl).

**Sträucher im Garten** (12 Stück) liegen im SVG-Layer `<g data-raum="garten">`, durch `baueGartenDeko()` beim Start erzeugt. 4 Varianten (`STRAUCH_VARIANTEN`) mit unterschiedlichen Blatt-Auswahlen und Grüntönen. Pfade stammen aus `assets/plant_strauch.svg` (Boden entfernt, 5 Blatt-Cluster + 1 Ast-Pfad).

## Keller

- Wände/Decke/Boden in dunklen Grautönen (`b80`/`b100`/`b90`)
- **Skelett** aus `assets/skeleton_3.svg` via `<image href>`, perspektivisch platziert hinten rechts (fu=0.90, fv=0.85, Füsse bei (1236, 645)). Grösse 177×250 (10 % grösser als Ursprung).
- Farbe-Invertierung via SVG-Filter `#invert` (schwarz → weiss)
- Schaukel-Animation: `<animateTransform type="rotate">` um die Füsse, ±6°, 2.5 s, Ease-in-out-Spline

## Inventar + Drag & Drop (Phase 6, abgeschlossen)

### Gegenstände

```js
const GEGENSTAENDE = {
    id: {
        name: "Notizzettel",
        icon: `<svg viewBox="0 0 48 48">…</svg>`,
    },
};
```

Inventar-Zustand: `spielstand.gegenstaende` (Set von IDs). Rendert in `#inventar` (Panel rechts oben), hidden wenn leer.

### Aufnehmen & Drop-Targets

Objekte in `OBJEKTE[raumId]` bekommen optional:
- `aufnehmen: "gegenstand_id"` — Klick → Figur läuft zum `laufziel` → `nimmAufGegenstand()` fügt ins Inventar, markiert `obj.aufgenommen = true` (Objekt verschwindet).
- `akzeptiert: { gegenstand_id: (spielstand, id) => {...} }` — Drop-Target für Drag & Drop. Callback entscheidet, ob der Gegenstand verbraucht wird (`verbrauche(id)`).
- `zeichnen: (ctx) => {...}` — Canvas-Rendering, wenn das Objekt keinen eigenen SVG-Anteil hat.

Türen können ebenfalls `akzeptiert` haben (z. B. Schlüssel auf Schloss ziehen).

### Drag & Drop

Pointer-basiert (kein HTML5-DnD), damit Touch und Canvas-Drop funktionieren:
- `pointerdown` auf Inventar-Slot → `starteDrag()` mit `setPointerCapture`
- `#drag-preview` (position: fixed) folgt der Maus
- `pointerup`: `versucheDrop(clientX, clientY, id)` prüft, ob ein Objekt oder eine Tür unter der Maus `akzeptiert[id]` hat → Figur läuft hin → Callback

### Demo

- **Notizzettel** liegt im Büro auf dem Boden (Canvas-gezeichnet via `zeichnen`-Callback).
- Aufnehmen → Icon im Inventar.
- Drag auf Bookshelf im Hauptraum → Overlay: „Auf dem Notizzettel steht: r = 5 cm"

### Dev-Helfer

```js
gegenstandHinzufuegen("notizzettel")
gegenstandEntfernen("notizzettel")
verbrauche("notizzettel")              // Alias — praktisch in akzeptiert-Callbacks
```

## Kollision + Hindernis-Umgehung (Phase 7 Teil 1)

### Hindernisse (Kreise im fu/fv-System)

```js
const HINDERNISSE = {
    haupt: [
        { fu: 0.08, fv: 0.85, r: 0.03 },   // yucca
        // ...
    ],
    // andere Räume: []
};
```

Radien sind an der Pflanzen-Topfbasis orientiert — klein genug, dass Türen nicht blockiert werden, gross genug, dass die Figur-Mitte nicht durch die Pflanze läuft.

### Ziel-Snap

`setzeFigurZiel(fu, fv)` verschiebt das Ziel automatisch auf die Hindernis-Kante, wenn es innerhalb eines Kreises liegt. Dadurch bleiben Tür-Laufziele erreichbar, auch wenn sie nahe einer Pflanze liegen (Safety Net — müssen nicht manuell getunt werden).

### Slide um Hindernisse

`aktualisiereFigur()` prüft jeden Schritt. Wäre der nächste Schritt in einem Hindernis:
- `slideUmHindernis(ux, uy, schritt)` sucht das blockierende Hindernis (nur wenn in Laufrichtung, senkrechter Versatz ≤ r + 0.02)
- Berechnet Tangenten-Richtung senkrecht zu Figur→Hindernis, wählt die Seite mit positivem Dot zur gewünschten Laufrichtung
- Figur macht den Tangent-Schritt statt zu stoppen → „gleitet" an der Pflanze entlang, bis der direkte Pfad wieder frei ist

Fallback: Falls auch der Slide in ein Hindernis führen würde, stoppt die Figur doch. In der Praxis bei sparsamen Hindernissen fast nie.

## Tiefensortierung für Pflanzen (Phase 7 Teil 2)

Architektur-Problem: Der Figur-Canvas liegt fix zwischen den SVG-Ebenen. Damit die Figur je nach Tiefe VOR oder HINTER einer Pflanze erscheinen kann, liegen Pflanzen in zwei Ebenen.

### Setup

1. Jede Pflanze im HTML hat ein `data-fv="…"`-Attribut (ihre fv-Koordinate).
2. Zweite SVG-Ebene `#object-layer-vorne` ÜBER dem Figur-Canvas (in `index.html` nach `<canvas id="figure-canvas">` eingefügt, gleiche viewBox, `pointer-events: none`).
3. `klonePflanzenVorne()` läuft einmal im Init (via `baueRaumDeko()`): für jede `<g data-raum>` in der Rück-Ebene wird eine gleichnamige Gruppe in der Front-Ebene erzeugt, und ALLE Elemente mit `data-fv` (rekursiv — z. B. aus `<g id="plants">`) werden hineingeklont.

### Toggle pro Frame

`aktualisierePflanzenTiefe()` läuft am Ende jedes `draw()`:
- Für jede Pflanze in Rück-Ebene: `display: none`, wenn `figur.fv > pflanze.fv` (Figur tiefer → Pflanze soll vorne sein). Sonst sichtbar.
- Für jede Pflanze in Front-Ebene: umgekehrt.

Das Ergebnis: Je nach Position der Figur erscheint jede Pflanze entweder in der hinteren Ebene (Figur überdeckt sie) oder in der vorderen Ebene (Pflanze überdeckt Figur).

### Bookshelf / Skelett / Sträucher

Diese haben KEIN `data-fv` und bleiben nur in der Rück-Ebene (werden nicht sortiert). Das ist OK, weil sie perspektivisch immer hinter der Figur stehen (Bookshelf an der Wand; Skelett hinten; Sträucher im Garten neben dem Figur-Laufbereich).

### Raumwechsel

`wechsleRaum()` togglet `<g data-raum>`-Sichtbarkeit in **beiden** SVG-Ebenen simultan.

## Deko-Generatoren (JS-seitig)

```js
makeSVG(tag, attrs, kinder)        // SVG-Element-Factory (namespaced)
erzeugeStrauch({fu, fv, bw, v})    // liefert <g> mit transformierter Strauch-Grafik
baueGartenDeko()                   // füllt <g data-raum="garten"> mit 12 Sträuchern (idempotent)
baueRaumDeko()                     // Dispatch für alle Räume + klonePflanzenVorne(); wird 1× beim Start aufgerufen
klonePflanzenVorne()               // klont alle [data-fv]-Elemente in #object-layer-vorne
ladeBuschBild(src)                 // cached Image-Loader für Detail-Büsche (drawImage-basiert)
zeichneBuschBild(def)              // rendert einen Detail-Busch auf den aktuellen Canvas
```

Kanonisch: **Init ruft `baueRaumDeko()` vor `resizeCanvas()` auf.**

## SVG-Helfer (älter, ungenutzt)

```js
ladeSVG(pfad)                  // fetch + DOMParser (braucht lokalen Server unter file://)
platziereAufBoden(svgRoot, …)
platziereImZimmer(svgRoot, …)
entferneAlleSVGs()
```

Aktuell nicht aktiv gebraucht; bei Bedarf über lokalen Server (`python3 -m http.server 8000`).

## Input / Loop

```
Seitenladen → requestAnimationFrame → baueRaumDeko() → resizeCanvas() → loop()
loop(): aktualisiereFigur() → draw() → requestAnimationFrame(loop)
canvas.pointerdown:
    → prüft Tür-Polygone → figur läuft hin → ankunft = starteRaumwechsel() (bei Treffer)
    → prüft OBJEKTE → figur läuft hin → ankunft = zeigeAufgabe() oder nimmAufGegenstand()
    → sonst: screenZuBoden → figur.zielFu/zielFv (mit Clamp, mit Snap aus Hindernissen)
window.resize → resizeCanvas()
```

## Bekannte Eigenheiten / Stolpersteine

- **Cache-Busting:** bei Änderungen an `script.js` oder `style.css` das `?v=N` in `index.html` hochzählen. HTML selbst hat kein Busting → Hard-Refresh.
- **Zwei Canvases + zwei SVGs:** jede Renderänderung muss auf die richtige Ebene gelangen. In `draw()` wird `ctx` umgeschaltet; `aktualisierePflanzenTiefe` togglet die SVG-Ebenen.
- **SVG-Filter `filter="url(#name)"`** (grell, invert) statt CSS-Filter — robuster.
- **CSS `pointer-events: none`** auf Figur-Canvas und beiden SVG-Layern, damit Klicks zum `game-canvas` durchreichen.
- **Body: `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none`** — verhindert Scroll/Verschieben.
- **Startbildschirm** ist in `index.html` ausgeklammert; Auto-Start am Ende von `script.js`.
- **`<image href>` in SVG** unter file://: funktioniert je nach Browser nicht zuverlässig für externe SVG-Referenzen (skeleton_1 lud nicht). Inlining ist Fallback.
- **Detail-Büsche** (bush_1..4) werden per `drawImage` auf den Canvas gerastert — damit der Zaun sie verdecken kann (was mit `<image href>` in der mittleren SVG-Ebene nicht ginge).
- **Pflanzen-Positionen ändern:** `HINDERNISSE` (für Kollision), `data-fv` im HTML (für Tiefensortierung) und Transform (für Rendering) müssen synchron bleiben.

## Spielstand + Türen-Schlösser (Phase 2, abgeschlossen)

```js
const spielstand = {
    geloesteAufgaben: new Set(),       // IDs gelöster Aufgaben
    freigeschalteteTueren: new Set(),  // eingesammelte Schlüssel-IDs
    inventar: {},                      // gefundene Zahlen / Infos
    gegenstaende: new Set(),           // Inventar-Gegenstände (Phase 6)
};
```

**Türen-Schlösser** via optionalem `schloss: "<schluessel-id>"` am Tür-Objekt. `istFrei(tuer)` = `true`, wenn entweder kein Schloss gesetzt ist oder der passende Schlüssel in `spielstand.freigeschalteteTueren` liegt.

Klick auf verschlossene Tür → Overlay mit Hinweis, kein Raumwechsel. Offene Tür → wie bisher.

**Visuals:** `zeichneSchloss(cx, cy, groesse)` zeichnet ein weisses Schloss (Bügel + Korpus + Schlüsselloch) unten in der Tür. **Auf `secret: true`-Türen wird KEIN Schloss gezeichnet**, damit sie versteckt bleiben.

**Aktuell verschlossene Türen (Default):**
- Geheim-Tür im Hauptraum → Keller (`schloss: "keller_schluessel"`)

**Dev-Helfer in der Browserkonsole:**
```js
freischalten("keller_schluessel")   // Schlüssel hinzufügen
verschliessen("keller_schluessel")  // Schlüssel entfernen
spielstand                           // aktueller Zustand
```

## Overlay (Phase 2 + 3)

HTML-Struktur in `index.html` unter `#game-container`:
```html
<div id="overlay" hidden>
    <div id="overlay-box">
        <button id="overlay-close">×</button>
        <div id="overlay-inhalt"></div>
    </div>
</div>
```

`#overlay-inhalt` wird per JS dynamisch befüllt — entweder mit einem Info-Text oder mit einem Aufgaben-Formular.

Funktionen:
- `zeigeOverlayText(text)` — einfacher Info-Text (z.B. "Tür verschlossen.")
- `zeigeOverlay(text)` — Alias, rückwärtskompatibel
- `zeigeAufgabe(aufgabenId)` — baut Aufgaben-UI (KaTeX-Formel, Input, Prüfen-Button, Feedback)
- `schliesseOverlay()` — räumt `#overlay-inhalt` leer und blendet aus

Schliessen via ×-Button, Klick auf dunklen Hintergrund oder `Esc`.

## Aufgaben-Infrastruktur (Phase 3, abgeschlossen)

```js
const AUFGABEN = {
    aufgabeId: {
        frage:     "Textfrage oder (spielstand) => string",  // Dynamisch → Cross-Room-Lookup
        formel:    "U = 2 \\pi r",                            // KaTeX (optional)
        fragetext: "Detailfrage mit Werten (in cm).",        // Optional
        loesung:   31.4,                                      // Zahl
        toleranz:  0.2,                                       // maximaler Fehler
        bei_richtig: {
            schluessel:     "keller_schluessel",              // optional: wird in spielstand.freigeschalteteTueren aufgenommen
            inventar:       { umfang_demo_cm: 31.4 },         // optional: spielstand.inventar wird erweitert
            belohnung_text: "Richtig! ...",                   // optional: Feedback-Text bei Erfolg
        },
    },
};

const OBJEKTE = {
    haupt: [{ id: "...", aufgabe: "aufgabeId", polygon: [...],
              laufziel: {...}, akzeptiert: {...} /* Phase 6 */ }],
    // andere Räume analog, leere Arrays als Platzhalter
};
```

**Klick-Pipeline:** `pointerdown` → Tür? → Objekt? → Boden. `pointermove` setzt `cursor: pointer`, wenn unter dem Cursor eine Tür oder ein aktives Objekt liegt.

**`objektIstAktiv(obj)`**: aktiv, wenn nicht `aufgenommen` UND (Aufgabe definiert ODER `aufnehmen` gesetzt ODER `akzeptiert` gesetzt).

**`pruefeAntwort(id, eingabe, ...)`**: vergleicht per Toleranz (`Math.abs(zahl − loesung) ≤ toleranz`). Komma wird zu Punkt normalisiert. Bei Erfolg: `spielstand.geloesteAufgaben.add(id)`, Schlüssel und Inventar aus `bei_richtig` anwenden, `draw()`, Input + Button deaktivieren.

**Cross-Room-Lookups:** `frage` und `fragetext` können Funktionen sein, z.B. `frage: (s) => \`Der Umfang war ${s.inventar.umfang_demo_cm} cm.\``. So kann eine Aufgabe in Raum C einen Wert aus Raum A lesen.

**Aktuelle Demo-Aufgabe:** `bookshelf_umfang` — Klick aufs Bücherregal im Hauptraum, Umfang bei r=5 cm. Bei Erfolg: `keller_schluessel`, Inventar-Eintrag, Keller-Zugang offen.

## Sound (Web Audio, keine Dateien)

Schrittsounds werden live via `Web Audio API` synthetisiert: kurzer weisser Noise-Burst, durch Tiefpassfilter zu einem dumpfen „Thud". Vier Varianten in `SCHRITT_VARIANTEN` (Frequenz 220–310 Hz, Dauer 80–100 ms, Gain 0.17–0.22) werden **round-robin** durchlaufen, mit zusätzlich ±3 % Frequenz-Jitter pro Schritt.

`audioCtx` wird beim ersten `pointerdown` via `ensureAudio()` initialisiert. Safari/Chrome starten den AudioContext oft im Zustand `suspended` — `ensureAudio()` ruft deshalb immer `audioCtx.resume()` auf.

`spieleSchritt()` feuert in `aktualisiereFigur`, wenn die Gehphase π oder 2π überquert. Zusätzlich `beendeSchrittWennInLuft()` beim Ankommen (auch beim Stop wegen Hindernis).

Konsolen-Helfer:
- `soundAnAus(true|false)` — Sound global an/aus
- `soundTest()` — 3 Diagnose-Sounds; zeigt `audioCtx.state`

## Laufen + Raumwechsel-Fade (Phase 5, Teil 1+2)

**Laufen zum Ziel vor Interaktion:** Klick auf Tür oder Objekt startet NICHT mehr sofort die Aktion. Stattdessen läuft die Figur zum `laufziel`. `figur.ankunft` ist ein einmaliger Callback, der beim Ankommen ausgelöst wird.

```js
figur.ankunft = () => starteRaumwechsel("buero");   // bei Tür-Klick
figur.ankunft = () => zeigeAufgabe("bookshelf_umfang");  // bei Objekt-Klick
figur.ankunft = () => nimmAufGegenstand(obj);        // bei Aufnehm-Objekt (Phase 6)
```

Klick auf Boden setzt `figur.ankunft = null`. `wechsleRaum` räumt ebenfalls. Wird die Figur durch ein Hindernis gestoppt, wird der Callback ebenfalls verworfen.

**Fade-Transition beim Raumwechsel:** `starteRaumwechsel(zielId)` blendet via `#fade`-Div schwarz ein (220 ms), ruft `wechsleRaum`, blendet wieder aus. `wechselInGang`-Flag blockt Klicks während der Transition.

## Roadmap

**Abgeschlossen:**
- Phase 1: Infrastruktur + Deko (Räume, Türen, Figur, SVG-Layer)
- Phase 2: Spielstand + Schlösser + Overlay
- Phase 3: Aufgaben-UI mit KaTeX, Cross-Room-Lookups
- Phase 5 Teil 1+2: Fade-Transition + zur Tür/Objekt laufen
- Phase 6: Inventar + Drag & Drop
- Phase 7 Teil 1: Kollision + Slide-Umgehung
- Phase 7 Teil 2: Tiefensortierung für Pflanzen (Figur vor/hinter SVG-Pflanzen)

**Phase 4: Inhalte (mit Manuel)**
- 10–15 Kreis-Aufgaben (Umfang, Fläche, Durchmesser, Radius).
- **Linearer Lösungsweg I → II → III → IV**, aber **Infos aus Raum A werden in Raum C gebraucht**.
- 5 Räume gestalten (zusätzliche Möbel/Aufgaben-Objekte).

**Phase 5 Restpunkte (nach Phase 4)**
- Hinweise bei falscher Antwort (pro Aufgabe konfigurierbar).
- `localStorage` für Fortschritt (erst nach Phase 4 sinnvoll).

## Git / GitHub

- Remote: `https://github.com/Manuel-Benz/Spiel_Kreise_1`
- Workflow: `git add <datei>` → `git commit -m "Nachricht"` → `git push`
