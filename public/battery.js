"use strict";

(function() {
    function updateBatteryUI(battery) {
        const percentage = Math.floor(battery.level * 100);
        const text = battery.charging ? "Charging" : "Battery";
        
        document.querySelectorAll(".battery-text").forEach(el => el.textContent = text);
        document.querySelectorAll(".battery-percentage").forEach(el => el.textContent = percentage + "%");
        
        document.querySelectorAll(".battery-visual").forEach(el => {
            if (battery.charging) {
                el.classList.add("charging");
                const icon = el.querySelector(".battery-charge-icon");
                if (icon) icon.style.display = "block";
            } else {
                el.classList.remove("charging");
                const icon = el.querySelector(".battery-charge-icon");
                if (icon) icon.style.display = "none";
            }
        });
        
        document.querySelectorAll(".battery-fill").forEach(el => {
            el.style.width = percentage + "%";
        });
    }

    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            updateBatteryUI(battery);
            
            battery.addEventListener("chargingchange", () => updateBatteryUI(battery));
            battery.addEventListener("levelchange", () => updateBatteryUI(battery));
        });
    }
})();
