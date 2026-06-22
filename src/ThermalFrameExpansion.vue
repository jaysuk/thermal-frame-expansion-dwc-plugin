<template>
	<v-row>
		<v-col>
			<v-card>
				<v-tabs v-model="tab" color="primary">
					<v-tab value="setup"><v-icon start>mdi-cog-outline</v-icon>Setup</v-tab>
					<v-tab value="measure"><v-icon start>mdi-play-circle-outline</v-icon>Measure</v-tab>
					<v-tab value="results" :disabled="!result"><v-icon start>mdi-chart-scatter-plot</v-icon>Results</v-tab>
					<v-tab value="about"><v-icon start>mdi-information-outline</v-icon>About</v-tab>
				</v-tabs>

				<v-tabs-window v-model="tab">

					<!-- ── SETUP ──────────────────────────────────────────── -->
					<v-tabs-window-item value="setup">
						<v-card-text>
							<v-row>
								<v-col cols="12" md="6">
									<div class="text-subtitle-2 mb-2">Frame Sensor</div>
									<v-text-field v-model="config.frameSensor" label="Sensor name"
												  hint='Must match the A"name" in your M308 command in config.g'
												  persistent-hint variant="outlined" density="compact" />
									<v-alert v-if="frameSensorIndex === -1 && isConnected" type="warning" density="compact" class="mt-2">
										Sensor "{{ config.frameSensor }}" not found in object model.
										Check your M308 A"name" value.
									</v-alert>
									<v-alert v-if="frameSensorIndex >= 0" type="success" density="compact" class="mt-2">
										Sensor found — currently {{ frameTemp !== null ? frameTemp.toFixed(1) + '°C' : 'reading…' }}
									</v-alert>
								</v-col>

								<v-col cols="12" md="6">
									<div class="text-subtitle-2 mb-2">Temperatures</div>
									<v-text-field v-model.number="config.bedTemp" label="Bed target (°C)"
												  type="number" min="40" max="130" variant="outlined" density="compact" class="mb-2" />
									<v-text-field v-model.number="config.heTemp" label="Hotend target (°C, 0 to leave cold)"
												  type="number" min="0" max="300" variant="outlined" density="compact" />
								</v-col>
							</v-row>

							<v-row>
								<v-col cols="12" md="6">
									<div class="text-subtitle-2 mb-2">Timing</div>
									<v-row dense>
										<v-col cols="6">
											<v-text-field v-model.number="config.soakTime" label="Soak time (min)"
														  type="number" min="1" max="60" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="6">
											<v-text-field v-model.number="config.hotDuration" label="Measure duration (hours)"
														  type="number" min="1" max="12" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="6">
											<v-text-field v-model.number="config.coolDuration" label="Cool-down duration (hours, 0 = skip)"
														  type="number" min="0" max="6" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="6">
											<v-text-field v-model.number="config.measureInterval" label="Interval between samples (min)"
														  type="number" min="1" max="10" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="6">
											<v-text-field v-model.number="config.nSamples" label="Probes per interval"
														  type="number" min="1" max="5" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="6">
											<v-text-field v-model.number="config.heatTimeout" label="Heat timeout (min)"
														  type="number" min="1" max="120" variant="outlined" density="compact"
														  hint="Abort if a heater can't reach target in this time" persistent-hint />
										</v-col>
									</v-row>
								</v-col>

								<v-col cols="12" md="6">
									<div class="text-subtitle-2 mb-2">Printer</div>
									<v-text-field v-model="config.trammingCmd" label="Tramming command (empty = skip)"
												  hint='e.g. G32  or  M98 P"/sys/tram-thermal.g"' persistent-hint
												  variant="outlined" density="compact" class="mb-2" />
									<v-text-field v-model="config.homeZCmd" label="Z homing command"
												  hint='e.g. G28 Z  or  M98 P"/sys/homez-thermal.g"' persistent-hint
												  variant="outlined" density="compact" class="mb-2" />
									<v-row dense>
										<v-col cols="4">
											<v-text-field v-model="config.probeX" label="Probe X (empty = centre)"
														  type="number" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="4">
											<v-text-field v-model="config.probeY" label="Probe Y (empty = centre)"
														  type="number" variant="outlined" density="compact" />
										</v-col>
										<v-col cols="4">
											<v-text-field v-model.number="config.probeZHeight" label="Probe Z height (mm)"
														  type="number" min="0" step="0.1" variant="outlined" density="compact"
														  hint="Nozzle dive/start height before each G30" persistent-hint />
										</v-col>
									</v-row>
									<v-text-field v-model="config.probeSetupCmd" label="Probe setup command (before probing)"
												  hint='Runs once before the first G30 — e.g. M558 K0 P5 ... or M98 P"/sys/nozzle-probe-setup.g" to switch from your scanning probe to nozzle probing'
												  persistent-hint variant="outlined" density="compact" class="mt-2" />
									<v-text-field v-model="config.probeRestoreCmd" label="Probe restore command (after / on abort)"
												  hint='Runs at the end and on abort — e.g. M98 P"/sys/scanning-probe-restore.g" to put your normal probe back'
												  persistent-hint variant="outlined" density="compact" class="mt-2" />
								</v-col>
							</v-row>

							<v-alert type="info" density="compact" class="mt-2">
								Estimated duration: ~{{ estimatedDurationLabel }} h.
								<strong>The browser tab must remain open</strong> for the full run.
							</v-alert>
						</v-card-text>
					</v-tabs-window-item>

					<!-- ── MEASURE ────────────────────────────────────────── -->
					<v-tabs-window-item value="measure">
						<v-card-text>
							<v-alert :type="phaseAlertType" density="compact" class="mb-3">
								<strong>{{ phaseLabel }}</strong>
								<span v-if="phaseMessage" class="ml-2">— {{ phaseMessage }}</span>
							</v-alert>

							<v-alert v-if="error" type="error" density="compact" closable class="mb-3" @click:close="error = ''">
								{{ error }}
							</v-alert>

							<v-progress-linear v-if="measuring || phase === 'done'"
											   :model-value="progress" height="10" rounded color="primary" class="mb-4" />

							<v-row dense class="mb-3" v-if="measuring">
								<v-col cols="auto">
									<v-chip size="small" label color="#FB8C00" variant="flat" class="text-white">
										<v-icon start size="x-small">mdi-radiator</v-icon>Bed {{ liveBedTemp }}°C
									</v-chip>
								</v-col>
								<v-col cols="auto" v-if="config.heTemp > 0">
									<v-chip size="small" label color="#F4511E" variant="flat" class="text-white">
										<v-icon start size="x-small">mdi-printer-3d-nozzle-heat</v-icon>HE {{ liveHeTemp }}°C
									</v-chip>
								</v-col>
								<v-col cols="auto" v-if="frameSensorIndex >= 0">
									<v-chip size="small" label color="#1E88E5" variant="flat" class="text-white">
										<v-icon start size="x-small">mdi-thermometer</v-icon>Frame {{ liveFrameTemp }}°C
									</v-chip>
								</v-col>
								<v-col cols="auto" v-if="dataPoints.length > 0">
									<v-chip size="small" label :color="lastDeltaZ >= 0 ? '#00897B' : '#8E24AA'" variant="flat" class="text-white">
										<v-icon start size="x-small">mdi-arrow-up-down</v-icon>
										ΔZ {{ lastDeltaZ >= 0 ? '+' : '' }}{{ lastDeltaZ.toFixed(4) }} mm
									</v-chip>
								</v-col>
							</v-row>

							<div v-show="dataPoints.length > 0" class="chart-box mb-2"><canvas ref="liveChart" /></div>

							<v-row class="mt-4">
								<v-col cols="auto">
									<v-btn color="success" :disabled="measuring || !isConnected" prepend-icon="mdi-play"
										   @click="startMeasurement">Start Measurement</v-btn>
								</v-col>
								<v-col cols="auto">
									<v-btn color="error" :disabled="!measuring" prepend-icon="mdi-stop" @click="abort">Abort</v-btn>
								</v-col>
							</v-row>

							<v-alert v-if="!allAxesHomed && isConnected" type="info" density="compact" class="mt-3">
								Machine is not fully homed — homing will be performed at the start of the run.
							</v-alert>

							<v-expansion-panels flat class="mt-4" v-if="dataPoints.length > 0">
								<v-expansion-panel>
									<v-expansion-panel-title>Sample log ({{ dataPoints.length }} measurements)</v-expansion-panel-title>
									<v-expansion-panel-text>
										<v-table density="compact" class="log-table">
											<thead>
												<tr>
													<th>Time</th>
													<th>Elapsed (min)</th>
													<th>ΔZ (mm)</th>
													<th>Frame (°C)</th>
													<th>Bed (°C)</th>
												</tr>
											</thead>
											<tbody>
												<tr v-for="(pt, i) in dataPoints" :key="i">
													<td>{{ pt.timestamp }}</td>
													<td>{{ pt.elapsedMin.toFixed(1) }}</td>
													<td>{{ pt.deltaZ >= 0 ? '+' : '' }}{{ pt.deltaZ.toFixed(4) }}</td>
													<td>{{ pt.frameTemp !== null ? pt.frameTemp.toFixed(1) : '—' }}</td>
													<td>{{ pt.bedTemp !== null ? pt.bedTemp.toFixed(1) : '—' }}</td>
												</tr>
											</tbody>
										</v-table>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>
						</v-card-text>
					</v-tabs-window-item>

					<!-- ── RESULTS ────────────────────────────────────────── -->
					<v-tabs-window-item value="results">
						<v-card-text v-if="result">
							<v-card variant="outlined" class="pa-5 mb-4 text-center">
								<div class="text-overline text-medium-emphasis mb-1">Thermal expansion coefficient</div>
								<div class="coeff-display text-primary">{{ result.slope.toFixed(6) }} mm/°C</div>
								<div class="text-caption mt-1 text-medium-emphasis">
									R² = {{ result.r2.toFixed(4) }} &nbsp;·&nbsp; {{ result.nPoints }} data points
								</div>

								<v-divider class="my-3" />

								<div class="text-overline text-medium-emphasis mb-1">Add to sys/thermal-adjust-vars.g</div>
								<code class="config-code">set global.taCoeff = {{ result.slope.toFixed(6) }}</code>

								<v-btn size="small" class="mt-3" prepend-icon="mdi-content-copy" @click="copyCoeff">Copy</v-btn>
								<v-snackbar v-model="copied" :timeout="2000" color="success" location="top">Copied to clipboard</v-snackbar>
							</v-card>

							<v-alert :type="r2AlertType" density="compact" class="mb-4">
								<strong>Fit quality: </strong>{{ r2Message }}
							</v-alert>

							<div class="text-subtitle-2 mb-1"><v-icon size="small" class="mr-1">mdi-chart-line</v-icon>Z Drift vs Time</div>
							<div class="chart-box chart-box--tall mb-6"><canvas ref="tsChart" /></div>

							<div class="text-subtitle-2 mb-1"><v-icon size="small" class="mr-1">mdi-chart-scatter-plot</v-icon>Z Drift vs Frame Temperature (with linear fit)</div>
							<div class="chart-box chart-box--tall mb-4"><canvas ref="fitChart" /></div>

							<v-btn prepend-icon="mdi-download" @click="exportJSON">Export raw data (JSON)</v-btn>
						</v-card-text>
					</v-tabs-window-item>

					<!-- ── ABOUT / UPDATES ────────────────────────────────── -->
					<v-tabs-window-item value="about">
						<v-card-text>
							<p class="text-body-2 text-medium-emphasis mb-4">
								Measures how your printer's frame grows as it heats, by repeatedly probing Z during a heat-soak
								and fitting Z drift against frame temperature. Use the resulting coefficient with a
								<code>thermal-adjust</code> macro to compensate Z for frame temperature.
							</p>

							<div class="d-flex align-center mb-1">
								<div class="text-subtitle-2">Updates</div>
								<v-spacer />
								<v-btn size="small" variant="text" :loading="checking" prepend-icon="mdi-refresh"
									   @click="checkNow">Check now</v-btn>
							</div>

							<v-alert v-if="pendingReload" type="success" density="comfortable" class="mb-2">
								<div class="d-flex align-center flex-wrap ga-2">
									<div class="flex-grow-1">Update installed — reload DWC to finish.</div>
									<v-btn color="success" prepend-icon="mdi-restart" @click="reloadPage">Reload</v-btn>
								</div>
							</v-alert>

							<v-alert v-else-if="update && update.scenario === 'pluginUpdate'" type="info" density="comfortable" class="mb-2">
								<div class="d-flex align-center flex-wrap ga-2">
									<div class="flex-grow-1">
										<div class="font-weight-medium">Update available: v{{ update.latestVersion }}</div>
										<div class="text-caption">Installed: v{{ update.currentVersion }}</div>
										<div v-if="!isConnected" class="text-caption text-warning">Connect to a machine to install.</div>
									</div>
									<v-btn color="primary" :loading="applying" :disabled="!isConnected" prepend-icon="mdi-download"
										   @click="updateNow">Update now</v-btn>
									<v-btn v-if="update.releaseUrl" variant="text" :href="update.releaseUrl" target="_blank" rel="noopener">Release notes</v-btn>
									<v-btn variant="text" size="small" @click="dismissUpdate">Dismiss</v-btn>
								</div>
							</v-alert>

							<v-alert v-else-if="update && update.scenario === 'dwcUpdate'" type="warning" density="comfortable" class="mb-2">
								<div class="font-weight-medium">Update available: v{{ update.latestVersion }}</div>
								<div class="text-caption">Needs DuetWebControl {{ update.requiredDwc }} (you have {{ update.runningDwc }})</div>
							</v-alert>

							<v-alert v-else-if="update && update.scenario === 'upToDate'" type="success" density="compact" class="mb-2">
								Up to date (v{{ update.currentVersion }})
							</v-alert>

							<v-switch :model-value="checksEnabled" color="primary" density="compact" hide-details
									  label="Check for updates on load" @update:model-value="onToggleChecks" />

							<v-divider class="my-4" />
							<div class="text-subtitle-2 mb-1">Diagnostics</div>
							<p class="text-body-2 text-medium-emphasis mt-0 mb-2">
								Bundle plugin versions, recent errors and a privacy-scrubbed object model to attach to a bug report.
							</p>
							<div class="d-flex flex-wrap ga-2">
								<v-btn variant="tonal" prepend-icon="mdi-download" @click="downloadDiagnostics">Download report</v-btn>
								<v-btn variant="tonal" prepend-icon="mdi-content-copy" @click="copyDiagnostics">Copy report</v-btn>
							</div>
						</v-card-text>
					</v-tabs-window-item>

				</v-tabs-window>
			</v-card>
		</v-col>
	</v-row>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { Chart, registerables } from "chart.js";

