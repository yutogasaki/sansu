import { spawnSync } from "node:child_process";
import { cpSync } from "node:fs";
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

// The promotion site is built after Workbox generates the game offline pack.
// Its files are served under /promo/ and are not part of game precaching.
if (!process.exitCode) {
    const website = spawnSync("vite", ["build", "--config", "website/vite.config.js", "--base", "/promo/"], {
        shell: process.platform === "win32",
        stdio: "inherit",
    });
    if (website.error || website.status !== 0) {
        console.error("Promotion website build failed", website.error?.message || website.status);
        process.exitCode = website.status || 1;
    } else {
        cpSync("dist-website", "dist/promo", { recursive: true });
    }
}
