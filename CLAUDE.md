# CLAUDE.md – Projektübersicht für neue Chat-Sessions

Architektur-Doku, damit ein neuer Chat sofort weiterarbeiten kann.

## Projektkontext

Interaktives Mathe-Lernspiel **„Full Circle"** (Thema: Kreise) für den Schulunterricht. Aufbau als **Escape-Room-artiges Abenteuer** mit 5 Räumen, linearer Aufgaben-Progression und Cross-Room-Lookups. Vanilla HTML/CSS/JS, kein Build-Tool, kein Framework. (GitHub-Repo-Name `Spiel_Kreise_1` und localStorage-Keys `spiel_kreise_1_*` sind historisch — wurden bewusst nicht umbenannt, um die Repo-URL und bestehende User-Spielstände nicht zu brechen.)

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
| `painting_1.png`, `painting_2.png` | painting_1 im Hauptraum, painting_2 im Keller (über dem Kamin) | `<image href>` (PNG via `magick` aus den `.svg`-Quellen konvertiert; Original-SVGs zu groß für direkten Browser-Render: 1.8 MB / 14 MB) |
| `painting_2_kreise` *(virtuell)* | 3 Cartoon-Kreise (gelb/rot/violett) als Inline-SVG-Overlay über painting_2 (Keller). Initial `class="sanitar-aus"`, sichtbar nach `drei_kreise`-Drop in Chain 5. Positionen perspektivisch entzerrt aus den BUERO_BILD-uv-Koords. | Inline-SVG (3 `<circle>`-Elemente) |
| `bush_1..4.svg` | Detail-Büsche im Garten | `drawImage` (Canvas, damit Zaun verdecken kann) |
| `table_1.svg`, `table_2.svg` | Holztisch Hauptraum / Schreibtisch Büro | Inline-SVG |
| `lamp_lava_1.svg`, `bookshelf_1.svg` | Originale; Inline-Varianten im Hauptraum | nicht direkt |
| `bookshelf_2.svg`, `chair_1.svg` | Bücherregal + Bürostuhl im Büro | Inline-SVG (kopiert) |
| `octopus_1_1.svg`, `octopus_1_2.svg`, `octopus_1_3.svg`, `duck_1.svg` | Tintenfisch (3 Stimmungs-States, Switch-Triplet für Chain 2) + Quietscheente | Inline-SVG (alle drei Octopus-Varianten deckungsgleich, `class="octopus"`, IDs der Asset-Pfade NICHT geprefixed → bewusste Duplikate; CSS `:not(#path4647)` matcht alle drei) |
| `bathtub_1_1.svg`, `bathtub_1_2.svg` | Wanne als Layer-Paar: _1_1 Hintergrund (volle Wanne), _1_2 Vordergrund (Wasser nur bis x-Mittelachse) — Octopus taucht beim Exit dazwischen unter | `<image href>` |
| `bathtub_1_3.svg` | Alte Switch-State-Variante (Sitz oben + klares Wasser), aktuell ungenutzt | — |
| `toilet_2_1/2.svg` | WC, 2 Switch-States | Inline-SVG |
| `skeleton_3.svg` | Tanzendes Skelett im Keller (id `skelett_3`); Chain 5 togglet CSS-Klasse `skelett-lacht` für 2 s (schnellere Wackel-+Scale-Pulse-Animation, überlagert die SMIL-Schaukel) | `<image href>` |
| `fireplace_1.svg` | Steinkamin im Keller | Inline-SVG |
| `cake_1.svg` | Torte auf Tisch 1 im Hauptraum | Inline-SVG |
| `cake_2.svg` | Torte auf desk_5 im Hauptraum | `<image href>` (war inline; wegen Gradient-Klon-Bug umgestellt — siehe Stolpersteine) |
| `candle_2.svg`, `candle_3.svg` | Templates für die ~50 Keller-Kerzen — Pfad-Inhalt in `KERZE_TEMPLATE_2/_3` (script.js) eingebettet, pro Kerze geklont mit ersetzten Wachs-Farben | als String-Templates in script.js |
| `chain_1.svg`, `chain_2.svg` | Ketten im Keller (Wand + Boden) | Inline-SVG |
| Pickel *(virtuell)* | Spitzhacke (brauner Holzgriff + grauer Doppelspitzen-Metallkopf). **Seit Vereinfachung von Chain 5 nicht mehr als Bühnen-Element** — landet direkt nach `drei_kreise`-Drop ins Inventar. Story-Text im Drop-Callback erwähnt das Geschenk vom Skelett. | nur als Inventar-Icon (Inline-SVG, randlos) |
| `chest_1.svg` | Schatztruhe (Chain 7) — vergraben in der Gartenmitte, sichtbar nach Schaufel + Pickel-Drop auf gartenmitte_grab | `<image href>` (war historisch inline im Keller; mit Chain 7 in den Garten verschoben + auf Black-Box-`<image>` umgestellt → kein Gradient-Klon-Risiko) |
| Loch *(virtuell)* | Ausgehobenes Grab in der Gartenmitte (`<g id="chain_7_grab">`) — Erdwall + perspektivisches Trapez-Loch + dunkler Tiefen-Indikator + 2 Erdklumpen am Rand. Eckpunkte aus `bodenPunkt(fu, fv)` berechnet (echtes Boden-Trapez im Fluchtpunkt-Schema). data-y-fuss=786. Sichtbar nach `chain_7_loch_offen=true`. Truhe sitzt drin. | Inline-SVG-Gruppe |
| `flower_1.svg`, `flower_3.svg` | Innen-Blumen vorne-links im Garten (überlappen, flower_3 DOM-vor flower_1) | Inline-SVG |
| `flower_2.svg` | Vorne-rechts im Garten | Inline-SVG (mit `f2_`-Prefix) |
| `flower_4.svg`, `flower_6.svg` | Wiesen-Detailblumen im Garten (Canvas) — flower_4 vorne-links, flower_6 hinter dem Zaun | `drawImage` via `BUESCHE.flower4`/`flower6`, gerastert. Beide enthalten den ehemals inline-SVG-Inhalt mit `f4_`/`f6_`-Prefix-IDs. flower_6.svg hat zusätzlich einen `<g transform="matrix(-1 0 0 1 744.09 0)">`-Wrapper (an y-Achse gespiegelt). |
| `flower_5.svg` | Original-Asset, nicht mehr verwendet (User-Wunsch) | — |
| `bird_1.svg` | Vogel-Silhouette (Chain 3a) — taucht im Garten an Wolken-Position auf, sobald die zentrale Wolke geklickt wurde | Inline-SVG (Single-Path-Silhouette `#484a54`, viewBox 600×300, IDs mit `b1_`-Prefix). Initial `class="sanitar-aus"`; aktualisiereChain3() togglet anhand `vogel_da` |
| `seed_1.svg` | Samenkorn (Chain 3b) — kein eigenes Bühnen-Element, nur Inventar-Icon nach gegossener flower_1 | `<image>` 44×44 im Inventar-Icon mit `?v=1`. Even-odd-Path-Silhouette, viewBox 144 144 512 512 |
| `binoculars_1.svg` | „Night vision device" (Chain 3 / Bridge) — luggt aus toilet_1 heraus, sobald Octopus weg + Sitz oben | Sowohl `<image>` in `#binoculars_1_visual` (toilet_1-Schüssel x=1110 y=522 62×54, data-y-fuss=670) als auch Inventar-Icon (38×38 in 48er-Slot zentriert mit Padding 5). ?v=1. Mit clipPaths — Inline würde IDs benötigen, aber `<image>` ist Black-Box. Bühne auf ca. 56 % der Original-Grösse skaliert (Schüssel-Position y +20 px → tief in der Schüssel); Inventar-Icon dagegen gross gehalten, damit der Gegenstand klar erkennbar bleibt. |
| `flower_2a.svg` *(virtuell)* / `flower_2b.svg` *(virtuell)* | Variationen von flower_2: 3 Blüten rot-orange + 5 Blüten blau gespiegelt; Inline-SVG-Klone von flower_2 mit `f2a_`/`f2b_`-Prefix, wenigeren Blüten, Hex-Recolor (siehe Garten-Sektion) | Inline-SVG |
| `gradenhose_1.svg` | Gartenschlauch frontal-Aufsicht (Original-User-Asset), hängt an rechter Hauswand im Garten | `<image>` mit Affin-Matrix (siehe Garten-Sektion) |
| `gradenhose_2.svg` | Stilisierte Seitenansicht des Schlauchs (Wandhaken + 8 Coil-Ovale + Düse), aktuell **unbenutzt** als Alternative | — |
| `muffin_1..4.svg` | 4 Muffins auf dem Boden im Hauptraum | Inline-SVG |
| `desk_1.svg` | Holz-Schreibtisch (3D-Perspektive) im Hauptraum hinten-rechts | Inline-SVG (Gradients durch solid #A57956 ersetzt — siehe Stolpersteine) |
| `desk_2.svg`, `desk_3.svg`, `desk_5.svg` | desk_3 + desk_5 als Beistelltische im Hauptraum; desk_2 DEAKTIVIERT (siehe Hauptraum) | Inline-SVG |
| `desk_4.svg` | Anrichte mit Schubladen, im Badezimmer | Inline-SVG |
| `cupboard_1_1.svg`, `cupboard_1_2.svg`, `cupboard_2.svg`, `cupboard_3.svg` | cupboard_1 (Büro, gespiegelt) als Switch-Paar `_1`/`_2` (geschlossen/offen) nach Sanitär-Konvention, beide als `<image>`; cupboard_2 im Badezimmer; cupboard_3 im Hauptraum | `<image href>` mit Cache-Bust. cupboard_1_1: Asset geändert (Gradients entfernt). cupboard_1_2: vom User selbst gezeichneter Offen-Zustand. cupboard_2: Asset geändert (Holztöne 2× ~20% aufgehellt, dann manuelle User-Anpassungen, `?v=5`). cupboard_3: Asset geändert (Holztöne 2× aufgehellt + Richtung helleres Holz verschoben, dann viewBox auf 400×660 vergrößert mit Padding, `?v=4`). |
| `lamp_1.svg` | Pixar-Stil Schreibtischlampe (Schwenkarm, goldene Birne, gelblicher Schein) im Büro | Inline-SVG (IDs mit `l1_` prefixed gegen Konflikte; 9 Gradients erhalten) |
| `animal_1.svg`, `animal_2.svg` | Zwei Tiere/Kreaturen an der Wand im Keller (siehe Keller) | Inline-SVG (IDs mit `a1_`/`a2_` prefixed; animal_1 mit Gelb-Tint t=0.06; animal_2 hat 10 Gradients) |
| `animal_3_1.svg` | Aquarium-Glas mit Goldfisch (Initial auf desk_4 im Badezimmer; Inventar-Item) | `<image href>` mit Cache-Bust auf desk_4; gleiche Datei als `<image>` 44×44 im Inventar-Icon |
| `animal_3_2.svg` | Leeres Glas (Inventar-State nach Dump in toilet_2) | `<image href>` im Inventar-Icon (Asset selbst nie auf der Bühne sichtbar) |
| `animal_3_3.svg` | Glas mit Wasser (Inventar-State nach Wanne-Auffüllen) | `<image href>` im Inventar-Icon |
| `toilet_1.svg`, `chair_2.svg`, `skeleton_1/2.svg`, `human_1_left.svg`, `desk_1.svg`, `desk_2.svg` | nicht aktiv (desk_1 + desk_2 sind im Code als `display:none` deaktiviert, siehe Hauptraum) | — |

**Cache-Busting** in `index.html`: aktuell `style.css?v=46`, `script.js?v=239`. Bei Änderungen an `script.js` oder `style.css` das `?v=N` hochzählen, sonst hängt die alte Version im Browser-Cache. Bei Änderungen an einem `<image href="assets/X.svg">`-Asset auch `?v=N` an den href anhängen — der Browser cached `<image>`-Sources separat. Gleiches gilt für SVGs, die per `drawImage` rasterisiert werden (z.B. `BUESCHE.hintenHalb`-`src` aktuell auf `assets/bush_3.svg?v=5`).

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
| `buero` | Büro | Pfeil→Haupt, F→Badezimmer | b90/b90, Wände b70 | Tisch2 + Tischlampe + Bücherregal + Bürostuhl + cupboard_1 (gespiegelt) + lamp_1 (Pixar-Stil, vorne-links) |
| `badezimmer` | Badezimmer | Pfeil→Haupt, B→Büro | b90/b90, Wände b70 | Tintenfisch, 2 Toiletten, Wanne mit Ente, cupboard_2, desk_4 (mit animal_3_1/Aquarium oben drauf) |
| `garten` | Garten | H→Haupt | Himmel + Wiese + rechte Hauswand | 12 Sträucher + 4 Detail-Büsche, Sonne, Zaun |
| `keller` | Keller | (kleine, b80) →Haupt an linker Wand, gleiche Geometrie wie Geheimtür im Hauptraum | b80/b90, Wände b80, sehr dunkel | Tanzendes Skelett hinten-rechts, painting_2, Kamin, Ketten, plant_kraeuter, ~50 Kerzen, animal_1 + animal_2 (an Wand), muffin_4 |

`aktuellerRaum` hält die aktive ID. `wechsleRaum(zielId)`:
- merkt `vonRaum`, setzt `aktuellerRaum = zielId`
- blendet alle `<g data-raum>` ausser dem Ziel auf `display:none` — **in beiden SVG-Ebenen** (Rück + Front)
- Eintrittsposition = `laufziel` der Tür im Zielraum, deren `ziel === vonRaum` (Fallback `RAUM_EINTRITT = {fu:0.5, fv:0.3}`)
- `eintrittsRichtung(fu, fv)` setzt `figur.richtung` "in den Raum hinein"
- ruft `draw()`

Klick-Pipeline (`pointerdown`): zuerst Hindernis-Drag (nur HINDERNIS_DEBUG-Modus) → Tür-Polygone → `starteRaumwechsel()` (Fade) — sonst aktive Objekte (`obj.aufgabe` / `obj.aufnehmen` / `obj.aktion` / `obj.akzeptiert`) — sonst `screenZuBoden` → Figur läuft hin.

## Türen

Jede Tür hat `polygon`, `ziel`, `laufziel: {fu, fv}`, optional `label`/`secret`/`pfeil`/`schloss`/`akzeptiert`.

- **Hauptraum:** A, B an hinterer Wand, L an linker Wand, **geheim** an rechter Wand (`secret: true`). Nicht freigeschaltet wandfarben (b70, unsichtbar) und von `findeTuerBei` rausgefiltert; mit `binoculars_1` im Inventar wird sie unter Nachtsicht via Phosphor-Outline (`#5fff8a` Stroke + Glow) sichtbar; nach Drop von `code_geheimtuer` (siehe Bridge) → `keller_freigeschaltet=true`, dauerhaft in `tuerGeheimOffen` (b80, dunkler als Wand) gerendert + begehbar.
- **Büro/Badezimmer:** `zurueck` als 2D-Pfeil unten am Bildrand (`PFEIL_POLYGON`); seitliche Durchgangstür F bzw. B.
- **Garten:** einzelne Rück-Tür auf Seitenwand (`seitenTuerPolygon(rechteWandPunkt)`, Standard-Türgrösse).
- **Keller:** Rück-Tür auf linker Wand mit **gleichem Polygon wie die Geheimtür im Hauptraum** — `linkeWandPunkt(0.325..0.575, 0..0.4)` (kleiner als `seitenTuerPolygon`). Farbe `GRAU.b90` (eine Stufe dunkler als die b80-Wand → die Tür hebt sich subtil ab statt komplett zu verschmelzen) als Pro-Tür-Override (keine `secret`-Logik). Kein Label. Bewusster „Hidden-Door"-Stil, optisch ähnlich zur freigeschalteten Geheimtür drüben.

**Türen-Schlösser:** `schloss: "<id>"` macht Tür gesperrt, bis der Schlüssel in `spielstand.freigeschalteteTueren` liegt. `zeichneSchloss()` malt ein weisses Schloss unten in der Tür (NICHT auf `secret`-Türen). Aktuell ist nur die Geheimtür gesperrt, gating-Mechanik läuft aber nicht über `schloss` sondern über `secret: true` + `keller_freigeschaltet`-Flag (siehe Bridge). Die Schloss-Mechanik kann jederzeit für andere Türen aktiviert werden.

**Pro-Tür-Farb-Override:** Optional kann eine Tür eine `farbe`-Property tragen. Im `else`-Branch von `zeichneTueren` wird `t.farbe || FARBEN.tuer` benutzt. Aktuell genutzt: Keller-Rück-Tür in `GRAU.b90` (eine Stufe dunkler als die b80-Wand), damit sie sich subtil abhebt.

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
   - **Desk 3** (`assets/desk_3.svg`, kleiner Beistelltisch in 3D): inline `<svg data-y-fuss="690" x="700" y="590" width="200" height="100" viewBox="0 0 192.065 123.042" preserveAspectRatio="none" style="overflow:visible;transform:rotate(-2deg);transform-origin:50% 100%" filter="url(#grell-mild)">`. Nur Fills im Original. **Horizontal gespiegelt** via `<g transform="translate(192.065 0) scale(-1 1)">`-Wrapper. **CSS-Rotation -2°** (transform-origin Bottom-Center → kippt um den Tisch-Fuß). data-y-fuss=690 = bbox-bottom (y+height). DOM-Reihenfolge: desk_3 → Pilzlampe → desk_2(deakt) → muffins. Kein Hindernis.
   - **Pilzlampe auf desk_3** (3 Pfade aus desk_2 kopiert): eigener `<svg data-y-fuss="690" x="730" y="553" width="45" height="60" viewBox="30 -5 65 65" preserveAspectRatio="xMidYMid meet">`. Pfade: grauer Sitz `#53536C`, pinker Hut-Knopf `#C83771`, pinker Hut-Körper `#D35F8D`. data-y-fuss synchron mit desk_3 (Stolperstein gestapelte Möbel). **Rotiert NICHT mit desk_3 mit** (separater SVG-Block).
   - **Desk 5** (`assets/desk_5.svg`, Beistelltisch-Variante, ähnliches Asset wie desk_3 mit anderer Bein-Geometrie): inline x=1170 y=540, 280×175, `data-y-fuss="705"` (Foot bei screen-y ≈ 705 aus `540 + 116·175/123`). Selbe Holz-Hex-Codes wie desk_3 (`#D08520`/`#A66113`/`#E6A450`). IDs aus dem Asset weggelassen (Konflikt mit desk_3-Pfaden). Steht visuell vor cupboard_3 und überdeckt dessen Boden — DOM nach cupboard_3 platziert, NICHT im `<g id="haupt-moebel">`.
   - **Muffins** auf Tisch 1: `muffin_2` (x=425 y=564) + `muffin_3` (x=408 y=565), je 18×25. Inline aus `assets/muffin_*.svg`. `data-y-fuss="639"` synchron mit Tisch 1 (Stolperstein gestapelte Möbel — vorher fälschlich 840, der Bottom-Wert ist auch wertlos, weil Muffins auf dem Tisch sitzen). Original-SVGs haben keine IDs → kein Prefixing nötig. *(`muffin_1` sitzt jetzt auf desk_5 — siehe DOM-Reihenfolge unten. `muffin_4` wurde in den Keller verschoben — siehe dort.)*
3. **Pflanzen** (`<g id="plants">`, 6 Stück) — Transform-Muster: `translate(bx, by) scale(σ) translate(-256, -512)` verankert Topfboden (256, 512) im viewBox an Bodenpunkt. Formel: `σ = s · basisBreite / 512`. Jede Pflanze hat `data-y-fuss` für Tiefensortierung:

| Pflanze | fu | fv | bw | r (Hindernis) |
|---|---|---|---|---|
| tulpe | 0.15 | 0.12 | 175 | 0.05 |
| blume | 0.87 | 0.15 | 175 | 0.05 |
| setzling *(steht jetzt auf desk_3, Transform-Anker direkt: `translate(815 615) scale(0.07) translate(-256 -512)`, `data-y-fuss=690` synchron mit desk_3)* | — | — | 118 | — |
| geranie *(steht jetzt auf desk_5, Transform-Anker direkt: `translate(1325 563) scale(0.1269)`, `data-y-fuss=705` synchron mit desk_5)* | — | — | 100 | — |
| yucca | 0.034 | 0.79 | 104 | 0.03 |
*(`kraeuter` wurde in den Keller verschoben — siehe dort)*

4. **cupboard_3** (`assets/cupboard_3.svg?v=2`, aus Badezimmer hierher verschoben): grosser Schrank rechts an der Wand. `<image>` x=1140 y=260 width=160 height=363, `data-y-fuss="623"`, `preserveAspectRatio="none"`. Kein Hindernis. DOM-direkt vor desk_5 (beide ausserhalb `<g id="haupt-moebel">`). **Asset modifiziert** — 14 dunkle Holz-Hex-Codes durch hellere ersetzt (Mapping siehe Git-History).

5. **DOM-Reihenfolge am Ende der haupt-Gruppe** (alle ausserhalb haupt-moebel): `<g id="plants">` → `cupboard_3` → `desk_5` → `plant_geranie` → `cake_2` → `muffin_1`. Wichtig wegen Tiefensortierung: cake_2 + plant_geranie + muffin_1 sitzen visuell auf desk_5 und tragen `data-y-fuss="705"` synchron mit desk_5 — wechseln die Ebene zusammen mit ihm und stehen dank DOM-Reihenfolge in beiden Ebenen davor. **Analog auf desk_3** (innerhalb haupt-moebel): desk_3 → Pilzlampe → muffin_2 + muffin_3 — alle mit `data-y-fuss="690"`. Tisch 1 + Lavalampe + cake_1 + muffin_2/3 sind alle auf data-y-fuss="639" (gemeinsamer Tisch-Stack). plant_setzling sitzt zwar visuell auch auf desk_3, lebt aber im `<g id="plants">`-Wrapper (DOM-nach haupt-moebel), trägt ebenfalls `data-y-fuss="690"`.

### Büro

- **Tisch 2** (`assets/table_2.svg`, L-Schreibtisch): Anker = front-left-leg-Fuss SVG (311, 613) → Screen (240, 700), σ=0.55. Vorderlinks. **Helle Holz-Palette** (Original-Hex-Codes global ersetzt: `#512F18→#8B6740`, `#C77137→#DEAA6F` usw.). Metallbeine grau, Schubladengriffe `#D1C6BF`. **Stroke = Fill** auf allen 22 Polygons/Rects (ursprünglich hatten alle eine ~10% dunklere stroke-Farbe als Rand → wurde auf Fill-Farbe gesetzt, damit die Möbelteile randlos wie aus einem Guss wirken).
- **Tischlampe** auf Tisch 2 (handgezeichnet inline, klassische Schreibtischlampe). Standfuss bei Screen (340, 495). Schirm um -20° gedreht, zwei Flächen-Hälften (`#987230` rechts/Licht, `#7a5a20` links/Schatten) mit gekrümmter Bezier-Unterkante; halbtransparenter Lichtkegel `#fff5b8` opacity 0.20.
- **Bücherregal** `#bookshelf_2` (Inline-SVG, ursprünglich aus `assets/bookshelf_2.svg`): hinten-rechts an Wand, `x=700, y=270, 600×600`. Eigene Saturierung: `filter="url(#grell-mild)"`. **Hindernis** (Pixel-genau, deckt den ganzen visuellen Bookshelf-Footprint auf dem Boden ab): Trapez-Viereck `[[0.4351,0.10],[0.8247,0.10],[0.9912,0.97],[0.4017,0.97]]`. Vorderkante = Bookshelf-Bottom-Pixel y=870 → fv=0.10. Linksrand x=700 wandert perspektivisch (fv=0.10→fu=0.4351; fv=0.97→fu=0.4017), Rechtsrand x=1300 analog. Tür F-laufziel (0.88, 0.45) liegt knapp im Trapez → `setzeFigurZiel` schiebt es an die rechte Kante (≈0.896, 0.447); Tür bleibt aufrufbar. Tür "zurueck" (0.5, 0.05) klar vor dem Trapez. Lücke fu=0.35..0.43 zwischen Tisch 2 und Bookshelf bleibt durchquerbar.
- **Schreibtischstuhl** `#chair_1` (Inline-SVG): vor Tisch 2 (im DOM nach Tisch = visuell davor), `x=200, y=440, 180×290`, an y-Mittelachse gespiegelt via `transform="matrix(-1 0 0 1 580 0)"`. Eigene Saturierung: `filter="url(#grell-mild)"`. Manuelle Säuberung der SVG: `path1545` (Detail) entfernt; alle übrigen Pfade haben `stroke = ihr Fill` mit `stroke-width:1` (puffen sich minimal auf, keine schwarze Outline). Kein eigenes Hindernis (im Footprint des Tisches).
- **Wandbild** (linke Wand, JS-generiert via `baueBueroBild()` in script.js): Rahmen + Leinwand + 6 farbige Kreise. Alle Punkte (Polygon-Ecken UND 12 cubic-Bezier-Stützpunkte pro Kreis) werden in Wand-(u,v)-Koords definiert und mit `linkeWandPunkt()` auf die schräge Wand abgebildet → Perspektive (Fluchtpunkt 800/225) ergibt sich automatisch. Kreise geclippt auf das Leinwand-Polygon (`<clipPath id="bueroBildClip">`). Konfiguration in der Konstante `BUERO_BILD` (Rahmen-/Leinwand-uv-Bereich, Farbe pro Kreis). DOM-zuerst (`gruppe.prepend()`) → wird von allen Möbeln überdeckt. Marker `data-generated="bueroBild"` für idempotenten Re-Build.
- **cupboard_1** (Switch-Paar): zwei `<image>`s deckungsgleich bei `x=980 y=106 width=400 height=600`, sichtbar bei (980,106)..(1380,706). `cupboard_1_1` (geschlossen, Initialzustand, `assets/cupboard_1_1.svg?v=1`) und `cupboard_1_2` (offen nach Schlüssel-Drop, `assets/cupboard_1_2.svg?v=1`) togglen via CSS-Klasse `sanitar-aus` (siehe `aktualisiereCupboard1()` in script.js). Der Zettel auf dem Schrankboden ist ein separates Inline-Element `cupboard_1_zettel_visual` ÜBER cupboard_1_2 (beide cupboard_1_2.svg-Assets enthalten KEINEN Zettel — der wird einzeln getogglet, damit er beim Aufnehmen verschwinden kann). **KEIN data-y-fuss** — Schrank bleibt immer in der Rück-Ebene, Figur überdeckt seine Pixel. Das Hindernis verhindert ohnehin, dass die Figur logisch hinter den Schrank-Boden gerät, also passt es visuell. **Hindernis** in `HINDERNISSE.buero[1]`: Spline am tatsächlichen Boden-Footprint (interaktiv mit dem Drag-and-Drop-Editor von Manuel eingestellt — kompakter als der Pixel-Bounding-Box, deckt nur den Bereich ab, in dem die Figur physisch im Schrank wäre). **cupboard_1_1 modifiziert** — ursprünglich `<defs>` mit 22 Linear-Gradients und Gradient-Overlay-Pfade entfernt; zusätzlich manuelle Bearbeitungen durch Manuel inkl. Spiegelung im Asset selbst. **cupboard_1_2** vom User direkt gezeichnet (Schrank mit offener linker Tür + Tablar-Andeutung).
- **lamp_1** (`assets/lamp_1.svg`, Pixar-Stil Schreibtischlampe mit Schwenkarm + goldener Birne + warmem Schein): inline `<svg data-y-fuss="868" x="60" y="700" width="140" height="168" preserveAspectRatio="none" filter="url(#grell-mild)">`. Vorne-links auf dem Boden. (User vergrösserte vom ursprünglichen 120×145 auf 140×168 — data-y-fuss entsprechend nachgezogen auf bbox-bottom 868.) **Alle IDs mit `l1_` prefixed** (9 Gradients + Camada_1 + paths) gegen Konflikte. Original-Farben modifiziert:
  - `l1_Gradient_2` (Lampenhals/Birne): von Grün (`#BFEF00`→`#445500`) zu **Gold** (`#FFD24A`→`#604010`).
  - `l1_Gradient_3` (Schein/Halo, opacity 0.716): von Zitronen-Gelb (`#EBF960`→`#E0EE7C` transparent) zu warmem **Amber-Gold** (`#FFCC44`→`#F0A040` transparent).
  - Weitere Gradients (Schwenkarm-Silber, roter Sockel) unverändert.

### Badezimmer

- **Tintenfisch (Switch-Triplet)** — 3 Stimmungs-States deckungsgleich inline, jeder mit `data-y-fuss="700" x="930" y="380" width="440" height="330" viewBox="0 0 640.08 479.93" class="octopus"`. DOM-Position: zwischen cupboard_2/Toiletten und desk_4 — alle drei überdecken cupboard_2 und Toiletten, werden aber selbst von desk_4 überdeckt (desk_4 ist DOM-zuletzt).
  - `octopus_1_1` (mürrisch, Inline aus `assets/octopus_1_1.svg`, Old-Format mit `style="stroke...;fill..."` pro Pfad) — initial sichtbar.
  - `octopus_1_2` (leicht aufgehellte Stimmung, Inline aus `assets/octopus_1_2.svg`, Dual-Path-Format: pro Form ein Fill-Pfad + ein Stroke-Pfad mit `fill-opacity=0`) — initial `display:none`.
  - `octopus_1_3` (zufrieden, gleiche Dual-Path-Struktur) — initial `display:none`.
  - **Sichtbarkeitslogik**: `aktualisiereSanitaer()` togglet `sanitar-aus` basierend auf `spielstand.zustaende.octopus_da && octopus_zustand === N`. Wenn `octopus_da=false` (nach Exit-Animation), sind ALLE drei verborgen.
  - **CSS in `style.css`**: `.octopus *:not(#path4647) { stroke: none !important }` — entfernt schwarze Outlines global, AUSSER beim Mund. Wirkt auf alle drei States; in _1_2/_1_3 macht es zusätzlich die separaten Stroke-Pfade unsichtbar (kein Fill, kein Stroke).
  - Asset-Pfad-IDs (`path3982-5`, `path4647`, etc.) bleiben in allen drei States gleich — bewusste DOM-Duplikate. CSS-`:not(#path4647)` matcht trotzdem alle Mund-Pfade. Funktioniert, weil keine Gradients (nur solid fills) → keine Paint-Server-Lookups, die durch Duplikat-IDs verwirrt würden.
  - **Augen-Pupillen** (path3950, path3950-4): liegen IM Auge, behalten Inline-`fill:#000`.
  - **Mund** (`#path4647`): offene Kurve, nur Stroke, Farbe `#5a0000` (dunkelrot).
- **Sanitärobjekte** (Renderreihenfolge hinten → vorn). Drei Switch-Paare: jeweils zwei `<svg>`-Blöcke an exakt derselben Position/Größe, einer initial sichtbar, der andere `display:none`. Konvention: `#X_1` = Initialzustand, `#X_2` = nach Handlung. Sitzring ist rot eingefärbt (Inline-Fills `#FF5C5C` dunkel + `#FF8C8C` hell), Wasser bei der Wanne wechselt von blau (`#A7C5EA`) zu klar (`#FCFCFC`).
  - **Toilette 2** (links): `#toilet_2_1` / `#toilet_2_2` bei (590, 420) 200×250, data-y-fuss=670
  - **Toilette 1** (rechts, visueller Klon): `#toilet_1_1` / `#toilet_1_2` bei (1040, 420) 200×250, data-y-fuss=670
  - **Badewanne (Layer-Paar)**: `#bathtub_1_1` (Hintergrund-Layer, volle Wanne mit Wasser) + `#bathtub_1_2` (Vordergrund-Layer, Wasser nur bis x-Mittelachse) bei (130, 440) 600×200, beide als `<image href>`. **KEIN Switch-Paar** — beide permanent sichtbar; der Octopus taucht beim Exit zwischen ihnen unter (siehe „Octopus-Exit-Animation"). DOM-Reihenfolge: `bathtub_1_1` zwischen Toiletten und Octopus; `bathtub_1_2` NACH `octopus_1_3` und VOR `duck_1`.
  - `duck_1` schwimmt auf der Wanne
  - **`<g transform="translate(37 -9)">`-Wrapper** in `toilet_2_2` und `toilet_1_2`: Die beiden Switch-Partner-Assets haben ihre Pfade im viewBox um (-37, +9) verschoben — der Wrapper gleicht das aus, sodass _1 und _2 deckungsgleich liegen.
  - **CSS `.sanitar-aus { display: none !important }`** im `<style>`-Block — wird von `setSichtbar()` togglet. `!important` schlägt die Inline-display-Setzung von `aktualisierePflanzenTiefe()`, sodass der versteckte Switch-Partner zuverlässig unsichtbar bleibt.

  **Toiletten-Klick** in `OBJEKTE.badezimmer`: `toilet_1`-Polygon (1100..1240, 420..670) und `toilet_2`-Polygon (590..750, 420..670), beide ohne `laufziel` → Klick toggelt sofort, Figur bleibt stehen. Polygone bewusst enger als die volle SVG-Bbox, damit Klicks auf cupboard_2 (x=750..1100) keine Toilette mehr triggern. `toilet_1` ist gesperrt, solange `spielstand.zustaende.octopus_da === true` (Tintenfisch sitzt drauf). `toilet_2` ist gesperrt, solange `formelbuch_gefunden === false` — damit der Spieler im Tutorial-Stadium nicht versehentlich den Sitz hochklappt, bevor Chain 2 sinnvoll spielbar ist. Drop von animal_3_1 bleibt unabhängig (greift sowieso erst nach Sitz oben + leer, was nur nach Formelbuch passieren kann).

  Hinweis Nummerierung: Die "1"/"2" hinter `toilet_` folgt den Asset-Namen, nicht der räumlichen Lage.
- **cupboard_2** (`assets/cupboard_2.svg?v=5`): einziger Schrank im Badezimmer. Vorne-mitte, `<image>` x=750 y=150 width=350 height=500. **KEIN data-y-fuss** — wandmontiert wie painting_2/animals (Schrank-Korpus endet im SVG bei ~81% der viewBox-Höhe, der Rest sind Schatten/Reflexion-Pfade; bei `data-y-fuss="650"` lag der vermeintliche Foot deutlich unter dem visuellen Korpus → Figur "verschwand" hinter dem Whitespace, wenn sie zu nah ranging). Hindernis stoppt die Figur korrekt davor. Asset wurde von Manuel vereinfacht (`?v=2`); danach Holztöne 2× ~20% aufgehellt (`?v=3`, dann `?v=4`); zuletzt manuelle User-Anpassungen (`?v=5`). Glas-Spiegel (Türkis-Gradients) und Türknäufe (Gradient_5/9) blieben unverändert. cupboard_1 wurde ins Büro verschoben, cupboard_3 in den Hauptraum.
- **Desk 4** (`assets/desk_4.svg`, breite Anrichte mit Schubladen): inline x=1200 y=520 width=310 height=360, data-y-fuss="880" (bbox-bottom; vorher 755 als Anpassung an einen alten viewBox-Anteil — nach User-Resize obsolet, wurde im Audit korrigiert). Aus dem Hauptraum hierher verschoben. Frischer 1:1-Import aus dem Asset, **keine Strokes** (Asset hat keine — frühere weisse Stroke-Variante wurde verworfen). IDs aus dem Asset entfernt (`path2170` / `path2172` / `path2178` ×3 — Duplikate riskieren beim Klonen in die Front-Ebene). Leere Platzhalter-Pfade (`M0.322,297.233`, `M415.693,107.617`) weggelassen. **DOM-zuletzt** im Badezimmer-Block, überdeckt also Octopus + Toiletten visuell. **Kein eigenes Hindernis mehr** — die Figur kann durch desk_4 hindurchlaufen (ursprünglich gab es ein Hindernis, das nach User-Wunsch gelöscht wurde, damit die Figur näher an die Anrichte rankommt; visueller Effekt nimmt man in Kauf, dass die Figur bei tiefer fv ggf. „im" Möbel landet).
- **animal_3_1** (`assets/animal_3_1.svg?v=1`, Aquarium mit Goldfisch + 2 Luftblasen, blauer Wasser-Hintergrund): `<image>` x=1308 y=435 width=110 height=110, `data-y-fuss="880"` synchron mit desk_4 (gestapeltes Möbel). `preserveAspectRatio="none"`, `filter="url(#grell-mild)"` (analog desk_4 selbst). Position: mittig auf der Top-Platte (screen-y ~545 = Mitte zwischen Top-Hinterkante 529 und Vorderkante 561). DOM direkt nach desk_4. Kein eigenes Hindernis (steht auf dem Tisch, Tisch-Hindernis stoppt Figur ohnehin). **Im Inventar nehmbar** (Chain 2): OBJEKTE.badezimmer.animal_3_1 hat `aufnehmen: "animal_3_1"`. `aktualisiereSanitaer()` blendet das `<image>` aus, sobald `chain_2_step >= 1` (oder eine animal_3_*-ID im Inventar liegt). animal_3_2 und animal_3_3 sind reine Inventar-Items (Asset nur als 44×44 `<image>` im Icon).
- **toilet_X_voll-Indikatoren**: zwei kleine `<svg>` (id=`toilet_2_voll`, `toilet_1_voll`) deckungsgleich mit toilet_X_2 (x=590/1040, y=420, 200×250, viewBox 0 0 383.9 505.1). Inhalt: gelbe Ellipse (cx=190, cy=270, rx=55, ry=20, `#d4b300` opacity 0.55) — soll wie verschmutztes Wasser in der Schüsselöffnung wirken. `pointer-events:none` (Klicks fallen auf das toilet_X-OBJEKT durch). Sichtbarkeit über `aktualisiereSanitaer()`: nur wenn `toilette_X_voll && toilette_X === 2` (Sitz oben + voll). `data-y-fuss="670"` synchron mit Toiletten.

### Garten

Decke + linkeWand + hintereWand alle Himmelsblau (`#5c9cc2`, vorher `#7cb8d8` — User-Wunsch tieferes Blau) → `zeichneZimmer()` füllt einen einzigen `fillRect` mit Himmel, dann werden Boden (nahtlos) und rechte Hauswand drübergezeichnet. So entstehen keine Subpixel-Säume.

`zeichneGartenZaun()` (auf `ctxRaum`) malt in dieser Reihenfolge:
1. Sonne (`zeichneSonne`)
2. Wolken (`zeichneWolken`, 4 Stück)
3. Horizont-Silhouetten-Büsche (`vor: false`)
4. Gras (nahtlos, hinten + links)
5. Horizont-Vor-Büsche (`vor: true`)
6. Nah-Büsche (`GEBUESCH_NAH`, Canvas-Ellipsen)
7. `BUESCHE.flower4` (rasterisiertes Asset auf Canvas)
8. `BUESCHE.flower6` (rasterisiertes Asset)
9. `BUESCHE.hintenTief` (bush_1) — verdeckt teilweise flower_6
10. `BUESCHE.hintenHalb` (bush_3) — teilweise hinter dem Zaun
11. `BUESCHE.linksWiese` (bush_4) — DOM-zuletzt unter den Wiesen-Sträuchern, **vor** bush_3 in Überlappung
12. Zaun hinten + links
13. `BUESCHE.hintenGanz` (bush_2) — oberhalb des Zauns, drüber gemalt
14. Rechte Hauswand drüber (clippt Büsche)

`zeichneSonne()`: 12 Strahlen (`lineWidth: 7`) + gelber Kreis (r=42) bei (1200, 200), Farbe `#ffc028` (vorher `#ffd84a` — auf Wunsch goldiger).

**Wolken** (`zeichneWolke` + `WOLKEN`-Array): 4 Wolken am Himmel mit individueller `bumps`-Liste pro Wolke (Position, Anzahl Ellipsen, Asymmetrie). Drei Render-Schichten pro Bump: kühler grauer Schatten unten + leicht gebrochenes Weiss als Hauptkörper + reines Weiss als Highlight oben-links. Alle `alpha=1`. `WOLKEN[0..3]`: oben-links / links-mitte breit / mitte-oben gedrungen / nahe Horizont mitte. Cloud 5 wurde gelöscht (überlappte mit der Hauswand).

**Gartenschlauch** (`assets/gradenhose_1.svg`): hängt an der rechten Hauswand hinter der Garten-Tür. Eingebaut als SVG-`<image>` mit Affin-Matrix `matrix(0.05263, 0.03158, 0, 0.16716, 1330, 462)` — projiziert die viewBox 570×670 auf die Wand-Quadrilateral u≈[0.75,0.85], v≈[0.10,0.30] (mit User-Verschiebung -15/-15). Wand-Vertikalen sind auf Screen vertikal (siehe `rechteWandPunkt`); Affine ist eine Näherung der echten Homographie (Bottom-Front-Ecke ~8 px daneben). DOM-zuerst im `<g data-raum="garten">` → wird von Wiesen-Blumen überdeckt. **Side-View-Variante** liegt als unbenutzes `assets/gradenhose_2.svg` parat (selbstgemalter Cartoon-Stil mit Wandhaken + 8 Coil-Ovalen + Düse), kann via einfachem `href`-Tausch aktiviert werden.

**Blumen im Garten** — Inline-SVGs mit `f1_..f3_`/`f2a_`/`f2b_`-Prefix:
- *Vorne-links überlappend*: DOM-Reihenfolge `flower_3` → `flower_1`, damit `flower_1` (grösser, vorne) `flower_3` (kleiner, dahinter) überdeckt. Beide tragen `data-y-fuss="613"` (= bbox-bottom, fv≈0.957 → fast immer hinter Figur). Asset von flower_1 hat 33 `#FFCE00`-Blütenblätter, round-robin auf 8 Gelb-Tönungen verteilt.
- *Vorne-rechts*: `flower_2` x=1470 y=720 110×150, `data-y-fuss="870"` (bbox-bottom).
- *Mid-rechts*: `flower_2a` x=1240 y=520 85×115, `data-y-fuss="635"`. **Variante** von flower_2 mit 3 Blüten und `f2a_`-Prefix; alle Magenta-Hex-Werte zu Rot-Orange verschoben (27 Werte → palette-Mapping).
- *Vorne-links*: `flower_2b` x=167 y=720 95×130, `data-y-fuss="850"`. **Variante** von flower_2 mit 5 Blüten + `<g transform="matrix(-1 0 0 1 744.09 0)">`-Spiegel-Wrapper innerhalb des Layer_1-Inneren; alle Magenta-Hex-Werte zu Blau verschoben.

**Blumen auf Canvas** (`BUESCHE.flower4`/`flower6`): kein Inline-SVG mehr — wurden auf `<image>`-Asset+`drawImage` umgestellt, damit der Zaun bzw. bush_4/bush_1 sie verdecken kann (architektur-bedingt: SVG-Layer liegt VOR Canvas, also kann nur Canvas-Element von Canvas-Element überdeckt werden). `assets/flower_4.svg` und `assets/flower_6.svg` enthalten den ehemals inline-SVG-Inhalt mit `f4_`/`f6_`-Prefix-IDs als standalone-SVG (wegen User-Customization darin). flower_6.svg hat zusätzlich `<g transform="matrix(-1 0 0 1 744.09 0)">` für y-Achsen-Spiegelung. Position via BUESCHE-Eintrag (`cx`, `baseY`, `breite`, `hoehe`). flower_5.svg wurde komplett rausgenommen.

**`zeichneBusch(cx, cy, breite, farbe)`** für die Ellipsen-Cluster-Sträucher (`GEBUESCH_HORIZONT`, `GEBUESCH_NAH`): pro Position deterministisch geseedet (`mulberry32(Math.floor(cx * 17 + cy * 113 + breite))`) → jeder Strauch bekommt eigene Silhouette. Zeichenlogik: 1) Hauptkörper (4 Anchor-Ellipsen mit Jitter ±4–8% + 55% Chance auf einen extra-Buckel oben), 2) `ctx.save() + clip()` auf die Silhouette, dann Schatten (2 grosse dunklere Ellipsen unten via `hexShift(farbe, -32)`) + 2–4 Highlights oben-links (`hexShift(farbe, +20)`). Clip-Pfad garantiert, dass Schatten/Highlights nicht aus dem Busch herausragen. Hilfsfunktion `hexShift(hex, dr, dg, db)` für die Farbverschiebung.

**Detail-Büsche** (`BUESCHE`): bush_1..4 als `Image`-Objekte geladen (`ladeBuschBild`), per `drawImage` gerastert. `bush_4` hat am `<g>` `stroke-width="25"` mit `stroke="{eigener fill}"` pro Pfad. **bush_3** Asset modifiziert (`?v=5`): zusätzlich zum Original-path17 (Foliage `#61A121`) ein **Duplikat von path17 mit `transform="translate(108.14 208.59) scale(0.7) translate(-108.14 -208.59)"` und `fill="#3F7012"`** — ergibt eine sichtbare Tiefenstaffelung („zwei Bäume" / Krone-vor-Krone) mit gemeinsamem Bottom-Center.

**Sträucher** (12 Stück) durch `baueGartenDeko()` beim Start erzeugt. 4 Varianten (`STRAUCH_VARIANTEN`) mit unterschiedlichen Blatt-Auswahlen und Grüntönen. Pfade aus `plant_strauch.svg`.

**WICHTIG zu `baueGartenDeko()`:** entfernt nur Elemente mit `data-generated="strauch"`-Marker (NICHT `gruppe.innerHTML = ""`), damit statisch ins HTML eingebaute Garten-Deko (z.B. Blumen) erhalten bleibt. Beim Erstellen markiert die Funktion jeden Strauch-`<g>` mit `setAttribute("data-generated", "strauch")`. Wer programmatisch weitere Garten-Deko erzeugt, sollte denselben Marker setzen, falls die Inhalte bei einem Re-Build entfernt werden sollen.

### Keller

Wände/Decke/Boden in dunklen Grautönen (b80/b100/b90). **Skelett** aus `skeleton_3.svg` via `<image href>`, perspektivisch hinten-rechts (Füsse bei (1236, 645), 177×250). Farb-Invertierung via SVG-Filter `#invert` (schwarz → weiss). Schaukel-Animation: `<animateTransform type="rotate">` um die Füsse, ±6°, 2.5 s.

**Painting** (`painting_2.png`) als `<image href>` an der hinteren Wand, mittig über dem Kamin: 130×194 (hochformat) bei (635, 110). `filter="url(#grell-mild)"`. DOM-zuerst (vor Kamin/Skelett/etc.).

**Kamin** (`assets/fireplace_1.svg`, inline) hinten-links: `<svg id="fireplace_1" x="440" y="400" width="380" height="250" viewBox="0 0 403.48514 265.84756">`. Bottom an Bodenniveau hintere Wand (y=600). User hat das Asset stark vereinfacht (jetzt ~110 KB, 252 Zeilen). **Alle Asset-IDs werden beim Reimport mit `fp_` prefixed** (`fp_Layer_1`, `fp_g4609`, `fp_Gradient_1` etc.) gegen Konflikte mit anderen Inline-SVGs. Drei Flammen-Gruppen `fp_g4609`/`fp_g4755`/`fp_g4353` haben CSS-Animation (`transform-box:view-box`, `transform-origin` am Flammenfuß): Höhen-Pulsieren + Opacity-Flackern + Hue-Shift Richtung **Rot** (negative Werte −30°…−2°, kaum positive → wenig Gelbgrün). Drei verschiedene Phasen/Frequenzen (1.90s/2.40s/1.50s, mit Delays) → ruhiges Züngeln. Hindernis: Ellipse `{ fu:0.33, fv:0.95, rx:0.18, ry:0.04 }`.

**plant_kraeuter** (Inline-SVG, aus Hauptraum verschoben) steht auf dem Kaminsims: `<g data-y-fuss="415" transform="translate(630 415) scale(0.10) translate(-256 -512)">`. Klein skaliert (σ=0.10 → ~51 px Bounding Box). data-y-fuss=415 → fv≈1.62, also IMMER hinter Figur (figur.fv ≤ 0.97). Kein Boden-Hindernis nötig, weil die Pflanze nicht auf dem Boden steht.

**Kerzen** — JS-generiert in `baueKellerKerzen()` (script.js): ~50 Kerzen mit rötlichem Wachs in einem Halbkreis-Cluster um das Skelett (Standpunkt fu=0.90, fv=0.85). Templates `KERZE_TEMPLATE_2` und `KERZE_TEMPLATE_3` enthalten den Pfad-Inhalt aus `assets/candle_2.svg` bzw. `candle_3.svg` (ohne outer `<svg>`-Tag), mit Wachs-Hex-Codes durch Platzhalter `__WACHS__` / `__WACHS_HELL__` / `__WACHS_DUNKEL__` ersetzt. Pro Kerze wird ein Template geklont, die Platzhalter durch konkrete Rotwerte ersetzt (Hauptfarbe + ~18 % heller + ~45 % dunkler), IDs prefixiert (`cd<i>_…`), und das outer `<svg>` mit x/y/width/height/preserveAspectRatio="none" gebaut → DOMParser → `appendChild`. Flammenfarben (Gradient_2 in candle_2, #F04218/#FFFF00/#FFFFFF/#FF7F2A in candle_3) bleiben original. Cluster-Definition in `KELLER_KERZE_CLUSTER` (8 Cluster mit unterschiedlicher Dichte → Häufungen + dünn besetzte Bereiche, weiche Aussenkante durch Pseudo-Gauss-Streuung). Höhe variiert stark (30–68 px, uniform), Breite 14–21 px pseudo-normalverteilt (Mittel aus 3 Uniform-Samples → Mode bei ~17.5 px). ~50 % der Kerzen werden zusätzlich an ihrer vertikalen Mittelachse gespiegelt (`transform="matrix(-1 0 0 1 2·cx 0)"`) → bricht die symmetrische Wiederholung der Asset-Highlights/-Schatten auf. `bodenAnker` pro Template (0.89 für candle_2, 0.99 für candle_3) richtet den visuellen Kerzenfuß auf `bodenPunkt(fu, fv)` aus. Größe per Tiefen-Skala `s = 1 - 0.45·fv`. Deterministisch via `mulberry32(73)`. Marker `data-generated="kerze"` für idempotenten Re-Build.

**Ketten** (`chain_1/2.svg`, inline) — beide am Boden vorne, nebeneinander platziert (User-justiert):
- `chain_2` (lange Kette, x=280 y=780, 280×100) — links
- `chain_1` (kürzere Kette mit Kugel, x=540 y=770, 200×110) — rechts daneben (überlappt chain_2 leicht bei x=540..560)
- Beide ohne `data-y-fuss` → bleiben in der Rück-Ebene, Figur überdeckt sie. **Hindernis** `HINDERNISSE.keller[2]` deckt den ganzen Ketten-Footprint inkl. Vorraum ab → Figur darf den Bereich nicht betreten (für Chain-4-Drop-laufziel siehe Chain 4).

**muffin_4** (aus dem Hauptraum hierher verschoben): `<svg id="muffin_4" data-y-fuss="657" x="1218" y="624" width="25" height="33">`. (User verschob nach hinten und verkleinerte; data-y-fuss auf bbox-bottom 657 gesetzt.) **Wachspapier-Farben modifiziert**: ursprünglich Gelb-Grün (`#abc837`→`#89a02c`), jetzt warmes Gelb-Orange (`#f0bf20`→`#bf931a`).

**animal_1** (`assets/animal_1.svg`, große Tier-/Kreatur-Figur an der hinteren Wand): inline mit IDs `a1_` prefixed (143 Path-IDs). Position vom User justiert auf `x="474" y="215" width="140" height="175" preserveAspectRatio="none"`. **Sanfter Gelb-Tint t=0.06** auf alle 95 Hex-Farbwerte angewendet (verschoben Richtung Honig/Warm-Beige, ohne dass es offensichtlich gelb wirkt — siehe Stolperstein "Animal-Tint"). **KEIN data-y-fuss** — wandmontiert, soll IMMER hinter Figur sein → bleibt nur in Rück-Ebene.

**animal_2** (`assets/animal_2.svg`, kleinere Tier-Figur an der Wand): inline mit IDs `a2_` prefixed (10 Gradients erhalten). Position `x="645" y="220" width="130" height="154"`. `filter="url(#grell-soft)"` (effektiv saturate 1.0 = Originalfarben, da Parent `#grell` doppelt saturiert). **KEIN data-y-fuss** — gleicher Mechanismus wie animal_1, immer in Rück-Ebene.

Alle Inline-Imports im Keller (Kamin, Ketten, animals) haben prefixierte IDs (`fireplace_…`/`ch1_…`/`ch2_…`/`a1_…`/`a2_…`) gegen Konflikte. Kein eigenes Hindernis bei Kerzen/Ketten/Skelett/animals (Deko, Figur kann durchlaufen).

## Hindernis-System (Kollision)

`HINDERNISSE[raumId]` ist ein Array. Jedes Hindernis ist eine von vier Formen:

- **Kreis**: `{ fu, fv, r }` — runde/kompakte Objekte (Pflanzen, Octopus).
- **Ellipse**: `{ fu, fv, rx, ry, rot? }` — flache/breite Objekte (Tisch1, Kamin). `rot` ist optional in Radian (Default 0): Rotation der rx-Achse ggü. der fu-Achse, im Uhrzeigersinn auf dem Boden-(fu,fv)-System (atan2-Konvention). Im Debug-Editor per ↻-Handle interaktiv setzbar.
- **Viereck (konvex, polygon)**: `{ punkte: [[fu1,fv1], [fu2,fv2], [fu3,fv3], [fu4,fv4]] }` — rechteckige Möbel mit gerader Kante (Schrank, ggf. später Schreibtisch). Konvex bedeutet: alle Innenwinkel < 180°. 3+ Punkte erlaubt, beliebige Reihenfolge (Cross-Product-Test).
- **Spline (kubische Bezier-Kette)**: `{ spline: [{ fu, fv, hIn?: {du,dv}, hOut?: {du,dv} }, ...] }` — geschlossene Kette von kubischen Bezier-Edges für unregelmäßige/weiche Konturen (z.B. Kerzen-Cluster). Edge i geht von vertex[i] zu vertex[(i+1)%n]; Kontrollpunkte = vertex + (hOut bzw. hIn) als Offset-Vektoren. Fehlende Handles ⇒ degenerierter Cubic = effektiv gerade Kante. Handles sind nicht symmetrisch (zwei unabhängige Tangenten — Knicke an Vertices erlaubt). Für Kollision wird der Spline pro Edge mit `SPLINE_N=16` Samples in eine Polyline subdiviert (`splinePoly(h)`, gecached auf `h._cachedPoly`, invalidiert bei jedem Vertex-/Handle-Drag) und mit Ray-Casting (`pktInPolygonAllgemein`) getestet — funktioniert auch für nicht-konvexe Splines. Slide-Manöver projizieren auf das nächste Polyline-Segment; Außen-Normale via Centroid-Richtung (an konkaven Stellen leicht ungenau, für Level-Design ausreichend). **Alle HINDERNISSE-Einträge sind Splines** — Kreise/Ellipsen als 6-Eck-Näherung konvertiert, Vierecke 1:1 übernommen. Kreis/Ellipse/Viereck-Typen bleiben im Code für eventuelle spätere Nutzung.

Form-Helper (alle in `script.js` direkt vor `istImHindernis`):
- `istInForm(h, fu, fv)` — Type-Dispatch zwischen Ellipse-Gleichung und `pktInKonvexPolygon`.
- `hindernisCenter(h)` — Schwerpunkt (für Slide-Distanz-Suche).
- `hindernisMaxRadius(h)` — konservativer Maximal-Radius vom Center (Pre-Filter).
- `naechsterRandUndNormale(h, fu, fv)` — gibt nächsten Punkt am Rand + Außen-Normale zurück. Für Vierecke: Projektion auf nächste Kante; für Ellipsen (ggf. rotiert): Punkt in Lokal-Frame drehen, dort radiale Approximation, Randpunkt + Gradient zurück nach Welt rotieren.

Hauptfunktionen:
- `istImHindernis(fu, fv)`: iteriert via `istInForm`.
- `setzeFigurZiel(fu, fv)`: liegt das Ziel im Hindernis, schiebt es zum nächsten Randpunkt (entlang Außen-Normale, +0.005 Puffer). Safety Net für Tür-Laufziele.
- `slideUmHindernis(ux, uy, schritt)`:
  1. **Blocker = das Hindernis, in das der direkte Schritt reinläuft.** `aktualisiereFigur` ruft slide nur, wenn `istImHindernis(neueFu, neueFv) === true`, also weiß slide, dass mindestens eines existiert — nimmt das erste, in dessen Form die direkte Schritt-Position liegt. (Frühere Center+Along-Heuristik versagte, wenn das Polygon-Center hinter der Figur lag, aber eine Polygon-Spitze noch in den Pfad ragte → fälschlich als „behind" klassifiziert, slide gab null, Figur blieb stecken — siehe Stolpersteine.)
  2. Tangente = senkrecht zur **Außen-Normale am nächsten Randpunkt** (für Ellipsen → Gradient, für Vierecke → Kanten-Senkrechte).
  3. Bevorzugt die Seite mit positivem Dot zur Laufrichtung.
  4. **Außen-Puffer:** jeder Slide-Schritt bekommt zusätzlich `+0.002 * Außen-Normale` aufaddiert, damit er nicht exakt auf der Polygon-Kante landet (`pktInKonvexPolygon` zählt Boundary-Punkte als „drin"; ohne den Puffer würde der reine Tangenten-Schritt bei langen Slides genau auf die Kante driften → abgelehnt → andere Seite osc-blockiert → null → Figur stoppt).
  5. **Wand-Fallback:** verlässt die bevorzugte Seite den Laufbereich oder führt in ein anderes Hindernis → ANDERE Seite probieren.
  6. **Oszillations-Schutz:** Slide-Schritt, der innerhalb `schritt*0.5` der letzten Position liegt (`figur.letztePosFu/Fv`), wird abgelehnt → andere Seite. Wenn beide Seiten geblockt oder zur letztePos zurückführen, return null → Figur stoppt. Verhindert Hin-und-Her-Pendeln, wenn die Figur frontal auf eine Hindernis-Kante drückt und das Ziel hinter dem Hindernis nicht erreichbar ist (z.B. Klick hinter cupboard_1).
- **Safety-Net** in `aktualisiereFigur`: vor jedem Schritt: in einem Hindernis? Falls ja → zum nächsten Randpunkt + clamp.
- **Diagnostik:** wenn slide returns null, loggt `aktualisiereFigur` eine `Slide stuck`-Warnung mit pos/ziel/letztePos/richtung in die Konsole — hilft, übersehene Edge-Cases zu finden.

Pflanzen-Radien orientieren sich am Fussabdruck (Topfbasis), nicht am Blattwerk → Figur kann knapp vorbei, der Körper verschwindet perspektivisch hinter den Blättern. Vierecke umgekehrt: präziser visueller Footprint mit kleinem Puffer (z.B. cupboard_1 mit 3% Puffer um den sichtbaren Schrank-Linksrand).

**Hindernis-Werte nicht raten — interaktiv platzieren.** Hindernis-Positionen werden NICHT im Code geschätzt (Pixel-/Perspektive-Berechnungen sind unzuverlässig), sondern interaktiv per Drag-and-Drop-Editor:
1. `hindernisDebug(true)` in der Browser-Konsole → farbige Overlays + Handle-Marker. Handles je nach Form:
   - **Vierecke**: pro Eckpunkt ein runder Marker mit Label `<idx>.<eckIdx>` (z.B. `3.0`).
   - **Kreis/Ellipse**: runder Center-Marker mit `<idx>` + zwei quadratische `rx`/`ry`-Handles auf den Halbachsen + ein runder `↻`-Handle etwas außerhalb der rx-Achse (zum Drehen).
   - **Spline**: pro Vertex ein runder Marker mit Label `<idx>.<vIdx>` und zwei kleine quadratische Handle-Marker (hIn + hOut) mit gestrichelten Verbindungslinien zum Vertex. Gefülltes Quadrat = hIn/hOut gesetzt (gespeichert), hohles Quadrat = Default-Position (kein Eintrag in den Daten, Edge an dem Ende gerade).
2. Marker mit der Maus an die richtige Position ziehen (jeder Drag loggt eine kompakte Bestätigung). Achs-Drag (`rx`/`ry`) wandelt einen Kreis automatisch in eine Ellipse um (`r` weg, `rx`/`ry` neu). Rotations-Drag setzt `h.rot` in Radian; Werte unter 0.001 werden gelöscht (saubere 0-Default-Ausgabe). Spline-Handle-Drag setzt `hIn`/`hOut` auf den realen Offset (Quadrat wird gefüllt).
3. **Spline-spezifische Editor-Aktionen** (nur im Debug-Modus):
   - **Doppelklick auf eine Spline-Kurve** (nicht auf einen Marker, in 14 px Toleranz) → kurvenform-erhaltender De-Casteljau-Split: neuer Vertex am Klick-Punkt, Handles der beiden Halb-Cubics werden korrekt berechnet, Kurvenshape bleibt unverändert.
   - **Rechtsklick auf einen Spline-Vertex** → Vertex löschen (Mindest-Anzahl 3, sonst Warnung in der Konsole).
   - **Rechtsklick auf einen Spline-Handle** → Handle entfernen (`hIn`/`hOut` aus den Daten gelöscht; Edge an dem Ende wird gerade; Marker springt zur Default-Position zurück, kann erneut gedragt werden).
   - **Doppelklick auf einen Spline-Handle** → Handle zurücksetzen (identisch mit Rechtsklick-Löschen, aber per Doppelklick leichter erreichbar wenn die Maus schon auf dem Marker ist).
   - Pointerdown filtert `e.button !== 0` raus → Rechtsklick startet keinen Drag.
4. `dumpHindernisse()` (oder `dumpHindernisse("haupt")` etc.) → fertiges Code-Snippet für den ganzen Raum (`rot` wird nur ausgegeben, wenn ≠ 0; bei Splines werden `hIn`/`hOut` nur ausgegeben, wenn ≠ 0).
5. Snippet 1:1 in `HINDERNISSE.<raum>` in `script.js` einfügen.
6. `hindernisDebug(false)` ausschalten.

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
    zustaende: {
        badewanne: 1, toilette_1: 1, toilette_2: 1,    // 1 = Initialstate (Sitz), 2 = nach Handlung
        toilette_1_voll: false, toilette_2_voll: false, // orthogonal zum Sitz: leer/voll (siehe unten)
        octopus_da: true,                               // Tintenfisch noch im Bad? false nach Exit-Animation
        octopus_zustand: 1,                             // 1 = mürrisch / 2 = aufgehellt / 3 = zufrieden (animiert sich weg)
        octopus_exit_gestartet: false,                  // Bridge: Exit-Timer max 1× pro Run (siehe schliesseOverlay-Hook)
        // Chain 3 + Bridge:
        vogel_da: false,                                // bird_1 sichtbar (true zwischen Wolken-Klick und Coin-Drop)
        wolke_zentral_weg: false,                       // WOLKEN[1] permanent versteckt nach Klick
        schlauch_genommen: false,                       // gradenhose_1 von der Wand entfernt (im Inventar)
        flower_1_gegossen: false,                       // flower_1 visuell auf 2× skaliert (CSS-Klasse `flower-1-gross`)
        binoculars_genommen: false,                     // binoculars_1 aus toilet_1 verschwunden (im Inventar)
        keller_freigeschaltet: false,                   // Code geknackt → Geheimtür permanent sichtbar (b80) + Keller offen
        // Chain 4 — duck_1 + muffin_1 → Ketten → Burp/Messgerät → Teppich → Schaufel
        duck_im_keller: false,                          // duck_1 in den Ketten platziert (DOM-Element duck_1_keller sichtbar)
        duck_gefuettert: false,                         // muffin_1 verfüttert → CSS-Klasse duck-gross + Messgerät spawnt
        teppich_gemessen: false,                        // chain_4_teppich-Aufgabe gelöst → Schaufel im Inventar
        // Chain 5 — Bürobild-Sequenz (gelb-rot-violett) → MC R=r·√2 → drei_kreise → painting_2 → Skelett lacht → Pickel
        chain_5_step: 0,                                // 0 = nichts, 1 = MC gelöst, 4 = drei_kreise gedroppt + Pickel direkt im Inventar (Schritte 2 und 3 entfallen seit Vereinfachung)
        bild_kreise_sequenz: [],                        // aktuelle Klick-Sequenz, Array von "yellow"|"red"|"violet"
        bild_kreise_replay_aktiv: false,                // sperrt Klicks während Replay
        bild_kreise_geloest: false,                     // MC gelöst → drei_kreise im Inventar; 3 Bild-Kreise versteckt
        bild_kreise_im_keller: false,                   // drei_kreise auf painting_2 gedroppt → Overlay sichtbar
        // (`pickel_da` entfernt — Pickel landet seit Vereinfachung DIREKT ins Inventar beim
        // drei_kreise-Drop; kein separater Aufnehm-Schritt im Keller mehr.)
        // Chain 7 — Schaufel + Pickel + vereinter_schluessel → Grab in Gartenmitte → Truhe
        // ausheben → mit Schlüssel öffnen → Sieg-Overlay (Feuerwerk + Schatz). Reihenfolge
        // Schaufel/Pickel egal; Loch öffnet sich nach beiden Drops.
        chain_7_schaufel_gedroppt: false,               // Schaufel auf gartenmitte_grab gedroppt
        chain_7_pickel_gedroppt: false,                 // Pickel auf gartenmitte_grab gedroppt
        chain_7_loch_offen: false,                      // beide Werkzeuge gedroppt → chain_7_grab sichtbar + Boden-Hindernis aktiv
        chain_7_geoeffnet: false,                       // vereinter_schluessel auf chest_1 gedroppt → Sieg-Overlay
    },
    // Chain 6 — Sammelinventar (links). 4 Formel-Erkennungs-Aufgaben füllen es mit
    // schluesselteil_1/_2/_3 + leim. Sobald size===4: Combine-Animation → vereinter_schluessel
    // ins rechte gegenstaende-Set. Items im linkesInventar sind NICHT interaktiv.
    linkesInventar: new Set(),
};
```

**Sanitärobjekt-Switch:** `aktualisiereSanitaer()` togglet die CSS-Klasse `sanitar-aus` mehrerer `<svg>`-Blöcke basierend auf `spielstand.zustaende`. Selektor: `'[id="X"], [id^="v_"][id$="_X"]'` — matcht Original UND die Front-Layer-Klone (deren IDs von `klonePflanzenVorne()` mit `v_<idx>_` prefixed sind). Wird beim Init und nach jeder Zustandsänderung aufgerufen. Behandelt:
- ~~Bathtub-Switch entfernt~~ — `bathtub_1_1` und `bathtub_1_2` sind jetzt ein Layer-Paar (Hintergrund + Vordergrund mit Wasser bis x-Mittelachse), beide permanent sichtbar. Der `badewanne`-State und `setzeBadewanne()`-Helper bleiben für Backwards-Compat, ohne visuellen Effekt.
- Toiletten `#toilet_1_1/1_2`, `#toilet_2_1/2_2` (Sitz-Switch via `toilette_1/2`).
- Voll-Indikatoren `#toilet_1_voll`, `#toilet_2_voll` (gelbe Ellipsen) — sichtbar nur, wenn `toilette_X_voll && toilette_X === 2` (Sitz oben + voll).
- Octopus `#octopus_1_1/_2/_3` — sichtbar nach `octopus_da && octopus_zustand === N`.
- `#animal_3_1`-Image auf desk_4 — versteckt, sobald irgendeine animal_3_*-ID im Inventar liegt oder `chain_2_step >= 1`.

Am Ende ruft `aktualisiereSanitaer()` auch `aktualisiereChain3()` auf (function-hoisting macht das sicher), damit Chain-3-abhängige Sichtbarkeiten (binoculars in WC) bei jedem Sanitär-Toggle automatisch nachziehen.

**Chain-3-Switch:** `aktualisiereChain3()` togglet `sanitar-aus` auf folgenden Elementen:
- `#bird_1` (Garten) — sichtbar wenn `vogel_da` (true zwischen Wolken-Klick und Coin-Drop).
- `#gradenhose_1` (Garten) — versteckt wenn `schlauch_genommen` (im Inventar).
- `#binoculars_1_visual` (Badezimmer, in toilet_1-Schüssel) — sichtbar wenn `!octopus_da && toilette_1 === 2 && !binoculars_genommen`.
- `.flower-1`-Wrapper (alle, Original + Klone) bekommt zusätzlich Klasse `flower-1-gross` (CSS scale(2)) wenn `flower_1_gegossen`.

**Nachtsicht** (Chain 3 / Bridge): Body-Klasse `nachtsicht` wird über `aktiviereNachtsicht()` (in `nimmAufGegenstand`-Hook bei `obj.aufnehmen === "binoculars_1"`) gesetzt. **Single-Pass-SVG-Filter** `<filter id="nachtsicht">` mit feColorMatrix (Phosphor-Grün-Look: R/B-Kanal genullt, G aus Luminanz-Mix 0.18·R + 0.36·G + 0.06·B + 0.05) wird via `filter: url(#nachtsicht)` auf die **drei statischen** Render-Layer (`#game-canvas`, `#object-layer`, `#object-layer-vorne`) angewendet — eine Matrix-Multiplikation pro Pixel statt der früheren 4-fach-CSS-Filter-Kette (brightness × sepia × hue-rotate × saturate, 4 Pipeline-Stufen pro Frame). Hauptraum mit viel DOM-Inhalt war damit sluggish; der Single-Pass ist deutlich schneller. `#figure-canvas` bleibt BEWUSST AUSGENOMMEN (60 fps Updates → Filter pro Frame neu berechnet); Figur ist sowieso fast komplett schwarz. Filter sitzt nicht auf `#game-stage`, weil Inventar (Kind von #game-stage) sonst auch eingefärbt würde. `deaktiviereNachtsicht()` entfernt die Klasse (nach erfolgreichem Code-Drop auf Geheimtür).

**Toiletten-Klick** (OBJEKTE.badezimmer.toilet_1/2, beide ohne `laufziel` → sofortige Aktion):
- toilet_X mit `voll=true` → Klick spielt **Spülsound** (`spieleSpuelung()`) + setzt voll=false. Optional, blockiert Chain 2 nicht.
- toilet_X mit `voll=false` → Klick togglet Sitz (1↔2).
- **toilet_1 ist gesperrt**, solange `octopus_da===true` — Hinweistext, kein Toggle/Spülen. Sobald Octopus weg, normale Logik.
- toilet_2 hat zusätzlich `akzeptiert.animal_3_1`: Drop nur, wenn `toilette_2===2 && !toilette_2_voll`. Effekt: animal_3_1 verbraucht, animal_3_2 ins Inventar, `toilette_2_voll=true`, `chain_2_step→2`.

Polygone bewusst enger als die volle SVG-Bbox (`toilet_1` 1100..1240, `toilet_2` 590..750), damit ein Klick auf cupboard_2 (x=750..1100) keine Toilette togglet. Bathtub-Polygon `[130..730, 440..640]` mit Drop-Target `akzeptiert.animal_3_2` (egal ob `badewanne===1` oder 2 — Wanne ist immer mit Wasser gefüllt) → animal_3_3 ins Inventar, `chain_2_step→3`. Octopus-Polygon `[930..1300, 380..710]` mit zwei symmetrischen Drop-Targets:
- `akzeptiert.animal_3_3` → öffnet `chain_2_octopus`-Aufgabe (C=2π·100 cm → A=31400 cm²).
- `akzeptiert.goldene_muenzen` → öffnet `chain_3_pizza`-Aufgabe (Pizzastück 60°, r=√(6/π) → A=1 m²).

Beide Aufgaben-Callbacks **advancen `octopus_zustand` symmetrisch um +1** (capped bei 3) und verbrauchen das Item. Reihenfolge zwischen Chain 2 und Chain 3 ist also egal: bei state 1→2 zeigt sich der Mood-Hinweis (Aufgaben-spezifischer Text via `belohnung_text`-Funktion), bei 2→3 startet die Exit-Animation NACH Schliessen des Overlays (siehe `schliesseOverlay`-Hook). Bathtub und Octopus haben **kein** `aktion` — Klick ohne Drag fällt durch zur Boden-Logik. Konsole-Helfer: `setzeBadewanne(N)`, `setzeToilette1/2(N)`, `setzeToilette1/2Voll(bool)`, `setzeOctopusZustand(N)`, `animiereOctopusRaus()`, `spieleSpuelung()`, `spieleBurp()`, `aktiviereNachtsicht()`, `deaktiviereNachtsicht()`.

**Dev-Helfer in der Browserkonsole:**
```js
freischalten("keller_schluessel")
verschliessen("keller_schluessel")
gegenstandHinzufuegen("gegenstand_id")
gegenstandEntfernen("gegenstand_id")
verbrauche("gegenstand_id")            // Alias — praktisch in akzeptiert-Callbacks
setzeBadewanne(2)                      // Wanne-State setzen (1 oder 2)
setzeToilette1(2) / setzeToilette2(2)  // Toiletten setzen
wechsleBadewanne() / wechsleToilette1() / wechsleToilette2()  // togglen
spielstand                              // aktueller Zustand inspizieren
hindernisDebug(true|false)              // Hindernisse als farbige Overlays + Eckpunkt-Marker
                                         // mit "<hindernisIdx>.<eckIdx>"-Label rendern.
                                         // Default OFF. Eckpunkte sind dragbar im Debug-Modus.
dumpHindernisse() / dumpHindernisse("haupt")  // Aktuelles HINDERNISSE.<raum>-Array als Code-Snippet
speicherSpielstand()                    // Spielstand sofort in localStorage schreiben
setzeSpielstandZurueck()                // Spielstand löschen + Reload (was der Reset-Button auch tut)
dragAbbrechen()                         // hängenden Drag-Zustand zurücksetzen (siehe Stolperstein)
```

## Persistenz + Settings

**Zwei separate localStorage-Keys** (bewusst getrennt — Settings überleben einen Spielstand-Reset):
- `spiel_kreise_1_save` — der ganze Spielstand (Sets als Arrays serialisiert, Versionsstempel `STORAGE_VERSION = 1`).
- `spiel_kreise_1_settings` — Sound-/Musik-Toggles (`{ soundAn, musikAn }`).

**Spielstand-Save** (`speicherSpielstand()`): serialisiert `{ aktuellerRaum, figur.{fu,fv,richtung}, geloesteAufgaben, freigeschalteteTueren, gegenstaende, linkesInventar, inventar, zustaende, chain_7_hindernis_aktiv, version }` als JSON. Versions-Mismatch beim Laden → Save wird verworfen statt das Spiel zu crashen. Try/catch um localStorage-Calls — bei QuotaExceededError oder blockiertem Storage (Private Mode, Tracking-Schutz) läuft das Spiel im RAM weiter, einmalige Konsolen-Warnung.

**Save-Hooks** an den Choke-Points: `aktualisiereInventar`, `aktualisiereLinkesInventar`, `aktualisiereSanitaer`, `aktualisiereCupboard1`, `aktualisiereChain3/4/5/7`, `wechsleRaum`, `gewaehrenBelohnung`, `freischalten`/`verschliessen`, `zeigeFormelbuch`. Mehrfach-Saves pro User-Aktion sind harmlos (idempotent, ~1 ms localStorage-Write).

**Lade-Pfad** beim Init (in `requestAnimationFrame`-Block am Ende von script.js):
1. `ladeEinstellungen()` — Sound/Musik aus `SETTINGS_KEY` (separat).
2. `ladeSpielstand()` — wenn vorhanden: spielstand-Felder restoren (Sets aus Arrays rebauen via `new Set(daten.X)`), `Object.assign(spielstand.zustaende, daten.zustaende)` (gemerget gegen Default-Defaults → neue Felder in späteren Versionen behalten ihren Default), aktuellerRaum + figur-Position übernehmen. Transient/Animations-Flags (`bild_kreise_replay_aktiv`, `bild_kreise_sequenz`, `octopus_exit_gestartet`) werden auf Default zurückgesetzt — sie waren nur während laufender Animation true und sind nach Reload sinnlos. `chain_7_hindernis_aktiv=true` → `HINDERNISSE.garten.push(CHAIN_7_HINDERNIS)`.
3. `baueRaumDeko()` — DOM bauen, klonen.
4. `aktualisiereAllesNachLaden()` — toggelt Raum-Sichtbarkeit beider SVG-Layer auf den geladenen `aktuellerRaum`, ruft `aktualisiereSanitaer/Cupboard1/Inventar/LinkesInventar`, reaktiviert Nachtsicht falls Binoculars im Inventar + Geheimtür noch nicht freigeschaltet, ruft `draw()`.

**`ladeVorgang`-Flag** ist seit Module-Start `true` und wird erst NACH `aktualisiereAllesNachLaden()` auf `false` gesetzt. Sperrt während dieser Phase `speicherSpielstand()` — sonst würde der Top-Level-`aktualisiereLinkesInventar()`-Aufruf am Ende der script.js den Initial-Default speichern, BEVOR ladeSpielstand() aus dem requestAnimationFrame zum Zug kommt → bestehender Save würde überschrieben.

**Reset-Zahnrad + Settings-Menü** (unten rechts auf der Stage):
- Klick aufs Zahnrad togglet das Settings-Menü (Sound on/off, Music on/off, Reset progress).
- Sound-/Musik-Toggle: schreibt `soundAn` / `musikAn` um, ruft `speicherEinstellungen()` (separater Save unter `SETTINGS_KEY`), aktualisiert die Status-Anzeige (grün=an, rot=aus).
- Reset-Eintrag → `#reset-overlay` (Bestätigungs-Overlay mit „Reset progress?" + roter Reset-Button + grauer Cancel). Bestätigung → `setzeSpielstandZurueck()` → `localStorage.removeItem(STORAGE_KEY)` + `location.reload()`. Settings (`SETTINGS_KEY`) bleiben dabei erhalten.
- Klick ausserhalb des Menüs oder Esc schliesst es. Reset-Overlay schliesst auch via Backdrop-Klick + Esc.

**Musik** ist aktuell ein **Stub**: `let musikAn = false` (Default) wird persistiert und im Settings-Menü getoggelt, aber es spielt noch keine Hintergrundmusik. Eine künftige `starteMusik()`/`stoppeMusik()`-Logik kann das Flag einfach prüfen und auf Toggle reagieren — bei `musikAn=true` Loop starten, bei false stoppen.

**Stolperstein-Verweise:** siehe „Save-Hook in `aktualisiere*`-Funktionen", „`ladeVorgang` initial true", „Settings getrennt vom Spielstand" weiter unten.

## Aufgaben-Konventionen

**π = 3.14** im ganzen Spiel. Konstante `PI_KONSTANTE = 3.14` in script.js. Aufgaben-Lösungen werden mit dieser Konstante berechnet (Sonderfall: π-Annäherungs-Aufgabe in Chain 1, dort ist der Vergleich zu echtem π das Thema).

Aufgaben mit π im Text setzen `pi_hinweis: true` → blendet automatisch eine Hinweiszeile **„Use π = 3.14."** im Overlay ein. Optional `tipp: "<text>"` für sonstige Hinweise (Prefix „Hint: ").

**Zahleneingabe** ist der Default — Aufgabe definiert `loesung: <Zahl>` und `toleranz: <maxAbsErrror>`. Eingabe akzeptiert Komma oder Punkt (parseFloat-normalisiert). Falsche Eingabe → roter Feedback-Text, User kann erneut probieren. Beispiel: `chain_2_octopus` (C=2π·100 cm gegeben, A=31400 cm² gesucht).

**Multiple-Choice** wird über `typ: "multiple_choice"` aktiviert mit `optionen: [{ katex|label, korrekt? }, …]`. Genau eine Option hat `korrekt: true`. Falsche Antworten färben den Button rot + sperren ihn, korrekte Antwort sperrt alle + triggert Belohnung. Falsche Versuche bleiben offen → User kann nochmal probieren.

`bei_richtig` unterstützt: `schluessel` (Schloss-ID), `inventar` (Object → spielstand.inventar gemerged), `gegenstand` (ID aus GEGENSTAENDE → ins Inventar), `belohnung_text` (string ODER `(spielstand) => string` — Funktion wird **nach** dem callback ausgewertet, sodass der Text auf den frisch aktualisierten State zugreifen kann; siehe `chain_2_octopus`/`chain_3_pizza` für state-abhängige Mood-Texte), `callback: (s) => ...` (für freie Logik wie Chain-State-Updates oder Verbrauch).

## Chains (Handlungsstränge)

Mehrere lineare Chains laufen parallel; gelöste Aufgaben dürfen voneinander abhängen (Cross-Chain via `spielstand.inventar`). Konvention: pro Chain ein Step-Counter `spielstand.zustaende.chain_<N>_step` (0 = nichts, dann hochzählen). OBJEKT-Einträge prüfen via `aktiv: (s) => s.zustaende.chain_<N>_step >= …` ob sie aktuell sichtbar/klickbar sind. `OBJEKTE`-Einträge mit definiertem `aktiv` werden im `objektIstAktiv()`-Test ausgeblendet, wenn die Funktion `false` liefert (Klick fällt durch).

### Chain 1 — cake_1 → Schlüssel → cupboard_1 → Zettel → Lampe → Code

| Step | Trigger | Effekt |
|---|---|---|
| 0→1 | Klick `cake_1` (Hauptraum) → MC-Aufgabe `chain_1_kuchen` (U + A bei d=20 cm, π=3.14 → U=62,8, A=314) | `gegenstaende += "schluessel_buero"` (Silberner Schlüssel mit hochstehender ovaler Reide + L-Bart, optisch klar anders als der goldene `vereinter_schluessel` aus Chain 6) |
| 1→2a | Silber-Schlüssel auf cupboard_1 (linke Hälfte, x=980..1180) gezogen | Schlüssel verbraucht, **MC-Aufgabe `chain_1_schloss` öffnet sich** (90° → π/2 rad). Bei richtig: `oeffneCupboard1()` → Schrank-Switch öffnet. Bei falsch: Schrank zu, Spieler kann erneut versuchen (gleicher Aufgaben-Dialog bleibt offen). |
| 2→3 | Klick auf Zettel im offenen Schrank → Overlay mit Button „Mitnehmen" | `gegenstaende += "zettel"`, Zettel verschwindet visuell aus dem Schrank |
| 3→4 | Zettel auf Lichtkegel der **handgemalten Tischlampe auf table_2** (x=330..445, y=430..515) gezogen | Öffnet MC-Aufgabe `chain_1_pi` |
| 4→5 | π-Aufgabe gelöst (richtig: 355/113) | `inventar.keller_code = 355113`, `gegenstaende += "code_geheimtuer"` (Tag-Icon mit "355113"), Zettel verbraucht |

**Vorbedingungen:** cake_1 ist KOMPLETT inaktiv, solange `formelbuch_gefunden=false` — `aktiv: (s) => s.zustaende.formelbuch_gefunden`. Klick fällt einfach durch zur Boden-Logik, ohne Hinweis-Overlay. Die Tischlampe in der Drop-Mechanik ist die handgemalte Schreibtischlampe AUF table_2 (Lichtkegel-Pfad in [index.html](index.html) bei `<g class="tischlampe">`), nicht die Pixar-Stehlampe `lamp_1` vorne-links.

**Auto-Close:** Erfolgs-Overlays (`gewaehrenBelohnung` nach gelöster Aufgabe, "Schlüssel passt", Zettel-Aufnahme) schliessen sich automatisch nach 4 s via `automatischSchliessen(4000)`. Manuell früher schliessbar mit ×, Esc oder Klick auf den dunklen Hintergrund — der Timer wird in `schliesseOverlay()` und bei jedem neuen `zeige…`-Aufruf zurückgesetzt, damit ein alter Timer nie ein frisches Overlay mitschliesst.

`spielstand.inventar.keller_code = 355113` (Zahl) bleibt für die Bridge-Tür-Code-Prüfung; das `code_geheimtuer`-Item ist der sichtbare Inventar-Eintrag (Tag mit „355113"), der dann auf die Geheimtür gedroppt wird (siehe Bridge unten).

cupboard_1-Switch in [index.html](index.html): `cupboard_1_1` (geschlossen, `<image>` href `cupboard_1_1.svg`) und `cupboard_1_2` (offen, `<image>` href `cupboard_1_2.svg`) togglen via `aktualisiereCupboard1()` und CSS-Klasse `sanitar-aus` (analog zum Sanitärobjekt-Switch). Der Zettel ist ein separates Inline-SVG-Element `cupboard_1_zettel_visual` über cupboard_1_2 — wird unabhängig getogglet, sobald er im Inventar liegt.

### Chain 2 — animal_3_1 (Glas mit Fisch) → toilet_2 → Glas leer → Wanne → Glas mit Wasser → Octopus → Octopus geht

**Vorbedingung:** animal_3_1 ist KOMPLETT inaktiv, solange `formelbuch_gefunden=false` — `aktiv: (s) => s.zustaende.formelbuch_gefunden && (s.zustaende.chain_2_step ?? 0) === 0`. Klick fällt einfach durch zur Boden-Logik, ohne Hinweis-Overlay (analog Chain 1 / cake_1).

**Spielertexte:** Alle Spieler-sichtbaren Strings sind auf Englisch (Aufgaben-Fragen, Belohnungstexte, Overlay-Texte, Inventar-Namen, „Hint:"-Prefix, „Use π = 3.14."-Hinweis). Konsolenausgaben (`console.log`/`console.error`) und Code-Kommentare bleiben auf Deutsch (dev-facing). Formelbuch zeigt englischen Namen primär + deutsche Übersetzung in Subtitle-Style (`(DE: ${eintrag.de})`).

| Step | Trigger | Effekt |
|---|---|---|
| 0→1 | Klick `animal_3_1` auf desk_4 (Badezimmer) — nur nach Formelbuch-Fund | `gegenstaende += "animal_3_1"`, Image auf desk_4 verschwindet via `aktualisiereSanitaer()` (jetzt aufgerufen aus `nimmAufGegenstand`). |
| 1→2 | animal_3_1 auf toilet_2 gezogen — nur wenn `toilette_2===2` (Sitz oben) UND `!toilette_2_voll`. Sonst Hinweistext. | `verbrauche("animal_3_1")`, `gegenstaende += "animal_3_2"`, `toilette_2_voll=true` (gelbe Voll-Ellipse erscheint). |
| 2→3 | animal_3_2 auf Wanne gezogen (egal ob blaues oder klares Wasser — die Wanne ist immer voll) | `verbrauche("animal_3_2")`, `gegenstaende += "animal_3_3"`. |
| 3→4 | animal_3_3 auf Octopus gezogen (Polygon `[930..1300, 380..710]`) — **Aufgabe `chain_2_octopus` öffnet sich** | Bei richtig: `verbrauche("animal_3_3")`, `octopus_zustand` += 1 (capped 3). Mood-Hinweis-Text via `belohnung_text`-Funktion (siehe Aufgaben + Overlay) — bei state→2 „mood improved", bei state→3 „fully content". Bei falsch: nichts ändert sich, User kann erneut versuchen oder schliessen + nochmals droppen. |

In der Praxis ist nur **eine** Fütterung möglich, weil animal_3_3 nach dem ersten Drop verbraucht ist und kein Wiederbeschaffungs-Mechanismus existiert (animal_3_1/2 sind nach Toiletten/Wanne-Tour ebenfalls verbraucht). Der zweite Mood-Advance auf state 3 läuft daher zwingend über Chain 3 (siehe unten). Reihenfolge zwischen Chain 2 und Chain 3 ist symmetrisch — es ist egal, wer zuerst kommt.

**Optional/parallel:** Klick auf voll gewordene Toilette → `spieleSpuelung()` (Web Audio Platzhalter: 1.6 s gefiltertes Rauschen mit Tiefpass-Sweep 1200 Hz → 250 Hz, Hüllkurve attack/sustain/decay) + setzt `voll=false`. Nicht nötig für Chain-Fortschritt. `toilette_1_voll` ist als generisches Pendant definiert, aber aktuell setzt kein Drop-Target diesen Zustand (Chain 4 verwendet die duck_1 anderweitig).

**Octopus-Exit-Timing:** `setTimeout(() => animiereOctopusRaus(), 2000)` wird **nicht** im Aufgaben-Callback gestartet, sondern in `schliesseOverlay()` über einen Hook: wenn nach Schliessen `octopus_zustand===3 && octopus_da && !octopus_exit_gestartet`, dann startet der 2-Sekunden-Timer. Damit zählt die Pause ab dem Moment, in dem User wieder das Spiel sieht (statt schon während des Mood-Hinweis-Overlays). `octopus_exit_gestartet`-Flag verhindert Doppel-Trigger.

**Octopus-Exit-Animation:** `animiereOctopusRaus()` startet eine dreiphasige CSS-`@keyframes`-Animation `octopus-leave` (Total 2.2 s, siehe `style.css`):
- **Phase A** (0..45.5 %, 1.0 s): Octopus krabbelt von Original-Position zu `dx=-470, dy=-5` und schrumpft auf `scale(0.7)`. ease-out für sanftes Anrollen.
- **Phase B** (45.5..68.2 %, 0.5 s): Pause an dieser Position (~toilet_2-Höhe).
- **Phase C** (68.2..100 %, 0.7 s): parabelförmiger Sprung zur Wannen-x-Mitte (`dx=-720`) mit Apex bei `dy=-405`, gleichzeitig 180°-Rotation (4 lineare Stützpunkte approximieren die Parabel: 76 % bei dx=-533, 84 % Apex bei dx=-595, 92 % bei dx=-658, 100 % bei dx=-720) → „Kopfsprung ins Wasser".

Nach `animationend` setzt `aktualisiereSanitaer` via `octopus_da=false` die `sanitar-aus`-Klasse → `display:none`. Safety-Timeout 2.5 s.

**DOM-Layering für „Untertauchen":** `bathtub_1_1` (Hintergrund-Layer, volle Wanne) DOM-VOR Octopus, `bathtub_1_2` (Vordergrund, Wasser nur bis x-Mittelachse) DOM-NACH allen Octopus-Varianten und VOR `duck_1`. So taucht der Octopus während der Sprung-Landephase visuell hinter `bathtub_1_2` ein, während die Ente weiter vorne auf dem Wasser bleibt. Beide bathtub-SVGs sind als `<image href>` eingebunden (kein Switch-Partner mehr — `aktualisiereSanitaer` togglet sie nicht; der `badewanne`-State und `setzeBadewanne()`-Helper bleiben für Backwards-Compat, haben aber keinen visuellen Effekt).

`transform-box: view-box; transform-origin: 1150px 545px` referenziert das outer SVG (#object-layer mit viewBox 0 0 1600 900); Origin in user-units auf den visuellen Octopus-Mittelpunkt → scale + rotate um den Octopus selbst.

**Frühere Varianten:** (a) Figur-Ausweich-Heuristik (figur.fu<0.5 → +380px) schickte ihn in die rechte untere Ecke; (b) `dx=-350, dy=520` zum „zurueck"-Pfeil querte den Figur-Bereich; (c) `dx=-720` mit Translate + Fade fadete in der Mitte weg statt in der Wanne; (d) translate + scale 0.7 + display:none wirkte zu abrupt — Octopus „verschwand" statt „tauchte unter".

### Chain 3 — Wolke → Vogel + Schlauch → Blume → Samen + Vogel → Münzen → Octopus

**Vorbedingung:** Schlauch-Klick + Vogel-Klick brauchen `formelbuch_gefunden=true` (analog cake_1, animal_3_1).

**Zwei parallele Sub-Pfade, die zusammenlaufen:**

| Step | Trigger | Effekt |
|---|---|---|
| 3a | Klick auf zentrale Wolke (`WOLKEN[1]` cx=470 cy=140, Klick-Polygon (380,95)..(560,185) im Garten) | `wolke_zentral_weg=true`, `vogel_da=true`. Wolke verschwindet (zeichneWolken skippt sie), bird_1-SVG wird sichtbar. |
| 3b-1 | Klick auf Gartenschlauch (`#gradenhose_1`, Klick-Polygon (1310,455)..(1380,605) auf rechter Hauswand) → MC-Aufgabe `chain_3_schlauch` (5 Windungen, d=5/π m → L=25 m. Distraktoren: 5 m, 50 m, 25/π m) | `gegenstaende += "gartenschlauch"`, `schlauch_genommen=true`, gradenhose-Image verschwindet von der Wand. |
| 3b-2 | Drag `gartenschlauch` auf flower_1 (Klick-Polygon (320,510)..(400,613)) | flower_1 skaliert auf 2× via CSS-Klasse `flower-1-gross`, `verbrauche("gartenschlauch")`, `gegenstaende += "seed_1"`, `flower_1_gegossen=true`. |
| 3c | Drag `seed_1` auf Vogel (gleiches Polygon wie Wolke, nur aktiv wenn `vogel_da===true`) | `verbrauche("seed_1")`, `gegenstaende += "goldene_muenzen"`, `vogel_da=false` (Vogel fliegt davon). |
| 3d | Drag `goldene_muenzen` auf Octopus → **Aufgabe `chain_3_pizza`** (Pizzastück 60°, r=√(6/π) m → A=1 m², Toleranz ±0.05) | Bei richtig: `verbrauche("goldene_muenzen")`, `octopus_zustand` += 1 (analog Chain 2), bei state→3 Exit-Animation nach Overlay-Schliessen. |

`bird_1`-OBJEKT in `OBJEKTE.garten` hat zwei Varianten mit `aktiv`-Predicates: `wolke_zentral` (aktiv wenn `!vogel_da && !wolke_zentral_weg`) und `bird_1` (aktiv wenn `vogel_da`). Selbes Polygon — Klick fällt auf den jeweils aktiven Eintrag.

### Chain 4 — duck_1 + muffin_1 → Ketten → Burp/Messgerät → Teppich → Schaufel

Läuft parallel zu Chain 1–3, kommt aber praktisch erst weiter, wenn der Keller offen ist (Drop in den Ketten ist Pflicht-Schritt). Chain 4 liefert die **Schaufel**, eine der zwei Items für den späteren Abschluss (Chain 5 liefert den Pickel).

**Vorbedingung:** alle Klick-/Aufnehm-Schritte verlangen `formelbuch_gefunden=true` (analog Chain 1–3).

| Step | Trigger | Effekt |
|---|---|---|
| 1a | Klick auf duck_1 in der Wanne (`#duck_1` SVG, Polygon (412..464, 472..530)) | `gegenstaende += "duck_1"`, duck_1-SVG verschwindet aus Wanne (aktualisiereChain4). |
| 1b | Klick auf muffin_1 auf desk_5 (`#muffin_1` SVG, Polygon (1338..1378, 546..596)) | `gegenstaende += "muffin_1"`, muffin_1-SVG verschwindet von desk_5. |
| 2 | Drag `duck_1` auf Ketten-Polygon (Keller, x=280..740, y=770..880, beide Ketten + Lücke) | `verbrauche("duck_1")`, `duck_im_keller=true`, duck_1_keller-SVG erscheint zwischen den Ketten (DOM-VOR chain_1/chain_2 → visuell hinter ihnen). |
| 3 | Drag `muffin_1` auf duck_1_keller (Polygon (370..490, 750..882) = aktuelle Initial-Bbox) | `verbrauche("muffin_1")`, `duck_gefuettert=true`, CSS-Klasse `duck-gross` (scale 3× via .duck-keller-inner, transform-origin Bottom-Center → Ente wächst auf 360×396 nach oben). Burp-Sound (`spieleBurp()`). `gegenstaende += "messgeraet"`. |
| 4 | Drag `messgeraet` auf Teppich (Hauptraum, perspektivisches Trapez (538,755)..(586,635)..(1014,635)..(1062,755) basierend auf HAUPT_TEPPICH bbox) | Öffnet Aufgabe `chain_4_teppich` (MC, U=6,28 m, d=10 cm → A_äußerster_Ring = 5966 cm²). |
| 5 | Aufgabe richtig | `verbrauche("messgeraet")`, `teppich_gemessen=true`, `gegenstaende += "schaufel"`. |

**`chain_4_teppich`** — MC mit 4 Optionen:
- ✓ 5 966 cm² — π·(R²−r²) = 3,14·(100²−90²) = 5966 (richtig)
- ✗ 31 400 cm² — π·R² = ganze Teppich-Fläche (Distractor: Spieler vergisst die Differenz)
- ✗ 25 434 cm² — π·r² = Innenkreis (Distractor: nimmt nur den inneren Kreis)
- ✗ 6 280 cm² — U·d (Distractor: streifenförmiger Fehlansatz)

**duck_1_keller-Visual:** Inline-Kopie der duck_1-SVG-Pfade (gelber Körper + oranger Schnabel + Auge), in `<svg id="duck_1_keller">` mit `<g class="duck-keller-inner">`-Wrapper für die `duck-gross`-CSS-Klasse. Initial mit `class="sanitar-aus"`. Position x=370 y=750, **width=120 height=132 — bereits 3× so gross wie duck_1 in der Wanne (40×44)**. Sitzt zwischen chain_2 (x=280..560) links und chain_1 (x=540..740) rechts. Outer-`<svg>` hat `overflow="visible"`, damit die nach Füttern um Faktor 3 skalierte Ente (visuell 360×396, also insgesamt 9× Wanne) nicht von der SVG-Bbox geclippt wird — sonst würde sie als „gelbes Quadrat" erscheinen. Skalierung läuft auf der inneren `<g class="duck-keller-inner">` mit `transform-box: fill-box` und `transform-origin: 50% 100%` (Bottom-Center), damit der untere Anker in den Ketten bleibt.

**Drop-Polygon-Überlapp im Bad:** duck_1-Polygon überlappt mit bathtub-Polygon. duck_1 ist DOM-/Listen-VOR bathtub platziert → `findeObjektBei` greift duck_1 zuerst, solange aktiv. `versucheDrop` filtert pro `gegenstandId` über `akzeptiert[id]` → kein Konflikt bei animal_3_2-Drop in Wanne.

**Burp-Sound** (`spieleBurp` in script.js, analog `spieleSpuelung`): kurzer 0.55 s Web-Audio-Burst, Tiefpass 320→80 Hz, hoher Q (6 → resonant), Pulse-Hüllkurve. Klingt nach kurzem rumorenden Rülpser.

**Inventar-Icons** in `GEGENSTAENDE`:
- `duck_1` — kompakte Kopie der ersten 4 Pfade des Assets (Körper + Schnabel + Auge), inline-SVG mit Original-viewBox.
- `muffin_1` — Cartoon-Cupcake: Wachspapier (gerippelt #f0bf20) + Schoko-Top (#5a3a1a) + 4 Streusel.
- `messgeraet` — Bandmaß: gelb-orange Gehäuse (#ff9933) + schwarzer Wickel + ausgezogenes weißes Maßband mit schwarzen Skala-Tics, schräg nach unten-rechts.
- `schaufel` — Garten-Kelle 30° rotiert: brauner Holzgriff (#8b5a2b) mit zwei dunklen Bändern + grauer Hals + zulaufendes silbernes Kellen-Blatt + Highlight.

### Chain 5 — Bürobild-Sequenz → drei_kreise → painting_2 → Skelett lacht → Pickel

Läuft parallel zu Chains 1–4. Liefert den **Pickel** — das zweite Item für den späteren Spielabschluss neben der Schaufel aus Chain 4.

**Vorbedingung:** alle 3 Kreis-Klicks im Bürobild verlangen `formelbuch_gefunden=true` (analog Chains 1–4). Klick davor fällt ohne Hinweis durch.

| Step | Trigger | Effekt |
|---|---|---|
| 1a | Klick auf gelben Kreis (`bild_kreis_yellow`) im Bürobild | `spieleTon(C4=261.63 Hz)`, `bild_kreise_sequenz.push("yellow")` |
| 1b | Klick auf roten Kreis (`bild_kreis_red`) | `spieleTon(E4=329.63 Hz)`, sequenz wächst |
| 1c | Klick auf violetten Kreis (`bild_kreis_violet`) | `spieleTon(G4=392.00 Hz)`, sequenz hat 3 Einträge |
| 2 | Nach 3 Klicks → `setTimeout(replaySequenz, 500)` | `bild_kreise_replay_aktiv=true`, alle 3 Töne nochmals im 280-ms-Tempo. Klicks gesperrt. |
| 3 | Replay-Ende — Vergleich mit `["yellow","red","violet"]` | Bei richtig: `zeigeAufgabe("chain_5_kreise")`. Bei falsch: sequenz=[], replay-Sperre auf, weiter probierbar. |
| 4 | Aufgabe `chain_5_kreise` (MC, R = r·√2 für 2π·r² = π·R²) | `gegenstaende += "drei_kreise"`, `bild_kreise_geloest=true`, `aktualisiereChain5()` versteckt die 3 Bürobild-Pfade. |
| 5 | Drag `drei_kreise` auf painting_2 (Keller, Polygon (950..1080, 300..494)) | `verbrauche("drei_kreise")`, `bild_kreise_im_keller=true`, painting_2_kreise-Overlay sichtbar (3 Kreise, 20 % grösser als Bürobild-Original); `skelettLachen()` (2 s schnelle Wackel-+Scale-Pulse-Animation); **Pickel landet DIREKT ins Inventar** (kein separater Aufnehm-Schritt im Keller mehr); Story-Text „...the skeleton bursts into laughter and gives you a pickaxe as thanks." |

**Frequenzen-Mapping** in `KREIS_FREQ`: yellow=C4 (261.63), red=E4 (329.63), violet=G4 (392.00) — Dur-Akkord, harmonisch. **`spieleTon(freq, dauer=0.4)`**: Sinus-Oszillator mit Hüllkurve (Attack 0.02 s → Sustain → Release 0.13 s, Peak gain 0.25). Im Block analog `spieleSpuelung`/`spieleBurp`.

**Replay-Logik** in `replaySequenz()`: setzt `bild_kreise_replay_aktiv=true`, schedules je `spieleTon(KREIS_FREQ[farbe])` per `setTimeout(i*280)`, und nach `seq.length*280 + 250` ms: Korrektheit prüfen, sequenz leeren, Sperre lösen, ggf. Aufgabe öffnen. Replay läuft IMMER nach 3 Klicks (akustisches Feedback der Eingabe — auch bei falsch).

**`chain_5_kreise`** — MC mit 4 Optionen (π kürzt sich → kein π-Hinweis):
- ✓ √2 — R² = 2r², R = r·√2 (richtig)
- ✗ 2 — verdoppelt-r-Falle
- ✗ 4 — r² statt r
- ✗ 1/√2 — inverse Falle

**Bürobild-Klickpolygone:** in `BUERO_BILD.kreise` haben die 3 Chain-5-Kreise eine `id`-Property (`bild_kreis_yellow|red|violet`); `baueBueroBild()` setzt sie als Attribut auf den `<path>`. Die OBJEKTE.buero-Einträge `bild_kreis_*_klick` haben Platzhalter-Polygone `[[0,0]…]` — **`initChain5Polygone()`** befüllt sie nach `baueBueroBild()` aus den uv-Bbox-Ecken (cu±r, cv±r) per `linkeWandPunkt`. BUERO_BILD ist in der Datei NACH OBJEKTE definiert, daher kein Inline-Lookup im Array-Literal möglich. Die Polygone sind perspektivisch korrekte Quadrilaterals auf der schrägen Bürobild-Wand.

**Violet-Kreis verschoben** ggü. der Original-6-Kreis-Komposition: ursprünglich (cu=0.5375, cv=0.5245, r=0.060), neu (cu=0.5675, cv=0.4825, r=0.055), damit er nicht mehr mit dem grossen Gelb (r=0.090) überlappt — Center-Distanz 0.184 > Summe-Radii 0.145. Bbox-Top liegt knapp ausserhalb der Leinwand-uv-Box, wird aber durch `clip-path="url(#bueroBildClip)"` sauber abgeschnitten.

**painting_2_kreise-Overlay** (Keller, über painting_2 x=950 y=300 130×194): `<svg id="painting_2_kreise" class="sanitar-aus" pointer-events="none">` mit 3 `<circle>`-Elementen. Positionen perspektivisch entzerrt aus den BUERO_BILD-uv-Koords:
- yellow at office (0.4175, 0.5845) r=0.090 → painting_2 (78.6, 104.3) r=23.4
- red at office (0.2225, 0.5245) r=0.075 → painting_2 (28.0, 146.0) r=19.5
- violet at office (0.5675, 0.4825) r=0.055 → painting_2 (117.5, 175.2) r=14.3

Berechnung: `xFrac = (cu - leinwand.uMin) / (leinwand.uMax - leinwand.uMin)`, analog yFrac mit `vMax - cv` (v invers, da v aufwärts auf der schrägen Wand → y abwärts auf der frontalen Wand). r-Skala = r/leinwand-Breite × painting_2-Breite. Aspect-Ratio differiert (Bürobild 1.80 landscape, painting_2 0.67 portrait) → keine perfekte 1:1-Übersetzung, aber relative Anordnung erhalten.

**Skelett-Lach-Animation** (`skelett-lacht` CSS-Klasse): Keyframes `skelett-lach-wackel` 0..100 % rotiert ±12° + skaliert 1..1.08 in 0.45 s, infinite. Auf `#skelett_3.skelett-lacht` angewendet — überlagert die SMIL-Schaukel im Asset (CSS-Transform schlägt SVG-`transform`-Attribut). `style="transform-box:fill-box;transform-origin:50% 100%"` auf dem `<image>` setzt den Drehpunkt auf Bottom-Center → Skelett wackelt um die Füsse, statt um die Bbox-Mitte. `skelettLachen()` JS: Klasse hinzufügen, `setTimeout(2000)` entfernt sie wieder.

### Chain 6 — Vier Formel-Erkennungs-Aufgaben → 3 Schlüsselteile + Leim → vereinter Schlüssel

Sammel-Chain mit eigenem **linkem Inventar** (`#inventar-links`, oben links). Items darin sind NICHT interaktiv (kein Drag, Klick zeigt nur einen Hinweis-Overlay) — sie sind Sammelstücke. Sobald alle 4 zusammen sind, verschmelzen sie zu einem `vereinter_schluessel` im rechten Inventar.

Liefert den **vereinten Schlüssel** — der wird in einer späteren Chain (Chain 7, Schatztruhe im Garten) zusammen mit Schaufel (Chain 4) und Pickel (Chain 5) verwendet.

**Vorbedingung:** alle 4 Klick-Stellen verlangen `formelbuch_gefunden=true` (analog Chains 1–5). Klick davor fällt durch zur Boden-Logik, ohne Hinweis.

**Reihenfolge der 4 Pickups: egal.** Jeder Pickup ist eine eigenständige MC-Aufgabe (Multiple-Choice der richtigen Kreis-Formel — kein Rechnen, nur Formel-Erkennung).

| Pickup-Stelle | Aufgabe | Korrekte Antwort | Item ins linke Inventar |
|---|---|---|---|
| `chain_6_animal_1` (Keller, animal_1 an hinterer Wand, Polygon (474,215)..(614,390), laufziel fu=0.30 fv=0.55) | `chain_6_sektor` — Kreissektorfläche | A = (α/360°)·π·r² | `schluesselteil_1` (Reide) |
| `chain_6_buecher` (Büro, oberstes Regal-Tablar links in bookshelf_2, Polygon (640,188)..(745,260), laufziel fu=0.42 fv=0.65) | `chain_6_bogen` — Bogenlänge | b = (α/360°)·2π·r | `schluesselteil_2` (Schaft) |
| `chain_6_tulpe` (Hauptraum, plant_tulpe vorne-links, Polygon (20,720)..(175,880), laufziel fu=0.13 fv=0.04) | `chain_6_umfang` — Umfang | U = 2π·r | `schluesselteil_3` (Bart) |
| `chain_6_schublade` (Badezimmer, mittlere Schublade von desk_4, Polygon (1245,645)..(1423,720), laufziel fu=0.86 fv=0.10) | `chain_6_flaeche` — Kreisfläche | A = π·r² | `leim` |

**Visuelles Feedback an der Quelle:** keines — die Pickup-Stellen bleiben optisch unverändert (animal_1, Bücher, Tulpe, Schublade behalten ihr Aussehen). Nur das Polygon wird durch `aktiv: !linkesInventar.has(...)` deaktiviert (Cursor zurück auf default, Klick fällt durch).

**Combine-Animation** (`kombiniereSchluessel` in script.js):
1. Beim 4ten erfolgreich gelösten Pickup ruft die Aufgabe `sammleSchluesselteil(id)` → `linkesInventar.add(id)` → `aktualisiereLinkesInventar()`. Bei Set-Size 4 → `setTimeout(kombiniereSchluessel, 3300)` (Delay = Auto-Close des Belohnungs-Overlays + 300 ms Puffer).
2. `kombiniereSchluessel()` setzt CSS-Klasse `.kombiniert` auf alle 4 Slots → 1.5-s-Keyframe-Animation `sammlung-kombi` (gold-grünes Glow + Scale-Pulse + Fade-out auf Opacity 0.4).
3. Nach 1.5 s: `linkesInventar.clear()`, `gegenstaende.add("vereinter_schluessel")`, beide Inventare aktualisieren, Story-Overlay "The three key fragments and the glue fuse into one complete key" (Auto-Close 3.5 s).

**Linkes Inventar UI** (`#inventar-links` in index.html, CSS in style.css):
- Position absolut oben links auf `#game-stage` (Spiegelung von `#inventar` rechts).
- Visuell gedämpfter: `border: 1px dashed`, `opacity: 0.85`, `cursor: help` (statt `grab`). Signalisiert "nicht interaktiv".
- Klick auf Slot → `pointerdown` mit `e.preventDefault()` → `zeigeOverlayText("Collection items on the left can't be used for interactions — only inventory items on the right can.")` (Auto-Close 3.5 s). Kein Drag-Start.
- Initial `hidden` (display:none), wird sichtbar sobald das erste Teil gesammelt ist.

**Sammelteil-Icons** in eigenem Map `LINKES_INVENTAR` (script.js, parallel zu `GEGENSTAENDE`):
- `schluesselteil_1` (Reide): ovaler Kopf mit Loch + kurzer Schaftansatz + Bruchkante unten (zackig).
- `schluesselteil_2` (Mittelstück): zylindrischer Stab + Bruchkanten oben + unten.
- `schluesselteil_3` (Bart): Schaft + 2 Zähne + Bruchkante oben.
- `leim`: Tube mit grauem Cap + gelber Körper + weisses "GLUE"-Label + Crimp-Naht unten.
- `vereinter_schluessel` (im normalen GEGENSTAENDE-Map): kompletter goldener Schlüssel — visuell deutlich grösser/auffälliger als `schluessel_buero` (ovale Reide rx=8 ry=7, viewBox füllend statt links sitzend).

**Spielstand-State:** nur `spielstand.linkesInventar: new Set()` neu — kein eigener `chain_6_step`-Counter, da Set-Size genügt. Reihenfolge zwischen Chains völlig unabhängig (keine Cross-Chain-Locks). Aufgaben-Set `geloesteAufgaben` markiert die 4 MC-Aufgaben nach erfolgreichem Lösen — bei einem etwaigen Re-Klick (sollte nicht passieren wegen `aktiv`-Predikat) zeigt das Overlay "You've already solved this task".

### Chain 7 — Schaufel + Pickel + vereinter Schlüssel → Grab in Gartenmitte → Truhe öffnen → Sieg

Finale Chain. Setzt **alle drei Endgame-Items** voraus: `schaufel` (Chain 4), `pickel` (Chain 5), `vereinter_schluessel` (Chain 6). Reihenfolge der Tools beim Drop egal.

| Step | Trigger | Effekt |
|---|---|---|
| 1 | Drag `schaufel` ODER `pickel` auf `gartenmitte_grab` (Polygon (560..1040, 660..800), aktiv wenn formelbuch + (Schaufel ‖ Pickel im Inv) + !chain_7_loch_offen) | Werkzeug verbraucht, `chain_7_schaufel_gedroppt` bzw. `chain_7_pickel_gedroppt = true`. Hinweis-Overlay „You start breaking up the soil — but you also need a {pickaxe\|trowel}." |
| 2 | Drag das andere Werkzeug auf gartenmitte_grab | Beide Flags true → `chain_7_loch_offen=true`, **`HINDERNISSE.garten.push(CHAIN_7_HINDERNIS)`** (Boden-Polygon fu 0.42..0.58, fv 0.45..0.65), `aktualisiereChain7()` zeigt `chain_7_grab` (Loch + Truhe). Story-Overlay „You break through the soil and uncover a wooden chest in the hole." |
| 3 | Drag `vereinter_schluessel` auf `chest_1` (Polygon (660..940, 670..800), aktiv wenn loch_offen + Schlüssel im Inv + !geoeffnet) | Schlüssel verbraucht, `chain_7_geoeffnet=true`, `dragAbbrechen()` (Sicherheits-Cleanup), **`zeigeSiegOverlay()`** öffnet das Vollbild-Endscreen-Overlay. |

**`chain_7_grab` (DOM):** `<g id="chain_7_grab" class="sanitar-aus" data-y-fuss="786">` enthält Erdwall-Polygon, Loch-Öffnung (perspektivisches Trapez auf Boden — Eckpunkte aus `bodenPunkt(fu, fv)` für fu 0.34..0.66, fv 0.38..0.72 → ~440 px breit vorne, ~374 px hinten), Tiefen-Indikator (kleines, fast schwarzes Trapez nach hinten versetzt), zwei Erdklumpen, Truhen-`<image href="assets/chest_1.svg">` 200×89. Initial via Klasse `sanitar-aus` versteckt; `aktualisiereChain7` togglet sie. Wird via `data-y-fuss` in den Front-Layer geklont (Tiefensortierung).

**`CHAIN_7_HINDERNIS`:** dynamisch beim Loch-Öffnen in `HINDERNISSE.garten` gepushed — verhindert, dass die Figur ins Loch laufen kann. Modul-State `chain_7_hindernis_aktiv` (let-Variable) verhindert Doppel-Push. Wird beim Reload (Module-Init) automatisch zurückgesetzt.

### Sieg-Overlay (Chain 7 Endscreen)

Eigenes Vollbild-Overlay `#sieg-overlay` (z-index 20, über dem Aufgaben-`#overlay` z-index 10), wird via `zeigeSiegOverlay()` geöffnet. Backdrop-Klick + Esc bewusst NICHT schliessbar — Spieler muss explizit wählen.

**Inhalt:**
- **Feuerwerk-Layer** (`#sieg-fireworks`): 6 Bursts an verschiedenen Positionen (gold/rot/türkis/grün/pink/gelb), jeder mit 12 Partikeln à 30°, gestaffelte Delays. CSS-Keyframe-Animation `firework-burst` 1.6 s endlos. Pro Aufruf neu via `spawneFireworks()` befüllt.
- **Schatz-SVG** (`#sieg-treasure`, viewBox 0 0 400 260): Münzhaufen (gestaffelte gold-Ellipsen + Einzelmünzen, randlos) + Krone (Trapez-Ring + 5 schmale Zacken (Basis je 14 px, central tallest), 5 Edelsteine an den Spitzen, zentraler Saphir, alle randlos). CSS-Animationen: `krone-pulse` (sanftes Atem-Pulse 2.4 s), `sparkle-twinkle` (4 Funkelsterne, gestaffelt).
- **Headline** „You found the treasure!"
- **2 Buttons:** „Play again" → `siegPlayAgain()` (`location.reload()`) · „End game" → `siegEndGame()` (Box-Inhalt durch „Thanks for playing!" ersetzt).

**Side-Effects beim Öffnen:** Inventare (rechts + links) werden auf `hidden=true` gesetzt, damit Inventory-Slots nicht neben der Krone stehen.

### Bridge — Octopus weg → toilet_1 → Binoculars → Nachtsicht → Geheimtür → Keller

| Step | Trigger | Effekt |
|---|---|---|
| 1 | Octopus weg (Chain 2 + 3 abgeschlossen, `octopus_da===false`) → Klick auf toilet_1_1 | toilet_1 togglet auf 2 (Sitz oben). |
| 2 | `aktualisiereChain3()` zeigt `binoculars_1_visual` (`!octopus_da && toilette_1===2 && !binoculars_genommen`) | Binoculars-SVG wird sichtbar in der toilet_1-Schüssel (DOM-VOR toilet_1-OBJEKT, sonst würde dessen Polygon die Klicks abfangen). |
| 3 | Klick auf Binoculars → `nimmAufGegenstand("binoculars_1")` | `gegenstaende += "binoculars_1"`, `binoculars_genommen=true`, **`aktiviereNachtsicht()`** (Body-Klasse `nachtsicht` → SVG-Filter `url(#nachtsicht)` auf die drei statischen Render-Layer, siehe Nachtsicht). |
| 4 | Wechsel in Hauptraum, Klick auf Geheimtür-Bereich an rechter Wand | findeTuerBei filtert die Geheimtür raus, wenn `!keller_freigeschaltet && !binoculars_1`. Mit Binoculars: Tür wird zurückgegeben, Phosphor-Outline (`#5fff8a` Stroke + Glow) im zeichneTueren-Sonderfall. Klick mit Code im Inventar → kein Overlay (Spieler droppt direkt); Klick OHNE Code → Hinweis „You need to find a code first." |
| 5 | Drag `code_geheimtuer` auf Geheimtür-Polygon → `tueren.geheim.akzeptiert.code_geheimtuer` | `verbrauche("binoculars_1")`, `verbrauche("code_geheimtuer")`, `delete inventar.keller_code`, `keller_freigeschaltet=true`, **`deaktiviereNachtsicht()`**. Geheimtür wird ab jetzt in `FARBEN.tuerGeheimOffen` (b80, dunkler als Wand b70) gerendert — permanenter visueller Akzent. Klick → starteRaumwechsel("keller"). |

**Klick auf Geheimtür mit Binoculars, ohne Code:** Hinweis „You need to find a code first." (Spieler muss Chain 1 abschliessen, um den Code-Tag zu bekommen). **Mit Code im Inventar:** kein Overlay — die Klick-Reaktion verbietet sich, weil der Spieler den Code per Drag-and-Drop auf die Tür ziehen soll und die Story-Botschaft schon beim ersten Klick gezeigt wurde.

**Geheimtür ohne Binoculars + nicht freigeschaltet:** `findeTuerBei` filtert komplett raus → Klick fällt zur Boden-Logik durch (wie ganz normale Wand, kein Hinweis-Overlay).

## Start-Overlay (Begrüssungsbildschirm)

Eigenes Vollbild-Overlay `#start-overlay` (z-index 20, parallel zum Sieg-Overlay), wird beim Page-Load gezeigt BEVOR der User ins Spiel kommt. Story-Setup für die Tante-Mathematikerin + Schatz-Story, plus Continue/Start-over (mit Save) bzw. Begin-adventure (ohne Save). Backdrop + Esc bewusst NICHT klick-schliessbar.

**Inhalt:**
- **Floater-Layer** (`#start-floaters`): 130 zufällig schwebende Kreise in unterschiedlichen Grössen (24–224 px Durchmesser, biased zu kleineren via Math.random²) und Farben (10er-Palette: Bürobild yellow/red/violet + treasure gold + cyan/orange/mint/pink/soft-violet/peach). Opazität 0.30–0.75 zufällig (Tiefen-Effekt). 3 CSS-Drift-Keyframes, Animation-Duration 8–18 s + Delay 0–4 s pro Kreis zufällig (entkorreliertes Schweben). KEINE Ränder. Per `spawneStartFloater()` bei jedem Aufruf neu erzeugt → bei jedem Page-Load anderes Pattern.
- **Story-Box** (`#start-box`): warme cream-Farbe mit gold-Akzentrahmen, max-width 560 px.
  - **Haus-SVG** (`#start-house`, viewBox 0 0 320 200): Cartoon-Haus mit Dach/Schornstein/Tür/Fenstern + 3 farbige pulsierende Kreise (yellow/red/violet — Bürobild-Motiv) + 2 funkelnde Sterne. CSS-Animationen `start-circle-pulse` 3.2 s + `sparkle-twinkle` (recyclet aus Sieg-Overlay).
  - **Headline** „Full Circle"
  - **Story** (3 Sätze, EN): „Your great-aunt, an eccentric mathematician, has left you her old house. Her will hints at a hidden treasure — but she was obsessed with circles and locked everything behind formulas. Solve her puzzles to find what she left behind."
  - **Buttons** (dynamisch via JS in `zeigeStartScreen()`):
    - Save vorhanden: **„Continue"** (gold, primär) + **„Start over"** (grau, sekundär).
    - Kein Save: nur **„Begin adventure"** (gold).

**Show-Logik:** `zeigeStartScreen()` wird im Auto-Start AUFGERUFEN (nach `loop()`-Start, Overlay deckt die laufende Stage ab). Klick auf Button → `verstecksStartScreen()` → 250 ms fade-out → `hidden=true`. `ensureAudio()` wird beim Klick gerufen (User-Geste → audioCtx aktiviert).

**„Start over"-Two-Click-Confirm:** Erster Klick → Button wird rot + Text „Are you sure?", zweiter Klick (innerhalb 3 s) löscht den Save und reloaded. Innerhalb-Timer-Reset → wenn 3 s lang nicht erneut geklickt, geht der Button zurück auf „Start over"/grau. Schützt vor versehentlichem Reset durch Schüler:innen.

**Skip-Flag (sessionStorage):** Beim „Start over"-Confirm wird zusätzlich `sessionStorage["spiel_kreise_1_skip_start"]="1"` gesetzt, BEVOR `location.reload()` läuft. Beim nächsten Page-Load erkennt `zeigeStartScreen()` das Flag, löscht es (1× gültig) und kehrt sofort zurück → Spiel ist direkt sichtbar, OHNE dass der User wieder durch den Begrüssungsbildschirm muss. Audio-Context unlocked sich beim ersten In-Game-Klick (pointerdown auf #game-canvas → `ensureAudio()`).

## Cursor-Feedback (Browser-Klickhand)

Statt eigener Tutorial-Hand-Grafiken steuert das Spiel den nativen Browser-Cursor (`pointer` für Hand-Icon, `default` sonst). Wert: bei interaktiven Stellen wie der Wolke ist die Hand nur sichtbar, wenn die Aktion **gerade sinnvoll** ist; abgeschlossene oder noch nicht zugängliche Stellen zeigen den Default-Cursor.

**Mechanik:** `pointermove` auf `#game-canvas` ruft `findeObjektBei(x, y)` (filtert über `objektIstAktiv`) und `findeTuerBei(x, y)`. Trifft eines, wird `cursor = "pointer"` gesetzt. → `aktiv`-Predikat eines Objekts ist die zentrale Stellschraube für den Cursor.

**Konvention für `aktiv`-Predikate** an "Tutorial-relevanten" Stellen: Cursor:pointer NUR, wenn `formelbuch_gefunden=true` UND die nächste sinnvolle Aktion am Objekt machbar ist (Drop-Item im Inventar, Vorzustand erfüllt). Beispiele:

| Objekt | `aktiv`-Bedingung |
|---|---|
| `cake_1_klick` (haupt) | `formelbuch_gefunden` |
| `cupboard_1_drop` (buero) | `formelbuch_gefunden && !cupboard_1_offen` |
| `cupboard_1_zettel` (buero) | `cupboard_1_offen && !zettel-im-Inv` (impliziert formelbuch) |
| `tischlampe_lichtkegel` (buero) | `formelbuch_gefunden && zettel-im-Inv` |
| `animal_3_1` (badezimmer) | `formelbuch_gefunden && chain_2_step === 0` |
| `binoculars_1` (badezimmer) | `!octopus_da && toilette_1 === 2 && !binoculars_genommen` |
| `toilet_1` (badezimmer) | `formelbuch_gefunden && !octopus_da` |
| `toilet_2` (badezimmer) | `formelbuch_gefunden` |
| `bathtub` (badezimmer) | `formelbuch_gefunden && animal_3_2-im-Inv` |
| `octopus` (badezimmer) | `formelbuch_gefunden && octopus_da && (animal_3_3-im-Inv \|\| goldene_muenzen-im-Inv)` |
| `wolke_zentral` (garten) | `formelbuch_gefunden && !vogel_da && !wolke_zentral_weg` |
| `bird_1` (garten) | `vogel_da` |
| `gartenschlauch` (garten) | `formelbuch_gefunden && !schlauch_genommen` |
| `flower_1_drop` (garten) | `formelbuch_gefunden && gartenschlauch-im-Inv && !flower_1_gegossen` |
| `bild_kreis_yellow/red/violet_klick` (buero) | `formelbuch_gefunden && !bild_kreise_geloest && !bild_kreise_replay_aktiv` |
| `painting_2` (keller) | `drei_kreise-im-Inv && !bild_kreise_im_keller` |
| `chain_6_animal_1` (keller) | `formelbuch_gefunden && !linkesInventar.has("schluesselteil_1")` |
| `chain_6_buecher` (buero) | `formelbuch_gefunden && !linkesInventar.has("schluesselteil_2")` |
| `chain_6_tulpe` (haupt) | `formelbuch_gefunden && !linkesInventar.has("schluesselteil_3")` |
| `chain_6_schublade` (badezimmer) | `formelbuch_gefunden && !linkesInventar.has("leim")` |

**Wichtig zu Drop-Targets mit "Item-im-Inventar"-Bedingung:** Während eines Drag bleibt das Item im `spielstand.gegenstaende`-Set (delete erst durch `verbrauche()` im Drop-Callback). Daher greift das Predikat sowohl beim Hover (Cursor) als auch beim Drop (`versucheDrop` filtert via `objektIstAktiv`). Nach dem Drop wird das Item entfernt und das Objekt automatisch inaktiv.

**Toilette-Sonderfall** `toilet_2.aktion`: Sitz-Toggle erst nach Formelbuch-Fund (kombiniert mit `aktiv: formelbuch_gefunden` doppelt abgesichert). Drop von animal_3_1 läuft separat über `akzeptiert` und braucht zusätzlich `toilette_2 === 2 && !toilette_2_voll`.

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
            inventar:       { ergebnis_id: 31.4 },       // optional → spielstand.inventar
            belohnung_text: "Richtig! ...",              // optional
        },
    },
};
```

`zeigeAufgabe(id)` baut Aufgaben-UI ins `#overlay-inhalt` (KaTeX-Formel via CDN, Input, Prüfen-Button, Feedback). `pruefeAntwort()` vergleicht per Toleranz (Komma → Punkt normalisiert). Bei Erfolg: `geloesteAufgaben.add()`, Schlüssel/Inventar aus `bei_richtig`, Input + Button deaktivieren.

`zeigeOverlayText(text)` für einfachen Info-Text (z.B. „Tür verschlossen."). Schliessen via ×-Button, Klick auf dunklen Hintergrund oder `Esc`.

**13 Aufgaben aktuell definiert** (10× MC, 3× Zahleneingabe):
- **Chain 1**: `chain_1_kuchen` (MC, U+A bei d=20 cm) · `chain_1_schloss` (MC, 90° → π/2 rad — wird beim schluessel_buero-Drop auf cupboard_1 geöffnet, bei richtig öffnet sich der Schrank) · `chain_1_pi` (MC, π-Annäherung 355/113)
- **Chain 2**: `chain_2_octopus` (Zahleneingabe, C=2π·100 cm → A=31400 cm²)
- **Chain 3**: `chain_3_schlauch` (MC, 5 Windungen → L=25 m) · `chain_3_pizza` (Zahleneingabe, A=1 m²)
- **Chain 4**: `chain_4_teppich` (MC, äußerste Ringfläche bei U=6,28 m, d=10 cm → 5966 cm²)
- **Chain 5**: `chain_5_kreise` (MC, 2π·r²=π·R² → R = r·√2)
- **Chain 6**: `chain_6_sektor` / `chain_6_bogen` / `chain_6_umfang` / `chain_6_flaeche` (4× MC, reine Formel-Erkennung — kein Rechnen)
- **Bonus** (Chain-frei): `bonus_sonne` (MC, Sonnen-Umfang U=4 370 880 km bei r=696 000 km, π=3.14) — Klick auf die Sonne im Garten, nicht spielentscheidend. Belohnungstext „Correct! But this doesn't help you in the game — you solved this just for fun 😊". Hat **`geloest_text`-Override** „You have just solved this for fun 😊" für Wieder-Klick (statt Standard-Text).

**MC-Zufalls-Reihenfolge:** `baueMultipleChoice()` macht bei jedem Render einen Fisher–Yates-Shuffle einer flachen Kopie von `a.optionen`. Klick-Handler bekommt das Option-Objekt direkt (nicht Index), damit die Korrektheits-Prüfung unabhängig von der Render-Reihenfolge funktioniert. Original-`AUFGABEN[id].optionen` bleibt unverändert.

**Per-Aufgabe `geloest_text`-Override:** Optional kann eine Aufgabe `geloest_text: "..."` definieren — dieser Text wird statt des Standard-„You've already solved this task." gezeigt, wenn die Aufgabe schon gelöst ist. Aktuell genutzt von `bonus_sonne`.

**Auto-Close global 4 s:** `automatischSchliessen` Default-Argument ist 4000 ms; alle Call-Sites verwenden ebenfalls 4000 ms (vorher gemischt 2500–3500). Auto-Close in `gewaehrenBelohnung` ebenfalls 4000.

## Inventar + Drag & Drop

```js
const GEGENSTAENDE = {
    // gegenstand_id: { name: "Anzeigename", icon: `<svg viewBox="0 0 48 48">…</svg>` },
};
```

Inventar-Zustand: `spielstand.gegenstaende` (Set von IDs). Rendert in `#inventar` (Panel rechts oben), hidden wenn leer.

Objekte in `OBJEKTE[raumId]` bekommen optional:
- `aufnehmen: "gegenstand_id"` — Klick → Figur läuft zum `laufziel` → `nimmAufGegenstand()` fügt ins Inventar, markiert `obj.aufgenommen = true`.
- `akzeptiert: { gegenstand_id: (s, id) => {...} }` — Drop-Target. Callback entscheidet, ob der Gegenstand verbraucht wird (`verbrauche(id)`).
- `zeichnen: (ctx) => {...}` — Canvas-Rendering (wenn das Objekt keinen SVG-Anteil hat).

Türen können auch `akzeptiert` haben (z.B. Schlüssel auf Schloss).

**Drag & Drop** ist Pointer-basiert (kein HTML5-DnD), damit Touch und Canvas-Drop funktionieren:
- `pointerdown` auf Inventar-Slot → `starteDrag()` versucht `setPointerCapture`, hängt aber pointermove/pointerup/pointercancel **am `document`** (nicht am Slot — siehe Stolperstein "Drag-Stuck-Bug")
- `#drag-preview` (position: fixed) folgt der Maus
- `pointerup` → `versucheDrop(clientX, clientY, id)` prüft, ob ein Objekt oder eine Tür unter der Maus `akzeptiert[id]` hat → Figur läuft hin → Callback
- **Recovery:** `dragAbbrechen()` (auch in der Konsole) räumt einen hängenden Drag-Zustand auf — wird aufgerufen via Esc-Taste, beim Raumwechsel (`wechsleRaum`) und beim Start eines neuen Drags. Idempotent.

## Laufen + Raumwechsel-Fade

**Laufen vor Interaktion:** Klick auf Tür/Objekt startet NICHT sofort die Aktion. Stattdessen läuft die Figur zum `laufziel`. `figur.ankunft` ist ein einmaliger Callback, der beim Ankommen ausgelöst wird:

```js
figur.ankunft = () => starteRaumwechsel("buero");        // bei Tür-Klick
figur.ankunft = () => zeigeAufgabe("aufgabe_id");        // bei Objekt-Klick
figur.ankunft = () => nimmAufGegenstand(obj);            // bei Aufnehm-Objekt
```

Klick auf Boden, `wechsleRaum`, oder Stop wegen Hindernis verwirft `ankunft`.

**Fade-Transition:** `starteRaumwechsel(zielId)` blendet `#fade`-Div schwarz ein (220 ms), ruft `wechsleRaum`, blendet aus. `wechselInGang`-Flag blockt Klicks während der Transition.

## Sound (Web Audio, keine Dateien)

Schrittsounds live via Web Audio API: weisser Noise-Burst durch Tiefpassfilter zum dumpfen „Thud". Vier Varianten in `SCHRITT_VARIANTEN` (220–310 Hz, 80–100 ms) round-robin + ±3 % Frequenz-Jitter pro Schritt.

`audioCtx` wird beim ersten `pointerdown` via `ensureAudio()` initialisiert (Safari/Chrome starten oft `suspended` → `audioCtx.resume()`). `spieleSchritt()` feuert in `aktualisiereFigur`, wenn die Gehphase π oder 2π überquert.

`spieleSpuelung()` (Chain 2): 1.6 s gefiltertes Rauschen mit Tiefpass-Sweep 1200 Hz → 250 Hz und Hüllkurve (Attack 0.1 s, Sustain 0.6 s, Decay zum Ende). Spielt beim Klick auf eine `voll`-Toilette.

`spieleBurp()` (Chain 4): kurzer 0.55 s Rauschen mit Tiefpass-Sweep 320 Hz → 80 Hz, Q=6 (resonant), schnelle Pulse-Hüllkurve. Klingt nach Rülpsen — spielt nach Muffin-Drop auf duck_1_keller.

`spieleTon(freq, dauer=0.4)` (Chain 5): reiner Sinuston mit weicher Hüllkurve (Attack 0.02 s → Sustain → Release 0.13 s, Peak gain 0.25). Wird für die 3 farbigen Bürobild-Kreise genutzt: yellow=C4 (261.63 Hz), red=E4 (329.63 Hz), violet=G4 (392.00 Hz) — Dur-Akkord, harmonisch.

Konsolen-Helfer: `soundAnAus(true|false)`, `soundTest()`, `spieleSpuelung()`, `spieleBurp()`, `spieleTon(freq)`.

**Sound-/Musik-Toggle** im Settings-Menü (Zahnrad unten rechts) togglet `soundAn` (alle SFX) bzw. `musikAn` (Stub). Beide werden in `localStorage` unter `SETTINGS_KEY` persistiert (separat vom Spielstand → Reset löscht Sound-Vorlieben NICHT). `musikAn` ist aktuell ein **Platzhalter** ohne Implementierung — siehe Persistenz-Sektion.

## Input / Loop

```
Seitenladen → ladeVorgang=true (Modul-Top-Level) → ... → aktualisiereLinkesInventar() (initial leer)
              → requestAnimationFrame:
                  ladeEinstellungen()        ← Sound/Musik aus SETTINGS_KEY
                  ladeSpielstand()           ← Spielstand aus STORAGE_KEY (oder false bei leerem/altem Save)
                  baueRaumDeko()             ← DOM aufbauen + klonePflanzenVorne()
                  aktualisiereAllesNachLaden() (wenn geladen) ODER aktualisiereSanitaer/Cupboard1/Chain5 (wenn frisch)
                  ladeVorgang=false
                  speicherSpielstand()       ← finalen Post-Load-Stand persistieren
                  resizeCanvas()
                  loop()
loop(): aktualisiereFigur() → draw() → requestAnimationFrame(loop)
canvas.pointerdown:
    → Tür-Polygone? → figur läuft hin → ankunft = starteRaumwechsel()
    → OBJEKTE? → figur läuft hin → ankunft = zeigeAufgabe() oder nimmAufGegenstand()
    → sonst: screenZuBoden → setzeFigurZiel() (mit Clamp + Snap aus Hindernissen)
window.resize → resizeCanvas()
```

**Wichtig:** `baueRaumDeko()` läuft VOR `resizeCanvas()`. `ladeSpielstand()` läuft VOR `baueRaumDeko()`, damit `klonePflanzenVorne()` schon den geladenen `aktuellerRaum` kennt und die Front-Layer-Sichtbarkeit korrekt setzt.

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

## Touch-/Tablet-Tauglichkeit

Spiel ist auf Tablets (iPad/Android-Tablets) genauso spielbar wie auf Desktop-Browser. Konkrete Massnahmen:

- **Pointer-Events** durchgängig (kein `mousedown`/`mousemove`/`mouseup` oder HTML5-DnD) — Touch + Maus laufen über denselben Code-Pfad. `e.button !== 0`-Filter ist touch-kompatibel (Touch fired button=0).
- **`touch-action: none`** auf body, `#game-canvas` und `.inventar-slot` → kein Pinch-Zoom, kein Scroll, kein Browser-Wisch während Drag oder Spiel-Klick.
- **Drag-Listener am `document`** (nicht am Slot) → `setPointerCapture` überlebt Slot-Rerender via `aktualisiereInventar()`. Pointer-ID wird in `dragZustand` gespeichert; nur Events mit dieser ID werden akzeptiert (Multi-Touch-sicher).
- **`-webkit-tap-highlight-color: transparent`** global → kein blauer Flash beim Tap auf iOS Safari (eigene `:active`-Styles geben das visuelle Feedback).
- **`user-select: none` + `-webkit-user-select: none` + `-webkit-touch-callout: none`** auf body → kein Text-Selektieren oder iOS-Long-Press-Menü, das den Drag-Start aus dem Inventar stört. `.aufgabe-input`/`input`/`textarea` heben das auf, damit Aufgaben-Eingaben editierbar bleiben.
- **Touch-Targets ≥ 44×44 px** (Apple-Empfehlung): `#overlay-close` (X-Schliessen) und `#reset-button` (Settings-Zahnrad) auf 44×44 vergrössert (vorher 32 bzw. 36). MC-Optionen sind ~39 px hoch, aber full-width gestapelt → Treffsicherheit hoch.
- **Input-Font-Size ≥ 16 px** (`.aufgabe-input` mit 1.1 rem ≈ 17.6 px) → kein iOS-Auto-Zoom auf Focus.
- **`dblclick` und `contextmenu`** sind nur im `HINDERNIS_DEBUG`-Modus aktiv (Spline-Vertex-Insert + Vertex/Handle-Löschen) — End-User auf Tablets ist davon nicht betroffen.
- **Viewport-Meta** korrekt: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
- **16:9-Inscription** in `resizeCanvas`: nimmt das grösste 16:9-Rechteck im Viewport. In Portrait-Orientierung wird die Stage entsprechend kleiner — funktional, aber Landscape ist optimal. Kein Orientierungs-Hinweis nötig (Schüler:innen rotieren intuitiv).

## Stolpersteine

- **Cache-Busting:** bei Änderungen an `script.js`, `style.css` oder einem `<image href>`-Asset das `?v=N` hochzählen, sonst hängt der Browser im alten Cache.
- **Drag-Stuck-Bug (Inventar):** Wenn pointermove/up/cancel am Slot-Element hängen, kann der Drag-Zustand „einfrieren" — das Drag-Preview-Icon klebt am Cursor und bleibt sogar über Raumwechsel hinweg sichtbar. Ursache: `setPointerCapture` verliert die Bindung, wenn der Slot-DOM während des Drags neu gerendert wird (`aktualisiereInventar()`) oder der Pointer den Viewport verlässt — pointerup wird dann nirgends mehr empfangen. **Lösung:** Listener am `document` statt am Slot anhängen + zentrale `dragAbbrechen()`-Funktion, die in `wechsleRaum`, beim Esc-Drücken und beim Start eines neuen Drags aufgerufen wird. `dragAbbrechen()` ist auch in der Konsole als Notfall-Reset verfügbar.
- **`baueGartenDeko()` darf NICHT `innerHTML = ""` machen** — sonst werden statische Garten-Deko-Elemente (Blumen) bei jedem Aufruf gelöscht. Die Funktion entfernt nur `[data-generated="strauch"]`-Elemente.
- **Möbel-Position ändern:** `HINDERNISSE` (Kollision) UND `data-y-fuss` (Tiefensortierung) UND Transform/x/y (Rendering) müssen synchron bleiben. Hindernisse am besten interaktiv mit Drag-Editor justieren.
- **DOM-Reihenfolge zwischen Möbeln:** Tiefensortierung via `data-y-fuss` regelt nur **vor/hinter Figur**, NICHT zwischen Möbeln in derselben Ebene. Innerhalb einer Ebene gilt DOM-Reihenfolge — späteres Element überdeckt früheres. Beispiel: desk_4 DOM-zuletzt im Badezimmer, überdeckt damit Octopus + Toiletten. Ähnlich: Tisch1 + Lavalampe DOM-vor `<g id="plants">`.
- **`<image href>` vs. Inline-SVG:** `<image href>` ist eine Black Box (kein per-Pfad-Zugriff, eigener ID-Scope). Inline-SVG nötig, wenn man einzelne Pfade adressieren muss (Recolor, ID umbenennen, Pfad entfernen).
- **Detail-Büsche per `drawImage`** statt `<image href>` — damit der Zaun sie verdecken kann.
- **„Hinter Canvas-Element"-Migrationspattern (SVG → Canvas):** Architektur-bedingt liegt das SVG-`<g data-raum>` IMMER VOR dem `<canvas>` in der Stack-Reihenfolge. Wenn ein Element visuell HINTER ein Canvas-Element soll (z.B. flower_4 hinter bush_4, flower_6 hinter bush_1), muss es ebenfalls auf den Canvas wandern. Vorgehen: 1) Inline-SVG-Inhalt aus index.html ausschneiden, 2) als standalone-SVG-Datei speichern (mit eigenem viewBox, ohne x/y), 3) als BUESCHE-Eintrag (`{ src, cx, baseY, breite, hoehe }`) hinzufügen, 4) in `zeichneGartenZaun()` an passender Stelle vor dem überdeckenden Canvas-Element via `zeichneBuschBild` rendern. Konsequenz: keine `data-y-fuss`-Tiefensortierung mehr (Canvas-Elemente sind immer hinter Figur). User-Customizations (geänderte Farben, gespiegelte Wrapper) müssen mitübernommen werden.
- **SVG-Filter `filter="url(#name)"`** statt CSS-Filter — robuster (#grell, #grell-mild, #invert).
- **Body-CSS:** `position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none` — verhindert Scroll/Verschieben.
- **Switch-Partner exakte Position:** `toilet_1_1/1_2`, `toilet_2_1/2_2` müssen deckungsgleich liegen — sonst „springt" das Objekt beim Umschalten. toilet_1_2 / toilet_2_2 brauchen einen `<g transform="translate(37 -9)">`-Wrapper, weil die Pfade im Asset-viewBox verschoben sind. (`bathtub_1_1/_1_2` waren früher auch ein Switch-Paar; sind jetzt ein Layer-Paar — siehe Badezimmer-Sektion.)
- **Sanitär-Klone-IDs in `aktualisiereSanitaer`:** Die Sanitär-SVGs haben `data-y-fuss="670"` und werden von `klonePflanzenVorne()` in die Front-Ebene geklont. Beim Klonen werden alle IDs mit `v_<idx>_` prefixed (gegen Gradient-Konflikte). Konsequenz: ein naiver Selektor `[id="toilet_1_1"]` matcht nur das Original, NICHT den Klon `v_5_toilet_1_1`. Ohne Klon-Match haben die Front-Layer-Klone NIE die `sanitar-aus`-Klasse → sobald die Figur näher als der Toiletten-Foot kommt und der Tiefen-Toggle die Klone sichtbar macht, sind alle 4 Klon-Switch-Partner gleichzeitig sichtbar (toilet_X_2 überdeckt toilet_X_1 dank DOM-Reihenfolge → User sieht „beide WCs gespült", State unverändert). Selektor muss daher Original UND Klon abdecken: `[id="X"], [id^="v_"][id$="_X"]`.
- **Klick-Polygon vs. Möbel-Bbox-Überlapp:** Die Klick-Polygone von `OBJEKTE` werden NICHT durch Hindernisse blockiert — ein Klick auf ein Möbel ohne eigenes Klick-Objekt fällt durch zur Boden-Logik, ABER trifft trotzdem überlappende Klick-Polygone anderer Objekte. Beispiel: ursprünglich waren toilet_1/toilet_2 die volle SVG-Bbox (200×250 px) und überlappten mit cupboard_2 (x=750..1100); ein Klick auf den Schrank togglte ungewollt eine Toilette. Lösung: Klick-Polygone enger ziehen, sodass sie nicht mit Nachbar-Möbeln überlappen.
- **Gradient-Defs in geklonten Inline-SVGs:** Wenn ein `<svg>` mit eigener `<defs>` ein `data-y-fuss` hat und in die Front-Ebene geklont wird, entstehen ID-Duplikate. Paint-server-Lookup nimmt den ersten DOM-Treffer — wenn dessen Parent `display:none` ist, rendern Pfade unsichtbar (so verschwanden früher die desk_1-Beine). **Aktueller Workaround:** `klonePflanzenVorne()` prefixed seit script.js v134 alle IDs im Klon mit `v_<idx>_` und schreibt alle internen `url(#…)`-/`xlink:href="#…"`-Refs entsprechend um → beide Layer haben eigene Gradient-Defs, kein Konflikt mehr. Das löste z.B. das "verschwindende Kerzen-Flammen"-Problem (candle_2 hat 2 Gradients pro Kerze). Alternativ: solid colors statt Gradient — oder Asset als `<image href>` einbinden (Black-Box, eigener ID-Scope). cake_2 nutzt diese Alternativ-Lösung historisch.
- **Gestapelte Möbel — `data-y-fuss` synchronisieren:** Ein Element, das visuell auf einem anderen Möbel steht (z.B. cake_2 + plant_geranie auf desk_5), MUSS denselben `data-y-fuss`-Wert wie das Trägermöbel haben. Sonst wechseln sie zu unterschiedlichen Zeitpunkten zwischen Rück- und Front-Ebene → das Trägermöbel überdeckt in der Front-Ebene das aufliegende Element, das in der Rück-Ebene bleibt. DOM-Reihenfolge zwischen Träger und Aufliegendem: Aufliegendes nach Träger, damit es in beiden Ebenen darüber gerendert wird.
- **`klonePflanzenVorne()` muss `filter` mitkopieren** — sonst sehen Möbel in der Front-Ebene blasser aus (kein `#grell`-Saturate). Funktion liest `filter` vom Original-`<g data-raum>` und setzt ihn auf den Klon.
- **`display:none` an `[data-y-fuss]`-Element wird vom Frame-Toggle überschrieben:** `aktualisierePflanzenTiefe()` läuft jeden Frame und setzt `el.style.display = "none"` oder `""` basierend auf figur.fv vs element.fv. Inline `display:none` wird dabei JEDEN FRAME mit `""` überschrieben → Element bleibt sichtbar. **Lösung beim Deaktivieren via `display:none`: `data-y-fuss` mit entfernen.** Beispiel desk_1/desk_2 (auskommentiert): nur dann bleibt das `display:none` stabil, weil der Toggle das Element nicht mehr anfasst. Reaktivieren: `data-y-fuss` wieder einfügen UND `display:none` aus dem Style entfernen.
- **Wandmontierte Objekte (immer-hinten):** Elemente, die an einer Wand "kleben" (paintings, animals im Keller etc.), sollten **gar kein `data-y-fuss`** tragen. Dann werden sie weder geklont noch vom Toggle angefasst und bleiben permanent in der Rück-Ebene → Figur ist immer davor (Bookshelf/Skelett-Pattern). Wenn der visuelle Foot des Objekts UNTER y=600 liegt (also auf dem Boden, nicht an der Wand), data-y-fuss = visual_foot_y verwenden, sonst kann die Figur unsinnigerweise hinter das Objekt laufen. **Sonderfall SVG mit Whitespace unten:** Wenn der visuelle Korpus eines Möbels deutlich höher endet als die SVG-Bbox-Bottom (z.B. cupboard_2 — Korpus bis ~81% der viewBox, danach nur Schatten/Reflexion), ist `data-y-fuss="<bbox-bottom>"` falsch — die Figur „verschwindet" hinter dem Whitespace, sobald sie nah ranläuft. Lösung: data-y-fuss komplett weglassen (wandmontiert-Behandlung) und das Hindernis vor dem visuellen Korpus stoppt die Figur.
- **Animal-Tint (animal_1):** Original-Farben sind dunkelbraun/erdig, was bei dunklem Keller-Setting visuell verschwindet. Lösung: alle Hex-Werte um Faktor t Richtung Gelb verschoben: `r += (255-r)·t; g += (255-g)·t; b -= b·t`. Bei t=0.12 wirkt es schon zu gelb; t=0.06 ist subtil-honigfarben (akzeptiert). Re-Tinten: Original-Asset jedes Mal frisch laden (Aufhellung/Tint sind nicht idempotent — wiederholtes Anwenden auf bereits getintete Farben verschiebt sie immer weiter).
- **CSS `transform` an `<svg>`-Elementen für Möbel-Rotation:** Funktioniert (z.B. desk_3 mit `style="transform:rotate(-2deg);transform-origin:50% 100%"`), pivotiert um Bottom-Center des SVG-Box. Aber: alles, was visuell AUF dem Möbel sitzt (Lampe, Pflanze) ist ein separater SVG-Block und rotiert NICHT mit. Wenn Mit-Rotation gewünscht, müssen Aufliegende dieselbe `transform`-Eigenschaft mit dem **gleichen Drehpunkt im Screen-Space** bekommen.
- **Switch-Triplet (Octopus) — Asset-IDs absichtlich dupliziert:** Die drei Octopus-Varianten (`octopus_1_1/_2/_3`) sind alle gleichzeitig im DOM, deckungsgleich, einer sichtbar via `aktualisiereSanitaer()`. Asset-Pfad-IDs (`path3982-5`, `path4647`, etc.) wurden NICHT geprefixed — alle drei tragen dieselben IDs. Funktioniert hier, weil: 1) keine Gradients (nur solid fills) → keine Paint-Server-Lookups, die Duplikat-IDs ins Wanken bringen würden; 2) CSS-`:not(#path4647)` matcht ALLE Elemente mit dieser ID (auch dreifach im DOM); 3) `klonePflanzenVorne()` prefixt für die Front-Ebene mit `v_<idx>_`, der Rück-Layer bleibt mit Duplikaten. JS verwendet keine `getElementById` auf Inner-Pfade. Bei Bedarf für künftige Switch-Triplets mit Gradients: pro State per Skript prefixen (z.B. `o1_`/`o2_`/`o3_`).
- **Sanitärobjekt mit zwei orthogonalen States** (Sitz vs. Voll/Leer): toilet_2 hat zwei unabhängige Switch-States — `toilette_2` (1=Sitz unten / 2=Sitz oben) UND `toilette_2_voll` (false/true). Visualisierung der voll-State über separates `<svg id="toilet_2_voll">` mit gelber Ellipse, deckungsgleich mit toilet_2_2. `aktualisiereSanitaer()` macht den Voll-Indikator nur sichtbar, wenn BEIDE Bedingungen erfüllt sind: `toilette_2_voll && toilette_2 === 2` (sonst sieht man die Schüsselöffnung nicht und der Indikator wäre nicht plausibel). Klick-Aktion auf toilet_2 ist zustandsabhängig: voll → spülen + sound + voll=false; leer → Sitz togglen.
- **Inventar-Item-Transition** (Glas-Varianten): animal_3_1 → animal_3_2 → animal_3_3 sind drei unterschiedliche IDs, die nacheinander durchs Inventar wandern. `aktualisiereSanitaer()` blendet das `<image id="animal_3_1">` auf desk_4 aus, sobald irgendeine der drei IDs im Inventar liegt ODER `chain_2_step >= 1` — sonst würde das Glas auf desk_4 wieder erscheinen, sobald _1 verbraucht und _2 erzeugt wird. Die `aktiv`-Funktion am OBJEKT verhindert weitere Aufnehm-Klicks parallel. Wichtig: `nimmAufGegenstand()` ruft `aktualisiereSanitaer()` direkt nach `gegenstaende.add()` auf, sonst verschwindet das Image erst beim nächsten Sanitär-Toggle (z.B. Toilette anklicken).
- **Drop-Suche bei überlappenden OBJEKT-Polygonen** (`versucheDrop`): `findeObjektBei()` liefert das ERSTE polygon-passende OBJEKT zurück, egal ob es den Gegenstand akzeptiert. Bei Drop muss explizit nach dem ersten OBJEKT gesucht werden, das `akzeptiert[gegenstandId]` hat. Beispiel: `octopus`-Polygon `(930..1300, 380..710)` überlappt mit `toilet_1` `(1100..1240, 420..670)`. Wenn animal_3_3 in den Überlapp-Bereich gedroppt wird, würde `findeObjektBei` toilet_1 liefern → kein `akzeptiert.animal_3_3` → Drop verpufft. Lösung in `versucheDrop`: eigene Schleife über `OBJEKTE[aktuellerRaum]`, die nur OBJEKTE mit polygon-Treffer UND `akzeptiert[gegenstandId]` zurückliefert.
- **Klon-Prefixierung bricht ID-spezifische CSS-Selektoren** (Octopus-Mund): Die CSS-Regel `.octopus *:not(#path4647) { stroke: none !important }` matcht den geklonten Mund (Front-Layer-ID `v_<idx>_path4647`) nicht — er fällt unter „andere Elemente" und verliert seinen Stroke. Symptom: Mund verschwindet, sobald die Figur in die Front-Ebene wechselt (figur.fv > octopus.fv). Lösung: Attribut-Suffix-Selektor `.octopus *:not([id$="path4647"])` matcht Original UND alle `v_*_path4647`-Klone.
- **Slide-Algorithmus stoppt bei seitlich liegendem Polygon-Center** (Bug-Fix in `slideUmHindernis`): Der frühere Center-basierte Blocker-Filter (`along = dfu*ux + dfv*uy; if (along <= 0) continue`) klassifizierte Polygone als „behind me" sobald ihr Schwerpunkt hinter der Figur lag — auch wenn eine Polygon-Spitze noch im Pfad war. Symptom: Figur lief schräg an einem Polygon vorbei, Direkt-Schritt sagte „in Hindernis", aber slide fand keinen Blocker (Center war ja schon „hinter ihr") → return null → Figur blieb stehen. **Fix:** statt Center+Along zu schätzen, das Hindernis nehmen, in das der direkte Schritt reinläuft (`for (h of hs) if (istInForm(h, neueFu, neueFv)) { blocker = h; break; }`). Reproduzierbar beim Bad → Garten-Pfad in Haupt entlang desk_3.
- **Slide-Schritt landet auf Polygon-Boundary** (Folge-Bug, nur theoretisch nach dem oberen Fix): Bei sehr langen Slides parallel zur Polygon-Kante driftet der reine Tangenten-Schritt (figur.pos + tangent*schritt) numerisch auf die Kante. `pktInKonvexPolygon` zählt Boundary-Punkte (alle Cross-Produkte gleichvorzeichig, eines ≈0) als „drin" → Schritt abgelehnt → Gegenrichtung osc-blockiert → null → Stuck. **Fix:** zusätzlich `+0.002 * Außen-Normale` aufaddieren, damit der Schritt sicher außerhalb landet. Driftet die Figur über viele Slide-Frames um insgesamt ~2 mm (in Bühnen-Skala) vom Polygon weg — visuell unsichtbar.
- **Chain-3-Drop-Reihenfolge bei Octopus** (animal_3_3 + goldene_muenzen): Beide Drops sind symmetrisch — jeder öffnet seine eigene Aufgabe (`chain_2_octopus` bzw. `chain_3_pizza`), Aufgaben-Callback advanciert `octopus_zustand` um +1 (capped 3). Reihenfolge der Chains 2 und 3 ist egal. `belohnung_text` als Funktion liest den POST-callback-state (gewaehrenBelohnung ruft callback VOR text-render) und differenziert „mood improved" (state→2) vs „fully content" (state→3). Bei state=3: Exit-Animation startet erst NACH `schliesseOverlay` (siehe Octopus-Exit-Timing oben).
- **Boundary-Check für Geheimtür**: `findeTuerBei` filtert die secret-Tür raus, wenn `!keller_freigeschaltet && !binoculars_1`-im-Inventar. Ohne Binoculars wirkt die Wand wie eine ganz normale Wand (kein Hinweis-Overlay). Mit Binoculars: Tür ist klickbar (Klick → Hinweistext), Drop von code_geheimtuer triggert akzeptiert-Callback. Nach erfolgreichem Drop: `keller_freigeschaltet=true`, `deaktiviereNachtsicht()`, Tür wird permanent in `FARBEN.tuerGeheimOffen` (b80) gerendert — kontrastiert sichtbar gegen Hauptraum-Wand b70. Phosphor-Outline (`#5fff8a` mit shadowBlur) wird in `zeichneTueren` gezeichnet, wenn Binoculars + nicht freigeschaltet — nur unter Nachtsicht-Filter wirklich sichtbar.
- **CSS-Composite-Filter sind teuer** (Nachtsicht-Stolperstein): Eine Filter-Kette wie `brightness(0.5) sepia(1) hue-rotate(50deg) saturate(3.5)` → 4 Pipeline-Stufen pro Pixel pro Frame. Bei grossen DOM-Layern (Hauptraum: viel Inhalt in `#object-layer`) merklich sluggish, auch mit `will-change: filter`. **Lösung:** in einen einzigen SVG-`<filter>` mit `feColorMatrix` falten → eine 4×5-Matrix-Multiplikation pro Pixel. Nicht-skalare Filter-Kombinationen lassen sich oft als Matrix nähern (siehe `<filter id="nachtsicht">`). Zusätzlich: Layer mit häufigen Updates (z.B. `#figure-canvas` 60×/s) am besten gar nicht filtern — der Filter müsste dort jeden Frame neu berechnet werden.
- **SVG `<g>` mit CSS-`transform: scale` clippt am viewBox** (Chain 4 / duck_1_keller): Eine inner `<g>` mit `transform: scale(N)` skaliert die Pfade über die viewBox-Bbox des outer `<svg>` hinaus. Per Default ist `overflow="hidden"` (SVG-Standard) → der Inhalt wird abgeschnitten, optisch ein „gelbes Quadrat" oder Rumpf-Cut. **Lösung:** `overflow="visible"` als Attribut auf das outer `<svg>` setzen. CSS `overflow: visible` reicht hier NICHT, weil SVG den Attributwert priorisiert. Beispiel: `<svg id="duck_1_keller" overflow="visible" viewBox="…">`.
- **Drop-laufziel im Hindernis-Polygon → Slide-Loop** (Chain 4): laufziele für Drop-Targets (z.B. ketten_drop) müssen AUSSERHALB aller Hindernisse liegen, sonst läuft die Figur ins Hindernis, der Slide-Algorithmus pendelt und die Aktion wird nie ausgelöst. Im Keller deckt das chain_1-Hindernis den ganzen vorderen Boden ab → laufziele wurden hinter die Ketten verlegt (fu, fv ≈ 0.55, 0.55). **Faustregel:** laufziel in einem freien Bereich, von dem aus die Figur das Polygon ohne Hindernis erreichen kann; bei Boden-Hindernissen heisst das oft „dahinter, nicht davor".
- **Forward-Reference auf BUERO_BILD aus OBJEKTE-Literal** (Chain 5): die OBJEKTE.buero-Einträge `bild_kreis_*_klick` brauchen Klickpolygone aus den BUERO_BILD-uv-Koords; BUERO_BILD ist aber in der Datei NACH OBJEKTE definiert und wäre beim Auswerten des OBJEKTE-Literals `undefined`. **Fix:** Polygon-Platzhalter `[[0,0]…]` im Literal, nachträgliches Befüllen via `initChain5Polygone()` in `baueRaumDeko()` (zwischen `baueBueroBild()` und `klonePflanzenVorne()`). Funktionsdeklarationen wie `kreisGedrueckt` werden gehoistet, ihre Verwendung im OBJEKTE-Literal ist also OK (Aufruf erst zur Klick-Zeit).
- **CSS-Animation überlagert SMIL-Transform** (Chain 5 / Skelett-Lachen): das `<image href="skeleton_3.svg">` hat eine SMIL `<animateTransform>`-Schaukel, die das `transform`-Attribut moduliert. Eine CSS-Klasse `.skelett-lacht` mit `animation: ... transform` schlägt die SMIL — CSS-Transforms haben Vorrang vor SVG-`transform`-Attributen. **Wichtig: `transform-box: fill-box` und `transform-origin: 50% 100%` NUR in der CSS-Klasse `.skelett-lacht` setzen, NICHT als Inline-Style aufs `<image>`.** Sonst rotiert die SMIL-Schaukel (rotate(angle 1236 645) mit explizitem Pivot) in manchen Browsern um den falschen Punkt — der CSS-`transform-origin` überlagert den SVG-`rotate`-Pivot. Im Default-Zustand (ohne `.skelett-lacht`) bleibt es bei der SMIL-Logik mit korrektem Pivot; nur während der 2 s Lach-Animation wird der CSS-Pivot aktiv.
- **Front-Layer-Reihenfolge bei mehreren `data-y-fuss`-Elementen** (Chain 4 / Ente-vor-Ketten): Wenn nur ein einzelnes Element `data-y-fuss` hat (z.B. duck_1_keller=860), wandert es allein in den Front-Layer und erscheint ÜBER allen anderen Elementen (auch wenn die in Rück-Ebene visuell drüber sein sollten). **Symptom:** duck_1_keller (im Front-Layer) überdeckt chain_1 + chain_2 (nur in Rück-Ebene) → Ente vor den Ketten statt dahinter. **Lösung:** Auch chain_1 + chain_2 mit `data-y-fuss="860"` versehen. `klonePflanzenVorne()` klont in DOM-Reihenfolge → Front-Layer-Order: duck-Klon (DOM-zuerst), chain_1-Klon, chain_2-Klon → chain-Klone rendern auf duck-Klon (gewünscht). Voraussetzung: duck ist DOM-VOR den Ketten platziert.
- **Per-Aufgabe `geloest_text`-Override:** Optional kann eine Aufgabe `geloest_text: "..."` definieren — `zeigeAufgabe` zeigt diesen Text statt des Standard-„You've already solved this task." bei Wieder-Klick auf eine schon gelöste Aufgabe. Aktuell: `bonus_sonne` mit „You have just solved this for fun 😊".
- **MC-Optionen Zufalls-Reihenfolge:** `baueMultipleChoice` macht pro Render einen Fisher–Yates-Shuffle einer flachen Kopie von `a.optionen`. Klick-Handler bekommt das Option-Objekt direkt (nicht Index), damit Korrektheits-Prüfung unabhängig von der Render-Reihenfolge funktioniert. Original-`AUFGABEN[id].optionen` bleibt unverändert.
- **`HINDERNISSE.<raum>` dynamisch erweitern (Chain 7):** Beim Öffnen des Lochs in der Gartenmitte wird `CHAIN_7_HINDERNIS` (vordefiniertes Boden-Polygon) per `HINDERNISSE.garten.push(...)` zur Laufzeit angehängt. Modul-State `chain_7_hindernis_aktiv` (let-Variable) verhindert Doppel-Push. Beim Reload wird das Modul frisch initialisiert → State und HINDERNISSE-Original-Liste sind sauber. Klärt sich also automatisch.
- **`<svg>`-Klick-Polygone für Chain 7 mussten gross dimensioniert werden:** Die Drop-Targets `gartenmitte_grab` (560..1040, 660..800 = 480×140) und `chest_1` (660..940, 670..800 = 280×130) sind absichtlich grosszügig, weil die Figur beim Drop hinkommt und der User das mit dem Drag-Cursor präzise treffen muss. Kleinere Polygone (vorher 240×40) frustrierten beim Drop.
- **Save-Hook in `aktualisiere*`-Funktionen:** `speicherSpielstand()` sitzt am ENDE jeder Sichtbarkeits-Aktualisierungsfunktion (`aktualisiereSanitaer/Cupboard1/Inventar/LinkesInventar/Chain3/4/5/7`) sowie in `wechsleRaum`, `gewaehrenBelohnung`, `freischalten`/`verschliessen`, `zeigeFormelbuch`. Damit ist garantiert, dass jede State-Mutation in einem Save endet — auch wenn ein Drop-Callback nur `spielstand.zustaende.X = true` macht und am Schluss eines der `aktualisiere*` ruft. Mehrfach-Saves pro Aktion sind harmlos (idempotent, ~1 ms). Direkte spielstand-Mutationen ohne anschliessenden `aktualisiere*`-Aufruf (wie `octopus_exit_gestartet=true` in `schliesseOverlay`) werden NICHT direkt persistiert; in dem Fall fängt der nächste Sichtbarkeits-Toggle (oder das Reset-Helper-Pattern) den Wert ein. Wenn neue State-Mutationen abseits dieser Pfade entstehen: entweder explizit `speicherSpielstand()` aufrufen oder einen `aktualisiere*`-Helper einbauen.
- **`ladeVorgang` initial true (Module-Top-Level):** `let ladeVorgang = true` steht am Anfang der Datei (NICHT erst im requestAnimationFrame). Grund: am Ende der script.js gibt es einen Top-Level-`aktualisiereLinkesInventar()`-Aufruf (rendert das Sammel-Inventar initial leer). Dieser Aufruf läuft VOR dem requestAnimationFrame und damit vor `ladeSpielstand()`. Wäre `ladeVorgang` initial false, würde der Aufruf einen leeren Default-Save schreiben und einen vorhandenen User-Save überschreiben. Mit `ladeVorgang=true` wird `speicherSpielstand()` während der Modul-Initialisierung gesperrt; erst nach erfolgtem Laden + DOM-Aufbau wird das Flag im Auto-Start auf false gesetzt und ein expliziter Save schreibt den finalen Post-Load-Zustand.
- **Settings getrennt vom Spielstand:** `SETTINGS_KEY = "spiel_kreise_1_settings"` ist eine eigene localStorage-Entry für `{ soundAn, musikAn }`. Bewusst NICHT in den Spielstand integriert — sonst würde ein Reset (Zahnrad → Reset progress → `setzeSpielstandZurueck`) auch die Sound-Vorlieben löschen. User-Erwartung ist meist: „Reset" = Fortschritt weg, aber „Sound aus" bleibt aus. Wer ein Setting wirklich an den Run koppeln will (z.B. eine pro-Spiel Schwierigkeitsstufe), das in den Spielstand legen — nicht in `SETTINGS_KEY`.
- **Hindernis-Form-Erweiterung erfordert Laufziel-Audit:** Wenn ein Spline-Hindernis ausgeweitet wird (z.B. `HINDERNISSE.badezimmer[1]` von „nur Front-Bereich fv 0.55..1.0" auf „bis zur Wand fv=0..1.0"), können laufziele anderer OBJEKTE plötzlich INSIDE liegen. `setzeFigurZiel()` snapped sie zwar auf die nächste Polygon-Kante, aber visuell endet die Figur dann an einer ungewollten Stelle. **Workflow nach jeder Hindernis-Änderung:** alle laufziele im selben Raum gegen das geänderte Polygon prüfen (animal_3_1, chain_6_schublade, octopus, binoculars_1 waren nach der toilet_1+cupboard_2-Erweiterung betroffen — animal_3_1/Schublade hart drin, octopus borderline). Bei mehreren betroffenen laufzielen einzeln neu wählen — Faustregel: Clearance ≥ 50 px floor-Distanz zur Polygon-Kante.
- **Auto-Save überschreibt frischen „Start over"-Reset** (Stolperstein zum Begrüssungsbildschirm): Der Auto-Start ruft am Ende `speicherSpielstand()` auf, „um den finalen Post-Load-Zustand konsistent zu serialisieren". Wenn aber im vorherigen Page-Load „Start over" gedrückt wurde, ist localStorage frisch leer — und der Auto-Save würde sofort einen leeren Default-State ablegen. Beim nächsten Reload sieht `zeigeStartScreen()` dann irrtümlich einen Save und zeigt Continue/Start-over statt „Begin adventure". **Fix:** der Auto-Save am Ende läuft NUR wenn `geladen===true` (also wirklich ein Save da war). Frischer Start → kein Auto-Save → erste echte In-Game-Aktion triggert ohnehin einen Save via `aktualisiere*`-Hook.
- **„Start over"-Skip-Flag (sessionStorage):** Damit „Start over" → Confirm direkt ins Spiel führt (statt wieder den Begrüssungsbildschirm zu zeigen, wo der User „Begin adventure" klicken müsste), wird beim Confirm zusätzlich `sessionStorage["spiel_kreise_1_skip_start"]="1"` gesetzt, dann reloaded. `zeigeStartScreen()` checkt das Flag früh, löscht es (1× gültig) und kehrt sofort zurück → Overlay bleibt versteckt. SessionStorage statt localStorage, damit das Flag nicht über Tabs/Sessions hinweg „klebt". Audio-Context unlocked sich beim ersten In-Game-Klick automatisch.

## Roadmap

**Aktueller Stand:** Infrastruktur, Spielstand, **Persistenz via localStorage** (Spielstand + separate Settings, Reset-Zahnrad mit Sound/Music/Reset-Menü), **Begrüssungsbildschirm** (Story-Setup mit Tante-Mathematikerin, 130 schwebende Kreise im Hintergrund, Continue/Start-over bzw. Begin-adventure, Two-Click-Confirm-Reset, Skip-Flag für Direkt-Start nach Reset), **Tablet-tauglich** (Touch-Targets ≥ 44 px, `touch-action: none`, `-webkit-tap-highlight-color: transparent`, Long-Press-Callout unterdrückt), Aufgaben-UI (Zahlen + Multiple-Choice mit KaTeX-Optionen, MC mit **Zufalls-Reihenfolge**, `belohnung_text` darf Funktion sein, optionaler `geloest_text`-Override), Inventar + Drag & Drop (rechts) **plus linkes Sammel-Inventar (Chain 6, NICHT interaktiv)**, Kollision (**alle Hindernisse als Splines** — Kreise/Ellipsen als 6-Eck-Näherung, Vierecke 1:1; kubische Bezier-Splines mit Live-Editor inkl. Doppelklick-Handle-Reset + Slide-Algorithmus mit Boundary- und Center-Filter-Fix), Tiefensortierung via `data-y-fuss`, Sanitär-Switch mit `.sanitar-aus`-CSS, klickbare Toiletten (Octopus blockiert toilet_1, toilet_2-Sitz erst nach Formelbuch hochklappbar, Voll/Leer-Mechanik mit Spülsound), Browser-Cursor:pointer kontextabhängig via präzise `aktiv`-Predikate, Hindernis-Drag-Editor. Möbel in allen fünf Räumen platziert + Hindernisse durchgängig per Drag-Editor gesetzt. **Spielertexte komplett auf Englisch**. **Auto-Close global 4 s.** **Inventar-Icons komplett randlos** (kein `stroke="#1a1a1a"` mehr). **Kombinations-Helper chain123() etc. rufen automatisch `bridge()` mit** wenn 1+2+3 enthalten.

**Sieben spielbare Chains + Bridge zum Keller + Sieg-Endscreen:**
- **Chain 1:** Formelbuch finden → cake_1 → Schlüssel (silbern) → cupboard_1 mit `chain_1_schloss`-Aufgabe (90° → π/2) → Zettel → Tischlampe-Lichtkegel → π-MC → Code-Item.
- **Chain 2:** animal_3_1 → toilet_2 → Wanne → animal_3_3 → Octopus → `chain_2_octopus` → octopus_zustand +1.
- **Chain 3:** Wolke → Vogel + Schlauch-MC → flower_1 → seed_1 → Vogel → goldene_muenzen → Octopus → `chain_3_pizza` → octopus_zustand +1.
- **Chain 4:** duck_1 + muffin_1 → Ketten → Burp + Messgerät → Teppich-MC → Schaufel.
- **Chain 5:** Bürobild-Sequenz (C4-E4-G4) → `chain_5_kreise` → drei_kreise → painting_2 → Skelett lacht → **Pickel landet direkt im Inventar**.
- **Chain 6:** 4 Pickup-Aufgaben (Sektor / Bogen / Umfang / Fläche, reine Formel-Erkennung) → linkes Sammel-Inventar → 4 Stück → Combine-Animation → `vereinter_schluessel`.
- **Chain 7 (NEU):** Schaufel + Pickel → gartenmitte_grab → Loch + Truhe sichtbar (chain_7_grab als perspektivisches Boden-Trapez, dynamisches HINDERNISS gepushed) → vereinter_schluessel auf chest_1 → **Sieg-Overlay** (Feuerwerk + Krone + Münzen, Play again / End game).
- **Bridge:** Beide Octopus-Aufgaben → state=3 → Exit nach Overlay-Schliessen → toilet_1 → Binoculars → Nachtsicht → Geheimtür → code_geheimtuer-Drop → Keller offen.

Reihenfolge zwischen Chain 2 und Chain 3 ist symmetrisch — beide Aufgaben können in beliebiger Reihenfolge gelöst werden, jede macht +1 am Octopus-State. Chain 3 ist effektiv erforderlich für die Bridge.

**Konsolen-Dev-Helper (Chain-Schnellpässe):** Direkt in die Browser-Konsole eintippen, um den Spielstand auf „Chain N erledigt" zu versetzen — nützlich zum Testen einzelner Spätspielszenen ohne alle Vorbedingungen manuell zu spielen.

```js
chain1()      // Formelbuch + Schrank offen + Code-Tag im Inventar
chain2()      // Octopus-Mood +1
chain3()      // Octopus-Mood +1
bridge()      // Octopus weg + Keller freigeschaltet (Binoculars + Code verbraucht)
chain4()      // Schaufel im Inventar
chain5()      // Pickel im Inventar (drei_kreise gedroppt, painting_2-Overlay sichtbar)
chain6()      // vereinter_schluessel im Inventar
chain7()      // Loch offen + Schlüssel im Inventar — bereit zum Sieg-Drop
```

**Kombinationen** für beliebige Subsets, in beliebiger Ziffernreihenfolge im Funktionsnamen:
```js
chain12()       // Chains 1 + 2
chain134()      // Chains 1 + 3 + 4 (Items: Code-Tag + Octopus-Mood +1 + Schaufel)
chain143()      // identisch zu chain134 (Reihenfolge der Ziffern egal)
chain1234567()  // alle 7 Chains
```

Generiert werden **alle Permutationen** der nichtleeren Subsets von {1..7} (~13 700 Funktionsnamen). Ausführung läuft intern immer in numerisch sortierter Reihenfolge — der State-Endpunkt ist gleich. **Auto-Bridge:** Kombinationen, die Chains 1+2+3 alle enthalten (z.B. `chain123()`, `chain1234567()`), rufen automatisch `bridge()` mit → Keller wird freigeschaltet. `bridge()` kann weiterhin separat aufgerufen werden.

Diese Funktionen verändern nur Flags + Inventar; visuelle Zustände werden über `aktualisiere*`-Helper nachgezogen. Keine Aufgaben-Overlays/Auto-Close-Effekte werden ausgelöst (kein Spam-Workflow in der Konsole).

**Atmosphäre-Updates** (alle integriert): Wandbilder (painting_1 + 2 mit grell-mild), Pixar-Stil-Lampe (lamp_1) im Büro, animal_1 + animal_2 wandmontiert im Keller, rotierter desk_3 (-2°) mit Pilzlampe + plant_setzling. **Garten-Politur:** tieferer Himmel `#5c9cc2` + goldigere Sonne `#ffc028` + 4 prozedurale Wolken, neue Buschstruktur via `mulberry32`-Seed + `ctx.clip()`, `bush_3`-Doppelkrone, `flower_2a`/`flower_2b` rote/blaue Varianten, `flower_4`/`flower_6` Inline→Canvas-Migration, Gartenschlauch mit Affin-Matrix an Hauswand. **Chain 4 Items:** Bandmaß / Cupcake / Schaufel / Quietscheente als handgezeichnete Inventar-Icons. **Performance:** Nightvision als Single-Pass-SVG-feColorMatrix. **Datenpflege:** `data-y-fuss`-Audit über alle Räume.

**Offen:**
- Hintergrundmusik implementieren — Toggle (`musikAn`) ist im Settings-Menü schon da, Persistenz steht, aber `starteMusik()`/`stoppeMusik()` fehlen noch. Web Audio Loop oder einfache `<audio>`-Quelle möglich.
- Diagnose-`console.warn` in `slideUmHindernis` rausnehmen, sobald keine neuen Slide-Hänger mehr auftauchen.
- Hinweise bei falscher Antwort (pro Aufgabe konfigurierbar) — aktuell nur generisches rotes Feedback.
- Weitere Kreis-Aufgaben falls gewünscht (aktuell 13 Aufgaben definiert: 8 Rechen-Aufgaben über Chains 1–5 + 4 Formel-Erkennung in Chain 6 + 1 Bonus auf der Sonne).

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