import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { LogLevel, useUiStore } from "@/stores/ui";

import { buildReport, copyReport, downloadReport } from "dwc-plugin-runtime";

import { LS_CONFIG, PLUGIN_MANIFEST_ID } from "./model/constants";
import { estimateDurationHours, type FitResult, linearFit, parseProbeHeight, r2Quality } from "./model/fit";
import {
	applying, applyUpdateNow, checking, dismissCurrentUpdate, pendingReload,
	runUpdateCheck, setUpdateChecksEnabled, updateChecksEnabled, updateState as update,
} from "./model/updateCheck";

Chart.register(...registerables);

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();

interface DataPoint {
	timestamp: string;
	elapsedMin: number;
	deltaZ: number;
	probeZ: number;
	samples: Array<number>;
	frameTemp: number | null;
	bedTemp: number | null;
	heTemp: number | null;
}

const tab = ref("setup");

// ── Configuration (persisted to localStorage) ──────────────────────────────────────────────────
const config = reactive({
	frameSensor: "Frame",
	bedTemp: 105,
	heTemp: 100,
	soakTime: 5,
	hotDuration: 3,
	coolDuration: 0,
	measureInterval: 1,
	nSamples: 3,
	/** Max minutes to wait for a heater to reach target before aborting (heater-fault guard). */
	heatTimeout: 15,
	trammingCmd: "G32",
	homeZCmd: "G28 Z",
	probeX: "" as string | number,
	probeY: "" as string | number,
	/** Z height (mm) the nozzle is lifted to before each probe — the probe's dive/start height. */
	probeZHeight: 5,
	/** Commands run ONCE before probing starts (e.g. select/configure the nozzle probe). */
	probeSetupCmd: "",
	/** Commands run at the end (and on abort) to restore your normal probe (optional). */
	probeRestoreCmd: "",
});

