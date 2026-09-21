import fs from "node:fs/promises";
import { findCurrentUiEntryFailures } from "./current-ui-entry-guard.mjs";

const packageJson = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const scripts = packageJson.scripts ?? {};
const appRootSource = await fs.readFile(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const islandPageSource = await fs.readFile(
  new URL("../src/pages/Island.tsx", import.meta.url),
  "utf8",
);
const smokeSource = await fs.readFile(
  new URL("./e2e-smoke.mjs", import.meta.url),
  "utf8",
);
const failures = findCurrentUiEntryFailures({ scripts, appRootSource, islandPageSource, smokeSource });
if (failures.length > 0) {
  console.error("Current UI entry guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Current UI entry guard passed: dev opens Mystic Island; classic Explore and its smoke suite are explicit; Nature Town is isolated; shared-route flags and Island candidate identity are exposed.");
}
