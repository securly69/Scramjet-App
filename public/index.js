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
 * @type {HTMLSelectElement}
 */
const searchEngineSelect = document.getElementById("sj-search-engine-select");
/**
 * @type {HTMLFormElement}
 */
const navForm = document.getElementById("sj-nav-form");
/**
 * @type {HTMLInputElement}
 */
const navAddress = document.getElementById("sj-nav-address");
/**
 * @type {HTMLImageElement}
 */
const navIcon = document.getElementById("sj-nav-icon");
/**
 * @type {HTMLButtonElement}
 */
const navBack = document.getElementById("sj-nav-back");
/**
 * @type {HTMLButtonElement}
 */
const navForward = document.getElementById("sj-nav-forward");
/**
 * @type {HTMLButtonElement}
 */
const navReload = document.getElementById("sj-nav-reload");
/**
 * @type {HTMLButtonElement}
 */
const navEscape = document.getElementById("sj-nav-escape");
/**
 * @type {HTMLDivElement}
 */
const tabList = document.getElementById("sj-tabs");
/**
 * @type {HTMLButtonElement}
 */
const tabCreate = document.getElementById("sj-tab-create");
/**
 * @type {HTMLElement}
 */
const bookmarks = document.getElementById("bookmarks");
/**
 * @type {HTMLElement}
 */
const shortcuts = document.getElementById("buttons-extra");
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
 * @type {HTMLParagraphElement}
 */
const homeTime = document.getElementById("home-time");
/**
 * @type {HTMLParagraphElement}
 */
const homeDate = document.getElementById("home-date");
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
const appData = window.ProxyAppData;
const DIRECT_IMPORT_PREFIX = "/scramjet/";
const TAB_HOME_PATH = "/tab-home.html";
const HISTORY_PAGE_PATH = "/proxy-history.html";
const SETTINGS_PAGE_PATH = "/proxy-settings.html";
const NEW_TAB_DISPLAY_URL = appData.getInternalNewTabUrl();
const NEW_TAB_HISTORY_URL = NEW_TAB_DISPLAY_URL;
const HISTORY_DISPLAY_URL = appData.getInternalHistoryUrl();
const SETTINGS_DISPLAY_URL = appData.getInternalSettingsUrl();
const MAX_TABS = 6;

const pendingDirectImportUrl = extractDirectImportUrl(location);

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

let tabs = [];
let activeTabId = null;
let nextTabId = 0;
let browserVisible = false;
let savedBookmarks = appData.getBookmarks();

setGreeting();
startHomeDateTime();
populateSearchEngineSelect(searchEngineSelect);
searchEngineSelect.value = appData.getSearchEngineId();
renderBookmarks();
updateBrowsingState();
updateNavState();
renderTabs();

form.addEventListener("submit", (event) => {
	event.preventDefault();
	void launch(address.value);
});

navForm.addEventListener("submit", (event) => {
	event.preventDefault();
	void launch(navAddress.value);
});

searchEngineSelect.addEventListener("change", () => {
	appData.saveSearchEngineId(searchEngineSelect.value);
});

document.querySelectorAll("[data-target]").forEach((button) => {
	button.addEventListener("click", () => {
		const destination = button.dataset.target;
		if (!destination) return;
		setMainAddress(destination);
		void launch(destination);
	});
});

