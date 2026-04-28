const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;

const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const gameContainer = document.getElementById("game-container");
const canvas = document.getElementById("game-canvas");
const canvasFigur = document.getElementById("figure-canvas");
const ctxRaum = canvas.getContext("2d");
const ctxFigur = canvasFigur.getContext("2d");
// Aktiver Zeichenkontext — wird in draw() zwischen Raum und Figur umgeschaltet.
let ctx = ctxRaum;
const svgLayer = document.getElementById("object-layer");
const svgLayerVorne = document.getElementById("object-layer-vorne");

// Zimmer-Geometrie
const ZIMMER = {
    decke:       [[0, 0], [300, 100], [1300, 100], [1600, 0]],
    boden:       [[0, 900], [300, 600], [1300, 600], [1600, 900]],
    linkeWand:   [[0, 0], [300, 100], [300, 600], [0, 900]],
    rechteWand:  [[1600, 0], [1300, 100], [1300, 600], [1600, 900]],
    hintereWand: [[300, 100], [1300, 100], [1300, 600], [300, 600]],
};

// Wand-Koordinaten (u = Tiefe 0..1, v = Boden..Decke 0..1)
function linkeWandPunkt(u, v) {
    const x = 300 * u;
    const oben = 100 * u;
    const unten = 900 - 300 * u;
    return [x, unten - v * (unten - oben)];
}
function rechteWandPunkt(u, v) {
    const x = 1600 - 300 * u;
    const oben = 100 * u;
    const unten = 900 - 300 * u;
    return [x, unten - v * (unten - oben)];
}

// Boden-Koordinaten (fu = 0 links .. 1 rechts, fv = 0 vorne .. 1 hinten)
function bodenPunkt(fu, fv) {
    const x = fu * (1600 - 600 * fv) + 300 * fv;
    const y = 900 - 300 * fv;
    return [x, y];
}
function screenZuBoden(x, y) {
    const fv = (900 - y) / 300;
    if (fv < 0 || fv > 1) return null;
    const fu = (x - 300 * fv) / (1600 - 600 * fv);
    if (fu < 0 || fu > 1) return null;
    return [fu, fv];
}

// Palette (tikz-Notation black!X: 0=weiss, 100=schwarz)
const GRAU = {
    b0:   "#ffffff",
    b20:  "#cccccc",
    b40:  "#999999",
    b50:  "#808080",
    b60:  "#666666",
    b70:  "#4d4d4d",
    b80:  "#333333",
    b90:  "#1a1a1a",
    b100: "#000000",
};

const FARBEN = {
    // Türen (global, unabhängig vom Raum)
    tuer:        GRAU.b50,
    tuerLabel:   GRAU.b100,
    tuerGeheim:  GRAU.b70,
    pfeil:       GRAU.b0,
    // Figur (komplett schwarz, ausser Augen und Mund)
    kopf:        GRAU.b100,
    augen:       GRAU.b0,
    nase:        GRAU.b100,
    mund:        GRAU.b0,
    hemd:        GRAU.b100,
    hose:        GRAU.b100,
};

// Seitenwand-Türpolygon (A/B/L-Grösse: 10 % kleiner als früher)
function seitenTuerPolygon(wandFn) {
    return [wandFn(0.225, 0), wandFn(0.675, 0), wandFn(0.675, 0.72), wandFn(0.225, 0.72)];
}

// Rückkehr-Pfeil am unteren Bildrand — vertikal gequetscht, nach unten zeigend (fake 3D "zurück")
const PFEIL_POLYGON = [
    [780, 820], [820, 820], [820, 845], [910, 845],
    [800, 880], [690, 845], [780, 845],
];

// Räume: Geometrie ist überall gleich (ZIMMER/linkeWandPunkt/…), aber Farben,
// Türen und Deko unterscheiden sich. Jede Tür hat ein `ziel` (Raum-ID).
const RAEUME = {
    haupt: {
        name: "Hauptraum",
        farben: {
            decke: GRAU.b90, boden: GRAU.b90,
            hintereWand: GRAU.b70, linkeWand: GRAU.b70, rechteWand: GRAU.b70,
        },
        tueren: [
            { id: "A", label: "A", polygon: [[460, 600], [640, 600], [640, 240], [460, 240]],
              ziel: "buero",  laufziel: { fu: 0.26, fv: 0.92 } },
            { id: "B", label: "B", polygon: [[960, 600], [1140, 600], [1140, 240], [960, 240]],
              ziel: "badezimmer", laufziel: { fu: 0.74, fv: 0.92 } },
            { id: "L", label: "L", polygon: seitenTuerPolygon(linkeWandPunkt),
              ziel: "garten", laufziel: { fu: 0.12, fv: 0.45 } },
            { id: "geheim", secret: true,
              polygon: [rechteWandPunkt(0.325, 0), rechteWandPunkt(0.575, 0), rechteWandPunkt(0.575, 0.4), rechteWandPunkt(0.325, 0.4)],
              ziel: "keller", laufziel: { fu: 0.88, fv: 0.45 } },
        ],
    },
    garten: {
        name: "Garten",
        farben: {
            decke: "#7cb8d8", boden: "#4e8c3f",
            hintereWand: "#7cb8d8",
            linkeWand: "#7cb8d8",
            rechteWand: "#a8a49c",
        },
        tueren: [
            { id: "zurueck", label: "H", polygon: seitenTuerPolygon(rechteWandPunkt),
              ziel: "haupt", laufziel: { fu: 0.88, fv: 0.45 } },
        ],
    },
    keller: {
        name: "Keller",
        farben: {
            decke: GRAU.b100, boden: GRAU.b90,
            hintereWand: GRAU.b80, linkeWand: GRAU.b80, rechteWand: GRAU.b80,
        },
        tueren: [
            { id: "zurueck", label: "H", polygon: seitenTuerPolygon(linkeWandPunkt),
              ziel: "haupt", laufziel: { fu: 0.12, fv: 0.45 } },
        ],
    },
    buero: {
        name: "Büro",
        farben: {
            decke: GRAU.b90, boden: GRAU.b90,
            hintereWand: GRAU.b70, linkeWand: GRAU.b70, rechteWand: GRAU.b70,
        },
        tueren: [
            { id: "zurueck", pfeil: true, polygon: PFEIL_POLYGON,
              ziel: "haupt", laufziel: { fu: 0.5, fv: 0.05 } },
            { id: "badezimmer", label: "F", polygon: seitenTuerPolygon(rechteWandPunkt),
              ziel: "badezimmer", laufziel: { fu: 0.88, fv: 0.45 } },
        ],
    },
    badezimmer: {
        name: "Badezimmer",
        farben: {
            decke: GRAU.b90, boden: GRAU.b90,
            hintereWand: GRAU.b70, linkeWand: GRAU.b70, rechteWand: GRAU.b70,
        },
        tueren: [
            { id: "zurueck", pfeil: true, polygon: PFEIL_POLYGON,
              ziel: "haupt", laufziel: { fu: 0.5, fv: 0.05 } },
            { id: "buero", label: "B", polygon: seitenTuerPolygon(linkeWandPunkt),
              ziel: "buero", laufziel: { fu: 0.12, fv: 0.45 } },
        ],
    },
};

let aktuellerRaum = "haupt";

// Standard-Eintrittsposition in jedem Raum (fu, fv) — für Phase 1 einheitlich Mitte-vorne.
const RAUM_EINTRITT = { fu: 0.5, fv: 0.3 };

// ---------- Spielstand (Phase 2) ----------
// Persistenter Zustand: gelöste Aufgaben, freigeschaltete Schlüssel, gefundene Werte.
// Jede Tür kann optional ein `schloss: "<schluessel-id>"` haben — sie ist dann verschlossen,
// bis der passende Schlüssel in `freigeschalteteTueren` liegt.
const spielstand = {
    geloesteAufgaben: new Set(),
    freigeschalteteTueren: new Set(),
    inventar: {},
    gegenstaende: new Set(),   // Phase 6: aufgenommene Gegenstände (Set von IDs aus GEGENSTAENDE)
    // Switch-States für Sanitärobjekte im Badezimmer (1 = Initialzustand, 2 = nach Handlung).
    // Schlüssel-Konvention folgt den IDs: toilette_1 steuert toilet_1_1/_2, toilette_2 steuert toilet_2_1/_2.
    // Konkrete Auslöse-Handlung wird später definiert; bis dahin per Konsole umschaltbar.
    zustaende: {
        badewanne: 1,
        toilette_1: 1,  // toilet_1_1 (Ring unten, x=1090) / toilet_1_2 (Ring oben)
        toilette_2: 1,  // toilet_2_1 (Ring unten, x=600) / toilet_2_2 (Ring oben)
        octopus_da: true,  // Tintenfisch sitzt auf toilet_1 — solange true, blockiert er die Spülung dort.
    },
};

function istFrei(tuer) {
    if (!tuer.schloss) return true;
    return spielstand.freigeschalteteTueren.has(tuer.schloss);
}

// Dev-Helfer (Konsole): z.B. freischalten("keller_schluessel")
function freischalten(schluesselId) {
    spielstand.freigeschalteteTueren.add(schluesselId);
    draw();
    console.log(`Schlüssel "${schluesselId}" freigeschaltet.`);
}
function verschliessen(schluesselId) {
    spielstand.freigeschalteteTueren.delete(schluesselId);
    draw();
    console.log(`Schlüssel "${schluesselId}" entfernt.`);
}
window.freischalten = freischalten;
window.verschliessen = verschliessen;
window.spielstand = spielstand;

// ---------- Sanitärobjekt-Switch (Badezimmer) ----------
// Setzt Sichtbarkeit von bathtub_1_1/1_2 und beider Toiletten (toilet_1_1/_2 + toilet_2_1/_2)
// entsprechend spielstand.zustaende. Wird beim Init und nach jedem Wechsel aufgerufen.
function aktualisiereSanitaer() {
    const setSichtbar = (id, sichtbar) => {
        // Attribute-Selector statt #id: findet ALLE Elemente mit dieser ID, auch Klone in
        // #object-layer-vorne (Klone haben dieselbe ID — invalides HTML, aber funktional OK).
        // Wir toggeln eine CSS-Klasse `sanitar-aus` (mit display:none !important im <style>),
        // die die Inline-display-Setzung von aktualisierePflanzenTiefe() überschreibt.
        document.querySelectorAll(`[id="${id}"]`).forEach(el => {
            el.classList.toggle("sanitar-aus", !sichtbar);
        });
    };
    setSichtbar("bathtub_1_1", spielstand.zustaende.badewanne === 1);
    setSichtbar("bathtub_1_2", spielstand.zustaende.badewanne === 2);
    setSichtbar("toilet_1_1", spielstand.zustaende.toilette_1 === 1);
    setSichtbar("toilet_1_2", spielstand.zustaende.toilette_1 === 2);
    setSichtbar("toilet_2_1", spielstand.zustaende.toilette_2 === 1);
    setSichtbar("toilet_2_2", spielstand.zustaende.toilette_2 === 2);
}

function setzeBadewanne(zustand) {
    spielstand.zustaende.badewanne = zustand === 2 ? 2 : 1;
    aktualisiereSanitaer();
    console.log(`Badewanne: Zustand ${spielstand.zustaende.badewanne} (bathtub_1_${spielstand.zustaende.badewanne})`);
}
function setzeToilette1(zustand) {
    spielstand.zustaende.toilette_1 = zustand === 2 ? 2 : 1;
    aktualisiereSanitaer();
    console.log(`Toilette 1 (x=800): Zustand ${spielstand.zustaende.toilette_1} (toilet_1_${spielstand.zustaende.toilette_1})`);
}
function setzeToilette2(zustand) {
    spielstand.zustaende.toilette_2 = zustand === 2 ? 2 : 1;
    aktualisiereSanitaer();
    console.log(`Toilette 2 (x=600): Zustand ${spielstand.zustaende.toilette_2} (toilet_2_${spielstand.zustaende.toilette_2})`);
}
function wechsleBadewanne()  { setzeBadewanne(spielstand.zustaende.badewanne === 1 ? 2 : 1); }
function wechsleToilette1()  { setzeToilette1(spielstand.zustaende.toilette_1 === 1 ? 2 : 1); }
function wechsleToilette2()  { setzeToilette2(spielstand.zustaende.toilette_2 === 1 ? 2 : 1); }

window.setzeBadewanne = setzeBadewanne;
window.setzeToilette1 = setzeToilette1;
window.setzeToilette2 = setzeToilette2;
window.wechsleBadewanne = wechsleBadewanne;
window.wechsleToilette1 = wechsleToilette1;
window.wechsleToilette2 = wechsleToilette2;

// ---------- Sound (Schrittsounds via Web Audio) ----------

let audioCtx = null;
let soundAn = true;

function ensureAudio() {
    if (!audioCtx) {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        } catch (e) {
            console.warn("Web Audio nicht verfügbar:", e);
            return;
        }
    }
    // Safari/Chrome starten AudioContext oft im Zustand "suspended" — in User-Gesture resumen.
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(e => console.warn("AudioContext resume fehlgeschlagen:", e));
    }
}

// Vier Schritt-Varianten (Frequenz, Dauer, Lautstärke), round-robin durchlaufen.
// Jeder Schritt bekommt zusätzlich ±3 % Frequenz-Jitter, damit es lebendig bleibt.
const SCHRITT_VARIANTEN = [
    { freq: 260, dur: 0.09, gain: 0.20 },  // Standard
    { freq: 310, dur: 0.08, gain: 0.18 },  // heller, kürzer
    { freq: 220, dur: 0.10, gain: 0.22 },  // tiefer, etwas länger
    { freq: 285, dur: 0.09, gain: 0.17 },  // mittel, weicher
];
let schrittIndex = 0;

function spieleSchritt() {
    if (!soundAn || !audioCtx) return;
    const v = SCHRITT_VARIANTEN[schrittIndex];
    schrittIndex = (schrittIndex + 1) % SCHRITT_VARIANTEN.length;

    const sampleRate = audioCtx.sampleRate;
    const len = Math.floor(v.dur * sampleRate);
    const buf = audioCtx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
    }

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = v.freq * (0.97 + Math.random() * 0.06);  // ±3 % Jitter
    filter.Q.value = 1.0;

    const gain = audioCtx.createGain();
    gain.gain.value = v.gain;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    src.start(now);
    src.stop(now + v.dur);
}

// Konsolen-Helfer: Sound an/aus
window.soundAnAus = (an) => { soundAn = !!an; console.log("Sound:", soundAn ? "an" : "aus"); };

// Diagnose: 3 Tests nacheinander, damit klar wird, wo's klemmt
window.soundTest = async () => {
    ensureAudio();
    if (!audioCtx) { console.log("audioCtx nicht initialisiert"); return; }
    console.log("state:", audioCtx.state, "rate:", audioCtx.sampleRate);

    const warte = ms => new Promise(r => setTimeout(r, ms));

    // 1. Oszillator-Beep (440 Hz) — testet grundlegenden Audio-Pfad
    console.log("Test 1: Beep 440 Hz");
    const osc = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    g1.gain.value = 0.2;
    osc.connect(g1);
    g1.connect(audioCtx.destination);
    osc.frequency.value = 440;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
    await warte(500);

    // 2. Ungefiltertes lautes Noise — testet BufferSource-Pfad ohne Filter
    console.log("Test 2: Rauschen ohne Filter");
    const len = Math.floor(0.2 * audioCtx.sampleRate);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const s = audioCtx.createBufferSource();
    s.buffer = buf;
    const g2 = audioCtx.createGain();
    g2.gain.value = 0.4;
    s.connect(g2);
    g2.connect(audioCtx.destination);
    s.start();
    s.stop(audioCtx.currentTime + 0.2);
    await warte(400);

    // 3. Voller Schritt-Sound
    console.log("Test 3: Schritt (gefiltertes Noise)");
    spieleSchritt();
    console.log("Fertig.");
};

