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
assets/           ← SVGs (siehe Tabelle unten)
CLAUDE.md         ← diese Datei
```

| Asset | Verwendung | Einbindung |
|---|---|---|
| `plant_*.svg` (9×) | Pflanzen im Hauptraum + Sträucher im Garten | Inline-SVG |
| `painting_1.png`, `painting_2.png` | 2 Bilder an der hinteren Wand des Hauptraums | `<image href>` (PNG via `magick` aus den `.svg`-Quellen konvertiert; Original-SVGs zu groß für direkten Browser-Render: 1.8 MB / 14 MB) |
| `bush_1..4.svg` | Detail-Büsche im Garten | `drawImage` (Canvas, damit Zaun verdecken kann) |
| `table_1.svg`, `table_2.svg` | Holztisch Hauptraum / Schreibtisch Büro | Inline-SVG |
| `lamp_lava_1.svg`, `bookshelf_1.svg` | Originale; Inline-Varianten im Hauptraum | nicht direkt |
| `bookshelf_2.svg`, `chair_1.svg` | Bücherregal + Bürostuhl im Büro | Inline-SVG (kopiert) |
| `octopus_1.svg`, `duck_1.svg` | Tintenfisch + Quietscheente im Badezimmer | Inline-SVG |
| `bathtub_1_1/1_2.svg`, `toilet_2_1/2.svg` | Wanne + WC, je 2 Switch-States | Inline-SVG |
| `skeleton_3.svg` | Tanzendes Skelett im Keller | `<image href>` |
| `fireplace_1.svg` | Steinkamin im Keller | Inline-SVG |
| `cake_1.svg` | Torte auf Tisch 1 im Hauptraum | Inline-SVG |
| `cake_2.svg` | Torte auf desk_5 im Hauptraum | `<image href>` (war inline; wegen Gradient-Klon-Bug umgestellt — siehe Stolpersteine) |
| `candle_2.svg`, `candle_3.svg` | Templates für die ~50 Keller-Kerzen — Pfad-Inhalt in `KERZE_TEMPLATE_2/_3` (script.js) eingebettet, pro Kerze geklont mit ersetzten Wachs-Farben | als String-Templates in script.js |
| `chain_1.svg`, `chain_2.svg` | Ketten im Keller (Wand + Boden) | Inline-SVG |
| `chest_1.svg` | Schatztruhe im Keller | Inline-SVG |
| `flower_1..6.svg` | 6 Blumen im Garten (innen + aussen) | Inline-SVG |
| `muffin_1..4.svg` | 4 Muffins auf dem Boden im Hauptraum | Inline-SVG |
| `desk_1.svg` | Holz-Schreibtisch (3D-Perspektive) im Hauptraum hinten-rechts | Inline-SVG (Gradients durch solid #A57956 ersetzt — siehe Stolpersteine) |
| `desk_2.svg`, `desk_3.svg`, `desk_5.svg` | desk_3 + desk_5 als Beistelltische im Hauptraum; desk_2 DEAKTIVIERT (siehe Hauptraum) | Inline-SVG |
| `desk_4.svg` | Anrichte mit Schubladen, im Badezimmer | Inline-SVG |
| `cupboard_1..3.svg` | cupboard_2 im Badezimmer; cupboard_1 im Büro (gespiegelt); cupboard_3 im Hauptraum | `<image href>` mit Cache-Bust. cupboard_1: Asset geändert (Gradients entfernt). cupboard_2: Asset geändert (Holztöne 2× ~20% aufgehellt, dann manuelle User-Anpassungen, `?v=5`). cupboard_3: Asset geändert (Holztöne 2× aufgehellt + Richtung helleres Holz verschoben, dann viewBox auf 400×660 vergrößert mit Padding, `?v=4`). |
| `lamp_1.svg` | Pixar-Stil Schreibtischlampe (Schwenkarm, goldene Birne, gelblicher Schein) im Büro | Inline-SVG (IDs mit `l1_` prefixed gegen Konflikte; 9 Gradients erhalten) |
| `animal_1.svg`, `animal_2.svg` | Zwei Tiere/Kreaturen an der Wand im Keller (siehe Keller) | Inline-SVG (IDs mit `a1_`/`a2_` prefixed; animal_1 mit Gelb-Tint t=0.06; animal_2 hat 10 Gradients) |
| `toilet_1.svg`, `chair_2.svg`, `skeleton_1/2.svg`, `human_1_left.svg`, `desk_1.svg`, `desk_2.svg` | nicht aktiv (desk_1 + desk_2 sind im Code als `display:none` deaktiviert, siehe Hauptraum) | — |

**Cache-Busting** in `index.html`: aktuell `style.css?v=23`, `script.js?v=134`. Bei Änderungen an `script.js` oder `style.css` das `?v=N` hochzählen, sonst hängt die alte Version im Browser-Cache. Bei Änderungen an einem `<image href="assets/X.svg">`-Asset auch `?v=N` an den href anhängen — der Browser cached `<image>`-Sources separat.

## Rendering-Ebenen (hinten → vorne)

Vier Ebenen, damit Pflanzen perspektivisch VOR oder HINTER der Figur erscheinen können:

1. `#game-canvas` (`ctxRaum`) — Zimmer (Wände, Boden, Decke), Türen, Raum-spezifisches Canvas-Drawing (Garten-Zaun + Sonne, rasterisierte Detail-Büsche).
2. `#object-layer` (SVG, viewBox `0 0 1600 900`) — pro Raum eine Gruppe `<g data-raum="…">`. Bookshelf, Skelett, Sträucher, Pflanzen-Originale, Tische.
3. `#figure-canvas` (`ctxFigur`) — nur die animierte Figur.
4. `#object-layer-vorne` (SVG, gleiche viewBox) — Klone aller `[data-y-fuss]`-Elemente. Pro Frame togglet JS Sichtbarkeit zwischen Rück- und Front-Ebene → Pflanze überdeckt Figur, sobald `figur.fv > pflanze.fv`.

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
const FIGUR_FU_MIN = 0.06, FIGUR_FU_MAX = 0.94;
const FIGUR_FV_MIN = 0,    FIGUR_FV_MAX = 0.97;
```

Komplett schwarz, Augen + Mund weiss, keine Haare/Schuhe/Ohren. `zeichneFigur()` (top-down): Beine mit Sinus-Gehanimation, Körper, Arme, Hals, Kopf, Gesicht. `figur.richtung` zeigt immer in die TATSÄCHLICHE Laufrichtung — beim Slide um ein Hindernis dreht sich die Figur entsprechend.

## Räume

| ID | Name | Türen → Ziel | Wandfarben | Inhalt |
|---|---|---|---|---|
| `haupt` | Hauptraum | A→Büro, B→Badezimmer, L→Garten, geheim→Keller | b90/b90, Wände b70 | Bookshelf + 5 Pflanzen + painting_1 + Tisch1 (Lavalampe, cake_1) + 2 Muffins (auf Boden) + desk_3 (rotiert -2°, mit Pilzlampe + plant_setzling oben) + cupboard_3 + desk_5 (mit cake_2 + plant_geranie + muffin_1 obendrauf). desk_1 + desk_2 deaktiviert |
| `buero` | Büro | Pfeil→Haupt, F→Badezimmer | b90/b90, Wände b70 | Tisch2 + Tischlampe + Notizzettel + Bücherregal + Bürostuhl + cupboard_1 (gespiegelt) + lamp_1 (Pixar-Stil, vorne-links) |
| `badezimmer` | Badezimmer | Pfeil→Haupt, B→Büro | b90/b90, Wände b70 | Tintenfisch, 2 Toiletten, Wanne mit Ente, cupboard_2, desk_4 |
| `garten` | Garten | H→Haupt | Himmel + Wiese + rechte Hauswand | 12 Sträucher + 4 Detail-Büsche, Sonne, Zaun |
| `keller` | Keller | H→Haupt | b80/b90, Wände b80, sehr dunkel | Tanzendes Skelett hinten-rechts, painting_2, Kamin, Ketten, Truhe, plant_kraeuter, ~50 Kerzen, animal_1 + animal_2 (an Wand), muffin_4 |

`aktuellerRaum` hält die aktive ID. `wechsleRaum(zielId)`:
- merkt `vonRaum`, setzt `aktuellerRaum = zielId`
- blendet alle `<g data-raum>` ausser dem Ziel auf `display:none` — **in beiden SVG-Ebenen** (Rück + Front)
- Eintrittsposition = `laufziel` der Tür im Zielraum, deren `ziel === vonRaum` (Fallback `RAUM_EINTRITT = {fu:0.5, fv:0.3}`)
- `eintrittsRichtung(fu, fv)` setzt `figur.richtung` "in den Raum hinein"
- ruft `draw()`

Klick-Pipeline (`pointerdown`): zuerst Hindernis-Drag (nur HINDERNIS_DEBUG-Modus) → Tür-Polygone → `starteRaumwechsel()` (Fade) — sonst aktive Objekte (`obj.aufgabe` / `obj.aufnehmen` / `obj.aktion` / `obj.akzeptiert`) — sonst `screenZuBoden` → Figur läuft hin.

## Türen

Jede Tür hat `polygon`, `ziel`, `laufziel: {fu, fv}`, optional `label`/`secret`/`pfeil`/`schloss`/`akzeptiert`.

- **Hauptraum:** A, B an hinterer Wand, L an linker Wand, geheim an rechter Wand (`secret: true`, wandfarben).
- **Büro/Badezimmer:** `zurueck` als 2D-Pfeil unten am Bildrand (`PFEIL_POLYGON`); seitliche Durchgangstür F bzw. B.
- **Garten/Keller:** einzelne Rück-Tür auf Seitenwand.

**Türen-Schlösser:** `schloss: "<id>"` macht Tür gesperrt, bis der Schlüssel in `spielstand.freigeschalteteTueren` liegt. `zeichneSchloss()` malt ein weisses Schloss unten in der Tür (NICHT auf `secret`-Türen). Aktuell keine Tür verschlossen — die Geheim-Tür in den Keller ist offen, Mechanik kann jederzeit reaktiviert werden.

## Farb-Palette

Graustufen `GRAU.bX` (X=0..100, b0=weiss, b100=schwarz):

```js
GRAU = { b0:"#ffffff", b20:"#cccccc", b40:"#999999", b50:"#808080",
         b60:"#666666", b70:"#4d4d4d", b80:"#333333", b90:"#1a1a1a", b100:"#000000" };
