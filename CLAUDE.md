# CLAUDE.md – Projektübersicht für neue Chat-Sessions

Dieses Dokument erklärt Claude die Architektur des Projekts, damit ein neuer Chat sofort weiterarbeiten kann.

## Projektkontext

Ein interaktives Mathe-Lernspiel für den Schulunterricht (Thema: Kreise).
Gebaut als **Vanilla HTML/CSS/JS** – kein Build-Tool, kein Framework.
Entwickler: Manuel Benz (Lehrer, wenig Programmiererfahrung).
GitHub-Repo: `Manuel-Benz/Spiel_Kreise_1`

## Dateistruktur

```
index.html        ← Startscreen + Canvas + SVG-Layer
style.css         ← Layout, Game-Container, Skalierung
script.js         ← gesamte Spiellogik (Zimmer, Figur, Eingabe, SVG-Helfer)
assets/           ← SVG-Dateien für Dekoration (via fetch() laden)
CLAUDE.md         ← diese Datei
```

Cache-Busting: `style.css?v=7`, `script.js?v=8` — bei Änderungen jeweils hochzählen (in index.html).

## Technische Architektur

### Koordinatensystem

Logisches Canvas: **1600 × 900** Pixel (16:9).
Der Canvas skaliert sich per CSS auf jede Bildschirmgrösse (`devicePixelRatio`-aware).

```js
const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;
// In resizeCanvas(): ctx.setTransform(scale, 0, 0, scale, 0, 0);
```

### Hybrid Canvas + SVG

- **Canvas** (`#game-canvas`): Zimmer + Figur, wird jeden Frame neu gezeichnet (requestAnimationFrame)
- **SVG-Layer** (`#object-layer`): für Möbel, Pflanzen etc. — gleicher ViewBox `0 0 1600 900`
  - `pointer-events: none` auf dem SVG, `auto` auf SVG-Kinder
  - SVG-Dateien werden per `fetch()` geladen → **braucht HTTP-Server** (kein `file://`)
  - Lokaler Server starten: `python3 -m http.server 8000` → `http://localhost:8000`

### Zimmer-Geometrie (perspektivisches 2D-Zimmer)

```js
const ZIMMER = {
    decke:       [[0,0],[300,100],[1300,100],[1600,0]],
    boden:       [[0,900],[300,600],[1300,600],[1600,900]],
    linkeWand:   [[0,0],[300,100],[300,600],[0,900]],
    rechteWand:  [[1600,0],[1300,100],[1300,600],[1600,900]],
    hintereWand: [[300,100],[1300,100],[1300,600],[300,600]],
};
```

Fluchtpunkt: ca. (800, 225). Horizont bei y=225 (Bodentiefe fv=1).

### Boden-Koordinaten

```js
// fu = 0 (links) … 1 (rechts), fv = 0 (vorne) … 1 (hinten)
function bodenPunkt(fu, fv) {
    return [fu * (1600 - 600*fv) + 300*fv,  900 - 300*fv];
}
function screenZuBoden(x, y) {
    const fv = (900 - y) / 300;
    if (fv < 0 || fv > 1) return null;
    const fu = (x - 300*fv) / (1600 - 600*fv);
    if (fu < 0 || fu > 1) return null;
    return [fu, fv];
}
// Perspektivische Skalierung:
const s = 1 - 0.45 * fv;   // s=1 vorne, s=0.55 hinten
```

### Wand-Koordinaten

```js
function linkeWandPunkt(u, v)  // u=0 vorne, u=1 hinten; v=0 Boden, v=1 Decke
function rechteWandPunkt(u, v)
```

### 4 Türen

```js
const TUEREN = [
    { id:"A", label:"A", polygon:[[450,600],[650,600],[650,200],[450,200]] },  // hintere Wand links
    { id:"B", label:"B", polygon:[[950,600],[1150,600],[1150,200],[950,200]] }, // hintere Wand rechts
    { id:"L", label:"L", polygon:[linkeWandPunkt(0.2,0), linkeWandPunkt(0.7,0), linkeWandPunkt(0.7,0.8), linkeWandPunkt(0.2,0.8)] },
    { id:"geheim", label:null, secret:true, polygon:[rechteWandPunkt(0.2,0), ...] }, // unsichtbar
];
```

