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
                      automatischSchliessen();
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
            // (rechte Wand u 0.325..0.575, v 0..0.4, hier auf die linke Kellerwand gespiegelt).
            // Farbe b90 (eine Stufe dunkler als die b80-Wand → die Tür hebt sich subtil ab,
            // statt komplett zu verschmelzen). Ohne Label, damit sie optisch wie die
            // freigeschaltete Geheimtür drüben wirkt — nur dunkler an die Keller-Atmosphäre angepasst.
            { id: "zurueck",
              polygon: [linkeWandPunkt(0.325, 0), linkeWandPunkt(0.575, 0),
                        linkeWandPunkt(0.575, 0.4), linkeWandPunkt(0.325, 0.4)],
              ziel: "haupt", laufziel: { fu: 0.12, fv: 0.45 },
              farbe: GRAU.b90 },
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

// Standard-Eintrittsposition in jedem Raum (fu, fv) — einheitlich Mitte-vorne.
const RAUM_EINTRITT = { fu: 0.5, fv: 0.3 };

// ---------- Spielstand ----------
// Persistenter Zustand: gelöste Aufgaben, freigeschaltete Schlüssel, gefundene Werte.
// Jede Tür kann optional ein `schloss: "<schluessel-id>"` haben — sie ist dann verschlossen,
// bis der passende Schlüssel in `freigeschalteteTueren` liegt.
const spielstand = {
    geloesteAufgaben: new Set(),
    freigeschalteteTueren: new Set(),
    inventar: {},
    gegenstaende: new Set(),   // aufgenommene Gegenstände (Set von IDs aus GEGENSTAENDE)
    // Chain 6: linkes Sammel-Inventar für die 3 Schlüsselteile + Leim. Items darin sind
    // NICHT interaktiv (kein Drag, Klick zeigt nur einen Hinweis). Sobald alle 4 drin sind,
    // verschmelzen sie zu `vereinter_schluessel` im rechten Inventar.
    linkesInventar: new Set(),
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
        // Chain 5 — Bürobild-Sequenz (gelb-rot-violett) → Aufgabe (R = r·√2) → Drei-Kreise-Item
        // → Drop auf painting_2 (Keller) → Skelett lacht 2 s → Pickel.
        chain_5_step: 0,                  // 0 = nichts, 1 = MC gelöst, 4 = drei_kreise gedroppt + Pickel direkt im Inventar (Schritte 2 und 3 entfallen seit Vereinfachung)
        bild_kreise_sequenz: [],          // aktuelle Klick-Sequenz, Array von "yellow"|"red"|"violet"
        bild_kreise_replay_aktiv: false,  // sperrt Klicks während Replay
        bild_kreise_geloest: false,       // MC gelöst → drei_kreise im Inventar; Bürobild-Kreise versteckt
        bild_kreise_im_keller: false,     // drei_kreise auf painting_2 gedroppt → Overlay sichtbar
        // Chain 7 — Schaufel + Pickel + vereinter_schluessel → Grab in Gartenmitte
        // → Truhe ausheben → mit Schlüssel öffnen → Sieg-Overlay (Feuerwerk + Schatz).
        // Reihenfolge Schaufel/Pickel egal; Loch öffnet sich nach beiden Drops.
        chain_7_schaufel_gedroppt: false, // Schaufel auf gartenmitte_grab gedroppt
        chain_7_pickel_gedroppt: false,   // Pickel auf gartenmitte_grab gedroppt
        chain_7_loch_offen: false,        // beide Werkzeuge gedroppt → Loch + Truhe sichtbar (chain_7_grab visible)
        chain_7_geoeffnet: false,         // vereinter_schluessel auf chest_1 gedroppt → Sieg-Overlay
    },
};

// ---------- Persistenz (localStorage) ----------
// Speichert spielstand + aktuellerRaum + Figur-Position pro Browser/Origin/Profil.
// Sets werden beim Speichern zu Arrays serialisiert und beim Laden zurück konvertiert.
// STORAGE_VERSION hochzählen, sobald sich die Datenstruktur inkompatibel ändert — alte
// Saves werden dann verworfen statt das Spiel zu crashen.
const STORAGE_KEY = "spiel_kreise_1_save";
const STORAGE_VERSION = 1;
// Eigenes localStorage-Item für User-Settings (Sound/Musik-Toggles). Bewusst getrennt vom
// Spielstand: bleibt beim Reset erhalten — User-Vorlieben sollen ein Reset überleben.
const SETTINGS_KEY = "spiel_kreise_1_settings";

function ladeEinstellungen() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.soundAn === "boolean") soundAn = data.soundAn;
        if (typeof data.musikAn === "boolean") musikAn = data.musikAn;
    } catch (e) {
        console.warn("Einstellungen konnten nicht geladen werden:", e.message);
    }
}

function speicherEinstellungen() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundAn, musikAn }));
    } catch (e) {
        console.warn("Einstellungen konnten nicht gespeichert werden:", e.message);
    }
}

// Sperrt speicherSpielstand() während des initialen Ladens, damit die Kaskade von
// aktualisiere*-Aufrufen in aktualisiereAllesNachLaden() nicht redundant zurückspeichert.
// Initial true (während des kompletten JS-Module-Loads), wird im Auto-Start nach erfolgter
// Initialisierung auf false gesetzt — schützt davor, dass ein Top-Level-Aufruf von
// aktualisiereLinkesInventar() (am Ende der Datei) leere Defaults speichert, BEVOR
// ladeSpielstand() im requestAnimationFrame zum Zug kommt und einen vorhandenen Save lädt.
let ladeVorgang = true;

function speicherSpielstand() {
    if (ladeVorgang) return;
    try {
        const daten = {
            version: STORAGE_VERSION,
            aktuellerRaum,
            figur: { fu: figur.fu, fv: figur.fv, richtung: figur.richtung },
            geloesteAufgaben: [...spielstand.geloesteAufgaben],
            freigeschalteteTueren: [...spielstand.freigeschalteteTueren],
            gegenstaende: [...spielstand.gegenstaende],
            linkesInventar: [...spielstand.linkesInventar],
            inventar: spielstand.inventar,
            zustaende: spielstand.zustaende,
            chain_7_hindernis_aktiv,  // damit das Boden-Hindernis nach Reload wieder aktiv ist
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(daten));
    } catch (e) {
        // QuotaExceededError, SecurityError (private mode/blocked), etc. — Spiel läuft im
        // RAM weiter, nur ohne Persistenz. Kein Crash, einmalige Warnung in der Konsole.
        console.warn("Speichern fehlgeschlagen:", e.message);
    }
}

function ladeSpielstand() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        console.warn("localStorage nicht verfügbar:", e.message);
        return false;
    }
    if (!raw) return false;
    let daten;
    try {
        daten = JSON.parse(raw);
    } catch (e) {
        console.warn("Spielstand korrupt, verwerfe:", e.message);
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        return false;
    }
    if (daten.version !== STORAGE_VERSION) {
        console.info(`Alter Spielstand (Version ${daten.version}) inkompatibel mit Version ${STORAGE_VERSION} — verwerfe.`);
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        return false;
    }
    // Spielstand-Felder restoren — Sets aus Arrays rebauen.
    spielstand.geloesteAufgaben      = new Set(daten.geloesteAufgaben || []);
    spielstand.freigeschalteteTueren = new Set(daten.freigeschalteteTueren || []);
    spielstand.gegenstaende          = new Set(daten.gegenstaende || []);
    spielstand.linkesInventar        = new Set(daten.linkesInventar || []);
    spielstand.inventar              = daten.inventar || {};
    // zustaende mergen (Default-Object war vor dem Laden initialisiert; wir überschreiben
    // nur bekannte Keys aus dem Save). Falls eine spätere Spielversion neue Default-Keys
    // einführt, bleiben diese auf ihren Default-Werten (kein undefined-Bug bei alten Saves).
    Object.assign(spielstand.zustaende, daten.zustaende || {});
    // Transient/Animations-Flags zurücksetzen — sie waren während einer laufenden Animation
    // true (Replay-Sperre, Octopus-Exit-Timer) und sind nach Reload sinnlos.
    spielstand.zustaende.bild_kreise_replay_aktiv = false;
    spielstand.zustaende.bild_kreise_sequenz = [];
    spielstand.zustaende.octopus_exit_gestartet = false;
    // Aktuellen Raum + Figur-Position
    if (daten.aktuellerRaum) aktuellerRaum = daten.aktuellerRaum;
    if (daten.figur) {
        figur.fu = daten.figur.fu;
        figur.fv = daten.figur.fv;
        figur.richtung = daten.figur.richtung || "vorne";
        figur.zielFu = figur.fu;
        figur.zielFv = figur.fv;
    }
    // Chain 7-Hindernis nachziehen (wenn Loch beim letzten Save offen war).
    if (daten.chain_7_hindernis_aktiv && !chain_7_hindernis_aktiv) {
        HINDERNISSE.garten.push(CHAIN_7_HINDERNIS);
        chain_7_hindernis_aktiv = true;
    }
    return true;
}

// Wird nach ladeSpielstand() im Init aufgerufen — synchronisiert ALLE DOM-State-Spiegel
// mit den frisch geladenen Spielstand-Werten. Einzelne aktualisiere*-Aufrufe reichen nicht,
// weil sie sich gegenseitig nicht alle aufrufen (z.B. Cupboard1 wird nicht von Sanitaer
// mitgenommen). Auch Raum-Sichtbarkeit (data-raum-Toggle) muss explizit nachgezogen werden.
function aktualisiereAllesNachLaden() {
    // Nur die Deko des aktuellen Raums anzeigen (sonst sind alle Räume gleichzeitig sichtbar).
    document.querySelectorAll("#object-layer > g[data-raum], #object-layer-vorne > g[data-raum]").forEach(g => {
        g.style.display = g.dataset.raum === aktuellerRaum ? "" : "none";
    });
    aktualisiereSanitaer();   // ruft Chain3 → Chain4 → Chain5 → Chain7 mit
    aktualisiereCupboard1();
    aktualisiereInventar();
    aktualisiereLinkesInventar();
    // Nachtsicht: wenn Binoculars im Inventar liegen und Geheimtür noch nicht freigeschaltet,
    // muss der CSS-Filter wieder aktiv sein.
    if (spielstand.gegenstaende.has("binoculars_1") && !spielstand.zustaende.keller_freigeschaltet) {
        if (typeof aktiviereNachtsicht === "function") aktiviereNachtsicht();
    }
    draw();
}

function setzeSpielstandZurueck() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn("Reset-removeItem fehlgeschlagen:", e.message);
    }
    location.reload();
}

window.speicherSpielstand = speicherSpielstand;
window.setzeSpielstandZurueck = setzeSpielstandZurueck;

function istFrei(tuer) {
    if (!tuer.schloss) return true;
    return spielstand.freigeschalteteTueren.has(tuer.schloss);
}

// Dev-Helfer (Konsole): z.B. freischalten("keller_schluessel")
function freischalten(schluesselId) {
    spielstand.freigeschalteteTueren.add(schluesselId);
    speicherSpielstand();
    draw();
    console.log(`Schlüssel "${schluesselId}" freigeschaltet.`);
}
function verschliessen(schluesselId) {
    spielstand.freigeschalteteTueren.delete(schluesselId);
    speicherSpielstand();
    draw();
    console.log(`Schlüssel "${schluesselId}" entfernt.`);
}
window.freischalten = freischalten;
window.verschliessen = verschliessen;
window.spielstand = spielstand;

// ---------- Sichtbarkeits-Toggle-Helper ----------
// Togglet die CSS-Klasse `sanitar-aus` (mit display:none !important im <style>)
// auf einem Element UND seinen Front-Layer-Klonen. `klonePflanzenVorne()` prefixt
// Klon-IDs mit `v_<idx>_` gegen Gradient-Konflikte → der Selektor matcht beide.
// Wird von aktualisiereSanitaer/Cupboard1/Chain3/4/5/7 benutzt.
function setSichtbar(id, sichtbar) {
    document.querySelectorAll(`[id="${id}"], [id^="v_"][id$="_${id}"]`).forEach(el => {
        el.classList.toggle("sanitar-aus", !sichtbar);
    });
}

