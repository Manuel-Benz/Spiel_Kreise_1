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
    tuerGeheim:  GRAU.b70,            // Hauptraum-Wandfarbe → unsichtbare Geheimtür
    tuerGeheimOffen: GRAU.b80,        // Nach Code-Eingabe: dunkler als Wand → permanenter Akzent
    tuerGeheimOutline: "#5fff8a",     // Phosphor-Grün unter Nachtsicht (binoculars im Inventar)
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
              ziel: "keller", laufziel: { fu: 0.88, fv: 0.45 },
              // Drop-Target für code_geheimtuer: setzt keller_freigeschaltet=true,
              // verbraucht binoculars + code, deaktiviert Nachtsicht.
              // Klick ohne Drop → siehe pointerdown-Branch (Hinweistext).
              akzeptiert: {
                  code_geheimtuer: (s) => {
                      verbrauche("binoculars_1");
                      verbrauche("code_geheimtuer");
                      delete s.inventar.keller_code;
                      s.zustaende.keller_freigeschaltet = true;
                      deaktiviereNachtsicht();
                      aktualisiereInventar();
                      zeigeOverlayText("The keypad clicks open. The hatch to the cellar swings free.");
                      automatischSchliessen(3000);
                      draw();
                  },
              },
            },
        ],
    },
    garten: {
        name: "Garten",
        farben: {
            decke: "#5c9cc2", boden: "#4e8c3f",
            hintereWand: "#5c9cc2",
            linkeWand: "#5c9cc2",
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
            // Keller-Rück-Tür: gleiche Polygon-Geometrie wie die Geheimtür im Hauptraum
            // (rechte Wand u 0.325..0.575, v 0..0.4, hier auf die linke Kellerwand gespiegelt)
            // und gleiche Farbe wie die freigeschaltete Geheimtür (b80) → konsistent zur
            // Tür auf der anderen Seite. Ohne Label, damit die beiden Türen optisch identisch sind.
            { id: "zurueck",
              polygon: [linkeWandPunkt(0.325, 0), linkeWandPunkt(0.575, 0),
                        linkeWandPunkt(0.575, 0.4), linkeWandPunkt(0.325, 0.4)],
              ziel: "haupt", laufziel: { fu: 0.12, fv: 0.45 },
              farbe: GRAU.b80 },
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
        // "voll"-Status der Toiletten — orthogonal zum Sitz-Switch oben:
        //   leer (false) = Klick togglet Sitz; voll (true) = Klick spült + setzt voll=false.
        //   Ein Objekt (animal_3_1, duck_1) im WC entleeren → voll=true.
        toilette_1_voll: false,
        toilette_2_voll: false,
        octopus_da: true,        // Tintenfisch sitzt auf toilet_1 — solange true, blockiert er die Spülung dort.
        octopus_zustand: 1,      // 1 = mürrisch (octopus_1_1, initial) / 2 = leicht aufgehellt / 3 = zufrieden (animiert sich anschliessend weg).
        formelbuch_gefunden: false,  // wird true, sobald die 5 Bücher in regal-4 (2. von unten) im Hauptraum angeklickt wurden.
        // Chain 1 — Hauptraum-Torte → Schlüssel → cupboard_1 → Zettel → Lampe → Code (siehe AUFGABEN.chain_1_*).
        chain_1_step: 0,           // 0 = nichts, 1 = Kuchen gelöst, 2 = Schrank offen, 3 = Zettel im Inventar, 4 = unter Lampe, 5 = π-Aufgabe gelöst
        cupboard_1_offen: false,   // toggelt Sichtbarkeit zwischen #cupboard_1_1 (geschlossen) und #cupboard_1_2 (offen) — beide als <image>, Konvention wie Sanitärobjekte.
        // Chain 2 — animal_3_1 (Glas mit Fisch) → toilet_2 dumpen → animal_3_2 (leeres Glas)
        // → in Wanne füllen → animal_3_3 (Glas mit Wasser) → Octopus zwei Mal füttern.
        chain_2_step: 0,           // 0 = nichts, 1 = animal_3_1 aufgenommen, 2 = im WC entleert, 3 = aufgefüllt, 4 = Octopus 1× gefüttert, 5 = Octopus 2× → exit.
        octopus_exit_gestartet: false, // Sicherheits-Flag: Exit-Animation maximal 1× pro Run starten (siehe schliesseOverlay-Hook).
        // Chain 3 — zwei parallele Pfade: (a) zentrale Wolke anklicken → Vogel sichtbar.
        // (b) Schlauch-Aufgabe lösen → gartenschlauch ins Inventar → auf flower_1 droppen
        // → seed_1. Dann seed_1 auf Vogel → goldene_muenzen. Goldene Münzen auf Octopus
        // öffnen chain_3_pizza-Aufgabe; bei richtig: octopus_zustand +1 (münzen-spez. Text).
        // Bridge: Octopus weg → toilet_1 togglen → binoculars_1 erscheinen → aufheben →
        // Nachtsicht-Filter aktiv → Geheimtür im Hauptraum sichtbar → Code 355113 eingeben
        // → binoculars + code verbraucht, Filter aus, keller_freigeschaltet=true.
        vogel_da: false,           // bird_1 sichtbar, sobald die zentrale Wolke geklickt wurde
        wolke_zentral_weg: false,  // WOLKEN[1] wird ausgeblendet, sobald geklickt
        schlauch_genommen: false,  // gradenhose_1-<image> aus dem Garten ausblenden, sobald in Inventar
        flower_1_gegossen: false,  // flower_1 visuell auf 2× skaliert (CSS-Klasse)
        binoculars_genommen: false, // binoculars_1 aus toilet_1-Schüssel ausblenden, sobald aufgehoben
        keller_freigeschaltet: false, // Code richtig eingegeben → Geheimtür permanent sichtbar (b80) + Keller offen
        // Chain 4 — duck_1 + muffin_1 aufnehmen → duck in Ketten dropen → mit muffin füttern
        // → duck wächst auf 2× und spuckt Messgerät aus → Messgerät auf Teppich → Aufgabe
        // Ringfläche → Schaufel automatisch ins Inventar.
        duck_im_keller: false,     // duck_1 in den Ketten platziert (DOM-Element duck_1_keller sichtbar)
        duck_gefuettert: false,    // muffin_1 verfüttert → CSS-Klasse duck-gross + Messgerät spawnt
        teppich_gemessen: false,   // Aufgabe chain_4_teppich gelöst → Schaufel im Inventar
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
        // Original (z.B. id="toilet_1_1") UND Front-Layer-Klone (id="v_<idx>_toilet_1_1")
        // matchen — `klonePflanzenVorne()` prefixt Klon-IDs mit `v_<idx>_` gegen Gradient-Konflikte.
        // Wir toggeln eine CSS-Klasse `sanitar-aus` (mit display:none !important im <style>),
        // die die Inline-display-Setzung von aktualisierePflanzenTiefe() überschreibt.
        document.querySelectorAll(`[id="${id}"], [id^="v_"][id$="_${id}"]`).forEach(el => {
            el.classList.toggle("sanitar-aus", !sichtbar);
        });
    };
    setSichtbar("bathtub_1_1", spielstand.zustaende.badewanne === 1);
    setSichtbar("bathtub_1_2", spielstand.zustaende.badewanne === 2);
    setSichtbar("toilet_1_1", spielstand.zustaende.toilette_1 === 1);
    setSichtbar("toilet_1_2", spielstand.zustaende.toilette_1 === 2);
    setSichtbar("toilet_2_1", spielstand.zustaende.toilette_2 === 1);
    setSichtbar("toilet_2_2", spielstand.zustaende.toilette_2 === 2);
    // Voll-Indikatoren: nur sichtbar, wenn Toilette voll UND Sitz oben (Schüsselöffnung sichtbar).
    setSichtbar("toilet_1_voll", spielstand.zustaende.toilette_1_voll && spielstand.zustaende.toilette_1 === 2);
    setSichtbar("toilet_2_voll", spielstand.zustaende.toilette_2_voll && spielstand.zustaende.toilette_2 === 2);
    // Octopus-Switch: einer der drei sichtbar (oder keiner, wenn er das Bad verlassen hat).
    const oz = spielstand.zustaende.octopus_zustand;
    setSichtbar("octopus_1_1", spielstand.zustaende.octopus_da && oz === 1);
    setSichtbar("octopus_1_2", spielstand.zustaende.octopus_da && oz === 2);
    setSichtbar("octopus_1_3", spielstand.zustaende.octopus_da && oz === 3);
    // animal_3_1-Image auf desk_4 verstecken, sobald irgendeine Variante (oder Folgestand) im
    // Inventar / Spielstand erreicht ist — egal ob _1, _2 oder _3 bzw. chain_2_step >= 1.
    const animal3InSpielstand = spielstand.gegenstaende.has("animal_3_1") ||
                                spielstand.gegenstaende.has("animal_3_2") ||
                                spielstand.gegenstaende.has("animal_3_3") ||
                                (spielstand.zustaende.chain_2_step ?? 0) >= 1;
    setSichtbar("animal_3_1", !animal3InSpielstand);
    // Chain 3: Sichtbarkeit von binoculars_1 hängt u.a. an octopus_da und toilette_1.
    // aktualisiereChain3() ist später definiert (function-hoisting macht das sicher).
    if (typeof aktualisiereChain3 === "function") aktualisiereChain3();
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

// Toilet-Voll-Helfer: setzen Voll-State + Indikator, ohne den Sitz-Switch anzufassen.
function setzeToilette1Voll(voll) {
    spielstand.zustaende.toilette_1_voll = !!voll;
    aktualisiereSanitaer();
}
function setzeToilette2Voll(voll) {
    spielstand.zustaende.toilette_2_voll = !!voll;
    aktualisiereSanitaer();
}

// Octopus-Switch-Helfer (analog setzeBadewanne etc.).
function setzeOctopusZustand(zustand) {
    spielstand.zustaende.octopus_zustand = (zustand === 2 ? 2 : zustand === 3 ? 3 : 1);
    aktualisiereSanitaer();
    console.log(`Octopus: Zustand ${spielstand.zustaende.octopus_zustand} (octopus_1_${spielstand.zustaende.octopus_zustand})`);
}

window.setzeBadewanne = setzeBadewanne;
window.setzeToilette1Voll = setzeToilette1Voll;
window.setzeToilette2Voll = setzeToilette2Voll;
window.setzeOctopusZustand = setzeOctopusZustand;

// Octopus-Exit-Animation: octopus_1_3 wird per CSS-Transition aus dem Bild geschoben
// (Richtung "zurueck"-Pfeil = nach unten-vorne). Versatz nach links/rechts kippt der
// Figur-Position aus, damit der Octopus ihr ausweicht.
// Ende: octopus_da=false, Sichtbarkeit aus, toilet_1 wird damit klickbar.
function animiereOctopusRaus() {
    // Beide DOM-Vorkommen (Rück- + Front-Layer-Klon mit `v_<idx>_octopus_1_3`-Prefix) ansprechen.
    const els = document.querySelectorAll(`[id="octopus_1_3"], [id^="v_"][id$="_octopus_1_3"]`);
    if (!els.length) {
        // Sicherheitsnetz: falls kein Element gefunden, sofort wegschalten.
        spielstand.zustaende.octopus_da = false;
        aktualisiereSanitaer();
        return;
    }
    // Figur ist links der Mitte → Octopus bewegt sich nach RECHTS raus, sonst nach links.
    // (figur.fu < 0.5 → rechte Seite frei, weicht der Figur aus.)
    const richtungRechts = (figur.fu < 0.5);
    const dx = richtungRechts ? 380 : -560;
    const dy = 520;  // nach unten-vorne raus (Richtung "zurueck"-Pfeil unten am Bildrand).
    let abgeschlossen = false;
    const beenden = () => {
        if (abgeschlossen) return;
        abgeschlossen = true;
        spielstand.zustaende.octopus_da = false;
        aktualisiereSanitaer();
        els.forEach(el => {
            el.classList.remove("octopus-leaving");
            el.style.transform = "";
        });
    };
    els.forEach(el => {
        el.classList.add("octopus-leaving");
        // Im nächsten Frame Transform setzen, damit die CSS-Transition greift.
        requestAnimationFrame(() => {
            el.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        el.addEventListener("transitionend", beenden, { once: true });
    });
    // Safety-Net: falls transitionend nicht feuert (z.B. Element wird vorher hidden),
    // nach 2.4 s zwangsweise abschliessen (Transition selbst dauert 1.92 s).
    setTimeout(beenden, 2400);
}
window.animiereOctopusRaus = animiereOctopusRaus;
window.setzeToilette1 = setzeToilette1;
window.setzeToilette2 = setzeToilette2;
window.wechsleBadewanne = wechsleBadewanne;
window.wechsleToilette1 = wechsleToilette1;
window.wechsleToilette2 = wechsleToilette2;

// ---------- cupboard_1-Switch (Büro): geschlossen → offen ----------
// Switch-Paar nach Sanitär-Konvention: cupboard_1_1 (geschlossen, Initialzustand) und
// cupboard_1_2 (offen). Zettel ist ein separates Inline-Element ÜBER cupboard_1_2.
// Selektor matcht Original UND Front-Layer-Klone (siehe Stolperstein "Sanitär-Klone-IDs").
function aktualisiereCupboard1() {
    const offen = !!spielstand.zustaende.cupboard_1_offen;
    const setSichtbar = (id, sichtbar) => {
        document.querySelectorAll(`[id="${id}"], [id^="v_"][id$="_${id}"]`).forEach(el => {
            el.classList.toggle("sanitar-aus", !sichtbar);
        });
    };
    setSichtbar("cupboard_1_1", !offen);
    setSichtbar("cupboard_1_2", offen);
    // Zettel im Schrank verschwinden lassen, sobald er im Inventar liegt.
    setSichtbar("cupboard_1_zettel_visual", offen && !spielstand.gegenstaende.has("zettel"));
}

function oeffneCupboard1() {
    spielstand.zustaende.cupboard_1_offen = true;
    spielstand.zustaende.chain_1_step = Math.max(spielstand.zustaende.chain_1_step, 2);
    aktualisiereCupboard1();
    draw();
}
window.oeffneCupboard1 = oeffneCupboard1;

// ---------- Chain 3 — Sichtbarkeit / Skalierung der DOM-Elemente ----------
// Spiegelt spielstand.zustaende auf das DOM:
//   • bird_1 (Garten)             — sichtbar wenn vogel_da
//   • gradenhose_1 (Garten)       — versteckt sobald schlauch_genommen
//   • flower_1 (Garten)           — Klasse "flower-1-gross" → CSS scale(2)
//   • binoculars_1 in toilet_1    — sichtbar wenn !octopus_da && toilette_1===2 && !genommen
// Selektor matcht Original UND Front-Layer-Klone (`v_<idx>_…`-Prefix von klonePflanzenVorne).
function aktualisiereChain3() {
    const z = spielstand.zustaende;
    const setSichtbar = (id, sichtbar) => {
        document.querySelectorAll(`[id="${id}"], [id^="v_"][id$="_${id}"]`).forEach(el => {
            el.classList.toggle("sanitar-aus", !sichtbar);
        });
    };
    setSichtbar("bird_1", !!z.vogel_da);
    setSichtbar("gradenhose_1", !z.schlauch_genommen);
    setSichtbar("binoculars_1_visual", !z.octopus_da && z.toilette_1 === 2 && !z.binoculars_genommen);

    // flower_1 skalieren — class auf dem Wrapper-<g class="flower-1">. Original UND Klone
    // haben dieselbe Klasse (klonePflanzenVorne kopiert sie mit), also alle gleichzeitig erfassen.
    document.querySelectorAll(".flower-1").forEach(el => {
        el.classList.toggle("flower-1-gross", !!z.flower_1_gegossen);
    });

    if (typeof aktualisiereChain4 === "function") aktualisiereChain4();
}

// ---------- Chain 4 — Sichtbarkeit / Skalierung der DOM-Elemente ----------
//   • duck_1 (Wanne)         — versteckt, sobald im Inventar oder im Keller (duck_im_keller).
//   • muffin_1 (desk_5)      — versteckt, sobald im Inventar oder verfüttert (duck_gefuettert).
//   • duck_1_keller (Keller) — sichtbar, sobald duck_im_keller; CSS-Klasse duck-gross
//                              auf .duck-keller-inner, sobald duck_gefuettert.
function aktualisiereChain4() {
    const z = spielstand.zustaende;
    const inv = spielstand.gegenstaende;
    const setSichtbar = (id, sichtbar) => {
        document.querySelectorAll(`[id="${id}"], [id^="v_"][id$="_${id}"]`).forEach(el => {
            el.classList.toggle("sanitar-aus", !sichtbar);
        });
    };
    const duckInInv     = inv.has("duck_1");
    const muffinInInv   = inv.has("muffin_1");
    setSichtbar("duck_1",        !duckInInv && !z.duck_im_keller);
    setSichtbar("muffin_1",      !muffinInInv && !z.duck_gefuettert);
    setSichtbar("duck_1_keller", !!z.duck_im_keller);
    document.querySelectorAll(".duck-keller-inner").forEach(el => {
        el.classList.toggle("duck-gross", !!z.duck_gefuettert);
    });
}
window.aktualisiereChain3 = aktualisiereChain3;

// ---------- Chain 3 / Bridge: Nachtsicht ----------
// Aktiviert/deaktiviert die Body-Klasse `nachtsicht`. Per CSS sitzt darüber ein
// brightness/sepia/hue-rotate-Filter auf #stage (siehe style.css). Inventar/Overlay
// liegen ausserhalb #stage und bleiben normal lesbar.
function aktiviereNachtsicht() {
    document.body.classList.add("nachtsicht");
    draw();  // Geheimtür-Phosphor-Outline neu zeichnen
}
function deaktiviereNachtsicht() {
    document.body.classList.remove("nachtsicht");
    draw();
}
window.aktiviereNachtsicht = aktiviereNachtsicht;
window.deaktiviereNachtsicht = deaktiviereNachtsicht;

// (Code-Eingabe-Overlay wurde durch Drop-from-Inventory ersetzt — siehe
// RAEUME.haupt.tueren.geheim.akzeptiert.code_geheimtuer und den pointerdown-Branch
// für secret-Türen.)

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

// Spülsound (Platzhalter): 1.6 s gefiltertes Rauschen mit Tiefpass-Sweep abwärts +
// langsam ansteigender und wieder abfallender Lautstärke. Klingt nach "Schwall + Abfluss".
function spieleSpuelung() {
    if (!soundAn) return;
    ensureAudio();
    if (!audioCtx) return;
    const dauer = 1.6;
    const sampleRate = audioCtx.sampleRate;
    const len = Math.floor(dauer * sampleRate);
    const buf = audioCtx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    const now = audioCtx.currentTime;
    // Tiefpass-Sweep: 1200 Hz → 250 Hz (Wasser läuft ab → Restgurgeln)
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + dauer);
    filter.Q.value = 0.7;
    const gain = audioCtx.createGain();
    // Hüllkurve: Attack 0.1 s → Sustain 0.25 → Decay zum Ende
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.1);
    gain.gain.setValueAtTime(0.25, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dauer);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + dauer);
}
window.spieleSpuelung = spieleSpuelung;

