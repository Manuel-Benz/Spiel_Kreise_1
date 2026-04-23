# CLAUDE.md – Projektübersicht für neue Chat-Sessions

Dieses Dokument erklärt Claude die Architektur des Projekts, damit ein neuer Chat sofort weiterarbeiten kann.

## Projektkontext

Ein interaktives Mathe-Lernspiel für den Schulunterricht (Thema: Kreise), aufgebaut als **Escape-Room-artiges Abenteuer**: 5 Räume, lineare Aufgaben-Progression mit Cross-Room-Lookups.

Gebaut als **Vanilla HTML/CSS/JS** – kein Build-Tool, kein Framework.
Entwickler: Manuel Benz (Lehrer, wenig Programmiererfahrung).
GitHub-Repo: `Manuel-Benz/Spiel_Kreise_1`.

## Dateistruktur

```
index.html        ← 2 Canvases + SVG-Layer mit Deko-Gruppen pro Raum
style.css         ← Layout, Stage-Styling, Canvas/SVG-Positionierung
script.js         ← Räume, Türen, Figur, Deko-Generatoren, Input, Loop
assets/           ← SVG-Dateien (Pflanzen, Bookshelf, Skelette)
CLAUDE.md         ← diese Datei
```

Cache-Busting in `index.html`: aktuell `style.css?v=15`, `script.js?v=49` — bei Änderungen hochzählen.

## Rendering-Ebenen (hinten → vorne)

**Zwei Canvases mit einer SVG-Ebene dazwischen**, damit die Figur VOR der SVG-Dekoration steht:

1. `#game-canvas` (`ctxRaum`) — Zimmer (Wände, Boden, Decke), Türen, sowie **Raum-spezifisches Canvas-Drawing** (Garten-Zaun, Sonne, Gebüsch)
2. `#object-layer` (SVG, viewBox `0 0 1600 900`) — pro Raum eine Deko-Gruppe `<g data-raum="…">`; JS blendet per `display` um
3. `#figure-canvas` (`ctxFigur`) — nur die animierte Figur

In `script.js` wird `let ctx` (mutable) in `draw()` zwischen `ctxRaum` und `ctxFigur` umgeschaltet:

```js
function draw() {
    ctx = ctxRaum;  clearRect; zeichneZimmer(); zeichneTueren();
    ctx = ctxFigur; clearRect; zeichneFigur();
}
```

`resizeCanvas()` setzt beide Canvases auf dieselbe DPR-aware Pixelgrösse. Klicks landen auf `#game-canvas`; `#figure-canvas` und SVG haben `pointer-events: none`.

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

Fluchtpunkt ca. (800, 225). Horizont y=225 (fv=1). Perspektive-Skala **`s = 1 - 0.45·fv`** (Herleitung: geometrisch korrekt durch Horizont und Bodenkanten — siehe Gespräch).

### Boden- & Wand-Koordinaten

```js
bodenPunkt(fu, fv)     // fu 0..1 links→rechts, fv 0..1 vorne→hinten
screenZuBoden(x, y)    // inverse, liefert null ausserhalb Boden
linkeWandPunkt(u, v)   // u 0..1 Tiefe, v 0..1 Boden→Decke
rechteWandPunkt(u, v)
```

## Raum-System

Aktuell **5 Räume** über das `RAEUME`-Objekt konfiguriert:

| ID | Name | Türen → Ziel | Besonderheiten |
|---|---|---|---|
| `haupt` | Hauptraum | A→Büro, B→Fitness, L→Garten, geheim→Keller | Bookshelf + 6 Pflanzen |
| `buero` | Büro | Pfeil→Haupt, F→Fitness | warmes Braun, Holzboden |
| `fitness` | Fitnessraum | Pfeil→Haupt, B→Büro | kühles Blau |
| `garten` | Garten | H→Haupt | Himmel, Wiese, Zaun, Sonne, 12 Sträucher |
| `keller` | Keller | H→Haupt | dunkel, tanzendes Skelett hinten rechts |