// ---------- Sanitärobjekt-Switch (Badezimmer) ----------
// Spiegelt Toiletten-Switches, Voll-Indikatoren, Octopus-Triplet auf das DOM
// (Bathtub-Layer-Pair siehe CLAUDE.md, kein Switch mehr).
function aktualisiereSanitaer() {
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
    speicherSpielstand();
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

// Octopus-Exit: triggert die @keyframes-Animation `octopus-leave` (siehe style.css).
// Nach animationend → octopus_da=false, toilet_1 wird klickbar. Details in CLAUDE.md.
function animiereOctopusRaus() {
    // Beide DOM-Vorkommen (Rück- + Front-Layer-Klon mit `v_<idx>_octopus_1_3`-Prefix) ansprechen.
    const els = document.querySelectorAll(`[id="octopus_1_3"], [id^="v_"][id$="_octopus_1_3"]`);
    if (!els.length) {
        // Sicherheitsnetz: falls kein Element gefunden, sofort wegschalten.
        spielstand.zustaende.octopus_da = false;
        aktualisiereSanitaer();
        return;
    }
    let abgeschlossen = false;
    const beenden = () => {
        if (abgeschlossen) return;
        abgeschlossen = true;
        spielstand.zustaende.octopus_da = false;
        aktualisiereSanitaer();
        els.forEach(el => el.classList.remove("octopus-leaving"));
    };
    els.forEach(el => {
        el.classList.add("octopus-leaving");
        el.addEventListener("animationend", beenden, { once: true });
    });
    // Safety-Net falls animationend nicht feuert: nach 2.5 s zwangsweise abschliessen.
    setTimeout(beenden, 2500);
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
    setSichtbar("cupboard_1_1", !offen);
    setSichtbar("cupboard_1_2", offen);
    // Zettel im Schrank verschwinden lassen, sobald er im Inventar liegt.
    setSichtbar("cupboard_1_zettel_visual", offen && !spielstand.gegenstaende.has("zettel"));
    speicherSpielstand();
}

function oeffneCupboard1() {
    spielstand.zustaende.cupboard_1_offen = true;
    spielstand.zustaende.chain_1_step = Math.max(spielstand.zustaende.chain_1_step, 2);
    aktualisiereCupboard1();
    draw();
}
window.oeffneCupboard1 = oeffneCupboard1;

// ---------- Chain 3 ----------
function aktualisiereChain3() {
    const z = spielstand.zustaende;
    setSichtbar("bird_1", !!z.vogel_da);
    setSichtbar("gradenhose_1", !z.schlauch_genommen);
    setSichtbar("binoculars_1_visual", !z.octopus_da && z.toilette_1 === 2 && !z.binoculars_genommen);

    // flower_1 skalieren — class auf dem Wrapper-<g class="flower-1">. Original UND Klone
    // haben dieselbe Klasse (klonePflanzenVorne kopiert sie mit), also alle gleichzeitig erfassen.
    document.querySelectorAll(".flower-1").forEach(el => {
        el.classList.toggle("flower-1-gross", !!z.flower_1_gegossen);
    });

    if (typeof aktualisiereChain4 === "function") aktualisiereChain4();
    speicherSpielstand();
}

// ---------- Chain 4 ----------
function aktualisiereChain4() {
    const z = spielstand.zustaende;
    const inv = spielstand.gegenstaende;
    const duckInInv     = inv.has("duck_1");
    const muffinInInv   = inv.has("muffin_1");
    setSichtbar("duck_1",        !duckInInv && !z.duck_im_keller);
    setSichtbar("muffin_1",      !muffinInInv && !z.duck_gefuettert);
    setSichtbar("duck_1_keller", !!z.duck_im_keller);
    document.querySelectorAll(".duck-keller-inner").forEach(el => {
        el.classList.toggle("duck-gross", !!z.duck_gefuettert);
    });
    if (typeof aktualisiereChain5 === "function") aktualisiereChain5();
    speicherSpielstand();
}

// ---------- Chain 5 — Bürobild-Sequenz, Drei-Kreise-Item, Pickel ----------
//   • bild_kreis_yellow/red/violet (Bürobild-Pfade) — versteckt nach bild_kreise_geloest.
//   • painting_2_kreise (Keller, Overlay über painting_2) — sichtbar nach bild_kreise_im_keller.
//   • Pickel landet seit der Story-Vereinfachung DIREKT ins Inventar nach drei_kreise-Drop
//     (kein separates Aufnehm-SVG im Keller mehr; pickel_da-Flag obsolet).
function aktualisiereChain5() {
    const z = spielstand.zustaende;
    // Drei klickbare Bürobild-Kreise — verstecken, sobald die Aufgabe gelöst ist.
    const kreiseSichtbar = !z.bild_kreise_geloest;
    setSichtbar("bild_kreis_yellow", kreiseSichtbar);
    setSichtbar("bild_kreis_red",    kreiseSichtbar);
    setSichtbar("bild_kreis_violet", kreiseSichtbar);
    // Drei Kreise auf painting_2 (Keller) — sichtbar nach Drop.
    setSichtbar("painting_2_kreise", !!z.bild_kreise_im_keller);
    // Chain 7 nachziehen (function-hoisting macht das sicher).
    if (typeof aktualisiereChain7 === "function") aktualisiereChain7();
    speicherSpielstand();
}
window.aktualisiereChain5 = aktualisiereChain5;

// Frequenzen der drei klickbaren Bürobild-Kreise — C4/E4/G4 (Dur-Akkord, harmonisch).
const KREIS_FREQ = { yellow: 261.63, red: 329.63, violet: 392.00 };
const KREIS_SEQUENZ_KORREKT = ["yellow", "red", "violet"];

// Klick-Handler eines Bild-Kreises (gelb/rot/violett). Spielt Ton, fügt Farbe in die Sequenz
// ein. Nach 3 Klicks kurz warten, dann Replay (immer — auch bei falscher Eingabe gibt's
// akustisches Feedback) und je nach Korrektheit Aufgabe öffnen oder Sequenz zurücksetzen.
function kreisGedrueckt(farbe) {
    const z = spielstand.zustaende;
    if (z.bild_kreise_replay_aktiv) return;       // Klicks während Replay ignorieren
    if (z.bild_kreise_geloest) return;            // Aufgabe schon gelöst
    spieleTon(KREIS_FREQ[farbe]);
    z.bild_kreise_sequenz.push(farbe);
    if (z.bild_kreise_sequenz.length >= 3) {
        // Kurze Pause vor Replay, damit der dritte Ton nicht direkt ineinander fällt.
        setTimeout(replaySequenz, 500);
    }
}

function replaySequenz() {
    const z = spielstand.zustaende;
    z.bild_kreise_replay_aktiv = true;
    const seq = z.bild_kreise_sequenz.slice();
    const tempo = 280;  // ms zwischen den Tönen im Replay
    seq.forEach((farbe, i) => {
        setTimeout(() => spieleTon(KREIS_FREQ[farbe]), i * tempo);
    });
    setTimeout(() => {
        const richtig = seq.length === 3 && seq.every((f, i) => f === KREIS_SEQUENZ_KORREKT[i]);
        z.bild_kreise_sequenz = [];
        z.bild_kreise_replay_aktiv = false;
        if (richtig) {
            zeigeAufgabe("chain_5_kreise");
        }
    }, seq.length * tempo + 250);
}
window.kreisGedrueckt = kreisGedrueckt;

// Skelett-Lach-Animation: 2 s lang die schnellere/grössere CSS-Animation einblenden,
// danach zurück zur ruhigen SMIL-Schaukel im Asset.
function skelettLachen() {
    const els = document.querySelectorAll(`[id="skelett_3"], image[href$="skeleton_3.svg"]`);
    els.forEach(el => el.classList.add("skelett-lacht"));
    setTimeout(() => {
        els.forEach(el => el.classList.remove("skelett-lacht"));
    }, 2000);
}
window.skelettLachen = skelettLachen;

window.aktualisiereChain3 = aktualisiereChain3;

// ---------- Chain 7 — Grab in Gartenmitte (Schaufel + Pickel → Loch + Truhe → Schlüssel → Sieg) ----------
// Toggle-Sichtbarkeit der Loch+Truhe-Gruppe (#chain_7_grab) im Garten.
// Selektor matcht Original UND Front-Layer-Klone (v_<idx>_chain_7_grab) wie aktualisiereSanitaer.
function aktualisiereChain7() {
    const z = spielstand.zustaende;
    setSichtbar("chain_7_grab", !!z.chain_7_loch_offen);
    speicherSpielstand();
}
window.aktualisiereChain7 = aktualisiereChain7;

// Hindernis für die offene Grube (Boden-Polygon, das die Figur nicht betreten darf).
// Wird beim Öffnen des Lochs genau einmal in HINDERNISSE.garten gepusht und beim Reset
// (Spiel neu starten via Reload) automatisch verworfen — Module-State ist frisch.
const CHAIN_7_HINDERNIS = {
    spline: [
        { fu: 0.3297, fv: 0.34, hIn: { du: -0.0186, dv: 0.1904 } },
        { fu: 0.6733, fv: 0.3462, hOut: { du: 0.0125, dv: 0.1732 } },
        { fu: 0.6737, fv: 0.768, hIn: { du: 0.0204, dv: -0.1506 }, hOut: { du: -0.0762, dv: 0.0017 } },
        { fu: 0.5043, fv: 0.8964, hIn: { du: 0.1051, dv: -0.0215 }, hOut: { du: -0.0936, dv: -0.0187 } },
        { fu: 0.3285, fv: 0.754, hIn: { du: 0.0879, dv: 0.0193 }, hOut: { du: -0.0155, dv: -0.1403 } },
    ],
};
let chain_7_hindernis_aktiv = false;

// Drop-Callback für gartenmitte_grab (Chain 7). Gemeinsam für schaufel und pickel —
// verbraucht das gedroppte Werkzeug, setzt das passende Flag, und öffnet das Loch
// sobald BEIDE Werkzeuge gedroppt wurden. Reihenfolge egal.
function oeffneGrab(werkzeug) {
    const z = spielstand.zustaende;
    if (z.chain_7_loch_offen) return;
    verbrauche(werkzeug);
    if (werkzeug === "schaufel") z.chain_7_schaufel_gedroppt = true;
    if (werkzeug === "pickel")   z.chain_7_pickel_gedroppt   = true;
    aktualisiereInventar();
    if (z.chain_7_schaufel_gedroppt && z.chain_7_pickel_gedroppt) {
        // Beides da → Loch öffnen, Truhe sichtbar machen, Boden-Hindernis aktivieren.
        z.chain_7_loch_offen = true;
        if (!chain_7_hindernis_aktiv) {
            HINDERNISSE.garten.push(CHAIN_7_HINDERNIS);
            chain_7_hindernis_aktiv = true;
        }
        aktualisiereChain7();
        draw();
        zeigeOverlayText("You break through the soil and uncover a wooden chest in the hole.");
        automatischSchliessen();
    } else {
        // Erstes Werkzeug — kurze Bestätigung, damit der User sieht, dass etwas passiert.
        const fehlt = z.chain_7_schaufel_gedroppt ? "pickaxe" : "trowel";
        zeigeOverlayText(`You start breaking up the soil — but you also need a ${fehlt}.`);
        automatischSchliessen();
    }
}
window.oeffneGrab = oeffneGrab;

// Sieg-Overlay öffnen — Vollbild-Endscreen mit Feuerwerk-Animation, Schatz-Illustration
// und 2 Buttons (Play again / End game). Wird vom chest_1-akzeptiert-Callback aufgerufen.
function zeigeSiegOverlay() {
    const siegEl = document.getElementById("sieg-overlay");
    if (!siegEl) return;
    // Inventare ausblenden, damit das Inventar nicht neben der Krone steht.
    if (inventarEl) inventarEl.hidden = true;
    const linksEl = document.getElementById("inventar-links");
    if (linksEl) linksEl.hidden = true;
    // Falls das normale Aufgaben-Overlay noch offen ist (sollte nicht passieren, da der Drop
    // direkt aus dem Drag-Flow kommt), schliessen.
    if (typeof schliesseOverlay === "function") schliesseOverlay();
    // Feuerwerk-Bursts dynamisch befüllen — pro Burst 12 Partikel, gestaffelte Delays.
    spawneFireworks();
    siegEl.hidden = false;
}
window.zeigeSiegOverlay = zeigeSiegOverlay;

// Erzeugt 6 Feuerwerk-Bursts an verschiedenen Positionen mit gestaffelten Delays,
// jeweils 12 Partikel à 30°. CSS-Animation läuft endlos, daher reicht einmaliges
// Erzeugen pro Overlay-Öffnung (Wiederholung kommt aus der CSS-Animation).
const FIREWORK_BURSTS = [
    { left: "18%", top: "22%", color: "#ffd24a", delay: 0.0 },
    { left: "78%", top: "18%", color: "#ff6b6b", delay: 0.3 },
    { left: "32%", top: "70%", color: "#7cdcff", delay: 0.6 },
    { left: "62%", top: "75%", color: "#a8ff7c", delay: 0.9 },
    { left: "50%", top: "12%", color: "#ff9eff", delay: 1.2 },
    { left: "12%", top: "55%", color: "#ffe680", delay: 1.5 },
];
function spawneFireworks() {
    const fwEl = document.getElementById("sieg-fireworks");
    if (!fwEl) return;
    fwEl.innerHTML = "";
    for (const cfg of FIREWORK_BURSTS) {
        const burst = document.createElement("div");
        burst.className = "firework";
        burst.style.left = cfg.left;
        burst.style.top = cfg.top;
        for (let i = 0; i < 12; i++) {
            const p = document.createElement("div");
            p.className = "particle";
            p.style.setProperty("--angle", `${i * 30}deg`);
            p.style.setProperty("--color", cfg.color);
            p.style.setProperty("--delay", `${cfg.delay}s`);
            burst.appendChild(p);
        }
        fwEl.appendChild(burst);
    }
}

// Button-Handler für Sieg-Overlay. Werden beim DOMContentLoaded gebunden (siehe Block ganz unten).
function siegPlayAgain() {
    location.reload();
}
function siegEndGame() {
    // Inhalt des Sieg-Overlays durch "Thanks for playing"-Screen ersetzen.
    const fw = document.getElementById("sieg-fireworks");
    if (fw) fw.innerHTML = "";
    const box = document.getElementById("sieg-box");
    if (box) {
        box.innerHTML = "<h2 id=\"sieg-headline\">Thanks for playing!</h2>";
    }
}
window.siegPlayAgain = siegPlayAgain;
window.siegEndGame = siegEndGame;

// ---------- Start-Overlay: Begrüssungsbildschirm beim Page-Load ----------
// Zeigt Story-Setup + Buttons (Continue/Start over wenn Save vorhanden, sonst nur
// Begin adventure). Wird vom Auto-Start aufgerufen NACH loop()-Start (Overlay deckt
// die laufende Stage ab). Klick auf Button → fade-out + ensureAudio().

// Floater-Hintergrund: viele rumschwebende Kreise in unterschiedlichen Grössen
// und Farben (passt zum Spiel-Thema Kreise). Bewusst keine schwarzen Ränder —
// nur Fill mit variierender Opazität für Tiefen-Effekt. Random scatter über die
// gesamte Stage, Überlappung erlaubt; die zentrale Story-Box deckt sie in der
// Mitte ab. Insgesamt ~60 % der Stage-Fläche durch Kreise belegt (mit Überlapp).
const FLOATER_COLORS = [
    "#FFCE00", // yellow (Bürobild)
    "#E63946", // red (Bürobild)
    "#9D4EDD", // violet (Bürobild)
    "#f5d068", // gold (treasure)
    "#5fc8e0", // cyan
    "#ff8a3a", // orange
    "#6bd47a", // mint
    "#d35f8d", // pink
    "#a87cff", // soft violet
    "#ffb86b", // peach
];

function spawneStartFloater() {
    const fl = document.getElementById("start-floaters");
    if (!fl) return;
    fl.innerHTML = "";
    // 130 Kreise, Durchmesser 24–220 px (Math.random()²-Bias → mehr kleine als grosse).
    // Insgesamt ergibt das ca. 60 % Pixel-Coverage mit Überlapp; visuell ~50 % gefüllt.
    const COUNT = 130;
    for (let i = 0; i < COUNT; i++) {
        const c = document.createElement("div");
        c.className = `start-circle anim-${1 + (i % 3)}`;
        // Pseudo-quadratische Verteilung (kleine bevorzugt) für angenehme Grössen-Mischung.
        const u = Math.random();
        const groesse = 24 + u * u * 200;
        const left = Math.random() * 100;
        const top  = Math.random() * 100;
        const farbe = FLOATER_COLORS[Math.floor(Math.random() * FLOATER_COLORS.length)];
        const opazitaet = 0.30 + Math.random() * 0.45; // 0.30–0.75
        c.style.width  = `${groesse}px`;
        c.style.height = `${groesse}px`;
        c.style.left   = `${left}%`;
        c.style.top    = `${top}%`;
        c.style.background = farbe;
        c.style.opacity = opazitaet;
        // Zufällige Animationszeit (8–18 s) und Verzögerung (0–4 s) → entkorreliertes Schweben.
        c.style.animationDuration = `${8 + Math.random() * 10}s`;
        c.style.animationDelay = `${Math.random() * 4}s`;
        fl.appendChild(c);
    }
}

// Start-Overlay öffnen — wird einmal beim Page-Load aufgerufen, NACH ladeSpielstand()
// (damit der Save-Status für die Button-Auswahl korrekt ist). Inventare wieder
// einblenden lassen wir hier weg: aktualisiereInventar() läuft sowieso während
// aktualisiereAllesNachLaden() und togglet hidden je nach Inhalt; der Overlay
// deckt eh alles ab.
// SessionStorage-Flag: "Start over" setzt es, der nächste Page-Load skippt den
// Begrüssungsbildschirm und springt direkt ins frische Spiel. Beim ersten Spielen
// (kein Flag) zeigt die Begin-adventure-Seite. Audio-Context wird beim ersten
// In-Game-Klick automatisch unlocked (pointerdown auf #game-canvas → ensureAudio).
const SKIP_START_KEY = "spiel_kreise_1_skip_start";

function zeigeStartScreen() {
    const startEl = document.getElementById("start-overlay");
    if (!startEl) return;
    // Skip-Flag von "Start over": direkt ins Spiel, kein Overlay.
    try {
        if (sessionStorage.getItem(SKIP_START_KEY) === "1") {
            sessionStorage.removeItem(SKIP_START_KEY);
            return;
        }
    } catch (_) {}
    let hasSave = false;
    try { hasSave = !!localStorage.getItem(STORAGE_KEY); } catch (_) {}
    const btnContainer = startEl.querySelector(".start-buttons");
    if (btnContainer) {
        btnContainer.innerHTML = "";
        if (hasSave) {
            const cont = document.createElement("button");
            cont.id = "start-continue";
            cont.type = "button";
            cont.textContent = "Continue";
            cont.addEventListener("click", verstecksStartScreen);
            btnContainer.appendChild(cont);
            const rest = document.createElement("button");
            rest.id = "start-restart";
            rest.type = "button";
            rest.className = "secondary";
            rest.textContent = "Start over";
            // Two-Click-Confirm: erster Klick → Button wird rot + "Are you sure?",
            // zweiter Klick (innerhalb 3 s) löscht Save und reloaded. Schützt vor
            // versehentlichem Reset durch Schüler:innen.
            let confirming = false;
            let confirmTimer = null;
            rest.addEventListener("click", () => {
                if (!confirming) {
                    confirming = true;
                    rest.textContent = "Are you sure?";
                    rest.classList.remove("secondary");
                    rest.classList.add("confirm");
                    confirmTimer = setTimeout(() => {
                        confirming = false;
                        rest.textContent = "Start over";
                        rest.classList.remove("confirm");
                        rest.classList.add("secondary");
                    }, 3000);
                } else {
                    if (confirmTimer) clearTimeout(confirmTimer);
                    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
                    // Skip-Flag setzen: nach dem Reload direkt ins frische Spiel,
                    // ohne den Begrüssungsbildschirm erneut zu zeigen.
                    try { sessionStorage.setItem(SKIP_START_KEY, "1"); } catch (_) {}
                    location.reload();
                }
            });
            btnContainer.appendChild(rest);
        } else {
            const begin = document.createElement("button");
            begin.id = "start-begin";
            begin.type = "button";
            begin.textContent = "Begin adventure";
            begin.addEventListener("click", verstecksStartScreen);
            btnContainer.appendChild(begin);
        }
    }
    spawneStartFloater();
    startEl.hidden = false;
}

function verstecksStartScreen() {
    const startEl = document.getElementById("start-overlay");
    if (!startEl) return;
    // Klick auf Button zählt als User-Geste → audioCtx kann starten (Schritt-Sounds OK).
    if (typeof ensureAudio === "function") ensureAudio();
    startEl.classList.add("fade-out");
    setTimeout(() => {
        startEl.hidden = true;
        startEl.classList.remove("fade-out");
    }, 250);
}

window.zeigeStartScreen = zeigeStartScreen;

// ---------- Chain 3 / Bridge: Nachtsicht ----------
// Togglt die Body-Klasse `nachtsicht` → SVG-Filter `url(#nachtsicht)` auf die drei
// statischen Render-Layer (Single-Pass feColorMatrix, siehe CLAUDE.md).
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
// Musik-Flag — separat vom Spielstand, persistiert via SETTINGS_KEY (siehe ladeEinstellungen).
// Aktuell gibt es keine Musik im Spiel; das Flag ist ein Vorgriff für eine spätere
// Background-Music-Implementierung (z.B. Web Audio Loop). Settings-Menü zeigt es trotzdem
// an, damit User die Vorliebe vorab setzen können.
let musikAn = false;

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

// Sinuston (Chain 5): kurzer reiner Ton mit weicher Hüllkurve. Wird für die drei Kreise
// im Bürobild verwendet (gelb=C4, rot=E4, violett=G4). dauer in Sekunden.
function spieleTon(freq, dauer = 0.4) {
    if (!soundAn) return;
    ensureAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    // Hüllkurve: Attack 0.02 s → Sustain ~ (dauer - 0.15) → Release 0.13 s
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.setValueAtTime(0.25, now + Math.max(0.05, dauer - 0.13));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dauer);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dauer + 0.02);
}
window.spieleTon = spieleTon;

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

