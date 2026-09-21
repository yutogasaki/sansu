import { spawnSync } from "node:child_process";
import { withCurrentUiBuildDefaults } from "./build-env.mjs";

const result = spawnSync("vite", ["build"], {
    env: withCurrentUiBuildDefaults(),
    shell: process.platform === "win32",
    stdio: "inherit",
});

if (result.error) {
    console.error(`Vite build failed to start: ${result.error.message}`);
    process.exitCode = 1;
} else if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
}
