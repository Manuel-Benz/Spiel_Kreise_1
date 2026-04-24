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
              ziel: "fitness", laufziel: { fu: 0.74, fv: 0.92 } },
            { id: "L", label: "L", polygon: seitenTuerPolygon(linkeWandPunkt),
              ziel: "garten", laufziel: { fu: 0.12, fv: 0.45 } },
            { id: "geheim", secret: true, schloss: "keller_schluessel",
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
            decke: GRAU.b90, boden: "#3d2e1a",
            hintereWand: "#a89070", linkeWand: "#a89070", rechteWand: "#a89070",
        },
        tueren: [
            { id: "zurueck", pfeil: true, polygon: PFEIL_POLYGON,
              ziel: "haupt", laufziel: { fu: 0.5, fv: 0.05 } },
            { id: "fitness", label: "F", polygon: seitenTuerPolygon(rechteWandPunkt),
              ziel: "fitness", laufziel: { fu: 0.88, fv: 0.45 } },
        ],
    },
    fitness: {
        name: "Fitnessraum",
        farben: {
            decke: GRAU.b90, boden: GRAU.b60,
            hintereWand: "#5a7a9a", linkeWand: "#5a7a9a", rechteWand: "#5a7a9a",
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
            schluessel: "keller_schluessel",
            inventar: { umfang_demo_cm: 31.4 },
            belohnung_text: "Richtig! Du hast einen geheimen Schlüssel gefunden.",
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
            polygon: [[810, 635], [930, 635], [930, 710], [810, 710]],
            laufziel: { fu: 0.5, fv: 0.85 },
            zeichnen: (ctx) => {
                // Kleines Blatt Papier mit ein paar Liniatur-Strichen
                ctx.save();
                ctx.fillStyle = "#fffbe6";
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(820, 645, 100, 60, 3);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = "#aaa";
                ctx.lineWidth = 1;
                for (let i = 1; i <= 4; i++) {
                    const y = 645 + i * 12;
                    ctx.beginPath();
                    ctx.moveTo(832, y);
                    ctx.lineTo(908, y);
                    ctx.stroke();
                }
                ctx.restore();
            },
        },
    ],
    fitness: [],
    garten: [],
    keller: [],
};

function objektIstAktiv(obj) {
    if (obj.aufgenommen) return false;
    // Aktiv, wenn eines der Interaktions-Felder gesetzt ist.
    return !!(AUFGABEN[obj.aufgabe] || obj.aufnehmen || obj.akzeptiert);
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
// Kreise im fu/fv-System (0..1). Figur kann nicht durch sie hindurchlaufen.
// Radien sind grob am sichtbaren Fussabdruck der Pflanze orientiert — Pflanzen mit
// grösserer bw bekommen grössere r. Werte lassen sich in der Konsole live ändern:
//   HINDERNISSE.haupt[0].r = 0.08
const HINDERNISSE = {
    haupt: [
        // Radien sind am Fussabdruck der Pflanze orientiert (Topfbasis, nicht Blätter).
        // So kann die Figur knapp vorbei — Körper verschwindet perspektivisch hinter den Blättern.
        { fu: 0.08, fv: 0.85, r: 0.03 },   // yucca (hinten-links)
        { fu: 0.94, fv: 0.78, r: 0.03 },   // geranie (hinten-rechts)
        { fu: 0.12, fv: 0.50, r: 0.035 },  // setzling (mitte-links) — muss Tür L (fv 0.45) frei lassen
        { fu: 0.85, fv: 0.45, r: 0.025 },  // kraeuter (mitte-rechts) — muss Tür geheim (fu 0.88) frei lassen
        { fu: 0.87, fv: 0.15, r: 0.05 },   // blume (vorne-rechts, grösser)
        { fu: 0.15, fv: 0.12, r: 0.05 },   // tulpe (vorne-links, grösser)
    ],
    buero:   [],
    fitness: [],
    garten:  [],
    keller:  [],
};
window.HINDERNISSE = HINDERNISSE;

function istImHindernis(fu, fv) {
    const hs = HINDERNISSE[aktuellerRaum] || [];
    for (const h of hs) {
        const dfu = fu - h.fu;
        const dfv = fv - h.fv;
        if (dfu * dfu + dfv * dfv < h.r * h.r) return true;
    }
    return false;
}

// Gleit-Manöver: Ist der direkte Schritt blockiert, versucht die Figur einen Schritt
// TANGENTIAL am nächstgelegenen blockierenden Hindernis entlang. So „umrundet" sie die
// Pflanze Frame für Frame, statt davor stehen zu bleiben.
// ux, uy = gewünschte Laufrichtung (Einheitsvektor); schritt = Schrittweite.
// Rückgabe: { fu, fv } mit neuer Position, oder null wenn kein Ausweichen möglich.
function slideUmHindernis(ux, uy, schritt) {
    const hs = HINDERNISSE[aktuellerRaum] || [];
    // Finde das in Laufrichtung am nächsten liegende blockierende Hindernis.
    let blocker = null;
    let bestDist = Infinity;
    for (const h of hs) {
        const dfu = h.fu - figur.fu;
        const dfv = h.fv - figur.fv;
        const along = dfu * ux + dfv * uy;           // Projektion auf Laufrichtung
        if (along <= 0) continue;                    // Hindernis liegt hinter uns
        const perp = dfu * uy - dfv * ux;            // senkrechter Versatz (signed)
        if (Math.abs(perp) > h.r + 0.02) continue;   // Hindernis liegt nicht im Pfad
        if (along < bestDist) {
            bestDist = along;
            blocker = h;
        }
    }
    if (!blocker) return null;

    // Tangent-Richtung: senkrecht zum Vektor Figur → Hindernis.
    const toObsX = blocker.fu - figur.fu;
    const toObsY = blocker.fv - figur.fv;
    const toObsLen = Math.sqrt(toObsX * toObsX + toObsY * toObsY);
    if (toObsLen < 1e-6) return null;
    const perpX = -toObsY / toObsLen;
    const perpY =  toObsX / toObsLen;
    // Zwei mögliche Tangent-Richtungen (±). Wähle die mit positivem Dot zur Laufrichtung,
    // damit die Figur in Richtung Ziel gleitet und nicht zurück.
    const dot = perpX * ux + perpY * uy;
    const tx = dot >= 0 ? perpX : -perpX;
    const ty = dot >= 0 ? perpY : -perpY;

    const slidFu = figur.fu + tx * schritt;
    const slidFv = figur.fv + ty * schritt;
    if (istImHindernis(slidFu, slidFv)) return null;  // Gleite würde in anderes Hindernis laufen
    return { fu: slidFu, fv: slidFv };
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
};

const GEHPHASE_SCHRITT = 0.36;
const BEIN_HUB = 0.22;
const FIGUR_SKALA = 1.0;

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
    ctx.lineWidth = 10;
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
    gruppe.innerHTML = "";  // Bestehende Inhalte entfernen (idempotent)

    // Sträucher innen: hinten zuerst zeichnen (höheres fv → weiter weg)
    const sortiert = [...STRAEUCHER_GARTEN].sort((a, b) => b.fv - a.fv);
    sortiert.forEach(s => gruppe.appendChild(erzeugeStrauch(s)));
}