// ---------- Aufgaben ----------
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
    // Chain 5 — Bürobild-Sequenz (gelb-rot-violett) öffnet diese MC-Aufgabe.
    // Zwei Kreise mit Radius r haben gemeinsam dieselbe Fläche wie ein Kreis mit Radius R:
    //   2·π·r² = π·R²  →  R² = 2·r²  →  R = r·√2.
    // Distraktoren: 2 (verdoppelt-r-Falle), 4 (r² statt r), 1/√2 (inverse Falle).
    // π kürzt sich → kein π-Hinweis nötig.
    chain_5_kreise: {
        typ: "multiple_choice",
        frage: "Two circles with radius r have the same combined area as one circle with radius R. How many times larger is R than r?",
        formel: "2\\pi r^2 = \\pi R^2",
        optionen: [
            { katex: "\\sqrt{2}",                korrekt: true },
            { katex: "2" },
            { katex: "4" },
            { katex: "\\dfrac{1}{\\sqrt{2}}" },
        ],
        bei_richtig: {
            gegenstand: "drei_kreise",
            belohnung_text: "Correct! R = r·√2 — the area scales with the square of the radius. The three circles peel off the painting.",
            callback: (s) => {
                s.zustaende.bild_kreise_geloest = true;
                s.zustaende.chain_5_step = Math.max(s.zustaende.chain_5_step ?? 0, 1);
                aktualisiereChain5();
            },
        },
    },
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
            // Mathe-Lösung + Schaufel-Fund-Story in einem einzigen Overlay (kein zweites
            // Pop-up mehr nach Schliessen). Der Auto-Close in gewaehrenBelohnung ist
            // bewusst lang genug, damit der zusätzliche Story-Satz lesbar bleibt.
            belohnung_text: "Correct! The area of the outermost ring is 5966 cm². Lifting a corner of the rug, you find a flat trowel hidden underneath.",
            callback: (s) => {
                verbrauche("messgeraet");
                s.zustaende.teppich_gemessen = true;
                aktualisiereInventar();
            },
        },
    },
    // ---------- Chain 6 — vier Formel-Erkennungs-Aufgaben ----------
    // Jede der 4 Pickup-Stellen (animal_1, bookshelf_2-Bücher, plant_tulpe, desk_4-Schublade)
    // öffnet eine MC-Aufgabe, die die richtige Kreis-Formel abfragt. Bei Erfolg: ein Schlüssel-
    // teil bzw. der Leim wandert ins LINKE Inventar. Sobald alle 4 zusammen sind, verschmelzen
    // sie zu einem vereinten Schlüssel im rechten Inventar (siehe sammleSchluesselteil/kombiniereSchluessel).
    chain_6_sektor: {
        typ: "multiple_choice",
        frage: "Which formula gives the area of a circular SECTOR with central angle α?",
        optionen: [
            { katex: "A = \\dfrac{\\alpha}{360^\\circ} \\cdot \\pi r^2", korrekt: true },
            { katex: "A = \\dfrac{\\alpha}{360^\\circ} \\cdot 2\\pi r" },
            { katex: "A = \\pi r^2" },
            { katex: "A = \\alpha \\cdot \\pi r^2" },
        ],
        bei_richtig: {
            belohnung_text: "Correct! Behind the creature you spot a key fragment — it joins your collection on the left.",
            callback: () => sammleSchluesselteil("schluesselteil_1"),
        },
    },
    chain_6_bogen: {
        typ: "multiple_choice",
        frage: "Which formula gives the ARC LENGTH of a circle with central angle α?",
        optionen: [
            { katex: "b = \\dfrac{\\alpha}{360^\\circ} \\cdot 2\\pi r", korrekt: true },
            { katex: "b = \\dfrac{\\alpha}{360^\\circ} \\cdot \\pi r^2" },
            { katex: "b = 2\\pi r" },
            { katex: "b = \\alpha \\cdot 2\\pi r" },
        ],
        bei_richtig: {
            belohnung_text: "Correct! Tucked behind the books you find another key fragment.",
            callback: () => sammleSchluesselteil("schluesselteil_2"),
        },
    },
    chain_6_umfang: {
        typ: "multiple_choice",
        frage: "Which formula gives the CIRCUMFERENCE of a circle?",
        optionen: [
            { katex: "U = 2\\pi r", korrekt: true },
            { katex: "U = \\pi r^2" },
            { katex: "U = \\pi r" },
            { katex: "U = 2 r^2" },
        ],
        bei_richtig: {
            belohnung_text: "Correct! Among the tulip's petals you discover a key fragment.",
            callback: () => sammleSchluesselteil("schluesselteil_3"),
        },
    },
    chain_6_flaeche: {
        typ: "multiple_choice",
        frage: "Which formula gives the AREA of a circle?",
        optionen: [
            { katex: "A = \\pi r^2", korrekt: true },
            { katex: "A = 2\\pi r" },
            { katex: "A = \\pi d" },
            { katex: "A = \\pi r" },
        ],
        bei_richtig: {
            belohnung_text: "Correct! Inside the middle drawer you find a small tube of glue.",
            callback: () => sammleSchluesselteil("leim"),
        },
    },
    // Chain 1, Schritt 1.5 — Schloss am cupboard_1: Drop des Schlüssels öffnet diese
    // Aufgabe; bei richtiger Antwort wird der Schrank geöffnet (siehe akzeptiert-Callback
    // in OBJEKTE.buero.cupboard_1_drop). Thema: Umrechnung Grad → Bogenmaß (90° = π/2).
    chain_1_schloss: {
        typ: "multiple_choice",
        frage: "The key sits in the lock. To open the cabinet, you need to turn it by 90°. What is 90° in radians?",
        pi_hinweis: false,
        tipp: "Convert degrees → radians via rad = deg · π / 180.",
        optionen: [
            { katex: "\\dfrac{\\pi}{2}", korrekt: true },
            { katex: "\\pi" },
            { katex: "\\dfrac{\\pi}{4}" },
            { katex: "2\\pi" },
        ],
        bei_richtig: {
            belohnung_text: "Correct! 90° = π/2 rad. Click — the key fits. The left cabinet door creaks open.",
            callback: () => {
                // Schrank wird hier geöffnet (statt direkt im Drop-Callback) — der
                // Schlüssel wurde bereits beim Drop verbraucht.
                oeffneCupboard1();
            },
        },
    },
    // Bonus-Aufgabe (Chain-frei) — Klick auf die Sonne im Garten. Nicht spielentscheidend,
    // dient nur dem Spass und der Veranschaulichung von U=2πr im grossen Massstab.
    bonus_sonne: {
        typ: "multiple_choice",
        frage: "You admire the sun. Its radius is r = 696 000 km. What is its circumference?",
        formel: "U = 2 \\pi r",
        pi_hinweis: true,
        optionen: [
            { katex: "U = 4\\,370\\,880\\ \\mathrm{km}", korrekt: true },   // 2 · 3.14 · 696 000
            { katex: "U = 2\\,185\\,440\\ \\mathrm{km}" },                  // πr (Faktor 2 vergessen)
            { katex: "U = 1\\,392\\,000\\ \\mathrm{km}" },                  // 2r (π vergessen)
            { katex: "U = 6\\,556\\,320\\ \\mathrm{km}" },                  // 3πr (Faktor falsch)
        ],
        bei_richtig: {
            belohnung_text: "Correct! But this doesn't help you in the game — you solved this just for fun 😊",
        },
        // Beim Wieder-Klick (Aufgabe schon gelöst) wird statt "You've already solved this task."
        // dieser raumspezifische Text gezeigt — passt zum "for fun"-Spirit der Sonnen-Aufgabe.
        geloest_text: "You have just solved this for fun 😊",
    },
};

// Chain 6 — Sammel-Helper: legt einen Schlüsselteil bzw. den Leim ins LINKE Inventar.
// Wenn nach diesem Add alle vier Teile da sind, startet 5 s nach Auto-Close des
// Belohnungs-Overlays die Combine-Animation (kombiniereSchluessel). Der Delay gibt dem
// Spieler Zeit, die Belohnungs-Antwort zu lesen, bevor die Animation einsetzt.
function sammleSchluesselteil(id) {
    spielstand.linkesInventar.add(id);
    aktualisiereLinkesInventar();
    if (spielstand.linkesInventar.size === 4) {
        setTimeout(() => kombiniereSchluessel(), 5000);
    }
}

