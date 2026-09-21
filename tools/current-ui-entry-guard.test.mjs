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
const entryDocs = {
  memory:
    "Current UI target (2026-09-21): current PokoMoko is Island-on: `npm run dev` → port 5198 → `/#/island`. This historical launch contract must not be used to infer the current app entry.",
  ownershipMap:
    "通常起動は `npm run dev` → port `5198` → `/#/island`。`/explore` は任意の旧Exploreです。",
  explorePlan:
    "> スコープ: この計画は任意の旧Exploreモードだけを扱い、現行標準起動は `npm run dev` → port `5198` → `/#/island`。\n\n## 2026-07時点の当時の現在地",
  riskRegister: "| Explore-mode scope drift | current prevention |",
  parentSpec:
    "旧ExploreはIslandホームとは別の任意モード。`/explore` は現行アプリの通常起動先を定義しない。",
  screenSpec:
    "> 現行ルートの正本。`npm run dev` はIsland有効で `/` → `/island` を開く。\n> `/explore` は旧Explore/classicの履歴仕様です。",
  rolloutSpec:
    "> スコープ: 現行アプリの標準起動は `npm run dev` → `/#/island`。以下の記述は旧Explore MVP当時の履歴です。",
};

const guardInput = (overrides = {}) => ({
  scripts,
  appRootSource,
  islandPageSource,
  smokeSource,
  entryDocs,
  ...overrides,
});

describe("current UI entry guard", () => {
  it("accepts distinct Island, classic Explore, and Nature Town entry points", () => {
    expect(findCurrentUiEntryFailures(guardInput())).toEqual([]);
  });

  it.each([
    [
      "a generic flag-off dev default",
      { dev: "vite --host 127.0.0.1 --port 5173" },
      "npm run dev must delegate to the current Island app",
    ],
    [
      "Island opened on a noncanonical port",
      {
        "dev:island":
          "VITE_ISLAND_ENABLED=true vite --host 127.0.0.1 --port 5173 --strictPort --open /#/island",
      },
      "dev:island must enable Island, reserve port 5198, and open the Island route",
    ],
    [
      "classic Explore opened on the Island port",
      {
        "dev:classic":
          "VITE_ISLAND_ENABLED=false vite --host 127.0.0.1 --port 5198 --strictPort --open /#/explore",
      },
      "classic Explore must remain an explicit, isolated opt-in",
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
      findCurrentUiEntryFailures(
        guardInput({ scripts: { ...scripts, ...overrides } }),
      ),
    ).toContain(expectedFailure);
  });

  it.each([
    [
      "memory",
      "With the build-and-play flag off, the launch contract is",
      "project memory must identify Island as current and the former Explore launch as historical",
    ],
    [
      "ownershipMap",
      "実装がMVP段階にある間は独立した `/explore` から始め",
      "the ownership map must distinguish the Island app entry from optional legacy Explore",
    ],
    [
      "explorePlan",
      "## 現在地（MVP-2b + cold-open再検証）",
      "the Explore implementation plan must scope its old app-root contract as historical",
    ],
    [
      "riskRegister",
      "| Exploration spec-to-implementation transition drift |",
      "the risk register must describe Explore entry drift as a current prevention risk",
    ],
  ])("rejects the former active Explore entry claim in %s", (doc, staleClaim, failure) => {
    const changedEntryDocs = {
      ...entryDocs,
      [doc]: `${entryDocs[doc]}\n${staleClaim}`,
    };
    expect(
      findCurrentUiEntryFailures(guardInput({ entryDocs: changedEntryDocs })),
    ).toContain(failure);
  });

  it.each([
    [
      "parentSpec",
      "旧ExploreはIslandホームとは別の任意モード",
      "the parent app spec must keep Explore optional and out of the current app entry",
    ],
    [
      "screenSpec",
      "`npm run dev` はIsland有効で `/` → `/island` を開く",
      "screen spec 06 must identify Island as current and its Explore launch text as history",
    ],
    [
      "rolloutSpec",
      "現行アプリの標準起動は `npm run dev` → `/#/island`",
      "rollout spec 15 must scope its former Explore app entry as historical",
    ],
  ])("requires current-entry context in %s", (doc, currentRule, failure) => {
    const changedEntryDocs = {
      ...entryDocs,
      [doc]: entryDocs[doc].replace(currentRule, ""),
    };
    expect(
      findCurrentUiEntryFailures(guardInput({ entryDocs: changedEntryDocs })),
    ).toContain(failure);
  });

  it("rejects Island evidence without a runtime flag marker", () => {
    expect(
      findCurrentUiEntryFailures(guardInput({
        islandPageSource: islandPageSource.replace(
          "data-island-feature-enabled={String(islandEnabled())}",
          "",
        ),
      })),
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
      findCurrentUiEntryFailures(guardInput({
        appRootSource: appRootSource.replace(marker, ""),
      })),
    ).toContain(
      "the shared application root must expose Island and Nature Town feature flags on every route",
    );
  });

  it("rejects the classic Explore smoke suite if it inherits the current Island entry", () => {
    expect(
      findCurrentUiEntryFailures(guardInput({
        smokeSource: smokeSource.replace(
          'VITE_ISLAND_ENABLED: "false"',
          'VITE_ISLAND_ENABLED: "true"',
        ),
      })),
    ).toContain(
      "the legacy Explore smoke suite must use its isolated server with the flag explicitly off",
    );
  });
});