```

Globale Farben (Türen, Figur) in `FARBEN`. Raum-Wandfarben in `RAEUME[id].farben`. Body-Background: schwarz.

**Sättigungs-Filter `#grell`** (`saturate=2`) sitzt auf JEDEM `<g data-raum="...">` → alle Möbel/Deko erben kräftigere Farben automatisch. Eigener `filter=` auf einem Kind komponiert sich multiplikativ mit dem Parent-Filter (zuerst Kind, dann Parent).

**Override** für individuelle Saturierung: `effekt = 2 × kind_value`. Vordefinierte Filter:
- `#grell-mild` (`values="0.75"`) → effektiv saturate **1.5**. Aktuell: chair_1, bookshelf_2 (Büro), cupboard_1 (Büro), cupboard_2 (Bad), cupboard_3 (Hauptraum), desk_3 (Hauptraum), desk_4 (Bad), desk_5 (Hauptraum), lamp_1 (Büro), painting_1 (Hauptraum), painting_2 (Keller).
- `#grell-soft` (`values="0.5"`) → effektiv saturate **1.0** (Originalfarben). Aktuell: animal_2 (Keller).
- `#grell-2_5` (`values="1.25"`) → effektiv saturate **2.5**. Aktuell ungenutzt (war zuvor cupboard_3).

Für andere Levels neuen Filter ergänzen: `values=ZIEL/2`. ID-Suffix beschreibt den Effekt-Wert, nicht den internen `values`-Wert. Ausnahme: `#invert` (Skelett) ist ein Schwarz/Weiß-Inverter — hat keinen Saturate-Anteil und wird vom Parent-`#grell` nicht beeinflusst (B/W ist saturierungsneutral).

## Möbel & Deko pro Raum

### Hauptraum

Inline-SVG-Reihenfolge in `<g data-raum="haupt">`:
00. **Painting** (`painting_1.png`) als `<image href>` an der hinteren Wand: 130×130, quadratisch, bei (315, 150) — links neben Tür A. `filter="url(#grell-mild)"`. DOM-zuerst → wird von Möbeln überdeckt. *(painting_2 wurde in den Keller verschoben — siehe dort.)*
0. **Teppich** (JS-generiert via `baueHauptTeppich()` in script.js): runder Teppich in Boden-Mitte (cu=0.5, cv=0.55), 12 konzentrische Kreise (Polylinen mit 72 Stützpunkten in Boden-(fu,fv)-Koords, mit `bodenPunkt()` auf Screen abgebildet → automatische perspektivische Verzerrung zum Fluchtpunkt 800/225). Welt-Radius rMax=0.20 (gleich für fu+fv = physisch rund). Konfig in `HAUPT_TEPPICH`: dezente Sand-/Braun-/Graubraun-Töne (niedrig gesättigt, wegen Hauptraum-`#grell`-Filter). Größter Ring zuerst gerendert → kleinere überdecken in Mitte → konzentrische Bänder. DOM-zuerst (`gruppe.prepend()`) → liegt unter allen Möbeln. Marker `data-generated="teppich"`.
1. **Bookshelf** an hinterer Wand: `<g id="bookshelf" transform="translate(650 310) scale(0.5)">`. 5 Regale, Pflanzen in Regal 1 + 5. (Saturierung kommt jetzt vom Parent `<g data-raum="haupt" filter="url(#grell)">` — siehe Farb-Palette.)
2. **Möbel-Gruppe** `<g id="haupt-moebel">` — VOR den Pflanzen, damit Pflanzen mit kleinerem fv (näher zur Kamera) in Render-Order über dem Tisch landen:
   - **Tisch 1** (`assets/table_1.svg`): Anker bottom-left = SVG (262.6, 578) → Screen (270, 640), σ=0.82. `data-y-fuss="639"`. Perspektivisch korrigiert (rechte Tischplattenkante zum Fluchtpunkt 800/225 hin verlängert; rechtes Bein gespiegelt).
   - **Lavalampe** auf Tisch 1: vereinfachte flache-Farben-Variante aus `lamp_lava_1.svg`. Wrapper `translate(362 584) scale(0.30) translate(-375 -728)`. `data-y-fuss="639"`.
   - **cake_1** auf Tisch 1 (3-stöckige Torte): inline aus `assets/cake_1.svg` bei `x=275 y=512 75×68`, `data-y-fuss="639"` (synchron mit Tisch). IDs mit `c1_` prefixed. Schwarze Outlines (`stroke="#000000"` an Doppelpfaden) wurden beim Inlinen durch die Fill-Farbe des Geschwister-Pfads ersetzt.
   - **cake_2** liegt jetzt auf desk_5 (siehe unten), nicht mehr auf Tisch 1. Als `<image href="assets/cake_2.svg">` eingebunden (NICHT inline) — die Beeren-Torte hat ein `<defs>` mit ~30 Gradients, beim Klonen in die Front-Ebene gab es ID-Duplikate → Gradient-Bug. Mit `<image>` ist das Asset Black-Box, kein ID-Konflikt mehr.
   - **Desk 1** ~~(`assets/desk_1.svg`, hellholz Schreibtisch in 3D-Perspektive)~~ **DEAKTIVIERT**: Code im DOM erhalten unter `<svg id="desk_1">` mit `style="overflow:visible;display:none"`. **`data-y-fuss` MUSS dabei entfernt sein** (sonst überschreibt `aktualisierePflanzenTiefe()` jeden Frame das `display:none` zurück auf `""` → Tisch wäre sichtbar — siehe Stolpersteine). Reaktivieren: `display:none` aus Style entfernen UND data-y-fuss="660" wieder einfügen. Originale Doku: Anker (1180, 660), σ=0.55, Footprint fu 0.74–0.84, fv 0.80–0.91, Hindernis-Ellipse `{ fu:0.79, fv:0.86, rx:0.06, ry:0.05 }`, Bein-Gradients durch solid #A57956 ersetzt.
   - **Desk 2** ~~(`assets/desk_2.svg`, Hocker mit stilisierter Figur oben)~~ **DEAKTIVIERT**: Code erhalten, gleicher Mechanismus wie desk_1. Original-Position x=521 y=701. **Die "stilisierte Figur" oben drauf war eine Pilzlampe** (3 Pfade: grauer Sitz, pinker Hut-Knopf, pinker Hut-Körper) — wurde nach desk_3 kopiert (siehe unten).
   - **Desk 3** (`assets/desk_3.svg`, kleiner Beistelltisch in 3D): inline `<svg data-y-fuss="735" x="700" y="580" width="200" height="100" viewBox="0 0 192.065 123.042" preserveAspectRatio="none" style="overflow:visible;transform:rotate(-2deg);transform-origin:50% 100%" filter="url(#grell-mild)">`. Nur Fills im Original. **Horizontal gespiegelt** via `<g transform="translate(192.065 0) scale(-1 1)">`-Wrapper. **CSS-Rotation -2°** (transform-origin Bottom-Center → kippt um den Tisch-Fuß). DOM-Reihenfolge: desk_3 → Pilzlampe → desk_2(deakt) → muffins. Kein Hindernis.
   - **Pilzlampe auf desk_3** (3 Pfade aus desk_2 kopiert): eigener `<svg data-y-fuss="735" x="730" y="563" width="40" height="44" viewBox="30 -5 65 65" preserveAspectRatio="xMidYMid meet">`. Pfade: grauer Sitz `#53536C`, pinker Hut-Knopf `#C83771`, pinker Hut-Körper `#D35F8D`. data-y-fuss synchron mit desk_3 (Stolperstein gestapelte Möbel). **Rotiert NICHT mit desk_3 mit** (separater SVG-Block).
   - **Desk 5** (`assets/desk_5.svg`, Beistelltisch-Variante, ähnliches Asset wie desk_3 mit anderer Bein-Geometrie): inline x=1170 y=540, 280×175, `data-y-fuss="705"` (Foot bei screen-y ≈ 705 aus `540 + 116·175/123`). Selbe Holz-Hex-Codes wie desk_3 (`#D08520`/`#A66113`/`#E6A450`). IDs aus dem Asset weggelassen (Konflikt mit desk_3-Pfaden). Steht visuell vor cupboard_3 und überdeckt dessen Boden — DOM nach cupboard_3 platziert, NICHT im `<g id="haupt-moebel">`.
   - **Muffins** auf dem Boden vor dem Tisch: nur noch `muffin_2` + `muffin_3` (Reihe von 2). Inline aus `assets/muffin_*.svg`, je ~32×40, `data-y-fuss="840"`. Original-SVGs haben keine IDs → kein Prefixing nötig. *(`muffin_1` sitzt jetzt auf desk_5 — siehe DOM-Reihenfolge unten. `muffin_4` wurde in den Keller verschoben — siehe dort.)*
