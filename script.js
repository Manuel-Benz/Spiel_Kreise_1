const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;

const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const gameContainer = document.getElementById("game-container");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
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

const TUEREN = [
    { id: "A", label: "A", polygon: [[450, 600], [650, 600], [650, 200], [450, 200]] },
    { id: "B", label: "B", polygon: [[950, 600], [1150, 600], [1150, 200], [950, 200]] },
    {
        id: "L", label: "L",
        polygon: [
            linkeWandPunkt(0.2, 0),
            linkeWandPunkt(0.7, 0),
            linkeWandPunkt(0.7, 0.8),
            linkeWandPunkt(0.2, 0.8),
        ],
    },
    {
        id: "geheim", label: null, secret: true,
        polygon: [
            rechteWandPunkt(0.2, 0),
            rechteWandPunkt(0.7, 0),
            rechteWandPunkt(0.7, 0.8),
            rechteWandPunkt(0.2, 0.8),
        ],
    },
];

const FARBEN = {
    decke: "#efe8d3",
    boden: "#a87d4b",
    linkeWand: "#b8a890",
    rechteWand: "#b8a890",
    hintereWand: "#d4c8a8",
    kante: "#5a4a3a",
    tuer: "#5d3a1f",
    tuerRahmen: "#2e1c10",
    tuerLabel: "#f5e5cf",
    tuerGeheim: "#b8a890",
    tuerGeheimKante: "#a89880",
    haut: "#f2c6a0",
    hautSchatten: "#d9a37c",
    haare: "#3d2a1a",
    haareGlanz: "#5a3c25",
    hemd: "#2563eb",
    hemdSchatten: "#1e4fbd",
    hose: "#2a2e3a",
    schuh: "#15151f",
    wange: "#f08a85",
    mund: "#a63a3a",
    kontur: "#1a1a1a",
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
    Object.values(ZIMMER).forEach(p => zeichnePolygon(p, FARBEN.kante, 2));
}

