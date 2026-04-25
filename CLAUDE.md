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
| `bush_1..4.svg` | Detail-Büsche im Garten | `drawImage` (Canvas, damit Zaun verdecken kann) |
| `table_1.svg`, `table_2.svg` | Holztisch Hauptraum / Schreibtisch Büro | Inline-SVG |
| `lamp_lava_1.svg`, `bookshelf_1.svg` | Originale; Inline-Varianten im Hauptraum | nicht direkt |
| `bookshelf_2.svg`, `chair_1.svg` | Bücherregal + Bürostuhl im Büro | Inline-SVG (kopiert) |
| `octopus_1.svg`, `duck_1.svg` | Tintenfisch + Quietscheente im Badezimmer | Inline-SVG |
| `bathtub_1_1/1_2.svg`, `toilet_2_1/2.svg` | Wanne + WC, je 2 Switch-States | Inline-SVG |
| `skeleton_3.svg` | Tanzendes Skelett im Keller | `<image href>` |
| `toilet_1.svg`, `chair_2.svg`, `skeleton_1/2.svg`, `human_1_left.svg` | nicht aktiv | — |

**Cache-Busting** in `index.html`: aktuell `style.css?v=23`, `script.js?v=71`. Bei Änderungen an `script.js` oder `style.css` das `?v=N` hochzählen, sonst hängt die alte Version im Browser-Cache.

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
const FIGUR_FU_MIN = 0.06, FIGUR_FU_MAX = 0.94;
const FIGUR_FV_MIN = 0,    FIGUR_FV_MAX = 0.97;
```

Komplett schwarz, Augen + Mund weiss, keine Haare/Schuhe/Ohren. `zeichneFigur()` (top-down): Beine mit Sinus-Gehanimation, Körper, Arme, Hals, Kopf, Gesicht. `figur.richtung` zeigt immer in die TATSÄCHLICHE Laufrichtung — beim Slide um ein Hindernis dreht sich die Figur entsprechend.

## Räume

| ID | Name | Türen → Ziel | Wandfarben | Inhalt |
|---|---|---|---|---|
| `haupt` | Hauptraum | A→Büro, B→Badezimmer, L→Garten, geheim→Keller | b90/b90, Wände b70 | Bookshelf + 6 Pflanzen + Tisch1 mit Lavalampe |
| `buero` | Büro | Pfeil→Haupt, F→Badezimmer | b90/b90, Wände b70 | Tisch2 + Tischlampe + Notizzettel + Bücherregal + Bürostuhl |
| `badezimmer` | Badezimmer | Pfeil→Haupt, B→Büro | b90/b90, Wände b70 | Tintenfisch, 2 Toiletten, Wanne mit Ente |
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

- **Hauptraum:** A, B an hinterer Wand, L an linker Wand, geheim an rechter Wand (`secret: true`, wandfarben).
- **Büro/Badezimmer:** `zurueck` als 2D-Pfeil unten am Bildrand (`PFEIL_POLYGON`); seitliche Durchgangstür F bzw. B.
- **Garten/Keller:** einzelne Rück-Tür auf Seitenwand.

**Türen-Schlösser:** `schloss: "<id>"` macht Tür gesperrt, bis der Schlüssel in `spielstand.freigeschalteteTueren` liegt. `zeichneSchloss()` malt ein weisses Schloss unten in der Tür (NICHT auf `secret`-Türen). Aktuell verschlossen: Geheim-Tür im Hauptraum (`schloss: "keller_schluessel"`).

## Farb-Palette

Graustufen `GRAU.bX` (X=0..100, b0=weiss, b100=schwarz):

```js
GRAU = { b0:"#ffffff", b20:"#cccccc", b40:"#999999", b50:"#808080",
         b60:"#666666", b70:"#4d4d4d", b80:"#333333", b90:"#1a1a1a", b100:"#000000" };
```

Globale Farben (Türen, Figur) in `FARBEN`. Raum-Wandfarben in `RAEUME[id].farben`. Body-Background: schwarz.

**Sättigungs-Filter `#grell`** (`saturate=2`) sitzt auf JEDEM `<g data-raum="...">` → alle Möbel/Deko erben kräftigere Farben automatisch. Eigener `filter=` auf einem Kind komponiert sich multiplikativ mit dem Parent-Filter (zuerst Kind, dann Parent).

**Override** für individuelle Saturierung: `effekt = 2 × kind_value`. Vordefinierte Filter:
- `#grell-mild` (`values="0.75"`) → effektiv saturate **1.5**. Aktuell: chair_1, bookshelf_2.
- `#grell-soft` (`values="0.5"`) → effektiv saturate **1.0** (Originalfarben). Aktuell ungenutzt.

