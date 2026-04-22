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

// Türen stehen auf dem Boden. Grössen: A/B/L 10 % kleiner, Geheimtür 50 % kleiner.
const TUEREN = [
    { id: "A", label: "A", polygon: [[460, 600], [640, 600], [640, 240], [460, 240]] },
    { id: "B", label: "B", polygon: [[960, 600], [1140, 600], [1140, 240], [960, 240]] },
    {
        id: "L", label: "L",
        polygon: [
            linkeWandPunkt(0.225, 0),
            linkeWandPunkt(0.675, 0),
            linkeWandPunkt(0.675, 0.72),
            linkeWandPunkt(0.225, 0.72),
        ],
    },
    {
        id: "geheim", label: null, secret: true,
        polygon: [
            rechteWandPunkt(0.325, 0),
            rechteWandPunkt(0.575, 0),
            rechteWandPunkt(0.575, 0.4),
            rechteWandPunkt(0.325, 0.4),
        ],
    },
];

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
    // Zimmer
    decke:       GRAU.b90,
    hintereWand: GRAU.b70,
    linkeWand:   GRAU.b70,
    rechteWand:  GRAU.b70,
    boden:       GRAU.b90,
    // Türen
    tuer:        GRAU.b50,
    tuerLabel:   GRAU.b100,
    tuerGeheim:  GRAU.b70,
    // Figur (komplett schwarz, ausser Augen und Mund)
    kopf:        GRAU.b100,
    augen:       GRAU.b0,
    nase:        GRAU.b100,
    mund:        GRAU.b0,
    hemd:        GRAU.b100,
    hose:        GRAU.b100,
};

const figur = {
    fu: 0.5,
    fv: 0.25,
    zielFu: 0.5,
    zielFv: 0.25,
    richtung: "vorne",
    geschwindigkeit: 0.008,
    gehphase: 0,
};

const GEHPHASE_SCHRITT = 0.18;
const BEIN_HUB = 0.22;
const FIGUR_SKALA = 1.0;

function fuellePolygon(p, f) {
    ctx.fillStyle = f;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.fill();
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
    fuellePolygon(ZIMMER.decke, FARBEN.decke);
    fuellePolygon(ZIMMER.boden, FARBEN.boden);
    fuellePolygon(ZIMMER.linkeWand, FARBEN.linkeWand);
    fuellePolygon(ZIMMER.rechteWand, FARBEN.rechteWand);
    fuellePolygon(ZIMMER.hintereWand, FARBEN.hintereWand);
}

function zeichneTueren() {
    TUEREN.forEach(t => {
        if (t.secret) {
            fuellePolygon(t.polygon, FARBEN.tuerGeheim);
            return;
        }
        fuellePolygon(t.polygon, FARBEN.tuer);
        if (t.label) {
            const cx = t.polygon.reduce((s, pp) => s + pp[0], 0) / t.polygon.length;
            const cy = t.polygon.reduce((s, pp) => s + pp[1], 0) / t.polygon.length;
            ctx.fillStyle = FARBEN.tuerLabel;
            ctx.font = "bold 60px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(t.label, cx, cy);
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
    const headY = neckY - headR;

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
        ctx.ellipse(fx, headY + headR * 0.18, headR * 0.1, headR * 0.22, 0.36, 0, 2 * Math.PI);
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

function draw() {
    // Hintere Ebene: Zimmer + Türen (unter der SVG-Dekoration)
    ctx = ctxRaum;
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    zeichneZimmer();
    zeichneTueren();
    // Vordere Ebene: Figur (über der SVG-Dekoration)
    ctx = ctxFigur;
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    zeichneFigur();
}

function aktualisiereFigur() {
    const dx = figur.zielFu - figur.fu;
    const dy = figur.zielFv - figur.fv;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) {
        figur.gehphase = 0;
        return;
    }
    if (dist < figur.geschwindigkeit) {
        figur.fu = figur.zielFu;
        figur.fv = figur.zielFv;
        figur.gehphase = 0;
        return;
    }
    figur.fu += (dx / dist) * figur.geschwindigkeit;
    figur.fv += (dy / dist) * figur.geschwindigkeit;
    figur.gehphase = (figur.gehphase + GEHPHASE_SCHRITT) % (2 * Math.PI);
    if (Math.abs(dx) > Math.abs(dy)) {
        figur.richtung = dx > 0 ? "rechts" : "links";
    } else {
        figur.richtung = dy > 0 ? "hinten" : "vorne";
    }
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

canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * LOGICAL_WIDTH / rect.width;
    const y = (e.clientY - rect.top) * LOGICAL_HEIGHT / rect.height;
    const bk = screenZuBoden(x, y);
    if (bk) {
        [figur.zielFu, figur.zielFv] = bk;
    }
});
