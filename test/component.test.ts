import { beforeEach, describe, expect, it } from "vitest";

import { mountInDwc, resetDwc, setModel } from "dwc-plugin-test-kit";

import ThermalFrameExpansion from "../src/ThermalFrameExpansion.vue";

describe("ThermalFrameExpansion", () => {
	beforeEach(() => resetDwc());

	it("mounts without throwing (disconnected, empty model)", () => {
		const wrapper = mountInDwc(ThermalFrameExpansion);
		expect(wrapper.exists()).toBe(true);
	});

	it("detects the configured frame sensor in the object model", async () => {
		setModel({
			sensors: { analog: [{ name: "Frame", lastReading: 42.5 }] },
			heat: { heaters: [{ current: 25 }], bedHeaters: [0] },
			move: { axes: [{ letter: "X", min: 0, max: 300, homed: true, visible: true }] },
			plugins: {},
		});
		const wrapper = mountInDwc(ThermalFrameExpansion);
		await wrapper.vm.$nextTick();
		// The Setup tab (the default) shows a "Sensor found" alert with the live reading once the named
		// sensor resolves in the object model — exercises the frameSensorIndex/frameTemp computeds.
		expect(wrapper.text()).toContain("Sensor found");
		expect(wrapper.text()).toContain("42.5");
	});
});
