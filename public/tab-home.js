"use strict";

const form = document.getElementById("tab-home-form");
const address = document.getElementById("tab-home-address");
const bookmarks = document.getElementById("tab-home-bookmarks");
const searchEngineSelect = document.getElementById(
	"tab-home-search-engine-select"
);
const historyButton = document.getElementById("tab-home-history");
const settingsButton = document.getElementById("tab-home-settings");
const time = document.getElementById("tab-home-time");
const date = document.getElementById("tab-home-date");
const appData = window.ProxyAppData;

let savedBookmarks = appData.getBookmarks();

populateSearchEngines();
refreshSearchEngine();
renderBookmarks();
startDateTime();

form.addEventListener("submit", (event) => {
	event.preventDefault();
	submitAddress(address.value);
});

searchEngineSelect.addEventListener("change", () => {
	appData.saveSearchEngineId(searchEngineSelect.value);
	notifyParent("sj-tab-home-search-engine-changed");
});

historyButton?.addEventListener("click", () => {
	notifyParent("sj-history-launch", { url: "proxy://history" });
});

settingsButton?.addEventListener("click", () => {
	notifyParent("sj-settings-launch", { url: "proxy://settings" });
});

bookmarks.addEventListener("click", (event) => {
	const actionTarget = event.target.closest("[data-bookmark-action]");
	if (!(actionTarget instanceof HTMLElement)) return;

	const bookmarkId = actionTarget.dataset.bookmarkId || "";
	if (actionTarget.dataset.bookmarkAction === "add") {
		openBookmarkEditor();
		return;
	}

	if (actionTarget.dataset.bookmarkAction === "open") {
		const bookmark = savedBookmarks.find((entry) => entry.id === bookmarkId);
		if (!bookmark) return;
		submitAddress(bookmark.url);
		return;
	}

	if (actionTarget.dataset.bookmarkAction === "edit") {
		openBookmarkEditor(bookmarkId);
		return;
	}

	if (actionTarget.dataset.bookmarkAction === "delete") {
		removeBookmark(bookmarkId);
	}
});

window.addEventListener("storage", (event) => {
	if (event.key === "sj-bookmarks-v1") {
		refreshBookmarks();
		return;
	}

	if (event.key === "sj-search-engine-v1") refreshSearchEngine();
});

function populateSearchEngines() {
	searchEngineSelect.replaceChildren(
		...appData.getSearchEngines().map((engine) => {
			const option = document.createElement("option");
			option.value = engine.id;
			option.textContent = engine.name;
			return option;
		})
	);
}

function refreshBookmarks() {
	savedBookmarks = appData.getBookmarks();
	renderBookmarks();
}

function refreshSearchEngine() {
	searchEngineSelect.value = appData.getSearchEngineId();
}

function startDateTime() {
	updateDateTime();
	window.setInterval(updateDateTime, 1000);
}