`aktuellerRaum` hält die aktive ID. `wechsleRaum(zielId)`:
- merkt sich `vonRaum = aktuellerRaum`, setzt `aktuellerRaum = zielId`
- blendet alle `<g data-raum>` ausser dem Ziel auf `display:none`
- **Eintrittsposition richtungsabhängig:** Sucht im Zielraum die Tür, deren `ziel === vonRaum`, und nutzt deren `laufziel` als Figur-Position. Fallback: `RAUM_EINTRITT = {fu: 0.5, fv: 0.3}`
- `eintrittsRichtung(fu, fv)` setzt `figur.richtung` so, dass die Figur „in den Raum" schaut (fu<0.2 → rechts, fu>0.8 → links, fv>0.8 → vorne, fv<0.2 → hinten)
- ruft `draw()`

Klick-Handler prüft **zuerst Tür-Polygone** (via `istInPolygon`) → `wechsleRaum()`, sonst Bodenpunkt → Figur läuft.

## Türen pro Raum

Jede Tür hat `polygon`, `ziel` (Raum-ID), `laufziel: {fu, fv}` (Zielpunkt auf dem Boden vor der Tür), optional `label`/`secret`/`pfeil`/`schloss`.

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

`zeichneFigur()` (top-down): Beine mit Sinus-Gehanimation, Körper (Seitenansicht breiter), Arme (frontal beidseits, seitlich mit Schwung), Hals, Kopf, Gesicht. **Nase-Rotation frontal: `Math.PI/12` (15°).**

## Bookshelf (Hauptraum, hintere Wand)

Inline-SVG in `index.html` unter `<g data-raum="haupt">`. Container:
```
<g id="bookshelf" transform="translate(650 310) scale(0.5)" filter="url(#grell)">
```

5 Regale, handgezeichnet mit `<rect>`, Pflanzen (Gras, Blattpflanze) in Regal 1 und 5.

**Sättigungs-Filter** `#grell` in `<defs>` (`feColorMatrix saturate 2`).

## Pflanzen im Hauptraum (6 Stück)

Inline-SVG-Gruppen, inhaltskorrigiert skaliert. Transform-Muster: `translate(bx, by) scale(σ) translate(-256, -512)` — verankert Topfboden (256, 512) im viewBox an Bodenpunkt.

Formel: `σ = s · basisBreite / 512`. Sichtbare Breite berücksichtigt **Inhaltsratio** (welcher Anteil der 512×512 viewBox tatsächlich gefüllt ist — z. B. blume 52 %, yucca 88 %, kraeuter 99 %).

Plant-Positionen (fu, fv, basisBreite, Inhaltsratio): tulpe/blume vorne, kraeuter/setzling mitte, yucca/geranie hinten. Farben leicht varianziert.

## Garten (Spezialfall)

Rendering in `zeichneGartenZaun()` (auf `ctxRaum`, wird aus `zeichneZimmer()` bei `aktuellerRaum === "garten"` gerufen):

**Reihenfolge:**
1. `zeichneSonne()` — gelber Kreis + 12 Strahlen bei (1200, 200), r=42
2. **Horizont-Büsche** als Silhouetten (7 Stück) — werden gleich vom Gras halb verdeckt
3. **Grashorizont** rechteckig (x=300..1300, y=340..600) + perspektivisch links als Wiese
4. **Nah-Büsche** auf linker Wiese (4 Stück) — vor dem Zaun
5. **Zaun hinten** — 9 Pfosten + 2 Verstrebungen, y=420–600
6. **Zaun links** — perspektivisch via `linkeWandPunkt(u, v)`, 8 Pfosten (u=0.04..0.88, Abstand 0.12), v=0..0.36

Rechte Wand des Gartens ist solide Hauswand mit Rück-Tür "H".

**Sträucher im Garten** (12 Stück) liegen im SVG-Layer `<g data-raum="garten">`, durch `baueGartenDeko()` beim Start erzeugt. 4 Varianten (`STRAUCH_VARIANTEN`) mit unterschiedlichen Blatt-Auswahlen und Grüntönen. Pfade stammen aus `assets/plant_strauch.svg` (Boden entfernt, 5 Blatt-Cluster + 1 Ast-Pfad).

## Keller

