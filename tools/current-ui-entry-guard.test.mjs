import { describe, expect, it } from "vitest";
import { findCurrentUiEntryFailures } from "./current-ui-entry-guard.mjs";

const scripts = {
  dev: "npm run dev:island",
  "dev:island":
    "VITE_ISLAND_ENABLED=true vite --host 127.0.0.1 --port 5198 --strictPort --open /#/island",
  "dev:test-server": "vite",
  "dev:classic":
    "VITE_ISLAND_ENABLED=false vite --host 127.0.0.1 --port 5201 --strictPort --open /#/explore",
  "dev:nature-town":
    "VITE_ISLAND_ENABLED=true VITE_NATURE_TOWN_ENABLED=true vite --host 127.0.0.1 --port 5233 --strictPort --open /#/nature-town",
};

const appRootSource = [
  "data-island-feature-enabled={String(islandEnabled())}",
  "data-nature-town-feature-enabled={String(import.meta.env.VITE_NATURE_TOWN_ENABLED === 'true')}",
].join(" ");
const islandPageSource = [
  "data-island-feature-enabled={String(islandEnabled())}",
  "data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE}",
  "data-learning-candidate={ISLAND_LEARNING_CANDIDATE}",
  "data-build-revision={__BUILD_REVISION__}",
].join(" ");
const smokeSource = [
  "npm run dev:test-server",
  'VITE_ISLAND_ENABLED: "false"',
  'VITE_EXPLORE_EXPERIENCE: "classic-v1"',
].join(" ");

describe("current UI entry guard", () => {
  it("accepts distinct Island, classic Explore, and Nature Town entry points", () => {
    expect(findCurrentUiEntryFailures({ scripts, appRootSource, islandPageSource, smokeSource })).toEqual([]);
  });

  it.each([
    [
      "a generic flag-off dev default",
      { dev: "vite --host 127.0.0.1 --port 5173" },
      "npm run dev must delegate to the current Island app",
    ],
    [
      "Nature Town opened on the classic route",
      {
        "dev:nature-town":
          "VITE_ISLAND_ENABLED=false vite --port 5233 --strictPort --open /#/explore",
      },
      "Nature Town must remain an explicit preview on its own route and port",
    ],
  ])("rejects %s", (_description, overrides, expectedFailure) => {
    expect(
      findCurrentUiEntryFailures({
        scripts: { ...scripts, ...overrides },
        appRootSource,
        islandPageSource,
        smokeSource,
      }),
    ).toContain(expectedFailure);
  });

  it("rejects Island evidence without a runtime flag marker", () => {
    expect(
      findCurrentUiEntryFailures({
        scripts,
        appRootSource,
        smokeSource,
        islandPageSource: islandPageSource.replace(
          "data-island-feature-enabled={String(islandEnabled())}",
          "",
        ),
      }),
    ).toContain(
      "the Island screen must expose the runtime feature flag beside its candidate identity",
    );
  });

  it.each([
    [
      "Island",
      "data-island-feature-enabled={String(islandEnabled())}",
    ],
    [
      "Nature Town",
      "data-nature-town-feature-enabled={String(import.meta.env.VITE_NATURE_TOWN_ENABLED === 'true')}",
    ],
  ])("rejects shared-route evidence without the %s feature flag", (_name, marker) => {
    expect(
      findCurrentUiEntryFailures({
        scripts,
        appRootSource: appRootSource.replace(marker, ""),
        islandPageSource,
        smokeSource,
      }),
    ).toContain(
      "the shared application root must expose Island and Nature Town feature flags on every route",
    );
  });

  it("rejects the classic Explore smoke suite if it inherits the current Island entry", () => {
    expect(
      findCurrentUiEntryFailures({
        scripts,
        appRootSource,
        islandPageSource,
        smokeSource: smokeSource.replace(
          'VITE_ISLAND_ENABLED: "false"',
          'VITE_ISLAND_ENABLED: "true"',
        ),
      }),
    ).toContain(
      "the legacy Explore smoke suite must use its isolated server with the flag explicitly off",
    );
  });
});