function updateDateTime() {
	if (!time || !date) return;

	const now = new Date();
	time.textContent = now.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});
	date.textContent = now.toLocaleDateString([], {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function renderBookmarks() {
	const bookmarkCards = savedBookmarks.map((bookmark) => {
		const item = document.createElement("article");
		item.className = "tab-home-bookmark-card";

		const open = document.createElement("button");
		open.className = "tab-home-bookmark";
		open.type = "button";
		open.dataset.bookmarkAction = "open";
		open.dataset.bookmarkId = bookmark.id;

		const icon = document.createElement("img");
		icon.className = "tab-home-bookmark-icon";
		icon.alt = "";
		icon.ariaHidden = "true";
		icon.src = appData.getBookmarkIcon(bookmark.url);
		icon.addEventListener("error", () => {
			icon.src = "sj.png";
		});

		const copy = document.createElement("div");
		copy.className = "tab-home-bookmark-copy";

		const label = document.createElement("span");
		label.className = "tab-home-bookmark-label";
		label.textContent = bookmark.name;

		const url = document.createElement("span");
		url.className = "tab-home-bookmark-url";
		url.textContent = getBookmarkCaption(bookmark.url);

		copy.append(label, url);
		open.append(icon, copy);

		const actions = document.createElement("div");
		actions.className = "tab-home-bookmark-actions";

		const edit = document.createElement("button");
		edit.className = "tab-home-bookmark-action";
		edit.type = "button";
		edit.textContent = "Edit";
		edit.dataset.bookmarkAction = "edit";
		edit.dataset.bookmarkId = bookmark.id;

		const remove = document.createElement("button");
		remove.className = "tab-home-bookmark-action";
		remove.type = "button";
		remove.textContent = "Delete";
		remove.dataset.bookmarkAction = "delete";
		remove.dataset.bookmarkId = bookmark.id;

		actions.append(edit, remove);
		item.append(open, actions);
		return item;
	});

	const addCard = document.createElement("article");
	addCard.className = "tab-home-bookmark-card tab-home-bookmark-card-add";

	const addButton = document.createElement("button");
	addButton.className = "tab-home-bookmark tab-home-bookmark-add";
	addButton.type = "button";
	addButton.dataset.bookmarkAction = "add";
	addButton.innerHTML =
		'<span class="tab-home-bookmark-add-icon" aria-hidden="true">+</span><div class="tab-home-bookmark-copy"><span class="tab-home-bookmark-label">Add bookmark</span><span class="tab-home-bookmark-url">Save a name and URL</span></div>';

	addCard.append(addButton);
	bookmarks.replaceChildren(...bookmarkCards, addCard);
}

/**
 * @param {string} url
 */
function getBookmarkCaption(url) {
	const normalizedUrl = appData.normalizeInput(url);
	if (!normalizedUrl) return "";
	if (appData.isInternalUrl(normalizedUrl)) return normalizedUrl;

	try {
		return new URL(normalizedUrl).hostname.replace(/^www\./, "");
	} catch (err) {
		return normalizedUrl;
	}
}

/**
 * @param {string=} bookmarkId
 */
function openBookmarkEditor(bookmarkId) {
	const existing =
		savedBookmarks.find((bookmark) => bookmark.id === bookmarkId) || null;
	const name = window.prompt("Bookmark name", existing ? existing.name : "");
	if (name === null) return;

	const url = window.prompt(
		"Bookmark URL",
		existing ? existing.url : "https://"
	);
	if (url === null) return;

	const normalizedUrl = appData.normalizeInput(url.trim());
	const nextBookmark = {
		id: existing ? existing.id : `bookmark-${Date.now()}`,
		name: name.trim() || "Bookmark",
		url: normalizedUrl,
	};

	if (!nextBookmark.url) return;

	if (existing) {
		savedBookmarks = savedBookmarks.map((bookmark) =>
			bookmark.id === existing.id ? nextBookmark : bookmark
		);
	} else {
		savedBookmarks = [...savedBookmarks, nextBookmark];
	}

	appData.saveBookmarks(savedBookmarks);
	renderBookmarks();
	notifyParent("sj-tab-home-bookmarks-updated");
}

function removeBookmark(bookmarkId) {
	const bookmark = savedBookmarks.find((entry) => entry.id === bookmarkId);
	if (!bookmark) return;
	if (!window.confirm(`Delete bookmark "${bookmark.name}"?`)) return;

	savedBookmarks = savedBookmarks.filter((entry) => entry.id !== bookmarkId);
	appData.saveBookmarks(savedBookmarks);
	renderBookmarks();
	notifyParent("sj-tab-home-bookmarks-updated");
}

/**
 * @param {string} value
 */
function submitAddress(value) {
	const input = value.trim();
	if (!input) {
		address.focus();
		return;
	}

	window.parent.postMessage(
		{
			type: "sj-tab-home-launch",
			url: input,
		},
		location.origin
	);
}

/**
 * @param {string} type
 * @param {Record<string, string>} detail
 */
function notifyParent(type, detail) {
	window.parent.postMessage({ type, ...detail }, location.origin);
}