// ── Measurement state ──────────────────────────────────────────────────────────────────────────
const measuring = ref(false);
const phase = ref("idle");
const phaseMessage = ref("");
const progress = ref(0);
const dataPoints = ref<Array<DataPoint>>([]);
let startTime = 0;
let lastMeasureTime = 0;
const refZ = ref<number | null>(null);
const sampleIndex = ref(0);
const result = ref<FitResult | null>(null);
const copied = ref(false);
const error = ref("");

// ── Chart instances + canvas refs ────────────────────────────────────────────────────────────
let liveChartInstance: Chart | null = null;
let tsChartInstance: Chart | null = null;
let fitChartInstance: Chart | null = null;
const liveChart = ref<HTMLCanvasElement | null>(null);
const tsChart = ref<HTMLCanvasElement | null>(null);
const fitChart = ref<HTMLCanvasElement | null>(null);

// ── Object-model accessors ─────────────────────────────────────────────────────────────────────
// machineStore.model is a reactive proxy, so reading it inside a computed tracks changes.
const model = computed(() => machineStore.model as unknown as {
	heat?: { heaters?: Array<{ current?: number }>; bedHeaters?: Array<number> };
	move?: { axes?: Array<{ letter?: string; min?: number; max?: number; homed?: boolean; visible?: boolean }> };
	sensors?: { analog?: Array<{ name?: string; lastReading?: number } | null> };
	tools?: Array<{ heaters?: Array<number> } | null>;
});