3. **Pflanzen** (`<g id="plants">`, 6 Stück) — Transform-Muster: `translate(bx, by) scale(σ) translate(-256, -512)` verankert Topfboden (256, 512) im viewBox an Bodenpunkt. Formel: `σ = s · basisBreite / 512`. Jede Pflanze hat `data-y-fuss` für Tiefensortierung:

| Pflanze | fu | fv | bw | r (Hindernis) |
|---|---|---|---|---|
| tulpe | 0.15 | 0.12 | 175 | 0.05 |
| blume | 0.87 | 0.15 | 175 | 0.05 |
| setzling *(steht jetzt auf desk_3, Transform-Anker direkt: `translate(860 605) scale(0.07) translate(-256 -512)`, `data-y-fuss=735` synchron mit desk_3)* | — | — | 118 | — |
| geranie *(steht jetzt auf desk_5, Transform-Anker direkt: `translate(1325 563) scale(0.1269)`, `data-y-fuss=705` synchron mit desk_5)* | — | — | 100 | — |
| yucca | 0.034 | 0.79 | 104 | 0.03 |
*(`kraeuter` wurde in den Keller verschoben — siehe dort)*

Bookshelf hat zusätzliche Interaktion via `OBJEKTE.haupt[0]`: `aufgabe: "bookshelf_umfang"` + `akzeptiert.notizzettel` (Drop-Target).

4. **cupboard_3** (`assets/cupboard_3.svg?v=2`, aus Badezimmer hierher verschoben): grosser Schrank rechts an der Wand. `<image>` x=1140 y=260 width=160 height=363, `data-y-fuss="623"`, `preserveAspectRatio="none"`. Kein Hindernis. DOM-direkt vor desk_5 (beide ausserhalb `<g id="haupt-moebel">`). **Asset modifiziert** — 14 dunkle Holz-Hex-Codes durch hellere ersetzt (Mapping siehe Git-History).

5. **DOM-Reihenfolge am Ende der haupt-Gruppe** (alle ausserhalb haupt-moebel): `<g id="plants">` → `cupboard_3` → `desk_5` → `plant_geranie` → `cake_2` → `muffin_1`. Wichtig wegen Tiefensortierung: cake_2 + plant_geranie + muffin_1 sitzen visuell auf desk_5 und tragen `data-y-fuss="705"` synchron mit desk_5 — wechseln die Ebene zusammen mit ihm und stehen dank DOM-Reihenfolge in beiden Ebenen davor. **Analog auf desk_3** (innerhalb haupt-moebel): desk_3 → Pilzlampe → muffins(deakt) — alle mit `data-y-fuss="735"`. plant_setzling sitzt zwar visuell auch auf desk_3, lebt aber im `<g id="plants">`-Wrapper (DOM-nach haupt-moebel), trägt ebenfalls `data-y-fuss="735"`.

### Büro

