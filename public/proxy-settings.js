"use strict";

const resetBtn = document.getElementById("reset-bookmarks-btn");
const appData = window.ProxyAppData;

resetBtn.addEventListener("click", () => {
	if (!window.confirm("Are you sure you want to reset all bookmarks to default?")) return;
	appData.resetBookmarks();
	window.parent.postMessage({ type: "sj-tab-home-bookmarks-updated" }, location.origin);
	alert("Bookmarks have been reset.");
});
