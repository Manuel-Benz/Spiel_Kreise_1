const LOGICAL_WIDTH = 1600;
const LOGICAL_HEIGHT = 900;

const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const gameContainer = document.getElementById("game-container");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const scale = canvas.width / LOGICAL_WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
}

function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 250, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Canvas bereit", LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 20);

    ctx.font = "32px sans-serif";
    ctx.fillText(`${LOGICAL_WIDTH} × ${LOGICAL_HEIGHT} (16:9)`, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 40);
}

startButton.addEventListener("click", () => {
    startScreen.hidden = true;
    gameContainer.hidden = false;
    requestAnimationFrame(resizeCanvas);
});

window.addEventListener("resize", () => {
    if (!gameContainer.hidden) resizeCanvas();
});