function zeichneTueren() {
    TUEREN.forEach(t => {
        if (t.secret) {
            fuellePolygon(t.polygon, FARBEN.tuerGeheim);
            zeichnePolygon(t.polygon, FARBEN.tuerGeheimKante, 1);
            return;
        }
        fuellePolygon(t.polygon, FARBEN.tuer);
        zeichnePolygon(t.polygon, FARBEN.tuerRahmen, 3);
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

function zeichneFigur() {
    const [fx, fy] = bodenPunkt(figur.fu, figur.fv);
    const s = 1 - 0.45 * figur.fv;
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
    const shoeH = 22 * s;
    const shoeOver = 5 * s;
    const rad = 9 * s;

    const bodyBottom = fy - legH;
    const bodyTop = bodyBottom - bodyH;
    const neckY = bodyTop - neckH;
    const headY = neckY - headR;

    ctx.strokeStyle = FARBEN.kontur;
    ctx.lineWidth = Math.max(1, 2 * s);

    // ---- Beine (mit Gehanimation) ----
    const beinBasis = legH - shoeH;
    const hubLinks = Math.max(0, Math.sin(figur.gehphase)) * BEIN_HUB;
    const hubRechts = Math.max(0, Math.sin(figur.gehphase + Math.PI)) * BEIN_HUB;
    const beinLinks = beinBasis * (1 - hubLinks);
    const beinRechts = beinBasis * (1 - hubRechts);

    ctx.fillStyle = FARBEN.hose;
    roundRect(fx - legGap / 2 - legW, bodyBottom, legW, beinLinks, rad * 0.4);
    ctx.fill();
    roundRect(fx + legGap / 2, bodyBottom, legW, beinRechts, rad * 0.4);
    ctx.fill();

    // ---- Schuhe ----
    ctx.fillStyle = FARBEN.schuh;
    roundRect(fx - legGap / 2 - legW - shoeOver, bodyBottom + beinLinks, legW + 2 * shoeOver, shoeH, rad * 0.7);
    ctx.fill();
    roundRect(fx + legGap / 2 - shoeOver, bodyBottom + beinRechts, legW + 2 * shoeOver, shoeH, rad * 0.7);
    ctx.fill();

    // ---- Körper ----
    const isSide = r === "links" || r === "rechts";
    const bw = isSide ? bodyW * 0.6 : bodyW;
    ctx.fillStyle = FARBEN.hemd;
    roundRect(fx - bw / 2, bodyTop, bw, bodyH, rad);
    ctx.fill();
    // dezenter Schatten an der Seite für Tiefe
    ctx.fillStyle = FARBEN.hemdSchatten;
    const seitenSchattenB = bw * 0.18;
    if (!isSide) {
        roundRect(fx + bw / 2 - seitenSchattenB, bodyTop, seitenSchattenB, bodyH, 0);
        ctx.fill();
    }
    ctx.strokeStyle = FARBEN.kontur;
    roundRect(fx - bw / 2, bodyTop, bw, bodyH, rad);
    ctx.stroke();

    // ---- Arme ----
    ctx.fillStyle = FARBEN.hemd;
    const aY = bodyTop + 10 * s;
    if (!isSide) {
        roundRect(fx - bw / 2 - armW, aY, armW, armH, rad);
        ctx.fill();
        ctx.stroke();
        roundRect(fx + bw / 2, aY, armW, armH, rad);
        ctx.fill();
        ctx.stroke();
    } else {
        // leichter Arm-Schwung beim Laufen (umgekehrt zur Beinphase)
        const swing = Math.sin(figur.gehphase + Math.PI) * 8 * s;
        roundRect(fx - armW / 2 + swing, aY, armW, armH, rad);
        ctx.fill();
        ctx.stroke();
    }

    // ---- Hals ----
    ctx.fillStyle = FARBEN.haut;
    roundRect(fx - headR * 0.28, neckY, headR * 0.56, neckH + 2 * s, rad * 0.4);
    ctx.fill();
    ctx.stroke();

    // ---- Kopf: Haare als Basis, Gesicht als Ausschnitt ----
    // 1. Haar-Basis (etwas grösser als der Kopf für Volumen)
    ctx.fillStyle = FARBEN.haare;
    ctx.beginPath();
    ctx.arc(fx, headY, headR * 1.08, 0, 2 * Math.PI);
    ctx.fill();

    // 2. Gesicht (Haut-Ellipse) je nach Richtung positioniert
    let faceX = fx;
    let faceY = headY + headR * 0.12;
    let faceRx = headR * 0.78;
    let faceRy = headR * 0.82;

    if (r === "links") {
        faceX = fx - headR * 0.2;
        faceRx = headR * 0.6;
    } else if (r === "rechts") {
        faceX = fx + headR * 0.2;
        faceRx = headR * 0.6;
    }

    if (r !== "hinten") {
        ctx.fillStyle = FARBEN.haut;
        ctx.beginPath();
        ctx.ellipse(faceX, faceY, faceRx, faceRy, 0, 0, 2 * Math.PI);
        ctx.fill();
    }

    // 3. Kopf-Silhouette (Kontur um das ganze Haar-Oval)
    ctx.strokeStyle = FARBEN.kontur;
    ctx.beginPath();
    ctx.arc(fx, headY, headR * 1.08, 0, 2 * Math.PI);
    ctx.stroke();

    // 4. Haar-Glanz (dünner Strich oben)
    if (r !== "hinten") {
        ctx.strokeStyle = FARBEN.haareGlanz;
        ctx.lineWidth = Math.max(1, 3 * s);
        ctx.beginPath();
        if (r === "vorne") {
            ctx.arc(fx, headY - headR * 0.1, headR * 0.85, Math.PI * 1.15, Math.PI * 1.55);
        } else {
            const seite = r === "links" ? -1 : 1;
            ctx.arc(fx + seite * headR * 0.1, headY - headR * 0.1, headR * 0.85, Math.PI * (1.2 - seite * 0.1), Math.PI * (1.5 - seite * 0.1));
        }
        ctx.stroke();
        ctx.lineWidth = Math.max(1, 2 * s);
    }

    // ---- Gesicht ----
    const eyeR = Math.max(1.5, headR * 0.1);

    if (r === "vorne") {
        // Augenbrauen
        ctx.strokeStyle = FARBEN.haare;
        ctx.lineWidth = Math.max(1, 2.5 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(fx - headR * 0.43, headY - headR * 0.08);
        ctx.lineTo(fx - headR * 0.17, headY - headR * 0.14);
        ctx.moveTo(fx + headR * 0.17, headY - headR * 0.14);
        ctx.lineTo(fx + headR * 0.43, headY - headR * 0.08);
        ctx.stroke();
        ctx.lineCap = "butt";

        // Augen
        ctx.fillStyle = FARBEN.kontur;
        ctx.beginPath();
        ctx.arc(fx - headR * 0.3, headY + headR * 0.05, eyeR, 0, 2 * Math.PI);
        ctx.arc(fx + headR * 0.3, headY + headR * 0.05, eyeR, 0, 2 * Math.PI);
        ctx.fill();

        // Wangen
        ctx.fillStyle = FARBEN.wange;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(fx - headR * 0.45, headY + headR * 0.3, headR * 0.11, 0, 2 * Math.PI);
        ctx.arc(fx + headR * 0.45, headY + headR * 0.3, headR * 0.11, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Mund
        ctx.strokeStyle = FARBEN.mund;
        ctx.lineWidth = Math.max(1, 2.5 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(fx, headY + headR * 0.38, headR * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        ctx.lineCap = "butt";
    } else if (r === "links" || r === "rechts") {
        const seite = r === "links" ? -1 : 1;

        // Augenbraue
        ctx.strokeStyle = FARBEN.haare;
        ctx.lineWidth = Math.max(1, 2.5 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(fx + seite * headR * 0.15, headY - headR * 0.18);
        ctx.lineTo(fx + seite * headR * 0.42, headY - headR * 0.12);
        ctx.stroke();
        ctx.lineCap = "butt";

        // Auge
        ctx.fillStyle = FARBEN.kontur;
        ctx.beginPath();
        ctx.arc(fx + seite * headR * 0.3, headY + headR * 0.02, eyeR, 0, 2 * Math.PI);
        ctx.fill();

        // Nase (sanfte Kurve)
        ctx.fillStyle = FARBEN.hautSchatten;
        ctx.strokeStyle = FARBEN.kontur;
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.beginPath();
        ctx.moveTo(fx + seite * headR * 0.65, headY - headR * 0.02);
        ctx.quadraticCurveTo(
            fx + seite * headR * 0.95, headY + headR * 0.12,
            fx + seite * headR * 0.68, headY + headR * 0.22
        );
        ctx.quadraticCurveTo(
            fx + seite * headR * 0.5, headY + headR * 0.22,
            fx + seite * headR * 0.5, headY + headR * 0.1
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wange
        ctx.fillStyle = FARBEN.wange;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(fx + seite * headR * 0.45, headY + headR * 0.35, headR * 0.1, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Mund
        ctx.strokeStyle = FARBEN.mund;
        ctx.lineWidth = Math.max(1, 2.5 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(fx + seite * headR * 0.5, headY + headR * 0.42);
        ctx.quadraticCurveTo(
            fx + seite * headR * 0.65, headY + headR * 0.48,
            fx + seite * headR * 0.78, headY + headR * 0.4
        );
        ctx.stroke();
        ctx.lineCap = "butt";
    }
    // hinten: kein Gesicht
}

function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    zeichneZimmer();
    zeichneTueren();
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

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const scale = canvas.width / LOGICAL_WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
}

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
