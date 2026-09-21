export function findCurrentUiEntryFailures({ scripts, appRootSource, islandPageSource, smokeSource }) {
  const checks = [
    [
      "npm run dev must delegate to the current Island app",
      scripts.dev === "npm run dev:island",
    ],
    [
      "dev:island must enable Island, fail on a busy port, and open the Island route",
      ["VITE_ISLAND_ENABLED=true", "--strictPort", "--open /#/island"].every(
        (part) => scripts["dev:island"]?.includes(part),
      ),
    ],
    [
      "classic Explore must remain an explicit, isolated opt-in",
      ["VITE_ISLAND_ENABLED=false", "--strictPort", "--open /#/explore"].every(
        (part) => scripts["dev:classic"]?.includes(part),
      ),
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
  ];

  return checks.filter(([, passed]) => !passed).map(([message]) => message);
}