const isConnected = computed(() => machineStore.isConnected);

const allAxesHomed = computed(() => {
	const axes = model.value.move?.axes;
	return !!axes && !axes.some((a) => a.visible && !a.homed);
});

const frameSensorIndex = computed(() => {
	const analog = model.value.sensors?.analog;
	if (!analog) return -1;
	const name = String(config.frameSensor).trim().toLowerCase();
	return analog.findIndex((s) => s && s.name && s.name.trim().toLowerCase() === name);
});

const frameTemp = computed<number | null>(() => {
	const idx = frameSensorIndex.value;
	if (idx < 0) return null;
	return model.value.sensors?.analog?.[idx]?.lastReading ?? null;
});

const bedHeaterIndex = computed(() => model.value.heat?.bedHeaters?.[0] ?? -1);

const liveBedTemp = computed(() => {
	const i = bedHeaterIndex.value;
	const v = i >= 0 ? model.value.heat?.heaters?.[i]?.current : undefined;
	return typeof v === "number" ? v.toFixed(1) : "—";
});

const liveHeTemp = computed(() => {
	const i = model.value.tools?.[0]?.heaters?.[0] ?? -1;
	const v = i >= 0 ? model.value.heat?.heaters?.[i]?.current : undefined;
	return typeof v === "number" ? v.toFixed(1) : "—";
});

const liveFrameTemp = computed(() => (frameTemp.value !== null ? frameTemp.value.toFixed(1) : "—"));

const lastDeltaZ = computed(() => (dataPoints.value.length ? dataPoints.value[dataPoints.value.length - 1].deltaZ : 0));

const probeXPos = computed(() => {
	if (config.probeX !== "" && config.probeX !== null) return parseFloat(String(config.probeX));
	const x = model.value.move?.axes?.find((a) => a.letter === "X");
	return x ? ((x.min ?? 0) + (x.max ?? 300)) / 2 : 150;
});
const probeYPos = computed(() => {
	if (config.probeY !== "" && config.probeY !== null) return parseFloat(String(config.probeY));
	const y = model.value.move?.axes?.find((a) => a.letter === "Y");
	return y ? ((y.min ?? 0) + (y.max ?? 300)) / 2 : 150;
});

const estimatedDurationLabel = computed(() => estimateDurationHours(config).toFixed(1));

const phaseAlertType = computed<"info" | "warning" | "success" | "error">(() => {
	const map: Record<string, "info" | "warning" | "success" | "error"> = {
		idle: "info", homing: "info", tramming: "info", heating: "warning", soaking: "warning",
		measuring: "success", cooling: "info", done: "success", error: "error",
	};
	return map[phase.value] || "info";
});