// Chain 6 — Combine-Animation: alle 4 Slots im linken Inventar bekommen .kombiniert
// (CSS-Glow + Pulse, ~2.8 s). Nach Animation: Set leeren, vereinter_schluessel ins rechte
// Inventar, Bestätigungs-Overlay.
function kombiniereSchluessel() {
    if (!inventarLinksEl) return;
    const slots = inventarLinksEl.querySelectorAll(".inventar-slot");
    slots.forEach(s => s.classList.add("kombiniert"));
    setTimeout(() => {
        spielstand.linkesInventar.clear();
        spielstand.gegenstaende.add("vereinter_schluessel");
        aktualisiereLinkesInventar();
        aktualisiereInventar();
        zeigeOverlayText("The three key fragments and the glue fuse into one complete key.\nIt's now in your inventory.");
        automatischSchliessen();
    }, 2800);
}
window.kombiniereSchluessel = kombiniereSchluessel;

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
        // Chain 6: plant_tulpe (vorne-links, fu=0.15, fv=0.12) — Klick öffnet Formel-Erkennungs-
        // Aufgabe (Umfang). Polygon deckt den sichtbaren Tulpen-Footprint (transform anchor 95.2,884
        // mit scale 0.30 → 154 × 154 px nach oben). laufziel knapp daneben, ausserhalb des
        // tulpe-Hindernisses (HINDERNISSE.haupt[2]: fu=-0.01..0.08, fv=0.02..0.18).
        {
            id: "chain_6_tulpe",
            polygon: [[20, 720], [175, 720], [175, 880], [20, 880]],
            laufziel: { fu: 0.13, fv: 0.04 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.linkesInventar.has("schluesselteil_3"),
            aufgabe: "chain_6_umfang",
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
                    // Schlüssel verbrauchen UND Aufgabe chain_1_schloss öffnen.
                    // Das Öffnen des Schranks (oeffneCupboard1) erfolgt erst in der
                    // bei_richtig.callback der Aufgabe — so kann der Schrank nicht
                    // ohne richtige Antwort aufgehen.
                    verbrauche("schluessel_buero");
                    aktualisiereInventar();
                    zeigeAufgabe("chain_1_schloss");
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
                automatischSchliessen();
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
        // Chain 6: oberstes Regal-Tablar im bookshelf_2, links — die 5 stehenden Bücher dort.
        // bookshelf_2 sitzt bei x=530 y=125 width=550 height=550 (viewBox 0..500). Skala-x=1.1,
        // Skala-y=1.1. Asset-Bücher in Tablar 1 stehen bei viewBox y≈62..117, links bei x≈110..189.
        // → Screen-Bbox ca. (651, 193) bis (738, 254). Polygon mit Klick-Reserve drumherum.
        // laufziel vor der hinteren Wand, ausserhalb des bookshelf_2-Hindernisses (fv 0.90..1.00).
        {
            id: "chain_6_buecher",
            polygon: [[640, 188], [745, 188], [745, 260], [640, 260]],
            laufziel: { fu: 0.42, fv: 0.65 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.linkesInventar.has("schluesselteil_2"),
            aufgabe: "chain_6_bogen",
        },
        // Chain 5: 3 klickbare Kreise im Bürobild (gelb, rot, violett) an der linken Wand.
        // Polygone werden in initChain5Polygone() nach Definition von BUERO_BILD gesetzt
        // (BUERO_BILD steht in der Datei NACH OBJEKTE — daher kein Inline-Lookup hier).
        // aktiv-Predikat: Formelbuch gefunden, Aufgabe noch nicht gelöst, kein Replay aktiv.
        // Kein laufziel → Klick togglet sofort, Figur bleibt stehen (analog Toiletten-Klick).
        {
            id: "bild_kreis_yellow_klick",
            polygon: [[0,0], [0,0], [0,0], [0,0]],   // Wird in initChain5Polygone() befüllt.
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.zustaende.bild_kreise_geloest
                       && !s.zustaende.bild_kreise_replay_aktiv,
            aktion: () => kreisGedrueckt("yellow"),
        },
        {
            id: "bild_kreis_red_klick",
            polygon: [[0,0], [0,0], [0,0], [0,0]],
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.zustaende.bild_kreise_geloest
                       && !s.zustaende.bild_kreise_replay_aktiv,
            aktion: () => kreisGedrueckt("red"),
        },
        {
            id: "bild_kreis_violet_klick",
            polygon: [[0,0], [0,0], [0,0], [0,0]],
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.zustaende.bild_kreise_geloest
                       && !s.zustaende.bild_kreise_replay_aktiv,
            aktion: () => kreisGedrueckt("violet"),
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
            // laufziel links vor desk_4. Frühere Position (0.86, 0.55) liegt seit Umbau des
            // toilet_1+cupboard_2-Hindernisses (jetzt bis ans Wand-fv=0 hochgezogen) IM Polygon.
            // (0.72, 0.40) hat ~95 px Clearance zur Polygon-Kante (Kante bei fv=0.40 ≈ fu 0.795).
            laufziel: { fu: 0.72, fv: 0.40 },
            aufnehmen: "animal_3_1",
            aktiv: (s) => s.zustaende.formelbuch_gefunden && (s.zustaende.chain_2_step ?? 0) === 0,
        },
        // Chain 6: mittlere Schublade von desk_4 — Klick öffnet Formel-Erkennungs-Aufgabe
        // (Kreisfläche). desk_4 sitzt x=1200 y=520 width=310 height=360 (viewBox 0..369.06,441).
        // Schublade-Front-Reihe Mitte liegt im viewBox y≈151..246 → Screen y ≈ 643..721,
        // x in viewBox 53..266 → Screen x ≈ 1245..1423. laufziel synchron mit animal_3_1 (links vor desk_4).
        {
            id: "chain_6_schublade",
            polygon: [[1245, 645], [1423, 645], [1423, 720], [1245, 720]],
            laufziel: { fu: 0.72, fv: 0.40 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.linkesInventar.has("leim"),
            aufgabe: "chain_6_flaeche",
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
                    automatischSchliessen();
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
                    automatischSchliessen();
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
            // (0.74, 0.32): ~75 px Clearance zur Kante des erweiterten toilet_1+cupboard_2-
            // Hindernisses (Kante bei fv=0.32 ≈ fu 0.787). Frühere (0.78, 0.32) lag praktisch
            // auf der Kante (~11 px) und triggerte das Snap-Verhalten.
            laufziel: { fu: 0.74, fv: 0.32 },
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
        // Bonus-Aufgabe: Klick auf die Sonne (gemalt auf Canvas: cx=1200 cy=200 r=42,
        // Strahlen bis r+44=86). Polygon-Bbox grob (1114..1286, 114..286). Nicht spiel-
        // entscheidend — bei richtiger Antwort kommt nur ein "for fun"-Belohnungstext.
        {
            id: "sonne_klick",
            polygon: [[1114, 114], [1286, 114], [1286, 286], [1114, 286]],
            laufziel: { fu: 0.85, fv: 0.30 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden,
            aufgabe: "bonus_sonne",
        },
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
                automatischSchliessen();
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
                    automatischSchliessen();
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
                    automatischSchliessen();
                },
            },
        },
        // Chain 7: Drop-Target in der Gartenmitte für Schaufel + Pickel.
        // Reihenfolge egal — beim ersten Drop wird das Werkzeug verbraucht und ein
        // kurzer Hinweis gezeigt; beim zweiten Drop öffnet sich das Loch (chain_7_grab
        // wird via aktualisiereChain7 sichtbar). Polygon grosszügig (480×140) deckt den
        // ganzen späteren Erdwall + Komfortzone ab — keine Kollision mit anderen
        // Garten-OBJEKTen (Wolke/Vogel oben, Schlauch rechts, flower_1 vorne-links).
        // laufziel vor dem Loch (fv niedrig = nahe Kamera) — sonst würde die Figur
        // beim Drop direkt im Loch-Bereich landen, der nach Aktivierung Hindernis wird.
        {
            id: "gartenmitte_grab",
            polygon: [[560, 660], [1040, 660], [1040, 800], [560, 800]],
            laufziel: { fu: 0.50, fv: 0.30 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && (s.gegenstaende.has("schaufel") || s.gegenstaende.has("pickel"))
                       && !s.zustaende.chain_7_loch_offen,
            akzeptiert: {
                schaufel: (s) => oeffneGrab("schaufel"),
                pickel:   (s) => oeffneGrab("pickel"),
            },
        },
        // Chain 7: Schatztruhe im offenen Loch — Drop-Target für vereinter_schluessel.
        // Polygon grosszügig (280×130) um den sichtbaren Truhen-Bereich (chest_1 image
        // x=700 y=690 200×89) — leichter zu treffen beim Drag.
        // laufziel davor (gleicher Bereich wie gartenmitte_grab — Hindernis blockiert
        // nicht die Annäherung, nur das Reinlaufen ins Loch).
        {
            id: "chest_1",
            polygon: [[660, 670], [940, 670], [940, 800], [660, 800]],
            laufziel: { fu: 0.50, fv: 0.30 },
            aktiv: (s) => s.zustaende.chain_7_loch_offen
                       && !s.zustaende.chain_7_geoeffnet
                       && s.gegenstaende.has("vereinter_schluessel"),
            akzeptiert: {
                vereinter_schluessel: (s) => {
                    if (s.zustaende.chain_7_geoeffnet) return;
                    verbrauche("vereinter_schluessel");
                    s.zustaende.chain_7_geoeffnet = true;
                    aktualisiereInventar();
                    // Sicherheitshalber laufenden Drag aufräumen, falls noch aktiv.
                    if (typeof dragAbbrechen === "function") dragAbbrechen();
                    zeigeSiegOverlay();
                },
            },
        },
    ],
    keller: [
        // Chain 6: animal_1 an der hinteren Wand — Klick auf das Tier öffnet Formel-Erkennungs-
        // Aufgabe (Kreissektor). animal_1 sitzt bei x=474 y=215 width=140 height=175 → Polygon
        // (474, 215) bis (614, 390). laufziel davor auf dem Boden, ausserhalb des Ketten-Hindernisses
        // (HINDERNISSE.keller[2] bbox ≈ fu 0.12..0.47, fv 0..0.48).
        {
            id: "chain_6_animal_1",
            polygon: [[474, 215], [614, 215], [614, 390], [474, 390]],
            laufziel: { fu: 0.30, fv: 0.55 },
            aktiv: (s) => s.zustaende.formelbuch_gefunden
                       && !s.linkesInventar.has("schluesselteil_1"),
            aufgabe: "chain_6_sektor",
        },
        // Chain 4, Schritt 2: Drop-Target für duck_1 — beide Ketten + die Lücke dazwischen.
        // chain_2 (x=280..560) + chain_1 (x=540..740), beide y=770..880. Polygon umschliesst beide.
        // Nach dem Drop wird duck_1_keller (DOM-VOR den Ketten in index.html) sichtbar — Ketten
        // überdecken die Ente visuell ("in den Ketten gefangen").
        // WICHTIG: VOR duck_1_keller platziert, damit der Drop-Bereich für muffin_1 später greift.
        {
            id: "ketten_drop",
            polygon: [[280, 770], [740, 770], [740, 880], [280, 880]],
            // laufziel HINTER den Ketten (HINDERNISSE.keller[2] bbox ≈ fu 0.12..0.47,
            // fv 0..0.48) — sonst läuft die Figur in das Hindernis-Polygon und der
            // Slide-Algorithmus pendelt. Vom Eingang (fu 0.12, fv 0.45) ist (0.55, 0.55) frei.
            laufziel: { fu: 0.55, fv: 0.55 },
            aktiv: (s) => s.gegenstaende.has("duck_1") && !s.zustaende.duck_im_keller,
            akzeptiert: {
                duck_1: (s) => {
                    verbrauche("duck_1");
                    spielstand.zustaende.duck_im_keller = true;
                    aktualisiereInventar();
                    aktualisiereChain4();
                    draw();
                    zeigeOverlayText("You lay the rubber duck between the two chains.\nIt seems trapped.");
                    automatischSchliessen();
                },
            },
        },
        // Chain 5: painting_2 (an der hinteren Wand, zwischen Kamin-Top und Wand-Top) ist
        // Drop-Target für drei_kreise. Polygon = bbox des <image href="painting_2.png">
        // (x=950 y=300 130×194). Nach Drop: Overlay sichtbar, Skelett lacht 2 s, dann
        // 2 s später spawnt der Pickel. Kein Klick-Hinweis ohne Item — Klick ohne Item fällt durch.
        {
            id: "painting_2",
            polygon: [[950, 300], [1080, 300], [1080, 494], [950, 494]],
            laufziel: { fu: 0.50, fv: 0.55 },
            // Cursor:pointer nur, wenn drei_kreise zum Drop bereit sind.
            aktiv: (s) => s.gegenstaende.has("drei_kreise") && !s.zustaende.bild_kreise_im_keller,
            akzeptiert: {
                drei_kreise: (s) => {
                    if (s.zustaende.bild_kreise_im_keller) return;
                    verbrauche("drei_kreise");
                    s.zustaende.bild_kreise_im_keller = true;
                    s.zustaende.chain_5_step = 4;   // direkt auf "Pickel im Inventar" — kein extra Aufnehm-Schritt mehr
                    s.gegenstaende.add("pickel");
                    aktualisiereInventar();
                    aktualisiereChain5();
                    skelettLachen();
                    zeigeOverlayText("The three circles slip onto the painting and complete it.\nThe skeleton bursts into laughter and gives you a pickaxe as thanks.");
                    automatischSchliessen();
                },
            },
        },
        // Chain 4, Schritt 3: duck_1_keller selbst als Drop-Target für muffin_1.
        // Polygon entspricht der Ente-Bbox (50×55), grosszügig erweitert für komfortablen Drop.
        // Bei Drop: Ente skaliert auf 2× via CSS-Klasse + Burp-Sound + Messgerät ins Inventar.
        {
            id: "duck_1_keller",
            // Polygon = aktuelle Bbox der duck_1_keller-SVG (x=400 y=750 width=100 height=110)
            // — initial 2.5× so gross wie in der Wanne, sitzt zwischen chain_2 und chain_1.
            polygon: [[400, 750], [500, 750], [500, 860], [400, 860]],
            // laufziel synchron mit ketten_drop hinter den Ketten (siehe Kommentar dort).
            laufziel: { fu: 0.55, fv: 0.55 },
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
                    automatischSchliessen();
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
        // Pro-Aufgabe individueller Text via `geloest_text` (sonst Standard).
        info.textContent = a.geloest_text || "You've already solved this task.";
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

    // Optionen pro Aufgaben-Öffnung neu mischen (Fisher–Yates auf einer flachen
    // Kopie). So steht die richtige Antwort nicht immer an derselben Stelle. Der
    // Klick-Handler bekommt das Option-Objekt direkt, nicht mehr den Index — die
    // ursprüngliche Reihenfolge in AUFGABEN[id].optionen bleibt unverändert.
    const gemischt = a.optionen.slice();
    for (let i = gemischt.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
    }

    gemischt.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "aufgabe-mc-option";

        if (opt.katex && typeof katex !== "undefined") {
            const span = document.createElement("span");
            katex.render(opt.katex, span, { throwOnError: false, displayMode: false });
            btn.appendChild(span);
        } else {
            btn.textContent = opt.label || opt.katex || "";
        }

        btn.addEventListener("click", () => pruefeMultipleChoice(id, opt, btn, liste, feedback));
        liste.appendChild(btn);
    });

    overlayInhaltEl.append(liste, feedback);
}

function pruefeMultipleChoice(id, opt, btnGedrueckt, liste, feedbackEl) {
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

    speicherSpielstand();
    draw();
    automatischSchliessen();
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
    speicherSpielstand();
    draw();
}

// ---------- Hindernisse (Kollision) ----------
// Drei Hindernis-Typen im fu/fv-System (0..1):
//   • Kreis:    { fu, fv, r }                      — runde/kompakte Objekte (Pflanzen, Octopus)
//   • Ellipse:  { fu, fv, rx, ry }                 — flache/breite Objekte (Tisch1, Kamin)
//   • Viereck:  { punkte: [[fu,fv], ...] }         — konvexes Polygon, ideal für rechteckige
//                                                     Möbel mit gerader Kante (z.B. Schrank).
// Konvex bedeutet: alle Innenwinkel < 180°. 4 Punkte sind üblich, 3+ funktionieren.
// Werte lassen sich live in der Konsole ändern:  HINDERNISSE.haupt[0].r = 0.08
// Alle Hindernisse als Splines — interaktiv editierbar per hindernisDebug(true).
// Kreise/Ellipsen wurden als 6-Eck-Approximation konvertiert, Vierecke 1:1 übernommen.
// Vertices können per Drag justiert, per Doppelklick auf Kurve eingefügt,
// per Rechtsklick gelöscht werden. Handles: Doppelklick → Reset (gerade Kante),
// Rechtsklick → löschen.
const HINDERNISSE = {
    haupt: [
        { spline: [                                   // [0] yucca + Tisch 1 (zusammengefasst)
            { fu: 0.0653, fv: 0.7537, hIn: { du: -0.024, dv: -0.0281 } },
            { fu: 0.065, fv: 0.8662, hIn: { du: 0.0215, dv: -0.0861 }, hOut: { du: 0.0184, dv: 0.0286 } },
            { fu: 0.1665, fv: 0.87, hIn: { du: -0.0458, dv: 0.0025 }, hOut: { du: 0.0168, dv: 0.0403 } },
            { fu: 0.1664, fv: 0.9997 },
            { fu: 0.0027, fv: 0.996 },
            { fu: 0.0001, fv: 0.7668, hOut: { du: 0.0235, dv: -0.0078 } },
        ] },
        { spline: [                                   // [1] blume
            { fu: 0.9998, fv: 0.3292, hOut: { du: -0.0245, dv: -0.0186 } },
            { fu: 0.9402, fv: 0.2582, hIn: { du: 0.0281, dv: 0.07 }, hOut: { du: -0.0127, dv: -0.1306 } },
            { fu: 0.9452, fv: 0.0875, hIn: { du: -0.01, dv: 0.0316 }, hOut: { du: 0.0148, dv: -0.0058 } },
            { fu: 0.9995, fv: 0.1302, hIn: { du: -0.0302, dv: 0.004 }, hOut: { du: 0.0019, dv: 0.0629 } },
        ] },
        { spline: [                                   // [2] tulpe
            { fu: 0.0618, fv: 0.1594, hIn: { du: 0.0235, dv: -0.055 }, hOut: { du: -0.0308, dv: 0.0469 } },
            { fu: 0.0003, fv: 0.1737, hIn: { du: 0.0106, dv: 0.0461 }, hOut: { du: -0.018, dv: -0.024 } },
            { fu: 0.0015, fv: 0.0006 },
            { fu: 0.0928, fv: 0.0006, hIn: { du: -0.0198, dv: -0.0099 }, hOut: { du: -0.0217, dv: 0.0771 } },
        ] },
        { spline: [                                   // [3] desk_3
            { fu: 0.3796, fv: 0.7957, hIn: { du: 0.0281, dv: 0.0654 }, hOut: { du: 0.0119, dv: -0.0633 } },
            { fu: 0.4905, fv: 0.668, hIn: { du: -0.0464, dv: 0.0271 }, hOut: { du: 0.0197, dv: -0.0026 } },
            { fu: 0.5695, fv: 0.7678, hIn: { du: -0.0246, dv: -0.0923 }, hOut: { du: -0.0284, dv: 0.0543 } },
            { fu: 0.4711, fv: 0.8365, hIn: { du: 0.0407, dv: 0.0014 }, hOut: { du: -0.0413, dv: 0.0183 } },
        ] },
        { spline: [                                   // [4] desk_5
            { fu: 0.9019, fv: 0.6313, hIn: { du: -0.017, dv: 0.0172 }, hOut: { du: 0.0291, dv: -0.0162 } },
            { fu: 0.9995, fv: 0.6512, hIn: { du: -0.0351, dv: 0.0106 } },
            { fu: 0.9996, fv: 0.8235, hOut: { du: -0.0474, dv: -0.0465 } },
            { fu: 0.8718, fv: 0.7819, hIn: { du: 0.0473, dv: 0.0561 }, hOut: { du: -0.0128, dv: -0.1222 } },
        ] },
        { spline: [                                   // [5] cupboard_3
            { fu: 0.8211, fv: 0.9021, hIn: { du: -0.007, dv: 0.048 }, hOut: { du: 0.0359, dv: -0.0191 } },
            { fu: 0.9998, fv: 0.909, hIn: { du: -0.0437, dv: 0.0247 } },
            { fu: 0.9979, fv: 0.9982 },
            { fu: 0.8287, fv: 0.9998 },
        ] },
    ],
    buero: [
        { spline: [                                   // [0] Tisch 2 + bookshelf_2 (zusammengefasst)
            { fu: 0.3749, fv: 0.8316, hIn: { du: -0.0243, dv: -0.1208 }, hOut: { du: 0.032, dv: 0.0446 } },
            { fu: 0.6222, fv: 0.85, hIn: { du: -0.0934, dv: -0.0091 }, hOut: { du: 0.0761, dv: 0.0279 } },
            { fu: 0.705, fv: 0.9996, hIn: { du: -0.0329, dv: -0.1202 } },
            { fu: 0.0006, fv: 0.9974 },
            { fu: 0.0008, fv: 0.728, hOut: { du: 0.036, dv: -0.0009 } },
            { fu: 0.1428, fv: 0.5854, hIn: { du: -0.0528, dv: 0.0225 }, hOut: { du: 0.0337, dv: 0.0332 } },
            { fu: 0.2, fv: 0.6965, hIn: { du: -0.0259, dv: -0.0023 }, hOut: { du: 0.0319, dv: 0.0028 } },
            { fu: 0.3117, fv: 0.6389, hIn: { du: -0.027, dv: -0.0073 }, hOut: { du: 0.0403, dv: 0.0462 } },
        ] },
        { spline: [                                   // [1] cupboard_1
            { fu: 0.717, fv: 0.8746, hIn: { du: -0.0078, dv: 0.0642 }, hOut: { du: 0.0426, dv: -0.0488 } },
            { fu: 0.9318, fv: 0.7571, hIn: { du: -0.0653, dv: 0.0249 } },
            { fu: 0.9992, fv: 0.8498, hIn: { du: -0.0363, dv: -0.0528 } },
            { fu: 0.9997, fv: 0.9806 },
            { fu: 0.7267, fv: 0.9978, hOut: { du: 0.0007, dv: -0.0932 } },
        ] },
        { spline: [                                   // [2] lamp_1
            { fu: 0.0989, fv: 0.2869, hIn: { du: 0.0198, dv: -0.1193 }, hOut: { du: -0.0453, dv: 0.031 } },
            { fu: 0.0004, fv: 0.4762, hIn: { du: 0.0175, dv: -0.0756 } },
            { fu: 0.0004, fv: 0.1186, hOut: { du: 0.0191, dv: 0.0189 } },
            { fu: 0.0863, fv: 0.0912, hIn: { du: -0.0231, dv: -0.0082 }, hOut: { du: 0.0224, dv: 0.0306 } },
        ] },
    ],
    badezimmer: [
        { spline: [                                   // [0] bathtub
            { fu: 0.303, fv: 0.9988, hIn: { du: -0.0152, dv: -0.0721 } },
            { fu: 0.002, fv: 0.9956 },
            { fu: 0.0001, fv: 0.8464, hOut: { du: 0.0328, dv: 0.0259 } },
            { fu: 0.2298, fv: 0.8165, hIn: { du: -0.0767, dv: -0.0061 }, hOut: { du: 0.086, dv: 0.0006 } },
        ] },
        { spline: [                                   // [1] toilet_1 (octopus-Seite) + cupboard_2 zusammengefasst
            { fu: 0.7524, fv: 0.0013, hIn: { du: 0.0215, dv: 0.1798 }, hOut: { du: -0.0151, dv: -0.182 } },
            { fu: 0.9999, fv: 0.0012 },
            { fu: 0.9998, fv: 1 },
            { fu: 0.482, fv: 0.9999, hOut: { du: 0.0064, dv: -0.0513 } },
            { fu: 0.4916, fv: 0.8294, hIn: { du: -0.0121, dv: 0.0696 }, hOut: { du: 0.0349, dv: -0.0604 } },
            { fu: 0.5821, fv: 0.8203, hIn: { du: -0.0516, dv: 0.0452 } },
            { fu: 0.7171, fv: 0.6461, hIn: { du: -0.0812, dv: 0.0172 }, hOut: { du: 0.0394, dv: -0.0914 } },
            { fu: 0.7999, fv: 0.5221, hOut: { du: 0.0066, dv: -0.0642 } },
        ] },
        { spline: [                                   // [2] toilet_2
            { fu: 0.4593, fv: 0.9976, hIn: { du: -0.0121, dv: -0.058 } },
            { fu: 0.3432, fv: 0.9993, hOut: { du: 0.0229, dv: -0.0649 } },
            { fu: 0.3773, fv: 0.7844, hIn: { du: -0.0197, dv: 0.0778 }, hOut: { du: 0.0301, dv: -0.0454 } },
            { fu: 0.4453, fv: 0.7985, hIn: { du: -0.0276, dv: -0.0451 }, hOut: { du: 0.016, dv: 0.078 } },
        ] },
    ],
    garten: [
        { spline: [                                   // [0] flower_1
            { fu: 0.1216, fv: 0.9999, hIn: { du: -0.0118, dv: -0.0341 } },
            { fu: 0.0012, fv: 0.9957 },
            { fu: 0.0004, fv: 0.8689, hOut: { du: 0.0312, dv: 0.0181 } },
            { fu: 0.1124, fv: 0.8859, hIn: { du: -0.0163, dv: -0.0296 }, hOut: { du: 0.0305, dv: 0.005 } },
        ] },
    ],
    keller: [
        { spline: [                                   // [0] Kamin (fireplace_1)
            { fu: 0.1664, fv: 0.7953, hIn: { du: -0.0302, dv: 0.0784 }, hOut: { du: 0.0365, dv: -0.0248 } },
            { fu: 0.5289, fv: 0.8242, hIn: { du: -0.042, dv: -0.0342 }, hOut: { du: 0.0069, dv: 0.0777 } },
            { fu: 0.5175, fv: 0.9992 },
            { fu: 0.1242, fv: 0.9998, hIn: { du: 0.0222, dv: -0.0093 } },
        ] },
        { spline: [                                   // [1] Kerzen-Cluster (rechts, vorne+hinten zusammengefasst)
            { fu: 0.9995, fv: 0.7179, hOut: { du: 0.01, dv: 0.1808 } },
            { fu: 0.9994, fv: 0.9997, hIn: { du: -0.0005, dv: -0.1834 } },
            { fu: 0.6359, fv: 0.9983, hIn: { du: 0.0454, dv: 0.0002 }, hOut: { du: -0.0321, dv: -0.0766 } },
            { fu: 0.6056, fv: 0.6251, hIn: { du: -0.0666, dv: 0.1809 }, hOut: { du: 0.06, dv: -0.0238 } },
            { fu: 0.6765, fv: 0.7346 },
            { fu: 0.7538, fv: 0.7615, hIn: { du: -0.0268, dv: 0.042 }, hOut: { du: -0.0063, dv: -0.1087 } },
            { fu: 0.7895, fv: 0.6597, hIn: { du: -0.0069, dv: 0.061 }, hOut: { du: -0.0108, dv: -0.1999 } },
            { fu: 0.909, fv: 0.6596, hIn: { du: -0.0124, dv: -0.1095 }, hOut: { du: 0.0484, dv: 0.015 } },
        ] },
        { spline: [                                   // [2] Ketten (chain_1/chain_2 Boden)
            { fu: 0.1722, fv: 0.0013 },
            { fu: 0.4557, fv: 0.0024, hOut: { du: 0.0486, dv: 0.2323 } },
            { fu: 0.4173, fv: 0.3889, hIn: { du: 0.0224, dv: -0.031 }, hOut: { du: -0.038, dv: -0.0858 } },
            { fu: 0.3301, fv: 0.4803, hIn: { du: 0.0519, dv: 0.0196 }, hOut: { du: -0.0457, dv: -0.1177 } },
            { fu: 0.1487, fv: 0.4164, hIn: { du: 0.0837, dv: -0.104 }, hOut: { du: -0.0184, dv: 0.0069 } },
            { fu: 0.1207, fv: 0.3498, hIn: { du: 0.003, dv: 0.0521 }, hOut: { du: 0.0239, dv: -0.228 } },
        ] },
    ],
};
window.HINDERNISSE = HINDERNISSE;

// ---------- Spline-Hindernisse: kubische Bezier-Kette entlang Vertex-Liste ----------
// Datenformat: { spline: [{ fu, fv, hIn?: {du, dv}, hOut?: {du, dv} }, ...] }
// Edge i geht von vertex[i] zu vertex[(i+1) % n], mit Kontrollpunkten:
//   p0 = vertex[i],  p1 = vertex[i] + (hOut ?? 0),
//   p2 = vertex[i+1] + (hIn ?? 0),  p3 = vertex[i+1].
// Fehlende Handles ⇒ degenerierter Cubic = effektiv gerade Linie. Handles sind nicht
// symmetrisch (zwei unabhängige Tangenten — Knicke an Vertices erlaubt).
//
// Für Kollisions-Tests wird der Spline mit N=16 Samples pro Edge in eine Polyline
// subdiviert (`splinePoly(h)`, gecached auf `h._cachedPoly`). Punkt-in-Polygon nutzt
// Ray-Casting (allgemein, auch nicht-konvex), Slide-Closest-Edge projiziert auf die
// Polyline-Segmente — analog zu Vierecken.
const SPLINE_N = 16;

function splineEdgeKontrollen(h, i) {
    const v0 = h.spline[i];
    const v1 = h.spline[(i + 1) % h.spline.length];
    const out = v0.hOut || { du: 0, dv: 0 };
    const inn = v1.hIn  || { du: 0, dv: 0 };
    return {
        p0fu: v0.fu, p0fv: v0.fv,
        p1fu: v0.fu + out.du, p1fv: v0.fv + out.dv,
        p2fu: v1.fu + inn.du, p2fv: v1.fv + inn.dv,
        p3fu: v1.fu, p3fv: v1.fv,
    };
}

function cubicBezier(t, p0fu, p0fv, p1fu, p1fv, p2fu, p2fv, p3fu, p3fv) {
    const u = 1 - t;
    const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
    return [
        w0 * p0fu + w1 * p1fu + w2 * p2fu + w3 * p3fu,
        w0 * p0fv + w1 * p1fv + w2 * p2fv + w3 * p3fv,
    ];
}

function splinePoly(h) {
    if (h._cachedPoly) return h._cachedPoly;
    const poly = [];
    for (let i = 0; i < h.spline.length; i++) {
        const c = splineEdgeKontrollen(h, i);
        for (let s = 0; s < SPLINE_N; s++) {
            const t = s / SPLINE_N;
            poly.push(cubicBezier(t, c.p0fu, c.p0fv, c.p1fu, c.p1fv, c.p2fu, c.p2fv, c.p3fu, c.p3fv));
        }
    }
    h._cachedPoly = poly;
    return poly;
}

function invalidateSplineCache(h) {
    delete h._cachedPoly;
}

// Default-Position für ein Handle, wenn hIn/hOut unset ist — gibt dem User einen
// sichtbaren Anfasser entlang der Sehne zum Nachbar-Vertex (sonst überlappt der
// Handle-Marker mit dem Vertex-Marker). Drag setzt hIn/hOut auf den realen Offset.
function splineHandleDefault(h, vIdx, hand) {
    const n = h.spline.length;
    const v = h.spline[vIdx];
    const neighbor = (hand === "hIn")
        ? h.spline[(vIdx - 1 + n) % n]
        : h.spline[(vIdx + 1) % n];
    const dx = neighbor.fu - v.fu;
    const dy = neighbor.fv - v.fv;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(0.05, len * 0.3);
    return { du: (dx / len) * k, dv: (dy / len) * k };
}

// Welt-Position des Handles. Wenn hIn/hOut gesetzt: Vertex + offset.
// Wenn nicht gesetzt: Vertex + Default-Offset (für sichtbaren, greifbaren Anfasser).
function splineHandleWelt(h, vIdx, hand) {
    const v = h.spline[vIdx];
    const off = v[hand] || splineHandleDefault(h, vIdx, hand);
    return { fu: v.fu + off.du, fv: v.fv + off.dv };
}

// De-Casteljau-Split einer Cubic Bezier bei Parameter t. Liefert die Zwischenpunkte
// für beide Halb-Cubics (kurvenform-erhaltend). Wird beim Vertex-Einfügen via
// Doppelklick auf die Kurve genutzt.
function teilenCubic(t, P0, P1, P2, P3) {
    const lerp = (a, b) => [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t];
    const Q0 = lerp(P0, P1);
    const Q1 = lerp(P1, P2);
    const Q2 = lerp(P2, P3);
    const R0 = [Q0[0] * (1 - t) + Q1[0] * t, Q0[1] * (1 - t) + Q1[1] * t];
    const R1 = [Q1[0] * (1 - t) + Q2[0] * t, Q1[1] * (1 - t) + Q2[1] * t];
    const S  = [R0[0] * (1 - t) + R1[0] * t, R0[1] * (1 - t) + R1[1] * t];
    return { Q0, Q2, R0, R1, S };
}

function splineEinfuegen(h, edge, t) {
    const c = splineEdgeKontrollen(h, edge);
    const P0 = [c.p0fu, c.p0fv];
    const P1 = [c.p1fu, c.p1fv];
    const P2 = [c.p2fu, c.p2fv];
    const P3 = [c.p3fu, c.p3fv];
    const sp = teilenCubic(t, P0, P1, P2, P3);
    const r4 = (n) => +n.toFixed(4);
    const v0 = h.spline[edge];
    const v1 = h.spline[(edge + 1) % h.spline.length];
    // Vertex v0's hOut: war P1, ist jetzt Q0 (links vom Split)
    v0.hOut = { du: r4(sp.Q0[0] - v0.fu), dv: r4(sp.Q0[1] - v0.fv) };
    // Vertex v1's hIn: war P2, ist jetzt Q2 (rechts vom Split)
    v1.hIn  = { du: r4(sp.Q2[0] - v1.fu), dv: r4(sp.Q2[1] - v1.fv) };
    // Neuer Vertex S, mit hIn=R0-S, hOut=R1-S
    const newV = {
        fu: r4(sp.S[0]),
        fv: r4(sp.S[1]),
        hIn:  { du: r4(sp.R0[0] - sp.S[0]), dv: r4(sp.R0[1] - sp.S[1]) },
        hOut: { du: r4(sp.R1[0] - sp.S[0]), dv: r4(sp.R1[1] - sp.S[1]) },
    };
    h.spline.splice(edge + 1, 0, newV);
    invalidateSplineCache(h);
}

function splineLoescheVertex(h, vIdx) {
    if (h.spline.length <= 3) {
        console.warn("Spline braucht ≥3 Vertices — Löschen abgewiesen.");
        return false;
    }
    h.spline.splice(vIdx, 1);
    invalidateSplineCache(h);
    return true;
}

function splineLoescheHandle(h, vIdx, hand) {
    const v = h.spline[vIdx];
    if (v[hand]) {
        delete v[hand];
        invalidateSplineCache(h);
    }
}

// ---------- Form-Helper: Type-Dispatch zwischen Kreis/Ellipse/Viereck/Spline ----------
// Center (Schwerpunkt) eines Hindernisses — für Slide-Algorithmus (Distanz-Suche).
function hindernisCenter(h) {
    if (h.spline) {
        const poly = splinePoly(h);
        let fu = 0, fv = 0;
        for (const p of poly) { fu += p[0]; fv += p[1]; }
        return { fu: fu / poly.length, fv: fv / poly.length };
    }
    if (h.punkte) {
        let fu = 0, fv = 0;
        for (const p of h.punkte) { fu += p[0]; fv += p[1]; }
        return { fu: fu / h.punkte.length, fv: fv / h.punkte.length };
    }
    return { fu: h.fu, fv: h.fv };
}

// Konservativer Maximal-Radius (vom Center) — für Pre-Filter im Slide-Algorithmus.
function hindernisMaxRadius(h) {
    if (h.spline) {
        const poly = splinePoly(h);
        const c = hindernisCenter(h);
        let max = 0;
        for (const p of poly) {
            const d = Math.hypot(p[0] - c.fu, p[1] - c.fv);
            if (d > max) max = d;
        }
        return max;
    }
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

// Allgemeiner Punkt-in-Polygon-Test (Ray-Casting). Funktioniert auch für nicht-konvexe
// Polygone (Spline-Polylines können konkav sein), im Gegensatz zu pktInKonvexPolygon.
function pktInPolygonAllgemein(fu, fv, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        if (((yi > fv) !== (yj > fv)) &&
            (fu < (xj - xi) * (fv - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// Test: Liegt (fu, fv) IM Hindernis (innerhalb der Form, nicht auf der Grenze)?
function istInForm(h, fu, fv) {
    if (h.spline) return pktInPolygonAllgemein(fu, fv, splinePoly(h));
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
    if (h.spline) {
        // Polyline-Subdivision suchen: closest segment via projektionAufKante.
        const poly = splinePoly(h);
        let bestPkt = null, bestKante = -1, bestDist = Infinity;
        for (let i = 0; i < poly.length; i++) {
            const j = (i + 1) % poly.length;
            const p = projektionAufKante(fu, fv, poly[i], poly[j]);
            const ddu = p.fu - fu, ddv = p.fv - fv;
            const d = ddu * ddu + ddv * ddv;
            if (d < bestDist) { bestDist = d; bestPkt = p; bestKante = i; }
        }
        const k1 = poly[bestKante];
        const k2 = poly[(bestKante + 1) % poly.length];
        const ex = k2[0] - k1[0], ey = k2[1] - k1[1];
        const elen = Math.sqrt(ex * ex + ey * ey) || 1;
        // Außen-Normale via Centroid-Richtung — bei nicht-konvexen Splines an
        // konkaven Stellen leicht ungenau, für Slide-Manöver praktisch ausreichend.
        const c = hindernisCenter(h);
        let nx = -ey / elen, ny = ex / elen;
        if ((bestPkt.fu - c.fu) * nx + (bestPkt.fv - c.fv) * ny < 0) { nx = -nx; ny = -ny; }
        return { fu: bestPkt.fu, fv: bestPkt.fv, nx, ny, kante: bestKante };
    }
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
// Pro Hindernis eine eindeutige Farbe (HSL) + Index-Beschriftung. Splines zeigen Vertex-
// und Handle-Marker mit "<hindernisIdx>.<vIdx>", per Drag justierbar; per Konsole z.B.:
// HINDERNISSE.buero[1].spline[0].fu = 0.72
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
        if (h.spline) {
            // Spline-Polyline rendern (matches Kollision exakt — beides nutzt splinePoly).
            const poly = splinePoly(h);
            ctx.beginPath();
            for (let i = 0; i < poly.length; i++) {
                const [x, y] = bodenPunkt(poly[i][0], poly[i][1]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Handle-Verbindungslinien (Vertex → Handle), gestrichelt.
            ctx.save();
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = punktBg;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < h.spline.length; i++) {
                const v = h.spline[i];
                const [vx, vy] = bodenPunkt(v.fu, v.fv);
                for (const hand of ["hIn", "hOut"]) {
                    const w = splineHandleWelt(h, i, hand);
                    const [hx, hy] = bodenPunkt(w.fu, w.fv);
                    ctx.beginPath();
                    ctx.moveTo(vx, vy);
                    ctx.lineTo(hx, hy);
                    ctx.stroke();
                }
            }
            ctx.restore();
            // Handle-Marker (Quadrate). Gefüllt = hIn/hOut gesetzt; hohl = Default-Position.
            const HSIZE = 7;
            for (let i = 0; i < h.spline.length; i++) {
                const v = h.spline[i];
                for (const hand of ["hIn", "hOut"]) {
                    const w = splineHandleWelt(h, i, hand);
                    const [hx, hy] = bodenPunkt(w.fu, w.fv);
                    const stored = !!v[hand];
                    ctx.fillStyle = stored ? punktBg : "rgba(255,255,255,0.85)";
                    ctx.strokeStyle = punktBg;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.rect(hx - HSIZE, hy - HSIZE, HSIZE * 2, HSIZE * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            }
            // Vertex-Marker (zuletzt → liegen oben), inkl. "<hidx>.<vIdx>"-Label.
            for (let i = 0; i < h.spline.length; i++) {
                const v = h.spline[i];
                const [vx, vy] = bodenPunkt(v.fu, v.fv);
                ctx.fillStyle = punktBg;
                ctx.beginPath();
                ctx.arc(vx, vy, 11, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.font = "bold 13px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(`${idx}.${i}`, vx, vy);
            }
        } else if (h.punkte) {
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

// DPR-Cap: deckelt window.devicePixelRatio. Default Infinity = kein Cap, Gerät entscheidet
// selbst (Retina-Mac/iPad: 2). Lever für später, falls auf älteren iPads der Garten/Keller
// einbricht — dann via setzeDprCap(1.5) in der Konsole testen, ob's hilft.
let dprCap = Infinity;
function setzeDprCap(n) {
    dprCap = n;
    resizeCanvas();
    console.log(`DPR-Cap = ${n} (effektiv ${Math.min(window.devicePixelRatio || 1, n)})`);
}
window.setzeDprCap = setzeDprCap;

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

    // Canvas-interne Auflösung (DPR-aware, gecappt) — beide Canvases
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
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
        // 3 davon (yellow/red/violet) sind in Chain 5 klickbar — IDs unten gesetzt;
        // violett wurde gegen das grosse Gelb verschoben, damit die Kreise sich nicht überlappen.
        { cu: 0.2225, cv: 0.5245, r: 0.075, farbe: "#E63946", id: "bild_kreis_red"    },  // rot, vorne unten — Chain 5
        { cu: 0.2975, cv: 0.6445, r: 0.075, farbe: "#1D9BF0" },                            // blau, vorne oben
        { cu: 0.4175, cv: 0.5845, r: 0.090, farbe: "#FFD43B", id: "bild_kreis_yellow" },  // gelb, mitte (gross) — Chain 5
        { cu: 0.5075, cv: 0.6595, r: 0.057, farbe: "#06D6A0" },                            // grün, hinten oben
        { cu: 0.5675, cv: 0.4825, r: 0.055, farbe: "#9B5DE5", id: "bild_kreis_violet" },  // violett, hinten oben — Chain 5 (verschoben gegen gelb)
        { cu: 0.3575, cv: 0.5095, r: 0.045, farbe: "#FF8A00" },                            // orange, klein vorne
    ],
};

// Chain 5 — die 3 OBJEKTE.buero-Klickpolygone für die farbigen Bürobild-Kreise befüllen.
// Polygon = wand-uv-Bbox (cu±r, cv±r) → linkeWandPunkt projiziert (perspektivisch korrekt).
// Wird einmalig nach Definition von BUERO_BILD aufgerufen, da OBJEKTE in der Datei weiter
// oben steht und BUERO_BILD beim OBJEKTE-Literal noch undefined wäre.
function initChain5Polygone() {
    ["yellow", "red", "violet"].forEach(farbe => {
        const k = BUERO_BILD.kreise.find(c => c.id === `bild_kreis_${farbe}`);
        const obj = OBJEKTE.buero.find(o => o.id === `bild_kreis_${farbe}_klick`);
        if (!k || !obj) return;
        obj.polygon = [
            linkeWandPunkt(k.cu - k.r, k.cv - k.r),
            linkeWandPunkt(k.cu + k.r, k.cv - k.r),
            linkeWandPunkt(k.cu + k.r, k.cv + k.r),
            linkeWandPunkt(k.cu - k.r, k.cv + k.r),
        ];
    });
}

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
        const attrs = {
            d: wandKreisPfad(k.cu, k.cv, k.r),
            fill: k.farbe,
            opacity: "0.92",
        };
        if (k.id) attrs.id = k.id;
        kreiseG.appendChild(makeSVG("path", attrs));
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
    initChain5Polygone();   // Klickpolygone der 3 Bürobild-Kreise nachträglich aus BUERO_BILD befüllen.
    klonePflanzenVorne();
}

// ---------- Tiefensortierung für Pflanzen ----------
// Klont alle [data-y-fuss]-Elemente in die Front-Ebene; siehe CLAUDE.md "Tiefensortierung".
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

// Cache der zuletzt zum Togglen verwendeten figur.fv. Solange die Figur sich
// nicht spürbar bewegt (z.B. steht), würden die display-Werte identisch ausfallen
// → Frame-Skip spart ~130 DOM-Reflows pro Frame (50 Kerzen + 15 Möbel × 2 Layer).
// Initial NaN, damit der erste Aufruf nach Page-Load garantiert durchläuft.
let letzteToggleFv = NaN;
function aktualisierePflanzenTiefe() {
    // Für alle Möbel/Pflanzen mit data-y-fuss im Rück- UND Front-Layer die Sichtbarkeit togglen.
    // Entscheidung: wer tiefer im Raum ist (grösseres fv), liegt weiter hinten → Figur liegt davor.
    // Sanitärobjekt-Switch: Elemente mit class="sanitar-aus" haben CSS `display:none !important`,
    // das die inline-display-Setzung hier überschreibt → Switch-Partner bleiben versteckt.
    if (Math.abs(figur.fv - letzteToggleFv) < 0.001) return;
    letzteToggleFv = figur.fv;
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
    // Settings (Sound/Musik) laden — separat vom Spielstand, übersteht Reset.
    ladeEinstellungen();
    // Spielstand aus localStorage laden (falls vorhanden) BEVOR wir DOM bauen.
    // ladeVorgang ist seit Module-Start true und sperrt redundante Saves während der
    // Aufbau-Kaskade. Am Ende ein expliziter Save, um den finalen Zustand
    // (z.B. mit gemergetem zustaende-Default) konsistent zu serialisieren.
    const geladen = ladeSpielstand();
    baueRaumDeko();
    if (geladen) {
        aktualisiereAllesNachLaden();
    } else {
        aktualisiereSanitaer();
        aktualisiereCupboard1();
        aktualisiereChain5();   // Sichtbarkeit von Bürobild-Kreisen / painting_2-Overlay / Pickel initial setzen (ruft auch aktualisiereChain7).
    }
    ladeVorgang = false;
    // Finaler Post-Load-Save NUR wenn ein Save existierte (für gemergete zustaende-Defaults
    // bei Versions-Upgrades). Bei frischem Start (z.B. nach "Start over"-Reset) NICHT speichern,
    // sonst würde der frische Default-State direkt ein neues localStorage-Entry anlegen, und
    // zeigeStartScreen würde fälschlich wieder den Continue-Button zeigen. Erste echte
    // Aktion im Spiel triggert ohnehin einen Save via aktualisiere*-Hook.
    if (geladen) speicherSpielstand();
    resizeCanvas();
    if (!loopGestartet) {
        loopGestartet = true;
        loop();
    }
    // Start-Overlay zeigen (Begrüssungsbildschirm). Wird über die Stage gelegt;
    // loop() läuft im Hintergrund weiter, der Overlay deckt alles ab. User-Klick
    // auf Continue / Begin / Start over fade-t den Overlay aus und gibt das Spiel frei.
    zeigeStartScreen();
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

// ---------- Eingabe ----------

function canvasZuLogisch(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return [
        (clientX - rect.left) * LOGICAL_WIDTH / rect.width,
        (clientY - rect.top) * LOGICAL_HEIGHT / rect.height,
    ];
}

// ---------- Raumwechsel mit Fade-Transition ----------

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
    const HANDLE_TREFFER = 10;
    const ROT_OFFSET = 0.025;
    // 1) Spline-Vertices (höchste Prio — größere Marker, aber oft mehrere dicht beieinander).
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (!h.spline) continue;
        for (let i = 0; i < h.spline.length; i++) {
            const v = h.spline[i];
            const [vx, vy] = bodenPunkt(v.fu, v.fv);
            if (Math.hypot(x - vx, y - vy) <= TREFFER) {
                return { hidx, splineKind: "vertex", splineVIdx: i, eckIdx: null, achse: null };
            }
        }
    }
    // 2) Spline-Handles (kleinere Marker, niedrigere Prio).
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (!h.spline) continue;
        for (let i = 0; i < h.spline.length; i++) {
            for (const hand of ["hIn", "hOut"]) {
                const w = splineHandleWelt(h, i, hand);
                const [hx, hy] = bodenPunkt(w.fu, w.fv);
                if (Math.hypot(x - hx, y - hy) <= HANDLE_TREFFER) {
                    return { hidx, splineKind: hand, splineVIdx: i, eckIdx: null, achse: null };
                }
            }
        }
    }
    // 3) Vierecks-Eckpunkte und Ellipsen-Handles (rx, ry, rot) prüfen — kleinere Targets,
    // höhere Prio als der Center-Marker (sonst kann der Center einen Handle daneben verdecken).
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (h.spline) continue;
        if (h.punkte) {
            for (let i = 0; i < h.punkte.length; i++) {
                const [px, py] = bodenPunkt(h.punkte[i][0], h.punkte[i][1]);
                if (Math.hypot(x - px, y - py) <= TREFFER) {
                    return { hidx, eckIdx: i, achse: null, splineKind: null, splineVIdx: null };
                }
            }
        } else {
            const rxVal = h.rx ?? h.r;
            const ryVal = h.ry ?? h.r;
            const rot = h.rot ?? 0;
            const cR = Math.cos(rot), sR = Math.sin(rot);
            const [rxX, rxY] = bodenPunkt(h.fu + rxVal * cR, h.fv + rxVal * sR);
            if (Math.hypot(x - rxX, y - rxY) <= TREFFER) {
                return { hidx, eckIdx: null, achse: "rx", splineKind: null, splineVIdx: null };
            }
            const [ryX, ryY] = bodenPunkt(h.fu - ryVal * sR, h.fv + ryVal * cR);
            if (Math.hypot(x - ryX, y - ryY) <= TREFFER) {
                return { hidx, eckIdx: null, achse: "ry", splineKind: null, splineVIdx: null };
            }
            const [rotX, rotY] = bodenPunkt(
                h.fu + (rxVal + ROT_OFFSET) * cR,
                h.fv + (rxVal + ROT_OFFSET) * sR,
            );
            if (Math.hypot(x - rotX, y - rotY) <= TREFFER) {
                return { hidx, eckIdx: null, achse: "rot", splineKind: null, splineVIdx: null };
            }
        }
    }
    // 4) Ellipsen-Center (Fallback).
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (h.spline || h.punkte) continue;
        const [cx, cy] = bodenPunkt(h.fu, h.fv);
        if (Math.hypot(x - cx, y - cy) <= TREFFER) {
            return { hidx, eckIdx: null, achse: null, splineKind: null, splineVIdx: null };
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
    if (hindernisDrag.splineKind === "vertex") {
        const v = h.spline[hindernisDrag.splineVIdx];
        v.fu = +fuFv[0].toFixed(4);
        v.fv = +fuFv[1].toFixed(4);
        invalidateSplineCache(h);
    } else if (hindernisDrag.splineKind === "hIn" || hindernisDrag.splineKind === "hOut") {
        const v = h.spline[hindernisDrag.splineVIdx];
        const hand = hindernisDrag.splineKind;
        v[hand] = {
            du: +(fuFv[0] - v.fu).toFixed(4),
            dv: +(fuFv[1] - v.fv).toFixed(4),
        };
        invalidateSplineCache(h);
    } else if (hindernisDrag.eckIdx !== null) {
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
    const { hidx, eckIdx, achse, splineKind, splineVIdx } = hindernisDrag;
    const h = HINDERNISSE[aktuellerRaum][hidx];
    if (splineKind === "vertex") {
        const v = h.spline[splineVIdx];
        console.log(`✓ ${aktuellerRaum}[${hidx}].spline[${splineVIdx}] = { fu: ${v.fu}, fv: ${v.fv} }`);
    } else if (splineKind === "hIn" || splineKind === "hOut") {
        const v = h.spline[splineVIdx];
        const off = v[splineKind];
        console.log(`✓ ${aktuellerRaum}[${hidx}].spline[${splineVIdx}].${splineKind} = { du: ${off.du}, dv: ${off.dv} }`);
    } else if (eckIdx !== null) {
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
        if (h.spline) {
            const verts = h.spline.map((v) => {
                const parts = [`fu: ${v.fu}`, `fv: ${v.fv}`];
                if (v.hIn  && (v.hIn.du  || v.hIn.dv))  parts.push(`hIn: { du: ${v.hIn.du}, dv: ${v.hIn.dv} }`);
                if (v.hOut && (v.hOut.du || v.hOut.dv)) parts.push(`hOut: { du: ${v.hOut.du}, dv: ${v.hOut.dv} }`);
                return `        { ${parts.join(", ")} }`;
            });
            return `    { spline: [\n${verts.join(",\n")}\n    ] },   // [${i}]`;
        }
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
    // Rechtsklick (button=2) und Mittelklick (1) → keine Drag-/Spielaktion. Rechtsklick wird
    // im contextmenu-Handler verarbeitet (Spline-Vertex/Handle löschen).
    if (e.button !== 0) return;

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
            // Geheimtür mit Binoculars (aber noch nicht freigeschaltet): Klick OHNE Code
            // → Hinweis, dass ein Code nötig ist. Klick MIT Code → kein Overlay (Spieler weiss,
            // dass er den Code droppen muss; der erste Hint reicht). Ohne Binoculars filtert
            // findeTuerBei die Tür komplett aus.
            if (tuer.secret && !spielstand.zustaende.keller_freigeschaltet) {
                if (!spielstand.gegenstaende.has("code_geheimtuer")) {
                    zeigeOverlayText("A keypad sits next to the door.\nYou need to find a code first.");
                    automatischSchliessen();
                }
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

// ---------- Spline-Editor: Vertex einfügen (Doppelklick) + löschen (Rechtsklick) ----------
// Findet die Spline-Edge eines Hindernisses, die einem Klick (in screen-Koords) am
// nächsten ist. Liefert { edge, t, dist } — dist in screen-Pixeln. Suche basiert auf
// der bereits gecachten Polyline (SPLINE_N=16 Samples pro Edge): jedes Polyline-Segment
// gehört zu einer bestimmten Edge und einem Sub-Range von t. Projektion auf das
// Segment liefert ein präzises t für die Cubic.
function findeSplineEdgeBei(x, y, h) {
    const poly = splinePoly(h);
    const N = SPLINE_N;
    const n = h.spline.length;
    let best = { edge: 0, t: 0, dist: Infinity };
    for (let edge = 0; edge < n; edge++) {
        for (let s = 0; s < N; s++) {
            const idx0 = edge * N + s;
            const idx1 = (idx0 + 1) % poly.length;
            const p0 = poly[idx0];
            const p1 = poly[idx1];
            const [sx0, sy0] = bodenPunkt(p0[0], p0[1]);
            const [sx1, sy1] = bodenPunkt(p1[0], p1[1]);
            const dx = sx1 - sx0, dy = sy1 - sy0;
            const lsq = dx * dx + dy * dy;
            let t = lsq > 1e-9 ? ((x - sx0) * dx + (y - sy0) * dy) / lsq : 0;
            t = Math.max(0, Math.min(1, t));
            const px = sx0 + t * dx, py = sy0 + t * dy;
            const d = Math.hypot(x - px, y - py);
            if (d < best.dist) {
                best = { edge, t: (s + t) / N, dist: d };
            }
        }
    }
    return best;
}

// Doppelklick auf eine Spline-Kurve → neuen Vertex einfügen (kurvenform-erhaltend
// per De-Casteljau-Split). Doppelklick auf Vertex/Handle (oder weiter weg) → ignoriert.
canvas.addEventListener("dblclick", (e) => {
    if (!window.HINDERNIS_DEBUG) return;
    const [x, y] = canvasZuLogisch(e.clientX, e.clientY);
    const griff = findeHindernisGriffBei(x, y);
    if (griff) {
        // Doppelklick auf Handle-Marker → Handle zurücksetzen (gerade Kante)
        if (griff.splineKind === "hIn" || griff.splineKind === "hOut") {
            const h = HINDERNISSE[aktuellerRaum][griff.hidx];
            splineLoescheHandle(h, griff.splineVIdx, griff.splineKind);
            draw();
            console.log(`✓ ${aktuellerRaum}[${griff.hidx}].spline[${griff.splineVIdx}].${griff.splineKind} → Reset (gerade Kante)`);
        }
        return;  // kein Vertex-Insert bei Klick auf irgendeinen Marker
    }
    const hs = HINDERNISSE[aktuellerRaum] || [];
    let bestH = null, bestEdge = 0, bestT = 0, bestDist = Infinity, bestHidx = -1;
    for (let hidx = 0; hidx < hs.length; hidx++) {
        const h = hs[hidx];
        if (!h.spline) continue;
        const r = findeSplineEdgeBei(x, y, h);
        if (r.dist < bestDist) {
            bestDist = r.dist; bestH = h; bestEdge = r.edge; bestT = r.t; bestHidx = hidx;
        }
    }
    if (bestH && bestDist < 14) {
        splineEinfuegen(bestH, bestEdge, bestT);
        draw();
        console.log(`✓ ${aktuellerRaum}[${bestHidx}].spline neuer Vertex bei edge=${bestEdge}, t=${bestT.toFixed(3)}`);
    }
});

// Rechtsklick im Debug-Modus:
//   • auf Spline-Vertex → Vertex löschen (≥3 Vertices nötig).
//   • auf Spline-Handle (hIn/hOut) → Handle entfernen (gerade Kante an dem Ende).
//   • sonst → Default-Browser-Menü zulassen (e.preventDefault wird nicht aufgerufen).
canvas.addEventListener("contextmenu", (e) => {
    if (!window.HINDERNIS_DEBUG) return;
    const [x, y] = canvasZuLogisch(e.clientX, e.clientY);
    const griff = findeHindernisGriffBei(x, y);
    if (!griff) return;
    if (!griff.splineKind) return;
    e.preventDefault();
    const h = HINDERNISSE[aktuellerRaum][griff.hidx];
    if (griff.splineKind === "vertex") {
        if (splineLoescheVertex(h, griff.splineVIdx)) {
            console.log(`✓ ${aktuellerRaum}[${griff.hidx}].spline Vertex ${griff.splineVIdx} gelöscht`);
        }
    } else {
        splineLoescheHandle(h, griff.splineVIdx, griff.splineKind);
        console.log(`✓ ${aktuellerRaum}[${griff.hidx}].spline[${griff.splineVIdx}].${griff.splineKind} → Default (gerade Kante)`);
    }
    draw();
});

// ---------- Overlay (Info-Text + Aufgaben-UI) ----------

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
function automatischSchliessen(ms = 4000) {
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

// Sieg-Overlay (Chain 7): Buttons binden — Replay = Reload, End = "Thanks for playing"-Screen.
// Backdrop-Klick + Esc bewusst NICHT geschlossen — der Spieler muss explizit wählen.
const siegReplayBtn = document.getElementById("sieg-replay");
const siegEndBtn    = document.getElementById("sieg-end");
if (siegReplayBtn) siegReplayBtn.addEventListener("click", siegPlayAgain);
if (siegEndBtn)    siegEndBtn.addEventListener("click", siegEndGame);

// Settings-Zahnrad: öffnet das Settings-Menü (Sound / Music / Reset). Vorher öffnete
// das Zahnrad direkt den Reset-Dialog; jetzt nur indirekt über den Reset-Eintrag im Menü.
const resetBtn         = document.getElementById("reset-button");
const resetOverlayEl   = document.getElementById("reset-overlay");
const resetConfirmBtn  = document.getElementById("reset-confirm");
const resetCancelBtn   = document.getElementById("reset-cancel");
const settingsMenuEl   = document.getElementById("einstellungen-menu");
const settingSoundBtn  = document.getElementById("setting-sound");
const settingSoundStat = document.getElementById("setting-sound-status");
const settingMusicBtn  = document.getElementById("setting-music");
const settingMusicStat = document.getElementById("setting-music-status");
const settingResetBtn  = document.getElementById("setting-reset");

function aktualisiereSettingsAnzeige() {
    if (settingSoundStat) {
        settingSoundStat.textContent = soundAn ? "On" : "Off";
        settingSoundStat.classList.toggle("an",  soundAn);
        settingSoundStat.classList.toggle("aus", !soundAn);
    }
    if (settingMusicStat) {
        settingMusicStat.textContent = musikAn ? "On" : "Off";
        settingMusicStat.classList.toggle("an",  musikAn);
        settingMusicStat.classList.toggle("aus", !musikAn);
    }
}
function oeffneSettingsMenu()  {
    if (!settingsMenuEl) return;
    aktualisiereSettingsAnzeige();
    settingsMenuEl.hidden = false;
}
function schliesseSettingsMenu() { if (settingsMenuEl) settingsMenuEl.hidden = true; }
function toggleSettingsMenu() {
    if (!settingsMenuEl) return;
    if (settingsMenuEl.hidden) oeffneSettingsMenu();
    else schliesseSettingsMenu();
}

function oeffneResetDialog()  { if (resetOverlayEl) resetOverlayEl.hidden = false; }
function schliesseResetDialog() { if (resetOverlayEl) resetOverlayEl.hidden = true; }

if (resetBtn)        resetBtn.addEventListener("click", toggleSettingsMenu);
if (settingSoundBtn) settingSoundBtn.addEventListener("click", () => {
    soundAn = !soundAn;
    speicherEinstellungen();
    aktualisiereSettingsAnzeige();
});
if (settingMusicBtn) settingMusicBtn.addEventListener("click", () => {
    musikAn = !musikAn;
    speicherEinstellungen();
    aktualisiereSettingsAnzeige();
});
if (settingResetBtn) settingResetBtn.addEventListener("click", () => {
    schliesseSettingsMenu();
    oeffneResetDialog();
});
// Klick ausserhalb des Menüs (und nicht auf den Zahnrad-Toggle selbst) schliesst das Menü.
document.addEventListener("pointerdown", (e) => {
    if (!settingsMenuEl || settingsMenuEl.hidden) return;
    if (settingsMenuEl.contains(e.target)) return;
    if (resetBtn && resetBtn.contains(e.target)) return;
    schliesseSettingsMenu();
});

if (resetCancelBtn)  resetCancelBtn.addEventListener("click", schliesseResetDialog);
if (resetConfirmBtn) resetConfirmBtn.addEventListener("click", setzeSpielstandZurueck);
if (resetOverlayEl)  resetOverlayEl.addEventListener("click", (e) => {
    if (e.target === resetOverlayEl) schliesseResetDialog();
});
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (resetOverlayEl && !resetOverlayEl.hidden) { schliesseResetDialog(); return; }
    if (settingsMenuEl && !settingsMenuEl.hidden) { schliesseSettingsMenu(); return; }
});

// ---------- Formelbuch ----------
// Wird aus dem Hauptregal heraus geöffnet (Klick auf die 5 Bücher rechts in regal-4 → siehe
// OBJEKTE.haupt.regal_buecher). Gating: spielstand.zustaende.formelbuch_gefunden wird true,
// und Aufgaben prüfen den State direkt via aktiv-Predicate (s. OBJEKTE).
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
    speicherSpielstand();
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

window.zeigeFormelbuch = zeigeFormelbuch;

// ---------- Inventar ----------
// Gegenstände können im Raum aufgenommen werden (Klick auf Objekt mit `aufnehmen`),
// erscheinen dann als Icon rechts oben im Inventar und können per Drag & Drop auf
// andere Objekte oder Türen gezogen werden (Drop-Target hat `akzeptiert[id]`).

// Registry aller möglichen Gegenstände. Icon ist Inline-SVG (viewBox 0..48).
const GEGENSTAENDE = {
    // Chain 1: Schlüssel für cupboard_1 (Büro). Silberner "moderner" Schlüssel —
    // ovaler hochstehender Reide-Kopf links, Schaft nach rechts, gestufter L-Bart am Ende.
    // Bewusst anders gestaltet als der goldene `vereinter_schluessel` (Chain 6 → Chain 7,
    // grössere ovale Reide quer, einfache Zähne, gold). Randlos.
    schluessel_buero: {
        name: "Silver key",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <!-- Ovaler Reide-Kopf hochstehend (silber) -->
                 <ellipse cx="14" cy="24" rx="8" ry="12" fill="#b8b8b8"/>
                 <!-- Highlight oben-links -->
                 <ellipse cx="10" cy="18" rx="2" ry="3.5" fill="#dcdcdc"/>
                 <!-- Loch in der Mitte -->
                 <circle cx="14" cy="24" r="3.5" fill="#4a4a4a"/>
                 <!-- Schaft (horizontal) -->
                 <rect x="22" y="22" width="20" height="4" fill="#b8b8b8"/>
                 <!-- Highlight am Schaft (oben) -->
                 <rect x="22" y="22" width="20" height="1.2" fill="#dcdcdc"/>
                 <!-- Gestufter L-Bart am Ende (unten) -->
                 <path d="M34 22 L42 22 L42 30 L46 30 L46 26 L34 26 Z" fill="#b8b8b8"/>
                 <!-- Streifen am unteren Bart-Rand (gleiche Hauptfarbe). -->
                 <rect x="34" y="25" width="12" height="1" fill="#b8b8b8"/>
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
                 <image href="assets/binoculars_1.svg?v=1" x="5" y="5" width="38" height="38" preserveAspectRatio="xMidYMid meet"/>
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
    // Chain 4: muffin_1 — kleines Cupcake-Icon im Cartoon-Stil. Randlos.
    muffin_1: {
        name: "Muffin",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <!-- Wachspapier (geriffelt) -->
                 <path d="M11 24 L14 42 Q14 44 16 44 L32 44 Q34 44 34 42 L37 24 Z" fill="#f0bf20"/>
                 <line x1="16" y1="26" x2="16" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="20" y1="26" x2="20" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="24" y1="26" x2="24" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="28" y1="26" x2="28" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <line x1="32" y1="26" x2="32" y2="42" stroke="#bf931a" stroke-width="1"/>
                 <!-- Cupcake-Top (Schoko) -->
                 <path d="M9 24 Q9 14 24 12 Q39 14 39 24 Z" fill="#5a3a1a"/>
                 <!-- Streusel -->
                 <circle cx="16" cy="20" r="1.5" fill="#ff5a5a"/>
                 <circle cx="22" cy="17" r="1.5" fill="#ffd84a"/>
                 <circle cx="29" cy="20" r="1.5" fill="#5fff8a"/>
                 <circle cx="32" cy="22" r="1.5" fill="#ffaa44"/>
               </svg>`,
    },
    // Chain 4: Messgerät — Cartoon-Bandmaß. Gelbes Gehäuse + ausgezogenes Maßband mit Tics.
    // Randlos; Skala-Tics behalten (das ist Skala-Detail, nicht Outline).
    messgeraet: {
        name: "Tape measure",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <!-- Maßband-Streifen, schräg ausgezogen -->
                 <path d="M30 24 L44 36 L40 42 L26 30 Z" fill="#f5f5f5"/>
                 <!-- Skala-Tics auf dem Streifen (gehören zum Maßband, dunkler Grauton statt schwarz) -->
                 <line x1="30" y1="27" x2="32" y2="29" stroke="#5a5a5a" stroke-width="1.2"/>
                 <line x1="33" y1="30" x2="35" y2="32" stroke="#5a5a5a" stroke-width="1.2"/>
                 <line x1="36" y1="33" x2="38" y2="35" stroke="#5a5a5a" stroke-width="1.2"/>
                 <line x1="39" y1="36" x2="41" y2="38" stroke="#5a5a5a" stroke-width="1.2"/>
                 <!-- Gehäuse (Kreis) -->
                 <circle cx="18" cy="22" r="14" fill="#ff9933"/>
                 <!-- Innen-Wickel mit Achse -->
                 <circle cx="18" cy="22" r="6" fill="#5a3a10"/>
                 <circle cx="18" cy="22" r="2.5" fill="#ffd84a"/>
                 <!-- kleines Höhepunkt-Highlight -->
                 <circle cx="14" cy="18" r="2.5" fill="#ffd084" opacity="0.7"/>
               </svg>`,
    },
    // Chain 5: Drei farbige Kreise (gelb/rot/violett) — leicht überlappend angeordnet.
    // Farben + Anordnung wie auf dem Bürobild, randlos.
    drei_kreise: {
        name: "Three colored circles",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <circle cx="20" cy="29" r="11" fill="#FFD43B"/>
                 <circle cx="14" cy="18" r="9"  fill="#E63946"/>
                 <circle cx="32" cy="16" r="8"  fill="#9B5DE5"/>
               </svg>`,
    },
    // Chain 5: Pickel (klassische Spitzhacke). Brauner Holzgriff (45° rotiert) + grauer
    // Doppelspitzen-Metallkopf. Randlos.
    pickel: {
        name: "Pickaxe",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g transform="rotate(-30 24 24)">
                   <!-- Holzgriff -->
                   <rect x="22" y="6" width="6" height="34" fill="#8b5a2b" rx="1.5"/>
                   <!-- Bänder am Griff -->
                   <rect x="22" y="12" width="6" height="2" fill="#5a3a1a"/>
                   <rect x="22" y="32" width="6" height="2" fill="#5a3a1a"/>
                   <!-- Metallkopf: Doppelspitze quer -->
                   <path d="M4 13 Q12 11 22 12 L26 12 Q36 11 44 13 Q40 14 36 14 L26 16 L22 16 L12 14 Q8 14 4 13 Z"
                         fill="#9aa3aa" stroke-linejoin="round"/>
                   <!-- Highlight -->
                   <path d="M8 13 Q14 12.2 20 12.6" fill="none" stroke="#d8dde0" stroke-width="1.2" stroke-linecap="round"/>
                 </g>
               </svg>`,
    },
    // Chain 6: Vereinter Schlüssel (drei Schlüsselteile + Leim → ein kompletter Schlüssel).
    // Klassischer goldener Schlüssel mit ovaler Reide oben, Schaft, Bart mit zwei Zähnen.
    // Visuell deutlich grösser/auffälliger als schluessel_buero (anderer Stil + viewBox-Ausnutzung).
    vereinter_schluessel: {
        name: "Complete key",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g fill="#e8b840" stroke="#7c5f1e" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
                   <ellipse cx="24" cy="11" rx="8" ry="7"/>
                   <rect x="22" y="16" width="4" height="22"/>
                   <rect x="26" y="30" width="9" height="3"/>
                   <rect x="26" y="36" width="6" height="3"/>
                 </g>
                 <ellipse cx="24" cy="11" rx="3.2" ry="2.6" fill="#fff8e1" stroke="#7c5f1e" stroke-width="0.8"/>
               </svg>`,
    },
    // Chain 4: Schaufel (kleine Garten-Kelle, 30° rotiert). Randlos.
    schaufel: {
        name: "Trowel",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g transform="rotate(-30 24 24)">
                   <!-- Holzgriff -->
                   <rect x="20" y="4" width="8" height="20" fill="#8b5a2b" rx="2"/>
                   <!-- Bänder am Griff -->
                   <rect x="20" y="9" width="8" height="2" fill="#5a3a1a"/>
                   <rect x="20" y="18" width="8" height="2" fill="#5a3a1a"/>
                   <!-- Kellen-Hals (Verbindung Holz → Blatt) -->
                   <rect x="22" y="22" width="4" height="6" fill="#888888"/>
                   <!-- Kellen-Blatt (zulaufend, leicht gebogen) -->
                   <path d="M16 28 Q14 36 18 42 Q24 46 30 42 Q34 36 32 28 Z" fill="#c0c0c0" stroke-linejoin="round"/>
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
        speicherSpielstand();
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
    speicherSpielstand();
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
    if (obj.aufnehmen === "duck_1") {
        // Chain 4 — Story-Hinweis: Ente sieht unheimlich aus, soll man bald wieder los werden.
        zeigeOverlayText("You take the rubber duck.\nIt looks strangely menacing — you'd rather get rid of it soon.");
        automatischSchliessen();
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

// ---------- Linkes Sammel-Inventar (Chain 6) ----------
// Sammlung der drei Schlüsselteile + Leim, parallel zum rechten Inventar. Items darin sind
// NICHT interaktiv — Klick zeigt nur einen Hinweis, kein Drag-Start. Sobald alle 4 drin sind,
// triggert sammleSchluesselteil() die kombiniereSchluessel-Animation (siehe oben).
const LINKES_INVENTAR = {
    // Reide-Teil (oberer Schlüsselkopf mit Loch). Bruchkante unten zeigt, dass es ein Teilstück ist.
    // Goldfarbtöne (analog vereinter_schluessel) statt grau, randlos.
    schluesselteil_1: {
        name: "Key fragment (top)",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g fill="#e8b840">
                   <ellipse cx="24" cy="16" rx="9" ry="8"/>
                   <rect x="22" y="22" width="4" height="14"/>
                 </g>
                 <ellipse cx="24" cy="16" rx="3.6" ry="3" fill="#fff8e1"/>
                 <!-- Highlights für Plastizität -->
                 <ellipse cx="20" cy="13" rx="3" ry="1.6" fill="#f5d068" opacity="0.85"/>
                 <!-- Bruchkante unten (zackig, dunkleres Gold) -->
                 <path d="M19 36 L21 40 L23 37 L26 41 L28 37 L29 40 L26 43 L22 43 Z" fill="#b89540"/>
               </svg>`,
    },
    // Mittel-Schaft (zylindrischer Stab, Bruchkante oben + unten).
    schluesselteil_2: {
        name: "Key fragment (shaft)",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <rect x="22" y="10" width="4" height="28" fill="#e8b840"/>
                 <!-- Highlight (heller Streifen entlang Stab) -->
                 <rect x="22" y="10" width="1.5" height="28" fill="#f5d068"/>
                 <!-- Bruchkante oben -->
                 <path d="M19 5 L21 9 L23 6 L26 10 L28 6 L29 9 L26 12 L22 12 Z" fill="#b89540"/>
                 <!-- Bruchkante unten -->
                 <path d="M19 43 L21 39 L23 42 L26 38 L28 42 L29 39 L26 36 L22 36 Z" fill="#b89540"/>
               </svg>`,
    },
    // Bart-Teil (unterer Schlüsselbart mit zwei Zähnen, Bruchkante oben).
    schluesselteil_3: {
        name: "Key fragment (bit)",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <g fill="#e8b840">
                   <rect x="22" y="13" width="4" height="26"/>
                   <rect x="26" y="26" width="11" height="3"/>
                   <rect x="26" y="33" width="7" height="3"/>
                 </g>
                 <!-- Highlight (heller Streifen) -->
                 <rect x="22" y="13" width="1.5" height="26" fill="#f5d068"/>
                 <!-- Bruchkante oben -->
                 <path d="M19 9 L21 13 L23 10 L26 14 L28 10 L29 13 L26 16 L22 16 Z" fill="#b89540"/>
               </svg>`,
    },
    // Leim — Tube mit Cap und Label, randlos. Gelbe Tube mit hellem Highlight.
    leim: {
        name: "Tube of glue",
        icon: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                 <!-- Cap (Schraubdeckel) -->
                 <rect x="18" y="3" width="12" height="8" rx="1.2" fill="#9a9a9a"/>
                 <rect x="18" y="3" width="12" height="2" rx="1.2" fill="#bababa"/>
                 <!-- Schulter -->
                 <path d="M16 11 L32 11 L34 16 L14 16 Z" fill="#ffe45a"/>
                 <!-- Tube-Körper -->
                 <rect x="14" y="16" width="20" height="26" rx="1.5" fill="#ffe45a"/>
                 <!-- Highlight links -->
                 <rect x="14" y="16" width="3" height="26" rx="1.5" fill="#fff39a"/>
                 <!-- Label -->
                 <rect x="16" y="22" width="16" height="14" fill="#ffffff"/>
                 <text x="24" y="32" text-anchor="middle"
                       font-family="ui-sans-serif, system-ui, sans-serif"
                       font-size="8" font-weight="700" fill="#a07020">GLUE</text>
                 <!-- Crimp am Boden (typische Tuben-Naht, dunkleres Gelb statt schwarz) -->
                 <line x1="14" y1="42" x2="34" y2="42" stroke="#bf931a" stroke-width="2"/>
               </svg>`,
    },
};

const inventarLinksEl = document.getElementById("inventar-links");

function aktualisiereLinkesInventar() {
    if (!inventarLinksEl) return;
    inventarLinksEl.innerHTML = "";
    if (spielstand.linkesInventar.size === 0) {
        inventarLinksEl.hidden = true;
        speicherSpielstand();
        return;
    }
    inventarLinksEl.hidden = false;
    for (const id of spielstand.linkesInventar) {
        const def = LINKES_INVENTAR[id];
        if (!def) continue;
        const slot = document.createElement("div");
        slot.className = "inventar-slot sammlung-slot";
        slot.dataset.gegenstand = id;
        slot.title = def.name;
        slot.innerHTML = def.icon;
        // Kein Drag — Klick zeigt einen Hinweis. e.preventDefault() verhindert Cursor-Wechsel.
        slot.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            zeigeOverlayText("Collection items on the left can't be used for interactions — only inventory items on the right can.");
            automatischSchliessen();
        });
        inventarLinksEl.appendChild(slot);
    }
    speicherSpielstand();
}
window.LINKES_INVENTAR = LINKES_INVENTAR;
window.aktualisiereLinkesInventar = aktualisiereLinkesInventar;

// Initial: leeres Sammel-Inventar rendern (versteckt).
aktualisiereLinkesInventar();

// ---------- Dev-Helpers (nur Konsole) ----------
// chainN()-Funktionen: Spielstand auf „Chain N erledigt" springen für Tests, ohne alle
// Vorbedingungen manuell zu spielen. Verändert nur Flags + Inventar; visuelle Zustände
// werden über die aktualisiere*-Helper nachgezogen. Keine Aufgaben-Overlays.
function chain1() {
    const z = spielstand.zustaende;
    z.formelbuch_gefunden = true;
    z.chain_1_step = 5;
    z.cupboard_1_offen = true;
    spielstand.geloesteAufgaben.add("chain_1_kuchen");
    spielstand.geloesteAufgaben.add("chain_1_schloss");
    spielstand.geloesteAufgaben.add("chain_1_pi");
    spielstand.gegenstaende.add("code_geheimtuer");
    spielstand.inventar.keller_code = 355113;
    aktualisiereInventar();
    aktualisiereCupboard1();
    aktualisiereSanitaer();
    draw();
    console.log("Chain 1 ✓ — Formelbuch, Schrank offen, Code-Tag im Inventar.");
}
function chain2() {
    const z = spielstand.zustaende;
    z.formelbuch_gefunden = true;
    z.chain_2_step = 4;
    z.toilette_2 = 2;
    z.toilette_2_voll = true;
    z.octopus_zustand = Math.min(3, (z.octopus_zustand ?? 1) + 1);
    spielstand.geloesteAufgaben.add("chain_2_octopus");
    aktualisiereInventar();
    aktualisiereSanitaer();
    draw();
    console.log("Chain 2 ✓ — Octopus-Mood +1.");
}
function chain3() {
    const z = spielstand.zustaende;
    z.formelbuch_gefunden = true;
    z.wolke_zentral_weg = true;
    z.vogel_da = false;
    z.schlauch_genommen = true;
    z.flower_1_gegossen = true;
    z.octopus_zustand = Math.min(3, (z.octopus_zustand ?? 1) + 1);
    spielstand.geloesteAufgaben.add("chain_3_schlauch");
    spielstand.geloesteAufgaben.add("chain_3_pizza");
    aktualisiereInventar();
    aktualisiereSanitaer();
    draw();
    console.log("Chain 3 ✓ — Octopus-Mood +1.");
}
function bridge() {
    const z = spielstand.zustaende;
    z.octopus_zustand = 3;
    z.octopus_da = false;
    z.toilette_1 = 2;
    z.binoculars_genommen = true;
    z.keller_freigeschaltet = true;
    if (typeof deaktiviereNachtsicht === "function") deaktiviereNachtsicht();
    aktualisiereSanitaer();
    draw();
    console.log("Bridge ✓ — Keller freigeschaltet.");
}
function chain4() {
    const z = spielstand.zustaende;
    z.formelbuch_gefunden = true;
    z.duck_im_keller = true;
    z.duck_gefuettert = true;
    z.teppich_gemessen = true;
    spielstand.geloesteAufgaben.add("chain_4_teppich");
    spielstand.gegenstaende.add("schaufel");
    aktualisiereInventar();
    aktualisiereSanitaer();
    draw();
    console.log("Chain 4 ✓ — Schaufel im Inventar.");
}
function chain5() {
    const z = spielstand.zustaende;
    z.formelbuch_gefunden = true;
    z.bild_kreise_geloest = true;
    z.bild_kreise_im_keller = true;
    z.chain_5_step = 4;
    spielstand.geloesteAufgaben.add("chain_5_kreise");
    spielstand.gegenstaende.add("pickel");
    aktualisiereInventar();
    aktualisiereSanitaer();
    draw();
    console.log("Chain 5 ✓ — Pickel im Inventar.");
}
function chain6() {
    spielstand.zustaende.formelbuch_gefunden = true;
    spielstand.geloesteAufgaben.add("chain_6_sektor");
    spielstand.geloesteAufgaben.add("chain_6_bogen");
    spielstand.geloesteAufgaben.add("chain_6_umfang");
    spielstand.geloesteAufgaben.add("chain_6_flaeche");
    spielstand.linkesInventar.clear();
    spielstand.gegenstaende.add("vereinter_schluessel");
    aktualisiereInventar();
    if (typeof aktualisiereLinkesInventar === "function") aktualisiereLinkesInventar();
    draw();
    console.log("Chain 6 ✓ — vereinter Schlüssel im Inventar.");
}
function chain7() {
    const z = spielstand.zustaende;
    z.formelbuch_gefunden = true;
    z.chain_7_schaufel_gedroppt = true;
    z.chain_7_pickel_gedroppt = true;
    z.chain_7_loch_offen = true;
    if (!chain_7_hindernis_aktiv) {
        HINDERNISSE.garten.push(CHAIN_7_HINDERNIS);
        chain_7_hindernis_aktiv = true;
    }
    spielstand.gegenstaende.add("vereinter_schluessel");
    aktualisiereInventar();
    aktualisiereChain7();
    draw();
    console.log("Chain 7 ✓ — Loch offen, Schlüssel im Inventar. Drop ihn auf die Truhe für den Sieg.");
}
window.chain1 = chain1;
window.chain2 = chain2;
window.chain3 = chain3;
window.bridge = bridge;
window.chain4 = chain4;
window.chain5 = chain5;
window.chain6 = chain6;
window.chain7 = chain7;

// Kombinations-Helper: chain12(), chain134(), chain143(), chain1234567(), …
// Beliebige Subsets der Chains 1..7 in beliebiger Ziffernreihenfolge im Funktionsnamen.
// Ausführung läuft IMMER in numerisch sortierter Reihenfolge. Generiert ~13 700
// Permutationen — JS-Objekt-Lookup ist O(1), kein Performance-Problem.
(function generateChainKombis() {
    const ziffern = ["1", "2", "3", "4", "5", "6", "7"];
    const alleSubsets = [];
    // Alle nichtleeren Subsets via Bitmask
    for (let mask = 1; mask < 128; mask++) {
        const subset = [];
        for (let i = 0; i < 7; i++) if (mask & (1 << i)) subset.push(ziffern[i]);
        if (subset.length >= 2) alleSubsets.push(subset);
    }
    function permutationen(arr) {
        if (arr.length <= 1) return [arr.slice()];
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = arr.slice(0, i).concat(arr.slice(i + 1));
            for (const p of permutationen(rest)) {
                result.push([arr[i], ...p]);
            }
        }
        return result;
    }
    for (const subset of alleSubsets) {
        // Ausführung in numerisch sortierter Reihenfolge — eine geteilte Closure für alle
        // Permutationen desselben Subsets, damit nicht ~14 k Closures im Speicher sitzen.
        const sorted = subset.slice().sort();
        const fn = () => {
            for (const d of sorted) {
                const helper = window[`chain${d}`];
                if (typeof helper === "function") helper();
            }
            // Auto-Bridge: Chains 1+2+3 zusammen bedeuten Keller freigeschaltet
            if (sorted.includes("1") && sorted.includes("2") && sorted.includes("3")) {
                if (typeof bridge === "function") bridge();
            }
        };
        // Alle Permutationen des Subsets als Funktionsname registrieren
        for (const perm of permutationen(subset)) {
            window[`chain${perm.join("")}`] = fn;
        }
    }
    console.log("chainNNN()-Helper bereit. Beispiele: chain134(), chain143(), chain12(), chain1234567().");
})();
