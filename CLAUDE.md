# CLAUDE.md – Projektübersicht für neue Chat-Sessions

Dieses Dokument erklärt Claude die Architektur des Projekts, damit ein neuer Chat sofort weiterarbeiten kann.

## Projektkontext

Ein interaktives Mathe-Lernspiel für den Schulunterricht (Thema: Kreise).
Gebaut als **Vanilla HTML/CSS/JS** – kein Build-Tool, kein Framework.
Entwickler: Manuel Benz (Lehrer, wenig Programmiererfahrung).
GitHub-Repo: `Manuel-Benz/Spiel_Kreise_1`

## Dateistruktur

```
index.html        ← 2 Canvases + SVG-Layer + inline-SVG-Dekoration (Bookshelf)
style.css         ← Layout, Stage-Styling, Canvas/SVG-Positionierung
script.js         ← Spiellogik (Zimmer, Türen, Figur, Eingabe, Dual-Canvas-Draw)
assets/           ← SVG-Dateien (Pflanzen, Bookshelf-Vorlage, Figuren-Varianten)
CLAUDE.md         ← diese Datei
```

Cache-Busting in `index.html`: aktuell `style.css?v=12`, `script.js?v=31` — bei Änderungen hochzählen.

## Rendering-Ebenen (hinten → vorne)

Die Szene verwendet **zwei Canvases mit einer SVG-Ebene dazwischen**, damit die Figur VOR der SVG-Dekoration (z. B. Bookshelf) steht, aber HINTER nichts anderem:

1. `#game-canvas` — Zimmer (Wände, Boden, Decke) + Türen
2. `#object-layer` (SVG, ViewBox `0 0 1600 900`) — Dekoration an der hinteren Wand (Bookshelf inline)
3. `#figure-canvas` — animierte Figur

In `script.js` wird dafür `let ctx` (mutable) in `draw()` zwischen `ctxRaum` und `ctxFigur` umgeschaltet:

```js
function draw() {
    ctx = ctxRaum;  clearRect; zeichneZimmer(); zeichneTueren();
    ctx = ctxFigur; clearRect; zeichneFigur();
}
```

`resizeCanvas()` setzt beide Canvases auf dieselbe DPR-aware Pixelgrösse. Klicks landen auf `#game-canvas`; `#figure-canvas` und SVG haben `pointer-events: none`.

## Koordinatensystem

Logisch: **1600 × 900** (16:9). Stage-Grösse wird in JS berechnet (`resizeCanvas`) und als Pixel auf `#game-stage` gesetzt — CSS hat nur Fallback-Regeln.

```js
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
```

## Zimmer-Geometrie (perspektivisches 2D-Zimmer)

```js
const ZIMMER = {
    decke:       [[0,0],[300,100],[1300,100],[1600,0]],
    boden:       [[0,900],[300,600],[1300,600],[1600,900]],
    linkeWand:   [[0,0],[300,100],[300,600],[0,900]],
    rechteWand:  [[1600,0],[1300,100],[1300,600],[1600,900]],
    hintereWand: [[300,100],[1300,100],[1300,600],[300,600]],
};
```

Fluchtpunkt ca. (800, 225). Horizont y=225 (fv=1). Perspektive-Skala `s = 1 - 0.45 * fv`.

### Boden- & Wand-Koordinaten

```js
bodenPunkt(fu, fv)                 // fu 0..1 links→rechts, fv 0..1 vorne→hinten
screenZuBoden(x, y)                // inverse, liefert null ausserhalb Boden
linkeWandPunkt(u, v)               // u 0..1 Tiefe, v 0..1 Boden→Decke
rechteWandPunkt(u, v)
```

## Türen

Alle Türen stehen jetzt **auf dem Boden**. A/B und L sind 10 % kleiner als ursprünglich, die Geheimtür 50 %.

```js
TUEREN = [
  { id:"A", label:"A",  polygon:[[460,600],[640,600],[640,240],[460,240]] },   // hintere Wand links
  { id:"B", label:"B",  polygon:[[960,600],[1140,600],[1140,240],[960,240]] }, // hintere Wand rechts
  { id:"L", label:"L",  polygon:[linkeWandPunkt(0.225,0)…(0.675,0.72)] },       // linke Wand
  { id:"geheim", secret:true, polygon:[rechteWandPunkt(0.325,0)…(0.575,0.4)] }, // rechte Wand, farbgleich mit Wand
];
```

**Gap zwischen Tür A und Tür B:** x = 640..960 (hier sitzt das Bookshelf).

## Farb-Palette (tikz-Notation black!X)

Graustufen-Palette `GRAU.bX` (X=0..100, `b0`=weiss, `b100`=schwarz):

```js
GRAU = { b0:"#ffffff", b20:"#cccccc", b40:"#999999", b50:"#808080",
         b60:"#666666", b70:"#4d4d4d", b80:"#333333", b90:"#1a1a1a", b100:"#000000" };
```

### FARBEN

- Zimmer: Decke+Boden `b90`, Wände `b70`
- Türen: Tür `b50`, Label `b100`, Geheimtür `b70` (wandgleich)
- Figur: **alles schwarz (b100)** — Augen und Mund sind `b0` (weiss)

Page-Background (body) ist schwarz (`#000`).

## Figur (abstrakt)

Figur ist komplett schwarz mit weissen Details. Keine Haare, keine Schuhe, keine Ohren.

```js
figur = { fu:0.5, fv:0.25, zielFu, zielFv, richtung:"vorne"|…, geschwindigkeit:0.008, gehphase:0 }
const GEHPHASE_SCHRITT = 0.18, BEIN_HUB = 0.22, FIGUR_SKALA = 1.0;
```