const phaseLabel = computed(() => {
	const map: Record<string, string> = {
		idle: "Ready to start", homing: "Homing all axes", tramming: "Tramming bed",
		heating: "Heating to target temperature", soaking: "Heat soaking", measuring: "Measuring",
		cooling: "Cooling down", done: "Measurement complete", error: "Error",
	};
	return map[phase.value] || phase.value;
});

const r2AlertType = computed<"info" | "success" | "warning" | "error">(() => {
	if (!result.value) return "info";
	const level = r2Quality(result.value.r2).level;
	return level === "good" ? "success" : level === "ok" ? "warning" : "error";
});
const r2Message = computed(() => (result.value ? r2Quality(result.value.r2).message : ""));

// ── Persist config ───────────────────────────────────────────────────────────────────────────
watch(config, (val) => {
	try { localStorage.setItem(LS_CONFIG, JSON.stringify(val)); } catch { /* storage disabled */ }
}, { deep: true });

watch(tab, (val) => {
	if (val === "results" && result.value) {
		void nextTick(() => drawResultCharts());
	}
});

// ── Utilities ──────────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function send(code: string): Promise<string> {
	return machineStore.sendCode(code, false, false);
}

function getCurrentTemps(): { bedTemp: number | null; heTemp: number | null; frameTemp: number | null } {
	const bedIdx = bedHeaterIndex.value;
	const heIdx = model.value.tools?.[0]?.heaters?.[0] ?? -1;
	return {
		bedTemp: bedIdx >= 0 ? (model.value.heat?.heaters?.[bedIdx]?.current ?? null) : null,
		heTemp: heIdx >= 0 ? (model.value.heat?.heaters?.[heIdx]?.current ?? null) : null,
		frameTemp: frameTemp.value,
	};
}

/**
 * Poll a heater's live temperature until it reaches `target − tolerance`, updating the progress/phase
 * text. Throws if it hasn't reached target within `config.heatTimeout` minutes (heater-fault guard).
 * Returns early (without throwing) if the run is aborted.
 */
async function waitForHeater(label: string, getCurrent: () => number, target: number, tolerance: number): Promise<void> {
	const start = Date.now();
	const timeoutMs = Math.max(1, config.heatTimeout) * 60 * 1000;
	while (measuring.value) {
		const current = getCurrent();
		progress.value = Math.round(Math.min(99, (current / target) * 100));
		const left = Math.ceil((timeoutMs - (Date.now() - start)) / 1000);
		phaseMessage.value = `${label} ${current.toFixed(1)} / ${target}°C (timeout in ${Math.max(0, Math.floor(left / 60))}m ${Math.max(0, left % 60)}s)`;
		if (current >= target - tolerance) return;
		if (Date.now() - start > timeoutMs) {
			throw new Error(`${label} only reached ${current.toFixed(1)}°C of ${target}°C within ${config.heatTimeout} min — heaters turned off. Check the heater/PID/thermistor, then retry.`);
		}
		await sleep(2000);
	}
}

async function doProbe(): Promise<number> {
	const diveZ = config.probeZHeight > 0 ? config.probeZHeight : 5;
	await send(`G1 Z${diveZ.toFixed(2)} F600`);
	await send(`G1 X${probeXPos.value.toFixed(2)} Y${probeYPos.value.toFixed(2)} F6000`);
	const reply = await send("G30 S-1");
	const z = parseProbeHeight(reply);
	if (z === null) {
		throw new Error(`Could not parse probe height from reply: "${reply}". Check G30 is working.`);
	}
	return z;
}

