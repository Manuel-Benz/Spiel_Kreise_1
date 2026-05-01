// Konservative SVGO-Config für die "Black-Box"-Assets unter assets/
// (alle, die per <image href> oder Image()/drawImage geladen werden).
// Verlustfrei: removeViewBox=false (gegen Skalierungs-Bugs),
// cleanupIds=false (interne Gradient-Refs bleiben intakt).
// Inline-SVG-Quell-Assets (mit prefixed IDs im HTML) NICHT mit dieser Config laufen lassen.
export default {
    multipass: true,
    plugins: [
        {
            name: "preset-default",
            params: {
                overrides: {
                    removeViewBox: false,
                    cleanupIds: false,
                },
            },
        },
    ],
};