`zeichneFigur()` baut Top-down:
1. Beine (ohne Schuhe, Gehanimation via Sinus mit π-Phasendifferenz)
2. Körper: Seitenansicht hat `bodyW * 0.9` Breite (vorher 0.6)
3. Arme: vorne/hinten beidseits, seitlich ein Arm mit Schwung
4. Hals
5. Kopf (schwarzer Kreis)
6. **Nase:** vorne senkrechtes Oval, rotiert ~0.36 rad; seitlich waagrechtes Oval, rotiert `seite * 0.6` rad (Spitze nach unten-aussen). Schwarz → nur als Silhouette sichtbar von der Seite.
7. **Augen:** kleine weisse Kreise (`augenR = headR*0.1`)
8. **Mund:** weisser Lächel-Mondschnitz via zwei Quadratic-Curves (`zeichneLaecheln`). Offen nach oben = ∪.

Keine Umrandungen auf irgendeinem Element.

## Bookshelf (SVG, hintere Wand zwischen den Türen)

**Inline-SVG** in `index.html` direkt innerhalb `<svg id="object-layer">`. Keine `fetch()`-Abhängigkeit.

- Container: `<g id="bookshelf" transform="translate(650 310) scale(0.5)" filter="url(#grell)">`
- 5 Regale (`regal-1` … `regal-5`) mit 110 lokalem Abstand (display 55 px)
- Display-Bereich: x 647..953, y 310..580 (zwischen Tür A x≤640 und Tür B x≥960, knapp über Boden y=600)
- Lokales Koordinatensystem pro Regal: 600×100, weisses Regalbrett y 92..100, Bücher y 10..92

**Sättigungs-Filter** in `<defs>`: `<filter id="grell"><feColorMatrix type="saturate" values="2"/></filter>` — macht alle Farben (Bücher, Pflanzen) greller.

**Regal-Variationen** (alle handgezeichnet mit `<rect>`-Elementen, Pastell-Palette):
- **Regal 1 (oben):** 2 Pflanzen (links `plant_gras.svg` inline, rechts `plant_blattpflanze.svg` inline — Pfade direkt aus den SVG-Dateien kopiert, viewBox 512×512, skaliert mit 0.156) + wenige Bücher dazwischen.
- **Regal 2:** 22 variierte Bücher, eines leicht gekippt bei x=58.
- **Regal 3:** Bücher mit Mustern (vertikale/diagonale Streifen, Punkte, horizontale Bänder, Titelblock).
- **Regal 4:** liegende Bücherstapel links und rechts, drei geneigte Bücher (x=62, 245, 554), Lücke in der Mitte.
- **Regal 5 (unten):** Handgezeichnete Pflanze links + Bücher mit rotierten Buchexemplaren.

## Input / Loop

```
Seitenladen → requestAnimationFrame → resizeCanvas() → loop()
  (Startbildschirm ist auskommentiert — siehe index.html; Auto-Start nach `<script>`-Load.)
loop(): aktualisiereFigur() → draw() → requestAnimationFrame(loop)
canvas.pointerdown → screenZuBoden → figur.zielFu/zielFv setzen
window.resize → resizeCanvas() (setzt game-stage + beide Canvases neu)
```

## SVG-Helfer (in script.js, aktuell ungenutzt)

```js
async function ladeSVG(pfad)                              // fetch + DOMParser
function platziereAufBoden(svgRoot, fu, fv, basisBreite)  // perspektivisch auf Boden
function platziereImZimmer(svgRoot, x, y, breite, hoehe)  // fixe Canvas-Koordinaten
function entferneAlleSVGs()                               // svgLayer.innerHTML = ""
```

Aktuell nicht aktiv gebraucht (Bookshelf ist direkt inline in HTML). Beim Nutzen: lokalen Server starten (`python3 -m http.server 8000`), da `fetch()` nicht unter `file://` läuft.

## Bekannte Eigenheiten / Stolpersteine

- **Preview-Panel in Claude Code funktioniert bei diesem Projekt nicht zuverlässig.** Immer im Browser testen (`Cmd+R`, bei HTML-only-Änderungen ggf. Hard-Refresh `Cmd+Shift+R`).
- **Cache-Busting:** bei Änderungen an `script.js` oder `style.css` `?v=N` in `index.html` hochzählen. HTML selbst hat kein Busting → Hard-Refresh nutzen.
- **Zwei Canvases:** jede Renderänderung muss auf den richtigen Context zeichnen. In `draw()` wird `ctx` zwischen `ctxRaum` und `ctxFigur` umgeschaltet.
- **SVG-Filter `filter="url(#grell)"`** ist SVG-nativ und zuverlässiger als `style="filter: saturate(…)"` auf `<g>`.
- **CSS `pointer-events: none`** auf Figur-Canvas und SVG-Layer — sonst würden Klicks nicht zum `game-canvas` durchreichen.
- **Body ist `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none`** — verhindert, dass sich die Ansicht verschieben lässt.
- **Startbildschirm** ist in `index.html` ausgeklammert; Auto-Start am Ende von `script.js`. Zum Reaktivieren: Block einkommentieren und den Auto-Start-Block (Kommentar) entfernen.

## Geplante Features (noch nicht implementiert)

- Mathe-Inhalt: Aufgaben zu Kreisen (Umfang, Fläche, Durchmesser)
- Mehrere Räume (5 geplant), zwischen denen man durch Türen wechselt
- Mehr Möbel/Dekoration (Tisch, Stuhl, Regale an Seitenwänden)
- GitHub Pages für öffentlichen Zugriff
- Spielmechanik: Objekte im Raum anklicken → Mathe-Aufgabe erscheint

## Git / GitHub

- Remote: `https://github.com/Manuel-Benz/Spiel_Kreise_1`
- Workflow: `git add <datei>` → `git commit -m "Nachricht"` → `git push`
