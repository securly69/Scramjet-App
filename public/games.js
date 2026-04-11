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

const gamesGrid = document.getElementById("games-grid");
const searchForm = document.getElementById("games-search-form");
const searchInput = document.getElementById("games-search-input");
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

async function openGameFullscreen(url) {
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

searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = encodeURIComponent(searchInput.value.trim());
    if (!query) return;
    openGameFullscreen(`https://www.twoplayergames.org/search?q=${query}`);
});

const games = [
    { title: "Action", icon: "💥", url: "https://www.twoplayergames.org/action" },
    { title: "Adventure", icon: "🗺️", url: "https://www.twoplayergames.org/adventure" },
    { title: "Classic", icon: "🕹️", url: "https://www.twoplayergames.org/classic" },
    { title: "Fighting", icon: "🥊", url: "https://www.twoplayergames.org/fighting" },
    { title: "Kids", icon: "🧸", url: "https://www.twoplayergames.org/kids" },
    { title: "Racing", icon: "🏎️", url: "https://www.twoplayergames.org/racing" },
    { title: "Sport", icon: "⚽", url: "https://www.twoplayergames.org/sport" },
    { title: "Our", icon: "🌟", url: "https://www.twoplayergames.org/our" },
    { title: "3-4 Player", icon: "👥", url: "https://www.twoplayergames.org/3-4-player" },
    { title: "1 Player", icon: "👤", url: "https://www.twoplayergames.org/1-player" },
    { title: "3D", icon: "🧊", url: "https://www.twoplayergames.org/3d" },
    { title: "Aircraft", icon: "✈️", url: "https://www.twoplayergames.org/aircraft" },
    { title: "Alien", icon: "👽", url: "https://www.twoplayergames.org/alien" },
    { title: "Balance", icon: "⚖️", url: "https://www.twoplayergames.org/balance" },
    { title: "Basketball", icon: "🏀", url: "https://www.twoplayergames.org/basketball" },
    { title: "Battle", icon: "⚔️", url: "https://www.twoplayergames.org/battle" },
    { title: "Billiards", icon: "🎱", url: "https://www.twoplayergames.org/billiards" },
    { title: "Board", icon: "🎲", url: "https://www.twoplayergames.org/board" },
    { title: "Bomber", icon: "💣", url: "https://www.twoplayergames.org/bomber" },
    { title: "Browser", icon: "🌐", url: "https://www.twoplayergames.org/browser" },
    { title: "Car", icon: "🚘", url: "https://www.twoplayergames.org/car" },
    { title: "Castle", icon: "🏰", url: "https://www.twoplayergames.org/castle" },
    { title: "Chess", icon: "♟️", url: "https://www.twoplayergames.org/chess" },
    { title: "Crazy", icon: "🤪", url: "https://www.twoplayergames.org/crazy" },
    { title: "Defense", icon: "🛡️", url: "https://www.twoplayergames.org/defense" },
    { title: "Dinosaur", icon: "🦖", url: "https://www.twoplayergames.org/dinosaur" },
    { title: "Driving", icon: "🚙", url: "https://www.twoplayergames.org/driving" },
    { title: "Educational", icon: "📚", url: "https://www.twoplayergames.org/educational" },
    { title: "Escape", icon: "🏃", url: "https://www.twoplayergames.org/escape" },
    { title: "Flying", icon: "🦅", url: "https://www.twoplayergames.org/flying" },
    { title: "Food", icon: "🍔", url: "https://www.twoplayergames.org/food" },
    { title: "Fun", icon: "🎉", url: "https://www.twoplayergames.org/fun" },
    { title: "Girl", icon: "👧", url: "https://www.twoplayergames.org/girl" },
    { title: "Golf", icon: "⛳", url: "https://www.twoplayergames.org/golf" },
    { title: "Jumping", icon: "🦘", url: "https://www.twoplayergames.org/jumping" },
    { title: "Math", icon: "➗", url: "https://www.twoplayergames.org/math" },
    { title: "Maze", icon: "🌀", url: "https://www.twoplayergames.org/maze" },
    { title: "Monster", icon: "👾", url: "https://www.twoplayergames.org/monster" },
    { title: "Motorcycle", icon: "🏍️", url: "https://www.twoplayergames.org/motorcycle" },
    { title: "Online", icon: "🌍", url: "https://www.twoplayergames.org/online" },
    { title: "Pixel Art", icon: "👾", url: "https://www.twoplayergames.org/pixel-art" },
    { title: "Platform", icon: "🧱", url: "https://www.twoplayergames.org/platform" },
    { title: "Pool", icon: "🎱", url: "https://www.twoplayergames.org/pool" },
    { title: "Puppet", icon: "🎎", url: "https://www.twoplayergames.org/puppet" },
    { title: "Puzzle", icon: "🧩", url: "https://www.twoplayergames.org/puzzle" },
    { title: "Reaction", icon: "⚡", url: "https://www.twoplayergames.org/reaction" },
    { title: "Retro", icon: "📼", url: "https://www.twoplayergames.org/retro" },
    { title: "Robot", icon: "🤖", url: "https://www.twoplayergames.org/robot" },
    { title: "Running", icon: "🏃‍♂️", url: "https://www.twoplayergames.org/running" },
    { title: "School", icon: "🎒", url: "https://www.twoplayergames.org/school" },
    { title: "Shooting", icon: "🔫", url: "https://www.twoplayergames.org/shooting" },
    { title: "Soccer", icon: "⚽", url: "https://www.twoplayergames.org/soccer" },
    { title: "Space", icon: "🚀", url: "https://www.twoplayergames.org/space" },
    { title: "Stickman", icon: "🧍", url: "https://www.twoplayergames.org/stickman" },
    { title: "Strategy", icon: "🧠", url: "https://www.twoplayergames.org/strategy" },
    { title: "Stunt", icon: "🤸", url: "https://www.twoplayergames.org/stunt" },
    { title: "Tank", icon: "🛡️", url: "https://www.twoplayergames.org/tank" },
    { title: "Tennis", icon: "🎾", url: "https://www.twoplayergames.org/tennis" },
    { title: "Tic Tac Toe", icon: "⭕", url: "https://www.twoplayergames.org/tic-tac-toe" },
    { title: "Tower", icon: "🗼", url: "https://www.twoplayergames.org/tower" },
    { title: "Truck", icon: "🚚", url: "https://www.twoplayergames.org/truck" },
    { title: "War", icon: "🎖️", url: "https://www.twoplayergames.org/war" },
    { title: "Wrestling", icon: "🤼", url: "https://www.twoplayergames.org/wrestling" },
    { title: "Zombie", icon: "🧟", url: "https://www.twoplayergames.org/zombie" },
];

gamesGrid.innerHTML = games.map(g => `
    <li>
        <button type="button" class="game-btn" data-url="${g.url}">
            <span class="cat-icon">${g.icon}</span>
            <span class="cat-title">${g.title}</span>
        </button>
    </li>
`).join("");

document.querySelectorAll(".game-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        openGameFullscreen(btn.dataset.url);
    });
});
