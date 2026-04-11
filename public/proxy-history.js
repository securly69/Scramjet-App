"use strict";

const historyList = document.getElementById("history-list");
const historyActions = document.getElementById("history-actions");
const historyCount = document.getElementById("history-count");
const appData = window.ProxyAppData;

render();

window.addEventListener("message", (event) => {
	if (event.origin !== location.origin) return;
	if (event.data?.type === "sj-history-updated") render();
});

window.addEventListener("storage", (event) => {
	if (
		event.key === "sj-visit-history-v1" ||
		event.key === "sj-tab-actions-v1" ||
		event.key === "sj-bookmarks-v1"
	) {
		render();
	}
});

historyList.addEventListener("click", (event) => {
	const trigger = event.target.closest("[data-history-url]");
	if (!(trigger instanceof HTMLElement)) return;

	const url = trigger.dataset.historyUrl || "";
	if (!url) return;

	window.parent.postMessage(
		{
			type: "sj-history-launch",
			url,
		},
		location.origin
	);
});

function render() {
	const visits = appData.getBrowsingHistory();
	const actions = appData.getTabActionLog();

	historyCount.textContent = `${visits.length} entr${visits.length === 1 ? "y" : "ies"}`;
	renderVisits(visits);
	renderActions(actions);
}

/**
 * @param {Array<{ url: string, title: string, icon: string, visitedAt: string }>} visits
 */
function renderVisits(visits) {
	if (!visits.length) {
		const empty = document.createElement("div");
		empty.className = "history-empty";
		empty.textContent = "No visits yet.";
		historyList.replaceChildren(empty);
		return;
	}

	historyList.replaceChildren(
		...visits.map((visit) => {
			const item = document.createElement("button");
			item.className = "history-entry";
			item.type = "button";
			item.dataset.historyUrl = visit.url;

			const icon = document.createElement("img");
			icon.className = "history-entry-icon";
			icon.alt = "";
			icon.ariaHidden = "true";
			icon.src = visit.icon || appData.getBookmarkIcon(visit.url);
			icon.addEventListener("error", () => {
				icon.src = "sj.png";
			});

			const copy = document.createElement("div");
			copy.className = "history-entry-copy";

			const title = document.createElement("span");
			title.className = "history-entry-title";
			title.textContent = visit.title || visit.url;

			const meta = document.createElement("span");
			meta.className = "history-entry-url";
			meta.textContent = `${getHostLabel(visit.url)} • ${formatTimestamp(visit.visitedAt)}`;

			copy.append(title, meta);
			item.append(icon, copy);
			return item;
		})
	);
}

/**
 * @param {Array<{ type: string, tabId: string, title: string, url: string, at: string, detail: string }>} actions
 */
function renderActions(actions) {
	if (!actions.length) {
		const empty = document.createElement("div");
		empty.className = "history-empty";
		empty.textContent = "No tab actions yet.";
		historyActions.replaceChildren(empty);
		return;
	}

	historyActions.replaceChildren(
		...actions.map((action) => {
			const item = document.createElement("div");
			item.className = "history-action";

			const icon = document.createElement("img");
			icon.className = "history-action-icon";
			icon.alt = "";
			icon.ariaHidden = "true";
			icon.src = appData.getBookmarkIcon(action.url || "");
			icon.addEventListener("error", () => {
				icon.src = "sj.png";
			});

			const copy = document.createElement("div");
			copy.className = "history-action-copy";

			const title = document.createElement("span");
			title.className = "history-action-title";
			title.textContent = formatActionTitle(action);

			const meta = document.createElement("span");
			meta.className = "history-action-meta";
			meta.textContent = [
				action.tabId || "tab",
				action.url || action.detail || "no target",
				formatTimestamp(action.at),
			]
				.filter(Boolean)
				.join(" • ");

			copy.append(title, meta);
			item.append(icon, copy);
			return item;
		})
	);
}

/**
 * @param {string} url
 */
function getHostLabel(url) {
	if (!url) return "Unknown";

	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, "") || parsed.toString();
	} catch (err) {
		return url;
	}
}

/**
 * @param {string} value
 */
function formatTimestamp(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
}

/**
 * @param {{ type: string, title: string, url: string }} action
 */
function formatActionTitle(action) {
	switch (action.type) {
		case "tab-created":
			return "Tab created";
		case "tab-closed":
			return "Tab closed";
		case "tab-activated":
			return "Tab selected";
		case "navigate-request":
			return `Navigate to ${action.title || action.url}`;
		case "navigate-commit":
			return `Loaded ${action.title || action.url}`;
		case "back-request":
			return "Back requested";
		case "back-commit":
			return `Went back to ${action.title || action.url}`;
		case "forward-request":
			return "Forward requested";
		case "forward-commit":
			return `Went forward to ${action.title || action.url}`;
		case "reload":
			return `Reloaded ${action.title || action.url}`;
		default:
			return action.title || action.type;
	}
}