// Burp-Sound (Chain 4): kurzer tiefer Rülpser, ~0.6 s. Tieffrequentes Rauschen mit
// Tiefpass-Sweep abwärts (300 Hz → 80 Hz) + Pulse-Hüllkurve (kurzer Anschwell + Plateau + Abfall).
function spieleBurp() {
    if (!soundAn) return;
    ensureAudio();
    if (!audioCtx) return;
    const dauer = 0.55;
    const sampleRate = audioCtx.sampleRate;
    const len = Math.floor(dauer * sampleRate);
    const buf = audioCtx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    const now = audioCtx.currentTime;
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + dauer);
    filter.Q.value = 6;  // resonanter als Spülung → "voller" Klang
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.45, now + 0.06);
    gain.gain.setValueAtTime(0.45, now + 0.30);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dauer);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + dauer);
}
window.spieleBurp = spieleBurp;

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
// Jede Aufgabe: { typ?, frage, formel?, fragetext?, pi_hinweis?, loesung|optionen, toleranz?, bei_richtig? }
// - typ: "zahl" (default) oder "multiple_choice"
// - frage/fragetext dürfen Strings oder Funktionen (spielstand) => string sein,
//   damit Cross-Room-Lookups möglich sind (z.B. "Setze r aus dem Büro ein.")
// - formel ist eine KaTeX-Formel (String, ohne $-Wrapper)
// - pi_hinweis: true → blendet "Rechne mit π = 3.14." als Hinweiszeile ein
// - typ "zahl":            loesung ist eine Zahl; toleranz = maximaler erlaubter Fehler
// - typ "multiple_choice": optionen = [ { katex|label, korrekt? }, ... ] → Buttons als Auswahl
// - bei_richtig: { schluessel?, inventar?, gegenstand?, belohnung_text? }
// Konvention im ganzen Spiel: π = PI_KONSTANTE (3.14). Aufgaben mit pi_hinweis:true
// blenden "Rechne mit π = 3.14." als Hinweis ein.
const PI_KONSTANTE = 3.14;
const AUFGABEN = {
    // Chain 1, Aufgabe 1: cake_1 anklicken → Multiple-Choice mit gepaarten U+A-Werten.
    // π = 3.14, d = 20 → r = 10 → U = 2·3.14·10 = 62.8 cm, A = 3.14·100 = 314 cm².
    // Distraktoren entsprechen typischen Schülerfehlern: 2-Vergessen, d²-Statt-r², d-statt-r.
    chain_1_kuchen: {
        typ: "multiple_choice",
        frage: "How large are the circumference and area of this cake if its diameter is 20 cm?",
        pi_hinweis: true,
        optionen: [
            { katex: "C = 31.4\\text{ cm}, \\quad A = 314\\text{ cm}^2" },
            { katex: "C = 62.8\\text{ cm}, \\quad A = 314\\text{ cm}^2", korrekt: true },
            { katex: "C = 62.8\\text{ cm}, \\quad A = 1256\\text{ cm}^2" },
            { katex: "C = 125.6\\text{ cm}, \\quad A = 1256\\text{ cm}^2" },
        ],
        bei_richtig: {
            gegenstand: "schluessel_buero",
            belohnung_text: "Correct! You found a key — it's now in your inventory.",
            callback: (s) => { s.zustaende.chain_1_step = Math.max(s.zustaende.chain_1_step, 1); },
        },
    },
    // Chain 1, Aufgabe 2: Zettel auf den Lampenschein gezogen → π-Approximationen.
    // Werte: 22/7 ≈ 3,142857; √10 ≈ 3,162278; 355/113 ≈ 3,141593; √2+√3 ≈ 3,146264.
    // π ≈ 3,14159265 — also ist 355/113 die beste Annäherung.
    // Chain 2: Octopus-Drop (animal_3_3) → Zahlenaufgabe gate ihn vor dem ersten Füttern.
    // C = 2π · 100 cm → r = 100 cm → A = π · 100² = 10000π → mit π = 3.14: 31400 cm².
    // bei_richtig.callback verbraucht das Glas, advanced den Octopus auf zustand 2 + chain_2_step=4.
    // Zweiter Drop (animal_3_3 nach erneutem Wanne-Auffüllen) ist NICHT durch Aufgabe gegated —
    // siehe OBJEKTE.badezimmer.octopus.akzeptiert.animal_3_3.
    chain_2_octopus: {
        frage: "If the circumference is C = 2π · 100 cm, how large is the area A?",
        fragetext: "Enter A as a number in cm².",
        loesung: 31400,
        toleranz: 1,
        pi_hinweis: true,
        bei_richtig: {
            // Mood-Advance: octopus_zustand +1 (max 3), Exit-Animation bei state 3.
            // Symmetrisch zu chain_3_pizza — Reihenfolge der beiden Chains egal.
            // belohnung_text als Funktion → POST-callback ausgewertet.
            belohnung_text: (s) => {
                if (s.zustaende.octopus_zustand === 3) {
                    return "Correct! The octopus, fully content now, slides off with a happy gurgle.";
                }
                return "Correct! The octopus' mood has improved, but it is not quite happy yet.";
            },
            callback: (s) => {
                verbrauche("animal_3_3");
                aktualisiereInventar();
                const aktuell = s.zustaende.octopus_zustand ?? 1;
                const neu = Math.min(aktuell + 1, 3);
                setzeOctopusZustand(neu);
                s.zustaende.chain_2_step = Math.max(s.zustaende.chain_2_step ?? 0, 4);
                // Exit-Animation startet erst NACH dem Schliessen des Aufgaben-Overlays
                // (siehe schliesseOverlay) — User soll die Mood-Antwort lesen können.
            },
        },
    },
    // Chain 3, Aufgabe 1: Klick auf Gartenschlauch → Multiple-Choice.
    // 5 kreisförmige Windungen mit Durchmesser d = 5/π m. Korrekt: 5 · π · d = 5 · π · 5/π = 25 m.
    // Distraktoren entsprechen typischen Schülerfehlern:
    //   • 5 m  — nur 1 Windung gerechnet (vergessen, mit 5 zu multiplizieren).
    //   • 50 m — d als Radius in U = 2πr eingesetzt: 5 · 2π · 5/π = 50.
    //   • 25/π m ≈ 7,96 m — π beim Umfang vergessen (5 · d statt 5 · π · d).
    chain_3_schlauch: {
        typ: "multiple_choice",
        frage: "The garden hose lies in 5 circular coils, each with a diameter of d = 5/π m. How long is the hose in total?",
        pi_hinweis: true,
        optionen: [
            { katex: "25\\text{ m}", korrekt: true },
            { katex: "5\\text{ m}" },
            { katex: "50\\text{ m}" },
            { katex: "\\dfrac{25}{\\pi}\\text{ m} \\approx 7.96\\text{ m}" },
        ],
        bei_richtig: {
            gegenstand: "gartenschlauch",
            belohnung_text: "Correct! You take the garden hose with you.",
            callback: (s) => {
                s.zustaende.schlauch_genommen = true;
                aktualisiereChain3();
            },
        },
    },
    // Chain 3, Aufgabe 2: Goldene Münzen auf Octopus → Pizzastück-Aufgabe.
    // α = 60°, r = √(6/π) m → A = (60/360) · π · (6/π) = 1/6 · 6 = 1 m².
    // Bewusst so gewählt, dass π im Kürzungsschritt komplett verschwindet (didaktisches Aha).
    // Toleranz ±0,05 m².
    // Mood-Advance per Callback: octopus_zustand +1 (max 3). Bei state 3 → Exit-Animation.
    // belohnung_text als Funktion → Text differenziert sich nach POST-callback-state
    // (gewaehrenBelohnung ruft callback VOR text-render auf).
    chain_3_pizza: {
        frage: "The octopus offers you a pizza slice. What is its area in m²?",
        fragetext: "Opening angle α = 60°, radius r = √(6/π) m.",
        loesung: 1,
        toleranz: 0.05,
        pi_hinweis: true,
        bei_richtig: {
            belohnung_text: (s) => {
                if (s.zustaende.octopus_zustand === 3) {
                    return "Correct! The octopus pockets the coins, gives a satisfied gurgle, and slides away.";
                }
                return "Correct! The octopus pockets the coins and looks a touch more cheerful, but isn't quite satisfied yet.";
            },
            callback: (s) => {
                verbrauche("goldene_muenzen");
                aktualisiereInventar();
                const aktuell = s.zustaende.octopus_zustand ?? 1;
                const neu = Math.min(aktuell + 1, 3);
                setzeOctopusZustand(neu);
                // Exit-Animation startet erst NACH dem Schliessen des Aufgaben-Overlays
                // (siehe schliesseOverlay) — User soll die Mood-Antwort lesen können.
            },
        },
    },
    chain_1_pi: {
        typ: "multiple_choice",
        frage: "Which of the following numbers is closest to π?",
        fragetext: "π ≈ 3.14159265…",
        tipp: "You may use your calculator.",
        optionen: [
            { katex: "\\dfrac{22}{7}" },
            { katex: "\\sqrt{10}" },
            { katex: "\\dfrac{355}{113}", korrekt: true },
            { katex: "\\sqrt{2} + \\sqrt{3}" },
        ],
        bei_richtig: {
            // inventar.keller_code (Zahl) bleibt für die spätere Tür-Code-Prüfung;
            // gegenstand "code_geheimtuer" ist das sichtbare Tag-Icon im Inventar.
            inventar: { keller_code: 355113 },
            gegenstand: "code_geheimtuer",
            belohnung_text: "Correct! In the lamplight the writing becomes readable — the note shows the code for a secret door: 355113.",
            callback: (s) => {
                s.zustaende.chain_1_step = Math.max(s.zustaende.chain_1_step, 5);
                s.gegenstaende.delete("zettel");
                aktualisiereInventar();
            },
        },
    },
    // Chain 4 — Teppich-Ringfläche.
    // Der Teppich besteht aus 12 konzentrischen Kreisen mit gleichem Abstand.
    // Gegeben: U = 6,28 m (Aussen-Umfang) und d = 10 cm (Abstand zwischen den Ringen).
    // Lösungsweg: R = U/(2π) = 1 m = 100 cm; r = R − d = 90 cm; A = π·(R²−r²) = 3,14·1900 = 5966 cm².
    chain_4_teppich: {
        typ: "multiple_choice",
        frage: "The measuring device shows the rug's outer circumference U = 6.28 m and the spacing between the concentric circles d = 10 cm. What is the area of the OUTERMOST ring?",
        pi_hinweis: true,
        tipp: "First find the outer radius R from U, then compute A = π·(R² − r²) with r = R − d.",
        optionen: [
            { katex: "5\\,966\\ \\mathrm{cm}^2", korrekt: true },
            { katex: "31\\,400\\ \\mathrm{cm}^2" },
            { katex: "25\\,434\\ \\mathrm{cm}^2" },
            { katex: "6\\,280\\ \\mathrm{cm}^2" },
        ],
        bei_richtig: {
            gegenstand: "schaufel",
            belohnung_text: "Correct — the area of the outermost ring is 5966 cm². Lifting a corner of the rug, you find a flat trowel hidden underneath.",
            callback: (s) => {
                verbrauche("messgeraet");
                s.zustaende.teppich_gemessen = true;
                aktualisiereInventar();
            },
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
        // 5 Bücher rechts in regal-4 (= 2. Tablar von unten) im Hauptregal — Klick öffnet das
        // Formelbuch-Overlay. Position berechnet aus bookshelf-Transform translate(650 310) scale(0.5)
        // + regal-4 transform translate(0 330): die 5 stehenden Bücher liegen lokal x=448..580,
        // y=8..96 → screen x=874..940, y=479..523.
        // laufziel knapp vor der hinteren Wand (analog zu Tür A/B), zentriert unter den Büchern.
        {
            id: "regal_buecher",
            polygon: [[874, 479], [940, 479], [940, 523], [874, 523]],
            laufziel: { fu: 0.60, fv: 0.92 },
            aktion: () => zeigeFormelbuch(),
        },
        // Chain 1, Schritt 1: cake_1 (3-stöckige Torte auf Tisch 1, vorne-links).
        // Polygon deckt den sichtbaren Torten-Footprint ab (SVG x=286..361, y=540..580).
        // Laufziel: vor Tisch 1 auf dem Boden — fv=0.667 (vor dem Tisch-Footprint fv=0.90+).
        // Komplett INAKTIV, solange das Formelbuch nicht gefunden wurde — Klick fällt durch zur Boden-
        // Logik, KEIN Hinweis-Overlay (laut Spec).
        {
            id: "cake_1_klick",
            polygon: [[286, 540], [361, 540], [361, 580], [286, 580]],
            laufziel: { fu: 0.10, fv: 0.667 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden,
            aufgabe: "chain_1_kuchen",
        },
        // Chain 4, Schritt 1b: muffin_1 auf desk_5 (vorne-rechts) — aufnehmbar.
        // SVG-Bbox aus index.html: x=1348 y=556 20×27 → Polygon mit Klick-Reserve drumherum.
        // Sichtbarkeit von #muffin_1 togglet aktualisiereChain4() (versteckt nach Aufnahme oder Verfütterung).
        {
            id: "muffin_1",
            polygon: [[1338, 546], [1378, 546], [1378, 596], [1338, 596]],
            laufziel: { fu: 0.84, fv: 0.36 },
            aufnehmen: "muffin_1",
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.gegenstaende.has("muffin_1")
                       && !s.zustaende.duck_gefuettert,
        },
        // Chain 4, finaler Drop: Messgerät auf den Teppich (HAUPT_TEPPICH, runder Teppich
        // in Boden-Mitte). Polygon = perspektivisches Trapez aus den Eck-Boden-Punkten der
        // Teppich-Bbox (cu±rMax, cv±rMax) mit cu=0.5, cv=0.683, rMax=0.20:
        //   vorne-links  bodenPunkt(0.3, 0.483) ≈ (538, 755)
        //   vorne-rechts bodenPunkt(0.7, 0.483) ≈ (1062, 755)
        //   hinten-rechts bodenPunkt(0.7, 0.883) ≈ (1014, 635)
        //   hinten-links  bodenPunkt(0.3, 0.883) ≈ (586, 635)
        {
            id: "teppich_haupt",
            polygon: [[538, 755], [1062, 755], [1014, 635], [586, 635]],
            laufziel: { fu: 0.5, fv: 0.45 },
            aktiv: (s) => s.gegenstaende.has("messgeraet") && !s.zustaende.teppich_gemessen,
            akzeptiert: {
                messgeraet: () => zeigeAufgabe("chain_4_teppich"),
            },
        },
    ],
    buero: [
        // Chain 1, Schritt 2: cupboard_1 ist Drop-Target für den schluessel_buero.
        // Linke Tür-Hälfte des Schranks (cupboard_1: <image> x=980..1380, y=106..706).
        // Polygon = LINKE Hälfte (x=980..1180), wo die Aufgabe-Tür entriegelt wird.
        // Nimmt den Schlüssel nur an, solange der Schrank noch zu ist.
        {
            id: "cupboard_1_drop",
            polygon: [[980, 106], [1180, 106], [1180, 706], [980, 706]],
            laufziel: { fu: 0.72, fv: 0.55 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden && !s.zustaende.cupboard_1_offen,
            akzeptiert: {
                schluessel_buero: (s) => {
                    verbrauche("schluessel_buero");
                    oeffneCupboard1();
                    zeigeOverlayText("Click — the key fits. The left cabinet door creaks open.");
                    automatischSchliessen(3000);
                },
            },
        },
        // Chain 1, Schritt 3: Zettel auf dem Cavity-Boden des offenen Schranks.
        // Polygon deckt den Bereich ab, wo der Zettel im offenen Schrank gerendert wird.
        // Nur aktiv, wenn der Schrank offen ist UND der Zettel noch nicht im Inventar liegt.
        {
            id: "cupboard_1_zettel",
            polygon: [[1070, 573], [1155, 573], [1155, 613], [1070, 613]],
            laufziel: { fu: 0.72, fv: 0.55 },
            aktiv: (s) => s.zustaende.cupboard_1_offen && !s.gegenstaende.has("zettel"),
            aktion: () => {
                spielstand.gegenstaende.add("zettel");
                spielstand.zustaende.chain_1_step = Math.max(spielstand.zustaende.chain_1_step, 3);
                aktualisiereInventar();
                aktualisiereCupboard1();
                draw();
                zeigeOverlayText("You take a crumpled note. It's barely legible.");
                automatischSchliessen(3000);
            },
        },
        // Chain 1, Schritt 4: Lichtkegel der handgemalten Tischlampe auf Tisch 2 — Drop-Target
        // für den Zettel. Der Lichtkegel-Pfad ist "M 334 431 Q 363 433 383 413 L 439 505 L 339 505 Z"
        // mit dem hellen Lichtfleck-Oval bei (389, 505). Polygon deckt das beleuchtete Areal ab.
        // (Nicht zu verwechseln mit der Pixar-Stehlampe lamp_1 vorne-links.)
        {
            id: "tischlampe_lichtkegel",
            polygon: [[330, 430], [445, 430], [445, 515], [330, 515]],
            laufziel: { fu: 0.30, fv: 0.55 },
            // Cursor:pointer (und Drop-Annahme) nur, wenn der Zettel zum Drop bereit ist.
            aktiv: (s) => s.zustaende.formelbuch_gefunden && s.gegenstaende.has("zettel"),
            akzeptiert: {
                zettel: () => {
                    spielstand.zustaende.chain_1_step = Math.max(spielstand.zustaende.chain_1_step, 4);
                    zeigeAufgabe("chain_1_pi");
                },
            },
        },
    ],
    badezimmer: [
        // animal_3_1 (Aquarium-Glas mit Goldfisch) auf desk_4 — kann ins Inventar genommen werden.
        // Polygon entspricht dem <image>-Bereich in index.html (x=1308 y=435 110×110).
        // Gating: erst nach Formelbuch-Fund klickbar (analog cake_1 in Chain 1) — Klick davor
        // fällt durch zur Boden-Logik, ohne Hinweis-Overlay.
        // Sobald aufgenommen, blendet aktualisiereSanitaer() das <image> aus (chain_2_step >= 1
        // oder eine der drei animal_3_*-IDs im Inventar).
        {
            id: "animal_3_1",
            polygon: [[1308, 435], [1418, 435], [1418, 545], [1308, 545]],
            laufziel: { fu: 0.86, fv: 0.10 },
            aufnehmen: "animal_3_1",
            aktiv: (s) => s.zustaende.formelbuch_gefunden && (s.zustaende.chain_2_step ?? 0) === 0,
        },
        // Chain 4, Schritt 1a: duck_1 in der Wanne — aufnehmbar.
        // SVG-Bbox aus index.html: x=420 y=480 40×44 → Polygon mit Klick-Reserve drumherum.
        // Aufgenommen wird die Ente nur EINMAL pro Run; aktualisiereChain4() blendet das DOM-Element aus.
        // WICHTIG: VOR dem bathtub-Eintrag platziert, weil das bathtub-Polygon (130..730, 440..640)
        // den Duck-Bereich überlappt → findeObjektBei nimmt das erste Match. Solange der Duck aktiv
        // ist (formelbuch + nicht aufgenommen + noch nicht im Keller), gewinnt er.
        {
            id: "duck_1",
            polygon: [[412, 472], [464, 472], [464, 530], [412, 530]],
            laufziel: { fu: 0.18, fv: 0.20 },
            aufnehmen: "duck_1",
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.gegenstaende.has("duck_1")
                       && !s.zustaende.duck_im_keller,
        },
        // Chain 3 / Bridge: binoculars_1 in der toilet_1-Schüssel — sichtbar, sobald der
        // Octopus weg und der Sitz oben ist (toilette_1===2). Klick → Aufnehm-Aktion → Inventar.
        // aktiviereNachtsicht() wird im nimmAufGegenstand-Hook getriggert (Spezial-ID-Branch).
        // Polygon = bbox des binoculars_1_visual <svg> in index.html (toilet_1 Schüssel).
        // WICHTIG: VOR toilet_1 platziert, weil das toilet_1-Polygon (1100..1240, 420..670)
        // den Binoculars-Bereich überlappt → findeObjektBei nimmt das erste Match.
        // laufziel etwas vor toilet_1 (analog zu animal_3_1 in Chain 2).
        {
            id: "binoculars_1",
            polygon: [[1110, 522], [1172, 522], [1172, 576], [1110, 576]],
            laufziel: { fu: 0.74, fv: 0.20 },
            aufnehmen: "binoculars_1",
            aktiv: (s) => !s.zustaende.octopus_da && s.zustaende.toilette_1 === 2 && !s.zustaende.binoculars_genommen,
        },
        // Toilette 1 (rechts, x=1040..1240): Sitz-Toggle (toilette_1 1↔2) ODER Spülung (voll → leer).
        // ABER solange der Tintenfisch drauf sitzt (spielstand.zustaende.octopus_da), blockiert
        // er beides. Voll-Mechanik ist Chain-Reserve (z.B. duck_1 → toilet_1 in späterer Chain),
        // aktuell wird toilette_1_voll von keinem Drop-Target gesetzt — die Spül-Logik ist aber
        // bereits da, damit sie konsistent zu toilet_2 funktioniert.
        // Polygone enger als die volle SVG-Bbox, damit sie nicht mit cupboard_2 (x=750..1100)
        // überlappen — sonst toggelt ein Klick auf den Schrank ungewollt eine Toilette.
        {
            id: "toilet_1",
            polygon: [[1100, 420], [1240, 420], [1240, 670], [1100, 670]],
            // Cursor:pointer erst, sobald der Octopus weg ist (vorher blockiert die aktion sowieso).
            aktiv: (s) => s.zustaende.formelbuch_gefunden && !s.zustaende.octopus_da,
            aktion: (s) => {
                if (s.zustaende.octopus_da) return;  // Tintenfisch sitzt drauf — Klick fällt durch.
                if (s.zustaende.toilette_1_voll) {
                    spieleSpuelung();
                    setzeToilette1Voll(false);
                } else {
                    wechsleToilette1();
                }
            },
        },
        // Toilette 2 (links): Polygon endet bei x=750, kein Überlapp mit cupboard_2.
        // Drop-Target für animal_3_1: nur akzeptiert, wenn Sitz oben (toilette_2===2) UND leer.
        // Klick: voll → spülen + sound; leer → Sitz togglen.
        {
            id: "toilet_2",
            polygon: [[590, 420], [750, 420], [750, 670], [590, 670]],
            // Cursor:pointer + Sitz-Toggle erst nach Formelbuch-Fund. Drop von animal_3_1
            // wird damit ebenfalls gegated, ist aber unkritisch (Item liegt erst nach Formelbuch im Inventar).
            aktiv: (s) => s.zustaende.formelbuch_gefunden,
            aktion: (s) => {
                if (s.zustaende.toilette_2_voll) {
                    spieleSpuelung();
                    setzeToilette2Voll(false);
                } else {
                    wechsleToilette2();
                }
            },
            akzeptiert: {
                animal_3_1: (s) => {
                    // Drop nur wenn Sitz oben UND leer — sonst still ablehnen (Glas bleibt im Inventar).
                    if (s.zustaende.toilette_2 !== 2) return;
                    if (s.zustaende.toilette_2_voll) return;
                    verbrauche("animal_3_1");
                    spielstand.gegenstaende.add("animal_3_2");
                    spielstand.zustaende.chain_2_step = Math.max(spielstand.zustaende.chain_2_step ?? 0, 2);
                    setzeToilette2Voll(true);
                    aktualisiereInventar();
                    zeigeOverlayText("You tip the fish into the toilet.\nThe glass is now empty.");
                    automatischSchliessen(2800);
                },
            },
        },
        // Badewanne — Drop-Target für animal_3_2 (Glas mit Wasser auffüllen).
        // Kein `aktion` — Klick auf die Wanne fällt durch zur Boden-Logik (Figur läuft hin).
        {
            id: "bathtub",
            polygon: [[130, 440], [730, 440], [730, 640], [130, 640]],
            laufziel: { fu: 0.18, fv: 0.20 },
            // Cursor:pointer nur, wenn animal_3_2 zum Drop bereit ist (sonst gibt's keine Aktion).
            aktiv: (s) => s.zustaende.formelbuch_gefunden && s.gegenstaende.has("animal_3_2"),
            akzeptiert: {
                animal_3_2: (s) => {
                    verbrauche("animal_3_2");
                    spielstand.gegenstaende.add("animal_3_3");
                    spielstand.zustaende.chain_2_step = Math.max(spielstand.zustaende.chain_2_step ?? 0, 3);
                    aktualisiereInventar();
                    zeigeOverlayText("You fill the glass with water from the bathtub.");
                    automatischSchliessen(2500);
                },
            },
        },
        // Octopus — Drop-Target für animal_3_3 (Wasser geben → Stimmung steigt).
        // Polygon (x=930..1300, y=380..710) deckt den sichtbaren Octopus-Körper ab, ohne
        // bis ans rechte SVG-Ende (x=1370) zu reichen — sonst überlappt es mit desk_4
        // (x=1200..1510) und ein Klick auf den Tisch fängt sich am Octopus.
        // Kein `aktion` — Klick ohne Drag fällt durch zur Boden-Logik.
        // Zwei Stufen: 1→2 (Mood-Hinweis), 2→3 (nach 2 s Exit-Animation).
        {
            id: "octopus",
            polygon: [[930, 380], [1300, 380], [1300, 710], [930, 710]],
            laufziel: { fu: 0.78, fv: 0.32 },
            akzeptiert: {
                // Beide Drops symmetrisch — jeder öffnet seine Aufgabe; im Aufgaben-Callback
                // wird das Item verbraucht und der octopus_zustand um +1 advanciert (max 3).
                // Bei state 3 startet automatisch die Exit-Animation. Reihenfolge der Chains
                // (animal_3_3 zuerst oder Münzen zuerst) ist damit egal.
                animal_3_3: () => zeigeAufgabe("chain_2_octopus"),
                goldene_muenzen: () => zeigeAufgabe("chain_3_pizza"),
            },
            // Cursor:pointer nur, wenn ein passendes Drop-Item im Inventar liegt.
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && s.zustaende.octopus_da !== false
                       && (s.gegenstaende.has("animal_3_3") || s.gegenstaende.has("goldene_muenzen")),
        },
    ],
    garten: [
        // Chain 3a: zentrale Wolke (WOLKEN[1] cx=470, cy=140) anklicken → Vogel erscheint.
        // Polygon deckt grob die Wolkenhülle ab und zugleich die spätere Vogel-Bbox
        // (bird_1 SVG x=380 y=95 w=180 h=90 → 380..560, 95..185).
        // laufziel mitten im Garten — Figur läuft hin, dann Klick-Effekt.
        {
            id: "wolke_zentral",
            polygon: [[380, 95], [560, 95], [560, 185], [380, 185]],
            laufziel: { fu: 0.30, fv: 0.50 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden && !s.zustaende.vogel_da && !s.zustaende.wolke_zentral_weg,
            aktion: () => {
                spielstand.zustaende.wolke_zentral_weg = true;
                spielstand.zustaende.vogel_da = true;
                aktualisiereChain3();
                draw();
                zeigeOverlayText("As the cloud drifts apart, a bird becomes visible behind it.");
                automatischSchliessen(3000);
            },
        },
        // Chain 3c: Vogel als Drop-Target für seed_1 → goldene_muenzen.
        // Selbes Polygon wie die Wolke (Vogel sitzt an deren ehemaliger Position).
        // Nur aktiv, wenn der Vogel sichtbar ist UND keine Münzen schon verteilt wurden.
        {
            id: "bird_1",
            polygon: [[380, 95], [560, 95], [560, 185], [380, 185]],
            laufziel: { fu: 0.30, fv: 0.50 },
            aktiv: (s) => s.zustaende.vogel_da,
            akzeptiert: {
                seed_1: (s) => {
                    if (s.gegenstaende.has("goldene_muenzen") || !s.gegenstaende.has("seed_1")) return;
                    verbrauche("seed_1");
                    spielstand.gegenstaende.add("goldene_muenzen");
                    // Vogel fliegt davon — Bird-OBJEKT damit inaktiv und Inline-SVG ausgeblendet.
                    s.zustaende.vogel_da = false;
                    aktualisiereInventar();
                    aktualisiereChain3();
                    zeigeOverlayText("The bird gobbles up the seed, drops a few golden coins for you, and flies off.");
                    automatischSchliessen(3000);
                },
            },
        },
        // Chain 3b: Gartenschlauch an der rechten Hauswand. Polygon grob um die per Affin-Matrix
        // projizierte Schlauch-Bbox (≈ x:1320..1370, y:460..595) — etwas breiter für komfortable Klicks.
        // Nur aktiv, solange der Schlauch noch nicht im Inventar liegt UND Formelbuch gefunden.
        {
            id: "gartenschlauch",
            polygon: [[1310, 455], [1380, 455], [1380, 605], [1310, 605]],
            laufziel: { fu: 0.85, fv: 0.45 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden && !s.zustaende.schlauch_genommen,
            aufgabe: "chain_3_schlauch",
        },
        // Chain 3b: flower_1 (vorne-links im Garten) ist Drop-Target für gartenschlauch.
        // Polygon = bbox des flower_1-SVG (x=320 y=510 w=80 h=103). laufziel knapp davor.
        // Bei Drop: Blume skaliert auf 2× via CSS-Klasse, seed_1 ins Inventar.
        {
            id: "flower_1_drop",
            polygon: [[320, 510], [400, 510], [400, 613], [320, 613]],
            laufziel: { fu: 0.18, fv: 0.85 },
            // Cursor:pointer nur, wenn der Schlauch im Inventar liegt (sonst keine Aktion).
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && s.gegenstaende.has("gartenschlauch")
                       && !s.zustaende.flower_1_gegossen,
            akzeptiert: {
                gartenschlauch: (s) => {
                    if (s.zustaende.flower_1_gegossen) return;
                    verbrauche("gartenschlauch");
                    spielstand.zustaende.flower_1_gegossen = true;
                    spielstand.gegenstaende.add("seed_1");
                    aktualisiereInventar();
                    aktualisiereChain3();
                    zeigeOverlayText("You water the flower. It grows in a flash and offers you a seed.");
                    automatischSchliessen(3000);
                },
            },
        },
    ],
    keller: [
        // Chain 4, Schritt 2: Drop-Target für duck_1 — beide Ketten + die Lücke dazwischen.
        // chain_2 (x=280..560) + chain_1 (x=540..740), beide y=770..880. Polygon umschliesst beide.
        // Nach dem Drop wird duck_1_keller (DOM-VOR den Ketten in index.html) sichtbar — Ketten
        // überdecken die Ente visuell ("in den Ketten gefangen").
        // WICHTIG: VOR duck_1_keller platziert, damit der Drop-Bereich für muffin_1 später greift.
        {
            id: "ketten_drop",
            polygon: [[280, 770], [740, 770], [740, 880], [280, 880]],
            laufziel: { fu: 0.32, fv: 0.05 },
            aktiv: (s) => s.gegenstaende.has("duck_1") && !s.zustaende.duck_im_keller,
            akzeptiert: {
                duck_1: (s) => {
                    verbrauche("duck_1");
                    spielstand.zustaende.duck_im_keller = true;
                    aktualisiereInventar();
                    aktualisiereChain4();
                    draw();
                    zeigeOverlayText("You lay the rubber duck between the two chains.\nIt seems trapped.");
                    automatischSchliessen(3000);
                },
            },
        },
        // Chain 4, Schritt 3: duck_1_keller selbst als Drop-Target für muffin_1.
        // Polygon entspricht der Ente-Bbox (50×55), grosszügig erweitert für komfortablen Drop.
        // Bei Drop: Ente skaliert auf 2× via CSS-Klasse + Burp-Sound + Messgerät ins Inventar.
        {
            id: "duck_1_keller",
            polygon: [[385, 765], [455, 765], [455, 840], [385, 840]],
            laufziel: { fu: 0.27, fv: 0.05 },
            aktiv: (s) => s.zustaende.duck_im_keller && !s.zustaende.duck_gefuettert,
            akzeptiert: {
                muffin_1: (s) => {
                    verbrauche("muffin_1");
                    spielstand.zustaende.duck_gefuettert = true;
                    spielstand.gegenstaende.add("messgeraet");
                    aktualisiereInventar();
                    aktualisiereChain4();
                    spieleBurp();
                    zeigeOverlayText("The duck gulps down the muffin, lets out a loud BURP,\nand spits out a measuring device.");
                    automatischSchliessen(3500);
                },
            },
        },
    ],
};

function objektIstAktiv(obj) {
    if (obj.aufgenommen) return false;
    // Optionales State-Predicate: Objekt nur aktiv, wenn aktiv(spielstand) true ist.
    if (typeof obj.aktiv === "function" && !obj.aktiv(spielstand)) return false;
    // Sonst aktiv, wenn eines der Interaktions-Felder gesetzt ist.
    return !!(AUFGABEN[obj.aufgabe] || obj.aufnehmen || obj.akzeptiert || obj.aktion);
}

function zeigeAufgabe(id) {
    const a = AUFGABEN[id];
    if (!a) return;
    const geloest = spielstand.geloesteAufgaben.has(id);

    clearSchliessenTimer();
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

    if (a.pi_hinweis) {
        const pi = document.createElement("p");
        pi.className = "aufgabe-pi-hinweis";
        pi.textContent = "Use π = 3.14.";
        overlayInhaltEl.appendChild(pi);
    }

    if (a.tipp) {
        const tipp = document.createElement("p");
        tipp.className = "aufgabe-tipp";
        tipp.textContent = `Hint: ${a.tipp}`;
        overlayInhaltEl.appendChild(tipp);
    }

    if (geloest) {
        const info = document.createElement("p");
        info.className = "feedback richtig";
        info.textContent = "You've already solved this task.";
        overlayInhaltEl.appendChild(info);
        overlayEl.hidden = false;
        return;
    }

    if (a.typ === "multiple_choice") {
        baueMultipleChoice(id, a);
    } else {
        baueZahlenAufgabe(id);
    }

    overlayEl.hidden = false;
}

function baueZahlenAufgabe(id) {
    const form = document.createElement("form");
    form.className = "aufgabe-form";
    form.autocomplete = "off";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "aufgabe-input";
    input.inputMode = "decimal";
    input.placeholder = "Your answer";
    input.required = true;

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "aufgabe-pruefen";
    btn.textContent = "Check";

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

function baueMultipleChoice(id, a) {
    const liste = document.createElement("div");
    liste.className = "aufgabe-mc-liste";

    const feedback = document.createElement("p");
    feedback.className = "feedback";

    a.optionen.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "aufgabe-mc-option";
        btn.dataset.index = String(idx);

        if (opt.katex && typeof katex !== "undefined") {
            const span = document.createElement("span");
            katex.render(opt.katex, span, { throwOnError: false, displayMode: false });
            btn.appendChild(span);
        } else {
            btn.textContent = opt.label || opt.katex || "";
        }

        btn.addEventListener("click", () => pruefeMultipleChoice(id, idx, btn, liste, feedback));
        liste.appendChild(btn);
    });

    overlayInhaltEl.append(liste, feedback);
}

function pruefeMultipleChoice(id, idx, btnGedrueckt, liste, feedbackEl) {
    const a = AUFGABEN[id];
    const opt = a.optionen[idx];
    if (!opt.korrekt) {
        btnGedrueckt.classList.add("falsch");
        btnGedrueckt.disabled = true;
        feedbackEl.textContent = "That's not right. Try again.";
        feedbackEl.className = "feedback falsch";
        return;
    }
    btnGedrueckt.classList.add("richtig");
    // Alle Buttons sperren
    liste.querySelectorAll("button").forEach(b => b.disabled = true);
    gewaehrenBelohnung(id, feedbackEl);
}

function pruefeAntwort(id, eingabeStr, feedbackEl, inputEl) {
    const a = AUFGABEN[id];
    const zahl = parseFloat(String(eingabeStr).replace(",", ".").trim());
    if (!isFinite(zahl)) {
        feedbackEl.textContent = "Please enter a number.";
        feedbackEl.className = "feedback falsch";
        return;
    }
    const richtig = Math.abs(zahl - a.loesung) <= a.toleranz;
    if (!richtig) {
        feedbackEl.textContent = "That's not right. Try again.";
        feedbackEl.className = "feedback falsch";
        inputEl.select();
        return;
    }

    inputEl.disabled = true;
    const btn = inputEl.parentElement.querySelector("button");
    if (btn) btn.disabled = true;

    gewaehrenBelohnung(id, feedbackEl);
}

// Gemeinsame Belohnungs-Logik für beide Aufgaben-Typen.
function gewaehrenBelohnung(id, feedbackEl) {
    const a = AUFGABEN[id];
    spielstand.geloesteAufgaben.add(id);
    const b = a.bei_richtig || {};
    if (b.schluessel) spielstand.freigeschalteteTueren.add(b.schluessel);
    if (b.inventar) Object.assign(spielstand.inventar, b.inventar);
    if (b.gegenstand) {
        spielstand.gegenstaende.add(b.gegenstand);
        aktualisiereInventar();
    }
    if (typeof b.callback === "function") b.callback(spielstand);

    // belohnung_text darf auch eine Funktion sein — wird NACH callback ausgewertet,
    // damit der Text auf den frisch aktualisierten Spielstand zugreifen kann
    // (z.B. chain_3_pizza differenziert je nach octopus_zustand 2 vs. 3).
    const text = typeof b.belohnung_text === "function" ? b.belohnung_text(spielstand) : b.belohnung_text;
    feedbackEl.textContent = text || "Correct!";
    feedbackEl.className = "feedback richtig";

    draw();
    automatischSchliessen(3000);
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
    // Sicherheitshalber jeden noch hängenden Drag abbrechen — sonst klebt das Drag-Preview
    // über dem neuen Raum, weil der Pointer-Up vielleicht nie sauber durchgereicht wurde.
    if (typeof dragAbbrechen === "function") dragAbbrechen();
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
        // Pflanzen am Boden — rotierte Ellipsen am Topfabdruck (interaktiv eingestellt, Manuel).
        { fu: 0.0309, fv: 0.8087, rx: 0.03, ry: 0.0497, rot: 0.2737 },                            // [0] yucca
        { fu: 0.9653, fv: 0.1798, rx: 0.0404, ry: 0.0919, rot: -0.1559 },                         // [1] blume
        { fu: 0.0368, fv: 0.0982, rx: 0.0456, ry: 0.0793, rot: 0.1521 },                          // [2] tulpe
        // (geranie auf desk_5, setzling auf desk_3 — keine Boden-Hindernisse mehr)
        // Möbel-Vierecke (interaktiv eingestellt, Manuel):
        { punkte: [[0.0001, 0.9056], [0.1627, 0.8996], [0.1648, 0.9979], [0.001, 0.9988]] },     // [3] Tisch 1
        { punkte: [[0.3717, 0.789], [0.4954, 0.681], [0.574, 0.7561], [0.483, 0.8227]] },        // [4] desk_3 — User-justiert: Vorderkante nach innen gezogen, damit Bad→Garten-Pfad durchkommt
        { punkte: [[0.8869, 0.6244], [1, 0.6575], [0.9994, 0.8034], [0.8634, 0.7758]] },         // [5] desk_5
        { punkte: [[0.8223, 0.9241], [0.9999, 0.9274], [0.9979, 0.9982], [0.8381, 0.9993]] },    // [6] cupboard_3
    ],
    buero: [
        // Tisch 2 (vorderlinks): 2 Kreise + 1 rotierte Ellipse decken den L-förmigen
        // Schreibtisch-Footprint ab. Werte interaktiv per Drag-and-Drop eingestellt (Manuel).
        { fu: 0.0975, fv: 0.8172, r: 0.1 },                                                   // [0] vorne
        { fu: 0.1745, fv: 0.7503, r: 0.1 },                                                   // [1] mitte
        { fu: 0.2709, fv: 0.8383, rx: 0.1416, ry: 0.1, rot: 1.296 },                          // [2] hinten (schräg)
        // cupboard_1 (rechts an Wand): Viereck am tatsächlichen Boden-Footprint des Schranks.
        // Schrank hat KEIN data-fv → immer in Rück-Ebene, Figur überdeckt korrekt.
        { punkte: [[0.7268, 0.9031], [0.9424, 0.808], [0.9991, 0.9295], [0.7411, 0.9996]] },  // [3]
        // bookshelf_2 (hinten an Wand bei x=700..1300): Viereck am tatsächlichen Boden-Footprint.
        { punkte: [[0.3339, 0.9058], [0.6748, 0.9009], [0.68, 0.9999], [0.3286, 0.9998]] },   // [4]
        // lamp_1 (Pixar-Lampe vorne-links): leicht rotierte Ellipse am Lampenfuß.
        { fu: 0.0508, fv: 0.2055, rx: 0.0542, ry: 0.1241, rot: 0.1197 },                      // [5]
    ],
    badezimmer: [
        // Werte interaktiv per Drag-and-Drop eingestellt (Manuel).
        { fu: 0.1354, fv: 0.9505, rx: 0.1798, ry: 0.1623, rot: -0.0215 },                         // [0]
        { fu: 0.7552, fv: 0.8073, rx: 0.1, ry: 0.1922 },                                          // [1]
        { fu: 0.4047, fv: 0.9243, rx: 0.0548, ry: 0.1104 },                                       // [2]
        { punkte: [[0.4898, 0.8668], [0.7479, 0.8667], [0.7638, 0.9995], [0.5, 0.9993]] },        // [3]
        // [4] desk_4 hinterer Teil — Front-Kante runtergezogen auf fv 0.30, damit die Lücke
        // zur Front-Hindernis [5] (fv 0.03..0.45) zugeht und die Figur sich nicht mehr in
        // dem schmalen Streifen fv 0.45..0.56 zwischen [4] und [5] einklemmen kann.
        // (Original-Werte vor Fix: [[0.7954, 0.5619], [0.9932, 0.7535], [0.9985, 0.9943], [0.7566, 0.9999]])
        { punkte: [[0.7954, 0.30], [0.9985, 0.30], [0.9985, 0.9943], [0.7566, 0.9999]] },         // [4]
        { punkte: [[0.7712, 0.1016], [0.9165, 0.0331], [0.9999, 0.2984], [0.8558, 0.448]] },      // [5]
    ],
    garten: [
        // flower_1 (Inline-SVG vorne-links, überlappt mit flower_3) — interaktiv eingestellt (Manuel).
        { fu: 0.0524, fv: 0.9972, rx: 0.0605, ry: 0.0795, rot: -0.2473 },                         // [0] flower_1
    ],
    keller: [
        // Werte interaktiv per Drag-and-Drop eingestellt (Manuel).
        { punkte: [[0.1616, 0.8226], [0.5289, 0.8242], [0.51, 0.99], [0.1486, 0.9978]] },     // [0] Kamin (fireplace_1)
        { punkte: [[0.7376, 0.0731], [1, 0.1028], [0.9982, 0.3324], [0.776, 0.3108]] },       // [1] Schatztruhe (chest_1)
        { fu: 0.8673, fv: 0.8258, rx: 0.1521, ry: 0.2861, rot: -0.2141 },                     // [2] Kerzen-Cluster A
        { punkte: [[0.0958, 0.3492], [0.2752, 0.0456], [0.4894, 0.0835], [0.4201, 0.4351]] }, // [3] chain_1 (Boden, mit Kugel)
        { fu: 0.6905, fv: 0.8474, rx: 0.096, ry: 0.2469, rot: -0.4399 },                      // [4] Kerzen-Cluster B
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
    const rx = h.rx ?? h.r, ry = h.ry ?? h.r;
    const rot = h.rot ?? 0;
    const dfu = fu - h.fu, dfv = fv - h.fv;
    if (rot) {
        const c = Math.cos(rot), s = Math.sin(rot);
        const lx =  dfu * c + dfv * s;
        const ly = -dfu * s + dfv * c;
        return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) < 1;
    }
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
    // Ellipse (ggf. rotiert): in Lokal-Frame transformieren, dort radiale Approximation,
    // Randpunkt + Gradient zurück nach Welt drehen.
    const rx = h.rx ?? h.r, ry = h.ry ?? h.r;
    const rot = h.rot ?? 0;
    const c = Math.cos(rot), s = Math.sin(rot);
    const dfu = fu - h.fu, dfv = fv - h.fv;
    const lx =  dfu * c + dfv * s;
    const ly = -dfu * s + dfv * c;
    const dEll = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
    if (dEll < 1e-6) {
        // Center: nimm die rx-Achse als Default-Richtung (in Welt-Koords).
        return { fu: h.fu + rx * c, fv: h.fv + rx * s, nx: c, ny: s, kante: -1 };
    }
    const k = 1 / Math.sqrt(dEll);
    const randLx = lx * k, randLy = ly * k;
    const randFu = h.fu + randLx * c - randLy * s;
    const randFv = h.fv + randLx * s + randLy * c;
    // Außen-Normale: Gradient im Lokal-Frame, dann zurück nach Welt rotiert.
    const nLx = randLx / (rx * rx);
    const nLy = randLy / (ry * ry);
    let nx = nLx * c - nLy * s;
    let ny = nLx * s + nLy * c;
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
    // Blocker = das Hindernis, in das der direkte Schritt reinläuft. aktualisiereFigur hat
    // dies bereits per istImHindernis geprüft, bevor slide gerufen wurde — wir wissen also,
    // dass mindestens eines existiert, und können es direkt finden.
    // (Frühere Center+Along-Heuristik versagte, wenn das Polygon-Center hinter der Figur lag,
    //  aber eine Polygon-Spitze noch in den Pfad ragte → sie wäre fälschlich als „behind"
    //  klassifiziert worden, slide hätte null zurückgegeben, Figur bleibt stecken.)
    const neueFu = figur.fu + ux * schritt;
    const neueFv = figur.fv + uy * schritt;
    let blocker = null;
    for (const h of hs) {
        if (istInForm(h, neueFu, neueFv)) { blocker = h; break; }
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
    // Kleiner Aussen-Puffer: ohne diesen landet der reine Tangenten-Schritt bei langen
    // Slides exakt auf der Polygon-Kante. pktInKonvexPolygon zählt Boundary-Punkte als "drin"
    // (alle Cross-Produkte gleich-Vorzeichen, eines ≈0) → der Schritt wird abgelehnt, die
    // Gegenrichtung verstößt gegen den Oszillations-Schutz, die Figur bleibt stecken.
    // 0.002 reicht, um sicher außerhalb zu landen, drift aber pro Slide-Schritt kaum messbar.
    const AUSSEN_EPS = 0.002;
    for (const { tx, ty } of sides) {
        const slidFu = figur.fu + tx * schritt + rand.nx * AUSSEN_EPS;
        const slidFv = figur.fv + ty * schritt + rand.ny * AUSSEN_EPS;
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
    const gelb = "#ffc028";
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

// Wolke: jede definiert ihre eigene Liste überlappender Ellipsen
// (bumps: [dx, dy, rx, ry] absolut relativ zum Wolkenzentrum).
// 3 Schichten geben Tiefe: blass-grauer Schatten unten, weiss als Hauptkörper,
// helles Highlight oben links als Sonnenseite.
function zeichneWolke(wolke) {
    // 1) Schatten: deutlich sichtbares kühles Grau (kein Gelbstich), unten versetzt
    ctx.fillStyle = `rgba(110, 122, 138, ${wolke.alpha * 0.7})`;
    wolke.bumps.forEach(([dx, dy, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(wolke.cx + dx, wolke.cy + dy + ry * 0.30, rx * 0.92, ry * 0.85, 0, 0, 2 * Math.PI);
        ctx.fill();
    });
    // 2) Hauptkörper: leicht gebrochenes Weiss (nimmt etwas Schatten an den Rändern auf)
    ctx.fillStyle = `rgba(245, 248, 252, ${wolke.alpha})`;
    wolke.bumps.forEach(([dx, dy, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(wolke.cx + dx, wolke.cy + dy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();
    });
    // 3) Highlight: reinweiss, oben-links (Sonne von oben links)
    ctx.fillStyle = `rgba(255, 255, 255, ${wolke.alpha})`;
    wolke.bumps.forEach(([dx, dy, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(wolke.cx + dx - rx * 0.18, wolke.cy + dy - ry * 0.30, rx * 0.45, ry * 0.40, 0, 0, 2 * Math.PI);
        ctx.fill();
    });
}

const WOLKEN = [
    // 1: oben-links, klassisch fluffig (4 bumps)
    { cx: 180, cy: 80, alpha: 1, bumps: [
        [0,   0,    50, 20],
        [-32, 5,    22, 14],
        [28,  8,    25, 15],
        [-8,  -10,  18, 12],
    ]},
    // 2: links-mitte, breit gezogen, leicht schief (5 bumps)
    { cx: 470, cy: 140, alpha: 1, bumps: [
        [0,    0,   72, 22],
        [-58,  6,   22, 14],
        [-28, -10,  28, 18],
        [40,   3,   32, 18],
        [22,  -16,  20, 13],
    ]},
    // 3: mitte-oben, gedrungen mit hohen Türmchen (4 bumps)
    { cx: 850, cy: 70, alpha: 1, bumps: [
        [0,   0,    55, 22],
        [-18, -18,  30, 20],
        [22,  -12,  22, 14],
        [-38, 7,    24, 14],
    ]},
    // 4: nahe Horizont, dünn und langgezogen (3 bumps, etwas durchsichtiger)
    { cx: 560, cy: 270, alpha: 1, bumps: [
        [0,    0,   42, 13],
        [-28,  3,   18, 10],
        [20,  -4,   16, 11],
    ]},
];

function zeichneWolken() {
    WOLKEN.forEach((w, idx) => {
        // Chain 3a: zentrale Wolke (Index 1, cx=470, cy=140) verschwindet, sobald sie
        // angeklickt wurde — Vogel wird an gleicher Position sichtbar (siehe aktualisiereChain3).
        if (idx === 1 && spielstand.zustaende.wolke_zentral_weg) return;
        zeichneWolke(w);
    });
}

// Hilfsfunktion: hex-Farbe um (dr, dg, db) verschieben (geclamped).
function hexShift(hex, dr, dg, db) {
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + dr));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + dg));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + db));
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Busch: pro Position deterministisch geseedet — jeder Busch unterschiedlich.
// Schatten + Highlights werden via ctx.clip() auf die Hauptkörper-Silhouette begrenzt,
// so dass keine Ellipse über den Rand des Busches hinausragt.
function zeichneBusch(cx, cy, breite, farbe) {
    const h = breite * 0.78;
    const dunkel = hexShift(farbe, -32, -32, -32);
    const hell   = hexShift(farbe,  20,  20,  20);
    const rand = mulberry32(Math.floor(cx * 17 + cy * 113 + breite));
    const j = (s) => (rand() - 0.5) * 2 * s;
    const ell = (cxe, cye, rxe, rye) => {
        ctx.beginPath();
        ctx.ellipse(cxe, cye, rxe, rye, 0, 0, 2 * Math.PI);
        ctx.fill();
    };

    // Hauptkörper-Geometrie (mit Jitter) — wird sowohl gefüllt als auch als Clip benutzt.
    const haupt = [
        [ 0.00,  0.00,  0.50 + j(0.04), 0.50 + j(0.04)],
        [-0.32,  0.08,  0.26 + j(0.04), 0.32 + j(0.04)],
        [ 0.30,  0.05,  0.28 + j(0.04), 0.34 + j(0.04)],
        [-0.12, -0.38,  0.23 + j(0.04), 0.24 + j(0.04)],
    ];
    let buckel = null;
    if (rand() > 0.45) {
        const seite = rand() > 0.5 ? 1 : -1;
        buckel = [seite * 0.22 + j(0.05), -0.20 + j(0.08),
                  0.16 + j(0.04), 0.18 + j(0.04)];
    }

    // 1) Hauptkörper zeichnen
    ctx.fillStyle = farbe;
    haupt.forEach(([dx, dy, rx, ry]) => {
        ell(cx + breite * dx, cy + h * dy, breite * rx, h * ry);
    });
    if (buckel) {
        const [dx, dy, rx, ry] = buckel;
        ell(cx + breite * dx, cy + h * dy, breite * rx, h * ry);
    }

    // 2) Clip auf die Silhouette (Union aller Hauptellipsen) und dann Schatten + Highlights
    ctx.save();
    ctx.beginPath();
    haupt.forEach(([dx, dy, rx, ry]) => {
        ctx.ellipse(cx + breite * dx, cy + h * dy, breite * rx, h * ry, 0, 0, 2 * Math.PI);
    });
    if (buckel) {
        const [dx, dy, rx, ry] = buckel;
        ctx.ellipse(cx + breite * dx, cy + h * dy, breite * rx, h * ry, 0, 0, 2 * Math.PI);
    }
    ctx.clip();

    // Schatten: 2 grosse Ellipsen unten (Buschunterseite im Schatten)
    ctx.fillStyle = dunkel;
    ell(cx + breite * (0.05 + j(0.05)),   cy + h * (0.22 + j(0.05)),
        breite * 0.50,                     h * 0.40);
    ell(cx + breite * (-0.20 + j(0.08)),  cy + h * (0.20 + j(0.05)),
        breite * 0.30,                     h * 0.30);

    // Highlights: 2 bis 4 grosse helle Flecken oben/links (Sonnenseite)
    ctx.fillStyle = hell;
    const hlN = 2 + Math.floor(rand() * 3);   // 2..4
    for (let i = 0; i < hlN; i++) {
        ell(cx + breite * (-0.10 + j(0.22)),   cy + h * (-0.20 + j(0.15)),
            breite * (0.18 + Math.abs(j(0.05))),
            h *      (0.20 + Math.abs(j(0.05))));
    }

    ctx.restore();
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
    flower4:       { src: "assets/flower_4.svg", cx: 55, baseY: 560, breite: 160, hoehe: 200 },
    flower6:       { src: "assets/flower_6.svg", cx: 1000, baseY: 530, breite: 110, hoehe: 156 },
    linksWiese:    { src: "assets/bush_4.svg", cx: 185, baseY: 650, breite: 480, hoehe: 492 },
    hintenTief:    { src: "assets/bush_1.svg", cx: 1150, baseY: 550, breite: 360, hoehe: 150 }, // tief hinter Zaun
    hintenGanz:    { src: "assets/bush_2.svg", cx: 570, baseY: 410, breite: 80, hoehe: 80 }, // oberhalb des Zauns
    hintenHalb:    { src: "assets/bush_3.svg?v=5", cx: 100, baseY: 378, breite: 150, hoehe: 160 }, //
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

    // Wolken vor der Sonne (drüber gemalt → ziehen visuell vorbei)
    zeichneWolken();

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

    // flower_4 auf der linken Wiese — wird gleich danach von bush_4 teilweise verdeckt.
    zeichneBuschBild(BUESCHE.flower4);

    // Detaillierte Büsche hinter dem Hintenzaun — Zaun wird GLEICH danach gezeichnet
    // und verdeckt die Teile, die in den Zaunbereich (y ≥ 420) hineinragen.
    zeichneBuschBild(BUESCHE.flower6);      // flower_6 — wird gleich danach von bush_1 teilweise verdeckt
    zeichneBuschBild(BUESCHE.hintenTief);   // bush_1 — tief hinter dem Zaun
    zeichneBuschBild(BUESCHE.hintenHalb);   // bush_3 — teilweise hinter dem Zaun

    // bush_4 auf der linken Wiese — DOM-zuletzt unter den Wiesen-Sträuchern, damit
    // er bush_3 in der Überlappung verdeckt. Zaun kommt gleich darüber.
    zeichneBuschBild(BUESCHE.linksWiese);

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
        // Geheimtür-Sonderbehandlung:
        //   • keller_freigeschaltet → permanent sichtbarer b80-Akzent (dunkler als b70-Wand)
        //   • binoculars im Inventar → wandfarben + Phosphor-Outline (Nachtsicht zeigt Tür)
        //   • sonst → wandfarben (unsichtbar) + nicht klickbar (siehe findeTuerBei)
        if (t.secret) {
            const freigeschaltet = spielstand.zustaende.keller_freigeschaltet;
            const mitBinoculars = spielstand.gegenstaende.has("binoculars_1");
            const farbe = freigeschaltet ? FARBEN.tuerGeheimOffen : FARBEN.tuerGeheim;
            fuellePolygon(t.polygon, farbe);
            if (!freigeschaltet && mitBinoculars) {
                ctx.save();
                ctx.strokeStyle = FARBEN.tuerGeheimOutline;
                ctx.lineWidth = 3;
                ctx.shadowColor = FARBEN.tuerGeheimOutline;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                t.polygon.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p[0], p[1]);
                    else ctx.lineTo(p[0], p[1]);
                });
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
        } else {
            // t.farbe: pro-Tür-Override (z.B. Keller-Rück-Tür in b80, analog zur Geheimtür-offen).
            fuellePolygon(t.polygon, t.farbe || FARBEN.tuer);
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
            // Kreis/Ellipse (ggf. rotiert): 36-fach gesampelte Kontur in Lokal-Koords, dann
            // mit Rotation in Welt-Koords transformiert und perspektivisch auf den Boden projiziert.
            const rx = h.rx ?? h.r;
            const ry = h.ry ?? h.r;
            const rot = h.rot ?? 0;
            const cR = Math.cos(rot), sR = Math.sin(rot);
            ctx.beginPath();
            const SAMPLES = 36;
            for (let s = 0; s < SAMPLES; s++) {
                const theta = (s * 2 * Math.PI) / SAMPLES;
                const lx = Math.cos(theta) * rx;
                const ly = Math.sin(theta) * ry;
                const fu = h.fu + lx * cR - ly * sR;
                const fv = h.fv + lx * sR + ly * cR;
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
            // Achs-Handles (Quadrate) für rx und ry — Position rotiert mit, ändert Halbachse separat.
            const HANDLE = 18;
            const handlePositionen = [
                ["rx", h.fu + rx * cR,           h.fv + rx * sR],
                ["ry", h.fu - ry * sR,           h.fv + ry * cR],
            ];
            for (const [achse, fuV, fvV] of handlePositionen) {
                const [hx, hy] = bodenPunkt(fuV, fvV);
                ctx.fillStyle = punktBg;
                ctx.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
                ctx.fillStyle = "#fff";
                ctx.font = "bold 10px sans-serif";
                ctx.fillText(achse, hx, hy);
            }
            // Rotations-Handle (kleiner Kreis), etwas außerhalb der rx-Achse — drag setzt rot.
            const ROT_OFFSET = 0.025;
            const rotFu = h.fu + (rx + ROT_OFFSET) * cR;
            const rotFv = h.fv + (rx + ROT_OFFSET) * sR;
            const [rhx, rhy] = bodenPunkt(rotFu, rotFv);
            // Linie vom Center zum rot-Handle (Achs-Visualisierung).
            ctx.strokeStyle = punktBg;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(rhx, rhy);
            ctx.stroke();
            ctx.fillStyle = punktBg;
            ctx.beginPath();
            ctx.arc(rhx, rhy, 9, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 11px sans-serif";
            ctx.fillText("↻", rhx, rhy + 1);
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
            console.warn(
                `Slide stuck in ${aktuellerRaum}: ` +
                `pos=(${figur.fu.toFixed(4)}, ${figur.fv.toFixed(4)}) ` +
                `ziel=(${figur.zielFu.toFixed(4)}, ${figur.zielFv.toFixed(4)}) ` +
                `letztePos=(${figur.letztePosFu?.toFixed(4)}, ${figur.letztePosFv?.toFixed(4)}) ` +
                `richtung=(${ux.toFixed(4)}, ${uy.toFixed(4)})`
            );
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
    aktualisiereCupboard1();
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
        // Geheimtür im Hauptraum nur klickbar, wenn entweder schon freigeschaltet
        // (permanent sichtbar) oder Spieler trägt binoculars_1 (Nachtsicht zeigt Outline).
        // Sonst fällt der Klick zur Boden-Logik durch — Tür wirkt wie ganz normale Wand.
        if (t.secret && !spielstand.zustaende.keller_freigeschaltet &&
            !spielstand.gegenstaende.has("binoculars_1")) {
            continue;
        }
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
let hindernisDrag = null;   // { hidx, eckIdx | null, achse: null | 'rx' | 'ry' | 'rot' }
                            // eckIdx: Vierecks-Eckpunkt; achse: Ellipsen-Handle; sonst Center

function findeHindernisGriffBei(x, y) {
    if (!window.HINDERNIS_DEBUG) return null;
    const hs = HINDERNISSE[aktuellerRaum] || [];
    const TREFFER = 14;
    const ROT_OFFSET = 0.025;
    // Erst Vierecks-Eckpunkte und Ellipsen-Handles (rx, ry, rot) prüfen — kleinere Targets,
    // höhere Prio (sonst kann der Center-Marker einen Handle dicht daneben verdecken).
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (h.punkte) {
            for (let i = 0; i < h.punkte.length; i++) {
                const [px, py] = bodenPunkt(h.punkte[i][0], h.punkte[i][1]);
                if (Math.hypot(x - px, y - py) <= TREFFER) {
                    return { hidx, eckIdx: i, achse: null };
                }
            }
        } else {
            const rxVal = h.rx ?? h.r;
            const ryVal = h.ry ?? h.r;
            const rot = h.rot ?? 0;
            const cR = Math.cos(rot), sR = Math.sin(rot);
            const [rxX, rxY] = bodenPunkt(h.fu + rxVal * cR, h.fv + rxVal * sR);
            if (Math.hypot(x - rxX, y - rxY) <= TREFFER) {
                return { hidx, eckIdx: null, achse: "rx" };
            }
            const [ryX, ryY] = bodenPunkt(h.fu - ryVal * sR, h.fv + ryVal * cR);
            if (Math.hypot(x - ryX, y - ryY) <= TREFFER) {
                return { hidx, eckIdx: null, achse: "ry" };
            }
            const [rotX, rotY] = bodenPunkt(
                h.fu + (rxVal + ROT_OFFSET) * cR,
                h.fv + (rxVal + ROT_OFFSET) * sR,
            );
            if (Math.hypot(x - rotX, y - rotY) <= TREFFER) {
                return { hidx, eckIdx: null, achse: "rot" };
            }
        }
    }
    // Dann Ellipsen-Center (Fallback).
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (h.punkte) continue;
        const [cx, cy] = bodenPunkt(h.fu, h.fv);
        if (Math.hypot(x - cx, y - cy) <= TREFFER) {
            return { hidx, eckIdx: null, achse: null };
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
    } else if (hindernisDrag.achse) {
        // Drag eines Ellipsen-Handles: aus Kreis (h.r) wird Ellipse, sobald eine Achse separat
        // gezogen wird. rx/ry werden auf die Achs-Komponente projiziert (Drag-Position vom
        // Center, im Lokal-Frame der aktuellen Rotation).
        if (h.r !== undefined && h.rx === undefined) {
            h.rx = h.r;
            h.ry = h.r;
            delete h.r;
        }
        const rot = h.rot ?? 0;
        const cR = Math.cos(rot), sR = Math.sin(rot);
        const dfu = fuFv[0] - h.fu, dfv = fuFv[1] - h.fv;
        if (hindernisDrag.achse === "rx") {
            const proj =  dfu * cR + dfv * sR;
            h.rx = +Math.max(0.005, Math.abs(proj)).toFixed(4);
        } else if (hindernisDrag.achse === "ry") {
            const proj = -dfu * sR + dfv * cR;
            h.ry = +Math.max(0.005, Math.abs(proj)).toFixed(4);
        } else if (hindernisDrag.achse === "rot") {
            const neueRot = Math.atan2(dfv, dfu);
            h.rot = +neueRot.toFixed(4);
            if (Math.abs(h.rot) < 1e-3) delete h.rot;   // 0 sauber halten
        }
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
    const { hidx, eckIdx, achse } = hindernisDrag;
    const h = HINDERNISSE[aktuellerRaum][hidx];
    if (eckIdx !== null) {
        const p = h.punkte[eckIdx];
        console.log(`✓ ${aktuellerRaum}[${hidx}].punkte[${eckIdx}] = [${p[0]}, ${p[1]}]`);
    } else if (achse) {
        console.log(`✓ ${aktuellerRaum}[${hidx}].${achse} = ${h[achse] ?? 0}`);
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
            const rotPart = h.rot ? `, rot: ${h.rot}` : "";
            return `    { fu: ${h.fu}, fv: ${h.fv}, rx: ${h.rx}, ry: ${h.ry}${rotPart} },   // [${i}]`;
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
                zeigeOverlayText("This door is locked.\nYou need to find a key first.");
                return;
            }
            // Geheimtür mit Binoculars (aber noch nicht freigeschaltet) → Hinweis,
            // dass man den Code aus dem Inventar auf die Tür ziehen muss. Ohne Binoculars
            // filtert findeTuerBei die Tür schon aus.
            if (tuer.secret && !spielstand.zustaende.keller_freigeschaltet) {
                if (spielstand.gegenstaende.has("code_geheimtuer")) {
                    zeigeOverlayText("A keypad sits next to the door.\nDrag the code from your inventory onto the door.");
                } else {
                    zeigeOverlayText("A keypad sits next to the door.\nYou need to find a code first.");
                }
                automatischSchliessen(3500);
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

// Auto-Close-Timer für Overlays. Bei jedem neuen Overlay-Öffnen sowie bei jedem manuellen
// Schliessen wird der Timer gelöscht, damit ein "altes" automatisches Schliessen nicht ein
// neues Overlay mitschliesst.
let schliessenTimeoutId = null;
function clearSchliessenTimer() {
    if (schliessenTimeoutId !== null) {
        clearTimeout(schliessenTimeoutId);
        schliessenTimeoutId = null;
    }
}
function automatischSchliessen(ms = 3000) {
    clearSchliessenTimer();
    schliessenTimeoutId = setTimeout(() => {
        schliessenTimeoutId = null;
        schliesseOverlay();
    }, ms);
}

// Einfacher Info-Text (z.B. "Tür verschlossen.")
function zeigeOverlayText(text) {
    clearSchliessenTimer();
    overlayInhaltEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "overlay-text";
    p.textContent = text;
    overlayInhaltEl.appendChild(p);
    overlayEl.hidden = false;
}

// Info-Text mit zusätzlichem Action-Button. Aktuell nicht aktiv genutzt — bleibt als Utility.
function zeigeOverlayMitButton(text, buttonLabel, callback) {
    clearSchliessenTimer();
    overlayInhaltEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "overlay-text";
    p.textContent = text;
    overlayInhaltEl.appendChild(p);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "overlay-button";
    btn.textContent = buttonLabel;
    btn.addEventListener("click", () => callback());
    overlayInhaltEl.appendChild(btn);

    overlayEl.hidden = false;
}

// Rückwärtskompatibel zur Phase-2-API (wird von wechsleRaum-Blocker genutzt)
function zeigeOverlay(text) {
    zeigeOverlayText(text);
}

function schliesseOverlay() {
    clearSchliessenTimer();
    overlayEl.hidden = true;
    overlayInhaltEl.innerHTML = "";
    // Octopus-Exit erst NACH Schliessen der Aufgabe starten — die 2-s-Pause auf
    // octopus_1_3 zählt damit ab dem Moment, in dem der User wieder das Spiel sieht.
    // Flag verhindert Doppel-Trigger, falls schliesseOverlay mehrmals nach state 3 läuft.
    if (spielstand.zustaende.octopus_zustand === 3 &&
        spielstand.zustaende.octopus_da &&
        !spielstand.zustaende.octopus_exit_gestartet) {
        spielstand.zustaende.octopus_exit_gestartet = true;
        setTimeout(() => animiereOctopusRaus(), 2000);
    }
}

overlayCloseEl.addEventListener("click", schliesseOverlay);
overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) schliesseOverlay();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (dragZustand) dragAbbrechen();
        else if (!overlayEl.hidden) schliesseOverlay();
    }
});

// ---------- Formelbuch ----------
// Wird aus dem Hauptregal heraus geöffnet (Klick auf die 5 Bücher rechts in regal-4 → siehe
// OBJEKTE.haupt.regal_buecher). Gating: spielstand.zustaende.formelbuch_gefunden wird true,
// und Aufgaben können via pruefeFormelbuch() vorher prüfen, ob das Buch schon entdeckt ist.
const FORMELBUCH = [
    { name: "Circumference", de: "Umfang", formel: "U = 2\\pi r",
      kommentar: "Circumference of the entire circle." },
    { name: "Arc length", de: "Bogenlänge",
      formel: "b = \\dfrac{\\alpha}{360^\\circ} \\cdot 2\\pi r = \\dfrac{\\pi\\alpha r}{180^\\circ}",
      kommentar: "Length of the arc subtended by central angle $\\alpha$." },
    { name: "Circle area", de: "Kreisfläche", formel: "A_{\\text{circle}} = \\pi r^2",
      kommentar: "Area of the entire disc." },
    { name: "Sector area", de: "Kreissektorfläche",
      formel: "A_{\\text{sector}} = \\dfrac{\\alpha}{360^\\circ} \\cdot \\pi r^2 = \\dfrac{\\pi\\alpha r^2}{360^\\circ} = \\dfrac{br}{2}",
      kommentar: "Area of the circular sector with central angle $\\alpha$." },
    { name: "Chord length", de: "Sehnenlänge", formel: "s = 2\\sqrt{2rh - h^2}",
      kommentar: "$h$ is the sagitta (distance from the chord midpoint to the arc)." },
    { name: "Segment area", de: "Kreissegmentfläche",
      formel: "A_{\\text{segment}} = \\dfrac{br}{2} - \\dfrac{s(r-h)}{2}",
      kommentar: "Area of the circular segment (sector minus triangle)." },
];

// Inline-KaTeX-Renderer: zerlegt einen Text an $...$-Markierungen und rendert die Formeln.
function rendereInlineMath(text, ziel) {
    ziel.innerHTML = "";
    const teile = text.split(/(\$[^$]+\$)/g);
    for (const teil of teile) {
        if (teil.length > 2 && teil.startsWith("$") && teil.endsWith("$")) {
            const span = document.createElement("span");
            if (typeof katex !== "undefined") {
                katex.render(teil.slice(1, -1), span, { throwOnError: false, displayMode: false });
            } else {
                span.textContent = teil;
            }
            ziel.appendChild(span);
        } else if (teil) {
            ziel.appendChild(document.createTextNode(teil));
        }
    }
}

function zeigeFormelbuch() {
    spielstand.zustaende.formelbuch_gefunden = true;
    clearSchliessenTimer();
    overlayInhaltEl.innerHTML = "";

    const titel = document.createElement("h2");
    titel.className = "formelbuch-titel";
    titel.textContent = "Formula Book — Circles";
    overlayInhaltEl.appendChild(titel);

    const tabelle = document.createElement("table");
    tabelle.className = "formelbuch";

    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th></th><th>Degree measure</th><th>Comments</th></tr>`;
    tabelle.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const eintrag of FORMELBUCH) {
        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.className = "formelbuch-name";
        nameTd.innerHTML = eintrag.de
            ? `${eintrag.name}<br><span class="formelbuch-de">(DE: ${eintrag.de})</span>`
            : eintrag.name;
        tr.appendChild(nameTd);

        const formelTd = document.createElement("td");
        formelTd.className = "formelbuch-formel";
        if (typeof katex !== "undefined") {
            katex.render(eintrag.formel, formelTd, { throwOnError: false, displayMode: true });
        } else {
            formelTd.textContent = eintrag.formel;
        }
        tr.appendChild(formelTd);

        const kommentarTd = document.createElement("td");
        kommentarTd.className = "formelbuch-kommentar";
        rendereInlineMath(eintrag.kommentar, kommentarTd);
        tr.appendChild(kommentarTd);

        tbody.appendChild(tr);
    }
    tabelle.appendChild(tbody);
    overlayInhaltEl.appendChild(tabelle);

    overlayEl.hidden = false;
}

// Helper für später definierte Aufgaben: prüft, ob das Formelbuch schon entdeckt wurde.
// Gibt true zurück, sonst false UND zeigt einen Hinweis-Overlay. Aufgaben rufen die
// Funktion am Anfang ihres aktion/aufgabe-Callbacks auf.
function pruefeFormelbuch() {
    if (spielstand.zustaende.formelbuch_gefunden) return true;
    zeigeOverlayText("You need the right formulas first.\nLook for the formula book in the main room.");
    return false;
}

window.zeigeFormelbuch = zeigeFormelbuch;
window.pruefeFormelbuch = pruefeFormelbuch;

// ---------- Inventar (Phase 6) ----------
// Gegenstände können im Raum aufgenommen werden (Klick auf Objekt mit `aufnehmen`),
// erscheinen dann als Icon rechts oben im Inventar und können per Drag & Drop auf
// andere Objekte oder Türen gezogen werden (Drop-Target hat `akzeptiert[id]`).

// Registry aller möglichen Gegenstände. Icon ist Inline-SVG (viewBox 0..48).
const GEGENSTAENDE = {
    // Chain 1: Schlüssel für cupboard_1 (Büro). Klassischer Schlüssel mit rundem Bart links,
    // Schaft nach rechts, zwei Zähne am Ende.
    schluessel_buero: {
        name: "Key",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g fill="#e8b840" stroke="#7c5f1e" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
                   <circle cx="13" cy="24" r="9"/>
                   <rect x="22" y="22" width="22" height="4"/>
                   <rect x="34" y="26" width="3" height="6"/>
                   <rect x="40" y="26" width="3" height="6"/>
                 </g>
                 <circle cx="13" cy="24" r="3.5" fill="#fff8e1" stroke="#7c5f1e" stroke-width="0.8"/>
               </svg>`,
    },
    // Chain 1: Zerknitterter Zettel mit Schrift drauf. Eckige Form mit Falt-Ecke + Linien.
    zettel: {
        name: "Crumpled Note",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <path d="M10 8 L34 8 L40 14 L40 42 L10 42 Z" fill="#f7ecc8" stroke="#7d6a3a" stroke-width="1.6" stroke-linejoin="round"/>
                 <path d="M34 8 L34 14 L40 14 Z" fill="#dfc888" stroke="#7d6a3a" stroke-width="1.6" stroke-linejoin="round"/>
                 <g stroke="#7d6a3a" stroke-width="1.3" stroke-linecap="round">
                   <line x1="14" y1="20" x2="36" y2="20"/>
                   <line x1="14" y1="26" x2="36" y2="26"/>
                   <line x1="14" y1="32" x2="32" y2="32"/>
                   <line x1="14" y1="37" x2="34" y2="37"/>
                 </g>
               </svg>`,
    },
    // Chain 1: Code für die Geheimtür (entstanden aus dem Zettel im Lampenschein).
    // Tag-Optik mit Loch oben + monospace-Code "355113" — Ziffern müssen klein lesbar sein.
    code_geheimtuer: {
        name: "Code for the secret door: 355113",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <rect x="4" y="10" width="40" height="28" rx="3" fill="#fff8e1" stroke="#7d6a3a" stroke-width="1.6"/>
                 <circle cx="9" cy="16" r="1.4" fill="#7d6a3a"/>
                 <text x="24" y="30" text-anchor="middle"
                       font-family="ui-monospace, Menlo, Consolas, monospace"
                       font-size="11" font-weight="700" fill="#1a1a1a" letter-spacing="0.5">355113</text>
               </svg>`,
    },
    // Chain 2: drei Glas-Zustände — verwenden direkt das Asset-SVG als <image>, damit
    // jede Variante ihren Detailzustand (Fisch / leer / Wasser) ohne Inline-Replikation zeigt.
    // Icons werden bei 48×48 angezeigt; preserveAspectRatio belässt die Proportionen.
    animal_3_1: {
        name: "Glass with goldfish",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <image href="assets/animal_3_1.svg?v=1" x="2" y="2" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>
               </svg>`,
    },
    animal_3_2: {
        name: "Empty glass",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <image href="assets/animal_3_2.svg?v=1" x="2" y="2" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>
               </svg>`,
    },
    animal_3_3: {
        name: "Glass of water",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <image href="assets/animal_3_3.svg?v=1" x="2" y="2" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>
               </svg>`,
    },
    // Chain 3: Gartenschlauch — coiled-hose-Symbol als Spirale, grüner Schlauch + dunkle
    // Konturlinie. Wird bei Lösung der Schlauch-Aufgabe ins Inventar gelegt.
    gartenschlauch: {
        name: "Garden hose",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g fill="none" stroke="#3a8c3a" stroke-width="3.5" stroke-linecap="round">
                   <circle cx="24" cy="24" r="14"/>
                   <circle cx="24" cy="24" r="10"/>
                   <circle cx="24" cy="24" r="6"/>
                 </g>
                 <circle cx="24" cy="24" r="14" fill="none" stroke="#1f5f1f" stroke-width="0.8"/>
                 <circle cx="24" cy="24" r="10" fill="none" stroke="#1f5f1f" stroke-width="0.8"/>
                 <circle cx="24" cy="24" r="6"  fill="none" stroke="#1f5f1f" stroke-width="0.8"/>
                 <rect x="36" y="22" width="9" height="4" rx="1.2" fill="#9d9d9d" stroke="#5a5a5a" stroke-width="0.8"/>
               </svg>`,
    },
    // Chain 3: Samenkorn — Asset als <image>. Die gestreuten Samen passen perspektivisch
    // in 44×44; preserveAspectRatio="xMidYMid meet" zentriert.
    seed_1: {
        name: "Seed",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <image href="assets/seed_1.svg?v=1" x="2" y="2" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>
               </svg>`,
    },
    // Chain 3: Drei gestapelte Goldmünzen (leicht versetzt, ohne Symbol).
    // Eigene <linearGradient>-IDs (`gm_*`) prefixed gegen Konflikte mit anderen Inventar-Icons.
    goldene_muenzen: {
        name: "Golden coins",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <defs>
                   <linearGradient id="gm_grad" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0"   stop-color="#ffe27a"/>
                     <stop offset="0.55" stop-color="#f0b939"/>
                     <stop offset="1"   stop-color="#a87420"/>
                   </linearGradient>
                 </defs>
                 <ellipse cx="24" cy="38" rx="17" ry="5" fill="#5a3a10" opacity="0.45"/>
                 <ellipse cx="24" cy="34" rx="16" ry="5.5" fill="url(#gm_grad)" stroke="#7c5f1e" stroke-width="1"/>
                 <ellipse cx="26" cy="26" rx="16" ry="5.5" fill="url(#gm_grad)" stroke="#7c5f1e" stroke-width="1"/>
                 <ellipse cx="22" cy="18" rx="16" ry="5.5" fill="url(#gm_grad)" stroke="#7c5f1e" stroke-width="1"/>
               </svg>`,
    },
    // Chain 3 / Bridge: Nachtsicht-Fernglas — Asset als <image>. preserveAspectRatio
    // belässt die Proportionen (Asset ist 485×425 ≈ 1.14:1).
    binoculars_1: {
        name: "Night vision device",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <image href="assets/binoculars_1.svg?v=1" x="11.5" y="11.5" width="25" height="25" preserveAspectRatio="xMidYMid meet"/>
               </svg>`,
    },
    // Chain 4: duck_1 (Quietscheente) — Inline-SVG, kompakt aus dem Asset duck_1.svg.
    duck_1: {
        name: "Rubber duck",
        icon: `<svg viewBox="0 0 273.67 287.351" xmlns="http://www.w3.org/2000/svg">
                 <path d="M51.071,116.57 C67.165,114.414 83.493,131.226 83.493,131.226 C83.493,131.226 89.899,126.554 108.587,122.453 C95.056,110.133 86.595,92.351 86.595,72.617 C86.595,35.351 116.79,5.179 154.056,5.179 C191.321,5.179 221.524,35.351 221.524,72.617 C221.524,95.383 210.228,115.492 192.985,127.719 C187.61,136.25 198.978,137.734 207.321,146 C222.056,160.617 240.298,163.515 246.735,211.648 C253.149,259.687 234.743,273.883 194.235,279.367 C153.743,284.773 67.165,280.758 67.165,280.758 C67.165,280.758 4.087,255.336 5.173,218.156 C6.282,181.015 26.126,119.929 51.071,116.57" fill="#FFDA1A"/>
                 <path d="M158.837,79.429 C158.837,79.429 183.587,45.547 195.978,45.547 C208.368,45.547 223.157,52.109 248.001,52.109 C272.806,52.109 270.837,63.648 264.173,72.617 C257.532,81.648 239.509,94.765 239.509,94.765 C239.509,94.765 249.603,112.758 248.001,116.57 C244.415,124.758 203.571,131.836 197.884,130.765 C185.97,128.594 160.915,117.664 154.056,103.492 C147.181,89.281 158.837,79.429 158.837,79.429" fill="#E6762B"/>
                 <path d="M120.813,53.195 C120.813,64.07 129.618,72.875 140.478,72.875 C151.321,72.875 160.134,64.07 160.134,53.195 C160.134,42.351 151.321,33.578 140.478,33.578 C129.618,33.578 120.813,42.351 120.813,53.195" fill="#FFFFFE"/>
                 <path d="M127.79,55.211 C127.79,63.758 134.72,70.734 143.274,70.734 C151.821,70.734 158.743,63.758 158.743,55.211 C158.743,46.679 151.821,39.742 143.274,39.742 C134.72,39.742 127.79,46.679 127.79,55.211" fill="#3D1212"/>
               </svg>`,
    },
    // Chain 4: muffin_1 — kleines Cupcake-Icon im Cartoon-Stil.
    muffin_1: {
        name: "Muffin",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <!-- Wachspapier (geriffelt) -->
                 <path d="M11 24 L14 42 Q14 44 16 44 L32 44 Q34 44 34 42 L37 24 Z" fill="#f0bf20" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
                 <line x1="16" y1="26" x2="16" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="20" y1="26" x2="20" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="24" y1="26" x2="24" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="28" y1="26" x2="28" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="32" y1="26" x2="32" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <!-- Cupcake-Top (Schoko) -->
                 <path d="M9 24 Q9 14 24 12 Q39 14 39 24 Z" fill="#5a3a1a" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
                 <!-- Streusel -->
                 <circle cx="16" cy="20" r="1.5" fill="#ff5a5a"/>
                 <circle cx="22" cy="17" r="1.5" fill="#ffd84a"/>
                 <circle cx="29" cy="20" r="1.5" fill="#5fff8a"/>
                 <circle cx="32" cy="22" r="1.5" fill="#ffaa44"/>
               </svg>`,
    },
    // Chain 4: Messgerät — Cartoon-Bandmaß. Gelbes Gehäuse + ausgezogenes Maßband mit Tics.
    messgeraet: {
        name: "Tape measure",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <!-- Maßband-Streifen, schräg ausgezogen -->
                 <path d="M30 24 L44 36 L40 42 L26 30 Z" fill="#ffffff" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
                 <!-- Skala-Tics auf dem Streifen -->
                 <line x1="30" y1="27" x2="32" y2="29" stroke="#1a1a1a" stroke-width="1.2"/>
                 <line x1="33" y1="30" x2="35" y2="32" stroke="#1a1a1a" stroke-width="1.2"/>
                 <line x1="36" y1="33" x2="38" y2="35" stroke="#1a1a1a" stroke-width="1.2"/>
                 <line x1="39" y1="36" x2="41" y2="38" stroke="#1a1a1a" stroke-width="1.2"/>
                 <!-- Gehäuse (Kreis) -->
                 <circle cx="18" cy="22" r="14" fill="#ff9933" stroke="#1a1a1a" stroke-width="2"/>
                 <!-- Innen-Wickel mit Achse -->
                 <circle cx="18" cy="22" r="6" fill="#1a1a1a"/>
                 <circle cx="18" cy="22" r="2.5" fill="#ffd84a"/>
                 <!-- kleines Höhepunkt-Highlight -->
                 <circle cx="14" cy="18" r="2.5" fill="#ffd084" opacity="0.7"/>
               </svg>`,
    },
    // Chain 4: Schaufel (kleine Garten-Kelle, 30° rotiert).
    schaufel: {
        name: "Trowel",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g transform="rotate(-30 24 24)">
                   <!-- Holzgriff -->
                   <rect x="20" y="4" width="8" height="20" fill="#8b5a2b" stroke="#1a1a1a" stroke-width="1.5" rx="2"/>
                   <!-- Bänder am Griff -->
                   <rect x="20" y="9" width="8" height="2" fill="#5a3a1a"/>
                   <rect x="20" y="18" width="8" height="2" fill="#5a3a1a"/>
                   <!-- Kellen-Hals (Verbindung Holz → Blatt) -->
                   <rect x="22" y="22" width="4" height="6" fill="#888888" stroke="#1a1a1a" stroke-width="1"/>
                   <!-- Kellen-Blatt (zulaufend, leicht gebogen) -->
                   <path d="M16 28 Q14 36 18 42 Q24 46 30 42 Q34 36 32 28 Z" fill="#c0c0c0" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
                   <!-- Highlight auf Blatt -->
                   <path d="M19 31 Q19 37 22 41" fill="none" stroke="#ececec" stroke-width="1.5" stroke-linecap="round"/>
                 </g>
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
    // Spezial-Hooks für bestimmte Items.
    if (obj.aufnehmen === "binoculars_1") {
        // Nachtsicht-Filter aktivieren + binoculars_1_visual aus toilet_1 ausblenden.
        spielstand.zustaende.binoculars_genommen = true;
        aktiviereNachtsicht();
    }
    // Visuelles Sofort-Update: Sichtbarkeits-Logik basiert auf gegenstaende (z.B.
    // animal_3_1-Image auf desk_4 verschwinden lassen, sobald es im Inventar liegt).
    aktualisiereSanitaer();   // ruft auch aktualisiereChain3() auf
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
// Listener bewusst auf `document` statt Slot — Slot-Element kann während des Drags durch
// aktualisiereInventar() neu gerendert werden, dabei verliert setPointerCapture die Bindung
// und das Drag-Preview hängt fest. Document-Listener sind immer erreichbar.

let dragZustand = null;  // { id, slot, pointerId, listeners } während aktivem Drag

// Räumt einen aktiven Drag-Zustand sauber auf — kann jederzeit aufgerufen werden
// (Esc, Raumwechsel, neues starteDrag, Konsole). Idempotent.
function dragAbbrechen() {
    if (dragZustand) {
        const { slot, pointerId, listeners } = dragZustand;
        if (slot && slot.classList) slot.classList.remove("dragging");
        if (slot && typeof slot.releasePointerCapture === "function") {
            try { slot.releasePointerCapture(pointerId); } catch (_) {}
        }
        if (listeners) {
            document.removeEventListener("pointermove", listeners.onMove);
            document.removeEventListener("pointerup", listeners.onUp);
            document.removeEventListener("pointercancel", listeners.onCancel);
        }
        dragZustand = null;
    }
    dragPreviewEl.hidden = true;
    dragPreviewEl.innerHTML = "";
}
window.dragAbbrechen = dragAbbrechen;

function starteDrag(e, id, slot) {
    if (wechselInGang) return;
    if (dragZustand) dragAbbrechen();  // Sicherheits-Reset, falls vom letzten Drag was hängenblieb
    e.preventDefault();

    try { slot.setPointerCapture(e.pointerId); } catch (_) {}
    slot.classList.add("dragging");

    const g = GEGENSTAENDE[id];
    dragPreviewEl.innerHTML = g.icon;
    dragPreviewEl.hidden = false;
    dragPreviewEl.style.left = e.clientX + "px";
    dragPreviewEl.style.top  = e.clientY + "px";

    const onMove = (ev) => {
        if (!dragZustand || ev.pointerId !== dragZustand.pointerId) return;
        dragPreviewEl.style.left = ev.clientX + "px";
        dragPreviewEl.style.top  = ev.clientY + "px";
    };
    const onUp = (ev) => {
        if (!dragZustand || ev.pointerId !== dragZustand.pointerId) return;
        const itemId = dragZustand.id;
        const cx = ev.clientX, cy = ev.clientY;
        dragAbbrechen();
        versucheDrop(cx, cy, itemId);
    };
    const onCancel = (ev) => {
        if (!dragZustand || ev.pointerId !== dragZustand.pointerId) return;
        dragAbbrechen();
    };

    dragZustand = { id, slot, pointerId: e.pointerId, listeners: { onMove, onUp, onCancel } };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
}

function versucheDrop(clientX, clientY, gegenstandId) {
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right ||
        clientY < rect.top  || clientY > rect.bottom) {
        return;   // ausserhalb des Canvas → Drop verpuffet, Gegenstand bleibt im Inventar
    }
    const [x, y] = canvasZuLogisch(clientX, clientY);

    // Erst Objekte, dann Türen prüfen — bei Treffer Figur hinlaufen lassen, dann Callback.
    // Drop-spezifische Suche: erstes aktives Objekt, dessen Polygon den Drop enthält UND
    // das den Gegenstand akzeptiert. Wichtig bei überlappenden Polygonen — z.B. animal_3_3
    // landet sonst bei toilet_1 (kein akzeptiert) statt beim octopus dahinter.
    const objekte = OBJEKTE[aktuellerRaum] || [];
    let obj = null;
    for (const o of objekte) {
        if (objektIstAktiv(o) && istInPolygon(x, y, o.polygon) &&
            o.akzeptiert && o.akzeptiert[gegenstandId]) {
            obj = o;
            break;
        }
    }
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
