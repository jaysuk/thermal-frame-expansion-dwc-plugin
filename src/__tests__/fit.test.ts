import { describe, expect, it } from "vitest";

import { estimateDurationHours, linearFit, parseProbeHeight, r2Quality } from "../model/fit";

describe("linearFit", () => {
	it("recovers a known slope and intercept with R²=1 on perfect data", () => {
		// y = 0.01·x + 2  (e.g. 0.01 mm of Z drift per °C)
		const x = [20, 30, 40, 50, 60];
		const y = x.map((t) => 0.01 * t + 2);
		const r = linearFit(x, y);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.result.slope).toBeCloseTo(0.01, 9);
			expect(r.result.intercept).toBeCloseTo(2, 9);
			expect(r.result.r2).toBeCloseTo(1, 9);
			expect(r.result.nPoints).toBe(5);
		}
	});

	it("still fits a positive slope through noisy data with a high R²", () => {
		const x = [20, 30, 40, 50, 60, 70];
		const y = [0.0, 0.11, 0.19, 0.32, 0.38, 0.51]; // ~0.01/°C with noise
		const r = linearFit(x, y);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.result.slope).toBeGreaterThan(0);
			expect(r.result.r2).toBeGreaterThan(0.95);
		}
	});

	it("fails with fewer than two points", () => {
		const r = linearFit([20], [0.1]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/Not enough/i);
	});

	it("fails when the frame temperature never varies (zero spread)", () => {
		const r = linearFit([40, 40, 40], [0.1, 0.2, 0.3]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/did not vary/i);
	});
});

describe("parseProbeHeight", () => {
	it("parses the RRF trigger-height reply", () => {
		expect(parseProbeHeight("Z probe trigger height 1.234 mm")).toBeCloseTo(1.234, 6);
	});
	it("parses a negative height", () => {
		expect(parseProbeHeight("Stopped at height -0.052 mm")).toBeCloseTo(-0.052, 6);
	});
	it("falls back to the first decimal number", () => {
		expect(parseProbeHeight("result was 2.5 somewhere")).toBeCloseTo(2.5, 6);
	});
	it("returns null when there is no number", () => {
		expect(parseProbeHeight("no numbers here")).toBeNull();
		expect(parseProbeHeight(null)).toBeNull();
		expect(parseProbeHeight(undefined)).toBeNull();
	});
});

describe("estimateDurationHours", () => {
	it("sums measure + cool + soak (converted to hours) + overhead", () => {
		// 3 + 0 + 5/60 + 0.5 = ~3.583
		expect(estimateDurationHours({ hotDuration: 3, coolDuration: 0, soakTime: 5 })).toBeCloseTo(3.5833, 3);
	});
});

describe("r2Quality", () => {
	it("classifies fit quality by threshold", () => {
		expect(r2Quality(0.95).level).toBe("good");
		expect(r2Quality(0.80).level).toBe("ok");
		expect(r2Quality(0.50).level).toBe("poor");
	});
});