// ---------- Aufgaben (Phase 3) ----------
// Jede Aufgabe: { frage, formel, fragetext, loesung, toleranz, bei_richtig? }
// - frage/fragetext dürfen Strings oder Funktionen (spielstand) => string sein,
//   damit Cross-Room-Lookups möglich sind (z.B. "Setze r aus dem Büro ein.")
// - formel ist eine KaTeX-Formel (String, ohne $-Wrapper)
// - loesung ist eine Zahl; toleranz = maximaler erlaubter Fehler
// - bei_richtig: { schluessel?, inventar?, belohnung_text? }
const AUFGABEN = {
    bookshelf_umfang: {
        frage: "In einem Buch auf dem Regal findest du folgende Aufgabe:",
        formel: "U = 2 \\pi r",
        fragetext: "Wie gross ist der Umfang eines Kreises mit Radius r = 5 cm? (π ≈ 3.14, Antwort in cm)",
        loesung: 31.4,
        toleranz: 0.2,
        bei_richtig: {
            inventar: { umfang_demo_cm: 31.4 },
            belohnung_text: "Richtig! Den Umfang merkst du dir für später.",
        },
    },
};

// Klickbare Objekte pro Raum. Polygon in Stage-Koordinaten (1600×900).
// Mögliche Felder:
//   `id`         Eindeutige Objekt-ID (pflicht).
//   `polygon`    Klick-Hitbox in Stage-Koordinaten (pflicht).
//   `laufziel`   {fu, fv} — Punkt, zu dem die Figur läuft, bevor die Aktion auslöst.
//   `aufgabe`    ID aus AUFGABEN — Klick öffnet das Aufgaben-Overlay.
//   `aufnehmen`  ID aus GEGENSTAENDE — Klick nimmt den Gegenstand auf (Objekt verschwindet).
//   `akzeptiert` { gegenstand_id: (spielstand, id) => {...} } — Drop-Target für Drag & Drop.
//   `zeichnen`   (ctx) => void — zeichnet das Objekt auf den Zimmer-Canvas (nur nötig,
//                wenn es nicht schon durch SVG-Deko oder Möbel repräsentiert ist).
//   `aufgenommen` boolean (intern) — wird true gesetzt, nachdem `aufnehmen` ausgelöst hat.
const OBJEKTE = {
    haupt: [
        // Bookshelf: transform translate(650 310) scale(0.5), Inhalt ~610×550 → Screen x ~647..952, y 310..585
        {
            id: "bookshelf",
            aufgabe: "bookshelf_umfang",
            polygon: [[647, 310], [953, 310], [953, 585], [647, 585]],
            laufziel: { fu: 0.5, fv: 0.88 },
            // Demo: Notizzettel auf Bookshelf droppen zeigt einen Hinweis.
            akzeptiert: {
                notizzettel: (s) => {
                    zeigeOverlayText("Auf dem Notizzettel steht:\n\u201er = 5 cm\u201c");
                },
            },
        },
    ],
    buero: [
        // Demo-Aufnehm-Gegenstand: Notizzettel auf dem Boden.
        {
            id: "buero_notizzettel",
            aufnehmen: "notizzettel",
            polygon: [[822, 643], [918, 643], [918, 703], [822, 703]],
            laufziel: { fu: 0.5, fv: 0.85 },
            zeichnen: (ctx) => {
                // Brief: Blatt mit Datum oben-rechts, Anrede, Textzeilen unterschiedlicher
                // Länge und Unterschrift-Zickzack unten.
                ctx.save();
                // -20 % Skalierung um Brief-Mittelpunkt (870, 675).
                ctx.translate(870, 675);
                ctx.scale(0.8, 0.8);
                ctx.translate(-870, -675);
                ctx.fillStyle = "#fffbe6";
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(820, 645, 100, 60, 3);
                ctx.fill();
                ctx.stroke();
                // Liniatur (Datum, Anrede, Text) in gedämpftem Grau
                ctx.strokeStyle = "#777";
                ctx.lineWidth = 1;
                const linie = (x1, y, x2) => {
                    ctx.beginPath();
                    ctx.moveTo(x1, y);
                    ctx.lineTo(x2, y);
                    ctx.stroke();
                };
                // Datum oben-rechts
                linie(885, 652, 912);
                // Anrede (kürzer, linksbündig)
                linie(828, 662, 864);
                // Drei Textzeilen mit abnehmender Länge (letzter Absatz zu Ende)
                linie(828, 672, 910);
                linie(828, 679, 908);
                linie(828, 686, 895);
                // Unterschrift als Zickzack (unten-rechts)
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(880, 698);
                ctx.lineTo(885, 694);
                ctx.lineTo(890, 699);
                ctx.lineTo(898, 695);
                ctx.lineTo(906, 700);
                ctx.stroke();
                ctx.restore();
            },
        },
    ],
    badezimmer: [
        // Toilette 1 (rechts, x=1040..1240): Klick toggelt Spülung sofort (kein laufziel —
        // Spülung ist eine Knopf-Aktion, Figur muss nicht erst hinlaufen). ABER solange der
        // Tintenfisch drauf sitzt (spielstand.zustaende.octopus_da), blockiert er die Spülung.
        {
            id: "toilet_1",
            polygon: [[1040, 420], [1240, 420], [1240, 670], [1040, 670]],
            aktion: (s) => {
                if (s.zustaende.octopus_da) {
                    zeigeOverlayText("Auf dieser Toilette sitzt ein Tintenfisch.\nDu kannst die Spülung erst betätigen, wenn er weg ist.");
                } else {
                    wechsleToilette1();
                }
            },
        },
        // Toilette 2 (links, x=590..790): Klick toggelt Spülung sofort. Hier sitzt nichts drauf.
        {
            id: "toilet_2",
            polygon: [[590, 420], [790, 420], [790, 670], [590, 670]],
            aktion: () => wechsleToilette2(),
        },
    ],
    garten: [],
    keller: [],
};

function objektIstAktiv(obj) {
    if (obj.aufgenommen) return false;
    // Aktiv, wenn eines der Interaktions-Felder gesetzt ist.
    return !!(AUFGABEN[obj.aufgabe] || obj.aufnehmen || obj.akzeptiert || obj.aktion);
}

function zeigeAufgabe(id) {
    const a = AUFGABEN[id];
    if (!a) return;
    const geloest = spielstand.geloesteAufgaben.has(id);

    overlayInhaltEl.innerHTML = "";

    const frageText = typeof a.frage === "function" ? a.frage(spielstand) : a.frage;
    const frageEl = document.createElement("p");
    frageEl.className = "aufgabe-frage";
    frageEl.textContent = frageText;
    overlayInhaltEl.appendChild(frageEl);

    if (a.formel) {
        const formelEl = document.createElement("div");
        formelEl.className = "aufgabe-formel";
        if (typeof katex !== "undefined") {
            katex.render(a.formel, formelEl, { throwOnError: false, displayMode: true });
        } else {
            formelEl.textContent = a.formel;
        }
        overlayInhaltEl.appendChild(formelEl);
    }

    const detailText = typeof a.fragetext === "function" ? a.fragetext(spielstand) : a.fragetext;
    if (detailText) {
        const detailEl = document.createElement("p");
        detailEl.className = "aufgabe-detail";
        detailEl.textContent = detailText;
        overlayInhaltEl.appendChild(detailEl);
    }

    if (geloest) {
        const info = document.createElement("p");
        info.className = "feedback richtig";
        info.textContent = "Diese Aufgabe hast du schon gelöst.";
        overlayInhaltEl.appendChild(info);
    } else {
        const form = document.createElement("form");
        form.className = "aufgabe-form";
        form.autocomplete = "off";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "aufgabe-input";
        input.inputMode = "decimal";
        input.placeholder = "Deine Antwort";
        input.required = true;

        const btn = document.createElement("button");
        btn.type = "submit";
        btn.className = "aufgabe-pruefen";
        btn.textContent = "Prüfen";

        const feedback = document.createElement("p");
        feedback.className = "feedback";

        form.append(input, btn);
        overlayInhaltEl.append(form, feedback);

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            pruefeAntwort(id, input.value, feedback, input);
        });

        setTimeout(() => input.focus(), 0);
    }

    overlayEl.hidden = false;
}

function pruefeAntwort(id, eingabeStr, feedbackEl, inputEl) {
    const a = AUFGABEN[id];
    const zahl = parseFloat(String(eingabeStr).replace(",", ".").trim());
    if (!isFinite(zahl)) {
        feedbackEl.textContent = "Bitte eine Zahl eingeben.";
        feedbackEl.className = "feedback falsch";
        return;
    }
    const richtig = Math.abs(zahl - a.loesung) <= a.toleranz;
    if (!richtig) {
        feedbackEl.textContent = "Das ist leider nicht richtig. Versuch's nochmal.";
        feedbackEl.className = "feedback falsch";
        inputEl.select();
        return;
    }

    spielstand.geloesteAufgaben.add(id);
    const b = a.bei_richtig || {};
    if (b.schluessel) spielstand.freigeschalteteTueren.add(b.schluessel);
    if (b.inventar) Object.assign(spielstand.inventar, b.inventar);

    feedbackEl.textContent = b.belohnung_text || "Richtig!";
    feedbackEl.className = "feedback richtig";

    // Input + Prüfen-Button nach Erfolg deaktivieren
    inputEl.disabled = true;
    const btn = inputEl.parentElement.querySelector("button");
    if (btn) btn.disabled = true;

    draw();  // Türen neu zeichnen (falls Schloss geöffnet wurde)
}

// Richtung, in die die Figur beim Eintritt schaut — "in den Raum hinein",
// abhängig davon, an welcher Wand die Eintritts-Position liegt.
function eintrittsRichtung(fu, fv) {
    if (fu < 0.2)  return "rechts";
    if (fu > 0.8)  return "links";
    if (fv > 0.8)  return "vorne";
    if (fv < 0.2)  return "hinten";
    return "vorne";
}

function wechsleRaum(zielId) {
    if (!RAEUME[zielId]) return;
    const vonRaum = aktuellerRaum;
    aktuellerRaum = zielId;
    // Nur Deko des aktuellen Raums anzeigen — in beiden SVG-Ebenen (hinten + vorne).
    document.querySelectorAll("#object-layer > g[data-raum], #object-layer-vorne > g[data-raum]").forEach(g => {
        g.style.display = g.dataset.raum === zielId ? "" : "none";
    });

    // Eintrittsposition = Laufziel der Tür im Zielraum, die zum Herkunftsraum zurückführt
    const rueckTuer = RAEUME[zielId].tueren.find(t => t.ziel === vonRaum);
    const eintritt = (rueckTuer && rueckTuer.laufziel) ? rueckTuer.laufziel : RAUM_EINTRITT;

    figur.fu = eintritt.fu;
    figur.fv = eintritt.fv;
    figur.zielFu = figur.fu;
    figur.zielFv = figur.fv;
    figur.gehphase = 0;
    figur.ankunft = null;
    figur.richtung = eintrittsRichtung(eintritt.fu, eintritt.fv);
    draw();
}

// ---------- Hindernisse (Kollision) ----------
// Drei Hindernis-Typen im fu/fv-System (0..1):
//   • Kreis:    { fu, fv, r }                      — runde/kompakte Objekte (Pflanzen, Octopus)
//   • Ellipse:  { fu, fv, rx, ry }                 — flache/breite Objekte (Tisch1, Kamin)
//   • Viereck:  { punkte: [[fu,fv], ...] }         — konvexes Polygon, ideal für rechteckige
//                                                     Möbel mit gerader Kante (Schrank, Truhe).
// Konvex bedeutet: alle Innenwinkel < 180°. 4 Punkte sind üblich, 3+ funktionieren.
// Werte lassen sich live in der Konsole ändern:  HINDERNISSE.haupt[0].r = 0.08
const HINDERNISSE = {
    haupt: [
        // Radien sind am Fussabdruck der Pflanze orientiert (Topfbasis, nicht Blätter).
        // So kann die Figur knapp vorbei — Körper verschwindet perspektivisch hinter den Blättern.
        { fu: 0.034, fv: 0.787, r: 0.03 }, // yucca (vor dem Tisch links, nach -10x/-50y verschoben)
        { fu: 0.94, fv: 0.78, r: 0.03 },   // geranie (hinten-rechts)
        { fu: 0.12, fv: 0.50, r: 0.035 },  // setzling (mitte-links) — muss Tür L (fv 0.45) frei lassen
        // kraeuter wurde in den Keller verschoben (auf Kaminsims), kein Boden-Hindernis mehr
        { fu: 0.87, fv: 0.15, r: 0.05 },   // blume (vorne-rechts, grösser)
        { fu: 0.15, fv: 0.12, r: 0.05 },   // tulpe (vorne-links, grösser)
        // Tisch 1 + Lavalampe: ELLIPSE statt Kreis (rx > ry → flach), Center hinter den Tisch verschoben
        // (fv=0.88), damit die Ellipse den BACK-AREA mit abdeckt → die Figur kann nicht mehr zwischen
        // linker Wand und Tisch hinter den Tisch durchschlüpfen. Tür A (laufziel fu=0.26 fv=0.92) und
        // Bookshelf (laufziel fu=0.5) liegen ausserhalb der Ellipse.
        { fu: 0.10, fv: 0.88, rx: 0.14, ry: 0.12 },
        // Desk 1 (rechts hinten): Footprint fu 0.74–0.84, fv 0.80–0.91. Tür geheim
        // (laufziel fu=0.88 fv=0.45) und Pflanze geranie (fu=0.94 fv=0.78) liegen ausserhalb.
        { fu: 0.79, fv: 0.86, rx: 0.06, ry: 0.05 },
    ],
    buero: [
        // Tisch 2 (vorderlinks): 3 Kreise decken den L-förmigen Schreibtisch-Footprint ab.
        // Werte interaktiv per Drag-and-Drop im Debug-Modus eingestellt (Manuel).
        { fu: 0.0975, fv: 0.8172, r: 0.1 },     // [0] vorne
        { fu: 0.1745, fv: 0.7503, r: 0.1 },     // [1] mitte
        { fu: 0.2548, fv: 0.8168, r: 0.1 },     // [2] hinten
        // cupboard_1 (rechts an Wand): Viereck am tatsächlichen Boden-Footprint des Schranks.
        // Werte interaktiv eingestellt (Drag-and-Drop, Manuel) — kompakter als der visuelle
        // Pixel-Footprint, nur der Bereich, in dem die Figur physisch im Schrank wäre.
        // Schrank hat KEIN data-fv → immer in Rück-Ebene, Figur überdeckt korrekt.
        { punkte: [[0.7268, 0.9031], [0.9424, 0.808], [0.9991, 0.9295], [0.7411, 0.9996]] },  // [3]
        // bookshelf_2 (hinten an Wand bei x=700..1300): Viereck am tatsächlichen Boden-Footprint
        // hinten an der Wand. Werte interaktiv eingestellt (Drag-and-Drop, Manuel).
        { punkte: [[0.3339, 0.9058], [0.6748, 0.9009], [0.68, 0.9999], [0.3286, 0.9998]] },   // [4]
    ],
    badezimmer: [
        // Octopus hinten-rechts: zentriert ca. fu=0.85 fv=0.80 (Inline-SVG-Mitte), kompakter Kreis.
        { fu: 0.85, fv: 0.80, r: 0.08 },
    ],
    garten:  [],
    keller:  [
        // Kamin (fireplace_1) hinten-links: Display-Footprint x=440-820 y=600 → fv≈0.95, fu≈0.33.
        // Flache Ellipse, damit die Figur knapp davor stehen kann ohne durch das Möbel zu laufen.
        { fu: 0.33, fv: 0.95, rx: 0.18, ry: 0.04 },
        // Schatztruhe (chest_1) vorne-rechts: Display x=908-1118 y=810 → fv≈0.30, fu≈0.65.
        // Breit + flach (rx > ry).
        { fu: 0.65, fv: 0.30, rx: 0.10, ry: 0.04 },
    ],
};
window.HINDERNISSE = HINDERNISSE;

