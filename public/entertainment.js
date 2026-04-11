"use strict";

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function prepareTransport() {
	await registerSW();

	const wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";

	if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);
	}
}

const entertainmentGrid = document.getElementById("entertainment-grid");
const overlay = document.getElementById("game-overlay");
const gameContainer = document.getElementById("game-frame-container");
const btnBack = document.getElementById("game-back");
const btnReload = document.getElementById("game-reload");
const btnClose = document.getElementById("game-close");

let currentFrame = null;

btnBack.addEventListener("click", () => {
    if (currentFrame) currentFrame.back();
});

btnReload.addEventListener("click", () => {
    if (currentFrame) currentFrame.reload();
});

btnClose.addEventListener("click", () => {
    overlay.classList.add("hidden");
    if (currentFrame) {
        currentFrame.frame.remove();
        currentFrame = null;
    }
});

async function openMediaFullscreen(url) {
    if (currentFrame) {
        currentFrame.frame.remove();
        currentFrame = null;
    }
    await prepareTransport();
    
    currentFrame = scramjet.createFrame();
    gameContainer.appendChild(currentFrame.frame);
    currentFrame.go(url);
    overlay.classList.remove("hidden");
}

const mediaOptions = [
    { title: "Movies & TV Shows (+ extra live TV)", icon: "🍿", url: "https://dulo.tv/" },
    { title: "Live TV", icon: "📡", url: "https://thetvapp.to/" },
    { title: "Documentaries", icon: "🎥", url: "https://docplus.com/home" },
    { title: "Radio", icon: "📻", url: "https://cinevibe.asia/radio" }
];

entertainmentGrid.innerHTML = mediaOptions.map(opt => `
    <li>
        <button type="button" class="game-btn" data-url="${opt.url}">
            <span class="cat-icon">${opt.icon}</span>
            <span class="cat-title">${opt.title}</span>
        </button>
    </li>
`).join("");

document.querySelectorAll(".game-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        openMediaFullscreen(btn.dataset.url);
    });
});