- **Tisch 2** (`assets/table_2.svg`, L-Schreibtisch): Anker = front-left-leg-Fuss SVG (311, 613) → Screen (240, 700), σ=0.55. Vorderlinks. **Helle Holz-Palette** (Original-Hex-Codes global ersetzt: `#512F18→#8B6740`, `#C77137→#DEAA6F` usw.). Metallbeine grau, Schubladengriffe `#D1C6BF`. **Stroke = Fill** auf allen 22 Polygons/Rects (ursprünglich hatten alle eine ~10% dunklere stroke-Farbe als Rand → wurde auf Fill-Farbe gesetzt, damit die Möbelteile randlos wie aus einem Guss wirken).
- **Tischlampe** auf Tisch 2 (handgezeichnet inline, klassische Schreibtischlampe). Standfuss bei Screen (340, 495). Schirm um -20° gedreht, zwei Flächen-Hälften (`#987230` rechts/Licht, `#7a5a20` links/Schatten) mit gekrümmter Bezier-Unterkante; halbtransparenter Lichtkegel `#fff5b8` opacity 0.20.
- **Demo-Notizzettel** am Boden (`OBJEKTE.buero[0]`): per `zeichnen`-Callback als Brief auf Canvas gemalt. `aufnehmen: "notizzettel"`. Drop auf Bookshelf zeigt Hinweis-Overlay.
- **Bücherregal** `#bookshelf_2` (Inline-SVG, ursprünglich aus `assets/bookshelf_2.svg`): hinten-rechts an Wand, `x=700, y=270, 600×600`. Eigene Saturierung: `filter="url(#grell-mild)"`. **Hindernis** (Pixel-genau, deckt den ganzen visuellen Bookshelf-Footprint auf dem Boden ab): Trapez-Viereck `[[0.4351,0.10],[0.8247,0.10],[0.9912,0.97],[0.4017,0.97]]`. Vorderkante = Bookshelf-Bottom-Pixel y=870 → fv=0.10. Linksrand x=700 wandert perspektivisch (fv=0.10→fu=0.4351; fv=0.97→fu=0.4017), Rechtsrand x=1300 analog. Tür F-laufziel (0.88, 0.45) liegt knapp im Trapez → `setzeFigurZiel` schiebt es an die rechte Kante (≈0.896, 0.447); Tür bleibt aufrufbar. Tür "zurueck" (0.5, 0.05) klar vor dem Trapez. Lücke fu=0.35..0.43 zwischen Tisch 2 und Bookshelf bleibt durchquerbar.
- **Schreibtischstuhl** `#chair_1` (Inline-SVG): vor Tisch 2 (im DOM nach Tisch = visuell davor), `x=200, y=440, 180×290`, an y-Mittelachse gespiegelt via `transform="matrix(-1 0 0 1 580 0)"`. Eigene Saturierung: `filter="url(#grell-mild)"`. Manuelle Säuberung der SVG: `path1545` (Detail) entfernt; alle übrigen Pfade haben `stroke = ihr Fill` mit `stroke-width:1` (puffen sich minimal auf, keine schwarze Outline). Kein eigenes Hindernis (im Footprint des Tisches).
- **Wandbild** (linke Wand, JS-generiert via `baueBueroBild()` in script.js): Rahmen + Leinwand + 6 farbige Kreise. Alle Punkte (Polygon-Ecken UND 12 cubic-Bezier-Stützpunkte pro Kreis) werden in Wand-(u,v)-Koords definiert und mit `linkeWandPunkt()` auf die schräge Wand abgebildet → Perspektive (Fluchtpunkt 800/225) ergibt sich automatisch. Kreise geclippt auf das Leinwand-Polygon (`<clipPath id="bueroBildClip">`). Konfiguration in der Konstante `BUERO_BILD` (Rahmen-/Leinwand-uv-Bereich, Farbe pro Kreis). DOM-zuerst (`gruppe.prepend()`) → wird von allen Möbeln überdeckt. Marker `data-generated="bueroBild"` für idempotenten Re-Build.
- **cupboard_1** (`assets/cupboard_1.svg?v=8`): aus Badezimmer hierher verschoben, rechts (gross). `<image>` mit `x=980 y=106 width=400 height=600`, kein transform. Sichtbar bei (980,106)..(1380,706). **KEIN data-y-fuss** — Schrank bleibt immer in der Rück-Ebene, Figur überdeckt seine Pixel. Das Hindernis verhindert ohnehin, dass die Figur logisch hinter den Schrank-Boden gerät, also passt es visuell. **Hindernis** in `HINDERNISSE.buero[3]`: Viereck am tatsächlichen Boden-Footprint (interaktiv mit dem Drag-and-Drop-Editor von Manuel eingestellt — kompakter als der Pixel-Bounding-Box, deckt nur den Bereich ab, in dem die Figur physisch im Schrank wäre). **Asset modifiziert** — ursprünglich `<defs>` mit 22 Linear-Gradients und Gradient-Overlay-Pfade entfernt; zusätzlich manuelle Bearbeitungen durch Manuel inkl. Spiegelung im Asset selbst.
- **lamp_1** (`assets/lamp_1.svg`, Pixar-Stil Schreibtischlampe mit Schwenkarm + goldener Birne + warmem Schein): inline `<svg data-y-fuss="740" x="30" y="595" width="120" height="145" filter="url(#grell-mild)">`. Vorne-links auf dem Boden. **Alle IDs mit `l1_` prefixed** (9 Gradients + Camada_1 + paths) gegen Konflikte. Original-Farben modifiziert:
  - `l1_Gradient_2` (Lampenhals/Birne): von Grün (`#BFEF00`→`#445500`) zu **Gold** (`#FFD24A`→`#604010`).
  - `l1_Gradient_3` (Schein/Halo, opacity 0.716): von Zitronen-Gelb (`#EBF960`→`#E0EE7C` transparent) zu warmem **Amber-Gold** (`#FFCC44`→`#F0A040` transparent).
  - Weitere Gradients (Schwenkarm-Silber, roter Sockel) unverändert.

### Badezimmer

- **Tintenfisch** (`assets/octopus_1.svg`) inline, hinten-rechts. Anker `<svg class="octopus" data-y-fuss="700" x="930" y="380" width="440" height="330" viewBox="0 0 640.08 479.93">`. DOM-Position: zwischen cupboard_2/Toiletten und desk_4 — er überdeckt cupboard_2 und Toiletten, wird aber selbst von desk_4 überdeckt (desk_4 ist DOM-zuletzt). CSS in `style.css`:
  - `.octopus *:not(#path4647) { stroke: none !important }` — entfernt schwarze Outlines global, AUSSER beim Mund.
  - **Augen-Pupillen** (path3950, path3950-4): liegen IM Auge, behalten Inline-`fill:#000`.
  - **Mund** (`#path4647`): offene Kurve, nur Stroke, Farbe `#5a0000` (dunkelrot).
- **Sanitärobjekte** (Renderreihenfolge hinten → vorn). Drei Switch-Paare: jeweils zwei `<svg>`-Blöcke an exakt derselben Position/Größe, einer initial sichtbar, der andere `display:none`. Konvention: `#X_1` = Initialzustand, `#X_2` = nach Handlung. Sitzring ist rot eingefärbt (Inline-Fills `#FF5C5C` dunkel + `#FF8C8C` hell), Wasser bei der Wanne wechselt von blau (`#A7C5EA`) zu klar (`#FCFCFC`).
  - **Toilette 2** (links): `#toilet_2_1` / `#toilet_2_2` bei (590, 420) 200×250, data-y-fuss=670
  - **Toilette 1** (rechts, visueller Klon): `#toilet_1_1` / `#toilet_1_2` bei (1040, 420) 200×250, data-y-fuss=670
  - **Badewanne**: `#bathtub_1_1` / `#bathtub_1_2` bei (130, 440) 600×200
  - `duck_1` schwimmt auf der Wanne
  - **`<g transform="translate(37 -9)">`-Wrapper** in `toilet_2_2` und `toilet_1_2`: Die beiden Switch-Partner-Assets haben ihre Pfade im viewBox um (-37, +9) verschoben — der Wrapper gleicht das aus, sodass _1 und _2 deckungsgleich liegen.
  - **CSS `.sanitar-aus { display: none !important }`** im `<style>`-Block — wird von `setSichtbar()` togglet. `!important` schlägt die Inline-display-Setzung von `aktualisierePflanzenTiefe()`, sodass der versteckte Switch-Partner zuverlässig unsichtbar bleibt.

  **Toiletten-Klick** in `OBJEKTE.badezimmer`: `toilet_1`-Polygon (1040..1240, 420..670) und `toilet_2`-Polygon (590..790, 420..670), beide ohne `laufziel` → Klick toggelt sofort, Figur bleibt stehen. `toilet_1` zeigt Hinweistext, solange `spielstand.zustaende.octopus_da === true` (Tintenfisch sitzt drauf) — `toilet_2` togglet immer.

  Hinweis Nummerierung: Die "1"/"2" hinter `toilet_` folgt den Asset-Namen, nicht der räumlichen Lage.
