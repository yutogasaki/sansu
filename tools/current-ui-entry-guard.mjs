export function findCurrentUiEntryFailures({
  scripts,
  appRootSource,
  islandPageSource,
  smokeSource,
  entryDocs = {},
}) {
  const checks = [
    [
      "npm run dev must delegate to the current Island app",
      scripts.dev === "npm run dev:island",
    ],
    [
      "dev:island must enable Island, reserve port 5198, and open the Island route",
      [
        "VITE_ISLAND_ENABLED=true",
        "--port 5198",
        "--strictPort",
        "--open /#/island",
      ].every(
        (part) => scripts["dev:island"]?.includes(part),
      ),
    ],
    [
      "classic Explore must remain an explicit, isolated opt-in",
      [
        "VITE_ISLAND_ENABLED=false",
        "--port 5201",
        "--strictPort",
        "--open /#/explore",
      ].every((part) => scripts["dev:classic"]?.includes(part)),
    ],
    [
      "the legacy Explore smoke suite must use its isolated server with the flag explicitly off",
      scripts["dev:test-server"] === "vite" &&
        smokeSource.includes("npm run dev:test-server") &&
        smokeSource.includes('VITE_ISLAND_ENABLED: "false"') &&
        smokeSource.includes('VITE_EXPLORE_EXPERIENCE: "classic-v1"'),
    ],
    [
      "Nature Town must remain an explicit preview on its own route and port",
      [
        "VITE_ISLAND_ENABLED=true",
        "VITE_NATURE_TOWN_ENABLED=true",
        "--port 5233",
        "--strictPort",
        "--open /#/nature-town",
      ].every((part) => scripts["dev:nature-town"]?.includes(part)),
    ],
    [
      "the shared application root must expose Island and Nature Town feature flags on every route",
      [
        "data-island-feature-enabled={String(islandEnabled())}",
        "data-nature-town-feature-enabled={String(import.meta.env.VITE_NATURE_TOWN_ENABLED === 'true')}",
      ].every((part) => appRootSource.includes(part)),
    ],
    [
      "the Island screen must expose the runtime feature flag beside its candidate identity",
      islandPageSource.includes(
        "data-island-feature-enabled={String(islandEnabled())}",
      ) &&
        islandPageSource.includes("data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE}") &&
        islandPageSource.includes("data-learning-candidate={ISLAND_LEARNING_CANDIDATE}") &&
        islandPageSource.includes("data-build-revision={__BUILD_REVISION__}"),
    ],
    [
      "project memory must identify Island as current and the former Explore launch as historical",
      entryDocs.memory?.includes("Current UI target (2026-09-21)") &&
        entryDocs.memory.includes("`npm run dev` → port 5198 → `/#/island`") &&
        entryDocs.memory.includes("must not be used to infer the current app entry") &&
        !entryDocs.memory.includes(
          "With the build-and-play flag off, the launch contract is",
        ),
    ],
    [
      "the ownership map must distinguish the Island app entry from optional legacy Explore",
      entryDocs.ownershipMap?.includes(
        "通常起動は `npm run dev` → port `5198` → `/#/island`",
      ) &&
        entryDocs.ownershipMap.includes("任意の旧Explore") &&
        !entryDocs.ownershipMap.includes(
          "実装がMVP段階にある間は独立した `/explore` から始め",
        ),
    ],
    [
      "the Explore implementation plan must scope its old app-root contract as historical",
      entryDocs.explorePlan?.includes("任意の旧Exploreモードだけを扱い") &&
        entryDocs.explorePlan.includes(
          "現行標準起動は `npm run dev` → port `5198` → `/#/island`",
        ) &&
        entryDocs.explorePlan.includes("2026-07時点の当時の現在地") &&
        !entryDocs.explorePlan.includes("## 現在地（MVP-2b + cold-open再検証）"),
    ],
    [
      "the risk register must describe Explore entry drift as a current prevention risk",
      entryDocs.riskRegister?.includes("| Explore-mode scope drift |") &&
        !entryDocs.riskRegister.includes(
          "| Exploration spec-to-implementation transition drift |",
        ),
    ],
    [
      "the parent app spec must keep Explore optional and out of the current app entry",
      entryDocs.parentSpec?.includes("旧ExploreはIslandホームとは別の任意モード") &&
        entryDocs.parentSpec.includes("現行アプリの通常起動先を定義しない"),
    ],
    [
      "screen spec 06 must identify Island as current and its Explore launch text as history",
      entryDocs.screenSpec?.includes(
        "`npm run dev` はIsland有効で `/` → `/island` を開く",
      ) && entryDocs.screenSpec.includes("旧Explore/classicの履歴仕様"),
    ],
    [
      "rollout spec 15 must scope its former Explore app entry as historical",
      entryDocs.rolloutSpec?.includes(
        "現行アプリの標準起動は `npm run dev` → `/#/island`",
      ) && entryDocs.rolloutSpec.includes("旧Explore MVP当時の履歴"),
    ],
  ];

  return checks.filter(([, passed]) => !passed).map(([message]) => message);
}