// ---------- Form-Helper: Type-Dispatch zwischen Kreis/Ellipse/Viereck ----------
// Center (Schwerpunkt) eines Hindernisses — für Slide-Algorithmus (Distanz-Suche).
function hindernisCenter(h) {
    if (h.punkte) {
        let fu = 0, fv = 0;
        for (const p of h.punkte) { fu += p[0]; fv += p[1]; }
        return { fu: fu / h.punkte.length, fv: fv / h.punkte.length };
    }
    return { fu: h.fu, fv: h.fv };
}

// Konservativer Maximal-Radius (vom Center) — für Pre-Filter im Slide-Algorithmus.
function hindernisMaxRadius(h) {
    if (h.punkte) {
        const c = hindernisCenter(h);
        let max = 0;
        for (const p of h.punkte) {
            const dfu = p[0] - c.fu, dfv = p[1] - c.fv;
            const d = Math.sqrt(dfu * dfu + dfv * dfv);
            if (d > max) max = d;
        }
        return max;
    }
    return Math.max(h.rx ?? h.r, h.ry ?? h.r);
}

// Punkt-im-konvexes-Polygon-Test (Cross-Product-Variante). Innen ⇔ alle Cross-Vorzeichen
// gleich (oder 0). Funktioniert für jede konvexe Polygon-Punkte-Reihenfolge.
function pktInKonvexPolygon(fu, fv, punkte) {
    let pos = 0, neg = 0;
    for (let i = 0; i < punkte.length; i++) {
        const p1 = punkte[i];
        const p2 = punkte[(i + 1) % punkte.length];
        const cross = (p2[0] - p1[0]) * (fv - p1[1]) - (p2[1] - p1[1]) * (fu - p1[0]);
        if (cross > 0) pos++;
        else if (cross < 0) neg++;
    }
    return pos === 0 || neg === 0;
}

// Test: Liegt (fu, fv) IM Hindernis (innerhalb der Form, nicht auf der Grenze)?
function istInForm(h, fu, fv) {
    if (h.punkte) return pktInKonvexPolygon(fu, fv, h.punkte);
    const dfu = fu - h.fu, dfv = fv - h.fv;
    const rx = h.rx ?? h.r, ry = h.ry ?? h.r;
    return (dfu * dfu) / (rx * rx) + (dfv * dfv) / (ry * ry) < 1;
}