- **cupboard_2** (`assets/cupboard_2.svg?v=5`): einziger Schrank im Badezimmer. Vorne-mitte, `<image>` x=750 y=150 width=350 height=500, data-y-fuss="650". Asset wurde von Manuel vereinfacht (`?v=2`); danach Holztöne 2× ~20% aufgehellt (`?v=3`, dann `?v=4`); zuletzt manuelle User-Anpassungen (`?v=5`). Glas-Spiegel (Türkis-Gradients) und Türknäufe (Gradient_5/9) blieben unverändert. cupboard_1 wurde ins Büro verschoben, cupboard_3 in den Hauptraum.
- **Desk 4** (`assets/desk_4.svg`, breite Anrichte mit Schubladen): inline x=1200 y=520 width=310 height=360, data-y-fuss="755" (Foot bei screen-y ≈ 755). Aus dem Hauptraum hierher verschoben. Frischer 1:1-Import aus dem Asset, **keine Strokes** (Asset hat keine — frühere weisse Stroke-Variante wurde verworfen). IDs aus dem Asset entfernt (`path2170` / `path2172` / `path2178` ×3 — Duplikate riskieren beim Klonen in die Front-Ebene). Leere Platzhalter-Pfade (`M0.322,297.233`, `M415.693,107.617`) weggelassen. **DOM-zuletzt** im Badezimmer-Block, überdeckt also Octopus + Toiletten visuell.

### Garten

Decke + linkeWand + hintereWand alle Himmelsblau → `zeichneZimmer()` füllt einen einzigen `fillRect` mit Himmel, dann werden Boden (nahtlos) und rechte Hauswand drübergezeichnet. So entstehen keine Subpixel-Säume.

`zeichneGartenZaun()` (auf `ctxRaum`) malt in dieser Reihenfolge: Sonne → Horizont-Silhouetten → Gras (nahtlos) → Horizont-Büsche (`vor: true`) → Nah-Büsche (Canvas-Ellipsen) → Detail-Büsche `bush_1..4` (per `drawImage`) → Zaun hinten + links → rechte Hauswand drüber (clippt Büsche).

`zeichneSonne()`: 12 Strahlen (`lineWidth: 7`, war 10 — auf Wunsch dünner) + gelber Kreis (r=42) bei (1200, 200).

**Blumen** (`flower_1..6.svg`, inline) im Garten — IDs jeweils mit `f1_..f6_` prefixed:
- *Innerhalb des Zauns* (auf der Wiese, mit `data-y-fuss` für Tiefensortierung):
  - `flower_1` (gelbe Blüte, 80×103, fv=0.25, vorne-links). Die 33 `fill="#FFCE00"` Blütenblätter wurden round-robin auf 8 leicht variierte Gelb-Tönungen verteilt (`#FFCE00`, `#FFD11A`, `#FFC000`, `#F8CB00`, `#FFD533`, `#FFC700`, `#F4C000`, `#FFD200`).
  - `flower_2` (70×99, fv=0.40, mid-rechts)
  - `flower_3` (50×79, fv=0.50, mid-links)
- *Ausserhalb des Zauns* (kleine Blüten am Horizont, kein `data-y-fuss`, oberhalb der Zaunkante y=420):
  - `flower_4` (35×49, x=380), `flower_5` (30×37, x=700), `flower_6` (35×49, x=1080), Bottom alle ~y=415

Hinweis Render-Ebene: SVG-`<g data-raum="garten">` liegt VOR dem Zaun (Canvas) im Stack. „Aussen"-Blumen sind deshalb nicht physisch hinter dem Zaun gerendert, sondern oberhalb der Zaunkante platziert (Bottom < 420), sodass sie wie ferne Blumen am Horizont wirken.

**Detail-Büsche** (`BUESCHE`): SVGs als `Image`-Objekte geladen (`ladeBuschBild`), per `drawImage` gerastert (damit der Zaun sie verdecken kann). `bush_4` hat am `<g>` `stroke-width="25"` mit `stroke="{eigener fill}"` pro Pfad — Pfade „puffen" minimal, KEINE schwarze Outline.

**Sträucher** (12 Stück) durch `baueGartenDeko()` beim Start erzeugt. 4 Varianten (`STRAUCH_VARIANTEN`) mit unterschiedlichen Blatt-Auswahlen und Grüntönen. Pfade aus `plant_strauch.svg`.

**WICHTIG zu `baueGartenDeko()`:** entfernt nur Elemente mit `data-generated="strauch"`-Marker (NICHT `gruppe.innerHTML = ""`), damit statisch ins HTML eingebaute Garten-Deko (z.B. Blumen) erhalten bleibt. Beim Erstellen markiert die Funktion jeden Strauch-`<g>` mit `setAttribute("data-generated", "strauch")`. Wer programmatisch weitere Garten-Deko erzeugt, sollte denselben Marker setzen, falls die Inhalte bei einem Re-Build entfernt werden sollen.

### Keller

Wände/Decke/Boden in dunklen Grautönen (b80/b100/b90). **Skelett** aus `skeleton_3.svg` via `<image href>`, perspektivisch hinten-rechts (Füsse bei (1236, 645), 177×250). Farb-Invertierung via SVG-Filter `#invert` (schwarz → weiss). Schaukel-Animation: `<animateTransform type="rotate">` um die Füsse, ±6°, 2.5 s.

**Painting** (`painting_2.png`) als `<image href>` an der hinteren Wand, mittig über dem Kamin: 130×194 (hochformat) bei (635, 110). `filter="url(#grell-mild)"`. DOM-zuerst (vor Kamin/Skelett/etc.).

**Kamin** (`assets/fireplace_1.svg`, inline) hinten-links: `<svg id="fireplace_1" x="440" y="400" width="380" height="250" viewBox="0 0 403.48514 265.84756">`. Bottom an Bodenniveau hintere Wand (y=600). User hat das Asset stark vereinfacht (jetzt ~110 KB, 252 Zeilen). **Alle Asset-IDs werden beim Reimport mit `fp_` prefixed** (`fp_Layer_1`, `fp_g4609`, `fp_Gradient_1` etc.) gegen Konflikte mit anderen Inline-SVGs. Drei Flammen-Gruppen `fp_g4609`/`fp_g4755`/`fp_g4353` haben CSS-Animation (`transform-box:view-box`, `transform-origin` am Flammenfuß): Höhen-Pulsieren + Opacity-Flackern + Hue-Shift Richtung **Rot** (negative Werte −30°…−2°, kaum positive → wenig Gelbgrün). Drei verschiedene Phasen/Frequenzen (1.90s/2.40s/1.50s, mit Delays) → ruhiges Züngeln. Hindernis: Ellipse `{ fu:0.33, fv:0.95, rx:0.18, ry:0.04 }`.

**plant_kraeuter** (Inline-SVG, aus Hauptraum verschoben) steht auf dem Kaminsims: `<g data-y-fuss="415" transform="translate(630 415) scale(0.10) translate(-256 -512)">`. Klein skaliert (σ=0.10 → ~51 px Bounding Box). data-y-fuss=415 → fv≈1.62, also IMMER hinter Figur (figur.fv ≤ 0.97). Kein Boden-Hindernis nötig, weil die Pflanze nicht auf dem Boden steht.

