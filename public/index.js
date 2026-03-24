"use strict";

/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");
/**
 * @type {HTMLParagraphElement}
 */
const username = document.getElementById("username");
/**
 * @type {HTMLInputElement}
 */
const quickSearch = document.getElementById("music-search-input");
/**
 * @type {HTMLButtonElement}
 */
const openSource = document.getElementById("open-source");
/**
 * @type {HTMLButtonElement}
 */
const openCredits = document.getElementById("open-credits");

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

let activeFrame;

setGreeting();

form.addEventListener("submit", (event) => {
	event.preventDefault();
	void launch(address.value);
});

document.querySelectorAll("[data-target], [data-search]").forEach((button) => {
	button.addEventListener("click", () => {
		const destination = button.dataset.target || button.dataset.search || "";
		address.value = destination;
		void launch(destination);
	});
});

quickSearch.addEventListener("keydown", (event) => {
	if (event.key !== "Enter") return;
	event.preventDefault();
	address.value = quickSearch.value;
	void launch(quickSearch.value);
});

openSource.addEventListener("click", () => {
	window.open(
		"https://github.com/MercuryWorkshop/Scramjet-Demo",
		"_blank",
		"noopener,noreferrer"
	);
});

openCredits.addEventListener("click", () => {
	window.location.href = "credits.html";
});

document.addEventListener("keydown", (event) => {
	if (event.key !== "Escape" || !activeFrame?.frame?.isConnected) return;
	activeFrame.frame.remove();
	activeFrame = null;
	document.body.classList.remove("is-browsing");
	address.focus();
});

function setGreeting() {
	const hour = new Date().getHours();
	let greeting = "Good evening";

	if (hour < 12) greeting = "Good morning";
	else if (hour < 18) greeting = "Good afternoon";

	username.textContent = `${greeting}. Scramjet is ready.`;
}

function clearError() {
	error.textContent = "";
	errorCode.textContent = "";
}

/**
 * @param {string} message
 * @param {unknown} detail
 */
function showError(message, detail) {
	error.textContent = message;
	errorCode.textContent =
		detail instanceof Error ? detail.stack || detail.message : String(detail || "");
}

async function prepareTransport() {
	await registerSW();

	const wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";

	if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
		await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
	}
}

function ensureFrame() {
	if (activeFrame?.frame?.isConnected) return activeFrame;

	activeFrame = scramjet.createFrame();
	activeFrame.frame.id = "sj-frame";
	document.body.appendChild(activeFrame.frame);
	return activeFrame;
}

/**
 * @param {string} input
 */
async function launch(input) {
	const value = input.trim();
	if (!value) {
		address.focus();
		return;
	}

	clearError();

	try {
		await prepareTransport();
		const url = search(value, searchEngine.value);
		const frame = ensureFrame();
		document.body.classList.add("is-browsing");
		frame.go(url);
	} catch (err) {
		document.body.classList.remove("is-browsing");
		showError("Failed to start the proxy session.", err);
		console.error(err);
	}
}