// ── Main measurement procedure ─────────────────────────────────────────────────────────────────
async function startMeasurement(): Promise<void> {
	measuring.value = true;
	error.value = "";
	dataPoints.value = [];
	refZ.value = null;
	sampleIndex.value = 0;
	result.value = null;
	progress.value = 0;
	tab.value = "measure";
	destroyAllCharts();

	try {
		if (frameSensorIndex.value === -1) {
			throw new Error(`Frame sensor "${config.frameSensor}" not found in object model. Check your M308 A"name" value in config.g.`);
		}

		// Home
		phase.value = "homing";
		phaseMessage.value = "";
		await send("G28");

		// Tram
		if (config.trammingCmd.trim()) {
			phase.value = "tramming";
			phaseMessage.value = config.trammingCmd.trim();
			await send(config.trammingCmd.trim());
			await send(config.homeZCmd.trim());
		}

		// Park toolhead high
		const zMax = model.value.move?.axes?.find((a) => a.letter === "Z")?.max ?? 300;
		const xMax = model.value.move?.axes?.find((a) => a.letter === "X")?.max ?? 300;
		const yMax = model.value.move?.axes?.find((a) => a.letter === "Y")?.max ?? 300;
		await send(`G1 Z${(zMax * 0.8).toFixed(1)} F600`);
		await send(`G1 X${xMax.toFixed(1)} Y${yMax.toFixed(1)} F6000`);

		// Set heater targets
		await send(`M140 S${config.bedTemp}`);
		if (config.heTemp > 0) {
			await send(`M104 S${config.heTemp}`);
		}

		// Wait for bed temperature (guarded by a timeout in case of a heater fault)
		phase.value = "heating";
		await waitForHeater("Bed", () => model.value.heat?.heaters?.[bedHeaterIndex.value]?.current ?? 0, config.bedTemp, 0.5);
		if (!measuring.value) return;

		// Heat soak
		phase.value = "soaking";
		progress.value = 0;
		const soakMs = config.soakTime * 60 * 1000;
		const soakStart = Date.now();
		while (measuring.value) {
			const elapsed = Date.now() - soakStart;
			if (elapsed >= soakMs) break;
			const remaining = Math.ceil((soakMs - elapsed) / 1000);
			progress.value = Math.round((elapsed / soakMs) * 100);
			phaseMessage.value = `${Math.floor(remaining / 60)}m ${remaining % 60}s remaining`;
			await sleep(1000);
		}
		if (!measuring.value) return;

		// Re-home Z and re-tram after heat soak
		phase.value = "homing";
		phaseMessage.value = "post-soak re-home";
		progress.value = 0;
		await send(config.homeZCmd.trim());
		if (config.trammingCmd.trim()) {
			phase.value = "tramming";
			phaseMessage.value = "post-soak re-tram";
			await send(config.trammingCmd.trim());
			await send(config.homeZCmd.trim());
		}

		// Wait for hotend (guarded by the same timeout)
		const heIdx = model.value.tools?.[0]?.heaters?.[0] ?? -1;
		if (config.heTemp > 0 && heIdx >= 0) {
			phase.value = "heating";
			await waitForHeater("Hotend", () => model.value.heat?.heaters?.[heIdx]?.current ?? 0, config.heTemp, 1);
		}
		if (!measuring.value) return;

		// Configure the Z probe for nozzle probing (e.g. switch from a scanning probe), once, before
		// any G30. Restored at the end / on abort via probeRestoreCmd.
		if (config.probeSetupCmd.trim()) {
			phase.value = "measuring";
			phaseMessage.value = "configuring probe";
			await send(config.probeSetupCmd.trim());
		}

		// Establish Z reference via initial probe
		phase.value = "measuring";
		phaseMessage.value = "establishing reference";
		refZ.value = await doProbe();

		// Measurement loop
		startTime = Date.now();
		lastMeasureTime = startTime - config.measureInterval * 60 * 1000;
		const totalMs = (config.hotDuration + config.coolDuration) * 3600 * 1000;
		let heatersOff = false;

		while (measuring.value) {
			const elapsed = Date.now() - startTime;
			if (elapsed >= totalMs) break;

			const hotMs = config.hotDuration * 3600 * 1000;
			if (elapsed >= hotMs && !heatersOff && config.coolDuration > 0) {
				await send("M140 S0");
				await send("M104 S0");
				heatersOff = true;
				phase.value = "cooling";
			}

			const msSinceLast = Date.now() - lastMeasureTime;
			const intervalMs = config.measureInterval * 60 * 1000;

			if (msSinceLast >= intervalMs) {
				lastMeasureTime = Date.now();
				const elapsedMin = elapsed / 60000;

				const heights: Array<number> = [];
				for (let n = 0; n < config.nSamples; n++) {
					heights.push(await doProbe());
					if (!measuring.value) break;
					if (n < config.nSamples - 1) await sleep(2000);
				}
				if (!measuring.value) break;

				const meanZ = heights.reduce((a, b) => a + b, 0) / heights.length;
				const deltaZ = meanZ - (refZ.value ?? 0);
				const temps = getCurrentTemps();

				dataPoints.value.push({
					timestamp: new Date().toLocaleTimeString(),
					elapsedMin, deltaZ, probeZ: meanZ, samples: heights, ...temps,
				});

				sampleIndex.value++;
				updateLiveChart();
			}

			progress.value = Math.round((elapsed / totalMs) * 100);
			if (phase.value !== "cooling") phase.value = "measuring";
			const nextIn = Math.max(0, Math.ceil((intervalMs - msSinceLast) / 1000));
			const remainMin = Math.ceil((totalMs - elapsed) / 60000);
			phaseMessage.value = `Sample ${sampleIndex.value} · ${remainMin} min remaining · next probe in ${nextIn}s`;

			await sleep(1000);
		}

		// Finish
		await send("M140 S0");
		await send("M104 S0");
		if (config.probeRestoreCmd.trim()) await send(config.probeRestoreCmd.trim());
		phase.value = "done";
		phaseMessage.value = `${dataPoints.value.length} samples collected`;
		progress.value = 100;

		computeResult();
		if (result.value) tab.value = "results";
	} catch (e) {
		error.value = (e as Error).message || String(e);
		phase.value = "error";
		phaseMessage.value = "";
		try { void send("M140 S0"); void send("M104 S0"); if (config.probeRestoreCmd.trim()) void send(config.probeRestoreCmd.trim()); } catch { /* best-effort */ }
	} finally {
		measuring.value = false;
	}
}

function abort(): void {
	measuring.value = false;
	phase.value = "idle";
	phaseMessage.value = "";
	try { void send("M140 S0"); void send("M104 S0"); if (config.probeRestoreCmd.trim()) void send(config.probeRestoreCmd.trim()); } catch { /* best-effort */ }
}

