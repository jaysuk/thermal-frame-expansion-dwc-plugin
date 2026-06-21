#!/usr/bin/env node
/**
 * Print the static footer appended to every GitHub Release body: install instructions and the
 * DuetWebControl version the ZIP was built against. Ends with the machine-readable
 * `dwc-plugin-update` marker that dwc-plugin-runtime's in-app update checker looks for.
 *
 * DWC details come from the CI build environment (the release workflow sets them after checking out
 * DuetWebControl); they fall back sensibly when run locally.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "..", "plugin.json"), "utf8"));
const pkgVersion = manifest.version;

const dwcVersion = process.env.DWC_VERSION || "";

// Resolve the manifest's dwcVersion the same way DWC's build does ("auto" -> full DWC version,
// "auto-major" -> major.minor), so the metadata matches what DWC enforces at install / the update
// checker compares against.
function resolveDwcRequirement(value, reference) {
	if (value === "auto") return reference;
	if (value === "auto-major") return reference.split(".").slice(0, 2).join(".");
	return value || "";
}
const requiredDwc = resolveDwcRequirement(manifest.dwcVersion, dwcVersion);
const dwcSha = process.env.DWC_SHA || "";
const dwcRef = process.env.DWC_REF || "v3.7-dev";
const dwcBuiltAgainst = dwcVersion
	? `**DuetWebControl ${dwcVersion}**${dwcSha ? ` (\`${dwcSha}\`, ref \`${dwcRef}\`)` : ` (ref \`${dwcRef}\`)`}`
	: `DuetWebControl (ref \`${dwcRef}\`)`;

const out = `
---

### 📦 Install
1. Download \`ThermalFrameExpansion-${pkgVersion}.zip\` from the **Assets** below.
2. In DuetWebControl, go to **Settings → General → Plugins** and click **Install Plugin**.
3. Select the downloaded ZIP and accept the third-party-plugin prompt.
4. Reload DWC, then open **Plugins → Thermal Expansion**.

> 🔧 Built against ${dwcBuiltAgainst}. Use a DuetWebControl build at or near this version.
> 🌡️ Needs a frame thermistor configured with \`M308 ... A"<name>"\` so the run can correlate Z drift with frame temperature.

<!-- dwc-plugin-update ${JSON.stringify({ version: pkgVersion, dwcVersion: requiredDwc, asset: `ThermalFrameExpansion-${pkgVersion}.zip` })} -->
`;

process.stdout.write(out.replace(/^\n/, ""));