shortcuts?.addEventListener("click", (event) => {
	const trigger = event.target.closest("[data-launch], [data-search]");
	if (!(trigger instanceof HTMLElement)) return;

	if (trigger.dataset.launch) {
		setMainAddress(trigger.dataset.launch);
		void launch(trigger.dataset.launch);
		return;
	}

	if (trigger.dataset.search) {
		setMainAddress(trigger.dataset.search);
		void launch(trigger.dataset.search);
	}
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
		setMainAddress(bookmark.url);
		void launch(bookmark.url);
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

quickSearch.addEventListener("keydown", (event) => {
	if (event.key !== "Enter") return;
	event.preventDefault();
	setMainAddress(quickSearch.value);
	void launch(quickSearch.value);
});

navBack.addEventListener("click", () => {
	const tab = getVisibleActiveTab();
	if (!tab || !canGoBack(tab)) return;
	tab.pendingHistoryDelta = -1;
	recordTabAction(tab, "back-request");
	tab.frame.back();
	updateNavState();
});

navForward.addEventListener("click", () => {
	const tab = getVisibleActiveTab();
	if (!tab || !canGoForward(tab)) return;
	tab.pendingHistoryDelta = 1;
	recordTabAction(tab, "forward-request");
	tab.frame.forward();
	updateNavState();
});

navReload.addEventListener("click", () => {
	const tab = getVisibleActiveTab();
	if (!tab) return;
	recordTabAction(tab, "reload");
	tab.frame.reload();
});

navEscape.addEventListener("click", () => {
	hideBrowser();
});

tabCreate.addEventListener("click", () => {
	openNewTab();
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
	if (event.key !== "Escape") return;
	hideBrowser();
});

window.addEventListener("message", (event) => {
	if (
		event.origin !== location.origin ||
		typeof event.data !== "object" ||
		!event.data
	)
		return;

	if (
		event.data.type === "sj-import-tab" &&
		typeof event.data.url === "string"
	) {
		handleImportedTab(event.source, event.data.url);
		return;
	}

	if (
		event.data.type === "sj-tab-home-launch" &&
		typeof event.data.url === "string"
	) {
		handleTabHomeLaunch(event.source, event.data.url);
		return;
	}

	if (
		event.data.type === "sj-history-launch" &&
		typeof event.data.url === "string"
	) {
		handleHistoryLaunch(event.source, event.data.url);
		return;
	}

	if (
		event.data.type === "sj-settings-launch" &&
		typeof event.data.url === "string"
	) {
		handleSettingsLaunch(event.source, event.data.url);
		return;
	}

	if (event.data.type === "sj-tab-home-bookmarks-updated") {
		refreshBookmarksFromStorage();
		return;
	}

	if (event.data.type === "sj-tab-home-search-engine-changed") {
		refreshSearchEngineFromStorage();
	}
});

window.addEventListener("storage", (event) => {
	if (!event.key) return;

	if (event.key === "sj-bookmarks-v1") {
		refreshBookmarksFromStorage();
		return;
	}

	if (event.key === "sj-search-engine-v1") {
		refreshSearchEngineFromStorage();
	}
});

function setGreeting() {
	const hour = new Date().getHours();
	let greeting = "Good evening";

	if (hour < 12) greeting = "Good morning";
	else if (hour < 18) greeting = "Good afternoon";

	username.textContent = `${greeting}. Scramjet is ready.`;
}

function startHomeDateTime() {
	updateDateTime(homeTime, homeDate);
	window.setInterval(() => {
		updateDateTime(homeTime, homeDate);
	}, 1000);
}

/**
 * @param {HTMLElement | null} timeElement
 * @param {HTMLElement | null} dateElement
 */
function updateDateTime(timeElement, dateElement) {
	if (!timeElement || !dateElement) return;

	const now = new Date();
	timeElement.textContent = now.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});
	dateElement.textContent = now.toLocaleDateString([], {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function clearError() {
	error.textContent = "";
	errorCode.textContent = "";
}

function getActiveTab() {
	return tabs.find((tab) => tab.id === activeTabId) || null;
}

function getVisibleActiveTab() {
	const tab = getActiveTab();
	if (!tab || !browserVisible) return null;
	if (!tab.frame.frame.classList.contains("is-active")) return null;
	return tab;
}

function hasTabs() {
	return tabs.length > 0;
}

function refreshBookmarksFromStorage() {
	savedBookmarks = appData.getBookmarks();
	renderBookmarks();
}

function refreshSearchEngineFromStorage() {
	searchEngineSelect.value = appData.getSearchEngineId();
}

function notifyHistoryPages() {
	tabs.forEach((tab) => {
		try {
			tab.frame.frame.contentWindow?.postMessage(
				{ type: "sj-history-updated" },
				location.origin
			);
		} catch (err) {
			// ignore cross-origin frames
		}
	});
}

/**
 * @param {{ id: string, url: string, title: string }} tab
 * @param {string} type
 * @param {{ url?: string, title?: string, detail?: string }=} overrides
 */
function recordTabAction(tab, type, overrides = {}) {
	appData.recordTabAction({
		tabId: tab.id,
		type,
		url: overrides.url ?? tab.url,
		title: overrides.title ?? tab.title,
		detail: overrides.detail ?? "",
	});
	notifyHistoryPages();
}

/**
 * @param {string} url
 * @param {string} title
 * @param {string} icon
 */
function recordVisit(url, title, icon) {
	if (!url || appData.isInternalUrl(url)) return;
	appData.recordVisit({ url, title, icon });
	notifyHistoryPages();
}

/**
 * @param {HTMLSelectElement} select
 */
function populateSearchEngineSelect(select) {
	select.replaceChildren(
		...appData.getSearchEngines().map((engine) => {
			const option = document.createElement("option");
			option.value = engine.id;
			option.textContent = engine.name;
			return option;
		})
	);
}

function renderBookmarks() {
	const bookmarkCards = savedBookmarks.map((bookmark) => {
		const item = document.createElement("article");
		item.className = "bookmark-card";

		const open = document.createElement("button");
		open.className = "bookmark-btn";
		open.type = "button";
		open.dataset.bookmarkAction = "open";
		open.dataset.bookmarkId = bookmark.id;

		const icon = document.createElement("img");
		icon.className = "bookmark-icon-image";
		icon.alt = "";
		icon.ariaHidden = "true";
		icon.src = appData.getBookmarkIcon(bookmark.url);
		icon.addEventListener("error", () => {
			icon.src = "sj.png";
		});

		const copy = document.createElement("div");
		copy.className = "bookmark-copy";

		const label = document.createElement("p");
		label.textContent = bookmark.name;

		const url = document.createElement("span");
		url.className = "bookmark-url";
		url.textContent = getBookmarkCaption(bookmark.url);

		copy.append(label, url);
		open.append(icon, copy);

		const actions = document.createElement("div");
		actions.className = "bookmark-actions";

		const edit = document.createElement("button");
		edit.className = "bookmark-action-btn";
		edit.type = "button";
		edit.textContent = "Edit";
		edit.dataset.bookmarkAction = "edit";
		edit.dataset.bookmarkId = bookmark.id;

		const remove = document.createElement("button");
		remove.className = "bookmark-action-btn";
		remove.type = "button";
		remove.textContent = "Delete";
		remove.dataset.bookmarkAction = "delete";
		remove.dataset.bookmarkId = bookmark.id;

		actions.append(edit, remove);
		item.append(open, actions);
		return item;
	});

	const addCard = document.createElement("article");
	addCard.className = "bookmark-card bookmark-card-add";

	const addButton = document.createElement("button");
	addButton.className = "bookmark-btn bookmark-btn-add";
	addButton.type = "button";
	addButton.dataset.bookmarkAction = "add";
	addButton.innerHTML =
		'<span class="bookmark-add-icon" aria-hidden="true">+</span><div class="bookmark-copy"><p>Add bookmark</p><span class="bookmark-url">Save a name and URL</span></div>';

	addCard.append(addButton);
	bookmarks.replaceChildren(...bookmarkCards, addCard);
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

	if (!nextBookmark.url) {
		showError("Bookmark URL cannot be empty.", "");
		return;
	}

	if (existing) {
		savedBookmarks = savedBookmarks.map((bookmark) =>
			bookmark.id === existing.id ? nextBookmark : bookmark
		);
	} else {
		savedBookmarks = [...savedBookmarks, nextBookmark];
	}

	appData.saveBookmarks(savedBookmarks);
	renderBookmarks();
}

function removeBookmark(bookmarkId) {
	const bookmark = savedBookmarks.find((entry) => entry.id === bookmarkId);
	if (!bookmark) return;
	if (!window.confirm(`Delete bookmark "${bookmark.name}"?`)) return;

	savedBookmarks = savedBookmarks.filter((entry) => entry.id !== bookmarkId);
	appData.saveBookmarks(savedBookmarks);
	renderBookmarks();
}

/**
 * @param {string} value
 */
function setMainAddress(value) {
	address.value = value;
}

/**
 * @param {string} value
 */
function setNavAddressValue(value) {
	navAddress.value = value;
}

/**
 * @param {string} url
 */
function decodeScramjetUrl(url) {
	if (!url) return "";

	try {
		const parsed = new URL(url, location.origin);
		if (
			parsed.origin === location.origin &&
			parsed.pathname.startsWith(DIRECT_IMPORT_PREFIX)
		) {
			return decodeURIComponent(
				parsed.pathname.slice(DIRECT_IMPORT_PREFIX.length)
			);
		}
	} catch (err) {
		if (url.startsWith(DIRECT_IMPORT_PREFIX)) {
			try {
				return decodeURIComponent(url.slice(DIRECT_IMPORT_PREFIX.length));
			} catch (decodeErr) {
				return url;
			}
		}
	}

	return url;
}

/**
 * @param {string} url
 */
function getDisplayUrl(url) {
	const decoded = decodeScramjetUrl(url);
	if (!decoded) return "";

	try {
		return new URL(decoded, location.origin).toString();
	} catch (err) {
		return decoded;
	}
}

/**
 * @param {string} url
 */
function getBookmarkCaption(url) {
	const displayUrl = getDisplayUrl(url);
	if (!displayUrl) return "";
	if (appData.isInternalUrl(displayUrl)) return displayUrl;

	try {
		return new URL(displayUrl).hostname.replace(/^www\./, "");
	} catch (err) {
		return displayUrl;
	}
}

/**
 * @param {string} url
 */
function getFallbackIcon(url) {
	const displayUrl = getDisplayUrl(url);
	if (!displayUrl || appData.isInternalUrl(displayUrl)) return "sj.png";

	try {
		const parsed = new URL(displayUrl, location.origin);
		if (parsed.origin === location.origin) return "sj.png";
		return appData.getBookmarkIcon(parsed.toString());
	} catch (err) {
		return "sj.png";
	}
}

/**
 * @param {string | null | undefined} icon
 * @param {string} url
 */
function setNavIcon(icon, url) {
	const nextIcon = icon || getFallbackIcon(url);
	navIcon.src = nextIcon;
	navIcon.dataset.fallback = getFallbackIcon(url);
}

function clearNavDisplay() {
	setNavAddressValue("");
	setNavIcon("", "");
}

/**
 * @param {{ url: string, isHome?: boolean } | null} tab
 */
function getDisplayedTabUrl(tab) {
	if (!tab) return "";
	return tab.isHome ? NEW_TAB_DISPLAY_URL : tab.url;
}

function syncChromeWithActiveTab() {
	const activeTab = getActiveTab();
	if (!browserVisible || !activeTab) {
		clearNavDisplay();
		return;
	}

	setNavAddressValue(getDisplayedTabUrl(activeTab));
	setNavIcon(activeTab.icon, activeTab.url || location.origin);
}

function updateBrowsingState() {
	document.body.classList.toggle("is-browsing", browserVisible);
	if (!browserVisible) {
		setMainAddress("");
		clearNavDisplay();
	}
}

function updateNavState() {
	const tab = getVisibleActiveTab();
	const ready = Boolean(tab);
	navAddress.disabled = !ready;
	navReload.disabled = !ready;
	navEscape.disabled = !ready;
	navBack.disabled = !ready || !canGoBack(tab);
	navForward.disabled = !ready || !canGoForward(tab);
	tabCreate.disabled = false;
}

/**
 * @param {string} url
 */
function getTabTitle(url) {
	const displayUrl = getDisplayUrl(url);
	if (!displayUrl) return "New Tab";
	if (displayUrl === NEW_TAB_DISPLAY_URL) return "New Tab";
	if (displayUrl === HISTORY_DISPLAY_URL) return "History";
	if (displayUrl === SETTINGS_DISPLAY_URL) return "Settings";

	try {
		const parsed = new URL(displayUrl);
		return parsed.hostname.replace(/^www\./, "") || parsed.toString();
	} catch (err) {
		return displayUrl;
	}
}

/**
 * @param {Location} currentLocation
 */
function extractDirectImportUrl(currentLocation) {
	if (!currentLocation.pathname.startsWith(DIRECT_IMPORT_PREFIX)) return "";

	const encoded = currentLocation.pathname.slice(DIRECT_IMPORT_PREFIX.length);
	if (!encoded) return "";

	try {
		return decodeURIComponent(encoded);
	} catch (err) {
		return "";
	}
}

/**
 * @param {string} url
 */
function normalizeLaunchTarget(url) {
	return appData.normalizeInput(url, appData.getSearchTemplate());
}

/**
 * @param {{ isHome?: boolean, url: string }} tab
 */
function getHistoryValueForTab(tab) {
	return tab.isHome ? NEW_TAB_HISTORY_URL : tab.url;
}

/**
 * @param {{ historyIndex?: number, historyEntries?: string[] } | null} tab
 */
function canGoBack(tab) {
	return Boolean(
		tab && Array.isArray(tab.historyEntries) && tab.historyIndex > 0
	);
}

/**
 * @param {{ historyIndex?: number, historyEntries?: string[] } | null} tab
 */
function canGoForward(tab) {
	return Boolean(
		tab &&
		Array.isArray(tab.historyEntries) &&
		tab.historyIndex < tab.historyEntries.length - 1
	);
}

/**
 * @param {{ historyEntries: string[], historyIndex: number, pendingHistoryDelta: number }} tab
 * @param {string} nextValue
 */
function commitTabHistory(tab, nextValue) {
	const previousValue = tab.historyEntries[tab.historyIndex] || "";
	let actionType = "navigate-commit";

	if (tab.pendingHistoryDelta) {
		actionType = tab.pendingHistoryDelta < 0 ? "back-commit" : "forward-commit";
		const nextIndex = tab.historyIndex + tab.pendingHistoryDelta;
		tab.pendingHistoryDelta = 0;
		tab.pendingNavigationValue = "";

		if (
			nextIndex >= 0 &&
			nextIndex < tab.historyEntries.length &&
			tab.historyEntries[nextIndex] === nextValue
		) {
			tab.historyIndex = nextIndex;
			recordTabAction(tab, actionType, {
				url: nextValue,
				title: getTabTitle(nextValue),
			});
			recordVisit(
				nextValue,
				tab.title || getTabTitle(nextValue),
				getFallbackIcon(nextValue)
			);
			return;
		}

		const knownIndex = tab.historyEntries.lastIndexOf(nextValue);
		if (knownIndex !== -1) {
			tab.historyIndex = knownIndex;
			recordTabAction(tab, actionType, {
				url: nextValue,
				title: getTabTitle(nextValue),
			});
			recordVisit(
				nextValue,
				tab.title || getTabTitle(nextValue),
				getFallbackIcon(nextValue)
			);
			return;
		}
	}

	if (tab.pendingNavigationValue) {
		tab.pendingNavigationValue = "";
		if (tab.historyEntries[tab.historyIndex] === nextValue) return;
		tab.historyEntries = tab.historyEntries.slice(0, tab.historyIndex + 1);
		tab.historyEntries.push(nextValue);
		tab.historyIndex = tab.historyEntries.length - 1;
		recordTabAction(tab, actionType, {
			url: nextValue,
			title: getTabTitle(nextValue),
		});
		recordVisit(
			nextValue,
			tab.title || getTabTitle(nextValue),
			getFallbackIcon(nextValue)
		);
		return;
	}

	if (tab.historyEntries[tab.historyIndex] === nextValue) return;

	tab.historyEntries = tab.historyEntries.slice(0, tab.historyIndex + 1);
	tab.historyEntries.push(nextValue);
	tab.historyIndex = tab.historyEntries.length - 1;
	recordTabAction(tab, actionType, {
		url: nextValue,
		title: getTabTitle(nextValue),
	});
	if (previousValue !== nextValue) {
		recordVisit(
			nextValue,
			tab.title || getTabTitle(nextValue),
			getFallbackIcon(nextValue)
		);
	}
}

function findTabBySource(sourceWindow) {
	return (
		tabs.find((tab) => tab.frame.frame.contentWindow === sourceWindow) || null
	);
}

function renderTabs() {
	const tabItems = tabs.map((tab) => {
		const item = document.createElement("div");
		item.className = "sj-tab" + (tab.id === activeTabId ? " is-active" : "");
		item.role = "presentation";

		const trigger = document.createElement("button");
		trigger.className = "sj-tab-trigger";
		trigger.type = "button";
		trigger.role = "tab";
		trigger.ariaSelected = String(tab.id === activeTabId);
		trigger.tabIndex = tab.id === activeTabId ? 0 : -1;
		trigger.title = tab.url || tab.title;

		const icon = document.createElement("img");
		icon.className = "sj-tab-icon";
		icon.alt = "";
		icon.ariaHidden = "true";
		icon.src = tab.icon || getFallbackIcon(tab.url);
		icon.addEventListener("error", () => {
			if (icon.src === icon.dataset.fallback) return;
			icon.src = icon.dataset.fallback || "sj.png";
		});
		icon.dataset.fallback = getFallbackIcon(tab.url);

		const label = document.createElement("span");
		label.className = "sj-tab-label";
		label.textContent = tab.title;

		trigger.append(icon, label);
		trigger.addEventListener("click", () => {
			activateTab(tab.id);
		});

		const close = document.createElement("button");
		close.className = "sj-tab-close";
		close.type = "button";
		close.ariaLabel = `Close ${tab.title}`;
		close.title = `Close ${tab.title}`;
		close.innerHTML =
			'<svg class="chrome-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path><path d="M16 8 8 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path></svg>';
		close.addEventListener("click", (event) => {
			event.stopPropagation();
			closeTab(tab.id);
		});

		item.append(trigger, close);
		return item;
	});

	tabList.replaceChildren(...tabItems, tabCreate);
	tabCreate.disabled = tabs.length >= MAX_TABS;
}

function activateTab(tabId) {
	const nextActive = tabs.find((tab) => tab.id === tabId);
	if (!nextActive) {
		activeTabId = null;
		updateBrowsingState();
		updateNavState();
		syncChromeWithActiveTab();
		renderTabs();
		return;
	}

	activeTabId = tabId;
	tabs.forEach((tab) => {
		tab.frame.frame.classList.toggle(
			"is-active",
			tab.id === tabId && browserVisible
		);
	});
	updateBrowsingState();
	updateNavState();
	syncChromeWithActiveTab();
	renderTabs();
	recordTabAction(nextActive, "tab-activated");
}

function createTab() {
	if (tabs.length >= MAX_TABS) return null;

	const frame = scramjet.createFrame();
	frame.frame.className = "sj-frame";
	frame.frame.title = "Scramjet browser frame";

	const tab = {
		id: `tab-${++nextTabId}`,
		frame,
		url: "",
		title: "New Tab",
		icon: "sj.png",
		isHome: true,
		historyEntries: [NEW_TAB_HISTORY_URL],
		historyIndex: 0,
		pendingHistoryDelta: 0,
		pendingNavigationValue: "",
		titleObserver: null,
	};

	frame.addEventListener("navigate", (event) => {
		updateTabLocation(tab.id, event.url);
	});
	frame.addEventListener("urlchange", (event) => {
		updateTabLocation(tab.id, event.url);
	});
	frame.frame.addEventListener("load", () => {
		refreshTabMetadata(tab.id);
		attachTitleObserver(tab.id);
	});

	document.body.appendChild(frame.frame);
	tabs.push(tab);
	loadTabHome(tab);
	activateTab(tab.id);
	recordTabAction(tab, "tab-created", {
		url: NEW_TAB_HISTORY_URL,
		title: "New Tab",
	});
	return tab;
}

function openNewTab() {
	const tab = createTab();
	if (!tab) return;
	showBrowser();
	activateTab(tab.id);
	setNavAddressValue(NEW_TAB_DISPLAY_URL);
	navAddress.focus();
}

/**
 * @param {string} tabId
 * @param {string} url
 */
function updateTabLocation(tabId, url) {
	const tab = tabs.find((entry) => entry.id === tabId);
	if (!tab) return;

	if (url === TAB_HOME_PATH || url.endsWith(TAB_HOME_PATH)) {
		tab.url = NEW_TAB_HISTORY_URL;
		tab.title = "New Tab";
		tab.icon = "sj.png";
		tab.isHome = true;
	} else if (url === HISTORY_PAGE_PATH || url.endsWith(HISTORY_PAGE_PATH)) {
		tab.url = HISTORY_DISPLAY_URL;
		tab.title = "History";
		tab.icon = "sj.png";
		tab.isHome = false;
	} else if (url === SETTINGS_PAGE_PATH || url.endsWith(SETTINGS_PAGE_PATH)) {
		tab.url = SETTINGS_DISPLAY_URL;
		tab.title = "Settings";
		tab.icon = "sj.png";
		tab.isHome = false;
	} else {
		tab.url = getDisplayUrl(url);
		tab.isHome = false;
		tab.title = getTabTitle(url);
		tab.icon = getFallbackIcon(url);
	}

	commitTabHistory(tab, getHistoryValueForTab(tab));

	if (tab.id === activeTabId) {
		syncChromeWithActiveTab();
		updateNavState();
	}

	renderTabs();
}

function showBrowser() {
	if (!hasTabs()) return;
	browserVisible = true;
	const activeTab = getActiveTab();
	if (activeTab) {
		tabs.forEach((tab) => {
			tab.frame.frame.classList.toggle("is-active", tab.id === activeTab.id);
		});
	}
	updateBrowsingState();
	updateNavState();
	syncChromeWithActiveTab();
}

function hideBrowser() {
	if (!browserVisible) return;

	browserVisible = false;
	tabs.forEach((tab) => {
		tab.frame.frame.classList.remove("is-active");
	});
	updateBrowsingState();
	updateNavState();
	address.focus();
}

function handleImportedTab(sourceWindow, url) {
	const sourceTab = findTabBySource(sourceWindow);
	if (sourceTab) closeTab(sourceTab.id);
	void openImportedTab(url);
}

function handleTabHomeLaunch(sourceWindow, url) {
	const sourceTab = findTabBySource(sourceWindow);
	if (!sourceTab) return;
	void navigateTabToInput(sourceTab, url);
}

function handleHistoryLaunch(sourceWindow, url) {
	const sourceTab = findTabBySource(sourceWindow);
	if (!sourceTab) return;
	void navigateTabToInput(sourceTab, url);
}

function handleSettingsLaunch(sourceWindow, url) {
	const sourceTab = findTabBySource(sourceWindow);
	if (!sourceTab) return;
	void navigateTabToInput(sourceTab, url);
}

function loadTabHome(tab) {
	recordTabAction(tab, "navigate-request", {
		url: NEW_TAB_HISTORY_URL,
		title: "New Tab",
	});
	tab.frame.frame.src = TAB_HOME_PATH;
	tab.frame.frame.classList.toggle(
		"is-active",
		tab.id === activeTabId && browserVisible
	);
	tab.url = NEW_TAB_HISTORY_URL;
	tab.title = "New Tab";
	tab.icon = "sj.png";
	tab.isHome = true;
	tab.historyEntries = [NEW_TAB_HISTORY_URL];
	tab.historyIndex = 0;
	tab.pendingHistoryDelta = 0;
	tab.pendingNavigationValue = "";
}

function loadHistoryPage(tab) {
	recordTabAction(tab, "navigate-request", {
		url: HISTORY_DISPLAY_URL,
		title: "History",
	});
	tab.pendingHistoryDelta = 0;
	tab.pendingNavigationValue = HISTORY_DISPLAY_URL;
	tab.frame.frame.src = HISTORY_PAGE_PATH;
	tab.frame.frame.classList.toggle(
		"is-active",
		tab.id === activeTabId && browserVisible
	);
	tab.url = HISTORY_DISPLAY_URL;
	tab.title = "History";
	tab.icon = "sj.png";
	tab.isHome = false;
}

function loadSettingsPage(tab) {
	recordTabAction(tab, "navigate-request", {
		url: SETTINGS_DISPLAY_URL,
		title: "Settings",
	});
	tab.pendingHistoryDelta = 0;
	tab.pendingNavigationValue = SETTINGS_DISPLAY_URL;
	tab.frame.frame.src = SETTINGS_PAGE_PATH;
	tab.frame.frame.classList.toggle(
		"is-active",
		tab.id === activeTabId && browserVisible
	);
	tab.url = SETTINGS_DISPLAY_URL;
	tab.title = "Settings";
	tab.icon = "sj.png";
	tab.isHome = false;
}

/**
 * @param {{ frame: { frame: HTMLIFrameElement } }} tab
 */
function isTabShowingHome(tab) {
	try {
		const currentPath = tab.frame.frame.contentWindow?.location.pathname;
		return currentPath === TAB_HOME_PATH;
	} catch (err) {
		return false;
	}
}

/**
 * @param {{ frame: { frame: HTMLIFrameElement } }} tab
 */
function isTabShowingHistory(tab) {
	try {
		const currentPath = tab.frame.frame.contentWindow?.location.pathname;
		return currentPath === HISTORY_PAGE_PATH;
	} catch (err) {
		return false;
	}
}

/**
 * @param {{ frame: { frame: HTMLIFrameElement } }} tab
 */
function isTabShowingSettings(tab) {
	try {
		const currentPath = tab.frame.frame.contentWindow?.location.pathname;
		return currentPath === SETTINGS_PAGE_PATH;
	} catch (err) {
		return false;
	}
}

/**
 * @param {string} tabId
 */
function refreshTabMetadata(tabId) {
	const tab = tabs.find((entry) => entry.id === tabId);
	if (!tab) return;

	try {
		const doc = tab.frame.frame.contentDocument;
		if (!doc) return;

		if (isTabShowingHome(tab)) {
			tab.url = NEW_TAB_HISTORY_URL;
			tab.title = "New Tab";
			tab.icon = "sj.png";
			tab.isHome = true;
			commitTabHistory(tab, NEW_TAB_HISTORY_URL);

			if (tab.id === activeTabId) {
				syncChromeWithActiveTab();
				updateNavState();
			}

			renderTabs();
			return;
		}

		if (isTabShowingHistory(tab)) {
			tab.url = HISTORY_DISPLAY_URL;
			tab.title = "History";
			tab.icon = "sj.png";
			tab.isHome = false;
			commitTabHistory(tab, HISTORY_DISPLAY_URL);

			if (tab.id === activeTabId) {
				syncChromeWithActiveTab();
				updateNavState();
			}

			renderTabs();
			return;
		}

		if (isTabShowingSettings(tab)) {
			tab.url = SETTINGS_DISPLAY_URL;
			tab.title = "Settings";
			tab.icon = "sj.png";
			tab.isHome = false;
			commitTabHistory(tab, SETTINGS_DISPLAY_URL);

			if (tab.id === activeTabId) {
				syncChromeWithActiveTab();
				updateNavState();
			}

			renderTabs();
			return;
		}

		const title = doc.title.trim();

		tab.isHome = false;
		tab.title = title || getTabTitle(tab.url);
		tab.icon = getFallbackIcon(tab.url);
		commitTabHistory(tab, getHistoryValueForTab(tab));

		if (tab.id === activeTabId) {
			syncChromeWithActiveTab();
			updateNavState();
		}

		renderTabs();
	} catch (err) {
		tab.title = getTabTitle(tab.url);
		tab.icon = getFallbackIcon(tab.url);
		if (tab.id === activeTabId) {
			syncChromeWithActiveTab();
			updateNavState();
		}
		renderTabs();
	}
}

/**
 * @param {string} tabId
 */
function attachTitleObserver(tabId) {
	const tab = tabs.find((entry) => entry.id === tabId);
	if (!tab) return;

	tab.titleObserver?.disconnect();

	try {
		const doc = tab.frame.frame.contentDocument;
		if (!doc?.head) return;

		const observer = new MutationObserver(() => {
			refreshTabMetadata(tabId);
		});
		observer.observe(doc.head, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		tab.titleObserver = observer;
	} catch (err) {
		tab.titleObserver = null;
	}
}

/**
 * @param {string} tabId
 */
function closeTab(tabId) {
	const index = tabs.findIndex((tab) => tab.id === tabId);
	if (index === -1) return;

	const [tab] = tabs.splice(index, 1);
	recordTabAction(tab, "tab-closed");
	tab.titleObserver?.disconnect();
	tab.frame.frame.remove();

	if (!tabs.length) {
		activeTabId = null;
		browserVisible = false;
		updateBrowsingState();
		updateNavState();
		syncChromeWithActiveTab();
		renderTabs();
		address.focus();
		return;
	}

	if (activeTabId === tabId) {
		const fallback = tabs[index] || tabs[index - 1] || tabs[0];
		activateTab(fallback.id);
		return;
	}

	updateBrowsingState();
	updateNavState();
	renderTabs();
}

/**
 * @param {string} input
 */
async function openImportedTab(input) {
	const tab = createTab();
	if (!tab) return;
	showBrowser();
	activateTab(tab.id);
	await navigateTabToInput(tab, input);
}

/**
 * @param {{ id: string, frame: any, url: string, title: string, icon: string }} tab
 * @param {string} input
 */
async function navigateTabToInput(tab, input) {
	const value = input.trim();
	if (!value) return;

	const url = normalizeLaunchTarget(value);
	const displayUrl = getDisplayUrl(url);
	recordTabAction(tab, "navigate-request", {
		url: displayUrl,
		title: getTabTitle(displayUrl),
	});

	if (displayUrl === NEW_TAB_HISTORY_URL) {
		showBrowser();
		activateTab(tab.id);
		loadTabHome(tab);
		syncChromeWithActiveTab();
		updateNavState();
		return;
	}

	if (displayUrl === HISTORY_DISPLAY_URL) {
		showBrowser();
		activateTab(tab.id);
		loadHistoryPage(tab);
		syncChromeWithActiveTab();
		updateNavState();
		return;
	}

	if (displayUrl === SETTINGS_DISPLAY_URL) {
		showBrowser();
		activateTab(tab.id);
		loadSettingsPage(tab);
		syncChromeWithActiveTab();
		updateNavState();
		return;
	}

	await prepareTransport();
	tab.url = displayUrl;
	tab.title = getTabTitle(displayUrl);
	tab.icon = getFallbackIcon(displayUrl);
	tab.isHome = false;
	tab.pendingHistoryDelta = 0;
	tab.pendingNavigationValue = displayUrl;
	showBrowser();
	activateTab(tab.id);
	syncChromeWithActiveTab();
	updateNavState();
	tab.frame.go(url);
}

/**
 * @param {string} message
 * @param {unknown} detail
 */
function showError(message, detail) {
	error.textContent = message;
	errorCode.textContent =
		detail instanceof Error
			? detail.stack || detail.message
			: String(detail || "");
}

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

/**
 * @param {string} input
 */
async function launch(input) {
	const value = input.trim();
	if (!value) {
		(browserVisible ? navAddress : address).focus();
		return;
	}

	clearError();

	try {
		const tab = browserVisible ? getActiveTab() || createTab() : createTab();
		if (!tab) return;
		await navigateTabToInput(tab, value);
	} catch (err) {
		showError("Failed to start the proxy session.", err);
		console.error(err);
	}
}

navIcon.addEventListener("error", () => {
	const fallback = navIcon.dataset.fallback || "sj.png";
	if (navIcon.src === fallback) return;
	navIcon.src = fallback;
});

if (pendingDirectImportUrl) {
	if (window.parent !== window && window.parent) {
		window.parent.postMessage(
			{
				type: "sj-import-tab",
				url: pendingDirectImportUrl,
			},
			location.origin
		);
	} else {
		history.replaceState({}, "", "/");
		void openImportedTab(pendingDirectImportUrl);
	}
}