// ── Analysis ───────────────────────────────────────────────────────────────────────────────────
function computeResult(): void {
	const pts = dataPoints.value.filter((p) => p.frameTemp !== null);
	const outcome = linearFit(pts.map((p) => p.frameTemp as number), pts.map((p) => p.deltaZ));
	if (outcome.ok) {
		result.value = outcome.result;
	} else {
		error.value = outcome.error;
	}
}

// ── Charts (Chart.js v4) ────────────────────────────────────────────────────────────────────────
function themeColors() {
	const dark = settingsStore.darkTheme;
	return {
		font: dark ? "#ccc" : "#555",
		grid: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
	};
}

function dualAxisScales(xLabel: string, y1Label: string, y2Label: string) {
	const { font, grid } = themeColors();
	return {
		x: { title: { display: true, text: xLabel, color: font }, ticks: { color: font }, grid: { color: grid } },
		y1: { type: "linear" as const, position: "left" as const, title: { display: true, text: y1Label, color: font }, ticks: { color: font }, grid: { color: grid } },
		y2: { type: "linear" as const, position: "right" as const, title: { display: true, text: y2Label, color: font }, ticks: { color: font }, grid: { drawOnChartArea: false } },
	};
}

function initLiveChart(): void {
	if (liveChartInstance) liveChartInstance.destroy();
	const ctx = liveChart.value?.getContext("2d");
	if (!ctx) return;
	const { font } = themeColors();
	liveChartInstance = new Chart(ctx, {
		type: "line",
		data: {
			labels: [],
			datasets: [
				{ label: "ΔZ (mm)", data: [], yAxisID: "y1", borderColor: "#1976D2", backgroundColor: "rgba(25,118,210,0.08)", borderWidth: 1.5, pointRadius: 3, fill: true },
				{ label: "Frame temp (°C)", data: [], yAxisID: "y2", borderColor: "#E53935", backgroundColor: "transparent", borderWidth: 1.5, pointRadius: 2, fill: false },
			],
		},
		options: {
			responsive: true, maintainAspectRatio: false, animation: false,
			plugins: { legend: { labels: { color: font } } },
			scales: dualAxisScales("Elapsed time (min)", "ΔZ (mm)", "Temperature (°C)"),
		},
	});
}

function updateLiveChart(): void {
	const pt = dataPoints.value[dataPoints.value.length - 1];
	if (!pt) return;
	if (!liveChartInstance) {
		void nextTick(() => { initLiveChart(); updateLiveChart(); });
		return;
	}
	const c = liveChartInstance;
	(c.data.labels as Array<string>).push(pt.elapsedMin.toFixed(1));
	c.data.datasets[0].data.push(pt.deltaZ as never);
	c.data.datasets[1].data.push(pt.frameTemp as never);
	c.update();
}

function drawResultCharts(): void {
	destroyResultCharts();
	if (!result.value || !dataPoints.value.length) return;
	const { font } = themeColors();
	const legend = { labels: { color: font } };

	const tsCtx = tsChart.value?.getContext("2d");
	if (tsCtx) {
		tsChartInstance = new Chart(tsCtx, {
			type: "line",
			data: {
				labels: dataPoints.value.map((p) => p.elapsedMin.toFixed(1)),
				datasets: [
					{ label: "ΔZ (mm)", data: dataPoints.value.map((p) => p.deltaZ), yAxisID: "y1", borderColor: "#1976D2", backgroundColor: "rgba(25,118,210,0.08)", borderWidth: 1.5, pointRadius: 3, fill: true },
					{ label: "Frame (°C)", data: dataPoints.value.map((p) => p.frameTemp), yAxisID: "y2", borderColor: "#E53935", backgroundColor: "transparent", borderWidth: 1.5, pointRadius: 2, fill: false },
					{ label: "Bed (°C)", data: dataPoints.value.map((p) => p.bedTemp), yAxisID: "y2", borderColor: "#FB8C00", backgroundColor: "transparent", borderWidth: 1, pointRadius: 1, fill: false },
				],
			},
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend },
				scales: dualAxisScales("Elapsed time (min)", "ΔZ (mm)", "Temperature (°C)"),
			},
		});
	}

	const fitCtx = fitChart.value?.getContext("2d");
	if (fitCtx && result.value) {
		const { slope, intercept } = result.value;
		const pts = dataPoints.value.filter((p) => p.frameTemp !== null);
		const xVals = pts.map((p) => p.frameTemp as number);
		const xMin = Math.min(...xVals);
		const xMax = Math.max(...xVals);
		fitChartInstance = new Chart(fitCtx, {
			type: "scatter",
			data: {
				datasets: [
					{
						label: "Measured (ΔZ vs frame temp)",
						data: pts.map((p) => ({ x: p.frameTemp as number, y: p.deltaZ })),
						backgroundColor: pts.map((_, i) => {
							const t = i / Math.max(pts.length - 1, 1);
							return `rgba(${Math.round(t * 220)},80,${Math.round((1 - t) * 220)},0.75)`;
						}),
						pointRadius: 5,
					},
					{
						label: `Fit: ${slope.toFixed(5)} mm/°C  (R²=${result.value.r2.toFixed(3)})`,
						type: "line",
						data: [{ x: xMin, y: slope * xMin + intercept }, { x: xMax, y: slope * xMax + intercept }],
						borderColor: "#E53935", backgroundColor: "transparent", borderWidth: 2, pointRadius: 0, fill: false,
					},
				],
			},
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend },
				scales: {
					x: { type: "linear", title: { display: true, text: "Frame temperature (°C)", color: font }, ticks: { color: font } },
					y: { title: { display: true, text: "ΔZ (mm)", color: font }, ticks: { color: font } },
				},
			},
		});
	}
}