Für andere Levels neuen Filter ergänzen: `values=ZIEL/2`. ID-Suffix beschreibt den Effekt-Wert, nicht den internen `values`-Wert. Ausnahme: `#invert` (Skelett) ist ein Schwarz/Weiß-Inverter — hat keinen Saturate-Anteil und wird vom Parent-`#grell` nicht beeinflusst (B/W ist saturierungsneutral).

## Möbel & Deko pro Raum

### Hauptraum

Inline-SVG-Reihenfolge in `<g data-raum="haupt">`:
1. **Bookshelf** an hinterer Wand: `<g id="bookshelf" transform="translate(650 310) scale(0.5)">`. 5 Regale, Pflanzen in Regal 1 + 5. (Saturierung kommt jetzt vom Parent `<g data-raum="haupt" filter="url(#grell)">` — siehe Farb-Palette.)
2. **Möbel-Gruppe** `<g id="haupt-moebel">` — VOR den Pflanzen, damit Pflanzen mit kleinerem fv (näher zur Kamera) in Render-Order über dem Tisch landen:
   - **Tisch 1** (`assets/table_1.svg`): Anker bottom-left = SVG (262.6, 578) → Screen (270, 640), σ=0.82. `data-fv="0.87"`. Perspektivisch korrigiert (rechte Tischplattenkante zum Fluchtpunkt 800/225 hin verlängert; rechtes Bein gespiegelt).
   - **Lavalampe** auf Tisch 1: vereinfachte flache-Farben-Variante aus `lamp_lava_1.svg`. Wrapper `translate(362 584) scale(0.30) translate(-375 -728)`. `data-fv="0.87"`.
3. **Pflanzen** (`<g id="plants">`, 6 Stück) — Transform-Muster: `translate(bx, by) scale(σ) translate(-256, -512)` verankert Topfboden (256, 512) im viewBox an Bodenpunkt. Formel: `σ = s · basisBreite / 512`. Jede Pflanze hat `data-fv` für Tiefensortierung:

| Pflanze | fu | fv | bw | r (Hindernis) |
|---|---|---|---|---|
| tulpe | 0.15 | 0.12 | 175 | 0.05 |
| blume | 0.87 | 0.15 | 175 | 0.05 |
| kraeuter | 0.85 | 0.45 | 92 | 0.025 |
| setzling | 0.12 | 0.50 | 118 | 0.035 |
| geranie | 0.94 | 0.78 | 100 | 0.03 |
| yucca | 0.034 | 0.79 | 104 | 0.03 |

Bookshelf hat zusätzliche Interaktion via `OBJEKTE.haupt[0]`: `aufgabe: "bookshelf_umfang"` + `akzeptiert.notizzettel` (Drop-Target).

### Büro

- **Tisch 2** (`assets/table_2.svg`, L-Schreibtisch): Anker = front-left-leg-Fuss SVG (311, 613) → Screen (240, 700), σ=0.55. Vorderlinks. **Helle Holz-Palette** (Original-Hex-Codes global ersetzt: `#512F18→#8B6740`, `#C77137→#DEAA6F` usw.). Metallbeine grau, Schubladengriffe `#D1C6BF`.
- **Tischlampe** auf Tisch 2 (handgezeichnet inline, klassische Schreibtischlampe). Standfuss bei Screen (340, 495). Schirm um -20° gedreht, zwei Flächen-Hälften (`#987230` rechts/Licht, `#7a5a20` links/Schatten) mit gekrümmter Bezier-Unterkante; halbtransparenter Lichtkegel `#fff5b8` opacity 0.20.
- **Demo-Notizzettel** am Boden (`OBJEKTE.buero[0]`): per `zeichnen`-Callback als Brief auf Canvas gemalt. `aufnehmen: "notizzettel"`. Drop auf Bookshelf zeigt Hinweis-Overlay.
- **Bücherregal** `#bookshelf_2` (Inline-SVG, ursprünglich aus `assets/bookshelf_2.svg`): hinten-rechts an Wand, `x=700, y=270, 600×600`. Eigene Saturierung: `filter="url(#grell-mild)"`. Kein Hindernis (an Wand).
- **Schreibtischstuhl** `#chair_1` (Inline-SVG): vor Tisch 2 (im DOM nach Tisch = visuell davor), `x=200, y=440, 180×290`, an y-Mittelachse gespiegelt via `transform="matrix(-1 0 0 1 580 0)"`. Eigene Saturierung: `filter="url(#grell-mild)"`. Manuelle Säuberung der SVG: `path1545` (Detail) entfernt; alle übrigen Pfade haben `stroke = ihr Fill` mit `stroke-width:1` (puffen sich minimal auf, keine schwarze Outline). Kein eigenes Hindernis (im Footprint des Tisches).

### Badezimmer