**Kerzen** — JS-generiert in `baueKellerKerzen()` (script.js): ~50 Kerzen mit rötlichem Wachs in einem Halbkreis-Cluster um das Skelett (Standpunkt fu=0.90, fv=0.85). Templates `KERZE_TEMPLATE_2` und `KERZE_TEMPLATE_3` enthalten den Pfad-Inhalt aus `assets/candle_2.svg` bzw. `candle_3.svg` (ohne outer `<svg>`-Tag), mit Wachs-Hex-Codes durch Platzhalter `__WACHS__` / `__WACHS_HELL__` / `__WACHS_DUNKEL__` ersetzt. Pro Kerze wird ein Template geklont, die Platzhalter durch konkrete Rotwerte ersetzt (Hauptfarbe + ~18 % heller + ~45 % dunkler), IDs prefixiert (`cd<i>_…`), und das outer `<svg>` mit x/y/width/height/preserveAspectRatio="none" gebaut → DOMParser → `appendChild`. Flammenfarben (Gradient_2 in candle_2, #F04218/#FFFF00/#FFFFFF/#FF7F2A in candle_3) bleiben original. Cluster-Definition in `KELLER_KERZE_CLUSTER` (8 Cluster mit unterschiedlicher Dichte → Häufungen + dünn besetzte Bereiche, weiche Aussenkante durch Pseudo-Gauss-Streuung). Höhe variiert stark (30–68 px, uniform), Breite 14–21 px pseudo-normalverteilt (Mittel aus 3 Uniform-Samples → Mode bei ~17.5 px). ~50 % der Kerzen werden zusätzlich an ihrer vertikalen Mittelachse gespiegelt (`transform="matrix(-1 0 0 1 2·cx 0)"`) → bricht die symmetrische Wiederholung der Asset-Highlights/-Schatten auf. `bodenAnker` pro Template (0.89 für candle_2, 0.99 für candle_3) richtet den visuellen Kerzenfuß auf `bodenPunkt(fu, fv)` aus. Größe per Tiefen-Skala `s = 1 - 0.45·fv`. Deterministisch via `mulberry32(73)`. Marker `data-generated="kerze"` für idempotenten Re-Build.

**Ketten** (`chain_1/2.svg`, inline):
- `chain_2` (lange horizontale Kette, 320×115) hängt an hinterer Wand bei x=830 y=250 (zwischen Kamin und Skelett)
- `chain_1` (kürzere Kette mit Kugel, 150×85) liegt auf dem Boden bei x=900 y=615

**Schatztruhe** (`chest_1.svg`, inline) vorne-rechts: `<svg id="chest_1" x="908" y="716" width="210" height="94">`. `data-y-fuss="810"` (Tiefensortierung — Figur kann davor und dahinter laufen). Hindernis: `{ fu:0.65, fv:0.30, rx:0.10, ry:0.04 }` (breit + flach).

**muffin_4** (aus dem Hauptraum hierher verschoben): `<svg id="muffin_4" data-y-fuss="840" x="1135" y="800" width="32" height="43">`. **Wachspapier-Farben modifiziert**: ursprünglich Gelb-Grün (`#abc837`→`#89a02c`), jetzt warmes Gelb-Orange (`#f0bf20`→`#bf931a`).

**animal_1** (`assets/animal_1.svg`, große Tier-/Kreatur-Figur an der hinteren Wand): inline mit IDs `a1_` prefixed (143 Path-IDs). Position vom User justiert auf `x="474" y="215" width="140" height="175" preserveAspectRatio="none"`. **Sanfter Gelb-Tint t=0.06** auf alle 95 Hex-Farbwerte angewendet (verschoben Richtung Honig/Warm-Beige, ohne dass es offensichtlich gelb wirkt — siehe Stolperstein "Animal-Tint"). **KEIN data-y-fuss** — wandmontiert, soll IMMER hinter Figur sein → bleibt nur in Rück-Ebene.

**animal_2** (`assets/animal_2.svg`, kleinere Tier-Figur an der Wand): inline mit IDs `a2_` prefixed (10 Gradients erhalten). Position `x="645" y="220" width="130" height="154"`. `filter="url(#grell-soft)"` (effektiv saturate 1.0 = Originalfarben, da Parent `#grell` doppelt saturiert). **KEIN data-y-fuss** — gleicher Mechanismus wie animal_1, immer in Rück-Ebene.

Alle Inline-Imports im Keller (Kamin, Ketten, Truhe, animals) haben prefixierte IDs (`fireplace_…`/`ch1_…`/`ch2_…`/`ch_…`/`a1_…`/`a2_…`) gegen Konflikte. Kein eigenes Hindernis bei Kerzen/Ketten/Skelett/animals (Deko, Figur kann durchlaufen).

## Hindernis-System (Kollision)

`HINDERNISSE[raumId]` ist ein Array. Jedes Hindernis ist eine von drei Formen:

- **Kreis**: `{ fu, fv, r }` — runde/kompakte Objekte (Pflanzen, Octopus).
- **Ellipse**: `{ fu, fv, rx, ry }` — flache/breite Objekte (Tisch1, Kamin, Truhe).
- **Viereck (konvex, polygon)**: `{ punkte: [[fu1,fv1], [fu2,fv2], [fu3,fv3], [fu4,fv4]] }` — rechteckige Möbel mit gerader Kante (Schrank, ggf. später Truhe/Schreibtisch). Konvex bedeutet: alle Innenwinkel < 180°. 3+ Punkte erlaubt, beliebige Reihenfolge (Cross-Product-Test).

Form-Helper (alle in `script.js` direkt vor `istImHindernis`):
- `istInForm(h, fu, fv)` — Type-Dispatch zwischen Ellipse-Gleichung und `pktInKonvexPolygon`.
- `hindernisCenter(h)` — Schwerpunkt (für Slide-Distanz-Suche).
- `hindernisMaxRadius(h)` — konservativer Maximal-Radius vom Center (Pre-Filter).
- `naechsterRandUndNormale(h, fu, fv)` — gibt nächsten Punkt am Rand + Außen-Normale zurück. Für Vierecke: Projektion auf nächste Kante; für Ellipsen: radial vom Center.

Hauptfunktionen:
- `istImHindernis(fu, fv)`: iteriert via `istInForm`.
- `setzeFigurZiel(fu, fv)`: liegt das Ziel im Hindernis, schiebt es zum nächsten Randpunkt (entlang Außen-Normale, +0.005 Puffer). Safety Net für Tür-Laufziele.
- `slideUmHindernis(ux, uy, schritt)`:
  1. Sucht das blockierende Hindernis per Center-Distanz (in Laufrichtung, senkrechter Versatz ≤ MaxRadius + 0.02).
  2. Tangente = senkrecht zur **Außen-Normale am nächsten Randpunkt** (für Ellipsen → Gradient, für Vierecke → Kanten-Senkrechte).
  3. Bevorzugt die Seite mit positivem Dot zur Laufrichtung.
  4. **Wand-Fallback:** verlässt die bevorzugte Seite den Laufbereich oder führt in ein anderes Hindernis → ANDERE Seite probieren.
  5. **Oszillations-Schutz:** Slide-Schritt, der innerhalb `schritt*0.5` der letzten Position liegt (`figur.letztePosFu/Fv`), wird abgelehnt → andere Seite. Wenn beide Seiten geblockt oder zur letztePos zurückführen, return null → Figur stoppt. Verhindert Hin-und-Her-Pendeln, wenn die Figur frontal auf eine Hindernis-Kante drückt und das Ziel hinter dem Hindernis nicht erreichbar ist (z.B. Klick hinter cupboard_1).
- **Safety-Net** in `aktualisiereFigur`: vor jedem Schritt: in einem Hindernis? Falls ja → zum nächsten Randpunkt + clamp.

Pflanzen-Radien orientieren sich am Fussabdruck (Topfbasis), nicht am Blattwerk → Figur kann knapp vorbei, der Körper verschwindet perspektivisch hinter den Blättern. Vierecke umgekehrt: präziser visueller Footprint mit kleinem Puffer (z.B. cupboard_1 mit 3% Puffer um den sichtbaren Schrank-Linksrand).

**Hindernis-Werte nicht raten — interaktiv platzieren.** Hindernis-Positionen werden NICHT im Code geschätzt (Pixel-/Perspektive-Berechnungen sind unzuverlässig), sondern interaktiv per Drag-and-Drop-Editor:
1. `hindernisDebug(true)` in der Browser-Konsole → farbige Overlays + Eckpunkt-Marker.
2. Eckpunkte mit der Maus an die richtige Position ziehen (jeder Drag schreibt eine kompakte Bestätigung in die Konsole).
3. `dumpHindernisse()` (oder `dumpHindernisse("haupt")` etc.) → fertiges Code-Snippet für den ganzen Raum.
4. Snippet 1:1 in `HINDERNISSE.<raum>` in `script.js` einfügen.
5. `hindernisDebug(false)` ausschalten.

Erst sinnvoll, wenn die Möbel im Raum stehen — sonst muss neu gedragt werden, sobald sich Möbel-Positionen ändern. Code-Vorschläge zu Hindernis-Werten dienen nur als Diskussions-Platzhalter, nicht als Endwerte.

## Tiefensortierung (data-y-fuss-Toggle)

Architektur-Problem: Der Figur-Canvas liegt fix zwischen den SVG-Ebenen. Damit Pflanzen je nach Tiefe VOR oder HINTER der Figur erscheinen können, liegen sie in zwei Ebenen:

1. Jede Pflanze (und Tisch1 + Lavalampe) hat ein `data-y-fuss="…"`-Attribut.
2. `klonePflanzenVorne()` läuft einmal beim Start (via `baueRaumDeko()`): für jede `<g data-raum>` in der Rück-Ebene wird eine gleichnamige Gruppe in der Front-Ebene erzeugt, **inklusive `filter`-Attribut** (sonst leuchtet der saturate-#grell-Effekt nur in der Rück-Ebene und Möbel sehen heller aus, sobald die Figur dahintersteht). ALLE `[data-y-fuss]`-Elemente werden hineingeklont.
3. `aktualisierePflanzenTiefe()` läuft am Ende jedes `draw()`:
   - Für jedes `[data-y-fuss]` in Rück-Ebene: `display: none`, wenn `figur.fv > pflanze.fv`. Sonst sichtbar.
   - In Front-Ebene umgekehrt.

Bookshelf, Skelett, Sträucher, Tisch2 haben KEIN `data-y-fuss` und bleiben nur in der Rück-Ebene — sie stehen perspektivisch immer hinter der Figur.

`wechsleRaum()` togglet `<g data-raum>`-Sichtbarkeit in BEIDEN SVG-Ebenen simultan.

## Spielstand

```js
const spielstand = {
    geloesteAufgaben: new Set(),       // IDs gelöster Aufgaben
    freigeschalteteTueren: new Set(),  // eingesammelte Schlüssel-IDs
    inventar: {},                      // gefundene Zahlen / Infos (Cross-Room-Lookup)
    gegenstaende: new Set(),           // physische Inventar-Gegenstände
    zustaende: { badewanne: 1, toilette_1: 1, toilette_2: 1, octopus_da: true },  // 1 = Initialstate, 2 = nach Handlung. octopus_da = sitzt der Tintenfisch noch auf toilet_1?
};
```

**Sanitärobjekt-Switch:** `aktualisiereSanitaer()` togglet die CSS-Klasse `sanitar-aus` der sechs `<svg>`-Blöcke (`#bathtub_1_1/1_2`, `#toilet_1_1/1_2`, `#toilet_2_1/2_2`) per `querySelectorAll('[id="…"]').classList.toggle()` basierend auf `spielstand.zustaende`. Über `[id="…"]` (Attribute-Selektor) werden auch die Klone in `#object-layer-vorne` erfasst. Wird beim Init und nach jeder Zustandsänderung aufgerufen. Toiletten sind klickbar: `OBJEKTE.badezimmer` enthält `toilet_1` und `toilet_2` mit `aktion`-Callback (kein `laufziel` → sofortiges Toggle ohne Hinlaufen). **toilet_1 ist gesperrt, solange `spielstand.zustaende.octopus_da === true`** — Klick zeigt Hinweistext. Sobald `octopus_da = false`, togglet der Klick `wechsleToilette1()`. Aufgaben können auch direkt `setzeBadewanne(2)`, `setzeToilette1(2)`, `setzeToilette2(2)` aufrufen.

**Dev-Helfer in der Browserkonsole:**
```js
freischalten("keller_schluessel")
verschliessen("keller_schluessel")
gegenstandHinzufuegen("notizzettel")
gegenstandEntfernen("notizzettel")
verbrauche("notizzettel")              // Alias — praktisch in akzeptiert-Callbacks
setzeBadewanne(2)                      // Wanne-State setzen (1 oder 2)
setzeToilette1(2) / setzeToilette2(2)  // Toiletten setzen
wechsleBadewanne() / wechsleToilette1() / wechsleToilette2()  // togglen
spielstand                              // aktueller Zustand inspizieren
hindernisDebug(true|false)              // Hindernisse als farbige Overlays + Eckpunkt-Marker
                                         // mit "<hindernisIdx>.<eckIdx>"-Label rendern.
                                         // Default OFF. Eckpunkte sind dragbar im Debug-Modus.
dumpHindernisse() / dumpHindernisse("haupt")  // Aktuelles HINDERNISSE.<raum>-Array als Code-Snippet
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

**Aktuelle Demo-Aufgabe:** `bookshelf_umfang` — Klick aufs Bücherregal, Umfang bei r=5 cm. Bei Erfolg: Inventar-Eintrag `umfang_demo_cm`.

## Inventar + Drag & Drop

```js
const GEGENSTAENDE = {
    notizzettel: { name: "Notizzettel", icon: `<svg ...>` },
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

Schrittsounds live via Web Audio API: weisser Noise-Burst durch Tiefpassfilter zum dumpfen „Thud". Vier Varianten in `SCHRITT_VARIANTEN` (220–310 Hz, 80–100 ms) round-robin + ±3 % Frequenz-Jitter pro Schritt.

`audioCtx` wird beim ersten `pointerdown` via `ensureAudio()` initialisiert (Safari/Chrome starten oft `suspended` → `audioCtx.resume()`). `spieleSchritt()` feuert in `aktualisiereFigur`, wenn die Gehphase π oder 2π überquert.

Konsolen-Helfer: `soundAnAus(true|false)`, `soundTest()`.

## Input / Loop

```
Seitenladen → requestAnimationFrame → baueRaumDeko() → aktualisiereSanitaer() → resizeCanvas() → loop()
loop(): aktualisiereFigur() → draw() → requestAnimationFrame(loop)
canvas.pointerdown:
    → Tür-Polygone? → figur läuft hin → ankunft = starteRaumwechsel()
    → OBJEKTE? → figur läuft hin → ankunft = zeigeAufgabe() oder nimmAufGegenstand()
    → sonst: screenZuBoden → setzeFigurZiel() (mit Clamp + Snap aus Hindernissen)
window.resize → resizeCanvas()
```

**Wichtig:** `baueRaumDeko()` läuft VOR `resizeCanvas()`.

## Deko-Generatoren (JS-seitig)

```js
makeSVG(tag, attrs, kinder)        // SVG-Element-Factory (namespaced)
erzeugeStrauch({fu, fv, bw, v})    // <g> mit transformierter Strauch-Grafik
baueGartenDeko()                   // füllt <g data-raum="garten"> mit 12 Sträuchern (idempotent)
baueRaumDeko()                     // Dispatch + klonePflanzenVorne(); 1× beim Start
klonePflanzenVorne()               // klont alle [data-y-fuss]-Elemente in #object-layer-vorne
ladeBuschBild(src)                 // cached Image-Loader für Detail-Büsche
zeichneBuschBild(def)              // rendert einen Detail-Busch via drawImage
```

## Stolpersteine

- **Cache-Busting:** bei Änderungen an `script.js`, `style.css` oder einem `<image href>`-Asset das `?v=N` hochzählen, sonst hängt der Browser im alten Cache.
- **`baueGartenDeko()` darf NICHT `innerHTML = ""` machen** — sonst werden statische Garten-Deko-Elemente (Blumen) bei jedem Aufruf gelöscht. Die Funktion entfernt nur `[data-generated="strauch"]`-Elemente.
- **Möbel-Position ändern:** `HINDERNISSE` (Kollision) UND `data-y-fuss` (Tiefensortierung) UND Transform/x/y (Rendering) müssen synchron bleiben. Hindernisse am besten interaktiv mit Drag-Editor justieren.
- **DOM-Reihenfolge zwischen Möbeln:** Tiefensortierung via `data-y-fuss` regelt nur **vor/hinter Figur**, NICHT zwischen Möbeln in derselben Ebene. Innerhalb einer Ebene gilt DOM-Reihenfolge — späteres Element überdeckt früheres. Beispiel: desk_4 DOM-zuletzt im Badezimmer, überdeckt damit Octopus + Toiletten. Ähnlich: Tisch1 + Lavalampe DOM-vor `<g id="plants">`.
- **`<image href>` vs. Inline-SVG:** `<image href>` ist eine Black Box (kein per-Pfad-Zugriff, eigener ID-Scope). Inline-SVG nötig, wenn man einzelne Pfade adressieren muss (Recolor, ID umbenennen, Pfad entfernen).
- **Detail-Büsche per `drawImage`** statt `<image href>` — damit der Zaun sie verdecken kann.
- **SVG-Filter `filter="url(#name)"`** statt CSS-Filter — robuster (#grell, #grell-mild, #invert).
- **Body-CSS:** `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none` — verhindert Scroll/Verschieben.
- **Switch-Partner exakte Position:** `bathtub_1_1/1_2`, `toilet_1_1/1_2`, `toilet_2_1/2_2` müssen deckungsgleich liegen — sonst „springt" das Objekt beim Umschalten. toilet_1_2 / toilet_2_2 brauchen einen `<g transform="translate(37 -9)">`-Wrapper, weil die Pfade im Asset-viewBox verschoben sind.
- **Gradient-Defs in geklonten Inline-SVGs:** Wenn ein `<svg>` mit eigener `<defs>` ein `data-y-fuss` hat und in die Front-Ebene geklont wird, entstehen ID-Duplikate. Paint-server-Lookup nimmt den ersten DOM-Treffer — wenn dessen Parent `display:none` ist, rendern Pfade unsichtbar (so verschwanden früher die desk_1-Beine). **Aktueller Workaround:** `klonePflanzenVorne()` prefixed seit script.js v134 alle IDs im Klon mit `v_<idx>_` und schreibt alle internen `url(#…)`-/`xlink:href="#…"`-Refs entsprechend um → beide Layer haben eigene Gradient-Defs, kein Konflikt mehr. Das löste z.B. das "verschwindende Kerzen-Flammen"-Problem (candle_2 hat 2 Gradients pro Kerze). Alternativ: solid colors statt Gradient — oder Asset als `<image href>` einbinden (Black-Box, eigener ID-Scope). cake_2 nutzt diese Alternativ-Lösung historisch.
- **Gestapelte Möbel — `data-y-fuss` synchronisieren:** Ein Element, das visuell auf einem anderen Möbel steht (z.B. cake_2 + plant_geranie auf desk_5), MUSS denselben `data-y-fuss`-Wert wie das Trägermöbel haben. Sonst wechseln sie zu unterschiedlichen Zeitpunkten zwischen Rück- und Front-Ebene → das Trägermöbel überdeckt in der Front-Ebene das aufliegende Element, das in der Rück-Ebene bleibt. DOM-Reihenfolge zwischen Träger und Aufliegendem: Aufliegendes nach Träger, damit es in beiden Ebenen darüber gerendert wird.
- **`klonePflanzenVorne()` muss `filter` mitkopieren** — sonst sehen Möbel in der Front-Ebene blasser aus (kein `#grell`-Saturate). Funktion liest `filter` vom Original-`<g data-raum>` und setzt ihn auf den Klon.
- **`display:none` an `[data-y-fuss]`-Element wird vom Frame-Toggle überschrieben:** `aktualisierePflanzenTiefe()` läuft jeden Frame und setzt `el.style.display = "none"` oder `""` basierend auf figur.fv vs element.fv. Inline `display:none` wird dabei JEDEN FRAME mit `""` überschrieben → Element bleibt sichtbar. **Lösung beim Deaktivieren via `display:none`: `data-y-fuss` mit entfernen.** Beispiel desk_1/desk_2 (auskommentiert): nur dann bleibt das `display:none` stabil, weil der Toggle das Element nicht mehr anfasst. Reaktivieren: `data-y-fuss` wieder einfügen UND `display:none` aus dem Style entfernen.
- **Wandmontierte Objekte (immer-hinten):** Elemente, die an einer Wand "kleben" (paintings, animals im Keller etc.), sollten **gar kein `data-y-fuss`** tragen. Dann werden sie weder geklont noch vom Toggle angefasst und bleiben permanent in der Rück-Ebene → Figur ist immer davor (Bookshelf/Skelett-Pattern). Wenn der visuelle Foot des Objekts UNTER y=600 liegt (also auf dem Boden, nicht an der Wand), data-y-fuss = visual_foot_y verwenden, sonst kann die Figur unsinnigerweise hinter das Objekt laufen.
- **Animal-Tint (animal_1):** Original-Farben sind dunkelbraun/erdig, was bei dunklem Keller-Setting visuell verschwindet. Lösung: alle Hex-Werte um Faktor t Richtung Gelb verschoben: `r += (255-r)·t; g += (255-g)·t; b -= b·t`. Bei t=0.12 wirkt es schon zu gelb; t=0.06 ist subtil-honigfarben (akzeptiert). Re-Tinten: Original-Asset jedes Mal frisch laden (Aufhellung/Tint sind nicht idempotent — wiederholtes Anwenden auf bereits getintete Farben verschiebt sie immer weiter).
- **CSS `transform` an `<svg>`-Elementen für Möbel-Rotation:** Funktioniert (z.B. desk_3 mit `style="transform:rotate(-2deg);transform-origin:50% 100%"`), pivotiert um Bottom-Center des SVG-Box. Aber: alles, was visuell AUF dem Möbel sitzt (Lampe, Pflanze) ist ein separater SVG-Block und rotiert NICHT mit. Wenn Mit-Rotation gewünscht, müssen Aufliegende dieselbe `transform`-Eigenschaft mit dem **gleichen Drehpunkt im Screen-Space** bekommen.

## Roadmap

**Aktueller Stand:** Infrastruktur, Spielstand, Aufgaben-UI, Inventar + Drag & Drop, Kollision (Kreise + Ellipsen + konvexe Vierecke), Tiefensortierung via `data-y-fuss` (Pixel-Y des Möbel-Fußes), Sanitär-Switch mit `.sanitar-aus`-CSS, klickbare Toiletten (Octopus blockiert toilet_1), Hindernis-Drag-Editor — alles drin. Möbel in Hauptraum, Büro, Badezimmer, Garten, Keller weitgehend platziert. Demo-Aufgabe `bookshelf_umfang` mit Cross-Room-Lookup funktioniert.

**Atmosphäre-Updates:** Wandbilder (painting_1 + 2 mit grell-mild), Pixar-Stil-Lampe (lamp_1) im Büro mit goldener Birne und warmem Schein, animal_1 + animal_2 wandmontiert im Keller (animal_1 mit Honig-Tint, animal_2 mit grell-soft), rotierter desk_3 (-2°) mit Pilzlampe + plant_setzling oben drauf (perspektivisch skaliert).

**Offen:**
- 10–15 Kreis-Aufgaben (Umfang, Fläche, Durchmesser, Radius), linear I → IV mit Cross-Room-Lookups.
- Auslösende Handlungen für Sanitär-Switch (welche Aufgabe → `setzeBadewanne(2)`, Octopus weg etc.).
- Hinweise bei falscher Antwort (pro Aufgabe konfigurierbar).
- `localStorage` für Fortschritt (erst nach Inhalten sinnvoll).

## Git-Workflow

Remote: `https://github.com/Manuel-Benz/Spiel_Kreise_1`. Solo auf `main`.

Nach jedem Schritt:
```bash
git status
git diff                                              # optional
git add index.html script.js style.css CLAUDE.md      # explizit, nicht "git add ."
git commit -m "Kurze Beschreibung"
git push
```

`git pull` ist nur nötig, wenn auf github.com direkt editiert wurde oder von einem anderen Rechner kommend.
