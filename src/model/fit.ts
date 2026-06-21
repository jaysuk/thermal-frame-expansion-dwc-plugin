/**
 * Pure analysis helpers for the thermal-expansion measurement — kept free of Vue/DWC so they can be
 * unit-tested directly (see src/__tests__/fit.test.ts).
 */

/** Outcome of the ordinary-least-squares fit of ΔZ against frame temperature. */
export interface FitResult {
	/** Thermal-expansion coefficient (mm of Z drift per °C of frame temperature). */
	slope: number;
	intercept: number;
	/** Coefficient of determination (0–1); how well the linear model explains the data. */
	r2: number;
	/** Number of points used in the fit. */
	nPoints: number;
}

/** A failed fit carries a human-readable reason instead of a result. */
export type FitOutcome =
	| { ok: true; result: FitResult }
	| { ok: false; error: string };

/**
 * Ordinary-least-squares straight-line fit of y (ΔZ) against x (frame temperature), returning the
 * slope (the expansion coefficient), intercept and R². Returns an error outcome when there are too
 * few points or the frame temperature didn't vary enough to define a slope.
 */
export function linearFit(x: ReadonlyArray<number>, y: ReadonlyArray<number>): FitOutcome {
	const n = Math.min(x.length, y.length);
	if (n < 2) {
		return { ok: false, error: "Not enough data points with frame temperature readings to fit a line." };
	}

	let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
	for (let i = 0; i < n; i++) {
		sumX += x[i];
		sumY += y[i];
		sumXY += x[i] * y[i];
		sumX2 += x[i] * x[i];
	}
	const denom = n * sumX2 - sumX * sumX;
	if (Math.abs(denom) < 1e-12) {
		return { ok: false, error: "Frame temperature did not vary enough to fit a coefficient." };
	}

	const slope = (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;

	const yMean = sumY / n;
	let ssTot = 0, ssRes = 0;
	for (let i = 0; i < n; i++) {
		ssTot += (y[i] - yMean) ** 2;
		const resid = y[i] - (slope * x[i] + intercept);
		ssRes += resid ** 2;
	}
	const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;

	return { ok: true, result: { slope, intercept, r2, nPoints: n } };
}

/**
 * Parse a Z probe trigger height from a `G30 S-1` reply, e.g.
 * "Z probe trigger height 1.234 mm". Falls back to the first decimal number in the reply. Returns
 * null when no number can be found.
 */
export function parseProbeHeight(reply: string | null | undefined): number | null {
	const text = reply ?? "";
	let m = text.match(/([-+]?\d+\.\d+)\s*mm/);
	if (m) {
		return parseFloat(m[1]);
	}
	m = text.match(/[-+]?\d+\.\d+/);
	return m ? parseFloat(m[0]) : null;
}

/** Rough estimate of total run duration in hours (heating + soak + measure + cool + overhead). */
export function estimateDurationHours(c: {
	hotDuration: number;
	coolDuration: number;
	soakTime: number;
}): number {
	return c.hotDuration + c.coolDuration + c.soakTime / 60 + 0.5; // +0.5h for homing/tramming
}

/** Qualitative description of a fit's R² for the UI. */
export function r2Quality(r2: number): { level: "good" | "ok" | "poor"; message: string } {
	if (r2 >= 0.90) {
		return { level: "good", message: `Strong linear fit (R² ${r2.toFixed(3)}). The coefficient is reliable.` };
	}
	if (r2 >= 0.75) {
		return { level: "ok", message: `Moderate fit (R² ${r2.toFixed(3)}). Result is usable but consider checking sensor placement.` };
	}
	return { level: "poor", message: `Poor fit (R² ${r2.toFixed(3)}). The relationship may not be linear — check for non-frame heat sources or an incorrectly placed sensor.` };
}