- **Tintenfisch** (`assets/octopus_1.svg`) inline, hinten-rechts. Anker `<svg class="octopus" x="970" y="408" width="440" height="330" viewBox="0 0 640.08 479.93">`. CSS in `style.css`:
  - `.octopus *:not(#path4647) { stroke: none !important }` — entfernt schwarze Outlines global, AUSSER beim Mund.
  - **Augen-Pupillen** (path3950, path3950-4): liegen IM Auge, behalten Inline-`fill:#000`.
  - **Mund** (`#path4647`): offene Kurve, nur Stroke, Farbe `#5a0000` (dunkelrot).
- **Sanitärobjekte** (Renderreihenfolge hinten → vorn). Drei Switch-Paare: jeweils zwei `<svg>`-Blöcke an exakt derselben Position/Größe, einer initial sichtbar, der andere `display:none`. Konvention: `#X_1` = Initialzustand (Ring unten / blaues Wasser), `#X_2` = nach Handlung (Ring oben / klares Wasser):
  - **Toilette 2** (x=600, Frontansicht „grauer Schatten-Layer"): `#toilet_2_1` / `#toilet_2_2` bei (600, 420) 200×250
  - **Toilette 1** (x=800, visueller Klon der ersten): `#toilet_1_1` / `#toilet_1_2` bei (800, 420) 200×250
  - **Badewanne**: `#bathtub_1_1` (blaues Wasser `#A7C5EA`) / `#bathtub_1_2` (klares Wasser `#FCFCFC`) bei (130, 440) 600×200
  - `duck_1` schwimmt auf der Wanne
  - **Shared `<style>` Block** im `<g data-raum="badezimmer">` für `.st1-.st10` (von allen Toiletten-SVGs geerbte CSS-Klassen), einmalig definiert.

  Hinweis zur Nummerierung: Die "1"/"2" hinter `toilet_` ist KEINE räumliche Reihenfolge — folgt den ursprünglichen Asset-Namen. Toilette 2 (x=600) wurde zuerst umgesetzt (`toilet_2_*.svg`-Frontansicht), Toilette 1 (x=800) später als Klon hinzugefügt.

### Garten

Decke + linkeWand + hintereWand alle Himmelsblau → `zeichneZimmer()` füllt einen einzigen `fillRect` mit Himmel, dann werden Boden (nahtlos) und rechte Hauswand drübergezeichnet. So entstehen keine Subpixel-Säume.

`zeichneGartenZaun()` (auf `ctxRaum`) malt in dieser Reihenfolge: Sonne → Horizont-Silhouetten → Gras (nahtlos) → Horizont-Büsche (`vor: true`) → Nah-Büsche (Canvas-Ellipsen) → Detail-Büsche `bush_1..4` (per `drawImage`) → Zaun hinten + links → rechte Hauswand drüber (clippt Büsche).

**Detail-Büsche** (`BUESCHE`): SVGs als `Image`-Objekte geladen (`ladeBuschBild`), per `drawImage` gerastert (damit der Zaun sie verdecken kann). `bush_4` hat am `<g>` `stroke-width="25"` mit `stroke="{eigener fill}"` pro Pfad — Pfade „puffen" minimal, KEINE schwarze Outline.

**Sträucher** (12 Stück) durch `baueGartenDeko()` beim Start erzeugt. 4 Varianten (`STRAUCH_VARIANTEN`) mit unterschiedlichen Blatt-Auswahlen und Grüntönen. Pfade aus `plant_strauch.svg`.

### Keller

Wände/Decke/Boden in dunklen Grautönen (b80/b100/b90). **Skelett** aus `skeleton_3.svg` via `<image href>`, perspektivisch hinten-rechts (Füsse bei (1236, 645), 177×250). Farb-Invertierung via SVG-Filter `#invert` (schwarz → weiss). Schaukel-Animation: `<animateTransform type="rotate">` um die Füsse, ±6°, 2.5 s.

## Hindernis-System (Kollision)

`HINDERNISSE[raumId]` ist ein Array. Jedes Hindernis ist entweder ein **Kreis** mit `{ fu, fv, r }` oder eine **Ellipse** mit `{ fu, fv, rx, ry }`. Funktionen `istImHindernis`, `slideUmHindernis`, `setzeFigurZiel` benutzen `h.rx ?? h.r` und `h.ry ?? h.r` → Kreise mit `r` bleiben rückwärts-kompatibel.

- `istImHindernis(fu, fv)`: `(dfu/rx)² + (dfv/ry)² < 1` (Ellipsen-Gleichung).
- `setzeFigurZiel(fu, fv)`: liegt das Ziel innerhalb, schiebt es radial nach aussen auf 1.05 × Ellipsen-Rand und clamped auf den Laufbereich. Safety Net für Tür-Laufziele nahe Pflanzen.
- `slideUmHindernis(ux, uy, schritt)`:
  1. Sucht das blockierende Hindernis (in Laufrichtung, senkrechter Versatz ≤ max(rx, ry) + 0.02).
  2. Tangenten-Richtung senkrecht zum **Ellipsen-Gradient** an Figur-Position.
  3. Bevorzugt die Seite mit positivem Dot zur Laufrichtung.
  4. **Wand-Fallback:** verlässt die bevorzugte Seite den Laufbereich oder führt in ein anderes Hindernis → ANDERE Seite probieren. Nur wenn beide blockiert sind, stoppt die Figur.
- **Safety-Net** in `aktualisiereFigur`: vor jedem Schritt wird geprüft, ob die Figur in einem Hindernis ist. Falls ja → radial nach aussen schieben + clamp.

Pflanzen-Radien orientieren sich am Fussabdruck (Topfbasis), nicht am Blattwerk → Figur kann knapp vorbei, der Körper verschwindet perspektivisch hinter den Blättern.

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
    zustaende: { badewanne: 1, toilette_1: 1, toilette_2: 1 },  // 1 = Initialstate, 2 = nach Handlung (Badezimmer)
};
```

**Sanitärobjekt-Switch:** `aktualisiereSanitaer()` togglet `display` der sechs `<svg>`-Blöcke (`#bathtub_1_1/1_2`, `#toilet_1_1/1_2`, `#toilet_2_1/2_2`) basierend auf `spielstand.zustaende`. Wird beim Init und nach jeder Zustandsänderung aufgerufen. Auslösende Handlungen sind noch zu definieren — dann genügt im `bei_richtig`-Callback ein `setzeBadewanne(2)`, `setzeToilette1(2)` oder `setzeToilette2(2)`. Die beiden Toiletten sind unabhängig schaltbar.

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
klonePflanzenVorne()               // klont alle [data-fv]-Elemente in #object-layer-vorne
ladeBuschBild(src)                 // cached Image-Loader für Detail-Büsche
zeichneBuschBild(def)              // rendert einen Detail-Busch via drawImage
```

## Stolpersteine

- **Cache-Busting:** bei Änderungen an `script.js` oder `style.css` das `?v=N` in `index.html` hochzählen.
- **Pflanzen-/Tisch-Position ändern:** `HINDERNISSE` (Kollision) UND `data-fv` im HTML (Tiefensortierung) UND Transform (Rendering) müssen synchron bleiben.
- **Möbel vor Pflanzen im DOM:** Tisch1 + Lavalampe sind in `<g id="haupt-moebel">` VOR `<g id="plants">` — sonst überdeckt der Tisch die davor stehenden Pflanzen.
- **`<image href>`** funktioniert für externe SVGs (z.B. skeleton_3). Inline-SVG ist Pflicht, wenn einzelne Pfade per ID adressierbar sein sollen (z.B. zum Entfernen, Recolor, Stroke setzen) — externe SVGs sind eine Black Box.
- **Detail-Büsche per `drawImage`** statt `<image href>` — damit der Zaun sie verdecken kann (würde in der SVG-Mittel-Ebene nicht gehen).
- **SVG-Filter `filter="url(#name)"`** statt CSS-Filter — robuster (#grell für Bookshelf-Sättigung, #invert für Skelett-Farbinversion).
- **Body-CSS:** `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none` — verhindert Scroll/Verschieben.
- **Sanitärobjekt-Switch-Partner** (Wanne 1_1/1_2, Toilette 1_1/1_2, 2_1/2_2) müssen exakt dieselbe Position/Größe haben — sonst „springt" das Objekt beim Umschalten.

## Roadmap

**Aktueller Stand:** Infrastruktur, Spielstand, Aufgaben-UI, Inventar + Drag & Drop, Kollision (Kreise + Ellipsen), Tiefensortierung, Sanitär-Switch (Badezimmer) — alles drin. Demo-Aufgabe `bookshelf_umfang` mit Cross-Room-Lookup funktioniert. Büro inhaltlich gefüllt (Schreibtisch, Lampe, Bücherregal, Bürostuhl). Saturierungs-Override-Konvention (`#grell-mild`/`#grell-soft`) etabliert.

**Phase 4: Inhalte (mit Manuel)**
- 10–15 Kreis-Aufgaben (Umfang, Fläche, Durchmesser, Radius)
- Linearer Lösungsweg I → II → III → IV, aber Infos aus Raum A werden in Raum C gebraucht
- Auslösende Handlungen für Sanitär-Switch festlegen (welche Aufgabe → `setzeBadewanne(2)` etc.)

**Phase 5 Restpunkte (nach Phase 4)**
- Hinweise bei falscher Antwort (pro Aufgabe konfigurierbar)
- `localStorage` für Fortschritt (erst nach Phase 4 sinnvoll)

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
