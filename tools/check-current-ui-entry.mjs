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
const buildDefaultsSource = await fs.readFile(
  new URL("./build-env.mjs", import.meta.url),
  "utf8",
);
const [memory, ownershipMap, explorePlan, riskRegister, parentSpec, screenSpec, rolloutSpec] =
  await Promise.all(
    [
      "../docs/wiki/memory.md",
      "../docs/ai/ownership_map.md",
      "../docs/ai/implementation_plan_explore_mvp.md",
      "../docs/wiki/risk_register.md",
      "../docs/product/01_app_spec.md",
      "../docs/product/06_screen_specs.md",
      "../docs/product/15_mvp_rollout_verification_spec.md",
    ].map((path) => fs.readFile(new URL(path, import.meta.url), "utf8")),
  );
const entryDocs = {
  memory,
  ownershipMap,
  explorePlan,
  riskRegister,
  parentSpec,
  screenSpec,
  rolloutSpec,
};
const failures = findCurrentUiEntryFailures({
  scripts,
  appRootSource,
  islandPageSource,
  smokeSource,
  buildDefaultsSource,
  entryDocs,
});
if (failures.length > 0) {
  console.error("Current UI entry guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Current UI entry guard passed: dev opens Mystic Island; classic Explore and its smoke suite are explicit; Nature Town is isolated; runtime identity is exposed; product and agent docs keep Explore historical and optional.");
}
