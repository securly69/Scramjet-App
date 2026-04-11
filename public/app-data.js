"use strict";

(function bootstrapAppData() {
	const BOOKMARKS_KEY = "sj-bookmarks-v1";
	const SEARCH_ENGINE_KEY = "sj-search-engine-v1";
	const VISIT_HISTORY_KEY = "sj-visit-history-v1";
	const TAB_ACTIONS_KEY = "sj-tab-actions-v1";
	const DEFAULT_SEARCH_ENGINE_ID = "google";
	const INTERNAL_NEW_TAB_URL = "proxy://newtab";
	const INTERNAL_HISTORY_URL = "proxy://history";
	const INTERNAL_SETTINGS_URL = "proxy://settings";

	const DEFAULT_BOOKMARKS = [
		{ id: "google", name: "Google", url: "https://google.com" },
		{ id: "youtube", name: "YouTube", url: "https://youtube.com" },
		{ id: "discord", name: "Discord", url: "https://discord.com" },
		{ id: "reddit", name: "Reddit", url: "https://reddit.com" },
		{ id: "github", name: "GitHub", url: "https://github.com" },
	];

	const SEARCH_ENGINES = [
		{
			id: "google",
			name: "Google",
			template: "https://www.google.com/search?q=%s",
		},
		{
			id: "duckduckgo",
			name: "DuckDuckGo",
			template: "https://duckduckgo.com/?q=%s",
		},
		{
			id: "bing",
			name: "Bing",
			template: "https://www.bing.com/search?q=%s",
		},
		{
			id: "brave",
			name: "Brave",
			template: "https://search.brave.com/search?q=%s",
		},
	];

	function readJson(key, fallback) {
		try {
			const stored = localStorage.getItem(key);
			if (!stored) return fallback;
			const parsed = JSON.parse(stored);
			return parsed ?? fallback;
		} catch (err) {
			return fallback;
		}
	}

	function writeJson(key, value) {
		localStorage.setItem(key, JSON.stringify(value));
	}

	function normalizeBookmark(bookmark, index) {
		const nextUrl = String(bookmark.url || "").trim();
		return {
			id: bookmark.id || `bookmark-${Date.now()}-${index}`,
			name: String(bookmark.name || "Bookmark").trim() || "Bookmark",
			url: nextUrl ? normalizeInput(nextUrl) : "",
		};
	}

	function loadBookmarks() {
		const stored = readJson(BOOKMARKS_KEY, DEFAULT_BOOKMARKS);
		if (!Array.isArray(stored) || !stored.length)
			return DEFAULT_BOOKMARKS.slice();
		return stored.map(normalizeBookmark).filter((bookmark) => bookmark.url);
	}

	function saveBookmarks(bookmarks) {
		writeJson(BOOKMARKS_KEY, bookmarks.map(normalizeBookmark));
	}

	function getSearchEngines() {
		return SEARCH_ENGINES.slice();
	}

	function loadSearchEngineId() {
		const stored = localStorage.getItem(SEARCH_ENGINE_KEY);
		if (SEARCH_ENGINES.some((engine) => engine.id === stored)) return stored;
		return DEFAULT_SEARCH_ENGINE_ID;
	}

	function saveSearchEngineId(engineId) {
		localStorage.setItem(SEARCH_ENGINE_KEY, engineId);
	}

	function getSearchEngineById(engineId) {
		return (
			SEARCH_ENGINES.find((engine) => engine.id === engineId) ||
			SEARCH_ENGINES.find((engine) => engine.id === DEFAULT_SEARCH_ENGINE_ID)
		);
	}

	function getCurrentSearchTemplate() {
		return getSearchEngineById(loadSearchEngineId()).template;
	}

	function isInternalUrl(url) {
		return (
			typeof url === "string" &&
			(url === INTERNAL_NEW_TAB_URL || url === INTERNAL_HISTORY_URL || url === INTERNAL_SETTINGS_URL)
		);
	}

	function normalizeInput(input, template = getCurrentSearchTemplate()) {
		const value = String(input || "").trim();
		if (!value) return "";
		if (isInternalUrl(value)) return value;

		try {
			return new URL(value).toString();
		} catch (err) {
			// continue
		}

		try {
			const httpsUrl = new URL(`https://${value}`);
			if (httpsUrl.hostname.includes(".")) return httpsUrl.toString();
		} catch (err) {
			// continue
		}

		return template.replace("%s", encodeURIComponent(value));
	}

	function getBookmarkIcon(url) {
		if (!url || isInternalUrl(url)) return "sj.png";

		try {
			const normalizedUrl = new URL(url, location.origin).toString();
			return (
				"https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON" +
				"&fallback_opts=TYPE,SIZE,URL" +
				`&url=${encodeURIComponent(normalizedUrl)}` +
				"&size=256"
			);
		} catch (err) {
			return "sj.png";
		}
	}

	function loadVisitHistory() {
		const stored = readJson(VISIT_HISTORY_KEY, []);
		return Array.isArray(stored) ? stored : [];
	}

	function saveVisitHistory(entries) {
		writeJson(VISIT_HISTORY_KEY, entries);
	}

	function recordVisit(entry) {
		const nextEntry = {
			id:
				entry.id ||
				`visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			url: normalizeInput(entry.url || ""),
			title: String(entry.title || "").trim() || "Untitled",
			icon: entry.icon || getBookmarkIcon(entry.url || ""),
			visitedAt: entry.visitedAt || new Date().toISOString(),
		};
		if (!nextEntry.url || isInternalUrl(nextEntry.url)) return;

		const history = loadVisitHistory();
		history.unshift(nextEntry);
		saveVisitHistory(history);
	}

	function loadTabActions() {
		const stored = readJson(TAB_ACTIONS_KEY, []);
		return Array.isArray(stored) ? stored : [];
	}

	function saveTabActions(entries) {
		writeJson(TAB_ACTIONS_KEY, entries);
	}

	function recordTabAction(entry) {
		const action = {
			id:
				entry.id ||
				`action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			tabId: String(entry.tabId || ""),
			type: String(entry.type || "unknown"),
			url: entry.url ? normalizeInput(entry.url) : "",
			title: String(entry.title || "").trim(),
			detail: String(entry.detail || "").trim(),
			at: entry.at || new Date().toISOString(),
		};
		const actions = loadTabActions();
		actions.unshift(action);
		saveTabActions(actions);
	}

	window.ProxyAppData = {
		getBookmarkIcon,
		getBookmarks: loadBookmarks,
		getInternalHistoryUrl: () => INTERNAL_HISTORY_URL,
		getInternalNewTabUrl: () => INTERNAL_NEW_TAB_URL,
		getInternalSettingsUrl: () => INTERNAL_SETTINGS_URL,
		saveBookmarks,
		resetBookmarks: () => saveBookmarks(DEFAULT_BOOKMARKS),
		getBrowsingHistory: loadVisitHistory,
		getSearchEngines,
		getSearchEngineById,
		getSearchEngineId: loadSearchEngineId,
		getSearchTemplate: getCurrentSearchTemplate,
		getTabActionLog: loadTabActions,
		isInternalUrl,
		normalizeInput,
		recordTabAction,
		recordVisit,
		saveSearchEngineId,
	};
})();