function destroyResultCharts(): void {
	tsChartInstance?.destroy(); tsChartInstance = null;
	fitChartInstance?.destroy(); fitChartInstance = null;
}
function destroyAllCharts(): void {
	destroyResultCharts();
	liveChartInstance?.destroy(); liveChartInstance = null;
}

// ── Actions ──────────────────────────────────────────────────────────────────────────────────
function copyCoeff(): void {
	if (!result.value) return;
	const text = `set global.taCoeff = ${result.value.slope.toFixed(6)}`;
	if (navigator.clipboard) {
		void navigator.clipboard.writeText(text).then(() => { copied.value = true; });
	} else {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		document.execCommand("copy");
		document.body.removeChild(ta);
		copied.value = true;
	}
}

function exportJSON(): void {
	const output = {
		metadata: {
			firmware: "rrf",
			data_structure: 1,
			config: { ...config },
			ref_probe_z_mm: refZ.value,
			result: result.value,
			exported_at: new Date().toISOString(),
		},
		temp_data: {} as Record<string, unknown>,
	};
	dataPoints.value.forEach((pt, i) => {
		output.temp_data[pt.timestamp] = {
			sample_index: i, elapsed_min: pt.elapsedMin, delta_z_mm: pt.deltaZ, probe_z_mm: pt.probeZ,
			probe_samples: pt.samples, frame_temp: pt.frameTemp, bed_temp: pt.bedTemp, he_temp: pt.heTemp,
		};
	});
	const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `thermal_profile_rrf_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

// ── Updates + diagnostics (About tab) ──────────────────────────────────────────────────────────
const checksEnabled = ref(updateChecksEnabled());
function checkNow(): void { void runUpdateCheck({ force: true }); }
function updateNow(): void { void applyUpdateNow(); }
function dismissUpdate(): void { dismissCurrentUpdate(); }
function reloadPage(): void { window.location.reload(); }
function onToggleChecks(value: boolean | null): void {
	const on = value === true;
	checksEnabled.value = on;
	setUpdateChecksEnabled(on);
	if (on) void runUpdateCheck({ force: true });
}

function diagnosticReport() {
	return buildReport({
		pluginId: PLUGIN_MANIFEST_ID,
		model: machineStore.model,
		state: { config: { ...config }, samples: dataPoints.value.length, result: result.value },
	});
}
function downloadDiagnostics(): void { downloadReport(diagnosticReport()); }
async function copyDiagnostics(): Promise<void> {
	const ok = await copyReport(diagnosticReport());
	uiStore.makeNotification(
		ok ? LogLevel.success : LogLevel.warning,
		i18n.global.t("plugins.thermalFrameExpansion.title"),
		i18n.global.t(ok ? "plugins.thermalFrameExpansion.diagnostics.copied" : "plugins.thermalFrameExpansion.diagnostics.copyFailed"),
	);
}

// ── Lifecycle + navigation guard ───────────────────────────────────────────────────────────────
let onBeforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

onMounted(() => {
	try {
		const saved = localStorage.getItem(LS_CONFIG);
		if (saved) Object.assign(config, JSON.parse(saved));
	} catch { /* ignore corrupt config */ }
	onBeforeUnloadHandler = (e: BeforeUnloadEvent) => {
		if (measuring.value) { e.preventDefault(); e.returnValue = ""; }
	};
	window.addEventListener("beforeunload", onBeforeUnloadHandler);
});

onBeforeUnmount(() => {
	destroyAllCharts();
	if (onBeforeUnloadHandler) window.removeEventListener("beforeunload", onBeforeUnloadHandler);
	if (measuring.value) abort();
});

// Warn before navigating away mid-measurement (it would be aborted). Guarded because the route-guard
// composable is only available when rendered inside the router (it is in DWC; not in unit-test mounts).
if (typeof onBeforeRouteLeave === "function") {
	onBeforeRouteLeave(() => {
		if (!measuring.value) return true;
		const ok = window.confirm("A measurement is in progress. Leaving this page will abort it. Continue?");
		if (ok) abort();
		return ok;
	});
}
</script>

<style scoped>
.coeff-display {
	font-family: monospace;
	font-size: 2.2em;
	font-weight: bold;
	letter-spacing: 0.02em;
}
.config-code {
	font-family: monospace;
	font-size: 0.95em;
	background: rgba(128, 128, 128, 0.15);
	border-radius: 4px;
	padding: 8px 14px;
	display: block;
	word-break: break-all;
}
.log-table :deep(td) {
	font-size: 0.82em;
	padding: 1px 6px !important;
}
.chart-box {
	position: relative;
	height: 220px;
}
.chart-box--tall {
	height: 260px;
}
</style>
