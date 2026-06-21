/**
 * Thermal Frame Expansion — entry point.
 *
 * Registers a standalone DWC page (under Plugins → Thermal Expansion) that walks the user through a
 * heat-soak + repeated-probe run and fits the frame thermal-expansion coefficient (Z drift vs frame
 * temperature). Wires in the shared runtime: uncaught-error capture for diagnostics and the
 * cross-plugin self-update hub. App-lifetime resources are torn down on `dwcPluginUnloaded`.
 */
import { registerPluginMessages, registerRoute, unregisterRoute } from "@/plugins";
import Events from "@/utils/events";
import { clearAnnouncedUpdate, installErrorCapture } from "dwc-plugin-runtime";

import ThermalFrameExpansion from "./ThermalFrameExpansion.vue";
import { PLUGIN_ID, PLUGIN_MANIFEST_ID, ROUTE_PATH } from "./model/constants";
import { runUpdateCheck } from "./model/updateCheck";
import en from "./i18n/en.json";

registerPluginMessages(PLUGIN_ID, { en });

// registerRoute is idempotent by path in DWC 3.7 — a repeated registration is a no-op, so a plugin
// reload no longer stacks a duplicate drawer entry.
registerRoute(ThermalFrameExpansion, {
	Plugins: {
		ThermalFrameExpansion: {
			icon: "mdi-thermometer-lines",
			caption: "plugins.thermalFrameExpansion.menuCaption",
			path: ROUTE_PATH,
		},
	},
});

// Buffer uncaught errors/rejections for diagnostics; cleaned up on unload.
const uninstallErrorCapture = installErrorCapture();

// Check GitHub for a newer release shortly after load and announce it into the shared update hub.
// Deferred so the connection/object-model has settled enough to read the installed version.
setTimeout(() => { void runUpdateCheck({ notify: true }); }, 4000);

function onPluginUnloaded(id: string): void {
	if (id === PLUGIN_MANIFEST_ID) {
		unregisterRoute(ROUTE_PATH);
		clearAnnouncedUpdate(PLUGIN_MANIFEST_ID); // drop us from the unified popup
		uninstallErrorCapture();
		Events.off("dwcPluginUnloaded", onPluginUnloaded);
	}
}
Events.on("dwcPluginUnloaded", onPluginUnloaded);