### Figur (Canvas, animiert)

```js
const figur = {
    fu: 0.5, fv: 0.25,          // aktuelle Bodenposition
    zielFu: 0.5, zielFv: 0.25, // Klick-Ziel
    richtung: "vorne",           // "vorne" | "hinten" | "links" | "rechts"
    geschwindigkeit: 0.008,      // Schrittweite pro Frame (in fu/fv)
    gehphase: 0,                 // Winkel für Bein-Sinus-Animation
};
const GEHPHASE_SCHRITT = 0.18;
const BEIN_HUB = 0.22;
```

**Figur-Aufbau** (zeichneFigur):
1. Beine: links/rechts mit Sinus-Versatz (π Phasendifferenz)
2. Schuhe folgen den Beinenden
3. Körper: schmaler bei Seitenansicht (`bodyW * 0.6`)
4. Arme: bei Vorder/Rückansicht beidseits, bei Seite ein Arm mit Schwung
5. Hals
6. Kopf: **Haar als Basiskreis** (r × 1.08), darüber Haut-Ellipse als Gesicht
7. Gesichtsdetails je nach Richtung (Augen, Augenbrauen, Wangen, Nase, Mund)

**Farben** (FARBEN-Objekt):
- Figur: haut, hautSchatten, haare, haareGlanz, hemd, hemdSchatten, hose, schuh, wange, mund, kontur
- Zimmer: decke, boden, linkeWand, rechteWand, hintereWand, kante
- Türen: tuer, tuerRahmen, tuerLabel, tuerGeheim, tuerGeheimKante

### SVG-Helfer-Funktionen

```js
async function ladeSVG(pfad)                                   // fetch + DOMParser
function platziereAufBoden(svgRoot, fu, fv, basisBreite)       // perspektivisch auf Boden
function platziereImZimmer(svgRoot, x, y, breite, hoehe)       // fixe Canvas-Koordinaten
function entferneAlleSVGs()                                    // svgLayer.innerHTML = ""
```

### Animation Loop

```
startButton → startScreen.hidden=true → gameContainer.hidden=false
  → requestAnimationFrame → resizeCanvas() → loop() startet
loop(): aktualisiereFigur() → draw() → requestAnimationFrame(loop)
canvas.pointerdown → screenZuBoden → figur.zielFu/zielFv setzen
window.resize → resizeCanvas()
```

## Bekannte Eigenheiten / Stolpersteine

- **CSS-Bug war hier**: `#game-container { display: flex }` überschrieb das `hidden`-Attribut. Fix: `#game-container[hidden] { display: none }` in style.css.
- **Preview-Panel in Claude Code** funktioniert nicht zuverlässig — immer Browser verwenden (`Cmd+R`).
- **Cache-Busting**: bei JS/CSS-Änderungen `?v=N` in index.html hochzählen.
- **SVG via fetch()**: funktioniert nur über HTTP-Server, nicht bei `file://`.

## Geplante Features (noch nicht implementiert)

- Mathe-Inhalt: Aufgaben zu Kreisen (Umfang, Fläche, Durchmesser)
- Mehrere Räume (5 geplant), zwischen denen man durch Türen wechselt
- Möbel/Dekoration im Zimmer als SVG-Objekte
- GitHub Pages für öffentlichen Zugriff
- Spielmechanik: Objekte im Raum anklicken → Mathe-Aufgabe erscheint

## Git / GitHub

- Remote: `https://github.com/Manuel-Benz/Spiel_Kreise_1`
- Letzter Commit: `8a6fc80` „Zimmer, Türen, animierte Figur und SVG-Layer"
- Workflow: `git add <datei>` → `git commit -m "Nachricht"` → `git push`