// Projektion eines Punktes auf eine Strecke (clamped). Liefert nächstgelegenen Punkt.
function projektionAufKante(fu, fv, p1, p2) {
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return { fu: p1[0], fv: p1[1] };
    let t = ((fu - p1[0]) * dx + (fv - p1[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { fu: p1[0] + t * dx, fv: p1[1] + t * dy };
}

// Nächster Punkt am Hindernis-Rand zur Position (fu, fv). Plus Normale (nach aussen).
// Genutzt von slide, setzeFigurZiel und Safety-Net.
function naechsterRandUndNormale(h, fu, fv) {
    if (h.punkte) {
        // Nächste Kante finden, auf sie projizieren.
        let bestPkt = null, bestKante = -1, bestDist = Infinity;
        for (let i = 0; i < h.punkte.length; i++) {
            const j = (i + 1) % h.punkte.length;
            const p = projektionAufKante(fu, fv, h.punkte[i], h.punkte[j]);
            const ddu = p.fu - fu, ddv = p.fv - fv;
            const d = ddu * ddu + ddv * ddv;
            if (d < bestDist) { bestDist = d; bestPkt = p; bestKante = i; }
        }
        // Außen-Normale = senkrecht zur Kantenrichtung, vom Center weg gerichtet.
        const k1 = h.punkte[bestKante];
        const k2 = h.punkte[(bestKante + 1) % h.punkte.length];
        const ex = k2[0] - k1[0], ey = k2[1] - k1[1];
        const elen = Math.sqrt(ex * ex + ey * ey) || 1;
        // Zwei Kandidaten, der vom Center weg zeigende ist die Außen-Normale.
        const c = hindernisCenter(h);
        let nx = -ey / elen, ny = ex / elen;
        if ((bestPkt.fu - c.fu) * nx + (bestPkt.fv - c.fv) * ny < 0) { nx = -nx; ny = -ny; }
        return { fu: bestPkt.fu, fv: bestPkt.fv, nx, ny, kante: bestKante };
    }
    // Ellipse: Radial vom Center (Approximation des nächsten Randpunkts).
    const dfu = fu - h.fu, dfv = fv - h.fv;
    const rx = h.rx ?? h.r, ry = h.ry ?? h.r;
    const dEll = (dfu * dfu) / (rx * rx) + (dfv * dfv) / (ry * ry);
    if (dEll < 1e-6) return { fu: h.fu + rx, fv: h.fv, nx: 1, ny: 0, kante: -1 };
    const k = 1 / Math.sqrt(dEll);
    const randFu = h.fu + dfu * k, randFv = h.fv + dfv * k;
    // Außen-Normale = Ellipsen-Gradient.
    let nx = (randFu - h.fu) / (rx * rx);
    let ny = (randFv - h.fv) / (ry * ry);
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    return { fu: randFu, fv: randFv, nx: nx / nlen, ny: ny / nlen, kante: -1 };
}

// ---------- Hauptfunktionen Hindernis-System ----------
function istImHindernis(fu, fv) {
    const hs = HINDERNISSE[aktuellerRaum] || [];
    for (const h of hs) if (istInForm(h, fu, fv)) return true;
    return false;
}

// Gleit-Manöver: Ist der direkte Schritt blockiert, versucht die Figur einen Schritt
// TANGENTIAL am nächstgelegenen blockierenden Hindernis entlang. So „umrundet" sie das
// Hindernis Frame für Frame, statt davor stehen zu bleiben.
// ux, uy = gewünschte Laufrichtung (Einheitsvektor); schritt = Schrittweite.
// Rückgabe: { fu, fv } mit neuer Position, oder null wenn kein Ausweichen möglich.
function slideUmHindernis(ux, uy, schritt) {
    const hs = HINDERNISSE[aktuellerRaum] || [];
    // Finde das in Laufrichtung am nächsten liegende blockierende Hindernis (per Center).
    let blocker = null, bestAlong = Infinity;
    for (const h of hs) {
        const c = hindernisCenter(h);
        const dfu = c.fu - figur.fu, dfv = c.fv - figur.fv;
        const along = dfu * ux + dfv * uy;
        if (along <= 0) continue;                    // Hindernis liegt hinter uns
        const perp = dfu * uy - dfv * ux;
        const r = hindernisMaxRadius(h);
        if (Math.abs(perp) > r + 0.02) continue;     // nicht im Pfad
        if (along < bestAlong) { bestAlong = along; blocker = h; }
    }
    if (!blocker) return null;

    // Tangente an der Hindernis-Grenze: senkrecht zur Außen-Normale am nächsten Randpunkt.
    const rand = naechsterRandUndNormale(blocker, figur.fu, figur.fv);
    const perpX = -rand.ny, perpY = rand.nx;
    // Bevorzugte Seite: positives Dot mit Laufrichtung — Figur gleitet Richtung Ziel.
    const dot = perpX * ux + perpY * uy;
    const sides = [
        { tx: dot >= 0 ?  perpX : -perpX, ty: dot >= 0 ?  perpY : -perpY },
        { tx: dot >= 0 ? -perpX :  perpX, ty: dot >= 0 ? -perpY :  perpY },
    ];
    for (const { tx, ty } of sides) {
        const slidFu = figur.fu + tx * schritt;
        const slidFv = figur.fv + ty * schritt;
        if (slidFu < FIGUR_FU_MIN || slidFu > FIGUR_FU_MAX) continue;
        if (slidFv < FIGUR_FV_MIN || slidFv > FIGUR_FV_MAX) continue;
        if (istImHindernis(slidFu, slidFv)) continue;
        // Oszillations-Schutz: Slide-Schritt, der ungefähr zur letzten Position zurückführen
        // würde (innerhalb halber Schrittweite), wird abgelehnt. Verhindert Hin-und-Her-Pendeln,
        // wenn die Figur direkt auf eine Hindernis-Kante zudrückt und beide Tangenten-Seiten
        // im Wechsel gewählt würden.
        if (figur.letztePosFu !== undefined &&
            Math.abs(slidFu - figur.letztePosFu) < schritt * 0.5 &&
            Math.abs(slidFv - figur.letztePosFv) < schritt * 0.5) {
            continue;
        }
        return { fu: slidFu, fv: slidFv };
    }
    return null;
}

// Ray-Casting-Test: Liegt (x, y) innerhalb des Polygons?
function istInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

const figur = {
    fu: 0.5,
    fv: 0.25,
    zielFu: 0.5,
    zielFv: 0.25,
    richtung: "vorne",
    geschwindigkeit: 0.016,
    gehphase: 0,
    ankunft: null,   // optional: () => void, wird einmalig aufgerufen, wenn figur das Ziel erreicht
    // Vorherige Position (vor dem letzten Bewegungs-Schritt). Wird vom Slide-Algorithmus
    // genutzt, um Oszillation zu erkennen: ein Slide-Schritt, der zurück zur letztePos führt,
    // wird abgelehnt → andere Seite probieren oder stoppen.
    letztePosFu: undefined,
    letztePosFv: undefined,
};

const GEHPHASE_SCHRITT = 0.36;
const BEIN_HUB = 0.22;
const FIGUR_SKALA = 0.95;

// Laufbereich: Abstand, damit der Körper nicht in die Wände ragt.
const FIGUR_FU_MIN = 0.06;
const FIGUR_FU_MAX = 0.94;
const FIGUR_FV_MIN = 0;
const FIGUR_FV_MAX = 0.97;

function fuellePolygon(p, f, nahtlos = false) {
    ctx.fillStyle = f;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.fill();
    // Optional: gleichfarbiger Stroke schliesst Subpixel-Säume zu Nachbar-Polygonen
    // derselben Farbe. Nur dort verwenden, wo solche Säume stören (z.B. Garten-Himmel/Gras);
    // in anderen Räumen bleibt die feine Eckenlinie sichtbar.
    if (nahtlos) {
        ctx.strokeStyle = f;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
function zeichnePolygon(p, f, b = 2) {
    ctx.strokeStyle = f;
    ctx.lineWidth = b;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.stroke();
}

function zeichneZimmer() {
    const f = RAEUME[aktuellerRaum].farben;

    // Garten-Sonderfall: decke, linkeWand und hintereWand sind alle Himmelsblau.
    // Statt drei Polygone (mit sichtbaren Säumen) den gesamten Hintergrund mit einer
    // einzigen Fläche füllen. Andere Räume behalten die feinen Ecken-Linien.
    if (aktuellerRaum === "garten") {
        ctx.fillStyle = f.decke;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        fuellePolygon(ZIMMER.boden, f.boden, true);       // Boden — Stroke schliesst Saum zum Gras
        fuellePolygon(ZIMMER.rechteWand, f.rechteWand);   // Hauswand
        zeichneGartenZaun();
        return;
    }

    fuellePolygon(ZIMMER.decke, f.decke);
    fuellePolygon(ZIMMER.boden, f.boden);
    fuellePolygon(ZIMMER.linkeWand, f.linkeWand);
    fuellePolygon(ZIMMER.rechteWand, f.rechteWand);
    fuellePolygon(ZIMMER.hintereWand, f.hintereWand);
}

// Sonne: gelber Kreis + 12 Strahlen. Oben rechts auf dem Himmel.
function zeichneSonne() {
    const cx = 1200, cy = 200, r = 42;
    const gelb = "#ffd84a";
    ctx.strokeStyle = gelb;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    const N = 12;
    for (let i = 0; i < N; i++) {
        const a = i * 2 * Math.PI / N;
        const r1 = r + 14, r2 = r + 44;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
    }
    ctx.fillStyle = gelb;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fill();
}

// Busch: überlappende Ellipsen-Cluster, Form leicht variiert.
function zeichneBusch(cx, cy, breite, farbe) {
    const h = breite * 0.78;
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.ellipse(cx, cy, breite / 2, h / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - breite * 0.32, cy + h * 0.08, breite * 0.26, h * 0.32, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + breite * 0.30, cy + h * 0.05, breite * 0.28, h * 0.34, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - breite * 0.12, cy - h * 0.38, breite * 0.23, h * 0.24, 0, 0, 2 * Math.PI);
    ctx.fill();
}

// Horizont-Büsche. `vor: true` = wird NACH dem Gras gezeichnet (vor der Wiese sichtbar).
// Default = als Silhouette hinter dem Gras (unterer Teil wird vom Gras verdeckt).
const GEBUESCH_HORIZONT = [
    { cx: 380,  cy: 330, b: 42, f: "#5A9A4A" },                // 1: Silhouette
    { cx: 510,  cy: 326, b: 52, f: "#6CAF5B", vor: true },     // 2: vor Gras
    { cx: 640,  cy: 332, b: 38, f: "#5A9A4A", vor: true },     // 3: vor Gras
    { cx: 780,  cy: 328, b: 46, f: "#7CC06C" },                // 4: Silhouette
    { cx: 910,  cy: 330, b: 50, f: "#6CAF5B", vor: true },     // 5: vor Gras
    { cx: 1050, cy: 327, b: 40, f: "#5A9A4A", vor: true },     // 6: vor Gras
    { cx: 1190, cy: 332, b: 36, f: "#7CC06C" },                // 7: Silhouette
];

// Nah-Büsche auf linker Wiese (sitzen auf der Wand-Bodenlinie).
// Der mittlere Punkt (170,620) wurde entfernt, damit bush_4 dort Platz hat.
const GEBUESCH_NAH = [
    { cx: 40,  cy: 820, b: 75, f: "#6CAF5B" },
    { cx: 110, cy: 720, b: 62, f: "#7CC06C" },
    { cx: 230, cy: 500, b: 36, f: "#8ED085" },
];

// --- Detaillierte SVG-Büsche auf der Wiese (rasterisiert via drawImage). ---
// Werden auf dem Zimmer-Canvas gezeichnet, damit der Zaun einige davon verdecken kann.
// Jede Definition: { src, cx, baseY, breite, hoehe } — cx = horizontale Mitte, baseY = Fusslinie.
const BUESCHE = {
    linksWiese:    { src: "assets/bush_4.svg", cx: 185, baseY: 650, breite: 480, hoehe: 492 },
    hintenTief:    { src: "assets/bush_1.svg", cx: 1150, baseY: 550, breite: 360, hoehe: 150 }, // tief hinter Zaun
    hintenGanz:    { src: "assets/bush_2.svg", cx: 570, baseY: 410, breite: 80, hoehe: 80 }, // oberhalb des Zauns
    hintenHalb:    { src: "assets/bush_3.svg", cx: 100, baseY: 378, breite: 150, hoehe: 160 }, // 
};

// Image-Cache mit automatischem Redraw nach Load (SVG-Rasterisierung durch Browser).
const BUSCH_BILDER = {};
function ladeBuschBild(src) {
    if (BUSCH_BILDER[src]) return BUSCH_BILDER[src];
    const img = new Image();
    img.onload = () => { if (loopGestartet) draw(); };
    img.onerror = () => console.warn(`Busch konnte nicht geladen werden: ${src}`);
    img.src = src;
    BUSCH_BILDER[src] = img;
    return img;
}

function zeichneBuschBild(def) {
    const img = ladeBuschBild(def.src);
    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, def.cx - def.breite / 2, def.baseY - def.hoehe, def.breite, def.hoehe);
    }
}

// Garten: Himmel + Sonne + Wiese mit Gebüsch + Zaun.
// Reihenfolge: Sonne → Horizont-Büsche → Wiese → Nah-Büsche → Zäune
function zeichneGartenZaun() {
    const HORIZON_Y = 340;
    const GRAS = "#4e8c3f";
    const VERSTREBUNG = "#8b6937";
    const PFOSTEN = "#5d4027";

    // Sonne im oberen rechten Bereich des Himmels
    zeichneSonne();

    // Horizont-Büsche ohne `vor`-Flag: als Silhouette hinter dem Gras.
    GEBUESCH_HORIZONT.filter(b => !b.vor).forEach(b => zeichneBusch(b.cx, b.cy, b.b, b.f));

    // Grashorizont: hinten + links (perspektivisch als Wiese). `nahtlos: true` schliesst
    // den Subpixel-Saum zum Boden-Polygon und zwischen den beiden Gras-Polygonen.
    fuellePolygon([[300, HORIZON_Y], [1300, HORIZON_Y], [1300, 600], [300, 600]], GRAS, true);
    fuellePolygon([[0, HORIZON_Y], [300, HORIZON_Y], [300, 600], [0, 900]], GRAS, true);

    // Horizont-Büsche mit `vor`-Flag: auf dem Gras stehend (voll sichtbar).
    GEBUESCH_HORIZONT.filter(b => b.vor).forEach(b => zeichneBusch(b.cx, b.cy, b.b, b.f));

    // Nah-Büsche auf linker Wiese (zwischen Wiese und Zaun)
    GEBUESCH_NAH.forEach(b => zeichneBusch(b.cx, b.cy, b.b, b.f));

    // bush_4 auf der linken Wiese — vor den Ellipsen, noch vor dem linken Zaun.
    zeichneBuschBild(BUESCHE.linksWiese);

    // Detaillierte Büsche hinter dem Hintenzaun — Zaun wird GLEICH danach gezeichnet
    // und verdeckt die Teile, die in den Zaunbereich (y ≥ 420) hineinragen.
    zeichneBuschBild(BUESCHE.hintenTief);   // bush_1 — tief hinter dem Zaun
    zeichneBuschBild(BUESCHE.hintenHalb);   // bush_3 — teilweise hinter dem Zaun

    // Zaun an hinterer Wand — horizontale Verstrebungen und 9 Pfosten
    ctx.fillStyle = VERSTREBUNG;
    ctx.fillRect(300, 465, 1000, 10);
    ctx.fillRect(300, 555, 1000, 10);
    ctx.fillStyle = PFOSTEN;
    const postenX = [305, 429, 552, 676, 800, 924, 1048, 1171, 1295];
    postenX.forEach(x => ctx.fillRect(x - 6, 420, 12, 180));

    // bush_2 — sitzt komplett oberhalb des Zauns; wird nach dem Zaun gezeichnet,
    // damit ein möglicher minimaler Overlap mit der Pfosten-Oberkante sauber aussieht.
    zeichneBuschBild(BUESCHE.hintenGanz);

    // Zaun an linker Wand — perspektivisch via linkeWandPunkt(u, v)
    // Gleiche v-Bereiche wie am Hintenzaun, damit sie am Eck zusammenpassen.
    const ZAUN_V = 0.36;
    const RAIL_UP = [0.25, 0.27];
    const RAIL_DN = [0.07, 0.09];
    fuellePolygon([
        linkeWandPunkt(0, RAIL_DN[0]), linkeWandPunkt(1, RAIL_DN[0]),
        linkeWandPunkt(1, RAIL_DN[1]), linkeWandPunkt(0, RAIL_DN[1]),
    ], VERSTREBUNG);
    fuellePolygon([
        linkeWandPunkt(0, RAIL_UP[0]), linkeWandPunkt(1, RAIL_UP[0]),
        linkeWandPunkt(1, RAIL_UP[1]), linkeWandPunkt(0, RAIL_UP[1]),
    ], VERSTREBUNG);
    // 8 Pfosten von vorne (u=0.04) nach hinten, Abstand 0.12 — der letzte Pfosten
    // liegt eine volle Lücke vom Eck-Pfosten der Rückwand entfernt.
    const PFOSTEN_U = [0.04, 0.16, 0.28, 0.40, 0.52, 0.64, 0.76, 0.88];
    const HALBBREITE_U = 0.013;
    PFOSTEN_U.forEach(u => {
        const uL = Math.max(0, u - HALBBREITE_U);
        const uR = Math.min(1, u + HALBBREITE_U);
        fuellePolygon([
            linkeWandPunkt(uL, 0), linkeWandPunkt(uR, 0),
            linkeWandPunkt(uR, ZAUN_V), linkeWandPunkt(uL, ZAUN_V),
        ], PFOSTEN);
    });

    // Rechte Hauswand nochmal drüberzeichnen, damit Büsche, die über die Wand-Kante
    // bei x=1300 hinausragen (z.B. bush_1 in der neuen Position), sauber abgeschnitten werden.
    fuellePolygon(ZIMMER.rechteWand, RAEUME.garten.farben.rechteWand);
}

// Kleines Schloss-Icon: Bügel (Torus-Segment) + Korpus. Skaliert über `groesse`.
function zeichneSchloss(cx, cy, groesse) {
    const bw = groesse * 0.9;             // Korpus-Breite
    const bh = groesse * 0.75;            // Korpus-Höhe
    const bx = cx - bw / 2;
    const by = cy - bh / 2 + groesse * 0.15;
    const buegelR = groesse * 0.32;
    const buegelY = by - groesse * 0.05;

    ctx.strokeStyle = GRAU.b100;
    ctx.fillStyle = GRAU.b0;
    ctx.lineWidth = groesse * 0.14;

    // Bügel (halber Ring über dem Korpus)
    ctx.beginPath();
    ctx.arc(cx, buegelY, buegelR, Math.PI, 2 * Math.PI);
    ctx.stroke();

    // Korpus
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, groesse * 0.1);
    ctx.fill();
    ctx.stroke();

    // Schlüsselloch
    ctx.fillStyle = GRAU.b100;
    ctx.beginPath();
    ctx.arc(cx, cy + groesse * 0.15, groesse * 0.08, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillRect(cx - groesse * 0.04, cy + groesse * 0.15, groesse * 0.08, groesse * 0.22);
}

function zeichneTueren() {
    RAEUME[aktuellerRaum].tueren.forEach(t => {
        if (t.pfeil) {
            fuellePolygon(t.polygon, FARBEN.pfeil);
            return;
        }
        const frei = istFrei(t);
        if (t.secret) {
            fuellePolygon(t.polygon, FARBEN.tuerGeheim);
        } else {
            fuellePolygon(t.polygon, FARBEN.tuer);
        }
        const cx = t.polygon.reduce((s, pp) => s + pp[0], 0) / t.polygon.length;
        const cy = t.polygon.reduce((s, pp) => s + pp[1], 0) / t.polygon.length;
        if (t.label) {
            ctx.fillStyle = FARBEN.tuerLabel;
            ctx.font = "bold 60px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(t.label, cx, cy);
        }
        if (!frei && !t.secret) {
            // Schloss-Icon unten an der Tür (Geheim-Türen bleiben visuell verborgen).
            const minY = Math.min(...t.polygon.map(p => p[1]));
            const maxY = Math.max(...t.polygon.map(p => p[1]));
            const hoehe = maxY - minY;
            const iconY = maxY - hoehe * 0.18;
            zeichneSchloss(cx, iconY, 60);
        }
    });
}

function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
}

// Weisser Lächel-Mondschnitz (dünne Sichel, nach oben offen = ∪)
function zeichneLaecheln(cx, cy, breite, dicke) {
    ctx.fillStyle = FARBEN.mund;
    ctx.beginPath();
    const links = cx - breite;
    const rechts = cx + breite;
    const tiefe = breite * 0.55;
    ctx.moveTo(links, cy);
    ctx.quadraticCurveTo(cx, cy + tiefe, rechts, cy);
    ctx.quadraticCurveTo(cx, cy + tiefe - dicke, links, cy);
    ctx.closePath();
    ctx.fill();
}

function zeichneFigur() {
    const [fx, fy] = bodenPunkt(figur.fu, figur.fv);
    const s = (1 - 0.45 * figur.fv) * FIGUR_SKALA;
    const r = figur.richtung;

    const headR = 52 * s;
    const bodyW = 115 * s;
    const bodyH = 185 * s;
    const neckH = 16 * s;
    const armW = 28 * s;
    const armH = 160 * s;
    const legW = 36 * s;
    const legGap = 10 * s;
    const legH = 235 * s;
    const rad = 9 * s;

    const bodyBottom = fy - legH;
    const bodyTop = bodyBottom - bodyH;
    const neckY = bodyTop - neckH;
    // Kopf minimal in den Hals hineingesetzt, damit die Hals-Rundungen nicht sichtbar bleiben.
    const headY = neckY - headR + 5 * s;

    // ---- Beine (mit Gehanimation, ohne Schuhe) ----
    const hubLinks = Math.max(0, Math.sin(figur.gehphase)) * BEIN_HUB;
    const hubRechts = Math.max(0, Math.sin(figur.gehphase + Math.PI)) * BEIN_HUB;
    const beinLinks = legH * (1 - hubLinks);
    const beinRechts = legH * (1 - hubRechts);

    ctx.fillStyle = FARBEN.hose;
    roundRect(fx - legGap / 2 - legW, bodyBottom, legW, beinLinks, rad * 0.4);
    ctx.fill();
    roundRect(fx + legGap / 2, bodyBottom, legW, beinRechts, rad * 0.4);
    ctx.fill();

    // ---- Körper ----
    const isSide = r === "links" || r === "rechts";
    const bw = isSide ? bodyW * 0.9 : bodyW;
    ctx.fillStyle = FARBEN.hemd;
    roundRect(fx - bw / 2, bodyTop, bw, bodyH, rad);
    ctx.fill();

    // ---- Arme ----
    const aY = bodyTop + 10 * s;
    if (!isSide) {
        roundRect(fx - bw / 2 - armW, aY, armW, armH, rad);
        ctx.fill();
        roundRect(fx + bw / 2, aY, armW, armH, rad);
        ctx.fill();
    } else {
        const swing = Math.sin(figur.gehphase + Math.PI) * 8 * s;
        roundRect(fx - armW / 2 + swing, aY, armW, armH, rad);
        ctx.fill();
    }

    // ---- Hals ----
    ctx.fillStyle = FARBEN.kopf;
    roundRect(fx - headR * 0.28, neckY, headR * 0.56, neckH + 2 * s, rad * 0.4);
    ctx.fill();

    // ---- Kopf ----
    ctx.beginPath();
    ctx.arc(fx, headY, headR, 0, 2 * Math.PI);
    ctx.fill();

    // ---- Gesicht ----
    const augenR = headR * 0.1;
    if (r === "vorne") {
        // Nase: senkrechtes Oval, leicht rotiert
        ctx.fillStyle = FARBEN.nase;
        ctx.beginPath();
        ctx.ellipse(fx, headY + headR * 0.18, headR * 0.1, headR * 0.22, Math.PI / 12, 0, 2 * Math.PI);
        ctx.fill();

        // Augen: weisse Kreise
        ctx.fillStyle = FARBEN.augen;
        ctx.beginPath();
        ctx.arc(fx - headR * 0.35, headY - headR * 0.05, augenR, 0, 2 * Math.PI);
        ctx.arc(fx + headR * 0.35, headY - headR * 0.05, augenR, 0, 2 * Math.PI);
        ctx.fill();

        // Mund: Lächeln
        zeichneLaecheln(fx, headY + headR * 0.48, headR * 0.48, headR * 0.2);
    } else if (isSide) {
        const seite = r === "links" ? -1 : 1;

        // Nase: waagrechtes Oval, Spitze nach unten-aussen rotiert
        ctx.fillStyle = FARBEN.nase;
        ctx.beginPath();
        ctx.ellipse(fx + seite * headR * 0.95, headY + headR * 0.12, headR * 0.27, headR * 0.13, seite * 0.6, 0, 2 * Math.PI);
        ctx.fill();

        // Auge
        ctx.fillStyle = FARBEN.augen;
        ctx.beginPath();
        ctx.arc(fx + seite * headR * 0.28, headY - headR * 0.05, augenR, 0, 2 * Math.PI);
        ctx.fill();

        // Mund
        zeichneLaecheln(fx + seite * headR * 0.35, headY + headR * 0.48, headR * 0.36, headR * 0.17);
    }
    // hinten: kein Gesicht
}

function zeichneObjekte() {
    const objekte = OBJEKTE[aktuellerRaum] || [];
    for (const obj of objekte) {
        if (obj.aufgenommen) continue;
        if (typeof obj.zeichnen === "function") obj.zeichnen(ctx);
    }
}

// Debug-Render: Hindernisse als halbtransparente Polygone auf den Front-Canvas zeichnen.
// Aktiv, wenn window.HINDERNIS_DEBUG === true. Konsolen-Toggle: hindernisDebug(true|false).
// Pro Hindernis eine eindeutige Farbe (HSL) + Index-Beschriftung. Vierecke zeigen Eckpunkte
// (klickbare-aussehende Marker) mit "<hindernisIdx>.<eckIdx>", sodass per Konsole gezielt
// verschoben werden kann: HINDERNISSE.buero[3].punkte[0] = [0.70, 0.62]
function zeichneHindernisseDebug() {
    if (!window.HINDERNIS_DEBUG) return;
    const hs = HINDERNISSE[aktuellerRaum] || [];
    hs.forEach((h, idx) => {
        const farbe   = `hsla(${(idx * 67) % 360}, 75%, 50%, 0.30)`;
        const linie   = `hsla(${(idx * 67) % 360}, 75%, 30%, 0.95)`;
        const punktBg = `hsla(${(idx * 67) % 360}, 80%, 25%, 1)`;
        ctx.fillStyle = farbe;
        ctx.strokeStyle = linie;
        ctx.lineWidth = 2;
        if (h.punkte) {
            // Polygon füllen
            ctx.beginPath();
            h.punkte.forEach((p, i) => {
                const [x, y] = bodenPunkt(p[0], p[1]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Eckpunkt-Marker mit "<hidx>.<eckIdx>"-Label
            h.punkte.forEach((p, i) => {
                const [x, y] = bodenPunkt(p[0], p[1]);
                ctx.fillStyle = punktBg;
                ctx.beginPath();
                ctx.arc(x, y, 11, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.font = "bold 13px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(`${idx}.${i}`, x, y);
            });
        } else {
            // Kreis/Ellipse: 32-fach gesampelte Kontur, perspektivisch korrekt auf den Boden projiziert
            const rx = h.rx ?? h.r;
            const ry = h.ry ?? h.r;
            ctx.beginPath();
            const SAMPLES = 36;
            for (let s = 0; s < SAMPLES; s++) {
                const theta = (s * 2 * Math.PI) / SAMPLES;
                const fu = h.fu + Math.cos(theta) * rx;
                const fv = h.fv + Math.sin(theta) * ry;
                const [x, y] = bodenPunkt(fu, fv);
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Center-Marker mit Index
            const [cx, cy] = bodenPunkt(h.fu, h.fv);
            ctx.fillStyle = punktBg;
            ctx.beginPath();
            ctx.arc(cx, cy, 11, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${idx}`, cx, cy);
        }
    });
}

// Konsolen-Helfer: Debug-Anzeige der Hindernisse ein/aus.
window.hindernisDebug = (an = true) => {
    window.HINDERNIS_DEBUG = !!an;
    if (typeof draw === "function") draw();
    return window.HINDERNIS_DEBUG ? "Hindernis-Debug AN" : "Hindernis-Debug AUS";
};
// Default: AUS. Per Konsole einschalten: hindernisDebug(true).
if (typeof window.HINDERNIS_DEBUG === "undefined") window.HINDERNIS_DEBUG = false;

function draw() {
    // Hintere Ebene: Zimmer + Türen + Objekte (unter der SVG-Dekoration)
    ctx = ctxRaum;
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    zeichneZimmer();
    zeichneTueren();
    zeichneObjekte();
    // Vordere Ebene: Figur (über der SVG-Dekoration)
    ctx = ctxFigur;
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    zeichneFigur();
    zeichneHindernisseDebug();   // Debug-Overlay (nur wenn HINDERNIS_DEBUG=true)
    // Pflanzen mit data-fv zwischen Rück- und Front-SVG togglen (perspektivische Tiefensortierung).
    aktualisierePflanzenTiefe();
}

// Beim Ankommen: wenn ein Bein mitten in der Hebung war, abschliessenden Landungs-Sound spielen.
// Fängt zwei Fälle ab: (a) sehr kurze Wege ohne π-Crossing, (b) Arrival zwischen zwei Schritten.
function beendeSchrittWennInLuft() {
    if (figur.gehphase <= 0) return;
    const hubLinks  = Math.sin(figur.gehphase);
    const hubRechts = Math.sin(figur.gehphase + Math.PI);
    if (hubLinks > 0.3 || hubRechts > 0.3) spieleSchritt();
    figur.gehphase = 0;
}

function aktualisiereFigur() {
    // Safety-Net: Falls die Figur (z.B. nach einer Hindernis-Anpassung) in einem Hindernis
    // gelandet ist, vor allem anderen zum nächsten Randpunkt schieben (entlang Außen-Normale).
    // Form-agnostisch über naechsterRandUndNormale().
    const hsCur = HINDERNISSE[aktuellerRaum] || [];
    for (const h of hsCur) {
        if (!istInForm(h, figur.fu, figur.fv)) continue;
        const r = naechsterRandUndNormale(h, figur.fu, figur.fv);
        figur.fu = r.fu + r.nx * 0.005;
        figur.fv = r.fv + r.ny * 0.005;
        figur.fu = Math.max(FIGUR_FU_MIN, Math.min(FIGUR_FU_MAX, figur.fu));
        figur.fv = Math.max(FIGUR_FV_MIN, Math.min(FIGUR_FV_MAX, figur.fv));
    }

    const dx = figur.zielFu - figur.fu;
    const dy = figur.zielFv - figur.fv;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) {
        beendeSchrittWennInLuft();
        loeseAnkunftAus();
        return;
    }
    if (dist < figur.geschwindigkeit) {
        figur.fu = figur.zielFu;
        figur.fv = figur.zielFv;
        beendeSchrittWennInLuft();
        loeseAnkunftAus();
        return;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    let neueFu = figur.fu + ux * figur.geschwindigkeit;
    let neueFv = figur.fv + uy * figur.geschwindigkeit;

    // Hindernis-Test: Würde der direkte Schritt in eine Pflanze laufen?
    // → Automatische Umgehung: tangential am Hindernis entlang gleiten.
    if (istImHindernis(neueFu, neueFv)) {
        const slid = slideUmHindernis(ux, uy, figur.geschwindigkeit);
        if (slid) {
            neueFu = slid.fu;
            neueFv = slid.fv;
        } else {
            // Keine Gleite möglich (z.B. zwischen zwei Hindernissen) → doch stoppen.
            figur.zielFu = figur.fu;
            figur.zielFv = figur.fv;
            figur.ankunft = null;
            beendeSchrittWennInLuft();
            return;
        }
    }

    // Tatsächliche Bewegungsrichtung (kann von gewünschter Richtung abweichen, falls gegleitet wurde).
    const bewegDx = neueFu - figur.fu;
    const bewegDy = neueFv - figur.fv;
    // Letzte Position für Oszillations-Schutz im nächsten Slide-Schritt merken.
    figur.letztePosFu = figur.fu;
    figur.letztePosFv = figur.fv;
    figur.fu = neueFu;
    figur.fv = neueFv;

    const prevPhase = figur.gehphase;
    figur.gehphase = (figur.gehphase + GEHPHASE_SCHRITT) % (2 * Math.PI);
    // Schritt-Sound: Fuss landet bei phase = π (links) und phase ≈ 0/2π (rechts; Wrap-Around)
    if (prevPhase < Math.PI && figur.gehphase >= Math.PI) spieleSchritt();
    else if (figur.gehphase < prevPhase) spieleSchritt();

    // Figur schaut in die tatsächliche Laufrichtung — beim Gleiten dreht sie sich entsprechend.
    if (Math.abs(bewegDx) > Math.abs(bewegDy)) {
        figur.richtung = bewegDx > 0 ? "rechts" : "links";
    } else {
        figur.richtung = bewegDy > 0 ? "hinten" : "vorne";
    }
}

function loeseAnkunftAus() {
    if (!figur.ankunft) return;
    const cb = figur.ankunft;
    figur.ankunft = null;
    cb();
}

let loopGestartet = false;

function loop() {
    aktualisiereFigur();
    draw();
    requestAnimationFrame(loop);
}

const gameStage = document.getElementById("game-stage");
const STAGE_PADDING = 0; // Stage füllt den Viewport voll aus (16:9-Letterbox per body-bg)

function resizeCanvas() {
    // Stage-Grösse aus Viewport berechnen (16:9 einpassen)
    const availW = window.innerWidth - STAGE_PADDING;
    const availH = window.innerHeight - STAGE_PADDING;
    let stageW, stageH;
    if (availW * 9 / 16 <= availH) {
        stageW = availW;
        stageH = stageW * 9 / 16;
    } else {
        stageH = availH;
        stageW = stageH * 16 / 9;
    }
    gameStage.style.width = stageW + "px";
    gameStage.style.height = stageH + "px";

    // Canvas-interne Auflösung (DPR-aware) — beide Canvases
    const dpr = window.devicePixelRatio || 1;
    const pxW = Math.round(stageW * dpr);
    const pxH = Math.round(stageH * dpr);
    const scale = pxW / LOGICAL_WIDTH;
    [canvas, canvasFigur].forEach(c => {
        c.width = pxW;
        c.height = pxH;
        c.getContext("2d").setTransform(scale, 0, 0, scale, 0, 0);
    });
    draw();
}

// ---------- Deko-Generatoren ----------

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSVG(tag, attrs = {}, kinder = []) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const c of kinder) el.appendChild(c);
    return el;
}

// Strauch: 5 Blatt-Cluster + Ast-Pfad (Boden entfernt). Pfade aus assets/plant_strauch.svg.
const STRAUCH_BLATT_PFADE = [
    "M220.051,350.316c0-116.359-48.82-143.719-152.702-143.719C67.349,318.922,135.993,350.316,220.051,350.316",
    "M318.858,377.263c0-97.801,44.014-116.772,125.754-116.772C446.148,355.301,403.517,377.263,318.858,377.263",
    "M345.805,0c22.878,70.593-33.603,111.409-77.474,116.772C235.689,68.285,258.226,11.929,345.805,0",
    "M229.033,197.614c-75.228,0-89.825-35.93-89.825-98.807C212.137,97.621,229.033,132.491,229.033,197.614",
    "M300.893,233.544c81.902,0,116.772-9.324,116.772-116.772C335.763,116.772,300.893,126.096,300.893,233.544",
];
const STRAUCH_AST_PFAD = "M380.989,319.785c-1.985-4.554-7.285-6.638-11.821-4.653c-27.675,12.045-44.598,35.292-57.488,56.652c-12.09,12.917-25.295,27.693-37.735,45.586V296.422c0-12.189,13.483-35.014,33.549-56.787c1.015-1.105,2.425-2.677,4.177-4.626c9.854-11.021,30.361-33.927,48.658-48.29c3.907-3.063,4.581-8.713,1.527-12.611c-3.072-3.907-8.713-4.581-12.611-1.527c-19.546,15.342-40.762,39.047-50.966,50.445l-3.988,4.428c-4.114,4.464-12.477,13.977-20.345,25.402V152.775c0.243-32.463,5.857-52.341,21.423-75.974c2.731-4.141,1.59-9.71-2.551-12.441c-4.15-2.74-9.719-1.59-12.45,2.56c-17.498,26.561-24.109,49.79-24.387,85.711c0,0.018,0.009,0.027,0.009,0.036c0,0.009-0.009,0.027-0.009,0.036v63.236c-9.054-12.917-18.513-22.582-20.345-24.414l-35.93-38.93c-3.359-3.638-9.036-3.871-12.692-0.503c-3.647,3.359-3.871,9.045-0.512,12.692l36.181,39.181c9.261,9.261,33.298,37.475,33.298,56.527v114.113c-8.147-10.213-15.854-17.498-22.16-23.408c-2.569-2.407-4.833-4.545-6.782-6.593c-24.432-38.014-49.008-62.356-75.102-74.312c-4.5-2.057-9.845-0.099-11.911,4.419c-2.066,4.509-0.09,9.845,4.428,11.911c23.067,10.572,45.316,32.993,68.024,68.536c0.234,0.35,0.53,0.629,0.799,0.943c0.09,0.117,0.117,0.252,0.225,0.359c2.255,2.416,4.976,4.967,8.03,7.842c9.414,8.821,22.178,20.884,34.448,42.361v96.355c0,4.958,4.024,8.982,8.982,8.982s8.982-4.024,8.982-8.982v-51.541c15.558-28.663,34.681-50.167,51.469-68.069c0.099-0.108,0.126-0.243,0.216-0.359c0.323-0.368,0.665-0.728,0.925-1.159c11.498-19.16,26.39-40.107,49.781-50.284C380.881,329.621,382.965,324.33,380.989,319.785";

// 4 Strauch-Varianten: welche Blätter, welche Grüntöne
const STRAUCH_VARIANTEN = [
    { blaetter: [1,1,1,1,1], blattFarbe: "#81C784", astFarbe: "#4CAF50" },  // voll, lebhaft
    { blaetter: [1,1,0,1,1], blattFarbe: "#6FB271", astFarbe: "#3E8C42" },  // ohne Spitze, dunkler
    { blaetter: [1,0,1,0,1], blattFarbe: "#8CC983", astFarbe: "#56A14F" },  // licht, gelbgrün
    { blaetter: [1,1,1,1,1], blattFarbe: "#97D099", astFarbe: "#65B862" },  // voll, heller
];

// Positionen & Varianten für 12 Sträucher im Garten (fu, fv, basisBreite, Variante)
const STRAEUCHER_GARTEN = [
    { fu: 0.12, fv: 0.12, bw: 80, v: 0 },
    { fu: 0.28, fv: 0.18, bw: 75, v: 2 },
    { fu: 0.72, fv: 0.15, bw: 88, v: 1 },
    { fu: 0.88, fv: 0.20, bw: 72, v: 3 },
    { fu: 0.15, fv: 0.42, bw: 71, v: 1 },
    { fu: 0.38, fv: 0.38, bw: 68, v: 0 },
    { fu: 0.62, fv: 0.40, bw: 72, v: 2 },
    { fu: 0.85, fv: 0.44, bw: 92, v: 3 },
    { fu: 0.18, fv: 0.72, bw: 87, v: 2 },
    { fu: 0.40, fv: 0.82, bw: 69, v: 0 },
    { fu: 0.62, fv: 0.78, bw: 77, v: 3 },
    { fu: 0.85, fv: 0.73, bw: 100, v: 1 },
];

function erzeugeStrauch({ fu, fv, bw, v }) {
    const [bx, by] = bodenPunkt(fu, fv);
    const s = 1 - 0.45 * fv;
    const sigma = s * bw / 512;
    const variante = STRAUCH_VARIANTEN[v];
    const kinder = [];
    STRAUCH_BLATT_PFADE.forEach((d, i) => {
        if (variante.blaetter[i]) {
            kinder.push(makeSVG("path", { fill: variante.blattFarbe, d }));
        }
    });
    kinder.push(makeSVG("path", { fill: variante.astFarbe, d: STRAUCH_AST_PFAD }));
    return makeSVG("g", {
        transform: `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${sigma.toFixed(4)}) translate(-256 -510)`,
    }, kinder);
}

function baueGartenDeko() {
    const gruppe = document.querySelector('[data-raum="garten"]');
    if (!gruppe) return;
    // NICHT innerHTML="" — sonst werden inline platzierte Deko-Elemente (z.B. Blumen)
    // im HTML mit gelöscht. Stattdessen nur die programmatisch erzeugten Sträucher
    // entfernen (Marker data-generated="strauch") und neu aufbauen.
    gruppe.querySelectorAll('[data-generated="strauch"]').forEach(el => el.remove());

    // Sträucher innen: hinten zuerst zeichnen (höheres fv → weiter weg)
    const sortiert = [...STRAEUCHER_GARTEN].sort((a, b) => b.fv - a.fv);
    sortiert.forEach(s => {
        const el = erzeugeStrauch(s);
        el.setAttribute('data-generated', 'strauch');
        gruppe.appendChild(el);
    });
}

// Bild auf der linken Wand im Büro (Wand-Koords via linkeWandPunkt). Rahmen + Leinwand
// als Polygone, Kreise als 12-Punkt-cubic-Bezier-Pfade ebenfalls in Wand-(u,v) — also
// alle Punkte werden bilinear auf die schräge Wand abgebildet, dadurch entsteht die
// perspektivische Verzerrung automatisch (Fluchtpunkt 800/225).
const BUERO_BILD = {
    // Rahmen-Mitte (uMid=0.365, vMid=0.595), Größe Δu=0.555 × Δv=0.345 (×1.5 ggü. Original).
    rahmen:   { uMin: 0.0875, uMax: 0.6425, vMin: 0.4225, vMax: 0.7675 },
    leinwand: { uMin: 0.1145, uMax: 0.6155, vMin: 0.4555, vMax: 0.7345 },
    rahmenFarbe:   "#2a1c10",
    leinwandFarbe: "#f3e6c8",
    kreise: [
        // (cu, cv) und r um den Faktor 1.5 von der neuen Mitte (0.365, 0.595) skaliert.
        { cu: 0.2225, cv: 0.5245, r: 0.075, farbe: "#E63946" },  // rot, vorne unten
        { cu: 0.2975, cv: 0.6445, r: 0.075, farbe: "#1D9BF0" },  // blau, vorne oben
        { cu: 0.4175, cv: 0.5845, r: 0.090, farbe: "#FFD43B" },  // gelb, mitte (gross)
        { cu: 0.5075, cv: 0.6595, r: 0.057, farbe: "#06D6A0" },  // grün, hinten oben
        { cu: 0.5375, cv: 0.5245, r: 0.060, farbe: "#9B5DE5" },  // violett, hinten unten
        { cu: 0.3575, cv: 0.5095, r: 0.045, farbe: "#FF8A00" },  // orange, klein vorne
    ],
};

function wandQuadPunkte(uMin, uMax, vMin, vMax) {
    return [[uMin, vMin], [uMax, vMin], [uMax, vMax], [uMin, vMax]]
        .map(([u, v]) => linkeWandPunkt(u, v))
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ");
}

function wandKreisPfad(cu, cv, r) {
    const k = 0.5523;  // cubic-Bezier-Approximation für Kreis
    const uvPunkte = [
        [cu+r,   cv    ], [cu+r,   cv+r*k], [cu+r*k, cv+r  ],
        [cu,     cv+r  ], [cu-r*k, cv+r  ], [cu-r,   cv+r*k],
        [cu-r,   cv    ], [cu-r,   cv-r*k], [cu-r*k, cv-r  ],
        [cu,     cv-r  ], [cu+r*k, cv-r  ], [cu+r,   cv-r*k],
    ];
    const [P0,P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11] = uvPunkte.map(([u,v]) => linkeWandPunkt(u, v));
    const f = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    return `M ${f(P0)} ` +
           `C ${f(P1)} ${f(P2)} ${f(P3)} ` +
           `C ${f(P4)} ${f(P5)} ${f(P6)} ` +
           `C ${f(P7)} ${f(P8)} ${f(P9)} ` +
           `C ${f(P10)} ${f(P11)} ${f(P0)} Z`;
}

function baueBueroBild() {
    const gruppe = document.querySelector('[data-raum="buero"]');
    if (!gruppe) return;
    gruppe.querySelectorAll('[data-generated="bueroBild"]').forEach(el => el.remove());

    const r = BUERO_BILD.rahmen;
    const l = BUERO_BILD.leinwand;
    const wrapper = makeSVG("g", { "data-generated": "bueroBild" });
    wrapper.appendChild(makeSVG("defs", {}, [
        makeSVG("clipPath", { id: "bueroBildClip" }, [
            makeSVG("polygon", { points: wandQuadPunkte(l.uMin, l.uMax, l.vMin, l.vMax) }),
        ]),
    ]));
    wrapper.appendChild(makeSVG("polygon", {
        points: wandQuadPunkte(r.uMin, r.uMax, r.vMin, r.vMax),
        fill: BUERO_BILD.rahmenFarbe,
    }));
    wrapper.appendChild(makeSVG("polygon", {
        points: wandQuadPunkte(l.uMin, l.uMax, l.vMin, l.vMax),
        fill: BUERO_BILD.leinwandFarbe,
    }));
    const kreiseG = makeSVG("g", { "clip-path": "url(#bueroBildClip)" });
    BUERO_BILD.kreise.forEach(k => {
        kreiseG.appendChild(makeSVG("path", {
            d: wandKreisPfad(k.cu, k.cv, k.r),
            fill: k.farbe,
            opacity: "0.92",
        }));
    });
    wrapper.appendChild(kreiseG);

    // DOM-zuerst — Bild liegt an der Wand und wird von allen Möbeln (Tisch, Stuhl,
    // Bookshelf, cupboard_1) im DOM überdeckt.
    gruppe.prepend(wrapper);
}

// Keller-Kerzen: ~50 Kerzen in einem Halbkreis-Cluster um das Skelett (Standpunkt fu=0.90,
// fv=0.85). Cluster-basierte Verteilung erzeugt Häufungen und dünn besetzte Bereiche;
// jede Kerze ist ein einfaches SVG-Modell (Schatten, Wachs-Rect, Schimmer, Docht, 2-stufige
// Flamme). Wachs in rötlicher Palette (Höhe stark variabel, Breite ±2 px), Position
// und Größe per Boden-Perspektive (s = 1 - 0.45·fv) skaliert. Deterministischer PRNG
// (mulberry32, seed 73) → bei jedem Reload identisches Layout.
const KELLER_SKELETT_POS = { fu: 0.90, fv: 0.85 };
const KELLER_KERZE_FARBEN = [
    "#A93226", "#922B21", "#C0392B", "#E74C3C", "#CB4335",
    "#7B241C", "#943126", "#B03A2E", "#641E16", "#7D3C32",
    "#D35400", "#78281F", "#A93226", "#922B21",  // Doppel = Häufungs-Bias auf Dunkelrot
    "#E8C99B",  // gelegentlicher cremeweisser Akzent
];
const KELLER_KERZE_CLUSTER = [
    // winkel in Grad: 0=+fu (rechts vom Skelett), 90=−fv (vor Skelett, Richtung Spieler),
    // 180=−fu (links), 270=+fv (hinter Skelett, Richtung Wand).
    { winkel:  50, radius: 0.06, dichte: 4 },  // rechts neben Skelett (eng)
    { winkel:  75, radius: 0.15, dichte: 7 },  // rechts-vorne
    { winkel: 100, radius: 0.25, dichte: 8 },  // vorne (weiter weg)
    { winkel: 125, radius: 0.18, dichte: 9 },  // links-vorne (Häufung)
    { winkel: 150, radius: 0.32, dichte: 5 },  // links-vorne (weiter weg, dünner)
    { winkel: 175, radius: 0.20, dichte: 8 },  // links
    { winkel: 200, radius: 0.10, dichte: 6 },  // links-hinten (klein wegen Wand)
    { winkel: 220, radius: 0.08, dichte: 3 },  // schmaler Streifen hinter Skelett
];

function mulberry32(seed) {
    return function() {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Kerzen-Templates: Original-SVG-Inhalt aus assets/candle_2.svg und candle_3.svg
// (ohne outer <svg>-Tag), Wachs-Hex-Codes durch Platzhalter ersetzt:
//   __WACHS__         = Hauptfarbe (rot)
//   __WACHS_HELL__    = ~18 % heller davon (Tropfen/Highlight-Stops)
//   __WACHS_DUNKEL__  = ~45 % dunkler davon (Schatten-Stop in Gradient_1)
// `bodenAnker` = relative y-Position des visuellen Kerzenfußes im viewBox (für Sortierung
// und Boden-Ausrichtung). Die Flammen bleiben mit ihren Originalfarben gelb-orange.
const KERZE_TEMPLATE_2 = {
    // viewBox eng auf Wachs-Stamm (rect3041 x 128-208 = 80 viewBox-Einheiten); mit
    // 84 viewBox-Width nimmt der Wachs ~95 % der gerenderten Pixel-Breite ein.
    // Schatten-Ellipse (x 123-215) und geschmolzene Wachs-Oberkante (x 111-223) ragen
    // seitlich aus der viewBox heraus → overflow="visible" rendert sie trotzdem.
    viewBox: "126 12 84 275",
    bodenAnker: 0.924,  // Schatten-Mitte y≈266 in 12..287 → (266-12)/275
    inhalt: `<defs>
<radialGradient id="Gradient_1" gradientUnits="userSpaceOnUse" cx="523.71" cy="323.407" r="120.34" gradientTransform="matrix(0.396, 0.01, -0.003, 0.112, -37.967, 72.116)">
<stop offset="0" stop-color="__WACHS_DUNKEL__"/>
<stop offset="0.429" stop-color="__WACHS_HELL__"/>
<stop offset="1" stop-color="__WACHS_HELL__"/>
</radialGradient>
<radialGradient id="Gradient_2" gradientUnits="userSpaceOnUse" cx="650.243" cy="158.42" r="53.232" gradientTransform="matrix(-0.32, 0.029, 0.063, 0.576, 371.65, -28.671)">
<stop offset="0" stop-color="#FFFDEC"/>
<stop offset="0.429" stop-color="#FFEA00"/>
<stop offset="1" stop-color="#F1B100" stop-opacity="0.656"/>
</radialGradient>
</defs>
<g id="layer1"><g id="g3915">
<path d="M214.233,266.569 C214.233,274.829 193.806,281.526 168.609,281.526 C143.412,281.526 122.985,274.829 122.985,266.569 C122.985,258.308 143.412,251.611 168.609,251.611 C193.806,251.611 214.233,258.308 214.233,266.569 z" fill="#000000" id="path3811-6"/>
<path d="M127.889,106.654 L208.312,106.654 L208.312,262.648 C208.633,282.757 128.668,282.979 127.889,262.648 z" fill="__WACHS__" id="rect3041"/>
<path d="M129.127,103.035 C119.906,111.057 111.034,158.336 130.543,167.177 C146.603,174.452 138.118,127.346 143.569,132.284 C144.769,133.371 146.646,135.072 148.1,136.389 C150.878,138.906 156.04,132.41 157.729,132.028 C163.935,130.622 189.435,138.718 196.242,126.383 C198.118,122.983 204.041,142.906 206.154,143.573 C213.084,145.761 210.456,136.338 211.251,134.081 C222.988,100.756 200.682,99.188 168.206,99.188 C154.465,99.188 138.824,94.599 129.127,103.036 z" fill="url(#Gradient_1)" id="path3835"/>
<path d="M168.111,83.566 C164.638,77.648 171.215,80.933 172.343,82.122 C169.896,85.673 176.143,91.626 176.074,96.788 C176.01,101.585 172.607,107.113 172.642,112.418 C172.801,113.87 166.823,114.486 166.835,112.418 C167.457,107.261 171.39,101.348 171.913,96.103 C172.396,91.258 170.201,88.219 168.11,83.566 z" fill="#803300" id="rect4002-1"/>
<path d="M156.911,64.642 C144.915,76.637 162.024,96.911 173.415,96.911 C184.806,96.911 197.2,85.963 194.04,73.327 C190.783,60.302 177.722,38.99 184.993,17.581 C169.867,34.23 168.907,52.645 156.911,64.642 z" fill="url(#Gradient_2)" id="path3987-7"/>
<path d="M131.35,119.674 C131.35,129.226 130.544,140.164 129.221,140.164 C127.899,140.164 127.092,127.364 127.092,117.811 C127.092,108.258 134.818,107.166 136.141,107.166 C137.463,107.166 131.35,110.121 131.35,119.674 z" fill="#FFFFFF" id="path4132"/>
</g></g>`,
};
const KERZE_TEMPLATE_3 = {
    // viewBox eng auf Wachs-Stamm (path3153 x 287-460 = 173 viewBox-Einheiten = 100 % der
    // gerenderten Pixel-Breite). Flamme oben (path3141/4333 x 213-504) ragt seitlich
    // raus → overflow="visible" zeigt sie. y-Range: 5..1050 deckt Flammen­spitze + Boden ab.
    viewBox: "287 5 173 1045",
    bodenAnker: 0.981,  // Schatten path7745 Mitte y≈1030 in 5..1050 → (1030-5)/1045
    inhalt: `<g id="Layer_1">
<path d="M394.706,9.341 C300.566,121.697 373.232,33.614 300.566,121.697 C213.434,227.33 380.058,341.589 462.82,205.513 C504.473,137.044 408.314,61.934 394.706,9.345 z" fill="#F04218" fill-opacity="0.902" id="path3141"/>
<path d="M389.316,100.277 C343.181,173.374 378.792,116.066 343.181,173.374 C300.481,242.1 382.138,316.438 422.696,227.913 C443.109,183.359 395.985,134.492 389.316,100.277 z" fill="#FFFF00" id="path4333"/>
<path d="M373.089,224.095 C376.903,238.295 385.916,253.585 376.335,272.745 C368.9,287.615 369.593,300.907 373.089,314.903 C375.847,325.947 375.518,327.888 373.089,337.605" fill-opacity="0" stroke="#000000" stroke-width="6.811" id="path4211"/>
<g id="path3153">
<path d="M291.282,314.415 L460.503,268.5 L447.234,1025.963 L287.956,1025.963 L291.282,314.415 z" fill="__WACHS__" fill-opacity="0.982"/>
<path d="M291.282,314.415 L460.503,268.5 L447.234,1025.963 L287.956,1025.963 L291.282,314.415 z" fill-opacity="0" stroke="__WACHS_HELL__" stroke-width="6.16" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<path d="M378.044,171.144 C362.07,197.105 374.4,176.752 362.07,197.105 C347.285,221.514 375.558,247.915 389.601,216.475 C396.669,200.651 380.353,183.296 378.044,171.144 z" fill="#FFFFFF" fill-opacity="0.739" id="path5538"/>
<path d="M297.571,525.861 C222.858,658.622 263.268,571.208 255.833,632.753 C238.636,775.14 284.528,845.8 292.145,711.348 C296.844,628.247 290.692,576.952 297.571,525.861 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path3145"/>
<path d="M286.481,405.699 C294.177,490.128 289.636,422.294 294.177,490.128 C300.227,580.675 278.626,640.302 247.524,531.582 C237.161,495.349 274.88,440.592 286.481,405.699 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path4202"/>
<path d="M298.694,311.656 C263.177,392.578 290.749,329.137 263.177,392.578 C230.112,468.663 287.99,556.645 291.146,453.396 C293.098,389.581 295.573,349.648 298.694,311.656 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path7718"/>
<path d="M299.001,685.524 C277.241,777.149 294.165,705.434 277.241,777.149 C256.945,863.145 292.769,924.27 289.988,823.189 C288.138,756.173 296.004,722.88 299.001,685.524 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path7722"/>
<path d="M459.311,395.177 C443.545,502.308 448.641,424.701 440.185,508.607 C427.426,635.205 456.507,672.05 472.841,547.78 C484.272,460.797 462.943,435.223 459.311,395.177 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path4195"/>
<path d="M437.029,613.99 C425.349,723.584 462.535,624.762 453.556,710.61 C442.807,813.563 441.286,901.534 481.514,778.648 C503.069,712.778 440.65,661.88 437.029,613.99 z" fill="__WACHS_HELL__" fill-opacity="0.86" id="path2166"/>
<path d="M451.411,264.981 C469.028,366.175 455.452,287.036 469.028,366.175 C485.305,461.069 403.169,496.201 433.703,401.795 C453.953,339.205 447.631,302.462 451.411,264.981 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path4174"/>
<path d="M467.416,506.905 C485.691,592.196 471.616,525.373 485.691,592.196 C502.581,672.323 433.669,749.884 449.141,647.703 C458.698,584.546 463.522,544.817 467.416,506.905 z" fill="__WACHS_HELL__" fill-opacity="0.97" id="path4193"/>
<path d="M416.635,1040.539 C381.421,1045.109 331.835,1044.054 303.956,1038.141 C276.077,1032.229 279.722,1023.542 312.241,1018.4 C344.759,1013.259 394.697,1013.474 425.721,1018.889 C456.744,1024.304 457.928,1033.012 428.41,1038.677" fill="__WACHS_HELL__" id="path7745"/>
<path d="M444.287,279.672 C414.44,292.88 362.18,307.926 325.532,313.86 C288.884,319.794 280.757,314.527 307.063,301.892 C333.37,289.256 384.845,273.702 424.034,266.548 C463.223,259.393 476.324,263.157 453.803,275.101" fill="#FF7F2A" id="path7764"/>
</g>`,
};

function hexZuRgb(hex) {
    return [parseInt(hex.slice(1,3), 16), parseInt(hex.slice(3,5), 16), parseInt(hex.slice(5,7), 16)];
}
function rgbZuHex(r, g, b) {
    return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function dunklerHex(hex, anteil) {
    const [r, g, b] = hexZuRgb(hex);
    return rgbZuHex(r * (1 - anteil), g * (1 - anteil), b * (1 - anteil));
}
function hellerHex(hex, anteil) {
    const [r, g, b] = hexZuRgb(hex);
    return rgbZuHex(r + (255 - r) * anteil, g + (255 - g) * anteil, b + (255 - b) * anteil);
}

function erzeugeKerzeAusTemplate(template, idx, attrs, wachs, gespiegelt) {
    const idPrefix = `cd${idx}_`;
    const wachsHell = hellerHex(wachs, 0.18);
    const wachsDunkel = dunklerHex(wachs, 0.45);
    let inhalt = template.inhalt
        .split("__WACHS_DUNKEL__").join(wachsDunkel)
        .split("__WACHS_HELL__").join(wachsHell)
        .split("__WACHS__").join(wachs)
        .replace(/id="([^"]+)"/g, (_, id) => `id="${idPrefix}${id}"`)
        .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${idPrefix}${id})`);
    // Horizontale Spiegelung um die Kerzen-Mittelachse (cx = x + width/2): scale(-1,1)
    // wirkt an x=0, danach translate verschiebt um 2·cx zurück → Spiegelung an x=cx.
    let transformAttr = "";
    if (gespiegelt) {
        const cx = parseFloat(attrs.x) + parseFloat(attrs.width) / 2;
        transformAttr = ` transform="matrix(-1 0 0 1 ${(2 * cx).toFixed(1)} 0)"`;
    }
    const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" ${attrStr} viewBox="${template.viewBox}" preserveAspectRatio="none" overflow="visible" data-generated="kerze"${transformAttr}>${inhalt}</svg>`;
    return new DOMParser().parseFromString(xml, "image/svg+xml").documentElement;
}

function baueKellerKerzen() {
    const gruppe = document.querySelector('[data-raum="keller"]');
    if (!gruppe) return;
    gruppe.querySelectorAll('[data-generated="kerze"]').forEach(el => el.remove());

    const rand = mulberry32(73);
    const kerzen = [];
    KELLER_KERZE_CLUSTER.forEach(cl => {
        for (let i = 0; i < cl.dichte; i++) {
            // Pseudo-Gauss: Mittelwert aus 3 uniformen Samples → weiche Cluster-Ränder
            const winkelOffset = (rand() + rand() + rand() - 1.5) * 12;
            const radiusOffset = (rand() + rand() - 1) * 0.05;
            const winkel = (cl.winkel + winkelOffset) * Math.PI / 180;
            const radius = Math.max(0.04, cl.radius + radiusOffset);
            const fu = Math.max(0.05, Math.min(0.95, KELLER_SKELETT_POS.fu + radius * Math.cos(winkel)));
            const fv = Math.max(0.30, Math.min(0.97, KELLER_SKELETT_POS.fv - radius * Math.sin(winkel)));
            // Breite pseudo-normalverteilt 14..21 (Mittel ~17.5) via Mittelwert aus 3 Uniform-Samples
            const breiteBasis = 14 + ((rand() + rand() + rand()) / 3) * 7;
            const hoeheBasis  = 30 + rand() * 38;  // 30..68 px — Höhe stark variabel
            const farbe  = KELLER_KERZE_FARBEN[Math.floor(rand() * KELLER_KERZE_FARBEN.length)];
            const modell = rand() < 0.45 ? KERZE_TEMPLATE_2 : KERZE_TEMPLATE_3;
            const gespiegelt = rand() < 0.5;  // ~50 % horizontal gespiegelt → Variation
            kerzen.push({ fu, fv, breiteBasis, hoeheBasis, farbe, modell, gespiegelt });
        }
    });

    // Hintere zuerst zeichnen (höheres fv) — innerhalb der Rück-Ebene gilt DOM-Reihenfolge
    kerzen.sort((a, b) => b.fv - a.fv);

    kerzen.forEach((k, i) => {
        const [bx, by] = bodenPunkt(k.fu, k.fv);
        // Keine Tiefen-Skala für die Pixel-Größe — der Cluster ist räumlich klein und die
        // Kerzen sollen exakt der breiteBasis (21–25 px) entsprechen, nicht halbiert davon.
        const breite = k.breiteBasis;
        const hoehe  = k.hoeheBasis;
        const x = bx - breite / 2;
        const y = by - hoehe * k.modell.bodenAnker;  // Boden des Templates trifft auf by
        gruppe.appendChild(erzeugeKerzeAusTemplate(k.modell, i, {
            x: x.toFixed(1),
            y: y.toFixed(1),
            width:  breite.toFixed(1),
            height: hoehe.toFixed(1),
            "data-y-fuss": by.toFixed(0),
        }, k.farbe, k.gespiegelt));
    });
}

// Runder Teppich in der Mitte des Hauptraums. Konzentrische Kreise werden in
// Boden-(fu, fv)-Koords gesampelt und mit `bodenPunkt()` auf Screen abgebildet —
// die Trapez-Verzerrung des Bodens (Fluchtpunkt 800/225) macht aus jedem fu/fv-Kreis
// automatisch eine perspektivische Ellipse. Der größte Ring wird zuerst gezeichnet,
// jeder kleinere Ring überdeckt den größeren in der Mitte → 12 konzentrische Bänder.
const HAUPT_TEPPICH = {
    cu: 0.5,            // Boden-fu der Teppich-Mitte
    cv: 0.683,          // Boden-fv der Teppich-Mitte (40 px höher als 0.55: Δfv = 40/300)
    rMax: 0.20,         // Welt-Radius in Boden-Einheiten (gleich für fu+fv = physisch rund)
    samples: 72,        // Polyline-Punkte pro Kreis (5°-Schritte)
    // 12 dezente, niedrig gesättigte Farben von aussen (Index 0) nach innen (Index 11) —
    // gedämpfte Sand-/Braun-/Graubraun-Töne, damit der Hauptraum-saturate(2)-Filter sie
    // nicht ins Knallige zieht. Wechsel dunkel/hell für sichtbare konzentrische Bänder.
    farben: [
        "#5C4A3A",  // dunkelbraun (Aussenrand)
        "#B0A088",  // warmer Sandton
        "#7A6855",  // mittelbraun
        "#C2B099",  // hellbeige
        "#6B5A48",  // gedämpft dunkel
        "#A89478",  // gedämpftes Ocker
        "#7E6A55",  // mittel-warm braun
        "#B5A48E",  // helle Bordüre
        "#735F4D",  // warm-grau
        "#A39079",  // Sand
        "#604D3C",  // dunkel
        "#4A3A2D",  // dunkler Mittelpunkt
    ],
};

function bodenKreisPfad(cu, cv, r, samples) {
    let d = "";
    for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * 2 * Math.PI;
        const [x, y] = bodenPunkt(cu + r * Math.cos(t), cv + r * Math.sin(t));
        d += (i === 0 ? "M " : " L ") + x.toFixed(1) + "," + y.toFixed(1);
    }
    return d + " Z";
}

function baueHauptTeppich() {
    const gruppe = document.querySelector('[data-raum="haupt"]');
    if (!gruppe) return;
    gruppe.querySelectorAll('[data-generated="teppich"]').forEach(el => el.remove());

    const t = HAUPT_TEPPICH;
    const wrapper = makeSVG("g", { "data-generated": "teppich" });
    // Aussen → innen: jeder kleinere Ring wird im DOM später eingefügt → überdeckt den
    // größeren in der Mitte → konzentrische Bänder.
    for (let i = 0; i < t.farben.length; i++) {
        const r = t.rMax * (1 - i / t.farben.length);
        wrapper.appendChild(makeSVG("path", {
            d: bodenKreisPfad(t.cu, t.cv, r, t.samples),
            fill: t.farben[i],
        }));
    }
    // DOM-zuerst — Teppich liegt unter allen Möbeln/Pflanzen des Hauptraums.
    gruppe.prepend(wrapper);
}

function baueRaumDeko() {
    baueGartenDeko();
    baueBueroBild();
    baueKellerKerzen();
    baueHauptTeppich();
    klonePflanzenVorne();
}

// ---------- Tiefensortierung für Pflanzen (Phase 7) ----------
// Jede Pflanze mit `data-fv` im SVG-Layer wird in eine zweite SVG-Ebene geklont, die ÜBER
// dem Figur-Canvas liegt. Pro Frame entscheidet `aktualisierePflanzenTiefe()`, welche Ebene
// die Pflanze zeigt: ist die Figur tiefer im Raum als die Pflanze (figur.fv > pflanze.fv),
// erscheint die Pflanze in der Front-Ebene und verdeckt die Figur; sonst in der Rück-Ebene.
function klonePflanzenVorne() {
    svgLayerVorne.innerHTML = "";
    document.querySelectorAll('#object-layer > g[data-raum]').forEach(hintenGruppe => {
        const raumId = hintenGruppe.dataset.raum;
        const vorneGruppe = document.createElementNS(SVG_NS, "g");
        vorneGruppe.setAttribute("data-raum", raumId);
        // Filter (z.B. saturate-#grell) vom Original übernehmen, sonst leuchten Möbel
        // in der Front-Ebene (Figur dahinter) nicht so kräftig wie in der Rück-Ebene.
        const filter = hintenGruppe.getAttribute("filter");
        if (filter) vorneGruppe.setAttribute("filter", filter);
        // Nur der aktuelle Raum ist sichtbar (Rest display:none wie in der Rück-Ebene).
        if (raumId !== aktuellerRaum) vorneGruppe.style.display = "none";
        svgLayerVorne.appendChild(vorneGruppe);
        // Alle Elemente mit data-y-fuss klonen (rekursiv — Pflanzen stecken z.B. in einem
        // <g id="plants">-Wrapper). Transforms sind absolut, also kein Problem beim Verschieben.
        // WICHTIG: alle IDs im Klon mit `v_<idx>_` prefixen + url(#id)-Refs umschreiben.
        // Sonst entstehen ID-Duplikate zwischen Rück- und Front-Ebene; Browser-Paint-Server-
        // Lookup nimmt den ersten DOM-Treffer (= Rück-Ebene). Wenn die Rück-Ebene auf
        // display:none togglet ist, rendern Pfade mit Gradient-fill leer → Flammen
        // verschwinden (so passierte das mit candle_2-Kerzen, die `cd<i>_Gradient_2` haben).
        let klonIdx = 0;
        hintenGruppe.querySelectorAll('[data-y-fuss]').forEach(pflanze => {
            const klon = pflanze.cloneNode(true);
            const prefix = `v_${klonIdx++}_`;
            // ID-Sammeln (incl. dem outer Element selbst)
            const alleIds = new Set();
            if (klon.id) alleIds.add(klon.id);
            klon.querySelectorAll('[id]').forEach(el => alleIds.add(el.id));
            // IDs prefixen
            if (klon.id) klon.id = prefix + klon.id;
            klon.querySelectorAll('[id]').forEach(el => { el.id = prefix + el.id; });
            // url(#X)- und xlink:href="#X"-Refs umschreiben — alle Attribute aller Knoten
            const walk = (el) => {
                if (el.attributes) {
                    for (const attr of el.attributes) {
                        if (attr.value.includes('url(#')) {
                            attr.value = attr.value.replace(/url\(#([^)]+)\)/g, (m, id) =>
                                alleIds.has(id) ? `url(#${prefix}${id})` : m);
                        }
                        if ((attr.localName === 'href' || attr.name === 'xlink:href') && attr.value.startsWith('#')) {
                            const id = attr.value.slice(1);
                            if (alleIds.has(id)) attr.value = `#${prefix}${id}`;
                        }
                    }
                }
                for (const child of el.children || []) walk(child);
            };
            walk(klon);
            vorneGruppe.appendChild(klon);
        });
    });
}

// Liest den Pixel-y des Möbel-/Pflanzen-Fußes (data-y-fuss="…" im 1600×900-System)
// und rechnet ihn in fv (0..1) um, wie es die Tiefen-Sortier-Logik braucht.
// Boden-Polygon: y=900 (vorne, fv=0) → y=600 (hinten, fv=1). Also fv = (900 - y) / 300.
function elementFv(el) {
    return (900 - parseFloat(el.dataset.yFuss)) / 300;
}

function aktualisierePflanzenTiefe() {
    // Für alle Möbel/Pflanzen mit data-y-fuss im Rück- UND Front-Layer die Sichtbarkeit togglen.
    // Entscheidung: wer tiefer im Raum ist (grösseres fv), liegt weiter hinten → Figur liegt davor.
    // Sanitärobjekt-Switch: Elemente mit class="sanitar-aus" haben CSS `display:none !important`,
    // das die inline-display-Setzung hier überschreibt → Switch-Partner bleiben versteckt.
    svgLayer.querySelectorAll('[data-y-fuss]').forEach(el => {
        const fv = elementFv(el);
        el.style.display = (figur.fv > fv) ? "none" : "";
    });
    svgLayerVorne.querySelectorAll('[data-y-fuss]').forEach(el => {
        const fv = elementFv(el);
        el.style.display = (figur.fv > fv) ? "" : "none";
    });
}

// Startbildschirm ausgeklammert — direkt starten. Zum Reaktivieren:
// Block unten wieder entkommentieren und Auto-Start darunter entfernen.
/*
startButton.addEventListener("click", () => {
    startScreen.hidden = true;
    gameContainer.hidden = false;
    requestAnimationFrame(() => {
        resizeCanvas();
        if (!loopGestartet) {
            loopGestartet = true;
            loop();
        }
    });
});
*/

// Auto-Start
requestAnimationFrame(() => {
    baueRaumDeko();
    aktualisiereSanitaer();
    resizeCanvas();
    if (!loopGestartet) {
        loopGestartet = true;
        loop();
    }
});

window.addEventListener("resize", () => {
    if (!gameContainer.hidden) resizeCanvas();
});

// ---------- SVG-Objekte ----------

async function ladeSVG(pfad) {
    try {
        const response = await fetch(pfad);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        if (doc.querySelector("parsererror")) throw new Error("SVG-Format ungültig");
        return doc.documentElement;
    } catch (e) {
        console.error(`SVG konnte nicht geladen werden (${pfad}):`, e.message);
        console.error(`Tipp: Bei file:// blockiert der Browser fetch. Lokalen Server starten: "python3 -m http.server 8000" im Projektordner, dann http://localhost:8000 aufrufen.`);
        throw e;
    }
}

// Platziert ein SVG perspektivisch auf dem Boden (Füße an fu, fv).
function platziereAufBoden(svgRoot, fu, fv, basisBreite) {
    const [x, y] = bodenPunkt(fu, fv);
    const s = 1 - 0.45 * fv;
    const breite = basisBreite * s;
    let hoehe = breite;
    if (svgRoot.viewBox && svgRoot.viewBox.baseVal && svgRoot.viewBox.baseVal.width > 0) {
        const vb = svgRoot.viewBox.baseVal;
        hoehe = breite * vb.height / vb.width;
    }
    svgRoot.setAttribute("x", x - breite / 2);
    svgRoot.setAttribute("y", y - hoehe);
    svgRoot.setAttribute("width", breite);
    svgRoot.setAttribute("height", hoehe);
    svgLayer.appendChild(svgRoot);
    return svgRoot;
}

// Platziert ein SVG an fixen Zimmerkoordinaten (z. B. für Wandobjekte).
function platziereImZimmer(svgRoot, x, y, breite, hoehe) {
    svgRoot.setAttribute("x", x);
    svgRoot.setAttribute("y", y);
    svgRoot.setAttribute("width", breite);
    svgRoot.setAttribute("height", hoehe);
    svgLayer.appendChild(svgRoot);
    return svgRoot;
}

function entferneAlleSVGs() {
    svgLayer.innerHTML = "";
}

// ---------- Eingabe ----------

function canvasZuLogisch(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return [
        (clientX - rect.left) * LOGICAL_WIDTH / rect.width,
        (clientY - rect.top) * LOGICAL_HEIGHT / rect.height,
    ];
}

// ---------- Raumwechsel mit Fade-Transition (Phase 5) ----------

const fadeEl = document.getElementById("fade");
const FADE_MS = 220;
let wechselInGang = false;

function warte(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function starteRaumwechsel(zielId) {
    if (wechselInGang) return;
    wechselInGang = true;
    fadeEl.classList.add("visible");
    await warte(FADE_MS);
    wechsleRaum(zielId);
    await warte(40);              // 1-2 Frames, damit der neue Raum gezeichnet ist
    fadeEl.classList.remove("visible");
    await warte(FADE_MS);
    wechselInGang = false;
}

function findeObjektBei(x, y) {
    const objekte = OBJEKTE[aktuellerRaum] || [];
    for (const obj of objekte) {
        if (objektIstAktiv(obj) && istInPolygon(x, y, obj.polygon)) return obj;
    }
    return null;
}
function findeTuerBei(x, y) {
    for (const t of RAEUME[aktuellerRaum].tueren) {
        if (istInPolygon(x, y, t.polygon)) return t;
    }
    return null;
}

function setzeFigurZiel(fu, fv) {
    // Wenn das Ziel in einem Hindernis liegt (z.B. Tür-Laufziel nahe einer Pflanze oder
    // Klick direkt aufs Hindernis), zum nächstgelegenen Punkt leicht ausserhalb verschieben.
    // Funktioniert für Kreise/Ellipsen (radial) und Vierecke (auf nächste Kante projizieren).
    const hs = HINDERNISSE[aktuellerRaum] || [];
    for (const h of hs) {
        if (!istInForm(h, fu, fv)) continue;
        const r = naechsterRandUndNormale(h, fu, fv);
        // Knapp ausserhalb des Randes platzieren (entlang Außen-Normale).
        fu = r.fu + r.nx * 0.005;
        fv = r.fv + r.ny * 0.005;
    }
    figur.zielFu = Math.max(FIGUR_FU_MIN, Math.min(FIGUR_FU_MAX, fu));
    figur.zielFv = Math.max(FIGUR_FV_MIN, Math.min(FIGUR_FV_MAX, fv));
}

// ---------- Hindernis-Edit (Debug-Modus, Drag-and-Drop) ----------
// Aktiv nur wenn window.HINDERNIS_DEBUG === true. Sucht zuerst Eckpunkt-Marker (oder Center
// von Kreisen/Ellipsen) im 14-px-Radius. Treffer → Drag startet, Spiel-Klick wird NICHT
// ausgelöst (Figur läuft nicht los, Türen werden nicht geöffnet).
let hindernisDrag = null;   // { hidx, eckIdx | null }   (null = Kreis/Ellipse-Center)

function findeHindernisGriffBei(x, y) {
    if (!window.HINDERNIS_DEBUG) return null;
    const hs = HINDERNISSE[aktuellerRaum] || [];
    const TREFFER = 14;
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (h.punkte) {
            for (let i = 0; i < h.punkte.length; i++) {
                const [px, py] = bodenPunkt(h.punkte[i][0], h.punkte[i][1]);
                if (Math.hypot(x - px, y - py) <= TREFFER) {
                    return { hidx, eckIdx: i };
                }
            }
        } else {
            const [cx, cy] = bodenPunkt(h.fu, h.fv);
            if (Math.hypot(x - cx, y - cy) <= TREFFER) {
                return { hidx, eckIdx: null };
            }
        }
    }
    return null;
}

function aktualisiereHindernisDrag(clientX, clientY) {
    if (!hindernisDrag) return;
    const [x, y] = canvasZuLogisch(clientX, clientY);
    const fuFv = screenZuBoden(x, y);
    if (!fuFv) return;
    const h = HINDERNISSE[aktuellerRaum][hindernisDrag.hidx];
    if (hindernisDrag.eckIdx !== null) {
        h.punkte[hindernisDrag.eckIdx] = [+fuFv[0].toFixed(4), +fuFv[1].toFixed(4)];
    } else {
        h.fu = +fuFv[0].toFixed(4);
        h.fv = +fuFv[1].toFixed(4);
    }
    draw();
}

function beendeHindernisDrag() {
    if (!hindernisDrag) return;
    // Nur kompakte 1-Zeilen-Bestätigung beim Loslassen — den vollen Code holst du dir jederzeit
    // mit dumpHindernisse() (siehe Konsolen-Helfer unten).
    const { hidx, eckIdx } = hindernisDrag;
    const h = HINDERNISSE[aktuellerRaum][hidx];
    if (eckIdx !== null) {
        const p = h.punkte[eckIdx];
        console.log(`✓ ${aktuellerRaum}[${hidx}].punkte[${eckIdx}] = [${p[0]}, ${p[1]}]`);
    } else {
        console.log(`✓ ${aktuellerRaum}[${hidx}] center → fu=${h.fu}, fv=${h.fv}`);
    }
    hindernisDrag = null;
}

// Konsolen-Helfer: gibt das komplette HINDERNISSE-Array für den aktuellen (oder einen
// gewünschten) Raum als fertiges Code-Snippet aus. Nach dem Drag-und-Drop-Tunen einmal
// aufrufen → die ausgegebene Zeile ersetzt die Definition direkt im script.js.
window.dumpHindernisse = (raum = aktuellerRaum) => {
    const hs = HINDERNISSE[raum] || [];
    const lines = hs.map((h, i) => {
        if (h.punkte) {
            const repr = h.punkte.map(p => `[${p[0]}, ${p[1]}]`).join(", ");
            return `    { punkte: [${repr}] },   // [${i}]`;
        }
        if (h.rx !== undefined) {
            return `    { fu: ${h.fu}, fv: ${h.fv}, rx: ${h.rx}, ry: ${h.ry} },   // [${i}]`;
        }
        return `    { fu: ${h.fu}, fv: ${h.fv}, r: ${h.r} },   // [${i}]`;
    });
    const out = `HINDERNISSE.${raum} = [\n${lines.join("\n")}\n];`;
    console.log(out);
    return out;
};

canvas.addEventListener("pointerdown", (e) => {
    if (wechselInGang) return;   // Während Fade nichts annehmen

    ensureAudio();               // Audio-Kontext beim ersten Klick initialisieren

    const [x, y] = canvasZuLogisch(e.clientX, e.clientY);

    // 0) Hindernis-Edit (nur Debug-Modus): Eckpunkt-Marker getroffen? → Drag, kein Spiel-Klick.
    const griff = findeHindernisGriffBei(x, y);
    if (griff) {
        hindernisDrag = griff;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
    }

    // 1) Türen — zuerst hinlaufen, dann Aktion
    const tuer = findeTuerBei(x, y);
    if (tuer) {
        const z = tuer.laufziel || { fu: 0.5, fv: 0.5 };
        setzeFigurZiel(z.fu, z.fv);
        figur.ankunft = () => {
            if (!istFrei(tuer)) {
                zeigeOverlayText("Diese Tür ist verschlossen.\nDu musst zuerst einen Schlüssel finden.");
                return;
            }
            starteRaumwechsel(tuer.ziel);
        };
        return;
    }

    // 2) Interaktive Objekte — ebenfalls hinlaufen, dann Aktion auslösen
    const obj = findeObjektBei(x, y);
    if (obj) {
        const z = obj.laufziel || null;
        const aktion = () => {
            if (obj.aufnehmen) nimmAufGegenstand(obj);
            else if (obj.aufgabe) zeigeAufgabe(obj.aufgabe);
            else if (typeof obj.aktion === "function") obj.aktion(spielstand);
        };
        if (z) {
            setzeFigurZiel(z.fu, z.fv);
            figur.ankunft = aktion;
        } else {
            aktion();
        }
        return;
    }

    // 3) Boden — Figur läuft hin, ggf. vorherigen Ankunft-Callback verwerfen
    const bk = screenZuBoden(x, y);
    if (bk) {
        setzeFigurZiel(bk[0], bk[1]);
        figur.ankunft = null;
    }
});

// Cursor-Feedback: pointer, wenn unter dem Cursor eine Tür, ein Aufgaben-Objekt oder
// (im Debug-Modus) ein Hindernis-Griff liegt; "grabbing" während aktivem Drag.
canvas.addEventListener("pointermove", (e) => {
    if (hindernisDrag) {
        aktualisiereHindernisDrag(e.clientX, e.clientY);
        canvas.style.cursor = "grabbing";
        return;
    }
    const [x, y] = canvasZuLogisch(e.clientX, e.clientY);
    const ueberGriff = findeHindernisGriffBei(x, y);
    const ueber = findeTuerBei(x, y) || findeObjektBei(x, y);
    canvas.style.cursor = ueberGriff ? "grab" : (ueber ? "pointer" : "default");
});

// Drag-Ende: Endpunkt loggen (Snippet zum Einfügen in HINDERNISSE-Definition).
canvas.addEventListener("pointerup", (e) => {
    if (hindernisDrag) {
        beendeHindernisDrag();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
});
canvas.addEventListener("pointercancel", (e) => {
    if (hindernisDrag) {
        beendeHindernisDrag();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
});

// ---------- Overlay (Phase 2 Info-Text + Phase 3 Aufgaben-UI) ----------

const overlayEl = document.getElementById("overlay");
const overlayInhaltEl = document.getElementById("overlay-inhalt");
const overlayCloseEl = document.getElementById("overlay-close");

// Einfacher Info-Text (z.B. "Tür verschlossen.")
function zeigeOverlayText(text) {
    overlayInhaltEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "overlay-text";
    p.textContent = text;
    overlayInhaltEl.appendChild(p);
    overlayEl.hidden = false;
}

// Rückwärtskompatibel zur Phase-2-API (wird von wechsleRaum-Blocker genutzt)
function zeigeOverlay(text) {
    zeigeOverlayText(text);
}

function schliesseOverlay() {
    overlayEl.hidden = true;
    overlayInhaltEl.innerHTML = "";
}

overlayCloseEl.addEventListener("click", schliesseOverlay);
overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) schliesseOverlay();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlayEl.hidden) schliesseOverlay();
});

// ---------- Inventar (Phase 6) ----------
// Gegenstände können im Raum aufgenommen werden (Klick auf Objekt mit `aufnehmen`),
// erscheinen dann als Icon rechts oben im Inventar und können per Drag & Drop auf
// andere Objekte oder Türen gezogen werden (Drop-Target hat `akzeptiert[id]`).

// Registry aller möglichen Gegenstände. Icon ist Inline-SVG (viewBox 0..48).
const GEGENSTAENDE = {
    notizzettel: {
        name: "Notizzettel",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="6" width="30" height="36" rx="2" fill="#fffbe6" stroke="#222" stroke-width="1.6"/>
            <!-- Datum oben-rechts -->
            <line x1="30" y1="11" x2="37" y2="11" stroke="#777" stroke-width="1.2"/>
            <!-- Anrede (kurz, linksbündig) -->
            <line x1="12" y1="17" x2="24" y2="17" stroke="#777" stroke-width="1.2"/>
            <!-- Text-Zeilen mit abnehmender Länge -->
            <line x1="12" y1="23" x2="36" y2="23" stroke="#666" stroke-width="1.2"/>
            <line x1="12" y1="28" x2="35" y2="28" stroke="#666" stroke-width="1.2"/>
            <line x1="12" y1="33" x2="31" y2="33" stroke="#666" stroke-width="1.2"/>
            <!-- Unterschrift-Zickzack unten-rechts -->
            <path d="M26 38 L27.5 36 L29 38.5 L31.5 37 L34 38.5" stroke="#333" stroke-width="1.2" fill="none"/>
        </svg>`,
    },
};

const inventarEl = document.getElementById("inventar");
const dragPreviewEl = document.getElementById("drag-preview");

function aktualisiereInventar() {
    inventarEl.innerHTML = "";
    if (spielstand.gegenstaende.size === 0) {
        inventarEl.hidden = true;
        return;
    }
    inventarEl.hidden = false;
    for (const id of spielstand.gegenstaende) {
        const g = GEGENSTAENDE[id];
        if (!g) continue;
        const slot = document.createElement("div");
        slot.className = "inventar-slot";
        slot.dataset.gegenstand = id;
        slot.title = g.name;
        slot.innerHTML = g.icon;
        slot.addEventListener("pointerdown", (e) => starteDrag(e, id, slot));
        inventarEl.appendChild(slot);
    }
}

// Gegenstand aufnehmen: wird vom Objekt-Klick-Handler aufgerufen, nachdem die Figur angekommen ist.
function nimmAufGegenstand(obj) {
    if (!obj || !obj.aufnehmen || obj.aufgenommen) return;
    obj.aufgenommen = true;
    spielstand.gegenstaende.add(obj.aufnehmen);
    aktualisiereInventar();
    draw();
}

// Dev-Helfer (Konsole)
function gegenstandHinzufuegen(id) {
    if (!GEGENSTAENDE[id]) { console.warn(`Unbekannter Gegenstand: ${id}`); return; }
    spielstand.gegenstaende.add(id);
    aktualisiereInventar();
    console.log(`Gegenstand "${id}" ins Inventar gelegt.`);
}
function gegenstandEntfernen(id) {
    spielstand.gegenstaende.delete(id);
    aktualisiereInventar();
    console.log(`Gegenstand "${id}" aus Inventar entfernt.`);
}
window.gegenstandHinzufuegen = gegenstandHinzufuegen;
window.gegenstandEntfernen = gegenstandEntfernen;
window.verbrauche = gegenstandEntfernen;  // Alias, kann in akzeptiert-Callbacks verwendet werden
window.GEGENSTAENDE = GEGENSTAENDE;

// ---------- Drag & Drop ----------
// Pointer-basiert (nicht HTML5 DnD), damit Touch und Canvas-Drops problemlos funktionieren.

let dragZustand = null;  // { id, slot, pointerId } während aktivem Drag

function starteDrag(e, id, slot) {
    if (wechselInGang) return;
    if (dragZustand) return;                         // Schon einer unterwegs
    e.preventDefault();
    slot.setPointerCapture(e.pointerId);
    slot.classList.add("dragging");

    const g = GEGENSTAENDE[id];
    dragPreviewEl.innerHTML = g.icon;
    dragPreviewEl.hidden = false;
    dragPreviewEl.style.left = e.clientX + "px";
    dragPreviewEl.style.top  = e.clientY + "px";

    dragZustand = { id, slot, pointerId: e.pointerId };

    const onMove = (ev) => {
        if (!dragZustand || ev.pointerId !== dragZustand.pointerId) return;
        dragPreviewEl.style.left = ev.clientX + "px";
        dragPreviewEl.style.top  = ev.clientY + "px";
    };
    const beende = (ev, treffer) => {
        if (!dragZustand || ev.pointerId !== dragZustand.pointerId) return;
        slot.classList.remove("dragging");
        dragPreviewEl.hidden = true;
        dragPreviewEl.innerHTML = "";
        const zustand = dragZustand;
        dragZustand = null;
        slot.removeEventListener("pointermove", onMove);
        slot.removeEventListener("pointerup", onUp);
        slot.removeEventListener("pointercancel", onCancel);
        if (treffer) versucheDrop(ev.clientX, ev.clientY, zustand.id);
    };
    const onUp     = (ev) => beende(ev, true);
    const onCancel = (ev) => beende(ev, false);

    slot.addEventListener("pointermove", onMove);
    slot.addEventListener("pointerup", onUp);
    slot.addEventListener("pointercancel", onCancel);
}

function versucheDrop(clientX, clientY, gegenstandId) {
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right ||
        clientY < rect.top  || clientY > rect.bottom) {
        return;   // ausserhalb des Canvas → Drop verpuffet, Gegenstand bleibt im Inventar
    }
    const [x, y] = canvasZuLogisch(clientX, clientY);

    // Erst Objekte, dann Türen prüfen — bei Treffer Figur hinlaufen lassen, dann Callback.
    const obj = findeObjektBei(x, y);
    if (obj && obj.akzeptiert && obj.akzeptiert[gegenstandId]) {
        const z = obj.laufziel || null;
        const aktion = () => obj.akzeptiert[gegenstandId](spielstand, gegenstandId);
        if (z) { setzeFigurZiel(z.fu, z.fv); figur.ankunft = aktion; }
        else aktion();
        return;
    }
    const tuer = findeTuerBei(x, y);
    if (tuer && tuer.akzeptiert && tuer.akzeptiert[gegenstandId]) {
        const z = tuer.laufziel || { fu: 0.5, fv: 0.5 };
        setzeFigurZiel(z.fu, z.fv);
        figur.ankunft = () => tuer.akzeptiert[gegenstandId](spielstand, gegenstandId);
        return;
    }
    // Kein passendes Ziel — nichts tun, Gegenstand bleibt im Inventar.
}

// Initial: leeres Inventar rendern (versteckt, bis erster Gegenstand aufgenommen wird).
aktualisiereInventar();