function baueRaumDeko() {
    baueGartenDeko();
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
        // Nur der aktuelle Raum ist sichtbar (Rest display:none wie in der Rück-Ebene).
        if (raumId !== aktuellerRaum) vorneGruppe.style.display = "none";
        svgLayerVorne.appendChild(vorneGruppe);
        // Alle Elemente mit data-fv klonen (rekursiv — Pflanzen stecken z.B. in einem
        // <g id="plants">-Wrapper). Transforms sind absolut, also kein Problem beim Verschieben.
        hintenGruppe.querySelectorAll('[data-fv]').forEach(pflanze => {
            vorneGruppe.appendChild(pflanze.cloneNode(true));
        });
    });
}

function aktualisierePflanzenTiefe() {
    // Für alle data-fv-Pflanzen im Rück- UND Front-Layer die Sichtbarkeit togglen.
    // Entscheidung: wer tiefer im Raum ist (grösseres fv), liegt weiter hinten → Figur liegt davor.
    svgLayer.querySelectorAll('[data-fv]').forEach(el => {
        const fv = parseFloat(el.dataset.fv);
        el.style.display = (figur.fv > fv) ? "none" : "";
    });
    svgLayerVorne.querySelectorAll('[data-fv]').forEach(el => {
        const fv = parseFloat(el.dataset.fv);
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
    // Klick direkt auf die Pflanze), zum nächstgelegenen Punkt leicht ausserhalb verschieben.
    const hs = HINDERNISSE[aktuellerRaum] || [];
    for (const h of hs) {
        const dfu = fu - h.fu;
        const dfv = fv - h.fv;
        const d2 = dfu * dfu + dfv * dfv;
        if (d2 < h.r * h.r) {
            const d = Math.sqrt(d2);
            const raus = h.r + 0.005;         // knapp ausserhalb der Hindernis-Kante
            if (d > 1e-6) {
                fu = h.fu + (dfu / d) * raus;
                fv = h.fv + (dfv / d) * raus;
            } else {
                fu = h.fu + raus;              // Fallback: Klick genau in der Mitte
            }
        }
    }
    figur.zielFu = Math.max(FIGUR_FU_MIN, Math.min(FIGUR_FU_MAX, fu));
    figur.zielFv = Math.max(FIGUR_FV_MIN, Math.min(FIGUR_FV_MAX, fv));
}

canvas.addEventListener("pointerdown", (e) => {
    if (wechselInGang) return;   // Während Fade nichts annehmen

    ensureAudio();               // Audio-Kontext beim ersten Klick initialisieren

    const [x, y] = canvasZuLogisch(e.clientX, e.clientY);

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

// Cursor-Feedback: pointer, wenn unter dem Cursor eine Tür oder ein Aufgaben-Objekt liegt
canvas.addEventListener("pointermove", (e) => {
    const [x, y] = canvasZuLogisch(e.clientX, e.clientY);
    const ueber = findeTuerBei(x, y) || findeObjektBei(x, y);
    canvas.style.cursor = ueber ? "pointer" : "default";
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
            <line x1="15" y1="15" x2="33" y2="15" stroke="#666" stroke-width="1.4"/>
            <line x1="15" y1="21" x2="33" y2="21" stroke="#666" stroke-width="1.4"/>
            <line x1="15" y1="27" x2="30" y2="27" stroke="#666" stroke-width="1.4"/>
            <line x1="15" y1="33" x2="27" y2="33" stroke="#666" stroke-width="1.4"/>
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