- Wände/Decke/Boden in dunklen Grautönen (`b80`/`b100`/`b90`)
- **Skelett** aus `assets/skeleton_3.svg` via `<image href>`, perspektivisch platziert hinten rechts (fu=0.90, fv=0.85, Füsse bei (1236, 645))
- Farbe-Invertierung via SVG-Filter `#invert` (schwarz → weiss)
- Schaukel-Animation: `<animateTransform type="rotate">` um die Füsse, ±6°, 2.5 s, Ease-in-out-Spline

Nicht verwendet, aber im Repo: `assets/skeleton_1.svg`, `assets/skeleton_2.svg` (Skeleton_1 lud unter file:// nicht zuverlässig).

## Deko-Generatoren (JS-seitig)

```js
makeSVG(tag, attrs, kinder)        // SVG-Element-Factory (namespaced)
erzeugeStrauch({fu, fv, bw, v})    // liefert <g> mit transformierter Strauch-Grafik
baueGartenDeko()                   // füllt <g data-raum="garten"> mit 12 Sträuchern (idempotent)
baueRaumDeko()                     // Dispatch für alle Räume; wird 1× beim Start aufgerufen
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
    → prüft Tür-Polygone im aktuellen Raum → wechsleRaum() (falls Treffer)
    → sonst: screenZuBoden → figur.zielFu/zielFv (mit Clamp)
window.resize → resizeCanvas()
```

## Bekannte Eigenheiten / Stolpersteine

- **Preview-Panel in Claude Code funktioniert bei diesem Projekt nicht zuverlässig.** Immer im Browser testen (`Cmd+R`, HTML-only ⇒ Hard-Refresh `Cmd+Shift+R`).
- **Cache-Busting:** bei Änderungen an `script.js` oder `style.css` das `?v=N` in `index.html` hochzählen. HTML selbst hat kein Busting → Hard-Refresh.
- **Zwei Canvases:** jede Renderänderung muss auf den richtigen Context zeichnen. In `draw()` wird `ctx` umgeschaltet.
- **SVG-Filter `filter="url(#name)"`** (grell, invert) statt CSS-Filter — robuster.
- **CSS `pointer-events: none`** auf Figur-Canvas und SVG-Layer, damit Klicks zum `game-canvas` durchreichen.
- **Body: `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none`** — verhindert Scroll/Verschieben.
- **Startbildschirm** ist in `index.html` ausgeklammert; Auto-Start am Ende von `script.js`.
- **`<image href>` in SVG** unter file://: funktioniert je nach Browser nicht zuverlässig für externe SVG-Referenzen (skeleton_1 lud nicht). Inlining ist Fallback.

## Spielstand + Türen-Schlösser (Phase 2, abgeschlossen)

```js
const spielstand = {
    geloesteAufgaben: new Set(),       // IDs gelöster Aufgaben
    freigeschalteteTueren: new Set(),  // eingesammelte Schlüssel-IDs
    inventar: {},                      // gefundene Zahlen / Infos
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
    haupt: [{ id: "...", aufgabe: "aufgabeId", polygon: [...] }],
    // andere Räume analog, leere Arrays als Platzhalter
};
```

**Klick-Pipeline:** `pointerdown` → Tür? → Objekt? → Boden. `pointermove` setzt `cursor: pointer`, wenn unter dem Cursor eine Tür oder ein aktives Objekt liegt.

**`pruefeAntwort(id, eingabe, ...)`**: vergleicht per Toleranz (`Math.abs(zahl − loesung) ≤ toleranz`). Komma wird zu Punkt normalisiert. Bei Erfolg: `spielstand.geloesteAufgaben.add(id)`, Schlüssel und Inventar aus `bei_richtig` anwenden, `draw()` (Türen neu rendern), Input + Button deaktivieren.

**Cross-Room-Lookups:** `frage` und `fragetext` können Funktionen sein, z.B. `frage: (s) => \`Der Umfang war ${s.inventar.umfang_demo_cm} cm.\``. So kann eine Aufgabe in Raum C einen Wert aus Raum A lesen.

**Aktuelle Demo-Aufgabe:** `bookshelf_umfang` — Klick aufs Bücherregal im Hauptraum, Umfang bei r=5 cm. Bei Erfolg: `keller_schluessel`, Inventar-Eintrag, Keller-Zugang offen.

## Sound (Web Audio, keine Dateien)

Schrittsounds werden live via `Web Audio API` synthetisiert: kurzer weisser Noise-Burst, durch Tiefpassfilter zu einem dumpfen „Thud". Vier Varianten in `SCHRITT_VARIANTEN` (Frequenz 220–310 Hz, Dauer 80–100 ms, Gain 0.17–0.22) werden **round-robin** durchlaufen, mit zusätzlich ±3 % Frequenz-Jitter pro Schritt.

`audioCtx` wird beim ersten `pointerdown` via `ensureAudio()` initialisiert. **Wichtig:** Safari/Chrome starten den AudioContext oft im Zustand `suspended`, auch nach User-Gesture. `ensureAudio()` ruft darum immer `audioCtx.resume()` auf, wenn der State `suspended` ist (nicht nur beim Erst-Zugriff).

`spieleSchritt()` feuert in `aktualisiereFigur`, wenn die Gehphase π oder 2π überquert (d.h. ein Fuss landet). Zusätzlich `beendeSchrittWennInLuft()` beim Ankommen — spielt einen Landungs-Sound, wenn die Figur mitten in einer Beinhebung stoppt (Fix für sehr kurze Wege und mid-stride Arrivals).

Konsolen-Helfer:
- `soundAnAus(true|false)` — Sound global an/aus
- `soundTest()` — spielt 3 Diagnose-Sounds (Oszillator-Beep, ungefiltertes Rauschen, Schritt); zeigt `audioCtx.state`

Für externe Songs später: `new Audio("assets/song.mp3")`, `.loop = true`, Volume-Control via `audioCtx`-GainNode oder HTMLMediaElement.volume. Browser unterstützen mp3/wav/ogg/m4a — **kein AIFF**.

## Laufen + Raumwechsel-Fade (Phase 5, Teil 1+2)

**Laufen zum Ziel vor Interaktion:** Klick auf Tür oder Objekt startet NICHT mehr sofort die Aktion. Stattdessen läuft die Figur zum `laufziel` der Tür / des Objekts. `figur.ankunft` ist ein einmaliger Callback, der ausgelöst wird, sobald die Figur ankommt.

```js
figur.ankunft = () => starteRaumwechsel("buero");  // bei Tür-Klick
figur.ankunft = () => zeigeAufgabe("bookshelf_umfang");  // bei Objekt-Klick
```

Klick auf Boden setzt `figur.ankunft = null` (verwirft vorherige Tür-Aktion). `wechsleRaum` räumt ebenfalls.

**Fade-Transition beim Raumwechsel:** `starteRaumwechsel(zielId)` blendet via `#fade`-Div schwarz ein (220 ms), ruft `wechsleRaum`, blendet wieder aus. `wechselInGang`-Flag blockt weitere Klicks während der Transition.

CSS: `#fade { opacity: 0; transition: opacity 220ms ease-in-out; } #fade.visible { opacity: 1; }`

Das `#fade`-Div liegt in `#game-stage` über den Canvases, aber unter dem `#overlay` (das ausserhalb der Stage sitzt).

## Roadmap

Abgeschlossen: Phase 1 (Infrastruktur + Deko), Phase 2 (Spielstand + Schlösser + Overlay), Phase 3 (Aufgaben-UI mit KaTeX), Phase 5 Teil 1+2 (Fade + zur Tür laufen).

**Phase 4: Inhalte (mit Manuel)**

- 10–15 Kreis-Aufgaben (Umfang, Fläche, Durchmesser, Radius).
- **Linearer Lösungsweg I → II → III → IV**, aber **Infos aus Raum A werden in Raum C gebraucht** (Zahlenwert als Radius einsetzen).
- 5 Räume gestalten (zusätzliche Möbel/Aufgaben-Objekte).

**Phase 5 Restpunkte (nach Phase 4)**

- Hinweise bei falscher Antwort (pro Aufgabe konfigurierbar).
- `localStorage` für Fortschritt (erst nach Phase 4 sinnvoll, sonst blockiert es das Testen).

## Git / GitHub

- Remote: `https://github.com/Manuel-Benz/Spiel_Kreise_1`
- Workflow: `git add <datei>` → `git commit -m "Nachricht"` → `git push`
