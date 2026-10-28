// docs/design/2026-10-23-place-method-comparison/memo-samples-check.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// src/domain/growingIsland/rules.ts
var RULES = {
  dropsPerCompletion: 2,
  townHoursPerCompletion: 2,
  buildHours: 6,
  dawnHour: 6,
  /** Homes stay small so each new friend usually needs a new seed: the core loop. */
  homeCapacity: [0, 1, 1, 2, 2],
  /** Town hours after building, comfort average and island level for each home stage. */
  homeGrowth: [
    void 0,
    { hours: 24, comfort: 1, level: 2 },
    { hours: 48, comfort: 2, level: 4 },
    { hours: 96, comfort: 3, level: 6 }
  ],
  /** Pokomoko's basket feeds the first two friends; farms feed the rest. */
  baseFood: 2,
  basePlay: 2,
  /** The next boat docks this many town hours after the previous friend arrived. */
  boatBaseHours: 48,
  boatHoursPerVillager: 2,
  likeRadius: 3,
  quietRadius: 2,
  styleRadius: 2,
  genkiLevels: [0, 3, 8, 15, 25, 40, 60, 85, 115, 150],
  characterShare: 0.3,
  characterMinimum: 6,
  favoredWeight: 3,
  rareBase: 0.05,
  rareBonus: 0.1,
  rareRichness: 40,
  natureHourCap: 24 * 7,
  soilBase: 0.2,
  soilHalfLife: 3,
  spreadEvery: 12,
  spreadChance: 0.5,
  spreadMoisture: 0.35,
  wildShare: 0.4,
  bigTreeHours: 24 * 7,
  lordTreeHours: 24 * 30,
  appliedMemory: 500,
  /** Completion ids kept for de-duplication; older ones collapse into a time floor. */
  learnedMemory: 3e3
};
var SEED_PRICE = { home: 40, farm: 40, play: 60, wild: 10, market: 120, festival: 160, wonder: 0 };
var WONDER_LEVELS = [3, 5, 7, 9];
var LANDMARK_PRICE = {
  flower: 10,
  bench: 20,
  "water-bowl": 20,
  sapling: 20,
  "water-channel": 10,
  "picnic-table": 40,
  planter: 30,
  swing: 30,
  lantern: 40,
  fence: 20,
  lighthouse: 80,
  bandstand: 30,
  slide: 40,
  trampoline: 40,
  fountain: 50,
  bakery: 70,
  postbox: 20
};
var LAND_PRICE = [120, 240, 480, 720, 960];
var DISTRICT_PRICE_STEP = 240;
var CAPE_LEVEL = [5, 6];
var LIKES = {
  rabbit: ["flower", "play"],
  otter: ["water", "food"],
  fox: ["tree", "light"],
  duck: ["water", "play"],
  squirrel: ["tree", "food"],
  hedgehog: ["farm", "quiet"],
  bird: ["flower", "light"],
  girl: ["water", "play"],
  boy: ["tree", "food"],
  penguin: ["water", "quiet"],
  owl: ["tree", "light"],
  frog: ["water", "flower"]
};
var RARE = {
  penguin: { weight: 0.35, home: "water" },
  owl: { weight: 0.35, home: "tree" },
  frog: { weight: 0.35, home: "flower" }
};
var likesOf = (friend) => LIKES[friend.species];
var KIDS = ["girl", "boy"];
var KID = {
  girl: { name: "\u3048\u307E", trait: "lively", variant: { color: 0, accessory: 0, sparkle: false } },
  boy: { name: "\u3048\u3044\u305F", trait: "lively", variant: { color: 1, accessory: 1, sparkle: false } }
};
var isKid = (species) => species === "girl" || species === "boy";
var FAVORED = {
  water: ["otter", "duck"],
  tree: ["fox", "squirrel"],
  flower: ["rabbit", "bird"],
  farm: ["hedgehog", "rabbit"],
  light: ["bird", "fox"]
};
var SPECIES = ["rabbit", "otter", "fox", "duck", "squirrel", "hedgehog", "bird", "girl", "boy", "penguin", "owl", "frog"];
var AVAILABLE_SPECIES = SPECIES;
var UNLOCKS = [
  { key: "seed:home" },
  { key: "seed:wild" },
  { key: "landmark:flower" },
  { key: "landmark:bench" },
  { key: "landmark:water-bowl" },
  { key: "seed:farm", villagers: 1 },
  { key: "landmark:sapling", villagers: 1 },
  { key: "landmark:water-channel", villagers: 1 },
  { key: "landmark:picnic-table", villagers: 2 },
  { key: "landmark:planter", villagers: 2 },
  { key: "seed:play", level: 2 },
  { key: "landmark:swing", level: 2 },
  { key: "landmark:bandstand", level: 4 },
  { key: "landmark:slide", level: 6 },
  { key: "landmark:postbox", villagers: 3 },
  { key: "landmark:lantern", level: 3 },
  { key: "landmark:fence", level: 3 },
  { key: "landmark:trampoline", level: 7 },
  { key: "landmark:fountain", level: 8 },
  { key: "landmark:bakery", level: 4 },
  { key: "seed:market", level: 4 },
  { key: "seed:festival", level: 5 },
  { key: "landmark:lighthouse", level: 6 }
];
var STYLE_LEVEL = { flagPattern: 7, clothes: 8, hats: 9, cardFrame: 10 };
var FLAG_PATTERNS = 5;
var HATS = 5;
var FOOD_SUPPORT = { farm: 2, market: 4 };
var PLAY_SUPPORT = {
  play: 4,
  festival: 6,
  wonder: 3,
  bench: 1,
  swing: 2,
  bandstand: 2,
  slide: 2,
  trampoline: 2,
  postbox: 1,
  sandbox: 2,
  "garden-hut": 2,
  library: 2
};
var RETIRED_PURCHASES = /* @__PURE__ */ new Set(["seed:wild", "seed:play", "seed:market", "seed:festival", "landmark:planter", "landmark:bakery"]);
var INITIAL_PURCHASES = /* @__PURE__ */ new Set(["seed:home", "landmark:flower", "landmark:sapling", "landmark:water-bowl", "landmark:bench"]);

// src/domain/growingIsland/growth.ts
var WONDER_SLOTS = ["W1", "W2", "W3", "W4"];
function newGrowth() {
  return {
    version: 1,
    welcomed: false,
    built: false,
    expanded: false,
    slots: Object.fromEntries(WONDER_SLOTS.map((id) => [id, { status: "available" }])),
    restoredStock: []
  };
}
function grantGrowthMilestones(state, at) {
  const g = state.growth;
  if (!g) return [];
  g.welcomed ||= state.villagers.length > 0;
  const earned = [g.welcomed, g.built, !!g.matured, g.expanded], events = [];
  WONDER_SLOTS.forEach((id, index) => {
    if (!earned[index] || g.slots[id].status !== "available") return;
    g.slots[id] = {
      status: "granted",
      at,
      reason: id === "W3" ? "nature-transition" : "island-milestone",
      ...id === "W3" ? { targetId: g.matured } : {}
    };
    state.wonderSeeds = (state.wonderSeeds ?? 0) + 1;
    events.push({ type: "wonder-seed" });
  });
  return events;
}

// docs/design/2026-10-23-place-method-comparison/frozen-query.ts
function parseTrialQuery(search) {
  const params = new URLSearchParams(search);
  const values = /* @__PURE__ */ new Map();
  for (const [name, value] of params) if (!values.has(name)) values.set(name, value);
  return Object.freeze({
    get: (name) => values.get(name) ?? null,
    has: (name) => values.has(name)
  });
}
var frozenTrialSearch = typeof window === "undefined" ? "" : window.location.search;
var frozenTrialQuery = parseTrialQuery(frozenTrialSearch);
var frozenTrialEnabled = frozenTrialQuery.get("queryTrial") === "frozen";
function trialQuery() {
  return frozenTrialEnabled ? frozenTrialQuery : new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
}

// docs/design/2026-10-23-place-method-comparison/timing-store.ts
var LIMIT = 400;
var roots = /* @__PURE__ */ new Set(["applyIntent", "GrowingWorld.rebuild", "worldScene.layout"]);
var active = false;
var started = 0;
var sequence = 0;
var dropped = 0;
var filteredFastTerrainCalls = 0;
var spans = [];
var stack = [];
var aggregates = /* @__PURE__ */ new Map();
function trialTimingEnter(name, detail = "") {
  try {
    if (!active || !stack.length && !roots.has(name)) return;
    const token = { id: ++sequence, parentId: stack.at(-1)?.id ?? null, name, detail, start: performance.now(), children: 0 };
    stack.push(token);
    return token;
  } catch {
    return;
  }
}
function trialTimingDetail(token, detail) {
  if (token) token.detail = detail;
}
function trialTimingExit(token, failed = false) {
  if (!token) return;
  try {
    const end = performance.now(), inclusiveMs = end - token.start, selfMs = Math.max(0, inclusiveMs - token.children);
    if (stack.at(-1) !== token) return;
    stack.pop();
    const parent = stack.at(-1);
    if (parent) parent.children += inclusiveMs;
    const key6 = `${token.name}:${token.detail}`, previous = aggregates.get(key6) ?? { calls: 0, inclusiveMs: 0, selfMs: 0, maxMs: 0, failed: 0 };
    previous.calls++;
    previous.inclusiveMs += inclusiveMs;
    previous.selfMs += selfMs;
    previous.maxMs = Math.max(previous.maxMs, inclusiveMs);
    previous.failed += Number(failed);
    aggregates.set(key6, previous);
    if (token.name === "editableIslandWorld" && token.detail !== "cold" && inclusiveMs < 0.1) {
      filteredFastTerrainCalls++;
      return;
    }
    if (spans.length >= LIMIT) {
      dropped++;
      return;
    }
    spans.push({
      id: token.id,
      parentId: token.parentId,
      name: token.name,
      detail: token.detail,
      startMs: token.start - started,
      endMs: end - started,
      inclusiveMs,
      selfMs,
      failed
    });
  } catch {
  }
}

// docs/design/2026-10-23-place-method-comparison/ramp-plane-field.ts
var RAMP_PLANE_REVISION = "fixed-bilinear-interior-ramp-v1";
var smooth = (t) => t * t * (3 - 2 * t);
function rampPlaneOffset(heights, cell, bounds) {
  const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x)), sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
  const x = Math.floor(sx), z = Math.floor(sz), u = sx - x, v = sz - z;
  const h = (dx, dz) => heights[`${x + dx},${z + dz}`] ?? 0;
  const blend = (a, b2) => ((1 - a) * h(0, 0) + a * h(1, 0)) * (1 - b2) + ((1 - a) * h(0, 1) + a * h(1, 1)) * b2;
  const edge = Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
  const interior = smooth(Math.max(0, Math.min(1, edge * 6)));
  return blend(smooth(u), smooth(v)) * (1 - interior) + blend(u, v) * interior;
}

// docs/design/2026-10-23-place-method-comparison/stable-base-field.ts
var STABLE_BASE_REVISION = "fixed-core-base-v1";
var smooth2 = (t) => t * t * (3 - 2 * t);
var stable = (n) => Math.round(n * 1e9) / 1e9;
var height = (x, z) => {
  const east = Math.max(0, x - 5), west = Math.max(0, -x), south = Math.max(0, z - 4);
  const towardBay = Math.max(0, z - 3) / 3.4, forest = 1 / (1 + towardBay * towardBay);
  return 2.3 * (1 - Math.exp(-(Math.max(east, west) * 0.34 * forest + south * 0.04) / 2.3));
};
function stableBaseHeightAt(cell) {
  const dx = Math.max(0, -0.5 - cell.x, cell.x - 5.5), dz = Math.max(0, -0.5 - cell.z, cell.z - 4.5);
  const distance3 = Math.hypot(dx, dz);
  if (distance3 === 0) return 0;
  const weight = smooth2(Math.min(1, distance3));
  const x = Math.floor(cell.x), z = Math.floor(cell.z), u = cell.x - x, v = cell.z - z;
  const a = height(x, z), b2 = height(x + 1, z), c = height(x, z + 1), d = height(x + 1, z + 1);
  const original = u + v <= 1 ? a + u * (b2 - a) + v * (c - a) : d + (c - d) * (1 - u) + (b2 - d) * (1 - v);
  return stable(original * weight);
}

// docs/design/2026-10-23-place-method-comparison/curved-grid.ts
var CURVED_GRID_REVISION = "fixed-two-shear-grid-v1";
var xAmplitude = 0.72;
var zAmplitude = 0.44;
var frequency = Math.PI / 5;
var phase = 0.55;
var xShift = (z) => xAmplitude * Math.sin((z - 2) * frequency);
var zShift = (x) => zAmplitude * (Math.sin((x - 2.5) * frequency + phase) - Math.sin(phase));
function curvedGridPoint(point) {
  const x = point.x + xShift(point.z);
  return { x, z: point.z + zShift(x) };
}
var CURVED_GRID_DESIGN = {
  xAmplitude,
  zAmplitude,
  frequency,
  phase,
  pivot: { x: 2.5, z: 2 },
  xSlopeBound: xAmplitude * frequency,
  zSlopeBound: zAmplitude * frequency,
  limitation: "analytic map preserves area; rendered triangles approximate it. Real world inverse and physical model footprints must be tested separately."
};

// src/domain/islandLife/footprint.ts
function isFacility(kind) {
  return kind === "garden-hut" || kind === "library";
}
function occupiedCells(item) {
  if (!item.cell) return [];
  return (isFacility(item.kind) ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]).map(([x, z]) => ({ x: item.cell.x + x, z: item.cell.z + z }));
}

// docs/product/island-place-goals.json
var island_place_goals_default = {
  id: "place-goals-design-v1",
  version: 1,
  date: "2026-10-10",
  status: "RUNTIME_INTEGRATED",
  artBaseline: {
    candidate: "whole-island-native-3d-05",
    glbRevision: "8398eda9ac084a6e",
    decision: "\u5229\u7528\u8005\u300C\u3044\u3044\u611F\u3058\u3002\u3053\u308C\u3092\u3082\u3068\u306B\u2026\u300D\u306B\u57FA\u3065\u304F\u5168\u5CF6\u306E\u7F8E\u8853\u65B9\u5411\u3002\u30B2\u30FC\u30E0\u5B9F\u88C5\u306E\u53D7\u5165\u3068\u306F\u5225\u3002",
    image: "../design/2026-10-10-island-final-3d/whole-island-render.png"
  },
  scope: "\u65E2\u5B58\u306E\u6750\u6599\u30FB\u6642\u8A08\u30FB\u6240\u6709\u304B\u3089\u3001\u4EFB\u610F\u306E\u76EE\u6A19\u3068\u5834\u6240\u306E\u7D44\u307F\u5408\u308F\u305B\u3092\u672C\u4F53\u3078\u7D71\u5408\u3002\u72EC\u7ACB\u89B3\u5BDF\u30FB\u5B9F\u6A5F\u30FB\u5B9F\u6642\u9593\u306E\u81EA\u7136\u6210\u9577\u306F\u5225\u30B2\u30FC\u30C8\u3002",
  common: {
    ownedOnly: true,
    consumeMembers: false,
    learningRewardChange: false,
    goalMandatory: false,
    additionalCurrency: false,
    clockResetOnReconnect: false,
    connection: "orthogonal-or-one-open-cell-straight-gap",
    memberOrder: "stable-id",
    requirements: "runtime v1 minimum conditions; catalog diagrams are explanations, not acquired growth evidence",
    attachmentMaxWalkCells: 2,
    relationMaxWalkCells: 3,
    gardenMinFreeCells: 2
  },
  goals: [
    {
      id: "P01",
      name: "\u6728\u9670\u306E\u5EAD",
      family: "grove",
      scale: "\u5C0F\u3055\u306A\u76EE\u6A19",
      intent: "\u81EA\u5206\u304C\u690D\u3048\u305F\u6728\u306E\u4E0B\u306B\u3001\u307D\u3053\u3082\u3053\u3068\u5EA7\u308C\u308B\u5EAD\u3092\u80B2\u3066\u308B\u3002",
      focus: {
        x: 30,
        y: 46
      },
      clock: "nature",
      image: "../design/2026-10-10-island-final-3d/viewer-grove-phone.png",
      inputs: [
        {
          role: "tree",
          kind: "landmark:sapling",
          count: 2,
          state: "mature"
        },
        {
          role: "seat",
          kind: "landmark:bench",
          count: 1,
          state: "placed"
        }
      ],
      space: "\u6728\u306E\u3064\u306A\u304C\u308A\u3068\u5E2D\u304C\u540C\u3058\u6728\u9670\u306B\u5165\u308A\u3001\u6B69\u3051\u308B\u5165\u53E3\u30682\u30DE\u30B9\u4EE5\u4E0A\u306E\u5EAD\u3092\u6B8B\u3059\u3002",
      variants: [
        {
          id: "lane",
          label: "\u5217\u306B\u3059\u308B",
          result: "\u679D\u304C\u3064\u306A\u304C\u308B\u3001\u7D30\u9577\u3044\u6728\u9670\u306E\u9053",
          demo: [
            {
              role: "tree",
              x: 1,
              z: 1
            },
            {
              role: "tree",
              x: 3,
              z: 1
            },
            {
              role: "seat",
              x: 2,
              z: 2
            }
          ],
          terrain: "any"
        },
        {
          id: "corner",
          label: "\u89D2\u3092\u3064\u304F\u308B",
          result: "\u5EAD\u306E\u7E01\u3092\u5305\u3080\u3001L\u5B57\u306E\u6728\u9670",
          demo: [
            {
              role: "tree",
              x: 1,
              z: 1
            },
            {
              role: "tree",
              x: 2,
              z: 1
            },
            {
              role: "seat",
              x: 2,
              z: 3
            }
          ],
          terrain: "any"
        },
        {
          id: "alcove",
          label: "\u6728\u9670\u306E\u304F\u307C\u307F",
          result: "\u3064\u306A\u304C\u308B\u6A39\u51A0\u306E\u7AEF\u306B\u304F\u307C\u307F\u3092\u4F5C\u308A\u3001\u7247\u5074\u306E\u6728\u9670\u3067\u5EA7\u308B\u3002",
          demo: [
            {
              role: "tree",
              x: 1,
              z: 2
            },
            {
              role: "tree",
              x: 3,
              z: 2
            },
            {
              role: "seat",
              x: 1,
              z: 3
            }
          ],
          terrain: "any"
        }
      ],
      stages: [
        {
          id: "seeded",
          label: "\u3057\u3053\u3080",
          condition: "\u6728\u3068\u5E2D\u3092\u7F6E\u304F",
          changes: "\u82D7\u3068\u5E2D\u306E\u4F4D\u7F6E\u306B\u3001\u679D\u304C\u5BC4\u308B\u5411\u304D\u3068\u5EAD\u306E\u4F59\u767D\u3092\u4E88\u544A\u3059\u308B\u3002",
          play: "\u5143\u306E\u5E2D\u3067\u304F\u3064\u308D\u3052\u308B\u3002"
        },
        {
          id: "connected",
          label: "\u3064\u306A\u304C\u308B",
          condition: "\u82D7\u306E\u63A5\u7D9A\u3068\u5EAD\u3078\u306E\u5230\u9054\u304C\u6210\u7ACB",
          changes: "\u5730\u9762\u306E\u6839\u3068\u8DB3\u5143\u304C\u9023\u7D9A\u3059\u308B\u3002\u82D7\u306F\u305D\u306E\u307E\u307E\u6B8B\u308B\u3002",
          play: "\u6B21\u306B\u7F6E\u304F\u4F4D\u7F6E\u3092\u5909\u3048\u3066\u3001\u5EAD\u306E\u5F62\u3092\u8A66\u305B\u308B\u3002"
        },
        {
          id: "grown",
          label: "\u80B2\u3064",
          condition: "2\u672C\u304C\u65E2\u5B58\u306E\u6210\u719F\u6BB5\u968E\u3078\u5230\u9054",
          changes: "\u91CD\u306A\u308B\u6A39\u51A0\u304C\u4E00\u3064\u306E\u6728\u9670\u306B\u306A\u308B\u3002\u8FFD\u52A0\u306E\u5F85\u3061\u6642\u9593\u306F\u8A2D\u3051\u306A\u3044\u3002",
          play: "\u540C\u3058\u5F71\u306E\u4E0B\u3078\u6B69\u304D\u3001\u5E2D\u3078\u5EA7\u308C\u308B\u3002"
        },
        {
          id: "lived",
          label: "\u66AE\u3089\u3059",
          condition: "\u5165\u53E3\u30FB\u6728\u9670\u30FB\u5E2D\u3092\u5B9F\u969B\u306E\u884C\u52D5\u306B\u4F7F\u7528",
          changes: "\u307D\u3053\u3082\u3053\u3084\u65E2\u5B58\u4F4F\u4EBA\u304C\u305D\u306E\u6728\u9670\u3068\u5E2D\u3092\u4F7F\u3046\u3002",
          play: "\u3064\u307E\u3093\u3067\u5E2D\u3078\u904B\u3076\u3001\u5EA7\u3063\u3066\u8DB3\u3092\u3086\u3089\u3059\u3002"
        }
      ],
      capability: [
        "derived-place",
        "shared-shade",
        "safe-access"
      ],
      next: [
        "P02",
        "P05"
      ]
    },
    {
      id: "P02",
      name: "\u5927\u6A39\u306E\u4F4F\u307E\u3044",
      family: "grove",
      scale: "\u9577\u304F\u80B2\u3066\u308B\u76EE\u6A19",
      intent: "\u80B2\u3066\u305F\u6728\u3068\u6728\u306E\u5BB6\u304B\u3089\u3001\u4E2D\u3078\u5165\u308C\u308B\u5927\u6A39\u3068\u679D\u306E\u56DE\u5ECA\u3092\u80B2\u3066\u308B\u3002",
      focus: {
        x: 50,
        y: 20
      },
      clock: "nature-and-town",
      image: "../design/2026-10-10-island-final-3d/viewer-grove-phone.png",
      inputs: [
        {
          role: "tree",
          kind: "landmark:sapling",
          count: 4,
          state: "mature; at least 2 big"
        },
        {
          role: "home",
          kind: "plot:home",
          count: 1,
          state: "stage>=2; style=tree"
        },
        {
          role: "seat",
          kind: "landmark:bench",
          count: 1,
          state: "placed"
        }
      ],
      space: "\u6728\u306F\u540C\u3058\u63A5\u7D9A\u9818\u57DF\u3002\u6728\u306E\u5BB6\u306E\u5165\u53E3\u3092\u6B8B\u3057\u3001\u5EAD\u3068\u56DE\u5ECA\u3078\u306E\u9023\u7D9A\u3057\u305F\u7D4C\u8DEF\u3092\u78BA\u4FDD\u3059\u308B\u3002\u666E\u901A\u306E\u5BB6\u306F\u5916\u306E\u5EAD\u3078\u3064\u306A\u3050\u3002",
      variants: [
        {
          id: "lane",
          label: "\u5217\u306B\u3059\u308B",
          result: "\u5E79\u3092\u3064\u306A\u3050\u679D\u306E\u56DE\u5ECA\u3068\u3001\u9053\u6CBF\u3044\u306E\u6728\u306E\u5BB6",
          demo: [
            {
              role: "tree",
              x: 1,
              z: 1
            },
            {
              role: "tree",
              x: 2,
              z: 1
            },
            {
              role: "tree",
              x: 3,
              z: 1
            },
            {
              role: "tree",
              x: 4,
              z: 1
            },
            {
              role: "home",
              x: 3,
              z: 3
            },
            {
              role: "seat",
              x: 4,
              z: 3
            }
          ],
          terrain: "any"
        },
        {
          id: "cluster",
          label: "\u584A\u306B\u3059\u308B",
          result: "\u6839\u3068\u5E79\u304C\u5305\u3080\u4F4F\u307E\u3044\u3001\u5468\u56F2\u3092\u56DE\u308C\u308B\u5927\u304D\u306A\u8449\u306E\u5C4B\u6839",
          demo: [
            {
              role: "tree",
              x: 1,
              z: 1
            },
            {
              role: "tree",
              x: 2,
              z: 1
            },
            {
              role: "tree",
              x: 1,
              z: 2
            },
            {
              role: "tree",
              x: 2,
              z: 2
            },
            {
              role: "home",
              x: 4,
              z: 2
            },
            {
              role: "seat",
              x: 3,
              z: 3
            }
          ],
          terrain: "any"
        },
        {
          id: "court",
          label: "\u4E2D\u5EAD\u3092\u7A7A\u3051\u308B",
          result: "\u5165\u53E3\u306E\u3042\u308B\u7A7A\u6D1E\u3068\u3001\u5EAD\u3092\u56F2\u3080\u679D\u306E\u56DE\u5ECA",
          demo: [
            {
              role: "tree",
              x: 1,
              z: 1
            },
            {
              role: "tree",
              x: 3,
              z: 1
            },
            {
              role: "tree",
              x: 1,
              z: 3
            },
            {
              role: "tree",
              x: 3,
              z: 3
            },
            {
              role: "home",
              x: 5,
              z: 3
            },
            {
              role: "seat",
              x: 2,
              z: 4
            }
          ],
          terrain: "any"
        }
      ],
      stages: [
        {
          id: "seeded",
          label: "\u3057\u3053\u3080",
          condition: "\u6728\u30FB\u6728\u306E\u5BB6\u30FB\u5E2D\u306E\u4F4D\u7F6E\u3092\u9078\u3076",
          changes: "\u5143\u306E\u5BB6\u3092\u4FDD\u3061\u3001\u6839\u304C\u5305\u3080\u90E8\u5206\u3068\u5165\u53E3\u3001\u4E0A\u3078\u4F38\u3073\u308B\u8449\u306E\u5F62\u3092\u4E88\u544A\u3059\u308B\u3002",
          play: "\u82D7\u3068\u5BB6\u3092\u7F6E\u304D\u76F4\u3057\u3066\u3001\u5165\u308A\u53E3\u306E\u5411\u304D\u3092\u8A66\u305B\u308B\u3002"
        },
        {
          id: "connected",
          label: "\u3064\u306A\u304C\u308B",
          condition: "\u6728\u306E\u63A5\u7D9A\u3068\u5BB6\u3078\u306E\u5230\u9054\u304C\u6210\u7ACB",
          changes: "\u6839\u30FB\u5E79\u30FB\u5EAD\u306E\u8DB3\u5143\u304C\u5BC4\u308B\u3002\u5BB6\u3068\u6728\u306EID\u306F\u500B\u5225\u306B\u6B8B\u308B\u3002",
          play: "\u5730\u4E0A\u306E\u5EAD\u3068\u5E2D\u3092\u4F7F\u3048\u308B\u3002"
        },
        {
          id: "grown",
          label: "\u80B2\u3064",
          condition: "4\u672C\u6210\u719F\u30FB2\u672C\u5927\u6728\u30FB\u6728\u306E\u5BB6\u304C\u3053\u3084\u4EE5\u4E0A",
          changes: "\u9752\u7D2B/\u7FE1\u7FE0\u306E\u8449\u3001\u7425\u73C0\u306E\u5E79\u3001\u958B\u3044\u305F\u7A7A\u6D1E\u3001\u652F\u3048\u306E\u3042\u308B\u56DE\u5ECA\u304C\u80B2\u3064\u3002",
          play: "\u5E79\u306E\u5165\u53E3\u304B\u3089\u5165\u308A\u3001\u679D\u306E\u56DE\u5ECA\u3078\u6B69\u3051\u308B\u3002"
        },
        {
          id: "lived",
          label: "\u66AE\u3089\u3059",
          condition: "\u5B9F\u5728\u3059\u308B\u4F4F\u4EBA\u304C\u5230\u9054\u3067\u304D\u308B\u5834\u6240\u3092\u4F7F\u7528",
          changes: "\u5B9F\u4F4F\u4EBA\u304C\u56DE\u5ECA\u306E\u5E2D\u3084\u5165\u53E3\u3092\u4F7F\u3046\u3002\u67B6\u7A7A\u306E\u5165\u5C45\u306F\u8DB3\u3055\u306A\u3044\u3002",
          play: "\u307D\u3053\u3082\u3053\u3092\u56DE\u5ECA\u306E\u5E2D\u3078\u904B\u3076\u3001\u5143\u306E\u5BB6\u306B\u5165\u308B\u3002"
        }
      ],
      capability: [
        "derived-place",
        "shared-shade",
        "safe-access",
        "hollow-and-gallery"
      ],
      next: [
        "P03",
        "P06"
      ]
    },
    {
      id: "P03",
      name: "\u9752\u3044\u6CC9\u306E\u5EAD",
      family: "spring",
      scale: "\u6C34\u3092\u3064\u306A\u3050\u76EE\u6A19",
      intent: "\u81EA\u5206\u306E\u6C34\u3070\u3061\u3068\u307F\u305A\u307F\u3061\u304B\u3089\u3001\u4E00\u7D9A\u304D\u306E\u6CC9\u3068\u6C34\u8FBA\u306E\u5EAD\u3092\u80B2\u3066\u308B\u3002",
      focus: {
        x: 65,
        y: 34
      },
      clock: "existing-water-and-nature",
      image: "../design/2026-10-10-island-final-3d/viewer-village-tablet.png",
      inputs: [
        {
          role: "water",
          kind: "landmark:water-bowl",
          count: 3,
          state: "placed"
        },
        {
          role: "channel",
          kind: "landmark:water-channel",
          count: 2,
          state: "supplied"
        },
        {
          role: "flower",
          kind: "landmark:flower",
          count: 1,
          state: "bloomed"
        },
        {
          role: "seat",
          kind: "landmark:bench",
          count: 1,
          state: "placed"
        }
      ],
      space: "3\u3064\u306E\u6C34\u3070\u3061\u3092\u3001\u5B9F\u969B\u306B\u6C34\u304C\u901A\u308B\u540C\u3058\u9818\u57DF\u3078\u3064\u306A\u3050\u3002\u82B1\u3078\u6C34\u304C\u5C4A\u304D\u3001\u5E2D\u3068\u5165\u53E3\u3078\u6B69\u3051\u308B\u3002\u6BB5\u6CC9\u306F\u5171\u6709\u306E\u5E8A\u9AD8\u3067\u4E0B\u964D\u3059\u308B\u6D41\u308C\u3092\u4F5C\u308C\u308B\u5834\u6240\u306B\u9650\u308B\u3002",
      variants: [
        {
          id: "tiered",
          label: "\u6BB5\u306B\u3064\u306A\u3050",
          result: "\u9271\u77F3\u306E\u6C34\u6E90\u304B\u3089\u6D41\u308C\u308B\u6BB5\u6CC9\u3068\u3001\u6A4B\u3067\u6E21\u308C\u308B\u5EAD",
          demo: [
            {
              role: "water",
              x: 1,
              z: 1
            },
            {
              role: "channel",
              x: 2,
              z: 1
            },
            {
              role: "water",
              x: 3,
              z: 1
            },
            {
              role: "channel",
              x: 4,
              z: 1
            },
            {
              role: "water",
              x: 5,
              z: 1
            },
            {
              role: "flower",
              x: 3,
              z: 3
            },
            {
              role: "seat",
              x: 5,
              z: 3
            }
          ],
          terrain: "slope"
        },
        {
          id: "curve",
          label: "\u66F2\u3052\u308B",
          result: "\u9752\u3044\u6C60\u304C\u66F2\u304C\u3063\u305F\u5CB8\u3067\u3064\u306A\u304C\u308B\u3001\u5E73\u5730\u306E\u6C34\u5EAD",
          demo: [
            {
              role: "water",
              x: 1,
              z: 1
            },
            {
              role: "channel",
              x: 2,
              z: 1
            },
            {
              role: "water",
              x: 3,
              z: 1
            },
            {
              role: "channel",
              x: 3,
              z: 2
            },
            {
              role: "water",
              x: 3,
              z: 3
            },
            {
              role: "flower",
              x: 1,
              z: 3
            },
            {
              role: "seat",
              x: 5,
              z: 3
            }
          ],
          terrain: "any"
        },
        {
          id: "shore",
          label: "\u5CB8\u3078\u958B\u304F",
          result: "\u6C34\u306E\u51FA\u53E3\u3068\u6D77\u8FBA\u304C\u898B\u3048\u308B\u3001\u5165\u308A\u6C5F\u306E\u6C34\u5EAD",
          demo: [
            {
              role: "water",
              x: 1,
              z: 2
            },
            {
              role: "channel",
              x: 2,
              z: 2
            },
            {
              role: "water",
              x: 3,
              z: 2
            },
            {
              role: "channel",
              x: 4,
              z: 2
            },
            {
              role: "water",
              x: 5,
              z: 2
            },
            {
              role: "flower",
              x: 3,
              z: 4
            },
            {
              role: "seat",
              x: 5,
              z: 4
            }
          ],
          terrain: "shore"
        }
      ],
      stages: [
        {
          id: "seeded",
          label: "\u3057\u3053\u3080",
          condition: "\u6C34\u3070\u3061\u30FB\u307F\u305A\u307F\u3061\u30FB\u82B1\u30FB\u5E2D\u3092\u7F6E\u304F",
          changes: "\u6C34\u306E\u5165\u53E3\u3068\u51FA\u53E3\u3001\u6CC9\u306B\u306A\u308B\u7BC4\u56F2\u3092\u4E88\u544A\u3059\u308B\u3002",
          play: "\u6C34\u3070\u3061\u306E\u3044\u3064\u3082\u306E\u8FD4\u4E8B\u3092\u697D\u3057\u3081\u308B\u3002"
        },
        {
          id: "connected",
          label: "\u3064\u306A\u304C\u308B",
          condition: "\u6C34\u6E90\u304B\u3089\u5B9F\u969B\u306B\u901A\u6C34\u3059\u308B",
          changes: "\u5CB8\u3068\u6C34\u9762\u304C\u9023\u7D9A\u3059\u308B\u3002\u4E7E\u3044\u305F\u307F\u305A\u307F\u3061\u3078\u6C34\u306F\u63CF\u304B\u306A\u3044\u3002",
          play: "\u4E00\u304B\u6240\u306E\u7F6E\u304D\u76F4\u3057\u3067\u3001\u901A\u308B\u6C34\u3092\u898B\u6BD4\u3079\u3089\u308C\u308B\u3002"
        },
        {
          id: "grown",
          label: "\u80B2\u3064",
          condition: "\u540C\u3058\u901A\u6C34\u9818\u57DF\u30FB\u54B2\u3044\u305F\u82B1\u30FB\u5230\u9054\u3059\u308B\u5E2D\u304C\u6210\u7ACB",
          changes: "\u6DF1\u3044\u9752\u306E\u6C34\u3001\u9271\u77F3\u306E\u6C34\u6E90\u3001\u6C34\u8FBA\u306E\u82B1\u304C\u5EAD\u3092\u3064\u304F\u308B\u3002\u6BB5\u306F\u5E8A\u9AD8\u306E\u3042\u308B\u5834\u6240\u306B\u9650\u308B\u3002",
          play: "\u6A4B\u3084\u5E2D\u304B\u3089\u6CC9\u3092\u773A\u3081\u308B\u3002\u6C34\u304C\u597D\u304D\u306A\u65E2\u5B58\u4F4F\u4EBA\u304C\u5CB8\u3092\u4F7F\u3048\u308B\u3002"
        },
        {
          id: "lived",
          label: "\u66AE\u3089\u3059",
          condition: "\u5B9F\u901A\u6C34\u3068\u4F4F\u4EBA\u306E\u6C34\u8FBA\u5229\u7528\u304C\u7D99\u7D9A",
          changes: "\u6C34\u306E\u5C4A\u304F\u82B1\u3068\u5B9F\u4F4F\u4EBA\u306E\u5CB8\u3067\u306E\u884C\u52D5\u304C\u540C\u3058\u5834\u6240\u306B\u898B\u3048\u308B\u3002",
          play: "\u6C34\u306B\u89E6\u308C\u3066\u8FD4\u4E8B\u3092\u697D\u3057\u3080\u3001\u5E2D\u3078\u904B\u3076\u3002"
        }
      ],
      capability: [
        "derived-place",
        "shared-water",
        "safe-access",
        "terrain-height-for-tiered"
      ],
      next: [
        "P04",
        "P05"
      ]
    },
    {
      id: "P04",
      name: "\u5165\u308A\u6C5F\u306E\u96C6\u4F1A\u6240",
      family: "community",
      scale: "\u66AE\u3089\u3057\u3092\u307E\u3068\u3081\u308B\u76EE\u6A19",
      intent: "\u6C34\u8FBA\u306E\u5BB6\u3068\u3042\u305D\u3073\u3070\u304B\u3089\u3001\u8272\u3092\u900F\u304B\u3059\u6BBB\u306B\u5305\u307E\u308C\u305F\u5171\u540C\u306E\u5EAD\u3092\u80B2\u3066\u308B\u3002",
      focus: {
        x: 61,
        y: 77
      },
      clock: "town",
      image: "../design/2026-10-10-island-final-3d/viewer-harbor-tablet.png",
      inputs: [
        {
          role: "home",
          kind: "plot:home",
          count: 2,
          state: "stage>=2"
        },
        {
          role: "play",
          kind: "plot:play",
          count: 1,
          state: "built"
        },
        {
          role: "water",
          kind: "landmark:water-bowl",
          count: 1,
          state: "placed; water reaches play"
        }
      ],
      space: "\u53D6\u5F97\u6E08\u307F\u306E\u6D77\u5CB8\u4ED8\u8FD1\u30022\u8ED2\u3068\u3042\u305D\u3073\u3070\u3092\u56F2\u30802\u30DE\u30B9\u4EE5\u4E0A\u306E\u6B69\u3051\u308B\u5EAD\u3092\u6B8B\u3059\u3002\u4E21\u7384\u95A2\u3001\u3042\u305D\u3073\u3070\u3001\u5CF6\u304B\u3089\u306E\u5165\u53E3\u3092\u5B88\u308B\u3002",
      variants: [
        {
          id: "bay",
          label: "\u5411\u304B\u3044\u5408\u3046",
          result: "\u5BB6\u306E\u9593\u306B\u3001\u8584\u3044\u8C9D\u6BBB\u306E\u5C4B\u6839\u304C\u80B2\u3064\u5EAD",
          demo: [
            {
              role: "home",
              x: 1,
              z: 2
            },
            {
              role: "home",
              x: 5,
              z: 2
            },
            {
              role: "water",
              x: 3,
              z: 2
            },
            {
              role: "play",
              x: 3,
              z: 4
            }
          ],
          terrain: "shore"
        },
        {
          id: "lane",
          label: "\u5CB8\u306B\u4E26\u3079\u308B",
          result: "\u5BB6\u3005\u3092\u7D50\u3076\u3001\u6D77\u306E\u898B\u3048\u308B\u9577\u3044\u5171\u540C\u5C4B\u6839",
          demo: [
            {
              role: "home",
              x: 1,
              z: 2
            },
            {
              role: "home",
              x: 3,
              z: 2
            },
            {
              role: "water",
              x: 5,
              z: 2
            },
            {
              role: "play",
              x: 4,
              z: 3
            }
          ],
          terrain: "shore"
        },
        {
          id: "court",
          label: "\u5EAD\u3092\u56F2\u3080",
          result: "\u7247\u5074\u3092\u958B\u3051\u305F\u6BBB\u3068\u3001\u7384\u95A2\u304C\u898B\u3048\u308B\u4E2D\u5EAD",
          demo: [
            {
              role: "home",
              x: 1,
              z: 1
            },
            {
              role: "home",
              x: 4,
              z: 1
            },
            {
              role: "water",
              x: 5,
              z: 2
            },
            {
              role: "play",
              x: 3,
              z: 3
            }
          ],
          terrain: "shore"
        }
      ],
      stages: [
        {
          id: "seeded",
          label: "\u3057\u3053\u3080",
          condition: "\u5BB6\u30FB\u6C34\u30FB\u3042\u305D\u3073\u3070\u306E\u4F4D\u7F6E\u3092\u9078\u3076",
          changes: "\u500B\u3005\u306E\u5BB6\u3092\u4FDD\u3061\u3001\u96C6\u307E\u308C\u308B\u5E8A\u3068\u5C4B\u6839\u306E\u5E83\u304C\u308A\u3092\u4E88\u544A\u3059\u308B\u3002",
          play: "\u3044\u3064\u3082\u306E\u5BB6\u3068\u3042\u305D\u3073\u3070\u3092\u4F7F\u3048\u308B\u3002"
        },
        {
          id: "connected",
          label: "\u3064\u306A\u304C\u308B",
          condition: "\u540C\u3058\u5230\u9054\u3067\u304D\u308B\u5EAD\u306B\u7384\u95A2\u3068\u3042\u305D\u3073\u3070\u304C\u5411\u304F",
          changes: "\u5171\u901A\u306E\u8DB3\u5143\u3068\u66F2\u304C\u3063\u305F\u6881\u304C\u3064\u306A\u304C\u308B\u3002",
          play: "\u5165\u53E3\u3092\u7A7A\u3051\u305F\u5225\u306E\u4E26\u3079\u65B9\u3092\u8A66\u305B\u308B\u3002"
        },
        {
          id: "grown",
          label: "\u80B2\u3064",
          condition: "2\u8ED2\u3053\u3084\u4EE5\u4E0A\u30FB\u5B8C\u6210\u3042\u305D\u3073\u3070\u30FB\u6C34\u8FBA\u304C\u6210\u7ACB",
          changes: "\u9752/\u7D2B\u3092\u900F\u304B\u3059\u8584\u3044\u6BBB\u306E\u5C4B\u6839\u304C\u5171\u540C\u306E\u5EAD\u3092\u5305\u3080\u3002",
          play: "\u5C4B\u6839\u306E\u4E0B\u3078\u904B\u3093\u3060\u307D\u3053\u3082\u3053\u304C\u3001\u305D\u306E\u3042\u305D\u3073\u3070\u3092\u4F7F\u3046\u3002"
        },
        {
          id: "lived",
          label: "\u66AE\u3089\u3059",
          condition: "\u5B9F\u969B\u306E\u4F4F\u4EBA\u3068\u904A\u3073\u5834\u306E\u5229\u7528",
          changes: "\u5B9F\u4F4F\u4EBA\u304C\u5EAD\u3078\u6B69\u3044\u3066\u6765\u308B\u3002\u5BB6\u306E\u5165\u5C45\u67A0\u3084\u3054\u306F\u3093\u3092\u67B6\u7A7A\u306B\u5897\u3084\u3055\u306A\u3044\u3002",
          play: "\u540C\u3058\u3042\u305D\u3073\u3070\u306E\u904A\u3073\u3092\u3001\u5171\u540C\u5C4B\u6839\u306E\u4E0B\u3067\u7E70\u308A\u8FD4\u3059\u3002"
        }
      ],
      capability: [
        "derived-place",
        "shared-water",
        "safe-access",
        "shared-roof"
      ],
      next: [
        "P05",
        "P06"
      ]
    },
    {
      id: "P05",
      name: "\u82B1\u306E\u5C4B\u6839\u306E\u5EAD",
      family: "flowers",
      scale: "\u8272\u3068\u5F62\u3092\u8A66\u3059\u76EE\u6A19",
      intent: "\u690D\u3048\u305F\u82B1\u3068\u5E2D\u304B\u3089\u3001\u5927\u304D\u306A\u82B1\u5F01\u304C\u5305\u3080\u4F11\u61A9\u5834\u6240\u3092\u80B2\u3066\u308B\u3002",
      focus: {
        x: 52,
        y: 57
      },
      clock: "nature",
      image: "../design/2026-10-10-island-final-3d/viewer-garden-tablet.png",
      inputs: [
        {
          role: "flower",
          kind: "landmark:flower",
          count: 4,
          state: "bloomed"
        },
        {
          role: "seat",
          kind: "landmark:bench",
          count: 1,
          state: "placed"
        }
      ],
      space: "\u82B1\u306F\u540C\u3058\u63A5\u7D9A\u9818\u57DF\u3002\u5E2D\u3068\u5165\u53E3\u304C\u5230\u9054\u3067\u304D\u3001\u7A7A\u304D\u5730\u3092\u98F2\u307F\u8FBC\u307E\u306A\u3044\u3002\u57FA\u672C\u306E\u82B1\u8272\u3067\u5B8C\u6210\u3067\u304D\u308B\u3002",
      variants: [
        {
          id: "arch",
          label: "\u5217\u306B\u3059\u308B",
          result: "\u82B1\u5F01\u304C\u3064\u306A\u304C\u308B\u3001\u8272\u306E\u30A2\u30FC\u30C1",
          demo: [
            {
              role: "flower",
              x: 1,
              z: 1
            },
            {
              role: "flower",
              x: 2,
              z: 1
            },
            {
              role: "flower",
              x: 3,
              z: 1
            },
            {
              role: "flower",
              x: 4,
              z: 1
            },
            {
              role: "seat",
              x: 3,
              z: 3
            }
          ],
          terrain: "any"
        },
        {
          id: "canopy",
          label: "\u584A\u306B\u3059\u308B",
          result: "\u8907\u6570\u306E\u830E\u304C\u652F\u3048\u308B\u3001\u5927\u304D\u306A\u82B1\u306E\u5C4B\u6839",
          demo: [
            {
              role: "flower",
              x: 1,
              z: 1
            },
            {
              role: "flower",
              x: 2,
              z: 1
            },
            {
              role: "flower",
              x: 1,
              z: 2
            },
            {
              role: "flower",
              x: 2,
              z: 2
            },
            {
              role: "seat",
              x: 3,
              z: 3
            }
          ],
          terrain: "any"
        },
        {
          id: "court",
          label: "\u4E2D\u5EAD\u3092\u7A7A\u3051\u308B",
          result: "\u82B1\u306B\u56F2\u307E\u308C\u3066\u5EA7\u308C\u308B\u3001\u5165\u53E3\u306E\u3042\u308B\u5EAD",
          demo: [
            {
              role: "flower",
              x: 1,
              z: 1
            },
            {
              role: "flower",
              x: 3,
              z: 1
            },
            {
              role: "flower",
              x: 1,
              z: 3
            },
            {
              role: "flower",
              x: 3,
              z: 3
            },
            {
              role: "seat",
              x: 2,
              z: 4
            }
          ],
          terrain: "any"
        }
      ],
      stages: [
        {
          id: "seeded",
          label: "\u3057\u3053\u3080",
          condition: "\u82B1\u3068\u5E2D\u306E\u4F4D\u7F6E\u3001\u597D\u304D\u306A\u8272\u3092\u9078\u3076",
          changes: "\u8272\u306E\u307E\u3068\u307E\u308A\u3068\u82B1\u5F01\u304C\u5BC4\u308B\u5411\u304D\u3092\u4E88\u544A\u3059\u308B\u3002",
          play: "\u540C\u3058\u82B1\u3092\u89E6\u308A\u3001\u8272\u3084\u4F4D\u7F6E\u3092\u9078\u3079\u308B\u3002"
        },
        {
          id: "connected",
          label: "\u3064\u306A\u304C\u308B",
          condition: "\u82B1\u3068\u5EAD\u306E\u3064\u306A\u304C\u308A\u304C\u6210\u7ACB",
          changes: "\u8449\u3068\u8DB3\u5143\u304C\u9023\u306A\u308A\u3001\u4E2D\u592E\u306E\u4F59\u767D\u304C\u5EAD\u306B\u306A\u308B\u3002",
          play: "\u5217\u30FB\u584A\u30FB\u4E2D\u5EAD\u3078\u7121\u6599\u3067\u4E26\u3079\u76F4\u305B\u308B\u3002"
        },
        {
          id: "grown",
          label: "\u80B2\u3064",
          condition: "4\u682A\u304C\u65E2\u5B58\u306E\u958B\u82B1\u6BB5\u968E\u3078\u5230\u9054",
          changes: "\u8272\u306E\u7570\u306A\u308B\u82B1\u5F01\u304C\u652F\u3048\u5408\u3044\u3001\u5E2D\u306E\u4E0A\u3078\u5C4B\u6839\u3092\u3064\u304F\u308B\u3002",
          play: "\u82B1\u306E\u5C4B\u6839\u306E\u4E0B\u306B\u307D\u3053\u3082\u3053\u3092\u5EA7\u3089\u305B\u3089\u308C\u308B\u3002"
        },
        {
          id: "lived",
          label: "\u66AE\u3089\u3059",
          condition: "\u54B2\u3044\u305F\u82B1\u3068\u5B9F\u969B\u306E\u5E2D\u306E\u5229\u7528",
          changes: "\u5B9F\u4F4F\u4EBA\u304C\u82B1\u3068\u4F11\u61A9\u5834\u6240\u3092\u4F7F\u3046\u3002",
          play: "\u82B1\u3092\u89E6\u308B\u3001\u5E2D\u3078\u904B\u3076\u3001\u81EA\u7136\u306B\u6DF7\u3056\u3063\u305F\u8272\u3092\u697D\u3057\u3080\u3002"
        }
      ],
      capability: [
        "derived-place",
        "safe-access",
        "joined-petals"
      ],
      next: [
        "P03",
        "P04",
        "P06"
      ]
    },
    {
      id: "P06",
      name: "\u3081\u3050\u308C\u308B\u5CF6",
      family: "island",
      scale: "\u5CF6\u5168\u4F53\u306E\u76EE\u6A19",
      intent: "\u81EA\u5206\u304C\u9078\u3093\u3060\u8907\u6570\u306E\u5834\u6240\u3092\u3064\u306A\u304E\u3001\u666F\u8272\u3068\u66AE\u3089\u3057\u304C\u5909\u308F\u308B\u5CF6\u3078\u80B2\u3066\u308B\u3002",
      focus: {
        x: 50,
        y: 50
      },
      clock: "existing-clocks",
      image: "../design/2026-10-10-island-final-3d/viewer-day-desktop.png",
      inputs: [],
      space: "\u80B2\u3063\u305F\u5834\u6240\u304C3\u3064\u306E\u7570\u306A\u308B\u7CFB\u5217\u306B\u5C5E\u3057\u3001\u4E92\u3044\u306E\u5165\u53E3\u3078\u6B69\u3051\u308B\u3002\u5B9F\u969B\u306E\u5BB6\u306B\u4F4F\u3080\u4EF2\u9593\u3068\u307D\u3053\u3082\u3053\u306E\u66AE\u3089\u3057\u304C\u7D9A\u304F\u3002",
      variants: [],
      stages: [
        {
          id: "seeded",
          label: "\u9078\u3076",
          condition: "\u597D\u304D\u306A\u5834\u6240\u3092\u9078\u3076",
          changes: "\u5168\u5CF63D\u3092\u4E00\u3064\u306E\u5230\u9054\u4F8B\u3068\u3057\u3066\u3001\u80B2\u3066\u305F\u3044\u5834\u6240\u3092\u9078\u3079\u308B\u3002",
          play: "\u76EE\u6A19\u3092\u9078\u3070\u305A\u306B\u81EA\u7531\u306B\u904A\u3093\u3067\u3082\u3088\u3044\u3002"
        },
        {
          id: "connected",
          label: "\u3064\u306A\u3050",
          condition: "\u8907\u6570\u306E\u5834\u6240\u306E\u5165\u53E3\u3078\u6B69\u3051\u308B",
          changes: "\u9053\u30FB\u5CB8\u30FB\u6728\u9670\u306E\u7D99\u304E\u76EE\u304C\u9023\u7D9A\u3059\u308B\u3002",
          play: "\u3069\u3053\u3092\u96A3\u3078\u7F6E\u304F\u304B\u3001\u571F\u5730\u3092\u3069\u3061\u3089\u3078\u5E83\u3052\u308B\u304B\u8A66\u305B\u308B\u3002"
        },
        {
          id: "grown",
          label: "\u80B2\u3064",
          condition: "3\u7CFB\u5217\u4EE5\u4E0A\u306E\u5834\u6240\u304C\u80B2\u3064",
          changes: "\u68EE\u30FB\u6C34\u8FBA\u30FB\u5EAD\u30FB\u96C6\u843D\u304C\u540C\u3058\u5E8A\u306E\u8272\u66FF\u3048\u306B\u306A\u3089\u305A\u3001\u4E00\u3064\u306E\u5CF6\u306E\u666F\u8272\u306B\u306A\u308B\u3002",
          play: "\u666F\u8272\u304C\u5909\u308F\u308B\u7D4C\u8DEF\u3092\u307D\u3053\u3082\u3053\u304C\u6B69\u3051\u308B\u3002"
        },
        {
          id: "lived",
          label: "\u66AE\u3089\u3059",
          condition: "\u5B9F\u5728\u3059\u308B\u4EF2\u9593\u304C1\u4EBA\u4EE5\u4E0A\u4F4F\u307F\u3001\u4F7F\u3048\u308B\u5834\u6240\u304C\u3064\u306A\u304C\u308B",
          changes: "\u4EBA\u53E3\u3001\u5BB6\u3001\u98DF\u4E8B\u3001\u4F11\u61A9\u304C\u5B9F\u72B6\u614B\u306B\u4E00\u81F4\u3059\u308B\u3002",
          play: "\u898B\u305B\u308B\u30FB\u540D\u524D\u3092\u3064\u3051\u308B\u30FB\u5199\u771F\u3092\u6B8B\u3059\u3002\u65B0\u3057\u3044\u5730\u533A\u3065\u304F\u308A\u306F\u7D9A\u3051\u3089\u308C\u308B\u3002"
        }
      ],
      capability: [
        "derived-place",
        "safe-access",
        "place-relations",
        "repeatable-districts"
      ],
      next: []
    }
  ],
  combinations: [
    {
      id: "C01",
      families: [
        "grove",
        "spring"
      ],
      name: "\u6839\u3068\u6CC9\u306E\u5EAD",
      condition: "\u6839\u306E\u5EAD\u3068\u6CC9\u306E\u5165\u53E3\u304C\u8FD1\u304F\u3001\u540C\u3058\u901A\u6C34/\u5230\u9054\u304C\u6210\u7ACB",
      visible: "\u6839\u306E\u8DB3\u5143\u306B\u9752\u3044\u6D41\u308C\u3068\u5CB8\u304C\u9023\u7D9A\u3057\u3001\u6728\u9670\u304B\u3089\u6CC9\u304C\u898B\u3048\u308B\u3002",
      play: "\u5B9F\u969B\u306B\u6C34\u304C\u5C4A\u304F\u690D\u7269\u3068\u3001\u6C34\u8FBA/\u6728\u9670\u306E\u5E2D\u3092\u4F7F\u3046\u3002",
      noStack: "\u6728\u9670\u3068\u6C34\u306F\u5171\u6709\u8A08\u7B97\u30921\u56DE\u3060\u3051\u4F7F\u3046\u3002"
    },
    {
      id: "C02",
      families: [
        "spring",
        "flowers"
      ],
      name: "\u6C34\u8FBA\u306E\u82B1\u306E\u5EAD",
      condition: "\u6CC9\u304B\u3089\u82B1\u306E\u9818\u57DF\u3078\u6C34\u304C\u5C4A\u304D\u3001\u5E2D\u3078\u6B69\u3051\u308B",
      visible: "\u6C34\u306E\u7E01\u306B\u82B1\u5F01\u3068\u4F4E\u3044\u5CB8\u304C\u7D9A\u304F\u3002",
      play: "\u5143\u306E\u6E7F\u308A\u3068\u958B\u82B1\u306E\u898F\u5247\u3067\u82B1\u304C\u80B2\u3061\u3001\u6C34\u8FBA\u306E\u5E2D\u3092\u4F7F\u3048\u308B\u3002",
      noStack: "\u6210\u9577\u500D\u7387\u3001\u4EA4\u914D\u62BD\u9078\u3001\u73CD\u3057\u3044\u8272\u306E\u4FDD\u8A3C\u3092\u8FFD\u52A0\u3057\u306A\u3044\u3002"
    },
    {
      id: "C03",
      families: [
        "grove",
        "community"
      ],
      name: "\u68EE\u306E\u96C6\u843D",
      condition: "\u6728\u306E\u5EAD\u3068\u5BB6\u3005\u304C\u540C\u3058\u5230\u9054\u9818\u57DF\u306B\u3042\u308A\u3001\u7384\u95A2\u3092\u4FDD\u3064",
      visible: "\u679D\u306E\u56DE\u5ECA\u3068\u5171\u540C\u306E\u8DB3\u5143\u304C\u5BB6\u3005\u3078\u7D9A\u304F\u3002",
      play: "\u5B9F\u4F4F\u4EBA\u304C\u5BB6\u304B\u3089\u6728\u9670\u3078\u6B69\u304D\u3001\u4F11\u61A9\u3059\u308B\u3002",
      noStack: "\u5165\u5C45\u67A0\u3001\u3054\u306F\u3093\u3001\u3052\u3093\u304D\u3092\u4E8C\u91CD\u306B\u8DB3\u3055\u306A\u3044\u3002"
    },
    {
      id: "C04",
      families: [
        "flowers",
        "community"
      ],
      name: "\u82B1\u306E\u96C6\u4F1A\u6240",
      condition: "\u5BB6/\u3042\u305D\u3073\u3070\u306E\u5EAD\u3068\u82B1\u306E\u5C4B\u6839\u304C\u8FD1\u304F\u3001\u5165\u53E3\u3078\u6B69\u3051\u308B",
      visible: "\u5171\u540C\u306E\u5EAD\u3078\u82B1\u5F01\u3068\u5C4B\u6839\u306E\u7E01\u304C\u7D9A\u304F\u3002",
      play: "\u65E2\u5B58\u306E\u904A\u3073\u3092\u82B1\u3068\u5171\u540C\u5C4B\u6839\u306B\u5305\u307E\u308C\u305F\u5834\u6240\u3067\u7E70\u308A\u8FD4\u305B\u308B\u3002",
      noStack: "\u796D\u308A\u306E\u56DE\u6570\u3084\u5B66\u7FD2\u5831\u916C\u3092\u5897\u3084\u3055\u306A\u3044\u3002"
    }
  ],
  delivery: [
    {
      id: "D1",
      name: "\u4E00\u3064\u306E\u6728\u9670\u304C\u80B2\u3064",
      goal: "P01",
      done: "\u540C\u30582\u672C\u3067\u96E2\u3059/\u3064\u306A\u3050/\u5206\u3051\u308B\u3092\u5B9F\u88C5\u3057\u3001\u6210\u719F\u3068\u6240\u6709\u3092\u4FDD\u3063\u3066\u5B9F\u969B\u306E\u5E2D\u3092\u4F7F\u3046\u3002"
    },
    {
      id: "D2",
      name: "\u5927\u6A39\u3068\u82B1\u3067\u7F6E\u304D\u65B9\u304C\u5909\u308F\u308B",
      goal: "P02 / P05",
      done: "\u540C\u3058\u6750\u6599\u3067\u5217/\u584A/\u4E2D\u5EAD\u306E\u8F2A\u90ED\u3068\u5165\u53E3\u304C\u5909\u308F\u308A\u3001\u7A7A\u6D1E/\u56DE\u5ECA/\u82B1\u306E\u5C4B\u6839\u3092\u5B9F\u969B\u306B\u4F7F\u3046\u3002"
    },
    {
      id: "D3",
      name: "\u6C34\u3068\u5165\u308A\u6C5F\u304C\u3064\u306A\u304C\u308B",
      goal: "P03 / P04",
      done: "\u901A\u6C34\u30FB\u5E8A\u9AD8\u30FB\u7D4C\u8DEF\u30FB\u63A5\u5730\u3092\u540C\u3058\u8A08\u7B97\u3078\u63C3\u3048\u3001\u6BB5\u6CC9\u3068\u6BBB\u306E\u5C4B\u6839\u3092\u4F7F\u3048\u308B\u72B6\u614B\u306B\u3059\u308B\u3002"
    },
    {
      id: "D4",
      name: "\u5CF6\u5168\u4F53\u3078\u80B2\u3064",
      goal: "P06 / C01\u2013C04",
      done: "\u81EA\u7136\u306A\u53D6\u5F97\u304B\u3089\u8907\u6570\u306E\u5834\u6240\u304C\u80B2\u3061\u3001\u5143\u306E\u5EAD\u3092\u4FDD\u3061\u306A\u304C\u3089\u5730\u533A\u3092\u5E83\u3052\u3001\u518D\u8AAD\u8FBC/\u66F4\u65B0\u5F8C\u3082\u7D9A\u304F\u3002"
    }
  ]
};

// src/domain/growingIsland/placeCatalog.ts
var PLACE_CATALOG = island_place_goals_default;
var placeGoalCatalog = island_place_goals_default.goals.map((goal) => ({
  ...goal,
  id: goal.id,
  family: goal.family
}));
var placeGoalDefinition = (id) => placeGoalCatalog.find((goal) => goal.id === id);
var placeInputCount = (id, kind) => placeGoalDefinition(id).inputs.filter((input) => input.kind === kind).reduce((sum, input) => sum + input.count, 0);

// src/domain/growingIsland/placeCapability.ts
function supportsNativePlaceArchitecture(state, world) {
  if (!world) return true;
  const edited = editableIslandWorld(state);
  return Boolean(edited && edited.id === world.id && edited.revision === world.revision);
}
var footprint = (cells) => {
  if (!cells.length) return "";
  const x = Math.min(...cells.map((c) => c.x)), z = Math.min(...cells.map((c) => c.z));
  return cells.map((c) => `${c.x - x},${c.z - z}`).sort().join("|");
};
function supportedPlaceVariant(id, cells, repeated = false) {
  const goal = placeGoalCatalog.find((g) => g.id === id);
  const kind = id === "P02" ? "landmark:sapling" : "landmark:flower";
  const roles = new Set(goal.inputs.filter((input) => input.kind === kind).map((input) => input.role));
  const fixed = goal.variants.find((variant) => footprint(variant.demo.filter((item) => roles.has(item.role))) === footprint(cells))?.id;
  if (fixed || !repeated || cells.length < 4) return fixed;
  const axis = cells.every((cell) => cell.x === cells[0].x) ? "z" : cells.every((cell) => cell.z === cells[0].z) ? "x" : void 0;
  if (!axis) return;
  const ordered = cells.map((cell) => cell[axis]).sort((a, b2) => a - b2);
  if (ordered.some((value, i) => i > 0 && (value - ordered[i - 1] < 1 || value - ordered[i - 1] > 2))) return;
  return id === "P02" ? "lane" : "arch";
}
function supportedPlaceGroups(id, owners, connects) {
  const whole = supportedPlaceVariant(id, owners.map((owner) => owner.cell), true);
  if (whole) return [{ variant: whole, owners: [...owners] }];
  const at = new Map(owners.map((owner) => [`${owner.cell.x},${owner.cell.z}`, owner]));
  const candidates = [], seen = /* @__PURE__ */ new Set();
  const add = (variant, group, connected = false) => {
    const signature2 = group.map((owner) => owner.id).sort().join("|");
    if (group.length < 4 || seen.has(signature2)) return;
    if (!connected) {
      const reached = /* @__PURE__ */ new Set([group[0].id]), queue = [group[0]];
      for (let i = 0; i < queue.length; i++) for (const owner of group)
        if (!reached.has(owner.id) && connects(queue[i].cell, owner.cell)) {
          reached.add(owner.id);
          queue.push(owner);
        }
      if (reached.size !== group.length) return;
    }
    seen.add(signature2);
    candidates.push({ variant, owners: group });
  };
  const goal = placeGoalCatalog.find((goal2) => goal2.id === id), role = id === "P02" ? "tree" : "flower";
  for (const variant of goal.variants.filter((variant2) => !["lane", "arch"].includes(variant2.id))) {
    const template = variant.demo.filter((item) => item.role === role), first = template[0];
    for (const origin of owners) {
      const group = template.map((item) => at.get(`${origin.cell.x + item.x - first.x},${origin.cell.z + item.z - first.z}`));
      if (group.every((owner) => Boolean(owner))) add(variant.id, group);
    }
  }
  for (const axis of ["x", "z"]) {
    const other2 = axis === "x" ? "z" : "x";
    const lines = /* @__PURE__ */ new Map();
    for (const owner of owners) {
      const line = lines.get(owner.cell[other2]) ?? [];
      line.push(owner);
      lines.set(owner.cell[other2], line);
    }
    for (const line of lines.values()) {
      line.sort((a, b2) => a.cell[axis] - b2.cell[axis]);
      let run = [];
      for (const owner of line) {
        const previous = run[run.length - 1];
        if (previous && !connects(previous.cell, owner.cell)) {
          add(id === "P02" ? "lane" : "arch", run, true);
          run = [];
        }
        run.push(owner);
      }
      add(id === "P02" ? "lane" : "arch", run, true);
    }
  }
  const rank = (variant) => variant === "court" ? 0 : ["canopy", "cluster"].includes(variant) ? 1 : 2;
  const signature = (group) => group.map((owner) => owner.id).sort((a, b2) => a.localeCompare(b2, void 0, { numeric: true })).join("|");
  candidates.sort((a, b2) => signature(a.owners).localeCompare(signature(b2.owners), void 0, { numeric: true }) || rank(a.variant) - rank(b2.variant) || b2.owners.length - a.owners.length);
  const used = /* @__PURE__ */ new Set();
  return candidates.filter((candidate) => {
    if (candidate.owners.some((owner) => used.has(owner.id))) return false;
    candidate.owners.forEach((owner) => used.add(owner.id));
    return true;
  });
}

// src/domain/growingIsland/placeTerrain.ts
var stableBaseEnabled = () => typeof window !== "undefined" && trialQuery().get("baseTrial") === "stable";
var stableCoordinate = (value) => Math.round(value * 1e9) / 1e9;
function terrainHeightAt(state, cell, world) {
  const physical = world ?? editableIslandWorld(state);
  if (physical) return physical.floorAt(cell)?.point.y ?? 0;
  return baseTerrainHeightAt(state, cell);
}
function baseTerrainHeightAt(state, cell) {
  if (stableBaseEnabled()) return stableBaseHeightAt(cell);
  if (!state.land.expanded && !state.land.extra.length && !state.land.capes.length && !state.land.districts?.length) return 0;
  const height2 = (x2, z2) => {
    const east = Math.max(0, x2 - 5), west = Math.max(0, -x2), south = Math.max(0, z2 - 4);
    const towardBay = Math.max(0, z2 - 3) / 3.4;
    const forest = 1 / (1 + towardBay * towardBay);
    const bank = Math.max(east, west) * 0.34 * forest + south * 0.04;
    return 2.3 * (1 - Math.exp(-bank / 2.3));
  };
  const x = Math.floor(cell.x), z = Math.floor(cell.z), u = cell.x - x, v = cell.z - z;
  const a = height2(x, z), b2 = height2(x + 1, z), c = height2(x, z + 1), d = height2(x + 1, z + 1);
  return stableCoordinate(u + v <= 1 ? a + u * (b2 - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b2 - d));
}
var PLACE_GALLERY_WIDTH = 0.42;
function placeGalleryRoute(state, place, anchorCell, world) {
  world ??= editableIslandWorld(state);
  if (!supportsNativePlaceArchitecture(state, world)) return [];
  const open = walkableCells(state, world);
  const dry = (cell) => world ? Boolean(world.floorAt(cell)) : onLand(state, cell);
  const integer = (cell) => Number.isInteger(cell.x) && Number.isInteger(cell.z);
  const allowed = new Set(place.footprint.filter((cell) => integer(cell) && open.has(key(cell)) && dry(cell)).map(key));
  const explore = (entrance) => {
    const queue2 = [entrance], previous2 = /* @__PURE__ */ new Map([[key(entrance), void 0]]);
    for (let i = 0; i < queue2.length; i++) for (const cell of passageNeighbors(queue2[i], world)) {
      const id = key(cell);
      if (!allowed.has(id) || previous2.has(id)) continue;
      previous2.set(id, queue2[i]);
      queue2.push(cell);
    }
    return { entrance, queue: queue2, previous: previous2 };
  };
  const choices = place.entrances.filter((cell) => integer(cell) && open.has(key(cell)) && dry(cell)).map(explore).sort((a, b2) => b2.queue.length - a.queue.length || Math.hypot(a.entrance.x - anchorCell.x, a.entrance.z - anchorCell.z) - Math.hypot(b2.entrance.x - anchorCell.x, b2.entrance.z - anchorCell.z) || a.entrance.z - b2.entrance.z || a.entrance.x - b2.entrance.x);
  const chosen = choices[0], base = chosen?.entrance;
  if (!base) return [];
  const ground = terrainHeightAt(state, base, world) + 0.04;
  const rise = 1.35, radius = 0.275, steps = 28;
  const ascent = [{ ...base, y: ground }];
  ascent.push({ x: base.x + radius, z: base.z, y: ground });
  for (let i = 1; i <= steps; i++) {
    const a = i / steps * Math.PI * 2;
    ascent.push({ x: base.x + Math.cos(a) * radius, z: base.z + Math.sin(a) * radius, y: ground + rise * i / steps });
  }
  const { queue, previous } = chosen;
  const branch = [];
  let cursor = queue[queue.length - 1];
  while (cursor) {
    branch.unshift(cursor);
    cursor = previous.get(key(cursor));
  }
  const upper = branch.map((cell) => ({ ...cell, y: terrainHeightAt(state, cell, world) + 0.04 + rise }));
  const clear = (x, z) => (!world || dry({ x, z })) && allowed.has(key({ x: Math.round(x), z: Math.round(z) }));
  let loop;
  for (const radius2 of [1.2, 0.95, 0.72, 0.46]) {
    const center = queue.find((cell) => Array.from({ length: 64 }, (_, i) => i * Math.PI * 2 / 64).every((a) => [radius2 - PLACE_GALLERY_WIDTH / 2, radius2, radius2 + PLACE_GALLERY_WIDTH / 2 + 0.018].every((r) => clear(cell.x + Math.cos(a) * r, cell.z + Math.sin(a) * r))));
    if (center) {
      loop = { center, radius: radius2 };
      break;
    }
  }
  const roundWalk = [];
  if (loop) {
    const approach = [];
    let at = loop.center;
    while (at) {
      approach.unshift(at);
      at = previous.get(key(at));
    }
    roundWalk.push(...approach.map((cell) => ({ ...cell, y: terrainHeightAt(state, cell, world) + 0.04 + rise })));
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const point = { x: loop.center.x + Math.cos(a) * loop.radius, z: loop.center.z + Math.sin(a) * loop.radius };
      roundWalk.push({ ...point, y: terrainHeightAt(state, point, world) + 0.04 + rise });
    }
    roundWalk.push(...approach.slice().reverse().map((cell) => ({ ...cell, y: terrainHeightAt(state, cell, world) + 0.04 + rise })));
  }
  const stroll = [...roundWalk, ...upper, ...upper.slice(0, -1).reverse()];
  const route = [...ascent, ...stroll, ascent[ascent.length - 1], ...ascent.slice(0, -1).reverse()].map((point) => ({ x: stableCoordinate(point.x), y: stableCoordinate(point.y), z: stableCoordinate(point.z) }));
  if (world) for (let i = 0; i < route.length; i++) {
    const a = route[Math.max(0, i - 1)], b2 = route[i];
    const steps2 = Math.max(1, Math.ceil(Math.hypot(b2.x - a.x, b2.z - a.z) / 0.08));
    for (let step = 0; step <= steps2; step++) for (const x of [-PLACE_GALLERY_WIDTH / 2, 0, PLACE_GALLERY_WIDTH / 2])
      for (const z of [-PLACE_GALLERY_WIDTH / 2, 0, PLACE_GALLERY_WIDTH / 2])
        if (!dry({ x: a.x + (b2.x - a.x) * step / steps2 + x, z: a.z + (b2.z - a.z) * step / steps2 + z })) return [];
  }
  return route;
}

// src/domain/growingIsland/landscape.ts
var curvedGridTrial = () => typeof window !== "undefined" && trialQuery().get("terrainTrial") === "H";
var stable2 = (n) => Math.round(n * 1e9) / 1e9;
var linearSample = (f, n) => {
  const lo = Math.floor(n), t = n - lo;
  return f(lo) * (1 - t) + f(lo + 1) * t;
};
var bend = (x) => {
  const d = Math.max(0, -x, x - 5);
  return (x < 0 ? 0.56 : 0.72) * d * d / (6 + d);
};
var sway = (z) => {
  const d = Math.max(0, z - 5);
  return 1.65 * (1 - Math.exp(-d / 6)) * Math.sin(d * Math.PI / 12);
};
var b = (x) => linearSample(bend, x);
var s = (z) => linearSample(sway, z);
function originalLandscapePoint(cell) {
  return { x: stable2(cell.x + s(cell.z)), z: stable2(cell.z + b(cell.x)) };
}
var hill = (x, z) => {
  const d = Math.max(0, z - 7), gate = 1 - Math.exp(-d / 3);
  const center = 2.5 + 0.8 * Math.sin(d * Math.PI / 12);
  const width = 1 + ((x - center) / 5.2) ** 2;
  return 1.16 * gate * (0.5 - 0.5 * Math.cos(d * Math.PI / 6)) / width;
};
function landscapeRise(cell) {
  const x = Math.floor(cell.x), z = Math.floor(cell.z), u = cell.x - x, v = cell.z - z;
  const a = hill(x, z), b2 = hill(x + 1, z), c = hill(x, z + 1), d = hill(x + 1, z + 1);
  return stable2(u + v <= 1 ? a + u * (b2 - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b2 - d));
}
function landscapePoint(cell) {
  globalThis.__memoCount("landscapePoint");
  const point = originalLandscapePoint(cell);
  return curvedGridTrial() ? curvedGridPoint(point) : point;
}

// src/domain/growingIsland/authoredWaterGeometry.ts
var polygonArea = (polygon) => polygon.reduce((sum, point, i) => {
  const next = polygon[(i + 1) % polygon.length];
  return sum + point.x * next.z - next.x * point.z;
}, 0) / 2;
var polygonHasArea = (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > 1e-12;
var cross = (a, b2, point) => (b2.x - a.x) * (point.z - a.z) - (b2.z - a.z) * (point.x - a.x);
var polygonBounds = (polygon) => ({
  minX: Math.min(...polygon.map((p) => p.x)),
  maxX: Math.max(...polygon.map((p) => p.x)),
  minZ: Math.min(...polygon.map((p) => p.z)),
  maxZ: Math.max(...polygon.map((p) => p.z))
});
function clipPolygon(polygon, distance3) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b2 = polygon[(i + 1) % polygon.length], da = distance3(a), db = distance3(b2);
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push({ x: a.x + (b2.x - a.x) * t, z: a.z + (b2.z - a.z) * t });
    }
  }
  return result;
}
function intersectPolygons(polygon, convex) {
  let result = [...polygon];
  const orientation = Math.sign(polygonArea(convex));
  for (let i = 0; i < convex.length && polygonHasArea(result); i++) {
    const a = convex[i], b2 = convex[(i + 1) % convex.length];
    result = clipPolygon(result, (p) => orientation * cross(a, b2, p));
  }
  return result;
}
function subtractPolygon(polygon, convex) {
  const result = [], orientation = Math.sign(polygonArea(convex));
  let inside = [...polygon];
  for (let i = 0; i < convex.length && polygonHasArea(inside); i++) {
    const a = convex[i], b2 = convex[(i + 1) % convex.length], distance3 = (p) => orientation * cross(a, b2, p);
    const outside = clipPolygon(inside, (p) => -distance3(p));
    if (polygonHasArea(outside)) result.push(outside);
    inside = clipPolygon(inside, distance3);
  }
  return result;
}
function triangulateWaterPolygon(input) {
  if (input.length < 3 || input.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return;
  let points = input.filter((p, i) => Math.hypot(p.x - input[(i + input.length - 1) % input.length].x, p.z - input[(i + input.length - 1) % input.length].z) > 1e-10);
  for (let i = points.length - 1; i >= 0 && points.length >= 3; i--) {
    if (Math.abs(cross(points[(i + points.length - 1) % points.length], points[(i + 1) % points.length], points[i])) <= 1e-12) points.splice(i, 1);
  }
  if (!polygonHasArea(points)) return;
  const onSegment = (a, b2, p) => Math.abs(cross(a, b2, p)) <= 1e-12 && p.x >= Math.min(a.x, b2.x) - 1e-12 && p.x <= Math.max(a.x, b2.x) + 1e-12 && p.z >= Math.min(a.z, b2.z) - 1e-12 && p.z <= Math.max(a.z, b2.z) + 1e-12;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (j === i + 1 || i === 0 && j === points.length - 1) continue;
    const a = points[i], b2 = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (cross(a, b2, c) * cross(a, b2, d) < 0 && cross(c, d, a) * cross(c, d, b2) < 0 || onSegment(a, b2, c) || onSegment(a, b2, d) || onSegment(c, d, a) || onSegment(c, d, b2)) return;
  }
  const result = [], orientation = Math.sign(polygonArea(points));
  points = [...points];
  while (points.length > 3) {
    const ear = points.findIndex((b2, i) => {
      const a = points[(i + points.length - 1) % points.length], c = points[(i + 1) % points.length];
      return orientation * cross(a, b2, c) > 1e-12 && !points.some((p, j) => j !== i && j !== (i + points.length - 1) % points.length && j !== (i + 1) % points.length && orientation * cross(a, b2, p) >= -1e-12 && orientation * cross(b2, c, p) >= -1e-12 && orientation * cross(c, a, p) >= -1e-12);
    });
    if (ear < 0) return;
    result.push([points[(ear + points.length - 1) % points.length], points[ear], points[(ear + 1) % points.length]]);
    points.splice(ear, 1);
  }
  result.push(points);
  return result;
}
function mapTrianglePoint(point, from, to) {
  const [a, b2, c] = from, determinant = (b2.z - c.z) * (a.x - c.x) + (c.x - b2.x) * (a.z - c.z);
  const u = ((b2.z - c.z) * (point.x - c.x) + (c.x - b2.x) * (point.z - c.z)) / determinant;
  const v = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / determinant;
  return { x: to[0].x * u + to[1].x * v + to[2].x * (1 - u - v), z: to[0].z * u + to[1].z * v + to[2].z * (1 - u - v) };
}
var protectionRectangle = (cell, half) => [
  { x: cell.x - half, z: cell.z - half },
  { x: cell.x + half, z: cell.z - half },
  { x: cell.x + half, z: cell.z + half },
  { x: cell.x - half, z: cell.z + half }
];

// src/domain/growingIsland/authoredWorldAccess.ts
var AUTHORED_OWNER_HALF_EXTENT = 0.46;
var AUTHORED_WALK_HALF_WIDTH = 0.12;
var clearance = AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH;
var cellKey = (cell) => `${cell.x},${cell.z}`;
var shoreIndexes = /* @__PURE__ */ new WeakMap();
var walkKeys = /* @__PURE__ */ new WeakMap();
var SHORE_DISTANCE = 0.65;
var MAX_SHORE_ANSWERS = 16384;
function shoreIndex(floors) {
  const existing = shoreIndexes.get(floors);
  if (existing) return existing;
  const index = { buckets: /* @__PURE__ */ new Map(), waterBuckets: /* @__PURE__ */ new Map(), waterFloors: /* @__PURE__ */ new Map(), footAnswers: /* @__PURE__ */ new Map(), waterDistances: /* @__PURE__ */ new Map() };
  let order = 0;
  for (const floor of floors) {
    if (floor.kind === "water") index.waterFloors.set(floor.id, polygonBounds(floor.vertices.map((vertex) => vertex.point)));
    for (let i = 0; i < floor.indices.length; i += 3) {
      const points = floor.indices.slice(i, i + 3).map((id) => floor.vertices[id].point), box = polygonBounds(points);
      const triangle = { floorId: floor.id, water: floor.kind === "water", points, box, order: order++ };
      for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
        const id = cellKey({ x, z }), list = index.buckets.get(id) ?? [];
        list.push(triangle);
        index.buckets.set(id, list);
        if (triangle.water) {
          const water = index.waterBuckets.get(id) ?? [];
          water.push(triangle);
          index.waterBuckets.set(id, water);
        }
      }
    }
  }
  shoreIndexes.set(floors, index);
  return index;
}
function shoreTriangles(buckets, point, radius) {
  const triangles = /* @__PURE__ */ new Set();
  for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius); x++)
    for (const triangle of buckets.get(cellKey({ x, z })) ?? []) if (triangle.box.minX <= point.x + radius && triangle.box.maxX >= point.x - radius && triangle.box.minZ <= point.z + radius && triangle.box.maxZ >= point.z - radius) triangles.add(triangle);
  return [...triangles];
}
function waterDistance(point, triangle) {
  const crosses = triangle.points.map((a, i) => {
    const b2 = triangle.points[(i + 1) % triangle.points.length];
    return (b2.x - a.x) * (point.z - a.z) - (b2.z - a.z) * (point.x - a.x);
  });
  if (crosses.every((value) => value >= -1e-12) || crosses.every((value) => value <= 1e-12)) return 0;
  return Math.min(...triangle.points.map((a, i) => {
    const b2 = triangle.points[(i + 1) % triangle.points.length], dx = b2.x - a.x, dz = b2.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
  }));
}
function shoreHeight(triangle, point) {
  return mapTrianglePoint(point, triangle.points, triangle.points.map((p) => ({ x: p.y, z: 0 }))).x;
}
function hasWalkRef(world, cell) {
  if (!Object.isFrozen(world.walkSites)) return world.walkSites.some((site) => cellKey(site.cell) === cellKey(cell));
  let keys = walkKeys.get(world.walkSites);
  if (!keys) {
    keys = new Set(world.walkSites.map((site) => cellKey(site.cell)));
    walkKeys.set(world.walkSites, keys);
  }
  return keys.has(cellKey(cell));
}
function distancesAt(index, point) {
  const id = cellKey(point), existing = index.waterDistances.get(id);
  if (existing) return existing;
  const distances = /* @__PURE__ */ new Map();
  for (const triangle of shoreTriangles(index.waterBuckets, point, SHORE_DISTANCE)) {
    const distance3 = waterDistance(point, triangle), previous = distances.get(triangle.floorId) ?? Infinity;
    distances.set(triangle.floorId, Math.min(previous, distance3));
  }
  if (index.waterDistances.size >= MAX_SHORE_ANSWERS) index.waterDistances.clear();
  index.waterDistances.set(id, distances);
  return distances;
}
function subtractShoreCover(polygon, cover, orientation) {
  for (let i = 0; i < cover.length; i++) {
    const a = cover[i], b2 = cover[(i + 1) % cover.length];
    let inside = true, outside = true;
    for (const p of polygon) {
      const distance3 = orientation * ((b2.x - a.x) * (p.z - a.z) - (b2.z - a.z) * (p.x - a.x));
      inside &&= distance3 > 0;
      outside &&= distance3 < 0;
      if (!inside && !outside) break;
    }
    if (inside) continue;
    if (outside) return [polygon];
    return subtractPolygon(polygon, cover);
  }
  return [];
}
function footSupported(index, point) {
  const id = `${point.x},${point.y},${point.z}`, existing = index.footAnswers.get(id);
  if (existing !== void 0) return existing;
  const square = protectionRectangle(point, AUTHORED_WALK_HALF_WIDTH);
  const triangles = shoreTriangles(index.buckets, point, AUTHORED_WALK_HALF_WIDTH);
  const minX = Math.floor(point.x - SHORE_DISTANCE), minZ = Math.floor(point.z - SHORE_DISTANCE);
  triangles.sort((a, b2) => Math.max(minZ, Math.floor(a.box.minZ)) - Math.max(minZ, Math.floor(b2.box.minZ)) || Math.max(minX, Math.floor(a.box.minX)) - Math.max(minX, Math.floor(b2.box.minX)) || a.order - b2.order);
  const overlaps = [];
  let answer = true;
  for (const triangle of triangles) {
    const overlap = intersectPolygons(square, triangle.points);
    if (!polygonHasArea(overlap)) continue;
    if (triangle.water || polygonHasArea(clipPolygon(overlap, (p) => shoreHeight(triangle, p) - point.y - 0.25 - 1e-7))) {
      answer = false;
      break;
    }
    overlaps.push({ triangle, overlap });
  }
  if (answer) {
    let uncovered = [square];
    for (const { triangle, overlap } of overlaps) {
      let cover = clipPolygon(overlap, (p) => shoreHeight(triangle, p) - point.y + 0.25 + 1e-7);
      cover = clipPolygon(cover, (p) => point.y + 0.25 + 1e-7 - shoreHeight(triangle, p));
      if (polygonHasArea(cover)) {
        const orientation = Math.sign(polygonArea(cover));
        uncovered = uncovered.flatMap((piece) => subtractShoreCover(piece, cover, orientation));
      }
      if (!uncovered.length) break;
    }
    answer = !uncovered.length;
  }
  if (index.footAnswers.size >= MAX_SHORE_ANSWERS) index.footAnswers.clear();
  index.footAnswers.set(id, answer);
  return answer;
}
function isAuthoredShoreEntrySupported(world, cell, waterFloorIds) {
  if (!hasWalkRef(world, cell)) return false;
  const support = world.floorAt(cell), original = world.anchorFloorAt(cell);
  if (!support || !original || Math.hypot(support.point.x - original.point.x, support.point.z - original.point.z) > 1e-5 || Math.abs(support.point.y - original.point.y) > 0.28) return false;
  const index = shoreIndex(world.floors);
  if (!waterFloorIds.length || waterFloorIds.some((id) => !index.waterFloors.has(id))) return false;
  const distances = distancesAt(index, support.point);
  const distance3 = Math.min(...waterFloorIds.map((id) => distances.get(id) ?? Infinity));
  return distance3 > AUTHORED_WALK_HALF_WIDTH * Math.SQRT2 && distance3 <= SHORE_DISTANCE && footSupported(index, support.point);
}
function authoredPointBlocked(point, owner) {
  return Math.abs(point.x - owner.x) <= clearance && Math.abs(point.z - owner.z) <= clearance;
}
function authoredApproachCells(cell, world) {
  const ownerSite = world.sites.find((site) => cellKey(site.cell) === cellKey(cell));
  if (!ownerSite) return [];
  const explicit = world.shoreApproachCells(cell);
  if (explicit !== void 0) return explicit.length ? [cell, ...explicit] : [];
  if (!ownerSite.support) {
    const bankSupported = (site) => {
      if (!site.support) return false;
      const anchor = ownerSite.point, p = site.support.point, dx = p.x - anchor.x, dz = p.z - anchor.z, length = Math.hypot(dx, dz);
      if (length <= clearance || length > 1.1 || Math.abs(p.y - anchor.y) > 0.28) return false;
      const stop = Math.min(length, clearance + 0.04), nx = -dz / length, nz = dx / length;
      for (let i = 0; i <= 4; i++) for (const side of [-AUTHORED_WALK_HALF_WIDTH, 0, AUTHORED_WALK_HALF_WIDTH]) {
        const r = length + (stop - length) * i / 4;
        const point = { x: anchor.x + dx / length * r + nx * side, z: anchor.z + dz / length * r + nz * side };
        const logical = world.logicalAt(point), floor = logical && world.floorAt(logical);
        if (!floor || Math.hypot(point.x - floor.point.x, point.z - floor.point.z) > 1e-5 || Math.abs(floor.point.y - p.y) > 0.25) return false;
      }
      return true;
    };
    return world.walkSites.filter((site) => site.ref.districtId === ownerSite.ref.districtId && !authoredPointBlocked(site.cell, cell) && Math.hypot(site.cell.x - cell.x, site.cell.z - cell.z) <= 1.1 && bankSupported(site)).map((site) => ({ ...site.cell })).sort((a, b2) => Math.hypot(a.x - cell.x, a.z - cell.z) - Math.hypot(b2.x - cell.x, b2.z - cell.z) || b2.z - cell.z - (a.z - cell.z) || a.x - b2.x);
  }
  const queue = [cell], seen = /* @__PURE__ */ new Set([cellKey(cell)]), approaches = [];
  for (let i = 0; i < queue.length; i++) for (const next of world.neighbors(queue[i], "walk")) {
    const id = cellKey(next);
    if (seen.has(id) || Math.hypot(next.x - cell.x, next.z - cell.z) > 1.1) continue;
    seen.add(id);
    if (authoredPointBlocked(next, cell)) queue.push(next);
    else approaches.push(next);
  }
  return [cell, ...approaches.sort((a, b2) => {
    const d = Math.hypot(a.x - cell.x, a.z - cell.z) - Math.hypot(b2.x - cell.x, b2.z - cell.z);
    return d || b2.z - cell.z - (a.z - cell.z) || a.x - b2.x;
  })];
}

// src/domain/growingIsland/worldDefinition.ts
var EPSILON = 1e-7;
var stable3 = (value) => Math.round(value * 1e9) / 1e9 || 0;
var cellKey2 = (cell) => `${cell.x},${cell.z}`;
var refKey = (ref) => JSON.stringify([ref.districtId, ref.siteId]);
var floorKey = (districtId, floorId) => JSON.stringify([districtId, floorId]);
var turn = (x, z, count2) => count2 === 1 ? { x: -z, z: x } : count2 === 2 ? { x: -x, z: -z } : count2 === 3 ? { x: z, z: -x } : { x, z };
function requireWorld(valid, message) {
  if (!valid) throw new Error(`Invalid island world: ${message}`);
}
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
var FINE_DIVISIONS = 16;
var FINE_THRESHOLD = 64;
var fineCell = (value) => Math.max(0, Math.min(FINE_DIVISIONS - 1, Math.floor(value * FINE_DIVISIONS)));
function barycentric(at, a, b2, c) {
  const determinant = (b2.z - c.z) * (a.x - c.x) + (c.x - b2.x) * (a.z - c.z);
  if (Math.abs(determinant) <= 1e-12) return void 0;
  const u = ((b2.z - c.z) * (at.x - c.x) + (c.x - b2.x) * (at.z - c.z)) / determinant;
  const v = ((c.z - a.z) * (at.x - c.x) + (a.x - c.x) * (at.z - c.z)) / determinant;
  const w = 1 - u - v;
  return u >= -EPSILON && v >= -EPSILON && w >= -EPSILON ? [u, v, w] : void 0;
}
var interpolate = (points, weights) => ({
  x: stable3(points.reduce((value, point, i) => value + point.x * weights[i], 0)),
  y: stable3(points.reduce((value, point, i) => value + point.y * weights[i], 0)),
  z: stable3(points.reduce((value, point, i) => value + point.z * weights[i], 0))
});
function walkEdgeError(from, to, floorAt) {
  if (!from?.support || !to?.support) return "walk edge endpoint has no actual dry floor";
  const dx = to.cell.x - from.cell.x, dz = to.cell.z - from.cell.z, length = Math.hypot(dx, dz);
  if (!(length > 0 && length <= 256)) return "walk edge length";
  const steps = Math.max(8, Math.ceil(length * 8));
  const physicalStep = Math.hypot(to.support.point.x - from.support.point.x, to.support.point.z - from.support.point.z) / steps * 2 + 0.15;
  let previous;
  for (let i = 0; i <= steps; i++) {
    for (const side of [-0.12, 0, 0.12]) {
      const cell = { x: from.cell.x + dx * i / steps - dz / length * side, z: from.cell.z + dz * i / steps + dx / length * side };
      const floor = floorAt(cell);
      if (!floor) return "walk edge crosses missing floor or water";
      if (side !== 0) continue;
      if (previous) {
        if (Math.abs(floor.point.y - previous.y) > 0.25) return "walk edge has an unsupported vertical step";
        if (Math.hypot(floor.point.x - previous.x, floor.point.z - previous.z) > physicalStep) return "walk edge crosses separated physical floors";
      }
      const endpoint = i === 0 ? from.support : i === steps ? to.support : void 0;
      if (endpoint && Math.hypot(floor.point.x - endpoint.point.x, floor.point.y - endpoint.point.y, floor.point.z - endpoint.point.z) >= 0.025)
        return "walk endpoint differs from its site floor";
      previous = floor.point;
    }
  }
}
function compileWorldDefinition(input, edgeBuilder) {
  const __trialTimingToken = trialTimingEnter("compileWorldDefinition", edgeBuilder ? "derived-edges" : "supplied-edges");
  let __trialTimingFailed = false;
  try {
    requireWorld(input.version === 1 && typeof input.id === "string" && input.id.length > 0, "unknown version or missing ID");
    requireWorld(input.revision === void 0 || typeof input.revision === "string" && input.revision.length > 0, "geometry revision");
    requireWorld(Array.isArray(input.districts) && Array.isArray(input.edges), "districts or edges");
    if (input.source) requireWorld(input.source.artifact && /^[a-f0-9]{64}$/.test(input.source.sha256), "source identity");
    const definition = structuredClone(input);
    const triangles = [], anchorTriangles = [], originalTriangles = [];
    const floors = [], anchorFloors = [], sites = [], surfaces = [];
    const districtIds = /* @__PURE__ */ new Set(), allFloors = /* @__PURE__ */ new Set(), allAnchorFloors = /* @__PURE__ */ new Set(), allSurfaces = /* @__PURE__ */ new Set();
    const refs = /* @__PURE__ */ new Map(), cells = /* @__PURE__ */ new Map();
    const finite = (point) => Number.isFinite(point.x) && Number.isFinite(point.z) && (!("y" in point) || Number.isFinite(point.y));
    const unit = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
    const logicalPoint = (district, cell) => {
      const p = turn(cell.x, cell.z, district.turn);
      return { x: p.x + district.logicalOrigin.x, z: p.z + district.logicalOrigin.z };
    };
    const worldPoint = (district, point) => {
      const p = turn(point.x, point.z, district.turn);
      return { x: p.x + district.worldOrigin.x, y: point.y + district.worldOrigin.y, z: p.z + district.worldOrigin.z };
    };
    for (const district of definition.districts) {
      requireWorld(district.id && !districtIds.has(district.id), "duplicate district");
      districtIds.add(district.id);
      requireWorld(finite(district.logicalOrigin) && Number.isInteger(district.logicalOrigin.x) && Number.isInteger(district.logicalOrigin.z) && finite(district.worldOrigin) && Number.isFinite(district.worldOrigin.y) && [0, 1, 2, 3].includes(district.turn), "district origin or turn");
      requireWorld(district.waterCarvingScopes === void 0 || Array.isArray(district.waterCarvingScopes), "water carving scopes");
      const scopeIds = /* @__PURE__ */ new Set(), originals = district.anchorFloors?.length ? district.anchorFloors : district.floors;
      for (const scope of district.waterCarvingScopes ?? []) {
        requireWorld(typeof scope.id === "string" && scope.id.length && !scopeIds.has(scope.id), "duplicate or missing water carving scope");
        scopeIds.add(scope.id);
        requireWorld(Array.isArray(scope.floorIds) && scope.floorIds.length && new Set(scope.floorIds).size === scope.floorIds.length && scope.floorIds.every((id) => originals.some((floor) => floor.id === id && floor.kind === "ground")), "water carving original ground");
        requireWorld(Array.isArray(scope.envelope) && triangulateWaterPolygon(scope.envelope), "water carving envelope");
        const orientation = Math.sign(polygonArea(scope.envelope));
        requireWorld(scope.envelope.every((a, i) => {
          const b2 = scope.envelope[(i + 1) % scope.envelope.length], c = scope.envelope[(i + 2) % scope.envelope.length];
          return orientation * ((b2.x - a.x) * (c.z - b2.z) - (b2.z - a.z) * (c.x - b2.x)) >= -1e-12;
        }), "water carving envelope must be convex");
      }
      const compileFloor = (floor, anchor) => {
        const id = floorKey(district.id, floor.id);
        const ids = anchor ? allAnchorFloors : allFloors;
        requireWorld(floor.id && !ids.has(id), "duplicate floor");
        ids.add(id);
        requireWorld(["ground", "deck", "water"].includes(floor.kind) && floor.indices.length > 0 && floor.indices.length % 3 === 0, "floor kind or indices");
        requireWorld(/^#[a-fA-F0-9]{6}$/.test(floor.color), "floor color");
        if (floor.material !== void 0) requireWorld(floor.material && unit(floor.material.roughness) && unit(floor.material.metalness) && typeof floor.material.doubleSided === "boolean", "floor material");
        const vertices = floor.vertices.map((vertex) => {
          requireWorld(finite(vertex.cell) && finite(vertex.point) && Number.isFinite(vertex.point.y), "non-finite floor vertex");
          const normal = vertex.normal;
          if (normal !== void 0) requireWorld(normal && finite(normal) && Number.isFinite(normal.y) && Math.hypot(normal.x, normal.y, normal.z) > 1e-12, "floor normal");
          const rotated = normal ? turn(normal.x, normal.z, district.turn) : void 0;
          return {
            cell: logicalPoint(district, vertex.cell),
            point: worldPoint(district, vertex.point),
            ...normal && rotated ? { normal: { x: rotated.x, y: normal.y, z: rotated.z } } : {}
          };
        });
        for (const index of floor.indices) requireWorld(Number.isInteger(index) && index >= 0 && index < vertices.length, "floor index out of range");
        for (let i = 0; i < floor.indices.length; i += 3) {
          const v = floor.indices.slice(i, i + 3).map((index) => vertices[index]);
          const area2 = (points2) => Math.abs((points2[1].x - points2[0].x) * (points2[2].z - points2[0].z) - (points2[2].x - points2[0].x) * (points2[1].z - points2[0].z));
          requireWorld(area2(v.map((vertex) => vertex.cell)) > 1e-12 && area2(v.map((vertex) => vertex.point)) > 1e-12, "collapsed floor triangle");
          const triangle = {
            floorId: id,
            kind: floor.kind,
            cells: v.map((vertex) => vertex.cell),
            points: v.map((vertex) => vertex.point)
          };
          (anchor ? anchorTriangles : triangles).push(triangle);
          if (anchor || !district.anchorFloors?.length) originalTriangles.push(triangle);
        }
        (anchor ? anchorFloors : floors).push({
          id,
          kind: floor.kind,
          color: floor.color,
          vertices,
          indices: [...floor.indices],
          ...floor.material ? { material: { ...floor.material } } : {}
        });
      };
      for (const floor of district.floors) compileFloor(floor, false);
      for (const floor of district.anchorFloors ?? []) compileFloor(floor, true);
      for (const surface of district.surfaces ?? []) {
        const id = floorKey(district.id, surface.id);
        requireWorld(surface.id && !allSurfaces.has(id), "duplicate surface");
        allSurfaces.add(id);
        requireWorld(["bank", "flow"].includes(surface.kind) && Array.isArray(surface.vertices) && Array.isArray(surface.indices) && surface.indices.length > 0 && surface.indices.length % 3 === 0, "surface kind or indices");
        const material = surface.material;
        requireWorld(material && /^#[a-fA-F0-9]{6}$/.test(material.color) && unit(material.roughness) && unit(material.metalness) && (material.opacity === void 0 || unit(material.opacity)), "surface material");
        const vertices = surface.vertices.map((point) => {
          requireWorld(finite(point) && Number.isFinite(point.y), "non-finite surface vertex");
          return worldPoint(district, point);
        });
        for (const index of surface.indices) requireWorld(Number.isInteger(index) && index >= 0 && index < vertices.length, "surface index out of range");
        for (let i = 0; i < surface.indices.length; i += 3) {
          const [a, b2, c] = surface.indices.slice(i, i + 3).map((index) => vertices[index]);
          const u = { x: b2.x - a.x, y: b2.y - a.y, z: b2.z - a.z }, v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
          requireWorld(Math.hypot(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x) > 1e-12, "collapsed surface triangle");
        }
        surfaces.push({ id, kind: surface.kind, vertices, indices: [...surface.indices], material: { ...material } });
      }
    }
    const bins = (triangleList, physical) => {
      const buckets = /* @__PURE__ */ new Map();
      const bounds2 = triangleList.map((triangle) => {
        const points2 = physical ? triangle.points : triangle.cells;
        const minX = Math.min(...points2.map((p) => p.x)), maxX = Math.max(...points2.map((p) => p.x));
        const minZ = Math.min(...points2.map((p) => p.z)), maxZ = Math.max(...points2.map((p) => p.z));
        const pad = (min, max) => EPSILON * (1 + 2 * (max - min)) + Number.EPSILON * Math.max(1, Math.abs(min), Math.abs(max)) * 8;
        const area2 = Math.abs((points2[1].x - points2[0].x) * (points2[2].z - points2[0].z) - (points2[2].x - points2[0].x) * (points2[1].z - points2[0].z));
        const broad = area2 <= Math.max(maxX - minX, maxZ - minZ) ** 2 * 1e-8;
        return { minX, maxX, minZ, maxZ, padX: pad(minX, maxX), padZ: pad(minZ, maxZ), broad };
      });
      bounds2.forEach((box, index) => {
        const x0 = Math.floor(box.minX), x1 = Math.floor(box.maxX);
        const z0 = Math.floor(box.minZ), z1 = Math.floor(box.maxZ);
        requireWorld((x1 - x0 + 1) * (z1 - z0 + 1) <= 1e5, "floor triangle spans an excessive search area");
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
          const id = cellKey2({ x, z }), bucket = buckets.get(id) ?? { indices: [] };
          bucket.indices.push(index);
          buckets.set(id, bucket);
        }
      });
      for (const [id, bucket] of buckets) {
        if (bucket.indices.length <= FINE_THRESHOLD) continue;
        const [x, z] = id.split(",").map(Number);
        const ranges = bucket.indices.map((index) => {
          const box = bounds2[index];
          return {
            index,
            x0: box.broad ? 0 : fineCell(box.minX - box.padX - x),
            x1: box.broad ? FINE_DIVISIONS - 1 : fineCell(box.maxX + box.padX - x),
            z0: box.broad ? 0 : fineCell(box.minZ - box.padZ - z),
            z1: box.broad ? FINE_DIVISIONS - 1 : fineCell(box.maxZ + box.padZ - z)
          };
        });
        if (ranges.reduce((count2, box) => count2 + (box.x1 - box.x0 + 1) * (box.z1 - box.z0 + 1), 0) >= bucket.indices.length * FINE_DIVISIONS ** 2 / 4) continue;
        const fine = /* @__PURE__ */ new Map();
        for (const { index, x0, x1, z0, z1 } of ranges) {
          for (let fz = z0; fz <= z1; fz++) for (let fx = x0; fx <= x1; fx++) {
            const cell = fz * FINE_DIVISIONS + fx, list = fine.get(cell) ?? [];
            list.push(index);
            fine.set(cell, list);
          }
        }
        bucket.fine = fine;
      }
      return buckets;
    };
    const createSampler = (triangleList, physicalQueries) => {
      const logicalBins = bins(triangleList, false);
      const sharedCoordinates = physicalQueries && triangleList.every((triangle) => triangle.cells.every((cell, i) => cell.x === triangle.points[i].x && cell.z === triangle.points[i].z));
      const physicalBins = physicalQueries && !sharedCoordinates ? bins(triangleList, true) : logicalBins;
      return (at, physical, floorId, y, raw = false) => {
        if (!finite(at)) return void 0;
        let best;
        const water = [];
        const buckets = physical ? physicalBins : logicalBins;
        const candidates = /* @__PURE__ */ new Set();
        const seenBuckets = /* @__PURE__ */ new Set();
        for (const dx of [0, -EPSILON, EPSILON]) for (const dz of [0, -EPSILON, EPSILON]) {
          const x = Math.floor(at.x + dx), z = Math.floor(at.z + dz), id = cellKey2({ x, z });
          if (seenBuckets.has(id)) continue;
          seenBuckets.add(id);
          const bucket = buckets.get(id);
          if (!bucket) continue;
          const list = bucket.fine ? bucket.fine.get(fineCell(at.z - z) * FINE_DIVISIONS + fineCell(at.x - x)) : bucket.indices;
          for (const index of list ?? []) candidates.add(index);
        }
        for (const index of candidates) {
          const triangle = triangleList[index];
          if (floorId && triangle.floorId !== floorId && (raw || triangle.kind !== "water")) continue;
          const weights = barycentric(at, ...physical ? triangle.points : triangle.cells);
          if (!weights) continue;
          const point = interpolate(triangle.points, weights);
          if (triangle.kind === "water" && !raw) {
            water.push(point);
            continue;
          }
          const cell = { x: stable3(triangle.cells.reduce((value, p, i) => value + p.x * weights[i], 0)), z: stable3(triangle.cells.reduce((value, p, i) => value + p.z * weights[i], 0)) };
          if (!best || (y === void 0 ? point.y > best.point.y + EPSILON : Math.abs(point.y - y) < Math.abs(best.point.y - y) - EPSILON))
            best = { cell, point, floorId: triangle.floorId, triangle: index };
        }
        if (!raw && best && water.some((point) => Math.hypot(point.x - best.point.x, point.z - best.point.z) < 1e-5 && point.y > best.point.y + EPSILON)) return void 0;
        return best;
      };
    };
    const sample = createSampler(triangles, true), sampleAnchor = createSampler(anchorTriangles, false);
    const sampleOriginal = originalTriangles.length === anchorTriangles.length ? sampleAnchor : !anchorTriangles.length ? sample : createSampler(originalTriangles, false);
    for (const district of definition.districts) {
      for (const site of district.sites) {
        const ref = { districtId: district.id, siteId: site.id }, id = refKey(ref), cell = logicalPoint(district, site.cell), floorId = floorKey(district.id, site.floorId);
        requireWorld(site.id && !refs.has(id) && !cells.has(cellKey2(cell)), "duplicate site ID or logical cell");
        requireWorld(typeof site.placement === "boolean" && finite(site.cell) && (!site.placement || Number.isInteger(site.cell.x) && Number.isInteger(site.cell.z)), "site cell or placement right");
        const anchored = site.anchorPoint !== void 0;
        requireWorld((anchored ? allAnchorFloors : allFloors).has(floorId), "site refers to an unknown floor");
        const anchor = anchored ? sampleAnchor(cell, false, floorId, void 0, true) : sample(cell, false, floorId);
        requireWorld(anchor, anchored ? "site anchor has no original floor" : "site has no actual dry floor");
        if (anchored) {
          requireWorld(finite(site.anchorPoint) && Number.isFinite(site.anchorPoint.y), "non-finite site anchor");
          const point = worldPoint(district, site.anchorPoint);
          requireWorld(Math.hypot(point.x - anchor.point.x, point.y - anchor.point.y, point.z - anchor.point.z) <= 1e-6, "site anchor differs from its original floor");
        }
        const support = sample(cell, false);
        const compiled = { ref, cell, point: anchor.point, floorId, placement: site.placement, ...support ? { support } : {} };
        refs.set(id, compiled);
        cells.set(cellKey2(cell), compiled);
        sites.push(compiled);
      }
      const ports = /* @__PURE__ */ new Set();
      for (const port of district.ports) {
        requireWorld(port.id && !ports.has(port.id) && refs.has(refKey({ districtId: district.id, siteId: port.siteId })), "port ID or site");
        ports.add(port.id);
      }
    }
    if (edgeBuilder) {
      requireWorld(definition.edges.length === 0, "derived edges require an empty input graph");
      const generated = edgeBuilder(Object.freeze({
        floors: freeze(floors),
        floorAt: (cell, floorId) => sample(cell, false, floorId),
        isWalkEdgeSupported: (from, to) => !walkEdgeError(cells.get(cellKey2(from)), cells.get(cellKey2(to)), (cell) => sample(cell, false))
      }));
      requireWorld(Array.isArray(generated), "derived edges must be an array");
      definition.edges = structuredClone(generated);
    }
    const graphs = Object.fromEntries(["walk", "join", "water"].map((kind) => [kind, /* @__PURE__ */ new Map()]));
    const edgeIds = /* @__PURE__ */ new Set();
    for (const edge of definition.edges) {
      const a = refKey(edge.from), b2 = refKey(edge.to), edgeId = JSON.stringify([a, b2].sort());
      requireWorld(a !== b2 && refs.has(a) && refs.has(b2) && !edgeIds.has(edgeId), "duplicate edge or unknown endpoint");
      edgeIds.add(edgeId);
      requireWorld(edge.allows.length > 0 && new Set(edge.allows).size === edge.allows.length && edge.allows.every((kind) => ["walk", "join", "water"].includes(kind)), "edge passage rights");
      if (edge.allows.includes("walk")) {
        const error = walkEdgeError(refs.get(a), refs.get(b2), (cell) => sample(cell, false));
        requireWorld(!error, error);
      }
      for (const kind of edge.allows) {
        const graph = graphs[kind];
        for (const [from, to] of [[a, b2], [b2, a]]) {
          const next = graph.get(from) ?? /* @__PURE__ */ new Set();
          next.add(to);
          graph.set(from, next);
        }
      }
    }
    const neighbors2 = (cell, passage = "walk") => {
      const site = cells.get(cellKey2(cell));
      if (!site) return [];
      return [...graphs[passage].get(refKey(site.ref)) ?? []].map((id) => ({ ...refs.get(id).cell }));
    };
    const owns = (cell) => cells.get(cellKey2(cell))?.placement === true;
    const floorKinds = new Map(floors.map((floor) => [floor.id, floor.kind]));
    const walkSites = sites.filter((site) => site.support), shoreApproaches = /* @__PURE__ */ new Map();
    const shoreGeometry = { floors, walkSites, floorAt: (cell) => sample(cell, false), anchorFloorAt: (cell) => sampleOriginal(cell, false) };
    for (const district of definition.districts) {
      requireWorld(district.shoreAccess === void 0 || Array.isArray(district.shoreAccess), "shore access");
      for (const access of district.shoreAccess ?? []) {
        const owner = refs.get(refKey({ districtId: district.id, siteId: access.ownerSiteId }));
        requireWorld(owner?.placement && !shoreApproaches.has(cellKey2(owner.cell)), "shore owner");
        requireWorld(Array.isArray(access.waterFloorIds) && access.waterFloorIds.length && new Set(access.waterFloorIds).size === access.waterFloorIds.length, "shore water floors");
        const waterIds = access.waterFloorIds.map((id) => floorKey(district.id, id));
        requireWorld(waterIds.every((id) => floorKinds.get(id) === "water") && waterIds.some((id) => {
          const water = sample(owner.cell, false, id, void 0, true);
          return water && Math.hypot(water.point.x - owner.point.x, water.point.z - owner.point.z) < 1e-5;
        }), "shore water does not cover its original owner");
        requireWorld(Array.isArray(access.entrySiteIds) && new Set(access.entrySiteIds).size === access.entrySiteIds.length, "shore entries");
        const entries = access.entrySiteIds.map((id) => refs.get(refKey({ districtId: district.id, siteId: id })));
        requireWorld(entries.every((entry) => entry && isAuthoredShoreEntrySupported(shoreGeometry, entry.cell, waterIds)), "shore entry has no actual bank support");
        shoreApproaches.set(cellKey2(owner.cell), entries.map((entry) => ({ ...entry.cell })));
      }
    }
    const siteAt = (point) => {
      const floor = sample(point, true, void 0, point.y);
      if (!floor || Math.abs(floor.point.y - point.y) > 0.025) return void 0;
      const site = cells.get(cellKey2({ x: Math.round(floor.cell.x), z: Math.round(floor.cell.z) }));
      return site?.placement && site.support && JSON.parse(floor.floorId)[0] === site.ref.districtId && floorKinds.get(floor.floorId) === floorKinds.get(site.support.floorId) ? site : void 0;
    };
    const route = (from, to, open, passage = "walk") => {
      if (!cells.has(cellKey2(from)) || !cells.has(cellKey2(to)) || !open.has(cellKey2(from)) || !open.has(cellKey2(to))) return void 0;
      if (passage === "walk" && (!cells.get(cellKey2(from))?.support || !cells.get(cellKey2(to))?.support)) return void 0;
      const queue = [from], previous = /* @__PURE__ */ new Map([[cellKey2(from), void 0]]);
      for (let i = 0; i < queue.length; i++) {
        const cell = queue[i];
        if (cellKey2(cell) === cellKey2(to)) {
          const result = [];
          let at = cell;
          while (at) {
            result.unshift({ ...at });
            at = previous.get(cellKey2(at));
          }
          return result;
        }
        for (const next of neighbors2(cell, passage)) if (open.has(cellKey2(next)) && !previous.has(cellKey2(next))) {
          previous.set(cellKey2(next), cell);
          queue.push(next);
        }
      }
    };
    const points = floors.filter((floor) => floor.kind !== "water").flatMap((floor) => floor.vertices.map((v) => v.point));
    requireWorld(points.length > 0, "world has no dry floor");
    const bounds = points.reduce((box, point) => ({
      min: { x: Math.min(box.min.x, point.x), y: Math.min(box.min.y, point.y), z: Math.min(box.min.z, point.z) },
      max: { x: Math.max(box.max.x, point.x), y: Math.max(box.max.y, point.y), z: Math.max(box.max.z, point.z) }
    }), { min: { ...points[0] }, max: { ...points[0] } });
    const isWalkEdgeSupported = (from, to) => !walkEdgeError(cells.get(cellKey2(from)), cells.get(cellKey2(to)), (cell) => sample(cell, false));
    return Object.freeze({
      id: definition.id,
      revision: definition.revision,
      definition: freeze(definition),
      floors: freeze(floors),
      anchorFloors: freeze(anchorFloors),
      surfaces: freeze(surfaces),
      sites: freeze(sites),
      walkSites: freeze(walkSites),
      bounds: freeze(bounds),
      owns,
      neighbors: neighbors2,
      route,
      siteAt,
      isWalkEdgeSupported,
      shoreApproachCells: (cell) => shoreApproaches.get(cellKey2(cell))?.map((entry) => ({ ...entry })),
      anchorAt: (cell) => {
        const point = cells.get(cellKey2(cell))?.point;
        return point ? { ...point } : void 0;
      },
      anchorFloorAt: (cell) => sampleOriginal(cell, false),
      sampleFloorAt: (cell, floorId) => allFloors.has(floorId) ? sample(cell, false, floorId, void 0, true) : void 0,
      floorAt: (cell, floorId) => sample(cell, false, floorId),
      logicalAt: (point) => sample(point, true, void 0, point.y)?.cell
    });
  } catch (__trialTimingError) {
    __trialTimingFailed = true;
    throw __trialTimingError;
  } finally {
    trialTimingExit(__trialTimingToken, __trialTimingFailed);
  }
}

// src/domain/growingIsland/legacyWorldDefinition.ts
var cellKey3 = (cell) => `${cell.x},${cell.z}`;
var DELTAS = [{ x: 1, z: 0 }, { x: 0, z: 1 }];
var cache = /* @__PURE__ */ new Map();
function legacyWorldDefinition(state, curved = false) {
  const bounds = landBounds(state), districtId = "legacy-acquired-land";
  const x0 = bounds.minX - 0.5, x1 = bounds.maxX + 0.5, z0 = -0.5, z1 = bounds.depth - 0.5;
  const vertices = [], indices = [], ids = /* @__PURE__ */ new Map();
  const groundHeight = (cell) => terrainHeightAt(state, cell) + (curved ? landscapeRise(cell) : 0);
  const vertex = (cell) => {
    const id = cellKey3(cell), previous = ids.get(id);
    if (previous !== void 0) return previous;
    const p = curved ? landscapePoint(cell) : cell, index = vertices.length;
    vertices.push({ cell: { ...cell }, point: { x: p.x, y: groundHeight(cell), z: p.z } });
    ids.set(id, index);
    return index;
  };
  const triangle = (points) => {
    let polygon = points;
    for (const [axis, bound, sign] of [["x", x0, 1], ["x", x1, -1], ["z", z0, 1], ["z", z1, -1]]) {
      const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b2 = polygon[(i + 1) % polygon.length];
        const insideA = (a[axis] - bound) * sign >= 0, insideB = (b2[axis] - bound) * sign >= 0;
        if (insideA) clipped.push(a);
        if (insideA !== insideB) {
          const t = (bound - a[axis]) / (b2[axis] - a[axis]);
          clipped.push({ x: a.x + (b2.x - a.x) * t, z: a.z + (b2.z - a.z) * t });
        }
      }
      polygon = clipped;
    }
    for (let i = 1; i + 1 < polygon.length; i++) {
      const [a, b2, c] = [polygon[0], polygon[i], polygon[i + 1]];
      if (Math.abs((b2.x - a.x) * (c.z - a.z) - (b2.z - a.z) * (c.x - a.x)) > 1e-10) indices.push(vertex(a), vertex(b2), vertex(c));
    }
  };
  for (let z = -1; z < bounds.depth; z++) for (let x = bounds.minX - 1; x <= bounds.maxX; x++) {
    const a = { x, z }, b2 = { x: x + 1, z }, c = { x, z: z + 1 }, d = { x: x + 1, z: z + 1 };
    triangle([a, c, b2]);
    triangle([b2, c, d]);
  }
  const floors = [{ id: "acquired-floor", kind: "ground", color: "#9dcc88", vertices, indices }];
  const sites = landCells(state).map((cell) => ({ id: cellKey3(cell), cell, floorId: "acquired-floor", placement: true }));
  if (state.bridge) {
    const x = state.bridge.x, height2 = groundHeight({ x, z: bounds.depth - 1 }) + 0.1525;
    const deckVertices = [
      { x: x - 0.36, z: bounds.depth - 0.695 },
      { x: x + 0.36, z: bounds.depth - 0.695 },
      { x: x - 0.36, z: bounds.depth + 1.35 },
      { x: x + 0.36, z: bounds.depth + 1.35 }
    ].map((cell) => {
      const p = curved ? landscapePoint(cell) : cell;
      return { cell, point: { x: p.x, y: height2, z: p.z } };
    });
    floors.push({ id: "existing-lookout-bridge", kind: "deck", color: "#d4b48b", vertices: deckVertices, indices: [0, 2, 1, 1, 2, 3] });
    for (const z of [bounds.depth, bounds.depth + 1]) sites.push({ id: cellKey3({ x, z }), cell: { x, z }, floorId: "existing-lookout-bridge", placement: false });
  }
  const siteIds = new Map(sites.map((site) => [site.id, site])), edges = [];
  for (const site of sites) for (const delta of DELTAS) {
    const id = cellKey3({ x: site.cell.x + delta.x, z: site.cell.z + delta.z });
    if (!siteIds.has(id)) continue;
    const plantingEdge = site.placement && siteIds.get(id).placement;
    edges.push({ from: { districtId, siteId: site.id }, to: { districtId, siteId: id }, allows: plantingEdge ? ["walk", "join", "water"] : ["walk"] });
  }
  return {
    version: 1,
    id: `legacy-world-v1:${bounds.minX},${bounds.maxX},${bounds.depth}:${curved ? "curved-owned-v1" : "linear"}:${state.bridge?.x ?? "no-bridge"}`,
    districts: [{
      id: districtId,
      templateId: "existing-acquired-rectangle-v1",
      logicalOrigin: { x: 0, z: 0 },
      worldOrigin: { x: 0, y: 0, z: 0 },
      turn: 0,
      floors,
      sites,
      ports: []
    }],
    edges
  };
}
function legacyIslandWorld(state, curved = false) {
  const bounds = landBounds(state), id = `${bounds.minX},${bounds.maxX},${bounds.depth}:${curved}:${state.bridge?.x ?? ""}`;
  const previous = cache.get(id);
  if (previous) return previous;
  const world = compileWorldDefinition(legacyWorldDefinition(state, curved));
  if (cache.size >= 8) cache.delete(cache.keys().next().value);
  cache.set(id, world);
  return world;
}

// src/domain/growingIsland/types.ts
var OWN_LANDMARKS = ["lighthouse", "bandstand", "slide", "trampoline", "fountain", "bakery", "postbox"];

// src/domain/growingIsland/communityRoof.ts
function communityRoofModules(state, ids, world) {
  world ??= editableIslandWorld(state);
  if (!state.growth || !supportsNativePlaceArchitecture(state, world)) return [];
  const open = walkableCells(state, world), reached = reachableFromHome(state, open, world);
  const homes = state.plots.filter((home) => ids.includes(home.id) && home.kind === "home" && home.stage >= 2 && home.cell && !state.unopened.includes(home.id)).sort((a, b2) => a.cell.z - b2.cell.z || a.cell.x - b2.cell.x || a.id.localeCompare(b2.id));
  const used = /* @__PURE__ */ new Set(), result = [];
  for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) {
    const left = homes[i], right = homes[j], a = left.cell, b2 = right.cell, gap = b2.x - a.x;
    if (used.has(left.id) || used.has(right.id) || a.z !== b2.z || gap < 2 || gap > 4) continue;
    const minX = a.x + 0.42, maxX = b2.x - 0.42, minZ = a.z + 0.7, maxZ = a.z + 1.45;
    const target2 = { x: Math.round((a.x + b2.x) / 2), z: a.z + 1 };
    if (!reached.has(key(target2))) continue;
    let groundMax = Math.max(terrainHeightAt(state, a, world), terrainHeightAt(state, b2, world)), supported2 = true;
    for (let z = minZ - 0.12; z <= maxZ + 0.12; z += 0.12) for (let x = minX - 0.12; x <= maxX + 0.12; x += 0.12) {
      if (!onLand(state, { x: Math.round(x), z: Math.round(z) }, world) || world && !world.floorAt({ x, z })) supported2 = false;
      groundMax = Math.max(groundMax, terrainHeightAt(state, { x, z }, world));
    }
    if (!supported2 || [...state.plots, ...state.landmarks].some((owner) => owner.cell && owner.id !== left.id && owner.id !== right.id && owner.kind !== "bench" && owner.cell.x >= minX - 0.35 && owner.cell.x <= maxX + 0.35 && owner.cell.z >= minZ - 0.35 && owner.cell.z <= maxZ + 0.35)) continue;
    used.add(left.id);
    used.add(right.id);
    result.push({ ownerIds: [left.id, right.id], minX, maxX, minZ, maxZ, groundMax, target: target2 });
  }
  return result;
}

// src/domain/islandLife/economyRules.ts
var HOUR_MS = 36e5;
var GROWTH_WINDOW_MS = 24 * HOUR_MS;

// src/domain/islandLife/model.ts
var HOUR = 36e5;
var LIFE_RULES = {
  dropsPerProblem: 2,
  dailyGoal: 6,
  activityMs: HOUR / 2,
  expansionPrice: 12,
  maxItems: 30,
  budHours: 2,
  bloomHours: 6,
  stylePrice: 4
};
function plantThresholds(kind) {
  return kind === "flower" ? [LIFE_RULES.budHours, LIFE_RULES.bloomHours] : kind === "sapling" ? [6, 18] : void 0;
}
function growthStage(item) {
  const thresholds = plantThresholds(item.kind);
  return !thresholds ? 2 : item.growth >= thresholds[1] ? 2 : item.growth >= thresholds[0] ? 1 : 0;
}

// src/domain/islandLife/space.ts
var cellKey4 = (p) => `${p.x},${p.z}`;

// src/domain/islandLife/waterChannels.ts
var clamp = (value) => Math.max(0, Math.min(1, value));
var distance = (a, b2) => Math.abs(a.x - b2.x) + Math.abs(a.z - b2.z);
var MAX_CHANNEL_STEPS = 8;
var directions = [{ x: 0, z: -1, bit: 1 }, { x: 1, z: 0, bit: 2 }, { x: 0, z: 1, bit: 4 }, { x: -1, z: 0, bit: 8 }];
var waterNeighbors = (state, cell) => (state.neighbors?.(cell) ?? directions.map(({ x, z }) => ({ x: cell.x + x, z: cell.z + z }))).filter((next) => Number.isInteger(cell.x) && Number.isInteger(cell.z) && Number.isInteger(next.x) && Number.isInteger(next.z) && distance(cell, next) === 1);
function connectedWaterChannels(state) {
  const channels = new Map(state.items.filter((item) => item.kind === "water-channel" && item.cell).map((item) => [cellKey4(item.cell), item]));
  const bowls = state.items.filter((item) => item.kind === "water-bowl" && item.cell);
  const reached = /* @__PURE__ */ new Set();
  let frontier = [...channels.entries()].filter(([key6, item]) => {
    if (!item.cell || !bowls.some((bowl) => waterNeighbors(state, bowl.cell).some((next) => cellKey4(next) === key6))) return false;
    reached.add(key6);
    return true;
  }).map(([key6]) => key6);
  for (let step = 1; step < MAX_CHANNEL_STEPS && frontier.length; step++) {
    const next = [];
    for (const key6 of frontier) {
      const item = channels.get(key6);
      for (const nextCell of waterNeighbors(state, item.cell)) {
        const neighbor = cellKey4(nextCell);
        if (channels.has(neighbor) && !reached.has(neighbor)) {
          reached.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return reached;
}
function waterInfluence(state, cell, reached = connectedWaterChannels(state)) {
  const sources = state.items.filter((item) => item.cell && (item.kind === "water-bowl" || item.kind === "water-channel" && reached.has(cellKey4(item.cell))));
  return Math.max(0, ...sources.map((item) => clamp(1 - Math.max(0, distance(item.cell, cell) - 1) / 3)));
}
function shadeInfluence(state, cell, elapsedGrowthHours = 0) {
  return Math.max(0, ...state.items.filter((item) => item.kind === "sapling" && item.cell && growthStage({ ...item, growth: item.growth + elapsedGrowthHours }) === 2).map((item) => clamp(1 - distance(item.cell, cell) / 3)));
}

// src/domain/growingIsland/environment.ts
var empty = () => ({ water: 0, tree: 0, flower: 0, farm: 0, light: 0 });
function waterLayout(state, world) {
  world ??= editableIslandWorld(state);
  return {
    items: state.landmarks.filter((l) => !OWN_LANDMARKS.includes(l.kind) && l.cell && (!world || onLand(state, l.cell, world))).map((l) => ({ kind: l.kind, cell: l.cell, growth: l.growth })),
    ...world ? { neighbors: (cell) => world.neighbors(cell, "water") } : {}
  };
}
var TREE_MATURE_HOURS = 18;
var wonderForm = (style) => style === "tree" || style === "flower" ? "heart-tree" : style === "water" || style === "light" ? "dot-arch" : "pumpkin";
var wonderFeature = (style) => {
  const form = wonderForm(style);
  return form === "heart-tree" ? "flower" : form === "dot-arch" ? "light" : "farm";
};
var BLOOM_HOURS = 6;
function features(state, world) {
  world ??= editableIslandWorld(state);
  const reached = connectedWaterChannels(waterLayout(state, world)), out = [];
  for (const l of state.landmarks) {
    if (!l.cell || world && !onLand(state, l.cell, world)) continue;
    if (l.kind === "water-bowl" || l.kind === "fountain") out.push({ cell: l.cell, feature: "water", points: 2 });
    else if (l.kind === "water-channel" && reached.has(key(l.cell))) out.push({ cell: l.cell, feature: "water", points: 1 });
    else if (l.kind === "sapling") out.push({ cell: l.cell, feature: "tree", points: l.growth >= TREE_MATURE_HOURS ? 2 : 1 });
    else if (l.kind === "flower" && growthStage({ kind: "flower", growth: l.growth }) === 2) out.push({ cell: l.cell, feature: "flower", points: 1 });
    else if (l.kind === "lantern") out.push({ cell: l.cell, feature: "light", points: 2 });
    else if (l.kind === "lighthouse") out.push({ cell: l.cell, feature: "light", points: 4 });
    else if (l.kind === "planter") out.push({ cell: l.cell, feature: "farm", points: 1 });
  }
  for (const p of state.plots) {
    if (!p.cell || p.stage === 0 || world && !onLand(state, p.cell, world)) continue;
    if (p.kind === "farm" || p.kind === "market") out.push({ cell: p.cell, feature: "farm", points: 2 });
    else if (p.kind === "wonder") out.push({ cell: p.cell, feature: wonderFeature(p.style), points: 2 });
    else if (p.kind === "wild" && p.growth >= BLOOM_HOURS) {
      const feature = p.style === "tree" ? "tree" : p.style === "water" ? "water" : p.style === "light" ? "light" : "flower";
      out.push({ cell: p.cell, feature, points: 1 });
    }
  }
  return out;
}
function scoresNear(state, cell, radius = RULES.styleRadius, all, world) {
  world ??= editableIslandWorld(state);
  const scores = empty();
  for (const f of all ?? features(state, world)) if (distance2(f.cell, cell) <= radius && (!world || onLand(state, f.cell, world))) scores[f.feature] += f.points;
  return scores;
}
var STYLE_ORDER = ["water", "tree", "flower", "light"];
function styleAt(state, cell, all, world) {
  world ??= editableIslandWorld(state);
  const scores = scoresNear(state, cell, RULES.styleRadius, all, world);
  let best = "plain", bestPoints = 0;
  for (const s2 of STYLE_ORDER) if (scores[s2] > bestPoints) {
    best = s2;
    bestPoints = scores[s2];
  }
  return bestPoints >= 1 ? best : "plain";
}
var CHARACTER_ORDER = ["water", "tree", "flower", "farm", "light"];
function islandScores(state, world) {
  world ??= editableIslandWorld(state);
  const scores = empty();
  for (const f of features(state, world)) scores[f.feature] += f.points;
  return scores;
}
function islandCharacter(state, world) {
  world ??= editableIslandWorld(state);
  const scores = islandScores(state, world), total = CHARACTER_ORDER.reduce((sum, f) => sum + scores[f], 0);
  if (total < RULES.characterMinimum) return "mixed";
  let best = "water";
  for (const f of CHARACTER_ORDER) if (scores[f] > scores[best]) best = f;
  return scores[best] / total >= RULES.characterShare ? best : "mixed";
}
function richness(state, world) {
  world ??= editableIslandWorld(state);
  const scores = islandScores(state, world);
  return CHARACTER_ORDER.reduce((sum, f) => sum + scores[f], 0);
}
function waterAt(state, cell, world) {
  world ??= editableIslandWorld(state);
  return !world || onLand(state, cell, world) ? waterInfluence(waterLayout(state, world), cell) : 0;
}
function syncSoil(state, world) {
  world ??= editableIslandWorld(state);
  for (const cell of landCells(state, world)) state.soil[key(cell)] ??= RULES.soilBase;
}

// src/domain/natureTown/random.ts
var K = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
var rotr = (n, b2) => n >>> b2 | n << 32 - b2;
function sha256(text3) {
  const raw = new TextEncoder().encode(text3), length = Math.ceil((raw.length + 9) / 64) * 64;
  const bytes = new Uint8Array(length);
  bytes.set(raw);
  bytes[raw.length] = 128;
  const view = new DataView(bytes.buffer);
  view.setUint32(length - 4, raw.length * 8);
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  for (let offset = 0; offset < length; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = view.getUint32(offset + i * 4);
      else {
        const a2 = w[i - 15], b3 = w[i - 2];
        w[i] = w[i - 16] + (rotr(a2, 7) ^ rotr(a2, 18) ^ a2 >>> 3) + w[i - 7] + (rotr(b3, 17) ^ rotr(b3, 19) ^ b3 >>> 10);
      }
    }
    let [a, b2, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t = j + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] | 0;
      const u = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b2 ^ a & c ^ b2 & c) | 0;
      j = g;
      g = f;
      f = e;
      e = d + t | 0;
      d = c;
      c = b2;
      b2 = a;
      a = t + u | 0;
    }
    [a, b2, c, d, e, f, g, j].forEach((v, i) => {
      h[i] = h[i] + v | 0;
    });
  }
  return h.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

// src/domain/growingIsland/random.ts
function roll(seed, system, id, ordinal) {
  return parseInt(sha256(JSON.stringify(["growing-island-v1", seed, system, id, ordinal])).slice(0, 8), 16) / 4294967296;
}
function pick(items, weights, r) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let at = r * total;
  for (let i = 0; i < items.length; i++) {
    at -= weights[i];
    if (at < 0) return items[i];
  }
  return items[items.length - 1];
}

// src/domain/growingIsland/flowers.ts
var PLANTED_COLORS = [
  { color: "red", level: 1 },
  { color: "yellow", level: 1 },
  { color: "white", level: 1 },
  { color: "blue", level: 2 }
];
function noteColor(state, color, events) {
  const book = state.flowerBook ?? [];
  if (book.includes(color)) return;
  state.flowerBook = [...book, color];
  events?.push({ type: "new-color", color });
}

// src/domain/growingIsland/nature.ts
function treeAge(state, id) {
  const tree = state.landmarks.find((l) => l.id === id);
  if (!tree || tree.maturedAt === void 0) return "young";
  const age = state.nature.hours - tree.maturedAt;
  return age >= RULES.lordTreeHours ? "lord" : age >= RULES.bigTreeHours ? "big" : "mature";
}

// src/domain/growingIsland/places.ts
var stable4 = (items) => [...items].sort((a, b2) => a.id.localeCompare(b2.id));
var count = (id, kind) => placeInputCount(id, kind);
var ATTACH = PLACE_CATALOG.common.attachmentMaxWalkCells;
var FREE = PLACE_CATALOG.common.gardenMinFreeCells;
function placeWalkSearch(open, starts, maxSteps = Infinity, world, target2) {
  const costs = /* @__PURE__ */ new Map(), previous = /* @__PURE__ */ new Map();
  const heap = [];
  let order = 0;
  const less = (a, b2) => a.cost < b2.cost || a.cost === b2.cost && a.order < b2.order;
  const push = (cell, cost) => {
    const entry = { cell, cost, order: order++ };
    let at = heap.length;
    heap.push(entry);
    while (at > 0) {
      const parent = Math.floor((at - 1) / 2);
      if (!less(entry, heap[parent])) break;
      heap[at] = heap[parent];
      at = parent;
    }
    heap[at] = entry;
  };
  const pop = () => {
    const result = heap[0], tail = heap.pop();
    if (heap.length) {
      let at = 0;
      while (at * 2 + 1 < heap.length) {
        let child = at * 2 + 1;
        if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;
        if (!less(heap[child], tail)) break;
        heap[at] = heap[child];
        at = child;
      }
      heap[at] = tail;
    }
    return result;
  };
  const siteKeys = world ? new Set(world.sites.map((site) => key(site.cell))) : void 0;
  for (const cell of starts) if (open.has(key(cell)) && (!siteKeys || siteKeys.has(key(cell))) && !costs.has(key(cell))) {
    costs.set(key(cell), 0);
    previous.set(key(cell), void 0);
    push(cell, 0);
  }
  const visited = /* @__PURE__ */ new Set();
  while (heap.length) {
    const { cell, cost } = pop(), id = key(cell);
    if (visited.has(id) || cost !== costs.get(id)) continue;
    visited.add(id);
    if (target2 && id === key(target2)) break;
    for (const next of passageNeighbors(cell, world)) {
      const nextId = key(next), nextCost = cost + distance2(cell, next);
      if (!open.has(nextId) || nextCost > maxSteps || nextCost >= (costs.get(nextId) ?? Infinity)) continue;
      previous.set(nextId, cell);
      costs.set(nextId, nextCost);
      push(next, nextCost);
    }
  }
  return { costs, path(to) {
    if (!costs.has(key(to))) return;
    const path = [];
    let at = to;
    while (at) {
      path.unshift(at);
      at = previous.get(key(at));
    }
    return path;
  } };
}
var endpointCells = (cell, reached, world) => [cell, ...approachCells(cell, world)].filter((c) => reached.has(key(c)));
function accessDistanceFrom(search, target2, reached, world) {
  return Math.min(...endpointCells(target2, reached, world).map((cell) => (search.costs.get(key(cell)) ?? Infinity) + distance2(cell, target2)));
}
function placeConnected(a, b2, open, world) {
  const d = distance2(a, b2);
  const joins = (from, to) => passageNeighbors(from, world, "join").some((next) => key(next) === key(to));
  if (d === 1) return joins(a, b2);
  const gap = { x: (a.x + b2.x) / 2, z: (a.z + b2.z) / 2 };
  return d === 2 && (a.x === b2.x || a.z === b2.z) && open.has(key(gap)) && joins(a, gap) && joins(gap, b2);
}
function components(items, connects) {
  const remaining = new Map(stable4(items).map((item) => [item.id, item])), out = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    const group = [start];
    remaining.delete(start.id);
    for (let i = 0; i < group.length; i++) for (const next of [...remaining.values()]) {
      if (!connects(group[i].cell, next.cell)) continue;
      group.push(next);
      remaining.delete(next.id);
    }
    out.push(stable4(group));
  }
  return out;
}
function region(main, open, state, world) {
  const cells = /* @__PURE__ */ new Map();
  for (const item of main) {
    cells.set(key(item.cell), item.cell);
    const nearby = world ? world.sites.filter((site) => distance2(site.cell, item.cell) <= 1).map((site) => site.cell) : neighbors(item.cell);
    for (const near of nearby) if ((world || onLand(state, near)) && open.has(key(near))) cells.set(key(near), near);
  }
  return [...cells.values()].sort((a, b2) => a.z - b2.z || a.x - b2.x);
}
function gardenCells(main, reached, world) {
  const nearby = /* @__PURE__ */ new Map();
  for (const item of main) for (const cell of endpointCells(item.cell, reached, world)) nearby.set(key(cell), cell);
  return [...nearby.values()];
}
function attachments(groups, items, reached, world) {
  const result = groups.map(() => []);
  const searches = groups.map((group) => placeWalkSearch(reached, gardenCells(group, reached, world), ATTACH, world));
  for (const item of stable4(items)) {
    const choices = groups.map((group, index) => ({
      index,
      id: group[0].id,
      distance: accessDistanceFrom(searches[index], item.cell, reached, world)
    })).filter((choice) => choice.distance <= ATTACH).sort((a, b2) => a.distance - b2.distance || a.id.localeCompare(b2.id));
    if (choices[0]) result[choices[0].index].push(item);
  }
  return result;
}
function enclosedByMain(main, center) {
  if (main.length < 4) return false;
  const quadrants = [false, false, false, false];
  for (const item of main) {
    if (item.cell.x < center.x && item.cell.z < center.z) quadrants[0] = true;
    if (item.cell.x > center.x && item.cell.z < center.z) quadrants[1] = true;
    if (item.cell.x < center.x && item.cell.z > center.z) quadrants[2] = true;
    if (item.cell.x > center.x && item.cell.z > center.z) quadrants[3] = true;
  }
  return quadrants.every(Boolean);
}
function placeShape(main, reached) {
  const occupied = new Set(main.map((item) => key(item.cell)));
  const minX = Math.min(...main.map((i) => i.cell.x)), maxX = Math.max(...main.map((i) => i.cell.x));
  const minZ = Math.min(...main.map((i) => i.cell.z)), maxZ = Math.max(...main.map((i) => i.cell.z));
  if (main.length >= 4) for (let x = minX + 1; x < maxX; x++) for (let z = minZ + 1; z < maxZ; z++) {
    const center = { x, z };
    if (!reached.has(key(center))) continue;
    if (enclosedByMain(main, center)) return "court";
  }
  for (const item of main) if ([{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 1 }].every((delta) => occupied.has(key({ x: item.cell.x + delta.x, z: item.cell.z + delta.z })))) return "cluster";
  if (main.every((item) => item.cell.x === minX) || main.every((item) => item.cell.z === minZ)) return "lane";
  return "freeform";
}
function derivePlace(state, ruleId, family, main, attached, reached, open, variant, connected, missing, world) {
  const members = stable4([...main, ...attached]);
  const anchor = attached.find((item) => state.plots.some((p) => p.id === item.id && (p.kind === "home" || p.kind === "play"))) ?? main[0];
  const footprint2 = region([...main, ...attached], open, state, world);
  if (variant === "court") {
    const included = new Set(footprint2.map(key));
    for (const id of reached) {
      const [x, z] = id.split(",").map(Number), cell = { x, z };
      if (included.has(id) || !open.has(id) || !(world ? world.floorAt(cell) : onLand(state, cell)) || !enclosedByMain(main, cell)) continue;
      footprint2.push(cell);
      included.add(id);
    }
    footprint2.sort((a, b2) => a.z - b2.z || a.x - b2.x);
  }
  const entrances = footprint2.filter((cell) => reached.has(key(cell)));
  if ((world ? entrances.filter((cell) => Number.isInteger(cell.x) && Number.isInteger(cell.z)).length : entrances.length) < FREE) missing.push("\u306F\u3044\u308C\u308B \u3059\u304D\u307E\u3092 \u3042\u3051\u3088\u3046");
  const stage = !connected ? "seeded" : missing.length ? "connected" : "grown";
  const useTargets = [];
  for (const member of members) {
    if (!endpointCells(member.cell, reached, world).length) continue;
    if (state.landmarks.some((item) => item.id === member.id && item.kind === "bench")) useTargets.push({ id: member.id, kind: "seat", cell: member.cell });
    if (state.plots.some((item) => item.id === member.id && item.kind === "play" && item.stage > 0 && !state.unopened.includes(item.id)))
      useTargets.push({ id: member.id, kind: "play", cell: member.cell });
  }
  const walkSurface = ruleId === "P02" && stage === "grown" ? placeGalleryRoute(state, { footprint: footprint2, entrances }, anchor.cell, world) : [];
  const roofs = ruleId === "P04" && variant === "garden" && stage === "grown" ? communityRoofModules(state, main.map((item) => item.id), world) : [];
  if (walkSurface.length) useTargets.push({ id: `${anchor.id}:gallery`, kind: "gallery", cell: walkSurface[0], route: walkSurface });
  if (ruleId === "P03" && entrances.length) useTargets.push({ id: `${anchor.id}:shore`, kind: "shore", cell: entrances[0] });
  if (stage === "grown" && (ruleId === "P04" && variant === "garden" || state.growth && (ruleId === "P01" || ruleId === "P05"))) {
    const center = main.reduce((sum, item) => ({ x: sum.x + item.cell.x / main.length, z: sum.z + item.cell.z / main.length }), { x: 0, z: 0 });
    const ground = roofs[0]?.target ?? entrances.filter((cell) => open.has(key(cell))).sort((a, b2) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b2.x - center.x, b2.z - center.z) || a.z - b2.z || a.x - b2.x)[0];
    if (ground) useTargets.push({ id: `${anchor.id}:garden`, kind: "garden", cell: ground });
  }
  const waterRefs = members.filter((item) => state.landmarks.some((l) => l.id === item.id && (l.kind === "water-bowl" || l.kind === "water-channel"))).map((i) => i.id);
  const shadeRefs = members.filter((item) => state.landmarks.some((l) => l.id === item.id && l.kind === "sapling")).map((i) => i.id);
  const signature = [
    PLACE_CATALOG.version,
    ruleId,
    variant,
    stage,
    members.map((member) => [member.id, member.cell.x, member.cell.z]),
    footprint2,
    entrances,
    walkSurface,
    useTargets
  ];
  if (roofs.length) signature.push(roofs);
  const revision = JSON.stringify(signature);
  return {
    id: `${ruleId}:${anchor.id}`,
    ruleId,
    family,
    anchorId: anchor.id,
    memberIds: members.map((i) => i.id),
    mainIds: main.map((i) => i.id),
    variant,
    ...roofs.length ? { structure: "P04:shared-roof" } : {},
    stage,
    footprint: footprint2,
    entrances,
    walkSurface,
    waterRefs,
    shadeRefs,
    useTargets,
    revision,
    missing
  };
}
function derivePlaces(state, world) {
  world ??= editableIslandWorld(state);
  const nativeArchitecture = supportsNativePlaceArchitecture(state, world);
  const open = walkableCells(state, world), reached = reachableFromHome(state, open, world), places = [];
  const landmarks = stable4(state.landmarks.filter((l) => !!l.cell && onLand(state, l.cell, world)));
  const plots = stable4(state.plots.filter((p) => !!p.cell && onLand(state, p.cell, world) && !state.unopened.includes(p.id)));
  const benches = landmarks.filter((l) => l.kind === "bench");
  const trees = landmarks.filter((l) => l.kind === "sapling");
  const groves = components(trees, (a, b2) => placeConnected(a, b2, open, world));
  const groveSeats = attachments(groves, benches, reached, world);
  const individualGroves = /* @__PURE__ */ new Set();
  const treeHomes = attachments(groves, plots.filter((p) => p.kind === "home" && (state.growth || p.style === "tree")), reached, world);
  groves.forEach((component, index) => {
    const mature = component.filter((t) => t.growth >= TREE_MATURE_HOURS);
    const ordinary = state.growth && mature.length ? components(mature, (a, b2) => placeConnected(a, b2, open, world)) : [component];
    if (state.growth && nativeArchitecture && mature.length && mature.length < component.length)
      mature.forEach((tree) => individualGroves.add(tree.id));
    const matureGroups = components(mature, (a, b2) => placeConnected(a, b2, open, world));
    const candidates = state.growth && nativeArchitecture ? matureGroups.flatMap((group) => supportedPlaceGroups(
      "P02",
      group,
      (a, b2) => placeConnected(a, b2, open, world)
    ).map((part) => part.owners)) : [component];
    const large = candidates.filter((main) => state.growth ? !!supportedPlaceVariant("P02", main.map((item) => item.cell), nativeArchitecture) && main.filter((t) => ["big", "lord"].includes(treeAge(state, t.id))).length >= 2 : main.length >= count("P02", "landmark:sapling") && treeHomes[index].length > 0);
    const largeHomes = attachments(large, treeHomes[index], reached, world);
    const ordinarySeats = attachments(ordinary, groveSeats[index], reached, world), largeSeats = attachments(large, groveSeats[index], reached, world);
    for (const { id, main } of [...ordinary.map((main2) => ({ id: "P01", main: main2 })), ...large.map((main2) => ({ id: "P02", main: main2 }))]) {
      const homes2 = main === component ? treeHomes[index] : largeHomes[large.indexOf(main)] ?? [];
      const seats = main === component ? groveSeats[index] : (id === "P01" ? ordinarySeats[ordinary.indexOf(main)] : largeSeats[large.indexOf(main)]) ?? [];
      const mature2 = main.filter((t) => t.growth >= TREE_MATURE_HOURS), big = main.filter((t) => ["big", "lord"].includes(treeAge(state, t.id)));
      const missing = [];
      if (main.length < (state.growth && id === "P01" ? 1 : count(id, "landmark:sapling"))) missing.push("\u6728\u3092 \u3088\u305B\u3066\u307F\u3088\u3046");
      if (mature2.length < (state.growth ? main.length : count(id, "landmark:sapling"))) missing.push("\u6728\u304C \u305D\u3060\u3064\u306E\u3092 \u305F\u306E\u3057\u3082\u3046");
      if (!state.growth && !seats.length) missing.push("\u6728\u306E\u305D\u3070\u306B \u30D9\u30F3\u30C1\u3092 \u304A\u3053\u3046");
      else if (!state.growth && mature2.length >= count(id, "landmark:sapling") && !seats.some((seat) => shadeInfluence(waterLayout(state, world), seat.cell) > 0))
        missing.push("\u6728\u9670\u3078 \u30D9\u30F3\u30C1\u3092 \u3088\u305B\u3088\u3046");
      if (id === "P02") {
        if (big.length < 2) missing.push("\u5927\u6728\u304C \u305D\u3060\u3064\u306E\u3092 \u305F\u306E\u3057\u3082\u3046");
        if (!state.growth && !homes2.some((h) => h.stage >= 2)) missing.push("\u6728\u306E\u3044\u3048\u304C \u305D\u3060\u3064\u306E\u3092 \u305F\u306E\u3057\u3082\u3046");
      }
      const shape = placeShape(main, reached);
      let variant = shape;
      if (id === "P01" && !state.growth) {
        const seat = seats[0];
        const narrow = main.length === 2 && distance2(main[0].cell, main[1].cell) === 1;
        const edge = seat && (seat.cell.x <= Math.min(...main.map((t) => t.cell.x)) || seat.cell.x >= Math.max(...main.map((t) => t.cell.x)));
        variant = narrow ? "corner" : edge ? "alcove" : "lane";
      }
      places.push(derivePlace(
        state,
        id,
        "grove",
        main,
        [...id === "P02" ? homes2 : [], ...seats],
        reached,
        open,
        variant,
        state.growth ? main.length >= 1 : main.length >= count(id, "landmark:sapling") && seats.length > 0,
        missing,
        world
      ));
    }
  });
  const flowers = landmarks.filter((l) => l.kind === "flower");
  const flowerGroups = components(flowers, (a, b2) => placeConnected(a, b2, open, world)).flatMap((group) => {
    const mature = group.filter((item) => item.growth >= BLOOM_HOURS);
    return state.growth && mature.length ? components(mature, (a, b2) => placeConnected(a, b2, open, world)) : [group];
  });
  const flowerSeats = attachments(flowerGroups, benches, reached, world);
  flowerGroups.forEach((main, index) => {
    if (!state.growth && main.length < 2) return;
    const missing = [], seats = flowerSeats[index];
    if (!state.growth && main.length < (state.growth ? main.length : count("P05", "landmark:flower"))) missing.push("\u82B1\u3092 \u3088\u305B\u3066\u307F\u3088\u3046");
    if (main.filter((f) => f.growth >= BLOOM_HOURS).length < (state.growth ? main.length : count("P05", "landmark:flower"))) missing.push("\u82B1\u304C \u3072\u3089\u304F\u306E\u3092 \u305F\u306E\u3057\u3082\u3046");
    if (!state.growth && !seats.length) missing.push("\u82B1\u306E\u305D\u3070\u306B \u30D9\u30F3\u30C1\u3092 \u304A\u3053\u3046");
    const shape = placeShape(main, reached), variant = state.growth ? shape === "lane" ? "flower-path" : shape === "cluster" ? "flower-bed" : shape : shape === "lane" ? "arch" : shape === "cluster" ? "canopy" : shape;
    const profile = state.growth ? supportedPlaceVariant("P05", main.map((item) => item.cell), nativeArchitecture) : void 0;
    const place = derivePlace(
      state,
      "P05",
      "flowers",
      main,
      seats,
      reached,
      open,
      profile ?? variant,
      state.growth ? main.length >= 1 : main.length >= count("P05", "landmark:flower") && seats.length > 0,
      missing,
      world
    );
    if (profile && place.stage === "grown") place.structure = `P05:${profile}`;
    places.push(place);
  });
  const water = landmarks.filter((l) => l.kind === "water-bowl" || l.kind === "water-channel");
  const channels = connectedWaterChannels(waterLayout(state, world));
  const waterGroups = components(water.filter((l) => l.kind === "water-bowl" || channels.has(key(l.cell))), (a, b2) => passageNeighbors(a, world, "water").some((cell) => key(cell) === key(b2)));
  const waterSeats = attachments(waterGroups, benches, reached, world);
  const watersideFlowers = attachments(waterGroups, flowers, reached, world);
  const bounds = landBounds(state);
  const nearShore = (cell, radius) => world ? Array.from({ length: 16 }, (_, i) => i * Math.PI / 8).some((angle) => !(state.terrain ? world.floorAt : world.anchorFloorAt)({ x: cell.x + Math.cos(angle) * radius, z: cell.z + Math.sin(angle) * radius })) : cell.z >= bounds.depth - radius || cell.x <= bounds.minX + radius - 1 || cell.x >= bounds.maxX - radius + 1;
  waterGroups.forEach((main, index) => {
    const bowls = main.filter((w) => w.kind === "water-bowl");
    if (!bowls.length || !state.growth && main.length < 2) return;
    const supplied = main.filter((w) => w.kind === "water-channel" && channels.has(key(w.cell)));
    const seats = waterSeats[index], flowersHere = watersideFlowers[index];
    const missing = [];
    if (!state.growth && bowls.length < count("P03", "landmark:water-bowl")) missing.push("\u6C34\u3070\u3061\u3092 \u307F\u305A\u307F\u3061\u3067 \u3064\u306A\u3054\u3046");
    if (!state.growth && supplied.length < count("P03", "landmark:water-channel")) missing.push("\u6C34\u306E\u3068\u304A\u308B \u307F\u305A\u307F\u3061\u3092 \u3064\u306A\u3054\u3046");
    if (!state.growth && !flowersHere.some((f) => f.growth >= BLOOM_HOURS)) missing.push("\u6C34\u306E\u305D\u3070\u3067 \u82B1\u3092 \u305D\u3060\u3066\u3088\u3046");
    if (!state.growth && !seats.length) missing.push("\u5CB8\u306E\u305D\u3070\u306B \u30D9\u30F3\u30C1\u3092 \u304A\u3053\u3046");
    const waterHeight = (cell) => state.terrain ? terrainHeightAt(state, cell, world) : world?.anchorAt(cell)?.y ?? terrainHeightAt(state, cell, world);
    const heights = bowls.map((b2) => waterHeight(b2.cell));
    const descending = Math.max(...heights) - Math.min(...heights) >= 0.2 && supplied.every((channel) => {
      const adjacent = main.filter((other2) => distance2(channel.cell, other2.cell) === 1);
      return adjacent.length < 2 || adjacent.some((a) => waterHeight(a.cell) > waterHeight(channel.cell) + 5e-3) && adjacent.some((a) => waterHeight(a.cell) < waterHeight(channel.cell) - 5e-3);
    });
    const onShore = bowls.every((b2) => world ? nearShore(b2.cell, 2) : b2.cell.z >= bounds.depth - 3 || b2.cell.x <= bounds.minX + 1 || b2.cell.x >= bounds.maxX - 1);
    const variant = descending ? "tiered" : onShore ? "shore" : "curve";
    places.push(derivePlace(
      state,
      "P03",
      "spring",
      main,
      [...flowersHere, ...seats],
      reached,
      open,
      variant,
      state.growth ? bowls.length > 0 : bowls.length >= count("P03", "landmark:water-bowl") && supplied.length >= count("P03", "landmark:water-channel") && seats.length > 0 && flowersHere.length > 0,
      missing,
      world
    ));
  });
  if (state.growth) {
    const homes2 = plots.filter((p) => p.kind === "home" && p.stage > 0);
    const searches = new Map(homes2.map((home) => [key(home.cell), placeWalkSearch(reached, endpointCells(home.cell, reached, world), ATTACH, world)]));
    const groups = components(homes2, (a, b2) => accessDistanceFrom(searches.get(key(a)), b2, reached, world) <= ATTACH);
    for (const main of groups) {
      if (main.length < 2) continue;
      const mature = main.filter((home) => home.stage >= 2);
      const established = components(mature, (a, b2) => accessDistanceFrom(searches.get(key(a)), b2, reached, world) <= ATTACH).filter((group) => group.length >= 2);
      if (established.length) {
        for (const group of established) places.push(derivePlace(state, "P04", "community", group, [], reached, open, "garden", true, [], world));
        continue;
      }
      const missing = main.some((p) => p.stage < 2) ? ["\u3044\u3048\u304C \u305D\u3060\u3064\u306E\u3092 \u305F\u306E\u3057\u3082\u3046"] : [];
      places.push(derivePlace(state, "P04", "community", main, [], reached, open, "garden", true, missing, world));
    }
  }
  const plays = plots.filter((p) => p.kind === "play"), homes = plots.filter((p) => p.kind === "home");
  const playRegions = plays.map((play) => region([play], open, state, world).flatMap((cell) => [cell, ...passageNeighbors(cell, world)]).filter((cell) => reached.has(key(cell))));
  const assignedHomes = plays.map(() => []);
  const playSearches = playRegions.map((region2) => placeWalkSearch(reached, region2, ATTACH, world));
  for (const home of homes) {
    const closest = plays.map((play, index) => ({
      index,
      id: play.id,
      distance: accessDistanceFrom(playSearches[index], home.cell, reached, world)
    })).filter((c) => c.distance <= ATTACH).sort((a, b2) => a.distance - b2.distance || a.id.localeCompare(b2.id))[0];
    if (closest) assignedHomes[closest.index].push(home);
  }
  plays.forEach((play, index) => {
    const nearby = assignedHomes[index];
    if (!nearby.length) return;
    const supplied = landmarks.filter((l) => l.kind === "water-bowl" && waterInfluence({ items: [{ kind: "water-bowl", cell: l.cell, growth: l.growth }] }, play.cell) > 0);
    const main = stable4([play, ...nearby]);
    const onShore = main.some((item) => nearShore(item.cell, 2));
    const missing = [];
    if (nearby.length < count("P04", "plot:home")) missing.push("\u3042\u305D\u3073\u3070\u306E\u305D\u3070\u306B \u3044\u3048\u3092 \u3088\u305B\u3088\u3046");
    if (nearby.filter((h) => h.stage >= 2).length < count("P04", "plot:home")) missing.push("\u3044\u3048\u304C \u305D\u3060\u3064\u306E\u3092 \u305F\u306E\u3057\u3082\u3046");
    if (!play.stage) missing.push("\u3042\u305D\u3073\u3070\u304C \u305D\u3060\u3064\u306E\u3092 \u305F\u306E\u3057\u3082\u3046");
    if (!supplied.length) missing.push("\u3042\u305D\u3073\u3070\u3078 \u6C34\u3092 \u3068\u3069\u3051\u3088\u3046");
    if (!onShore) missing.push("\u6D77\u306E\u305D\u3070\u3078 \u3088\u305B\u3066\u307F\u3088\u3046");
    const homeZ = Math.min(...nearby.map((h) => h.cell.z)), minX = Math.min(...nearby.map((h) => h.cell.x)), maxX = Math.max(...nearby.map((h) => h.cell.x));
    const bowlBetween = supplied.some((b2) => b2.cell.x > minX && b2.cell.x < maxX);
    const variant = play.cell.z - homeZ >= 2 && !bowlBetween ? "court" : bowlBetween ? "bay" : "lane";
    places.push(derivePlace(
      state,
      "P04",
      "community",
      main,
      supplied,
      reached,
      open,
      variant,
      nearby.length >= count("P04", "plot:home") && supplied.length > 0 && onShore,
      missing,
      world
    ));
  });
  const owners = new Map([...landmarks, ...plots].map((item) => [item.id, item]));
  const reassigned = /* @__PURE__ */ new Set();
  for (const bench of benches) {
    const candidates = places.filter((p) => p.memberIds.includes(bench.id) && p.stage !== "seeded");
    const choices = candidates.map((place) => ({
      place,
      group: `${place.family}:${place.mainIds.join(",")}`,
      distance: accessDistanceFrom(placeWalkSearch(reached, gardenCells(place.mainIds.map((id) => owners.get(id)).filter(Boolean), reached, world), ATTACH, world), bench.cell, reached, world)
    })).sort((a, b2) => a.distance - b2.distance || a.place.anchorId.localeCompare(b2.place.anchorId));
    const chosen = choices[0]?.group;
    for (const candidate of choices) if (candidate.group !== chosen) {
      const place = candidate.place;
      reassigned.add(place);
      place.memberIds = place.memberIds.filter((id) => id !== bench.id);
      place.useTargets = place.useTargets.filter((target2) => target2.id !== bench.id);
      if (!state.growth && !place.useTargets.some((target2) => target2.kind === "seat")) {
        place.stage = "connected";
        place.missing.push("\u3053\u306E\u5EAD\u306E \u30D9\u30F3\u30C1\u3092 \u304A\u3053\u3046");
        place.walkSurface = [];
        place.useTargets = place.useTargets.filter((target2) => target2.kind !== "gallery");
      }
      place.revision = JSON.stringify([place.revision, place.memberIds, place.stage]);
    }
  }
  return places.map((place) => {
    if (!reassigned.has(place)) return place;
    const main = place.mainIds.map((id) => owners.get(id)).filter(Boolean);
    const attached = place.memberIds.filter((id) => !place.mainIds.includes(id)).map((id) => owners.get(id)).filter(Boolean);
    const seats = attached.filter((item) => landmarks.some((l) => l.id === item.id && l.kind === "bench"));
    const missing = place.missing.filter((line) => !line.includes("\u30D9\u30F3\u30C1"));
    if (!state.growth && !seats.length) missing.push("\u3053\u306E\u5EAD\u306E \u30D9\u30F3\u30C1\u3092 \u304A\u3053\u3046");
    else if (!state.growth && place.family === "grove" && main.filter((item) => item.growth >= TREE_MATURE_HOURS).length >= count(place.ruleId, "landmark:sapling") && !seats.some((seat) => shadeInfluence(waterLayout(state, world), seat.cell) > 0)) missing.push("\u6728\u9670\u3078 \u30D9\u30F3\u30C1\u3092 \u3088\u305B\u3088\u3046");
    return derivePlace(
      state,
      place.ruleId,
      place.family,
      main,
      attached,
      reached,
      open,
      place.variant,
      place.stage !== "seeded" && (Boolean(state.growth) || seats.length > 0),
      missing,
      world
    );
  }).map((place) => {
    if (place.ruleId === "P01" && place.mainIds.some((id) => individualGroves.has(id)))
      return { ...place, treeForm: "individual", revision: JSON.stringify([place.revision, "individual-trees"]) };
    if (!state.growth || !nativeArchitecture || place.ruleId !== "P05" || place.stage !== "grown") return place;
    const main = place.mainIds.map((id) => owners.get(id)).filter(Boolean);
    const parts = supportedPlaceGroups("P05", main, (a, b2) => placeConnected(a, b2, open, world));
    if (!parts.length) return place;
    const flowerRoofs = parts.map((part) => ({ variant: part.variant, mainIds: stable4(part.owners).map((owner) => owner.id) }));
    return {
      ...place,
      structure: `P05:${parts[0].variant}`,
      flowerRoofs,
      revision: JSON.stringify([place.revision, flowerRoofs])
    };
  }).sort((a, b2) => a.id.localeCompare(b2.id));
}

// src/domain/growingIsland/terrainEditing.ts
var TERRAIN_MIN = -4;
var TERRAIN_MAX = 12;
var TERRAIN_HISTORY_LIMIT = 64;
var terrainEditingRevision = (state) => JSON.stringify([
  terrainRevision(state),
  state.terrain?.undo ?? [],
  state.terrain?.redo ?? []
]);
var finiteCell = (cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.z);
var acquired = (state, cell) => {
  if (!finiteCell(cell) || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) return false;
  const b2 = landBounds(state);
  return cell.x >= b2.minX && cell.x <= b2.maxX && cell.z >= 0 && cell.z < b2.depth;
};
var validHeight = (height2) => Number.isInteger(height2) && height2 >= TERRAIN_MIN && height2 <= TERRAIN_MAX;
var fail = (text3) => {
  throw new Error(text3);
};
var writeHeight = (heights, cell, value) => {
  if (value === 0) delete heights[key(cell)];
  else heights[key(cell)] = value;
};
function validateTerrain(state) {
  const terrain = state.terrain;
  if (terrain === void 0) return;
  const invalid = () => fail("\u3057\u307E\u306E \u304B\u305F\u3061\u3092 \u3088\u307F\u3053\u3081\u306A\u304B\u3063\u305F\u3088\u3002\u3042\u305F\u3089\u3057\u3044\u7248\u3067 \u3072\u3089\u3044\u3066\u306D\u3002");
  if (!terrain || terrain.version !== 1 || !terrain.heights || typeof terrain.heights !== "object" || Array.isArray(terrain.heights) || !Array.isArray(terrain.undo) || !Array.isArray(terrain.redo) || terrain.undo.length + terrain.redo.length > TERRAIN_HISTORY_LIMIT) invalid();
  for (const [id, value] of Object.entries(terrain.heights)) {
    const [x, z] = id.split(",").map(Number), cell = { x, z };
    if (key(cell) !== id || !acquired(state, cell) || !validHeight(value) || value === 0) invalid();
  }
  for (const history of [terrain.undo, terrain.redo]) for (const entry of history) {
    if (!entry || !acquired(state, entry.cell) || !validHeight(entry.before) || !validHeight(entry.after) || Math.abs(entry.after - entry.before) !== 1) invalid();
  }
  for (const [history, from, to] of [[terrain.undo, "after", "before"], [terrain.redo, "before", "after"]]) {
    const heights = { ...terrain.heights };
    for (const entry of [...history].reverse()) {
      if ((heights[key(entry.cell)] ?? 0) !== entry[from]) invalid();
      writeHeight(heights, entry.cell, entry[to]);
    }
  }
}
function probes(cell, radius) {
  return [-radius, -radius / 2, 0, radius / 2, radius].flatMap((x) => [-radius, -radius / 2, 0, radius / 2, radius].map((z) => ({ x: cell.x + x, z: cell.z + z })));
}
function supported(before, after, cell, radius, pinned = false) {
  const center = after.floorAt(cell)?.point.y;
  if (center === void 0) return false;
  const oldCenter = before.floorAt(cell)?.point.y;
  return probes(cell, radius).every((point) => {
    const old = before.floorAt(point)?.point.y, next = after.floorAt(point)?.point.y;
    if (next === void 0) return false;
    if (pinned) return old !== void 0 && Math.abs(next - old) <= 0.02;
    return old !== void 0 && oldCenter !== void 0 && Math.abs(next - center - (old - oldCenter)) <= 0.13;
  });
}
function terrainOwnerSupported(state, cell) {
  const world = editableIslandWorld(state);
  if (!world) return true;
  return supported(legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), world, cell, 0.46);
}
function terrainFootingError(previous, next, actors = []) {
  const before = editableIslandWorld(previous) ?? legacyIslandWorld(previous, true);
  const after = editableIslandWorld(next) ?? legacyIslandWorld(next, true);
  const bounds = landBounds(next);
  const fixed = [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }, ...next.bridge ? [bridgeAnchor(next)] : []];
  if (fixed.some((cell) => !supported(before, after, cell, 0.46, true)))
    return "\u304A\u3046\u3061\u3068 \u3075\u306A\u3064\u304D\u3070\u306E \u8DB3\u3082\u3068\u306F \u305D\u306E\u307E\u307E\u306B \u3057\u3088\u3046\u3002";
  const owned = [
    ...next.plots.flatMap((plot) => plot.cell ? [plot.cell] : []),
    ...next.landmarks.flatMap((owner) => !owner.cell ? [] : OWN_LANDMARKS.includes(owner.kind) ? [owner.cell] : occupiedCells({ kind: owner.kind, cell: owner.cell })),
    ...next.keepsakes.flatMap((owner) => owner.cell ? [owner.cell] : [])
  ];
  if (owned.some((cell) => !terrainOwnerSupported(next, cell)))
    return "\u3082\u306E\u306E \u8DB3\u3082\u3068\u3060\u3088\u3002\u3055\u304D\u306B \u3046\u3054\u304B\u3057\u3066\u307F\u3088\u3046\u3002";
  if (actors.some((cell) => !finiteCell(cell) || !supported(before, after, cell, 0.18, true)))
    return "\u306A\u304B\u307E\u304C \u3044\u308B\u3088\u3002\u3059\u3053\u3057 \u306F\u306A\u308C\u305F \u3068\u3053\u308D\u3092 \u3048\u3089\u307C\u3046\u3002";
}
function validateOccupiedTargets(state, targets) {
  if (targets === void 0) return;
  const bad = () => fail("\u306A\u304B\u307E\u306E \u3044\u308B \u3070\u3057\u3087\u3092 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
  if (!Array.isArray(targets) || targets.length > 32) bad();
  const bounds = landBounds(state), ids = /* @__PURE__ */ new Set();
  let count2 = 0;
  for (const target2 of targets) {
    if (!target2 || typeof target2.placeId !== "string" || !target2.placeId || target2.placeId.length > 512 || typeof target2.targetId !== "string" || !target2.targetId || target2.targetId.length > 512 || !Array.isArray(target2.route) || target2.route.length < 2 || target2.route.length > 8192) bad();
    const id = JSON.stringify([target2.placeId, target2.targetId]);
    if (ids.has(id)) bad();
    ids.add(id);
    count2 += target2.route.length;
    if (count2 > 32768) bad();
    for (const point of target2.route) if (!finiteCell(point) || !Number.isFinite(point.y) || Math.abs(point.y) > 1e3 || point.x < bounds.minX - 2 || point.x > bounds.maxX + 2 || point.z < -2 || point.z > bounds.depth + 2) bad();
  }
}
function retainsOccupiedTargets(state, targets) {
  const places = derivePlaces(state);
  return targets.every((snapshot2) => {
    const place = places.find((place2) => place2.id === snapshot2.placeId && (place2.stage === "grown" || place2.stage === "lived"));
    const route = place?.useTargets.find((target2) => target2.id === snapshot2.targetId && target2.kind === "gallery")?.route;
    return route?.length === snapshot2.route.length && route.every((point, index) => {
      const current = snapshot2.route[index];
      return Math.abs(point.x - current.x) <= 1e-6 && Math.abs(point.y - current.y) <= 1e-6 && Math.abs(point.z - current.z) <= 1e-6;
    });
  });
}
function applyTerrainCommand(state, command) {
  validateTerrain(state);
  if (command.expectedTerrainRevision !== void 0 && command.expectedTerrainRevision !== terrainEditingRevision(state))
    fail("\u3057\u307E\u306E \u304B\u305F\u3061\u304C \u304B\u308F\u3063\u305F\u3088\u3002\u3044\u307E\u306E \u3057\u307E\u3092 \u307F\u3066 \u3048\u3089\u3073\u306A\u304A\u305D\u3046\u3002");
  if (command.actors !== void 0 && (!Array.isArray(command.actors) || command.actors.length > 4096 || command.actors.some((cell) => !finiteCell(cell))))
    fail("\u306A\u304B\u307E\u306E \u3070\u3057\u3087\u3092 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
  validateOccupiedTargets(state, command.occupiedPlaceTargets);
  const terrain = structuredClone(state.terrain ?? { version: 1, heights: {}, undo: [], redo: [] });
  let entry;
  if (command.type === "terrain-edit") {
    if (!acquired(state, command.cell) || ![1, -1].includes(command.delta)) fail("\u3058\u3076\u3093\u306E \u571F\u5730\u3092 \u3048\u3089\u3093\u3067\u306D\u3002");
    if (foundationEditWeight(state, command.cell) === 0) fail("\u304A\u3046\u3061\u3068 \u3075\u306A\u3064\u304D\u3070\u306E \u8DB3\u3082\u3068\u306F \u305D\u306E\u307E\u307E\u306B \u3057\u3088\u3046\u3002");
    const before = terrain.heights[key(command.cell)] ?? 0, after = before + command.delta;
    if (!validHeight(after)) return false;
    entry = { cell: { ...command.cell }, before, after };
    terrain.undo = [...terrain.undo, entry].slice(-TERRAIN_HISTORY_LIMIT);
    terrain.redo = [];
    writeHeight(terrain.heights, entry.cell, entry.after);
  } else if (command.type === "terrain-undo") {
    entry = terrain.undo.pop();
    if (!entry) return false;
    writeHeight(terrain.heights, entry.cell, entry.before);
    terrain.redo.push(entry);
  } else {
    entry = terrain.redo.pop();
    if (!entry) return false;
    writeHeight(terrain.heights, entry.cell, entry.after);
    terrain.undo.push(entry);
  }
  const next = { ...state, terrain }, error = terrainFootingError(state, next, command.actors);
  if (error) fail(error);
  if (command.occupiedPlaceTargets?.length && (!retainsOccupiedTargets(state, command.occupiedPlaceTargets) || !retainsOccupiedTargets(next, command.occupiedPlaceTargets)))
    fail("\u306A\u304B\u307E\u304C \u4E0A\u3067 \u3042\u305D\u3093\u3067\u3044\u308B\u3088\u3002\u304A\u308A\u3066\u304B\u3089 \u304B\u3048\u3066\u307F\u3088\u3046\u3002");
  state.terrain = terrain;
  return true;
}

// src/domain/growingIsland/space.ts
var HOME_CELL = { x: 2, z: 1 };
var HOUSE_CELLS = [{ x: 2, z: 0 }, { x: 3, z: 0 }, HOME_CELL];
var key = (cell) => `${cell.x},${cell.z}`;
var same = (a, b2) => a.x === b2.x && a.z === b2.z;
var distance2 = (a, b2) => Math.abs(a.x - b2.x) + Math.abs(a.z - b2.z);
var NEIGHBORS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
var neighbors = (cell) => NEIGHBORS.map((d) => ({ x: cell.x + d.x, z: cell.z + d.z }));
var passageNeighbors = (cell, world, passage = "walk") => world ? world.neighbors(cell, passage) : neighbors(cell);
var approachCells = (cell, world) => world ? authoredApproachCells(cell, world) : [cell, ...neighbors(cell)];
function landBounds({ land }) {
  const sides = [land.expanded, ...land.extra];
  const west = sides.includes("west"), east = sides.includes("east");
  const districts = land.districts ?? [];
  return {
    minX: (land.capes.includes("west") ? -6 : west ? -3 : 0) - 3 * districts.filter((s2) => s2 === "west").length,
    maxX: (land.capes.includes("east") ? 11 : east ? 8 : 5) + 3 * districts.filter((s2) => s2 === "east").length,
    depth: (sides.includes("south") ? 8 : 5) + 3 * districts.filter((s2) => s2 === "south").length
  };
}
function landCells(state, world) {
  if (world) return world.sites.filter((site) => site.placement).map((site) => ({ ...site.cell }));
  const { minX, maxX, depth } = landBounds(state), cells = [];
  for (let z = 0; z < depth; z++) for (let x = minX; x <= maxX; x++) cells.push({ x, z });
  return cells;
}
function onLand(state, cell, world) {
  if (world) return world.owns(cell);
  const { minX, maxX, depth } = landBounds(state);
  return Number.isInteger(cell.x) && Number.isInteger(cell.z) && cell.x >= minX && cell.x <= maxX && cell.z >= 0 && cell.z < depth;
}
var isHouseCell = (cell) => HOUSE_CELLS.some((c) => same(c, cell));
function landmarkCells(landmark) {
  if (!landmark.cell) return [];
  return OWN_LANDMARKS.includes(landmark.kind) ? [landmark.cell] : occupiedCells({ kind: landmark.kind, cell: landmark.cell });
}
function occupant(state, cell, except) {
  if (isHouseCell(cell)) return { type: "house" };
  if (state.bridge && same(cell, bridgeAnchor(state))) return { type: "bridge" };
  const landmark = state.landmarks.find((l) => l.id !== except && landmarkCells(l).some((c) => same(c, cell)));
  if (landmark) return { type: "landmark", id: landmark.id };
  const plot = state.plots.find((p) => p.id !== except && p.cell && same(p.cell, cell));
  if (plot) return { type: "plot", id: plot.id, spread: plot.origin === "spread" };
  const keepsake = state.keepsakes.find((k) => k.id !== except && k.cell && same(k.cell, cell));
  if (keepsake) return { type: "keepsake", id: keepsake.id };
}
function isVacant(state, cell, except, world) {
  world ??= editableIslandWorld(state);
  return onLand(state, cell, world) && (!world || Boolean(world.floorAt(cell))) && terrainOwnerSupported(state, cell) && !occupant(state, cell, except);
}
function plotBlocks(plot) {
  if (plot.kind === "wonder") return plot.stage === 0 || !(plot.style === "water" || plot.style === "light");
  return plot.kind !== "farm" && plot.kind !== "wild";
}
var OPEN_LANDMARKS = /* @__PURE__ */ new Set(["water-channel", "flower-arch", "flower"]);
function landmarkBlocks(landmark) {
  return !OPEN_LANDMARKS.has(landmark.kind);
}
function walkingBlockedCells(state) {
  const blocked = /* @__PURE__ */ new Set([key({ x: 2, z: 0 }), key({ x: 3, z: 0 })]);
  for (const l of state.landmarks) if (landmarkBlocks(l)) landmarkCells(l).forEach((c) => blocked.add(key(c)));
  for (const p of state.plots) if (p.cell && plotBlocks(p)) blocked.add(key(p.cell));
  for (const k of state.keepsakes) if (k.cell) blocked.add(key(k.cell));
  return blocked;
}
function walkableCells(state, world) {
  world ??= editableIslandWorld(state);
  const blocked = walkingBlockedCells(state);
  if (world) {
    const ownerCells = [...blocked].map((text3) => {
      const [x, z] = text3.split(",").map(Number);
      return { x, z };
    });
    return new Set(world.walkSites.filter((site) => !ownerCells.some((owner) => authoredPointBlocked(site.cell, owner))).map((site) => key(site.cell)));
  }
  const open = new Set(landCells(state).map(key).filter((k) => !blocked.has(k)));
  if (state.bridge) {
    const { depth } = landBounds(state);
    open.add(key({ x: state.bridge.x, z: depth }));
    open.add(key({ x: state.bridge.x, z: depth + 1 }));
  }
  return open;
}
function bridgeAnchor(state, x = state.bridge?.x ?? 2) {
  return { x, z: landBounds(state).depth - 1 };
}
function canBuildBridge(state, x) {
  const bounds = landBounds(state), shore2 = bridgeAnchor(state, x);
  if (!Number.isInteger(x) || x < bounds.minX + 1 || x > bounds.maxX - 2) return false;
  const withoutBridge = { ...state, bridge: void 0 };
  return !occupant(withoutBridge, shore2) && reachableFromHome(withoutBridge).has(key(shore2));
}
function bridgeSite(state) {
  const { minX, maxX } = landBounds(state), preferred = state.bridge?.x ?? minX + 2;
  const candidates = [preferred, ...Array.from({ length: maxX - minX - 2 }, (_, i) => minX + 1 + i)];
  return candidates.find((x) => canBuildBridge(state, x));
}
function reachableFromHome(state, walkable, world) {
  world ??= editableIslandWorld(state);
  walkable ??= walkableCells(state, world);
  if (world && !walkable.has(key(HOME_CELL))) return /* @__PURE__ */ new Set();
  const start = key(HOME_CELL), seen = /* @__PURE__ */ new Set([start]), queue = [HOME_CELL];
  while (queue.length) {
    const cell = queue.shift();
    for (const next of passageNeighbors(cell, world)) {
      const k = key(next);
      if (walkable.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(next);
      }
    }
  }
  return seen;
}
function isReachable(cell, reached, world) {
  return approachCells(cell, world).some((n) => reached.has(key(n)));
}

// docs/design/2026-10-22-place-strategy-trial/foundation.ts
function foundationEditWeight(state, point) {
  const bounds = landBounds(state);
  const pins = [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }, ...state.bridge ? [{ x: state.bridge.x ?? 2, z: bounds.depth - 1 }] : []];
  const distance3 = Math.min(...pins.map((pin) => Math.max(Math.abs(point.x - pin.x), Math.abs(point.z - pin.z))));
  const t = Math.max(0, Math.min(1, (distance3 - 0.66) / 0.34));
  return t * t * (3 - 2 * t);
}

// docs/design/2026-10-23-place-method-comparison/coastal-base-field.ts
var COASTAL_BASE_REVISION = "land-derived-coastal-base-v2";
var clamp2 = (value) => Math.max(0, Math.min(1, value));
var smooth3 = (value) => {
  const t = clamp2(value);
  return t * t * (3 - 2 * t);
};
var bump = (value) => Math.abs(value) >= 1 ? 0 : (1 - value * value) ** 3;
function createCoastalBaseField(state, sourceZeroHeight, options) {
  const width = options.maxX - options.minX, depth = options.maxZ - options.minZ;
  if (!(width > 0 && depth > 0 && Number.isFinite(options.seaLevel))) throw Error("Invalid coastal base bounds");
  const centerX = (options.minX + options.maxX) / 2, centerZ = (options.minZ + options.maxZ) / 2;
  const cornerRadius = Math.min(1.25, width * 0.22, depth * 0.24);
  const sectionWidth = 0.78, shoreToe = 0.12, outwardAllowance = 0.78;
  const bays = [
    { side: "west", center: options.minZ + depth * 0.73, halfWidth: Math.min(1.7, depth * 0.34), depth: 1.3 },
    { side: "east", center: options.minZ + depth * 0.29, halfWidth: Math.min(1.55, depth * 0.31), depth: 0.61 },
    { side: "south", center: options.minX + width * 0.47, halfWidth: Math.min(1.65, width * 0.28), depth: 0.28 }
  ];
  const shoreCoordinate = (point) => {
    const qx = Math.abs(point.x - centerX) - (width / 2 - cornerRadius);
    const qz = Math.abs(point.z - centerZ) - (depth / 2 - cornerRadius);
    const roundedRectangle = -(Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - cornerRadius);
    const retreat = bays.reduce((sum, bay) => {
      const along = bay.side === "south" ? point.x : point.z;
      const edgeDistance = bay.side === "west" ? point.x - options.minX : bay.side === "east" ? options.maxX - point.x : options.maxZ - point.z;
      return sum + bay.depth * bump((along - bay.center) / bay.halfWidth) * (1 - smooth3(Math.max(0, edgeDistance) / 2));
    }, 0);
    return roundedRectangle - retreat;
  };
  const heightAt2 = (point) => {
    const original = sourceZeroHeight(point);
    const t = smooth3((shoreCoordinate(point) + outwardAllowance + shoreToe) / (sectionWidth + shoreToe));
    const coast = options.seaLevel - 0.12 + (original - (options.seaLevel - 0.12)) * t;
    return original - Math.max(0, original - coast) * foundationEditWeight(state, point);
  };
  return { heightAt: heightAt2, shoreCoordinate, proof: {
    revision: COASTAL_BASE_REVISION,
    cornerRadius,
    sectionWidth,
    shoreToe,
    outwardAllowance,
    bays,
    ownerIndependent: true,
    editIndependent: true,
    offsetPolicy: "add signed physical offset after base, without input-dependent masks",
    limitation: "zero-edit centre heights and available placement area may differ from A; acquisition may reshape the base; existing owners and fixed supports require measurement"
  } };
}

// docs/design/2026-10-23-place-method-comparison/terrace-convex-field.ts
var CONVEX_TERRACE_FIELD_REVISION = "cardinal-convex-terrace-v2";
var CONVEX_TERRACE_FLAT_RADIUS = 0.3;
var CONVEX_TERRACE_DETAIL = 12;
var smooth4 = (t) => t * t * (3 - 2 * t);
function convexTerraceOffset(heights, cell, bounds) {
  const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x)), sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
  const x = Math.floor(sx), z = Math.floor(sz);
  const blend = (fraction) => smooth4(Math.max(0, Math.min(
    1,
    (fraction - CONVEX_TERRACE_FLAT_RADIUS) / (1 - 2 * CONVEX_TERRACE_FLAT_RADIUS)
  )));
  const u = blend(sx - x), v = blend(sz - z);
  const height2 = (dx, dz) => heights[`${x + dx},${z + dz}`] ?? 0;
  const plateau = ((1 - u) * height2(0, 0) + u * height2(1, 0)) * (1 - v) + ((1 - u) * height2(0, 1) + u * height2(1, 1)) * v;
  const oldU = smooth4(sx - x), oldV = smooth4(sz - z);
  const original = ((1 - oldU) * height2(0, 0) + oldU * height2(1, 0)) * (1 - oldV) + ((1 - oldU) * height2(0, 1) + oldU * height2(1, 1)) * oldV;
  const edge = Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
  const interior = smooth4(Math.max(0, Math.min(1, edge * 6)));
  return original * (1 - interior) + plateau * interior;
}
function coarseTriangleValue(sample, cell, detail = 6) {
  const gx = cell.x * detail, gz = cell.z * detail, ix = Math.floor(gx), iz = Math.floor(gz);
  const u = gx - ix, v = gz - iz;
  const a = sample({ x: ix / detail, z: iz / detail }), b2 = sample({ x: (ix + 1) / detail, z: iz / detail });
  const c = sample({ x: ix / detail, z: (iz + 1) / detail }), d = sample({ x: (ix + 1) / detail, z: (iz + 1) / detail });
  return u + v <= 1 ? a + (b2 - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b2 - d) * (1 - v);
}

// docs/design/2026-10-23-place-method-comparison/terrace-field.ts
var TERRACE_FIELD_REVISION = "connected-raised-terrace-v2";
var smooth5 = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
var key2 = (cell) => `${cell.x},${cell.z}`;
var distanceToTop = (point, cells, radius) => Math.min(...cells.map((cell) => Math.hypot(Math.max(0, Math.abs(point.x - cell.x) - radius), Math.max(0, Math.abs(point.z - cell.z) - radius))));
function createTerraceField(state, baselineHeight, options) {
  const topRadius = 0.46 + 1 / options.detail + 0.02;
  const remaining = /* @__PURE__ */ new Map();
  for (const [id, height2] of Object.entries(state.terrain?.heights ?? {}).sort(([a], [b2]) => a.localeCompare(b2))) {
    const [x, z] = id.split(",").map(Number);
    if (height2 >= 2 && Number.isInteger(x) && Number.isInteger(z) && x >= options.minX + 0.5 && x <= options.maxX - 0.5 && z >= options.minZ + 0.5 && z <= options.maxZ - 0.5)
      remaining.set(id, { x, z });
  }
  const groups = [];
  while (remaining.size) {
    const first = remaining.values().next().value, cells = [first];
    remaining.delete(key2(first));
    for (let i = 0; i < cells.length; i++) for (const delta of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const next = { x: cells[i].x + delta.x, z: cells[i].z + delta.z };
      if (remaining.delete(key2(next))) cells.push(next);
    }
    if (cells.length < 2) continue;
    const top = Math.max(...cells.map(baselineHeight));
    if (top <= options.dryLevel + 0.18) continue;
    const editRise = Math.max(...cells.map((cell) => state.terrain.heights[key2(cell)])) * 0.18;
    groups.push({ cells, top, rampWidth: Math.max(0.8, editRise * 2) });
  }
  const heightAt2 = (cell) => {
    const a = baselineHeight(cell);
    if (!groups.length || a <= options.dryLevel) return a;
    const interior = Math.min(
      cell.x - options.minX - 0.5,
      options.maxX - 0.5 - cell.x,
      cell.z - options.minZ - 0.5,
      options.maxZ - 0.5 - cell.z
    );
    const boundary = smooth5(interior / (1 / options.detail));
    if (!boundary) return a;
    const foundation = foundationEditWeight(state, cell);
    if (!foundation) return a;
    let wetClearance = Infinity;
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1])
      wetClearance = Math.min(wetClearance, baselineHeight({ x: cell.x + dx / options.detail, z: cell.z + dz / options.detail }) - options.dryLevel);
    const waterGuard = smooth5(wetClearance / 0.12);
    if (!waterGuard) return a;
    let uplift = 0;
    for (const group of groups) {
      const distance3 = distanceToTop(cell, group.cells, topRadius);
      if (distance3 >= group.rampWidth) continue;
      const weight = 1 - smooth5(distance3 / group.rampWidth);
      uplift = Math.max(uplift, Math.max(0, group.top - a) * weight);
    }
    return a + uplift * boundary * foundation * waterGuard;
  };
  return { heightAt: heightAt2, proof: {
    revision: TERRACE_FIELD_REVISION,
    ownerIndependent: true,
    topRadius,
    groups,
    constraints: ["mixed water triangles retain A", "outer half-cell retains A", "fixed foundation retains A"],
    limitation: "fixed supports and wet openings can trim a top or block its ramp; placement and actual walking must still validate"
  } };
}

// docs/design/2026-10-23-place-method-comparison/coastal-field.ts
var COASTAL_FIELD_REVISION = "connected-coast-band-v2";
var smooth6 = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
var squaredDistance = (p, shore2) => {
  const dx = shore2.b.x - shore2.a.x, dz = shore2.b.z - shore2.a.z;
  const t = Math.max(0, Math.min(1, ((p.x - shore2.a.x) * dx + (p.z - shore2.a.z) * dz) / (dx * dx + dz * dz)));
  return (p.x - shore2.a.x - dx * t) ** 2 + (p.z - shore2.a.z - dz * t) ** 2;
};
function createCoastalField(state, sourceHeight, options) {
  const reference = { ...state, terrain: state.terrain && {
    ...state.terrain,
    heights: Object.fromEntries(Object.entries(state.terrain.heights).filter(([, height2]) => height2 < 0))
  } };
  const baselineHeight = (cell) => sourceHeight(reference, cell);
  const { minX, maxX, minZ, maxZ, detail, margin, dryLevel } = options;
  const nx = Math.round((maxX - minX + margin * 2) * detail), nz = Math.round((maxZ - minZ + margin * 2) * detail);
  const width = nx + 1, startX = minX - margin, startZ = minZ - margin;
  const points = [];
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const cell = { x: startX + ix / detail, z: startZ + iz / detail };
    points.push({ ...cell, y: baselineHeight(cell) });
  }
  const outside = new Uint8Array(points.length), queue = [];
  const addWet = (i) => {
    if (!outside[i] && points[i].y < dryLevel) {
      outside[i] = 1;
      queue.push(i);
    }
  };
  for (let ix = 0; ix <= nx; ix++) {
    addWet(ix);
    addWet(nz * width + ix);
  }
  for (let iz = 0; iz <= nz; iz++) {
    addWet(iz * width);
    addWet(iz * width + nx);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % width, z = Math.floor(i / width);
    if (x > 0) addWet(i - 1);
    if (x < nx) addWet(i + 1);
    if (z > 0) addWet(i - width);
    if (z < nz) addWet(i + width);
  }
  const cuts = Object.entries(state.terrain?.heights ?? {}).filter(([, height2]) => height2 < 0).map(([key6, height2]) => {
    const [x, z] = key6.split(",").map(Number);
    return { x, z, amount: -height2 / 4 };
  });
  const shores = [];
  const contour = (ids) => {
    const triangle = ids.map((i) => points[i]);
    if (!ids.some((i) => outside[i]) || triangle.every((p) => p.y < dryLevel)) return;
    const intersections = [];
    for (let i = 0; i < 3; i++) {
      const a2 = triangle[i], b3 = triangle[(i + 1) % 3];
      if (a2.y < dryLevel === b3.y < dryLevel) continue;
      const t = (dryLevel - a2.y) / (b3.y - a2.y);
      intersections.push({ x: a2.x + (b3.x - a2.x) * t, z: a2.z + (b3.z - a2.z) * t });
    }
    if (intersections.length !== 2) return;
    const [a, b2] = intersections, length = Math.hypot(b2.x - a.x, b2.z - a.z);
    if (length < 1e-9) return;
    const mid = { x: (a.x + b2.x) / 2, z: (a.z + b2.z) / 2 }, tx = (b2.x - a.x) / length, tz = (b2.z - a.z) / length;
    let normalX = -tz, normalZ = tx;
    const dry = triangle.find((p) => p.y >= dryLevel);
    if ((dry.x - mid.x) * normalX + (dry.z - mid.z) * normalZ < 0) {
      normalX *= -1;
      normalZ *= -1;
    }
    const tangentHeight = (baselineHeight({ x: mid.x + tx * 0.8, z: mid.z + tz * 0.8 }) + baselineHeight({ x: mid.x - tx * 0.8, z: mid.z - tz * 0.8 })) / 2;
    const bay = smooth6((tangentHeight - dryLevel) / 0.35);
    const excavation = 1 - Math.exp(-cuts.reduce((sum, cut) => {
      const d2 = (cut.x - mid.x) ** 2 + (cut.z - mid.z) ** 2;
      return sum + cut.amount * Math.exp(-d2 / 2.88) * smooth6(1 - d2 / 5.76);
    }, 0));
    const crest = Math.max(dryLevel + 0.14, baselineHeight({ x: mid.x + normalX * 1.25, z: mid.z + normalZ * 1.25 }));
    shores.push({ a, b: b2, retreat: 0.12 + 0.24 * bay + 0.16 * excavation, crest });
  };
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = iz * width + ix, b2 = a + 1, c = a + width, d = c + 1;
    contour([a, c, b2]);
    contour([b2, c, d]);
  }
  const sampledA = (cell) => {
    const gx = (cell.x - startX) * detail, gz = (cell.z - startZ) * detail;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return void 0;
    const u = gx - ix, v = gz - iz, a = points[iz * width + ix].y, b2 = points[iz * width + ix + 1].y;
    const c = points[(iz + 1) * width + ix].y, d = points[(iz + 1) * width + ix + 1].y;
    const y = u + v <= 1 ? a + (b2 - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b2 - d) * (1 - v);
    return y;
  };
  const original = legacyIslandWorld({ land: state.land, bridge: state.bridge }, options.curved), protectedSites = [];
  for (const site of original.sites.filter((site2) => site2.placement)) {
    const cell = site.cell, center = sampledA(cell), oldCenter = original.floorAt(cell)?.point.y;
    if (center === void 0 || oldCenter === void 0) continue;
    let deviation = 0, lowest = center;
    for (const dx of [-0.46, -0.23, 0, 0.23, 0.46]) for (const dz of [-0.46, -0.23, 0, 0.23, 0.46]) {
      const at = { x: cell.x + dx, z: cell.z + dz }, current = sampledA(at), old = original.floorAt(at)?.point.y;
      if (current === void 0 || old === void 0) {
        deviation = Infinity;
        continue;
      }
      deviation = Math.max(deviation, Math.abs(current - center - (old - oldCenter)));
      lowest = Math.min(lowest, current);
    }
    const excess = Math.max(0, deviation - 0.130000001, dryLevel - lowest);
    const strength = 1 - smooth6(excess / 0.28);
    if (strength > 0) protectedSites.push({ ...cell, strength });
  }
  const protectionRadius = 0.46 + 1 / detail + 1e-8;
  const carve = (cell) => {
    const a = baselineHeight(cell);
    if (a < dryLevel || !shores.length) return a;
    const foundation = foundationEditWeight(state, cell);
    if (!foundation) return a;
    let protection = 0;
    for (const site of protectedSites) {
      const distance4 = Math.max(Math.abs(cell.x - site.x), Math.abs(cell.z - site.z));
      protection = Math.max(protection, site.strength * (1 - smooth6((distance4 - protectionRadius) / 0.25)));
    }
    const free = 1 - protection;
    if (!free) return a;
    let nearest = Infinity;
    for (const shore2 of shores) nearest = Math.min(nearest, squaredDistance(cell, shore2));
    const distance3 = Math.sqrt(nearest);
    if (distance3 >= 1.7) return a;
    let weights = 0, retreat = 0, crest = 0;
    for (const shore2 of shores) {
      const d2 = squaredDistance(cell, shore2);
      if (d2 > nearest + 0.25) continue;
      const length = Math.hypot(shore2.b.x - shore2.a.x, shore2.b.z - shore2.a.z);
      const w = Math.exp(-(d2 - nearest) / 0.07) * smooth6(1 - (d2 - nearest) / 0.25) * length;
      weights += w;
      retreat += shore2.retreat * w;
      crest += shore2.crest * w;
    }
    retreat /= weights;
    crest /= weights;
    const inset = distance3 - retreat;
    const target2 = inset <= 0 ? dryLevel + inset * 0.7 : inset < 0.25 ? dryLevel + 0.1 * smooth6(inset / 0.25) : dryLevel + 0.1 + (crest - dryLevel - 0.1) * smooth6((inset - 0.25) / 0.9);
    const fade = 1 - smooth6((distance3 - 1.2) / 0.5);
    return a - Math.max(0, a - target2) * fade * foundation * free;
  };
  const heightAt2 = (cell) => sourceHeight(state, cell) - (baselineHeight(cell) - carve(cell));
  return { heightAt: heightAt2, proof: {
    revision: COASTAL_FIELD_REVISION,
    contourSegments: shores.length,
    exteriorWetSamples: queue.length,
    protectedSites,
    protectionRadius,
    ownerIndependent: true,
    positiveContributionPreserved: true,
    continuousSupportReservation: true,
    maxBandWidth: 1.7
  } };
}

// docs/design/2026-10-23-place-method-comparison/section-profile.ts
var SECTION_PROFILE_REVISION = "shoulder-slope-toe-v1";
var SECTION_SHOULDER = 0.18;
var SECTION_TOE = 0.82;
function terrainMethod(search) {
  const requested = (search === void 0 ? trialQuery() : new URLSearchParams(search)).get("terrainTrial");
  return requested === "B" || requested === "C" || requested === "D" || requested === "F" || requested === "G" || requested === "H" ? requested : "A";
}
function sectionBlend(t, mode) {
  if (!Number.isFinite(t)) throw Error("Terrain section parameter must be finite");
  if (!["A", "B", "C", "D", "F", "G", "H"].includes(mode)) throw Error("Unknown terrain method");
  const x = Math.max(0, Math.min(1, mode === "B" ? (t - SECTION_SHOULDER) / (SECTION_TOE - SECTION_SHOULDER) : t));
  return x * x * (3 - 2 * x);
}
function sectionOffset(corners, x, z, mode, raiseWeight = 1) {
  if (!corners.every(Number.isFinite)) throw Error("Terrain section heights must be finite");
  const interpolate2 = (method) => {
    const u = sectionBlend(x, method), v = sectionBlend(z, method);
    return ((1 - u) * corners[0] + u * corners[1]) * (1 - v) + ((1 - u) * corners[2] + u * corners[3]) * v;
  };
  const a = interpolate2("A");
  if (mode !== "B") return a;
  const b2 = interpolate2(mode), difference = b2 - a;
  const weight = corners.some((height2) => height2 < 0) ? 0 : Math.max(0, Math.min(1, raiseWeight));
  const shaped = difference * Math.abs(difference) / (Math.abs(difference) + 0.025);
  return a + (shaped > 0 ? shaped * weight : shaped);
}
function sectionRaiseWeight(cell, bounds) {
  const interior = Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
  return sectionBlend(interior / 0.5, "A");
}

// src/domain/growingIsland/editableTerrainWorld.ts
var singleCompileEnabled = () => typeof window !== "undefined" && trialQuery().get("compileTrial") === "single";
var rampPlaneEnabled = () => typeof window !== "undefined" && trialQuery().get("rampTrial") === "linear";
var stableBaseEnabled2 = () => typeof window !== "undefined" && trialQuery().get("baseTrial") === "stable";
var TERRAIN_STEP = 0.18;
var TERRAIN_SEA_LEVEL = -0.4;
var TERRAIN_DRY_LEVEL = TERRAIN_SEA_LEVEL + 0.025;
var cache2 = /* @__PURE__ */ new Map();
var stable5 = (value) => Math.round(value * 1e9) / 1e9;
var key3 = (cell) => `${cell.x},${cell.z}`;
var smooth7 = (value) => value * value * (3 - 2 * value);
function terrainRevision(state, mode = terrainMethod()) {
  const heights = Object.entries(state.terrain?.heights ?? {}).filter(([, height2]) => height2 !== 0).sort(([a], [b2]) => a.localeCompare(b2));
  return JSON.stringify([rampPlaneEnabled() && (mode === "F" || mode === "H") ? RAMP_PLANE_REVISION : "ramp-default", stableBaseEnabled2() ? STABLE_BASE_REVISION : null, mode === "H" ? CONVEX_TERRACE_FIELD_REVISION + "+" + CURVED_GRID_REVISION : mode === "G" ? COASTAL_BASE_REVISION : mode === "F" ? CONVEX_TERRACE_FIELD_REVISION : mode === "D" ? TERRACE_FIELD_REVISION : mode === "C" ? COASTAL_FIELD_REVISION : SECTION_PROFILE_REVISION, mode, state.land, state.bridge?.x ?? null, heights]);
}
function rawHeight(state, cell, curved, mode) {
  globalThis.__memoCount("rawHeight");
  const bounds = landBounds(state);
  const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x)), sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
  const x = Math.floor(sx), z = Math.floor(sz);
  const height2 = (dx, dz) => state.terrain?.heights[`${x + dx},${z + dz}`] ?? 0;
  const offset = mode === "F" || mode === "H" ? rampPlaneEnabled() ? rampPlaneOffset(state.terrain?.heights ?? {}, cell, bounds) : convexTerraceOffset(state.terrain?.heights ?? {}, cell, bounds) : sectionOffset(
    [height2(0, 0), height2(1, 0), height2(0, 1), height2(1, 1)],
    sx - x,
    sz - z,
    mode,
    sectionRaiseWeight(cell, bounds)
  );
  return baseTerrainHeightAt(state, cell) + (curved ? landscapeRise(cell) : 0) + offset * TERRAIN_STEP * foundationEditWeight(state, cell);
}
function editableIslandWorld(state, curved = true, mode = terrainMethod()) {
  const __trialTimingToken = trialTimingEnter("editableIslandWorld", "no-terrain");
  let __trialTimingFailed = false;
  try {
    if (!state.terrain) return void 0;
    const revision = `${curved}:${terrainRevision(state, mode)}`, previous = cache2.get(revision);
    if (previous) {
      trialTimingDetail(__trialTimingToken, "cache-hit");
      return previous;
    }
    trialTimingDetail(__trialTimingToken, "cold");
    const original = legacyIslandWorld({ land: state.land, bridge: state.bridge }, curved);
    const source = original.definition.districts[0], bounds = landBounds(state);
    const memoSamplesEnabled = trialQuery().get("memoTrial") === "samples";
    const projectSample = memoSamplesEnabled && curved ? memoTerrainSamples(landscapePoint) : landscapePoint;
    const districtId = source.id, minX = bounds.minX - 0.5, maxX = bounds.maxX + 0.5, minZ = -0.5, maxZ = bounds.depth - 0.5;
    const detail = mode === "F" || mode === "H" ? CONVEX_TERRACE_DETAIL : 6, margin = 1.5;
    const floor = {
      id: "editable-ground",
      kind: "ground",
      color: "#a4cb87",
      vertices: [],
      indices: []
    };
    const water = {
      id: "editable-water",
      kind: "water",
      color: "#79d4d0",
      vertices: [],
      indices: []
    };
    const ids = /* @__PURE__ */ new Map(), waterIds = /* @__PURE__ */ new Map();
    const bankVertices = [], bankIndices = [];
    const exterior = (cell) => cell.x <= bounds.minX || cell.x >= bounds.maxX || cell.z <= 0 || cell.z >= bounds.depth - 1;
    const physical = (cell) => {
      const sample = (p) => curved ? projectSample(p) : p;
      return (mode === "F" || mode === "H") && exterior(cell) ? { x: coarseTriangleValue((p) => sample(p).x, cell), z: coarseTriangleValue((p) => sample(p).z, cell) } : sample(cell);
    };
    const calculateSurfaceHeightFor = (input, cell) => {
      globalThis.__memoCount("surfaceHeight");
      const clamped = { x: Math.max(minX, Math.min(maxX, cell.x)), z: Math.max(minZ, Math.min(maxZ, cell.z)) };
      const distance3 = Math.hypot(cell.x - clamped.x, cell.z - clamped.z);
      const angle = Math.atan2(cell.z - (maxZ + minZ) / 2, cell.x - (minX + maxX) / 2);
      const shoreWidth = 0.65 + 0.13 * Math.sin(angle * 3 + 0.4) + 0.08 * Math.sin(angle * 5);
      const fade = smooth7(Math.max(0, Math.min(1, distance3 / shoreWidth)));
      return stable5(rawHeight(input, clamped, curved, mode) * (1 - fade) + (TERRAIN_SEA_LEVEL - 0.12) * fade);
    };
    const heightSamples = /* @__PURE__ */ new WeakMap();
    const baselineSurfaceHeightFor = (input, cell) => {
      globalThis.__memoCount("surfaceRequests");
      if (!memoSamplesEnabled) return calculateSurfaceHeightFor(input, cell);
      let sample = heightSamples.get(input);
      if (!sample) {
        sample = memoTerrainSamples((cell2) => calculateSurfaceHeightFor(input, cell2));
        heightSamples.set(input, sample);
      }
      return sample(cell);
    };
    const baselineSurfaceHeight = (cell) => baselineSurfaceHeightFor(state, cell);
    const zeroState = { ...state, terrain: state.terrain && { ...state.terrain, heights: {} } };
    const zeroHeightAt = (cell) => baselineSurfaceHeightFor(zeroState, cell);
    const coastBase = mode === "G" ? createCoastalBaseField(state, zeroHeightAt, { minX, maxX, minZ, maxZ, seaLevel: TERRAIN_SEA_LEVEL }) : void 0;
    const surfaceHeight = coastBase ? (cell) => coastBase.heightAt(cell) + baselineSurfaceHeight(cell) - zeroHeightAt(cell) : mode === "F" || mode === "H" ? (cell) => exterior(cell) ? coarseTriangleValue(baselineSurfaceHeight, cell) : baselineSurfaceHeight(cell) : mode === "D" ? createTerraceField(state, baselineSurfaceHeight, { minX, maxX, minZ, maxZ, detail, dryLevel: TERRAIN_DRY_LEVEL }).heightAt : mode === "C" ? createCoastalField(state, baselineSurfaceHeightFor, { minX, maxX, minZ, maxZ, detail, margin, dryLevel: TERRAIN_DRY_LEVEL, curved }).heightAt : baselineSurfaceHeight;
    const add = (target2, map, p, wet) => {
      const id = `${stable5(p.x)},${stable5(p.z)}`, known = map.get(id);
      if (known !== void 0) return known;
      const cell = { x: stable5(p.x), z: stable5(p.z) }, point = physical(cell), index = target2.vertices.length;
      target2.vertices.push({ cell, point: { ...point, y: wet ? TERRAIN_SEA_LEVEL : stable5(p.y) } });
      map.set(id, index);
      return index;
    };
    const clippedTriangle = (input, wet) => {
      const polygon = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i], b2 = input[(i + 1) % input.length], inside = wet ? a.y < TERRAIN_DRY_LEVEL : a.y >= TERRAIN_DRY_LEVEL;
        if (inside) polygon.push(a);
        if (inside !== (wet ? b2.y < TERRAIN_DRY_LEVEL : b2.y >= TERRAIN_DRY_LEVEL)) {
          const t = (TERRAIN_DRY_LEVEL - a.y) / (b2.y - a.y);
          polygon.push({ x: a.x + (b2.x - a.x) * t, z: a.z + (b2.z - a.z) * t, y: TERRAIN_DRY_LEVEL });
        }
      }
      const target2 = wet ? water : floor, map = wet ? waterIds : ids;
      for (let i = 1; i + 1 < polygon.length; i++) {
        const [a, b2, c] = [polygon[0], polygon[i], polygon[i + 1]];
        if (Math.abs((b2.x - a.x) * (c.z - a.z) - (b2.z - a.z) * (c.x - a.x)) < 1e-10) continue;
        if (wet) {
          const start = bankVertices.length;
          bankVertices.push(...[a, b2, c].map((p) => ({ ...physical(p), y: p.y })));
          bankIndices.push(start, start + 1, start + 2);
        }
        target2.indices.push(add(target2, map, a, wet), add(target2, map, b2, wet), add(target2, map, c, wet));
      }
    };
    const nx = Math.round((maxX - minX + margin * 2) * detail), nz = Math.round((maxZ - minZ + margin * 2) * detail);
    const samples = [];
    for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
      const cell = { x: minX - margin + x / detail, z: minZ - margin + z / detail };
      samples.push({ ...cell, y: surfaceHeight(cell) });
    }
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const a = samples[z * (nx + 1) + x], b2 = samples[z * (nx + 1) + x + 1];
      const c = samples[(z + 1) * (nx + 1) + x], d = samples[(z + 1) * (nx + 1) + x + 1];
      for (const triangle of [[a, c, b2], [b2, c, d]]) {
        clippedTriangle(triangle, false);
        clippedTriangle(triangle, true);
      }
    }
    const floors = [floor, ...source.floors.filter((f) => f.kind === "deck"), ...water.indices.length ? [water] : []];
    const sites = source.sites.map((site) => ({ ...site, anchorPoint: original.anchorAt(site.cell) }));
    const surfaces = bankIndices.length ? [{
      id: "editable-underwater-bank",
      kind: "bank",
      vertices: bankVertices,
      indices: bankIndices,
      material: { color: "#d4c79f", roughness: 0.96, metalness: 0 }
    }] : [];
    const definition = {
      version: 1,
      id: original.id,
      revision,
      districts: [{ ...source, floors, anchorFloors: source.floors, sites, surfaces }],
      edges: []
    };
    const siteKeys = new Set(sites.map((site) => key3(site.cell)));
    for (let z = 0; z <= (bounds.depth - 1) * 2; z++) for (let x = bounds.minX * 2; x <= bounds.maxX * 2; x++) {
      const cell = { x: x / 2, z: z / 2 }, id = key3(cell);
      if (siteKeys.has(id) || surfaceHeight(cell) < TERRAIN_DRY_LEVEL) continue;
      sites.push({ id, cell, floorId: floor.id, placement: false });
      siteKeys.add(id);
    }
    const buildEdges = (geometry) => {
      const edges = [];
      const addEdge = (a, b2) => {
        const allows = [];
        const supported2 = geometry.isWalkEdgeSupported(a.cell, b2.cell) && editableTerrainSegmentSupported(geometry, a.cell, b2.cell);
        if (supported2) allows.push("walk");
        if (a.placement && b2.placement && supported2) allows.push("join", "water");
        if (allows.length) edges.push({ from: { districtId, siteId: a.id }, to: { districtId, siteId: b2.id }, allows });
      };
      const byCell = new Map(sites.map((site) => [key3(site.cell), site]));
      for (const site of sites) for (const d of [{ x: 0.5, z: 0 }, { x: 0, z: 0.5 }, { x: 1, z: 0 }, { x: 0, z: 1 }]) {
        const other2 = byCell.get(key3({ x: site.cell.x + d.x, z: site.cell.z + d.z }));
        const existingBridge = state.bridge && site.cell.x === state.bridge.x && other2?.cell.x === state.bridge.x && site.cell.z >= bounds.depth - 1;
        if (other2 && (d.x + d.z === 0.5 || site.placement && other2.placement || existingBridge)) addEdge(site, other2);
      }
      return edges;
    };
    const world = singleCompileEnabled() ? compileWorldDefinition(definition, buildEdges) : compileWorldDefinition({ ...definition, edges: buildEdges(compileWorldDefinition(definition)) });
    if (cache2.size >= 8) cache2.delete(cache2.keys().next().value);
    cache2.set(revision, world);
    return world;
  } catch (__trialTimingError) {
    __trialTimingFailed = true;
    throw __trialTimingError;
  } finally {
    trialTimingExit(__trialTimingToken, __trialTimingFailed);
  }
}
function editableTerrainSegmentSupported(world, from, to, radius = 0.18) {
  if (![from.x, from.z, to.x, to.z, radius].every(Number.isFinite) || radius < 0) return false;
  const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
  if (length > 1024) return false;
  const steps = Math.max(1, Math.ceil(length / 0.08)), nx = length ? -dz / length : 1, nz = length ? dx / length : 0;
  const bridgeDecks = new Set(world.floors.filter((floor) => floor.kind === "deck" && JSON.parse(floor.id)[1] === "existing-lookout-bridge").map((floor) => floor.id));
  const grounds = new Set(world.floors.filter((floor) => floor.kind === "ground").map((floor) => floor.id));
  let previous;
  for (let i = 0; i <= steps; i++) {
    const cell = { x: from.x + dx * i / steps, z: from.z + dz * i / steps };
    const sample = world.floorAt(cell), center = sample?.point;
    if (!sample || !center) return false;
    for (const side of [-radius, radius]) {
      const edge = world.floorAt({ x: cell.x + nx * side, z: cell.z + nz * side })?.point;
      if (!edge || Math.abs(edge.y - center.y) > Math.hypot(edge.x - center.x, edge.z - center.z) * 0.8 + 0.04) return false;
    }
    if (previous) {
      const rise = Math.abs(center.y - previous.point.y), run = Math.hypot(center.x - previous.point.x, center.z - previous.point.z);
      const bridgeLip = previous.floorId !== sample.floorId && rise <= 0.16 && run > 0 && (bridgeDecks.has(previous.floorId) && grounds.has(sample.floorId) || bridgeDecks.has(sample.floorId) && grounds.has(previous.floorId));
      if (rise > run * 0.8 + 1e-8 && !bridgeLip) return false;
    }
    previous = sample;
  }
  return true;
}
function memoTerrainSamples(sample) {
  globalThis.__memoCount("factories");
  const rows = /* @__PURE__ */ new Map();
  return (cell) => {
    const x = Object.is(cell.x, -0) ? "-0" : cell.x;
    const z = Object.is(cell.z, -0) ? "-0" : cell.z;
    let row = rows.get(x);
    const known = row?.get(z);
    if (known) {
      globalThis.__memoCount("hits");
      return known.value;
    }
    const value = sample(cell);
    if (!row) {
      row = /* @__PURE__ */ new Map();
      rows.set(x, row);
    }
    globalThis.__memoCount("entries");
    row.set(z, { value });
    return value;
  };
}
globalThis.__memoSamplesFactory = memoTerrainSamples;

// src/domain/growingIsland/community.ts
function homeCellOf(state, villager) {
  return state.plots.find((p) => p.id === villager.home)?.cell ?? HOME_CELL;
}
function housing(state, reached, world) {
  world ??= editableIslandWorld(state);
  reached ??= reachableFromHome(state, void 0, world);
  const capacity = state.plots.filter((p) => p.kind === "home" && p.cell && (!world || onLand(state, p.cell, world))).reduce((sum, p) => sum + RULES.homeCapacity[p.stage], 0);
  const housed = state.villagers.filter((v) => v.home !== "pokomoko").length;
  const vacancy = state.plots.filter((p) => p.kind === "home" && p.cell && (!world || onLand(state, p.cell, world)) && isReachable(p.cell, reached, world)).reduce((sum, p) => sum + Math.max(0, RULES.homeCapacity[p.stage] - occupantsOf(state, p.id).length), 0);
  return { capacity, housed, vacancy };
}
function occupantsOf(state, plotId) {
  return state.villagers.filter((v) => v.home === plotId);
}
function foodSupport(state, reached, world) {
  world ??= editableIslandWorld(state);
  reached ??= reachableFromHome(state, void 0, world);
  let support = RULES.baseFood;
  for (const p of state.plots) {
    if (!p.cell || p.stage === 0 || world && !onLand(state, p.cell, world) || !isReachable(p.cell, reached, world)) continue;
    if (p.kind === "farm") support += waterAt(state, p.cell, world) > 0 ? FOOD_SUPPORT.farm + 1 : FOOD_SUPPORT.farm;
    else if (p.kind === "market") support += FOOD_SUPPORT.market;
  }
  for (const l of state.landmarks) {
    if (!l.cell || world && !onLand(state, l.cell, world) || !isReachable(l.cell, reached, world)) continue;
    if (l.kind === "planter") support += 1;
    else if (l.kind === "bakery") support += 3;
  }
  return support;
}
function playCells(state, world) {
  return [
    ...state.plots.filter((p) => p.cell && (!world || onLand(state, p.cell, world)) && p.stage > 0 && PLAY_SUPPORT[p.kind]).map((p) => p.cell),
    ...state.landmarks.filter((l) => l.cell && (!world || onLand(state, l.cell, world)) && PLAY_SUPPORT[l.kind]).map((l) => l.cell),
    ...state.keepsakes.filter((k) => k.cell && (!world || onLand(state, k.cell, world))).map((k) => k.cell)
  ];
}
function playPlotCells(state, world) {
  return state.plots.filter((p) => p.cell && (!world || onLand(state, p.cell, world)) && p.stage > 0 && (p.kind === "play" || p.kind === "festival")).map((p) => p.cell);
}
function likeCells(state, like, world) {
  const reached = connectedWaterChannels(waterLayout(state, world));
  switch (like) {
    case "flower":
      return [
        ...state.landmarks.filter((l) => l.kind === "flower" && l.cell && (!world || onLand(state, l.cell, world)) && growthStage({ kind: "flower", growth: l.growth }) === 2).map((l) => l.cell),
        ...state.plots.filter((p) => p.kind === "wild" && p.cell && (!world || onLand(state, p.cell, world)) && p.stage > 0 && p.growth >= 6 && p.style !== "tree").map((p) => p.cell)
      ];
    case "water":
      return state.landmarks.filter((l) => l.cell && (!world || onLand(state, l.cell, world)) && (l.kind === "water-bowl" || l.kind === "fountain" || l.kind === "water-channel" && reached.has(key(l.cell)))).map((l) => l.cell);
    case "tree":
      return state.landmarks.filter((l) => l.kind === "sapling" && l.cell && (!world || onLand(state, l.cell, world)) && l.growth >= TREE_MATURE_HOURS).map((l) => l.cell);
    case "light":
      return state.landmarks.filter((l) => l.cell && (!world || onLand(state, l.cell, world)) && (l.kind === "lantern" || l.kind === "lighthouse")).map((l) => l.cell);
    case "farm":
      return state.plots.filter((p) => p.cell && (!world || onLand(state, p.cell, world)) && p.stage > 0 && (p.kind === "farm" || p.kind === "market")).map((p) => p.cell);
    case "play":
      return playCells(state, world);
    default:
      return [];
  }
}
var within = (cells, home, radius) => cells.some((c) => distance2(c, home) <= radius);
function comfort(state, villager, fed, reached, world) {
  world ??= editableIslandWorld(state);
  reached ??= reachableFromHome(state, void 0, world);
  fed ??= foodSupport(state, void 0, world) >= state.villagers.length;
  if (world && villager.home !== "pokomoko" && !state.plots.some((p) => p.id === villager.home && p.kind === "home" && p.cell && p.stage > 0 && onLand(state, p.cell, world))) return 0;
  const home = homeCellOf(state, villager), likes = likesOf(villager);
  if (!isReachable(home, reached, world)) return 0;
  const accessible = (cells) => cells.filter((cell) => isReachable(cell, reached, world));
  const quiet = !within(accessible(playPlotCells(state, world)), home, RULES.quietRadius);
  const liked = likes.some((like) => like === "food" ? fed : like === "quiet" ? quiet : within(accessible(likeCells(state, like, world)), home, RULES.likeRadius));
  const played = likes.includes("quiet") ? quiet : within(accessible(playCells(state, world)), home, RULES.likeRadius);
  return (liked ? 1 : 0) + (fed ? 1 : 0) + (played ? 1 : 0);
}
function genki(state, reached, world) {
  world ??= editableIslandWorld(state);
  reached ??= reachableFromHome(state, void 0, world);
  const fed = foodSupport(state, reached, world) >= state.villagers.length;
  return state.villagers.reduce((sum, v) => sum + comfort(state, v, fed, reached, world), 0);
}
function levelFor(points) {
  let level = 1;
  RULES.genkiLevels.forEach((threshold, index) => {
    if (points >= threshold) level = index + 1;
  });
  return level;
}
var islandLevel = (state) => levelFor(state.genki.best);
function unlockedKeys(state) {
  if (state.growth) return UNLOCKS.filter((u) => !RETIRED_PURCHASES.has(u.key) && (state.growth.welcomed || state.villagers.length > 0 || INITIAL_PURCHASES.has(u.key))).map((u) => u.key);
  const level = islandLevel(state), villagers = state.villagers.length;
  return UNLOCKS.filter((u) => (u.level ?? 1) <= level && (u.villagers ?? 0) <= villagers).map((u) => u.key);
}
function refreshUnlocks(state) {
  const fresh2 = unlockedKeys(state).filter((k) => !state.unlocked.includes(k));
  state.unlocked.push(...fresh2);
  return fresh2;
}
function canPurchase(state, key6) {
  return !(state.growth && RETIRED_PURCHASES.has(key6)) && state.unlocked.includes(key6);
}
function cosmeticsOpen(state, requiredLevel) {
  return !!state.growth && (state.growth.welcomed || state.villagers.length > 0) || islandLevel(state) >= requiredLevel;
}

// docs/design/2026-10-23-place-method-comparison/growth-seam.ts
var key4 = (cell) => `${cell.x},${cell.z}`;
function inheritGrowthBoundary(previous, next) {
  if (!previous.terrain || !next.terrain) return [];
  const before = landBounds(previous), after = landBounds(next), inherited = [];
  for (let z = 0; z < after.depth; z++) for (let x = after.minX; x <= after.maxX; x++) {
    const cell = { x, z }, source = { x: Math.max(before.minX, Math.min(before.maxX, x)), z: Math.min(before.depth - 1, z) };
    if (Math.abs(cell.x - source.x) + Math.abs(cell.z - source.z) !== 1) continue;
    const id = key4(cell);
    if (Object.hasOwn(previous.terrain.heights, id) || Object.hasOwn(next.terrain.heights, id)) continue;
    const value = previous.terrain.heights[key4(source)] ?? 0;
    if (!Number.isInteger(value) || value < -4 || value > 12) throw Error("\u571F\u5730\u306E \u9AD8\u3055\u3092 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
    if (value !== 0) {
      next.terrain.heights[id] = value;
      inherited.push(cell);
    }
  }
  return inherited;
}
function validateGrowthOwnerSupport(previous, next) {
  const state = previous;
  const cells = [
    ...state.plots.flatMap((owner) => owner.cell ? [owner.cell] : []),
    ...state.landmarks.flatMap((owner) => !owner.cell ? [] : OWN_LANDMARKS.includes(owner.kind) ? [owner.cell] : occupiedCells({ kind: owner.kind, cell: owner.cell })),
    ...state.keepsakes.flatMap((owner) => owner.cell ? [owner.cell] : [])
  ];
  if (cells.some((cell) => terrainOwnerSupported(previous, cell) && !terrainOwnerSupported(next, cell)))
    throw Error("\u3082\u306E\u306E \u8DB3\u3082\u3068\u3092 \u305F\u3057\u304B\u3081\u3088\u3046\u3002\u3072\u308D\u3052\u308B\u524D\u306E \u5CF6\u306F \u305D\u306E\u307E\u307E\u3060\u3088\u3002");
}

// src/domain/growingIsland/experience.ts
var families = ["grove", "spring", "community", "flowers"];
var text = (value) => typeof value === "string" && value.length > 0;
var sharedMemoryKey = (memory) => JSON.stringify([memory.family, memory.actorId]);
function validateExperience(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.shared) || Object.keys(value).some((k) => k !== "version" && k !== "shared") || value.shared.some((m) => !m || !families.includes(m.family) || !text(m.actorId) || m.actorId === "pokomoko" || !text(m.targetId) || !Number.isFinite(m.at) || m.at < 0 || !text(m.variant) || !text(m.revision) || !Array.isArray(m.memberIds) || !m.memberIds.length || !m.memberIds.every(text) || new Set(m.memberIds).size !== m.memberIds.length || Object.keys(m).some((k) => !["family", "actorId", "targetId", "at", "memberIds", "variant", "revision"].includes(k))) || new Set(value.shared.map(sharedMemoryKey)).size !== value.shared.length)
    throw new Error("\u3053\u306E\u5CF6\u306E\u601D\u3044\u51FA\u306F\u65B0\u3057\u3044\u7248\u3067\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
}
function concertPlace(state, targetId, world) {
  world ??= editableIslandWorld(state);
  const stand = state.landmarks.find((item) => item.id === targetId && item.kind === "bandstand" && item.cell);
  if (!stand?.cell) return;
  const reached = reachableFromHome(state, void 0, world);
  if (!isReachable(stand.cell, reached, world)) return;
  const nearby = derivePlaces(state, world).filter((place) => place.stage === "grown" || place.stage === "lived").map((place) => {
    const search = placeWalkSearch(reached, place.entrances, 3, world);
    const cost = Math.min(...[...reached].map((id) => {
      const [x, z] = id.split(",").map(Number);
      return Math.abs(x - stand.cell.x) + Math.abs(z - stand.cell.z) === 1 ? search.costs.get(key({ x, z })) ?? Infinity : Infinity;
    }));
    return { place, cost };
  }).filter((entry) => entry.cost <= 3).sort((a, b2) => a.cost - b2.cost || a.place.id.localeCompare(b2.place.id));
  return nearby[0]?.place;
}
function recordSharedPlay(state, receipt, now, world) {
  world ??= editableIslandWorld(state);
  if (state.experience) validateExperience(state.experience);
  const place = concertPlace(state, receipt.targetId, world);
  const actor = state.villagers.find((friend) => friend.id === receipt.actorId && !friend.away && !state.arrivals.includes(friend.id));
  const home = actor && state.plots.find((plot) => plot.id === actor.home && plot.kind === "home" && plot.stage > 0 && plot.cell && !state.unopened.includes(plot.id));
  if (!place || place.id !== receipt.placeId || place.revision !== receipt.revision || !actor || actor.home !== "pokomoko" && (!home?.cell || !isReachable(home.cell, reachableFromHome(state, void 0, world), world)) || !Number.isFinite(receipt.overlapMs) || receipt.overlapMs < 3e3 || !Number.isFinite(now) || now < 0) return false;
  const fact = {
    family: place.family,
    actorId: actor.id,
    targetId: receipt.targetId,
    at: now,
    memberIds: [...place.memberIds],
    variant: place.variant,
    revision: place.revision
  };
  if (state.experience?.shared.some((old) => sharedMemoryKey(old) === sharedMemoryKey(fact))) return true;
  state.experience ??= { version: 1, shared: [] };
  state.experience.shared.push(fact);
  return true;
}

// src/domain/growingIsland/room.ts
var WORD_GROUPS = [
  { id: "food", name: "\u305F\u3079\u3082\u306E", color: "#e2574c", categories: ["\u98DF\u3079\u7269", "\u98DF\u4E8B", "\u98F2\u307F\u7269", "\u6599\u7406", "\u679C\u7269", "\u91CE\u83DC"] },
  { id: "nature", name: "\u3069\u3046\u3076\u3064\u30FB\u3057\u305C\u3093", color: "#5fae5a", categories: ["\u52D5\u7269", "\u81EA\u7136", "\u74B0\u5883", "\u74B0\u5883\u554F\u984C", "\u5929\u6C17", "\u690D\u7269", "\u5B63\u7BC0", "\u751F\u304D\u7269"] },
  { id: "people", name: "\u3072\u3068", color: "#ef8fb1", categories: ["\u4EBA", "\u5BB6\u65CF", "\u8077\u696D", "\u8EAB\u4F53", "\u611F\u60C5", "\u5065\u5EB7"] },
  { id: "town", name: "\u307E\u3061", color: "#4f9bd9", categories: ["\u5EFA\u7269", "\u5834\u6240", "\u4EA4\u901A", "\u5B66\u6821", "\u5730\u7406", "\u793E\u4F1A", "\u793E\u4F1A\u554F\u984C", "\u7D4C\u6E08", "\u884C\u4E8B", "\u751F\u6D3B", "\u5834\u9762"] },
  { id: "things", name: "\u3082\u306E\u30FB\u304B\u305A", color: "#f2c14b", categories: ["\u9053\u5177", "\u7269", "\u8272", "\u6570\u5B57", "\u6708", "\u6642\u9593", "\u6642\u9593\u30FB\u5909\u5316", "\u66DC\u65E5", "\u5F62"] },
  { id: "move", name: "\u3046\u3054\u304D", color: "#f08a3c", categories: ["\u52D5\u8A5E"] },
  { id: "look", name: "\u3088\u3046\u3059", color: "#9a74d6", categories: ["\u5F62\u5BB9\u8A5E", "\u526F\u8A5E"] },
  { id: "other", name: "\u305D\u306E\u307B\u304B", color: "#3fb3a7", categories: [] }
];
var WALL_PATTERNS = [
  { id: "dots", name: "\u307F\u305A\u305F\u307E", mathLevel: 0 },
  { id: "blocks", name: "\u3044\u308D\u306E \u30D6\u30ED\u30C3\u30AF", mathLevel: 8 },
  { id: "rings", name: "\u3068\u3051\u3044\u306E \u308F", mathLevel: 13 },
  { id: "stars", name: "\u307B\u3057", mathLevel: 19 },
  { id: "pie", name: "\u30B1\u30FC\u30AD", mathLevel: 21 },
  // English levels open shapes made of the words themselves.
  { id: "letters", name: "\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8", vocabLevel: 3 },
  { id: "hearts", name: "\u30CF\u30FC\u30C8", vocabLevel: 6 }
];
var RUG_COLORS = ["#4d9b9b", "#e2574c", "#f2c14b", "#4f9bd9", "#9a74d6", "#ef8fb1"];
var DEFAULT_DECOR = { pattern: "dots", rug: 0 };
function patternOpen(pattern, mathLevel, vocabLevel = 0) {
  const entry = WALL_PATTERNS.find((p) => p.id === pattern);
  if (!entry) return false;
  return entry.vocabLevel !== void 0 ? entry.vocabLevel <= vocabLevel : (entry.mathLevel ?? Infinity) <= mathLevel;
}

// src/domain/growingIsland/placeTypes.ts
var PLACE_GOAL_IDS = ["P01", "P02", "P03", "P04", "P05", "P06"];

// src/domain/growingIsland/placeGoals.ts
function newPlaceProgress() {
  return { version: 1, milestones: {}, uses: {}, shown: {}, useHistory: [] };
}
var goalId = (id) => PLACE_GOAL_IDS.includes(id);
var object = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var text2 = (value) => typeof value === "string" && value.length > 0;
var keysOnly = (value, keys) => Object.keys(value).every((key6) => keys.includes(key6));
var receiptKey = (use) => JSON.stringify([use.ruleId, use.revision, use.actorId, use.targetId]);
function validatePlaceProgress(progress) {
  const evidence2 = (value, id) => object(value) && goalId(value.ruleId) && (id === void 0 || value.ruleId === id) && Number.isFinite(value.at) && Number(value.at) >= 0 && text2(value.anchorId) && text2(value.variant) && text2(value.revision) && Array.isArray(value.memberIds) && value.memberIds.length > 0 && value.memberIds.every(text2) && new Set(value.memberIds).size === value.memberIds.length;
  const use = (value, id) => evidence2(value, id) && text2(value.actorId) && text2(value.targetId) && value.ruleId !== "P06";
  if (!object(progress) || progress.version !== 1 || !keysOnly(progress, ["version", "selected", "milestones", "uses", "shown", "useHistory"]) || progress.selected !== void 0 && !goalId(progress.selected) || !object(progress.milestones) || !object(progress.uses) || !object(progress.shown) || Object.entries(progress.milestones).some(([id, value]) => !goalId(id) || !evidence2(value, id)) || Object.entries(progress.shown).some(([id, value]) => !goalId(id) || !text2(value)) || Object.entries(progress.uses).some(([id, value]) => !goalId(id) || id === "P06" || !object(value) || !keysOnly(value, ["pokomoko", "villager"]) || Object.entries(value).some(([actor, fact]) => !use(fact, id) || (actor === "pokomoko" ? fact.actorId !== "pokomoko" : fact.actorId === "pokomoko"))) || progress.useHistory !== void 0 && (!Array.isArray(progress.useHistory) || progress.useHistory.some((value) => !use(value)) || new Set(progress.useHistory.map(receiptKey)).size !== progress.useHistory.length))
    throw new Error("\u3053\u306E\u5CF6\u306E\u80B2\u3064\u3070\u3057\u3087\u306F\u65B0\u3057\u3044\u7248\u3067\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
}
function snapshot(place, at) {
  return { at, ruleId: place.ruleId, anchorId: place.anchorId, memberIds: [...place.memberIds], variant: place.variant, revision: place.revision };
}
function presentActor(state, id, world) {
  if (id === "pokomoko") return !world || world.owns(HOME_CELL);
  const actor = state.villagers.find((actor2) => actor2.id === id && !actor2.away && !state.arrivals.includes(actor2.id));
  if (!actor) return false;
  if (actor.home === "pokomoko") return !world || world.owns(HOME_CELL);
  const home = state.plots.find((plot) => plot.id === actor.home && plot.kind === "home" && plot.stage > 0 && plot.cell && !state.unopened.includes(plot.id));
  return Boolean(home?.cell && (!world || onLand(state, home.cell, world)) && isReachable(home.cell, reachableFromHome(state, void 0, world), world));
}
function matchesCurrentUse(state, place, fact, world) {
  return Boolean(fact && fact.ruleId === place.ruleId && fact.revision === place.revision && fact.anchorId === place.anchorId && fact.memberIds.length === place.memberIds.length && fact.memberIds.every((id) => place.memberIds.includes(id)) && place.useTargets.some((target2) => target2.id === fact.targetId) && presentActor(state, fact.actorId, world));
}
function hasCurrentUse(state, place, actor, world) {
  const matches = (fact) => (actor === void 0 || (fact.actorId === "pokomoko" ? "pokomoko" : "villager") === actor) && matchesCurrentUse(state, place, fact, world);
  return Boolean(state.placeProgress?.useHistory?.some(matches) || Object.values(state.placeProgress?.uses[place.ruleId] ?? {}).some(matches));
}
var grown = (place) => place.stage === "grown" || place.stage === "lived";
function currentIsland(state, places, world) {
  const reachable = reachableFromHome(state, void 0, world);
  const mature = places.filter((place) => grown(place) && place.entrances.some((cell) => reachable.has(key(cell))));
  const families2 = new Set(mature.map((place) => place.family));
  const pokomoko = mature.some((place) => hasCurrentUse(state, place, "pokomoko", world));
  const villager = mature.some((place) => hasCurrentUse(state, place, "villager", world));
  return { mature, families: families2, pokomoko, villager };
}
function placeRevisionForGoal(state, id, world) {
  world ??= editableIslandWorld(state);
  const places = derivePlaces(state, world);
  if (id !== "P06") return places.filter((place) => place.ruleId === id && grown(place)).sort((a, b2) => a.id.localeCompare(b2.id))[0]?.revision;
  const { mature, families: families2 } = currentIsland(state, places, world);
  return families2.size >= 3 ? JSON.stringify(mature.map((place) => place.revision).sort()) : void 0;
}
function syncPlaceMilestones(state, now, world) {
  world ??= editableIslandWorld(state);
  const progress = state.placeProgress ??= newPlaceProgress();
  validatePlaceProgress(progress);
  const places = derivePlaces(state, world);
  for (const place of places.filter(grown).sort((a, b2) => a.id.localeCompare(b2.id)))
    progress.milestones[place.ruleId] ??= snapshot(place, now);
  const island = currentIsland(state, places, world);
  if (island.families.size >= 3 && island.pokomoko && island.villager && !progress.milestones.P06) {
    progress.milestones.P06 = {
      at: now,
      ruleId: "P06",
      anchorId: state.seed,
      memberIds: [...new Set(island.mature.flatMap((place) => place.memberIds))].sort(),
      variant: "island",
      revision: JSON.stringify(island.mature.map((place) => place.revision).sort())
    };
  }
}
function recordPlaceUse(state, receipt, at, world) {
  world ??= editableIslandWorld(state);
  if (!Number.isFinite(at) || at < 0) throw new Error("\u3070\u3057\u3087\u306E \u3044\u307E\u3092 \u3082\u3046\u3044\u3061\u3069 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
  const place = derivePlaces(state, world).find((place2) => place2.id === receipt.placeId && place2.ruleId === receipt.ruleId && grown(place2) && place2.revision === receipt.revision && place2.entrances.length > 0);
  if (!place || !presentActor(state, receipt.actorId, world)) throw new Error("\u3070\u3057\u3087\u306E \u3044\u307E\u3092 \u3082\u3046\u3044\u3061\u3069 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
  const target2 = place.useTargets.find((target3) => target3.id === receipt.targetId);
  const reached = reachableFromHome(state, void 0, world);
  if (!target2 || !isReachable(target2.route?.[0] ?? target2.cell, reached, world)) throw new Error("\u3053\u3053\u307E\u3067 \u3042\u308B\u3051\u308B \u3070\u3057\u3087\u3092 \u3042\u3051\u3066\u307F\u3088\u3046\u3002");
  const progress = state.placeProgress ??= newPlaceProgress();
  validatePlaceProgress(progress);
  const fact = { ...snapshot(place, at), actorId: receipt.actorId, targetId: receipt.targetId };
  const history = progress.useHistory ??= Object.values(progress.uses).flatMap((actors) => Object.values(actors)).filter((fact2) => Boolean(fact2));
  const original = history.find((use) => receiptKey(use) === receiptKey(fact));
  if (!original) history.push(fact);
  const latest = progress.uses[place.ruleId] ??= {};
  latest[receipt.actorId === "pokomoko" ? "pokomoko" : "villager"] = original ?? fact;
  syncPlaceMilestones(state, at, world);
}
function recordPlaceShown(state, receipt, world) {
  world ??= editableIslandWorld(state);
  if (!goalId(receipt.ruleId) || !text2(receipt.revision)) throw new Error("\u3070\u3057\u3087\u306E \u3044\u307E\u3092 \u3082\u3046\u3044\u3061\u3069 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
  const current = receipt.ruleId === "P06" ? placeRevisionForGoal(state, "P06", world) : derivePlaces(state, world).find((place) => place.ruleId === receipt.ruleId && grown(place) && place.revision === receipt.revision)?.revision;
  if (current !== receipt.revision) throw new Error("\u3070\u3057\u3087\u306E \u3044\u307E\u3092 \u3082\u3046\u3044\u3061\u3069 \u305F\u3057\u304B\u3081\u3066\u306D\u3002");
  const progress = state.placeProgress ??= newPlaceProgress();
  validatePlaceProgress(progress);
  progress.shown[receipt.ruleId] = receipt.revision;
}

// src/domain/growingIsland/names.ts
var NAME_CANDIDATES = {
  rabbit: ["\u307F\u307F", "\u3057\u3089\u305F\u307E", "\u3082\u306A\u304B", "\u3075\u308F\u308A", "\u3046\u3055\u3053", "\u3074\u3087\u3093\u305F"],
  otter: ["\u3061\u3083\u3077", "\u306A\u307F\u306E", "\u3059\u3044\u3059\u3044", "\u307D\u3061\u3083", "\u304B\u3044\u308A", "\u308B\u308B"],
  fox: ["\u3053\u3093\u305F", "\u304D\u306A\u3053", "\u3082\u307F\u3058", "\u3086\u305A", "\u307D\u3093", "\u3042\u3093\u305A"],
  duck: ["\u3077\u304F\u308A", "\u3071\u308B", "\u304B\u3082\u307F", "\u307A\u305F\u3053", "\u3061\u3083\u3063\u3077", "\u3050\u3045"],
  squirrel: ["\u304F\u308B\u307F", "\u3069\u3093\u3050\u308A", "\u307E\u308D\u3093", "\u304F\u308A\u3053", "\u3061\u3063\u3077", "\u307D\u3063\u3051"],
  hedgehog: ["\u3068\u3052\u307E\u308B", "\u3053\u308D\u3093", "\u307E\u308B\u308B", "\u3044\u304C\u3063\u3061", "\u3061\u304F\u3061\u304F", "\u306F\u308A\u3043"],
  bird: ["\u3074\u3074", "\u3061\u3085\u3093\u305F", "\u308B\u308A", "\u3074\u3044\u3053", "\u3053\u3068\u306D", "\u305D\u3088"],
  penguin: ["\u307A\u3093\u305F", "\u3053\u304A\u308A", "\u307A\u307A", "\u3057\u305A\u304F"],
  owl: ["\u307B\u3046\u307B\u3046", "\u3082\u308A\u304A", "\u3064\u304D\u307F", "\u3075\u304F\u3059\u3051"],
  frog: ["\u3051\u308D\u308A", "\u3042\u307E\u304C\u3048", "\u3074\u3087\u3053", "\u307F\u3069\u308A"],
  girl: [KID.girl.name],
  boy: [KID.boy.name]
};
function arrivalName(state, visitor) {
  if (isKid(visitor.species)) return KID[visitor.species].name;
  const list = NAME_CANDIDATES[visitor.species];
  const start = Math.floor(roll(state.seed, "name", visitor.species, visitor.ordinal) * list.length);
  const used = new Set(state.villagers.map((v) => v.name));
  for (let i = 0; i < list.length; i++) {
    const name = list[(start + i) % list.length];
    if (!used.has(name)) return name;
  }
  return list[start];
}

// src/domain/growingIsland/pier.ts
var TRAITS = ["lively", "mellow", "shy", "hungry"];
function rareChance(state, world) {
  return RULES.rareBase + RULES.rareBonus * Math.min(1, richness(state, world) / RULES.rareRichness);
}
function rollVisitor(state, ordinal, only, world) {
  const present = /* @__PURE__ */ new Set([...state.villagers.map((v) => v.species), state.pier.visitor.species, state.pier.next.species]);
  const missing = KIDS.filter((kid) => !present.has(kid));
  if (!only && missing.length && (ordinal === 1 || ordinal === 2)) {
    const first = roll(state.seed, "kid-order", "island", 0) < 0.5 ? "girl" : "boy";
    const kid = missing.includes(first) ? first : missing[0];
    return { ordinal, species: kid, variant: { ...KID[kid].variant }, trait: KID[kid].trait };
  }
  const character = islandCharacter(state, world), favored = character === "mixed" ? [] : FAVORED[character];
  const pool = (only ?? AVAILABLE_SPECIES).filter((s2) => !isKid(s2) || ordinal > 0 && missing.includes(s2));
  const weight = (s2) => {
    const rare = RARE[s2];
    if (rare) return rare.weight * (rare.home === character ? 3 : 1);
    return isKid(s2) || favored.includes(s2) ? RULES.favoredWeight : 1;
  };
  const species = pick(pool, pool.map(weight), roll(state.seed, "pier-species", "boat", ordinal));
  if (isKid(species)) return { ordinal, species, variant: { ...KID[species].variant }, trait: KID[species].trait };
  return {
    ordinal,
    species,
    variant: {
      color: Math.floor(roll(state.seed, "pier-color", "boat", ordinal) * 6),
      accessory: Math.floor(roll(state.seed, "pier-accessory", "boat", ordinal) * 4),
      sparkle: roll(state.seed, "pier-sparkle", "boat", ordinal) < rareChance(state, world)
    },
    trait: TRAITS[Math.floor(roll(state.seed, "pier-trait", "boat", ordinal) * TRAITS.length)]
  };
}
function boatInterval(villagers) {
  return RULES.boatBaseHours + RULES.boatHoursPerVillager * villagers;
}
var docked = (state, hour = state.town.clock) => hour >= state.pier.dockAt;
function advancePier(state, hour, world) {
  const arriving = state.pier.visitor;
  const rolled = state.pier.rolled + 1;
  state.pier = {
    visitor: state.pier.next,
    next: rollVisitor(state, rolled, void 0, world),
    rolled,
    dockAt: hour + boatInterval(state.villagers.length + 1)
  };
  return arriving;
}

// src/domain/growingIsland/town.ts
var isDawn = (hour) => hour % 24 === RULES.dawnHour;
function levelUp(state, before, after) {
  const events = [];
  for (let level = before + 1; level <= after; level++) {
    events.push({ type: "level", level });
    if (!state.growth && WONDER_LEVELS.includes(level)) {
      state.wonderSeeds = (state.wonderSeeds ?? 0) + 1;
      events.push({ type: "wonder-seed" });
    }
  }
  events.push(...grantGrowthMilestones(state, state.nature.realAt));
  return events;
}
function build(state, hour, events, world) {
  const due = state.plots.filter((p) => p.cell && (!world || onLand(state, p.cell, world)) && p.stage === 0 && p.plantedAt + RULES.buildHours <= hour);
  if (!due.length) return;
  const reached = reachableFromHome(state, void 0, world), all = features(state, world);
  for (const plot of due) {
    if (!isReachable(plot.cell, reached, world)) continue;
    plot.stage = 1;
    plot.builtAt = hour;
    plot.stagedAt = hour;
    plot.style = styleAt(state, plot.cell, all, world);
    if (state.growth && plot.paid > 0 && !["wild", "wonder"].includes(plot.kind)) state.growth.built = true;
    events.push({ type: "built", plotId: plot.id });
    if (!state.unopened.includes(plot.id)) state.unopened.push(plot.id);
  }
}
function growHomes(state, hour, events, world) {
  const reached = reachableFromHome(state, void 0, world), level = islandLevel(state), fed = foodSupport(state, reached, world) >= state.villagers.length;
  for (const plot of state.plots) {
    if (plot.kind !== "home" || !plot.cell || world && !onLand(state, plot.cell, world) || !isReachable(plot.cell, reached, world) || plot.stage < 1 || plot.stage > 3) continue;
    const rule = RULES.homeGrowth[plot.stage], people = occupantsOf(state, plot.id);
    if (!people.length || hour - (plot.stagedAt ?? plot.builtAt ?? hour) < rule.hours || !state.growth && level < rule.level) continue;
    const average = people.reduce((sum, v) => sum + comfort(state, v, fed, reached, world), 0) / people.length;
    if (!state.growth && average < rule.comfort) continue;
    plot.stage = plot.stage + 1;
    plot.stagedAt = hour;
    events.push({ type: "grew", plotId: plot.id, stage: plot.stage });
    if (!state.unopened.includes(plot.id)) state.unopened.push(plot.id);
  }
}
function refreshCommunity(state, events, world) {
  const before = levelFor(state.genki.best);
  state.genki.current = genki(state, void 0, world);
  state.genki.best = Math.max(state.genki.best, state.genki.current);
  const after = levelFor(state.genki.best);
  events.push(...levelUp(state, before, after));
  const character = islandCharacter(state, world);
  if (character !== state.character) {
    state.character = character;
    events.push({ type: "character", character });
  }
  const keys = refreshUnlocks(state);
  if (keys.length) events.push({ type: "unlocked", keys });
}
function chooseHome(state, villager, world) {
  const reached = reachableFromHome(state, void 0, world);
  const homes = state.plots.filter((p) => p.kind === "home" && p.cell && (!world || onLand(state, p.cell, world)) && isReachable(p.cell, reached, world) && p.stage > 0 && occupantsOf(state, p.id).length < RULES.homeCapacity[p.stage]);
  let best, bestScore = -1;
  for (const home of homes.sort((a, b2) => a.builtAt - b2.builtAt || a.id.localeCompare(b2.id))) {
    const score = comfort(state, { ...villager, home: home.id }, void 0, reached, world);
    if (score > bestScore) {
      best = home;
      bestScore = score;
    }
  }
  return best;
}
function welcome(state, hour, home, world) {
  world ??= editableIslandWorld(state);
  if (world) {
    const owned = state.plots.find((plot) => plot.id === home.id && plot.kind === "home" && plot.stage > 0 && plot.cell && world.owns(plot.cell));
    if (!owned?.cell || occupantsOf(state, owned.id).length >= RULES.homeCapacity[owned.stage] || !isReachable(owned.cell, reachableFromHome(state, void 0, world), world)) throw new Error("\u306A\u304B\u307E\u306E \u3044\u3048\u307E\u3067 \u3042\u308B\u3051\u308B \u3070\u3057\u3087\u3092 \u3042\u3051\u3066\u307F\u3088\u3046\u3002");
  }
  const visitor = advancePier(state, hour, world);
  const villager = {
    id: `v${state.nextId++}`,
    species: visitor.species,
    variant: visitor.variant,
    trait: visitor.trait,
    home: home.id,
    arrivedAt: hour,
    name: arrivalName(state, visitor)
  };
  state.villagers.push(villager);
  state.arrivals.push(villager.id);
  return villager;
}
function moveIn(state, hour, events, world) {
  if (!docked(state, hour)) return;
  const people = state.villagers.length;
  if (housing(state, void 0, world).vacancy < 1) return "full";
  if (foodSupport(state, void 0, world) <= people) return "food";
  const home = chooseHome(state, { ...state.pier.visitor, id: "candidate", home: "", arrivedAt: hour }, world);
  if (!home) return "full";
  events.push({ type: "arrived", villagerId: welcome(state, hour, home, world).id });
}
function hasTownWork(state, world) {
  if (!docked(state)) return true;
  const reached = reachableFromHome(state, void 0, world), people = state.villagers.length;
  if (state.plots.some((p) => p.cell && (!world || onLand(state, p.cell, world)) && p.stage === 0 && isReachable(p.cell, reached, world))) return true;
  if (housing(state, reached, world).vacancy > 0 && foodSupport(state, reached, world) > people) return true;
  if (genki(state, reached, world) !== state.genki.current) return true;
  const fed = foodSupport(state, reached, world) >= people, level = islandLevel(state);
  return state.plots.some((p) => {
    if (p.kind !== "home" || !p.cell || world && !onLand(state, p.cell, world) || !isReachable(p.cell, reached, world) || p.stage < 1 || p.stage > 3) return false;
    const rule = RULES.homeGrowth[p.stage], occupants = occupantsOf(state, p.id);
    return occupants.length > 0 && (state.growth || level >= rule.level && occupants.reduce((sum, v) => sum + comfort(state, v, fed, reached, world), 0) / occupants.length >= rule.comfort);
  });
}
function openTown(state, world) {
  world ??= editableIslandWorld(state);
  const events = [], from = state.town.clock;
  while (state.town.bank > 0 && hasTownWork(state, world)) {
    state.town.clock += 1;
    state.town.bank -= 1;
    const hour = state.town.clock;
    build(state, hour, events, world);
    if (!isDawn(hour)) continue;
    growHomes(state, hour, events, world);
    refreshCommunity(state, events, world);
    moveIn(state, hour, events, world);
  }
  const reached = reachableFromHome(state, void 0, world);
  for (const plot of state.plots) if (plot.cell && plot.stage === 0 && !isReachable(plot.cell, reached, world))
    events.push({ type: "blocked", reason: "unreachable", plotId: plot.id });
  if (docked(state) && !events.some((e) => e.type === "arrived")) {
    if (housing(state, reached, world).vacancy < 1) events.push({ type: "blocked", reason: "full" });
    else if (foodSupport(state, reached, world) <= state.villagers.length) events.push({ type: "blocked", reason: "food" });
  }
  if (!docked(state) && state.town.clock > from) events.push({ type: "boat", hoursLeft: state.pier.dockAt - state.town.clock });
  if (!events.length && state.town.clock > from) events.push({ type: "quiet" });
  events.push(...grantGrowthMilestones(state, state.nature.realAt));
  return events;
}

// src/domain/growingIsland/authoredPlacementSupport.ts
var indexes = /* @__PURE__ */ new WeakMap();
var key5 = (cell) => `${cell.x},${cell.z}`;
var EPSILON2 = 1e-7;
var PHYSICAL_MATCH_BAND = 1e-5 / Math.SQRT2 * 0.9999;
var area = (polygon) => polygon.reduce((sum, p, i) => {
  const q = polygon[(i + 1) % polygon.length];
  return sum + p.x * q.z - q.x * p.z;
}, 0);
var hasArea = (polygon) => polygon.length >= 3 && Math.abs(area(polygon)) > 1e-12;
function clip(polygon, distance3) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b2 = polygon[(i + 1) % polygon.length], da = distance3(a), db = distance3(b2);
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push({ x: a.x + (b2.x - a.x) * t, z: a.z + (b2.z - a.z) * t });
    }
  }
  return result;
}
function coordinateAt(triangle, at, coordinate) {
  const [a, b2, c] = triangle.cells, determinant = (b2.z - c.z) * (a.x - c.x) + (c.x - b2.x) * (a.z - c.z);
  const u = ((b2.z - c.z) * (at.x - c.x) + (c.x - b2.x) * (at.z - c.z)) / determinant;
  const v = ((c.z - a.z) * (at.x - c.x) + (a.x - c.x) * (at.z - c.z)) / determinant;
  return triangle.points[0][coordinate] * u + triangle.points[1][coordinate] * v + triangle.points[2][coordinate] * (1 - u - v);
}
var heightAt = (triangle, at) => coordinateAt(triangle, at, "y");
function matchingCover(polygon, floor, water) {
  let result = [...polygon];
  for (const coordinate of ["x", "z"]) {
    const delta = (at) => coordinateAt(floor, at, coordinate) - coordinateAt(water, at, coordinate);
    result = clip(result, (at) => PHYSICAL_MATCH_BAND - delta(at));
    result = clip(result, (at) => PHYSICAL_MATCH_BAND + delta(at));
  }
  return result;
}
function subtract(polygon, cover) {
  const result = [], orientation = Math.sign(area(cover));
  let inside = [...polygon];
  for (let i = 0; i < cover.length && hasArea(inside); i++) {
    const a = cover[i], b2 = cover[(i + 1) % cover.length];
    const side = (p) => orientation * ((b2.x - a.x) * (p.z - a.z) - (b2.z - a.z) * (p.x - a.x));
    const outside = clip(inside, (p) => -side(p));
    if (hasArea(outside)) result.push(outside);
    inside = clip(inside, side);
  }
  return result;
}
function intersect(polygon, boundary) {
  let result = [...polygon];
  const orientation = Math.sign(area(boundary));
  for (let i = 0; i < boundary.length && hasArea(result); i++) {
    const a = boundary[i], b2 = boundary[(i + 1) % boundary.length];
    result = clip(result, (p) => orientation * ((b2.x - a.x) * (p.z - a.z) - (b2.z - a.z) * (p.x - a.x)));
  }
  return result;
}
function supportIndex(world) {
  const existing = indexes.get(world);
  if (existing) return existing;
  const index = { buckets: /* @__PURE__ */ new Map(), answers: /* @__PURE__ */ new Map() };
  for (const floor of world.floors) for (let i = 0; i < floor.indices.length; i += 3) {
    const vertices = floor.indices.slice(i, i + 3).map((id) => floor.vertices[id]);
    const cells = vertices.map((v) => v.cell), points = vertices.map((v) => v.point);
    const triangle = {
      cells,
      points,
      water: floor.kind === "water",
      minX: Math.min(...cells.map((p) => p.x)),
      maxX: Math.max(...cells.map((p) => p.x)),
      minZ: Math.min(...cells.map((p) => p.z)),
      maxZ: Math.max(...cells.map((p) => p.z))
    };
    for (let z = Math.floor(triangle.minZ); z <= Math.floor(triangle.maxZ); z++) for (let x = Math.floor(triangle.minX); x <= Math.floor(triangle.maxX); x++) {
      const id = key5({ x, z }), bucket = index.buckets.get(id) ?? [];
      bucket.push(triangle);
      index.buckets.set(id, bucket);
    }
  }
  indexes.set(world, index);
  return index;
}
function hasAuthoredPlacementSupport(world, cell) {
  const center = world.floorAt(cell);
  if (!center) return false;
  const radius = AUTHORED_OWNER_HALF_EXTENT;
  for (const x of [-radius, 0, radius]) for (const z of [-radius, 0, radius]) {
    const support = world.floorAt({ x: cell.x + x, z: cell.z + z });
    if (!support || Math.abs(support.point.y - center.point.y) > 0.28) return false;
  }
  if (!world.floors.some((floor) => floor.kind === "water")) return true;
  const index = supportIndex(world), id = key5(cell), cached = index.answers.get(id);
  if (cached !== void 0) return cached;
  const bounds = { minX: cell.x - radius, maxX: cell.x + radius, minZ: cell.z - radius, maxZ: cell.z + radius };
  const candidates = /* @__PURE__ */ new Set();
  for (let z = Math.floor(bounds.minZ); z <= Math.floor(bounds.maxZ); z++) for (let x = Math.floor(bounds.minX); x <= Math.floor(bounds.maxX); x++)
    for (const triangle of index.buckets.get(key5({ x, z })) ?? [])
      if (triangle.maxX >= bounds.minX && triangle.minX <= bounds.maxX && triangle.maxZ >= bounds.minZ && triangle.minZ <= bounds.maxZ) candidates.add(triangle);
  const dry = [...candidates].filter((triangle) => !triangle.water);
  let supported2 = true;
  for (const water of candidates) {
    if (!water.water) continue;
    let polygon = clip(water.cells, (p) => p.x - bounds.minX);
    polygon = clip(polygon, (p) => bounds.maxX - p.x);
    polygon = clip(polygon, (p) => p.z - bounds.minZ);
    polygon = clip(polygon, (p) => bounds.maxZ - p.z);
    if (!hasArea(polygon)) continue;
    const overlapping = dry.filter((floor) => floor.maxX >= water.minX && floor.minX <= water.maxX && floor.maxZ >= water.minZ && floor.minZ <= water.maxZ);
    if (overlapping.some((floor) => {
      const high = clip(floor.cells, (p) => heightAt(floor, p) - center.point.y - 0.28 - EPSILON2);
      return hasArea(high) && hasArea(intersect(high, polygon));
    })) {
      supported2 = false;
      break;
    }
    if (overlapping.some((floor) => {
      const above = intersect(clip(floor.cells, (p) => heightAt(floor, p) + EPSILON2 - heightAt(water, p)), polygon);
      if (!hasArea(above)) return false;
      const matching = matchingCover(above, floor, water);
      let mismatched = hasArea(matching) ? subtract(above, matching) : [above];
      if (!mismatched.length) return false;
      for (const other2 of overlapping) {
        if (other2 === floor) continue;
        const higher = clip(other2.cells, (p) => heightAt(other2, p) - heightAt(floor, p) - EPSILON2);
        if (hasArea(higher)) mismatched = mismatched.flatMap((piece) => subtract(piece, higher));
        if (!mismatched.length) return false;
      }
      return true;
    })) {
      supported2 = false;
      break;
    }
    let uncovered = [polygon];
    for (const floor of overlapping) {
      let cover = clip(floor.cells, (p) => heightAt(floor, p) + EPSILON2 - heightAt(water, p));
      cover = clip(cover, (p) => heightAt(floor, p) - center.point.y + 0.28 + EPSILON2);
      cover = clip(cover, (p) => center.point.y + 0.28 + EPSILON2 - heightAt(floor, p));
      cover = matchingCover(cover, floor, water);
      if (!hasArea(cover)) continue;
      uncovered = uncovered.flatMap((piece) => subtract(piece, cover));
      if (!uncovered.length) break;
    }
    if (uncovered.length) {
      supported2 = false;
      break;
    }
  }
  if (index.answers.size >= 16384) index.answers.clear();
  index.answers.set(id, supported2);
  return supported2;
}

// src/domain/growingIsland/commands.ts
var growthSeamTrial = () => typeof window !== "undefined" && trialQuery().get("growthTrial") === "inherit";
function fail2(message) {
  throw new Error(message);
}
function claim(state, cell, except, world) {
  if (!onLand(state, cell, world) || world && !hasAuthoredPlacementSupport(world, cell) || !terrainOwnerSupported(state, cell)) fail2("\u3053\u3053\u306B\u306F \u304A\u3051\u306A\u3044\u3088\u3002");
  const found = occupant(state, cell, except);
  if (!found) return;
  if (found.type === "plot" && found.spread) {
    state.plots = state.plots.filter((p) => p.id !== found.id);
    return;
  }
  fail2("\u3053\u3053\u306B\u306F \u3082\u3046 \u3082\u306E\u304C \u3042\u308B\u3088\u3002");
}
function pay(state, price) {
  if (state.drops < price) fail2("\u3057\u305A\u304F\u304C \u3082\u3046\u3059\u3053\u3057 \u3044\u308B\u3088\u3002");
  state.drops -= price;
}
function landStep(state) {
  return (state.land.expanded ? 1 : 0) + state.land.extra.length + state.land.capes.length + (state.land.districts?.length ?? 0);
}
function landQuote(state) {
  const step = landStep(state) + 1;
  if (step === 1) return { step, sides: ["west", "east"], price: LAND_PRICE[0] };
  if (step === 2) return { step, sides: [state.land.expanded === "west" ? "east" : "west"], price: LAND_PRICE[1] };
  if (step === 3) return { step, sides: ["south"], price: LAND_PRICE[2] };
  if (step <= 5 && (state.growth || islandLevel(state) >= CAPE_LEVEL[step - 4])) {
    return { step, sides: ["east", "west"].filter((side) => !state.land.capes.includes(side)), price: LAND_PRICE[step - 1] };
  }
  if (step >= 6) return { step, sides: ["east", "west", "south"], price: LAND_PRICE[4] + DISTRICT_PRICE_STEP * (step - 5) };
}
function expand(state, side) {
  const seamBefore = growthSeamTrial() && state.terrain ? structuredClone(state) : void 0;
  const quote = landQuote(state);
  if (!quote || !quote.sides.includes(side)) fail2("\u3072\u308D\u3052\u308B \u3070\u3057\u3087\u3092 \u3082\u3046\u3044\u3061\u3069 \u3048\u3089\u3093\u3067\u306D\u3002");
  pay(state, quote.price);
  if (quote.step === 1) state.land.expanded = side;
  else if (quote.step <= 3) state.land.extra.push(side);
  else if (quote.step <= 5) state.land.capes.push(side);
  else (state.land.districts ??= []).push(side);
  if (state.growth) state.growth.expanded = true;
  if (seamBefore) inheritGrowthBoundary(seamBefore, state);
  syncSoil(state);
  if (state.bridge) {
    const x = bridgeSite(state);
    if (x === void 0) fail2("\u306F\u3057\u306E \u3070\u3057\u3087\u304C \u306A\u3044\u3088\u3002\u306F\u3057\u3092 \u3057\u307E\u3063\u3066\u304B\u3089 \u3072\u308D\u3052\u3066\u306D\u3002");
    state.bridge.x = x;
  }
}
function find(state, id) {
  return state.plots.find((p) => p.id === id) ?? state.landmarks.find((l) => l.id === id) ?? state.keepsakes.find((k) => k.id === id) ?? fail2("\u307F\u3064\u304B\u3089\u306A\u3044\u3088\u3002");
}
function apply(state, command, world) {
  if (world && !state.terrain && ["expand", "bridge-build", "bridge-remove"].includes(command.type))
    fail2("\u3053\u306E\u5236\u4F5C\u4E2D\u306E\u5CF6\u3067\u306F \u571F\u5730\u3068\u306F\u3057\u306E\u7DE8\u96C6\u3092 \u307E\u3060\u4F7F\u3048\u306A\u3044\u3088\u3002");
  const events = [];
  switch (command.type) {
    case "choose-place-goal": {
      if (command.id !== void 0 && !PLACE_GOAL_IDS.includes(command.id)) fail2("\u3082\u3046\u3044\u3061\u3069 \u3048\u3089\u3093\u3067\u306D\u3002");
      (state.placeProgress ??= newPlaceProgress()).selected = command.id;
      break;
    }
    case "shared-play":
    case "place-used":
    case "place-shown":
      break;
    case "choose-goal": {
      if (!state.guidance || command.id !== void 0 && !ACHIEVEMENTS.includes(command.id)) fail2("\u3082\u3046\u3044\u3061\u3069 \u3048\u3089\u3093\u3067\u306D\u3002");
      state.guidance.selected = command.id;
      state.guidance.starter.automatic = false;
      break;
    }
    case "choose-starter-play": {
      if (!state.guidance || !state.guidance.starter.steps.S3 || state.guidance.starter.steps.S4 || command.id !== "A3" && command.id !== "A4") fail2("\u3082\u3046\u3044\u3061\u3069 \u3048\u3089\u3093\u3067\u306D\u3002");
      state.guidance.selected = command.id;
      break;
    }
    case "starter-guide":
      if (state.guidance) state.guidance.starter.automatic = command.automatic;
      break;
    case "ack-revisit-flower": {
      if (state.guidance?.firstFlower?.id === command.id) state.guidance.firstFlower.seen = true;
      break;
    }
    case "ack-achievements": {
      if (state.guidance) {
        for (const id of command.ids) if (state.guidance.achievements[id] && !state.guidance.notified.includes(id)) state.guidance.notified.push(id);
      }
      break;
    }
    case "concert-started":
    case "learning-returned":
      break;
    case "plant": {
      if (command.kind === "wonder") {
        if (!state.wonderSeeds) fail2("\u3075\u3057\u304E\u306E \u305F\u306D\u304C \u307E\u3060 \u306A\u3044\u3088\u3002");
      } else if (!canPurchase(state, `seed:${command.kind}`)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
      const tutorial = state.tutorial === "first-home" && command.kind === "home";
      if (command.kind === "home" && !canReachHomePlacement(state, command.cell, void 0, world)) fail2("\u3053\u3053\u307E\u3067 \u3044\u3051\u306A\u3044\u307F\u305F\u3044\u3002\u307E\u308F\u308A\u3092 \u3042\u3051\u3066\u307F\u3088\u3046");
      claim(state, command.cell, void 0, world);
      const price = tutorial ? 0 : SEED_PRICE[command.kind];
      pay(state, price);
      const plot = {
        id: `p${state.nextId++}`,
        kind: command.kind,
        cell: { ...command.cell },
        plantedAt: state.town.clock,
        stage: 0,
        growth: 0,
        origin: "seed",
        paid: price
      };
      state.plots.push(plot);
      if (command.kind === "wonder") {
        if (state.growth && state.wonderSeeds <= state.growth.restoredStock.length)
          Object.assign(plot, { restoredWonder: state.growth.restoredStock.shift() });
        state.wonderSeeds = state.wonderSeeds - 1;
      }
      if (tutorial) {
        Object.assign(plot, { stage: 1, builtAt: state.town.clock, stagedAt: state.town.clock, style: styleAt(state, plot.cell, void 0, world) });
        state.unopened.push(plot.id);
        events.push({ type: "built", plotId: plot.id });
        events.push({ type: "arrived", villagerId: welcome(state, state.town.clock, plot, world).id });
        state.tutorial = "done";
        const keys = refreshUnlocks(state);
        if (keys.length) events.push({ type: "unlocked", keys });
      }
      break;
    }
    case "place": {
      if (!canPurchase(state, `landmark:${command.kind}`)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
      const price = LANDMARK_PRICE[command.kind] ?? fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
      let color = command.color;
      if (color !== void 0) {
        const planted = PLANTED_COLORS.find((entry) => entry.color === color);
        if (command.kind !== "flower" || !planted || !cosmeticsOpen(state, planted.level)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
      } else if (command.kind === "flower") color = "red";
      claim(state, command.cell, void 0, world);
      pay(state, price);
      const id = `l${state.nextId++}`;
      state.landmarks.push({ id, kind: command.kind, cell: { ...command.cell }, growth: 0, ...color ? { color } : {} });
      if (command.kind === "flower" && state.guidance && !state.guidance.firstFlower)
        state.guidance.firstFlower = { id, seen: false };
      if (color) noteColor(state, color);
      break;
    }
    case "move": {
      const target2 = find(state, command.id);
      if (!target2.cell) fail2("\u3057\u307E\u3063\u3066\u3042\u308B \u3082\u306E\u306F\u300C\u304A\u304F\u300D\u304B\u3089 \u3048\u3089\u3093\u3067\u306D\u3002");
      if (state.plots.some((p) => p.id === command.id && p.kind === "home") && !canReachHomePlacement(state, command.cell, command.id, world))
        fail2("\u3053\u3053\u307E\u3067 \u3044\u3051\u306A\u3044\u307F\u305F\u3044\u3002\u307E\u308F\u308A\u3092 \u3042\u3051\u3066\u307F\u3088\u3046");
      claim(state, command.cell, command.id, world);
      target2.cell = { ...command.cell };
      break;
    }
    case "store": {
      const plot = state.plots.find((p) => p.id === command.id);
      if (plot?.stage === 0) {
        state.plots = state.plots.filter((p) => p.id !== plot.id);
        state.drops += plot.restoredWonder ? 0 : plot.paid;
        if (plot.restoredWonder && state.growth) state.growth.restoredStock.push(plot.restoredWonder);
        if (plot.kind === "wonder") state.wonderSeeds = (state.wonderSeeds ?? 0) + 1;
        break;
      }
      if (plot?.kind === "home" && occupantsOf(state, plot.id).length) fail2("\u3060\u308C\u304B\u304C \u3059\u3093\u3067\u3044\u308B\u3088\u3002");
      find(state, command.id).cell = void 0;
      break;
    }
    case "unstore": {
      const target2 = find(state, command.id);
      if (target2.cell) fail2("\u3082\u3046 \u304A\u3044\u3066\u3042\u308B\u3088\u3002");
      if (state.plots.some((p) => p.id === command.id && p.kind === "home") && !canReachHomePlacement(state, command.cell, command.id, world))
        fail2("\u3053\u3053\u307E\u3067 \u3044\u3051\u306A\u3044\u307F\u305F\u3044\u3002\u307E\u308F\u308A\u3092 \u3042\u3051\u3066\u307F\u3088\u3046");
      claim(state, command.cell, void 0, world);
      target2.cell = { ...command.cell };
      break;
    }
    case "pluck": {
      const plot = state.plots.find((p) => p.id === command.id && p.kind === "wild" && p.stage > 0) ?? fail2("\u3064\u3081\u306A\u3044\u3088\u3002");
      state.plots = state.plots.filter((p) => p.id !== plot.id);
      break;
    }
    case "expand":
      expand(state, command.side);
      break;
    case "bridge-build": {
      if (state.bridge) fail2("\u306F\u3057\u306F \u3082\u3046 \u3042\u308B\u3088\u3002");
      if (!state.villagers.some((v) => !v.away && !state.arrivals.includes(v.id))) fail2("\u306A\u304B\u307E\u304C \u304D\u3066\u304B\u3089 \u3064\u304F\u308D\u3046\u3002");
      if (!canBuildBridge(state, command.x)) fail2("\u306F\u3057\u3092 \u304B\u3051\u308B \u3070\u3057\u3087\u3092 \u3042\u3051\u3066\u306D\u3002");
      state.bridge = { x: command.x };
      break;
    }
    case "bridge-remove": {
      if (!state.bridge) fail2("\u306F\u3057\u306F \u307E\u3060 \u306A\u3044\u3088\u3002");
      delete state.bridge;
      break;
    }
    case "name": {
      const name = command.name.trim();
      if (!name || [...name].length > 12) fail2("\u306A\u307E\u3048\u306F 1\u301C12\u3082\u3058\u3067 \u3064\u3051\u3066\u306D\u3002");
      if (command.target === "island") state.islandName = name;
      else {
        const villager = state.villagers.find((v) => v.id === command.target) ?? fail2("\u307F\u3064\u304B\u3089\u306A\u3044\u3088\u3002");
        if (isKid(villager.species)) fail2("\u3048\u307E\u3068 \u3048\u3044\u305F\u306E \u306A\u307E\u3048\u306F \u305D\u306E\u307E\u307E\u3060\u3088\u3002");
        villager.name = name;
      }
      break;
    }
    case "paint": {
      if (!Number.isInteger(command.color) || command.color < 0 || command.color > 9) fail2("\u3044\u308D\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
      if (command.target === "flag") state.flagColor = command.color;
      else (state.plots.find((p) => p.id === command.target && p.kind === "home") ?? fail2("\u307F\u3064\u304B\u3089\u306A\u3044\u3088\u3002")).roof = command.color;
      break;
    }
    case "open":
      state.unopened = state.unopened.filter((id) => id !== command.id);
      break;
    case "open-all":
      state.unopened = [];
      state.arrivals = [];
      break;
    case "disembark":
      state.arrivals = state.arrivals.filter((id) => id !== command.id);
      break;
    case "away":
      (state.villagers.find((v) => v.id === command.id) ?? fail2("\u307F\u3064\u304B\u3089\u306A\u3044\u3088\u3002")).away = command.away || void 0;
      break;
    case "dress": {
      const villager = state.villagers.find((v) => v.id === command.id) ?? fail2("\u307F\u3064\u304B\u3089\u306A\u3044\u3088\u3002");
      const outfit = { ...villager.outfit };
      if (command.color !== void 0) {
        if (!cosmeticsOpen(state, STYLE_LEVEL.clothes)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
        if (!Number.isInteger(command.color) || command.color < 0 || command.color > 5) fail2("\u3044\u308D\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
        outfit.color = command.color;
      }
      if (command.hat !== void 0) {
        if (!cosmeticsOpen(state, STYLE_LEVEL.hats)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
        if (!Number.isInteger(command.hat) || command.hat < 0 || command.hat > HATS) fail2("\u307C\u3046\u3057\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
        outfit.hat = command.hat || void 0;
      }
      villager.outfit = outfit.color === void 0 && outfit.hat === void 0 ? void 0 : outfit;
      break;
    }
    case "decorate": {
      const room = { ...DEFAULT_DECOR, ...state.room };
      if (command.pattern !== void 0) {
        if (!patternOpen(command.pattern, state.mastery?.math ?? 0, state.mastery?.vocab ?? 0)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
        room.pattern = command.pattern;
      }
      if (command.rug !== void 0) {
        if (!Number.isInteger(command.rug) || command.rug < 0 || command.rug >= RUG_COLORS.length) fail2("\u3044\u308D\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
        room.rug = command.rug;
      }
      if (command.hidden !== void 0) {
        const ids = new Set(WORD_GROUPS.map((g) => g.id));
        if (command.hidden.some((id) => !ids.has(id))) fail2("\u3044\u308D\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
        room.hidden = [...new Set(command.hidden)];
        if (!room.hidden.length) delete room.hidden;
      }
      state.room = room;
      break;
    }
    case "emblem": {
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(command.image) || command.image.length > 24e3) fail2("\u3082\u3046\u3044\u3061\u3069 \u306A\u305E\u3063\u3066\u306D\u3002");
      if (!/^[0-9A-Za-z]$/.test(command.glyph)) fail2("\u3082\u3046\u3044\u3061\u3069 \u306A\u305E\u3063\u3066\u306D\u3002");
      state.emblem = { image: command.image, glyph: command.glyph };
      break;
    }
    case "ack-moment": {
      if (state.surprise?.pending?.day === command.day) delete state.surprise.pending;
      break;
    }
    case "flag": {
      if (command.color !== void 0) {
        if (!Number.isInteger(command.color) || command.color < 0 || command.color > 7) fail2("\u3044\u308D\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
        state.flagColor = command.color;
      }
      if (command.pattern !== void 0) {
        if (!cosmeticsOpen(state, STYLE_LEVEL.flagPattern)) fail2("\u307E\u3060 \u3048\u3089\u3079\u306A\u3044\u3088\u3002");
        if (!Number.isInteger(command.pattern) || command.pattern < 0 || command.pattern >= FLAG_PATTERNS) fail2("\u3082\u3088\u3046\u3092 \u3048\u3089\u3073\u306A\u304A\u3057\u3066\u306D\u3002");
        state.flagPattern = command.pattern;
      }
      break;
    }
  }
  if (state.bridge && !reachableFromHome(state).has(key(bridgeAnchor(state))))
    fail2("\u306F\u3057\u307E\u3067 \u3044\u3051\u306A\u304F\u306A\u308B\u3088\u3002\u307E\u308F\u308A\u3092 \u3042\u3051\u3066\u306D\u3002");
  return events;
}
function applyIntent(previous, intent, at, world) {
  const __trialTimingToken = trialTimingEnter("applyIntent", intent.command.type);
  let __trialTimingFailed = false;
  try {
    if (previous.applied.includes(intent.id)) return { state: previous, events: [] };
    const state = structuredClone(previous);
    if (intent.command.type === "terrain-edit" || intent.command.type === "terrain-undo" || intent.command.type === "terrain-redo") {
      if (!applyTerrainCommand(state, intent.command)) return { state: previous, events: [] };
      state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
      return { state, events: [] };
    }
    world ??= editableIslandWorld(state);
    const events = apply(state, intent.command, world);
    if (state.terrain) world = editableIslandWorld(state);
    if (["plant", "place", "move", "store", "unstore", "pluck", "expand"].includes(intent.command.type) && state.town.bank > 0)
      events.push(...openTown(state, world));
    noteTownBuilds(state, events);
    noteGuidanceIntent(previous, state, intent.command, intent.id, at);
    const now = at ?? state.nature.realAt;
    if (intent.command.type === "shared-play") recordSharedPlay(state, intent.command, now, world);
    if (intent.command.type === "place-used") recordPlaceUse(state, intent.command, now, world);
    if (intent.command.type === "place-shown") recordPlaceShown(state, intent.command, world);
    events.push(...grantGrowthMilestones(state, now));
    refreshUnlocks(state);
    syncPlaceMilestones(state, now, world);
    if (intent.command.type === "expand" && growthSeamTrial() && state.terrain) validateGrowthOwnerSupport(previous, state);
    state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
    return { state, events };
  } catch (__trialTimingError) {
    __trialTimingFailed = true;
    throw __trialTimingError;
  } finally {
    trialTimingExit(__trialTimingToken, __trialTimingFailed);
  }
}
function canPlace(state, cell, except, world) {
  world ??= editableIslandWorld(state);
  if (!onLand(state, cell, world) || world && !hasAuthoredPlacementSupport(world, cell) || !terrainOwnerSupported(state, cell)) return false;
  if (isVacant(state, cell, except, world)) return true;
  const found = occupant(state, cell, except);
  return found?.type === "plot" && found.spread;
}
function canReachHomePlacement(state, cell, id, world) {
  world ??= editableIslandWorld(state);
  if (!canPlace(state, cell, id, world)) return false;
  const preview = structuredClone(state);
  const home = preview.plots.find((p) => p.id === id);
  if (home) home.cell = cell;
  else preview.plots.push({ id: "placement-preview", kind: "home", cell, stage: 0, plantedAt: 0, growth: 0, origin: "seed", paid: 0 });
  return isReachable(cell, reachableFromHome(preview, void 0, world), world);
}

// src/domain/growingIsland/guidance.ts
var STARTER_STEPS = ["S1", "S2", "S3", "S4", "S5"];
var ACHIEVEMENTS = ["A1", "A2", "A3", "A4", "A5", "A6"];
function newGuidance(automatic) {
  return { version: 1, starter: { automatic, steps: {} }, achievements: {}, notified: [] };
}
var target = (state, id) => state.plots.find((p) => p.id === id) ?? state.landmarks.find((p) => p.id === id) ?? state.keepsakes.find((p) => p.id === id) ?? state.villagers.find((p) => p.id === id);
function evidence(state, source, at, id) {
  const item = id ? target(state, id) : void 0;
  return { source, ...at === void 0 ? {} : { at }, ...id ? { targetId: id } : {}, snapshot: structuredClone({
    flagColor: state.flagColor ?? 0,
    ...item ? { target: item } : {},
    ...source === "legacy" ? { legacy: true } : {}
  }) };
}
function achieve(state, id, proof, silent = false) {
  const g = state.guidance;
  if (g.achievements[id]) return;
  g.achievements[id] = structuredClone(proof);
  if (silent) g.notified.push(id);
}
function noteTownBuilds(state, events) {
  for (const event of events) if (event.type === "built") {
    const p = state.plots.find((plot) => plot.id === event.plotId);
    if (p && !p.starter && p.paid > 0 && p.kind !== "wild" && p.kind !== "wonder" && p.builtAt > p.plantedAt)
      p.townBuilt = true;
  }
}
function noteGuidanceIntent(previous, state, command, source, at) {
  const g = state.guidance;
  if (!g) return;
  const proof = (id) => evidence(state, source, at, id);
  const step = (id, e) => {
    g.starter.steps[id] ??= structuredClone(e);
  };
  if (command.type === "plant" && previous.tutorial === "first-home" && command.kind === "home") {
    const p = state.plots.find((p2) => !previous.plots.some((old) => old.id === p2.id));
    if (p) {
      p.starter = true;
      step("S1", proof(p.id));
    }
  }
  if (command.type === "open" || command.type === "open-all") {
    for (const id of previous.unopened) if (command.type === "open-all" || command.id === id) {
      const p = state.plots.find((p2) => p2.id === id);
      if (!p || !p.cell || p.stage === 0) continue;
      if (p.starter || g.starter.steps.S1?.targetId === id) step("S2", proof(id));
      if (!p.starter && p.townBuilt && p.paid > 0 && p.kind !== "wild" && p.kind !== "wonder") {
        step("S5", proof(id));
        achieve(state, "A2", proof(id));
      }
    }
  }
  if (command.type === "disembark" || command.type === "open-all") {
    for (const id of previous.arrivals) if (command.type === "open-all" || command.id === id) {
      const v = state.villagers.find((v2) => v2.id === id);
      if (!v) continue;
      achieve(state, "A1", proof(id));
      if (v.home === g.starter.steps.S1?.targetId) step("S3", proof(id));
    }
  }
  if (command.type === "paint" || command.type === "flag") {
    const id = command.type === "flag" ? "flag" : command.target;
    const color = command.color;
    const old = id === "flag" ? previous.flagColor ?? 0 : previous.plots.find((p) => p.id === id)?.roof ?? 0;
    if (color !== void 0 && old !== color) achieve(state, "A3", proof(id));
  }
  if (command.type === "move") {
    const old = target(previous, command.id), next = target(state, command.id);
    if (old && next && "cell" in old && "cell" in next && old.cell && next.cell && (old.cell.x !== next.cell.x || old.cell.z !== next.cell.z)) achieve(state, "A4", proof(command.id));
  }
  if (command.type === "expand") {
    const expanded2 = proof();
    expanded2.snapshot.land = structuredClone(state.land);
    achieve(state, "A6", expanded2);
  }
  if (command.type === "concert-started") {
    const band = state.landmarks.find((p) => p.id === command.id && p.kind === "bandstand" && p.cell);
    if (!band) throw new Error("\u3072\u308D\u3070\u3092 \u3082\u3046\u3044\u3061\u3069 \u3048\u3089\u3093\u3067\u306D\u3002");
    achieve(state, "A5", proof(band.id));
  }
  if (command.type === "learning-returned" && g.learning) step("S4", g.learning);
  if (STARTER_STEPS.every((id) => g.starter.steps[id])) g.starter.automatic = false;
}

// src/domain/growingIsland/island.ts
function blank(seed, now) {
  return {
    rules: "growing-island-v1",
    seed,
    drops: 0,
    land: { extra: [], capes: [] },
    plots: [],
    landmarks: [],
    keepsakes: [],
    villagers: [],
    pier: {
      visitor: { ordinal: 0, species: "rabbit", variant: { color: 0, accessory: 0, sparkle: false }, trait: "lively" },
      next: { ordinal: 1, species: "otter", variant: { color: 0, accessory: 0, sparkle: false }, trait: "mellow" },
      rolled: 1,
      dockAt: 0
    },
    town: { clock: 0, bank: 0 },
    nature: { hours: 0, realAt: now, lastSpread: 0 },
    soil: {},
    genki: { current: 0, best: 0 },
    character: "mixed",
    unlocked: [],
    unopened: [],
    arrivals: [],
    tutorial: "done",
    learned: [],
    enrolledAt: now,
    applied: [],
    nextId: 1,
    placeProgress: newPlaceProgress(),
    growth: newGrowth()
  };
}
function seatPier(state, firstFriend) {
  state.pier = {
    visitor: rollVisitor(state, 0, firstFriend ? ["rabbit", "otter"] : void 0),
    next: rollVisitor(state, 1),
    rolled: 1,
    dockAt: state.town.clock
  };
}
function newIsland(profileId, now) {
  const state = blank(profileId, now);
  state.landmarks.push(
    { id: "starter-flower", kind: "flower", cell: { x: 1, z: 2 }, growth: 6 },
    { id: "starter-bench", kind: "bench", cell: { x: 3, z: 3 }, growth: 0 }
  );
  state.tutorial = "first-home";
  state.guidance = newGuidance(true);
  syncSoil(state);
  seatPier(state, true);
  refreshUnlocks(state);
  return state;
}

// docs/design/2026-10-23-place-method-comparison/evidence/expanded-fixture-v2.json
var expanded_fixture_v2_default = {
  state: {
    rules: "growing-island-v1",
    seed: "expanded-comparison-fixture",
    drops: 9160,
    land: {
      extra: [
        "west",
        "south"
      ],
      capes: [],
      expanded: "east"
    },
    plots: [
      {
        id: "p1",
        kind: "home",
        cell: {
          x: 0,
          z: 1
        },
        plantedAt: 0,
        stage: 1,
        growth: 0,
        origin: "seed",
        paid: 0,
        builtAt: 0,
        stagedAt: 0,
        style: "flower",
        starter: true
      }
    ],
    landmarks: [
      {
        id: "starter-flower",
        kind: "flower",
        cell: {
          x: 2,
          z: 3
        },
        growth: 6
      },
      {
        id: "starter-bench",
        kind: "bench",
        cell: {
          x: 2,
          z: 4
        },
        growth: 0
      }
    ],
    keepsakes: [],
    villagers: [
      {
        id: "v2",
        species: "rabbit",
        variant: {
          color: 5,
          accessory: 1,
          sparkle: false
        },
        trait: "mellow",
        home: "p1",
        arrivedAt: 0,
        name: "\u3046\u3055\u3053"
      }
    ],
    pier: {
      visitor: {
        ordinal: 0,
        species: "otter",
        variant: {
          color: 3,
          accessory: 1,
          sparkle: false
        },
        trait: "shy"
      },
      next: {
        ordinal: 1,
        species: "boy",
        variant: {
          color: 1,
          accessory: 1,
          sparkle: false
        },
        trait: "lively"
      },
      rolled: 1,
      dockAt: 0
    },
    town: {
      clock: 8,
      bank: 0
    },
    nature: {
      hours: 0,
      realAt: 1e3,
      lastSpread: 0
    },
    soil: {
      "0,0": 0.2,
      "1,0": 0.2,
      "2,0": 0.2,
      "3,0": 0.2,
      "4,0": 0.2,
      "5,0": 0.2,
      "0,1": 0.2,
      "1,1": 0.2,
      "2,1": 0.2,
      "3,1": 0.2,
      "4,1": 0.2,
      "5,1": 0.2,
      "0,2": 0.2,
      "1,2": 0.2,
      "2,2": 0.2,
      "3,2": 0.2,
      "4,2": 0.2,
      "5,2": 0.2,
      "0,3": 0.2,
      "1,3": 0.2,
      "2,3": 0.2,
      "3,3": 0.2,
      "4,3": 0.2,
      "5,3": 0.2,
      "0,4": 0.2,
      "1,4": 0.2,
      "2,4": 0.2,
      "3,4": 0.2,
      "4,4": 0.2,
      "5,4": 0.2,
      "6,0": 0.2,
      "7,0": 0.2,
      "8,0": 0.2,
      "6,1": 0.2,
      "7,1": 0.2,
      "8,1": 0.2,
      "6,2": 0.2,
      "7,2": 0.2,
      "8,2": 0.2,
      "6,3": 0.2,
      "7,3": 0.2,
      "8,3": 0.2,
      "6,4": 0.2,
      "7,4": 0.2,
      "8,4": 0.2,
      "-3,0": 0.2,
      "-2,0": 0.2,
      "-1,0": 0.2,
      "-3,1": 0.2,
      "-2,1": 0.2,
      "-1,1": 0.2,
      "-3,2": 0.2,
      "-2,2": 0.2,
      "-1,2": 0.2,
      "-3,3": 0.2,
      "-2,3": 0.2,
      "-1,3": 0.2,
      "-3,4": 0.2,
      "-2,4": 0.2,
      "-1,4": 0.2,
      "-3,5": 0.2,
      "-2,5": 0.2,
      "-1,5": 0.2,
      "0,5": 0.2,
      "1,5": 0.2,
      "2,5": 0.2,
      "3,5": 0.2,
      "4,5": 0.2,
      "5,5": 0.2,
      "6,5": 0.2,
      "7,5": 0.2,
      "8,5": 0.2,
      "-3,6": 0.2,
      "-2,6": 0.2,
      "-1,6": 0.2,
      "0,6": 0.2,
      "1,6": 0.2,
      "2,6": 0.2,
      "3,6": 0.2,
      "4,6": 0.2,
      "5,6": 0.2,
      "6,6": 0.2,
      "7,6": 0.2,
      "8,6": 0.2,
      "-3,7": 0.2,
      "-2,7": 0.2,
      "-1,7": 0.2,
      "0,7": 0.2,
      "1,7": 0.2,
      "2,7": 0.2,
      "3,7": 0.2,
      "4,7": 0.2,
      "5,7": 0.2,
      "6,7": 0.2,
      "7,7": 0.2,
      "8,7": 0.2
    },
    genki: {
      current: 0,
      best: 0
    },
    character: "mixed",
    unlocked: [
      "seed:home",
      "landmark:flower",
      "landmark:bench",
      "landmark:water-bowl",
      "landmark:sapling",
      "seed:farm",
      "landmark:water-channel",
      "landmark:picnic-table",
      "landmark:swing",
      "landmark:bandstand",
      "landmark:slide",
      "landmark:postbox",
      "landmark:lantern",
      "landmark:fence",
      "landmark:trampoline",
      "landmark:fountain",
      "landmark:lighthouse"
    ],
    unopened: [],
    arrivals: [],
    tutorial: "first-home",
    learned: [],
    enrolledAt: 1e3,
    applied: [
      "expanded-fixture-0",
      "expanded-fixture-1",
      "expanded-fixture-2",
      "expanded-fixture-3",
      "expanded-fixture-4",
      "expanded-fixture-5",
      "expanded-fixture-6",
      "expanded-fixture-7",
      "expanded-fixture-8",
      "expanded-fixture-9",
      "expanded-fixture-10",
      "expanded-fixture-11",
      "expanded-fixture-12",
      "expanded-fixture-13",
      "expanded-fixture-14",
      "expanded-fixture-15",
      "expanded-fixture-16",
      "expanded-fixture-17",
      "expanded-fixture-18",
      "expanded-fixture-19",
      "expanded-fixture-20",
      "expanded-fixture-21",
      "expanded-fixture-22",
      "expanded-fixture-23",
      "expanded-fixture-24",
      "expanded-fixture-25",
      "expanded-fixture-26",
      "expanded-fixture-27",
      "expanded-fixture-28",
      "expanded-fixture-29",
      "expanded-fixture-30",
      "expanded-fixture-31",
      "expanded-fixture-32",
      "expanded-fixture-33",
      "expanded-fixture-34",
      "expanded-fixture-35",
      "expanded-fixture-36",
      "expanded-fixture-37",
      "expanded-fixture-38",
      "expanded-fixture-39",
      "expanded-fixture-40",
      "expanded-fixture-41",
      "expanded-fixture-42",
      "expanded-fixture-43",
      "expanded-fixture-44",
      "expanded-fixture-45",
      "expanded-fixture-46",
      "expanded-fixture-47",
      "expanded-fixture-48",
      "expanded-fixture-v2-p1-ground"
    ],
    nextId: 1,
    placeProgress: {
      version: 1,
      milestones: {
        P05: {
          at: 1792623259507,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":0,"z":2},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":0,"z":2},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]'
        }
      },
      uses: {
        P05: {
          pokomoko: {
            at: 1792702841555,
            ruleId: "P05",
            anchorId: "starter-flower",
            memberIds: [
              "starter-bench",
              "starter-flower"
            ],
            variant: "flower-path",
            revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
            actorId: "pokomoko",
            targetId: "starter-bench"
          },
          villager: {
            at: 1792702847572,
            ruleId: "P05",
            anchorId: "starter-flower",
            memberIds: [
              "starter-bench",
              "starter-flower"
            ],
            variant: "flower-path",
            revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
            actorId: "v2",
            targetId: "starter-flower:garden"
          }
        }
      },
      shown: {
        P05: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]'
      },
      useHistory: [
        {
          at: 1792623284552,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792623330386,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792623349424,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792623499103,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792623559954,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792624171760,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792624188479,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792624202094,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792624213243,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792700079030,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792700091179,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792700104196,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792700117945,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792700158080,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792700167298,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792700176965,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792700191413,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792700467964,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792700473681,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792700483364,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792700485731,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792701748899,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792701749530,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792701756415,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792701799416,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792702829237,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        },
        {
          at: 1792702833606,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        {
          at: 1792702841555,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
          actorId: "pokomoko",
          targetId: "starter-bench"
        },
        {
          at: 1792702847572,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
          actorId: "v2",
          targetId: "starter-flower:garden"
        }
      ]
    },
    growth: {
      version: 1,
      welcomed: true,
      built: false,
      expanded: true,
      slots: {
        W1: {
          status: "granted",
          at: 1e3,
          reason: "island-milestone"
        },
        W2: {
          status: "available"
        },
        W3: {
          status: "available"
        },
        W4: {
          status: "granted",
          at: 1e3,
          reason: "island-milestone"
        }
      },
      restoredStock: []
    },
    guidance: {
      version: 1,
      starter: {
        automatic: true,
        steps: {}
      },
      achievements: {
        A6: {
          source: "expanded-fixture-0",
          at: 1e3,
          snapshot: {
            flagColor: 0,
            land: {
              extra: [],
              capes: [],
              expanded: "east"
            }
          }
        }
      },
      notified: []
    },
    terrain: {
      version: 1,
      heights: {
        "0,4": -3,
        "5,0": 1,
        "5,2": -1,
        "5,1": -1,
        "1,3": 3,
        "2,3": 3,
        "2,2": 2,
        "3,3": 2,
        "1,4": 3,
        "3,4": 2,
        "2,4": 3,
        "3,2": 1,
        "0,3": 2,
        "1,2": 1,
        "1,5": 3,
        "2,5": 3,
        "3,5": 2,
        "8,4": -1,
        "-2,5": 1,
        "-1,5": 2,
        "0,5": 3,
        "4,5": 1,
        "8,5": -1,
        "-2,6": 1,
        "-1,6": 2,
        "0,6": 3,
        "1,6": 3,
        "2,6": 3,
        "3,6": 2,
        "4,6": 1,
        "8,6": -1,
        "0,7": 2,
        "1,7": 2,
        "2,7": 2
      },
      undo: [
        {
          cell: {
            x: 5,
            z: 0
          },
          before: 3,
          after: 2
        },
        {
          cell: {
            x: 5,
            z: 0
          },
          before: 2,
          after: 1
        },
        {
          cell: {
            x: 5,
            z: 1
          },
          before: -3,
          after: -2
        },
        {
          cell: {
            x: 5,
            z: 1
          },
          before: -2,
          after: -1
        },
        {
          cell: {
            x: 5,
            z: 2
          },
          before: -3,
          after: -2
        },
        {
          cell: {
            x: 5,
            z: 2
          },
          before: -2,
          after: -1
        },
        {
          cell: {
            x: 0,
            z: 3
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 0,
            z: 3
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 1,
            z: 2
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 2,
            z: 2
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 3,
            z: 3
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 3,
            z: 4
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 1,
            z: 3
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 2,
            z: 3
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 1,
            z: 4
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 1,
            z: 4
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 2,
            z: 4
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 6,
            z: 0
          },
          before: 1,
          after: 0
        },
        {
          cell: {
            x: -1,
            z: 1
          },
          before: -1,
          after: 0
        },
        {
          cell: {
            x: 6,
            z: 1
          },
          before: -1,
          after: 0
        },
        {
          cell: {
            x: 6,
            z: 2
          },
          before: -1,
          after: 0
        },
        {
          cell: {
            x: -1,
            z: 3
          },
          before: 2,
          after: 1
        },
        {
          cell: {
            x: -1,
            z: 3
          },
          before: 1,
          after: 0
        },
        {
          cell: {
            x: -1,
            z: 4
          },
          before: -3,
          after: -2
        },
        {
          cell: {
            x: -1,
            z: 4
          },
          before: -2,
          after: -1
        },
        {
          cell: {
            x: -1,
            z: 4
          },
          before: -1,
          after: 0
        },
        {
          cell: {
            x: 8,
            z: 4
          },
          before: 0,
          after: -1
        },
        {
          cell: {
            x: -2,
            z: 5
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: -1,
            z: 5
          },
          before: -3,
          after: -2
        },
        {
          cell: {
            x: -1,
            z: 5
          },
          before: -2,
          after: -1
        },
        {
          cell: {
            x: -1,
            z: 5
          },
          before: -1,
          after: 0
        },
        {
          cell: {
            x: -1,
            z: 5
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: -1,
            z: 5
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 0,
            z: 5
          },
          before: -3,
          after: -2
        },
        {
          cell: {
            x: 0,
            z: 5
          },
          before: -2,
          after: -1
        },
        {
          cell: {
            x: 0,
            z: 5
          },
          before: -1,
          after: 0
        },
        {
          cell: {
            x: 0,
            z: 5
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 0,
            z: 5
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 0,
            z: 5
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 4,
            z: 5
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 8,
            z: 5
          },
          before: 0,
          after: -1
        },
        {
          cell: {
            x: -2,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: -1,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: -1,
            z: 6
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 0,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 0,
            z: 6
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 0,
            z: 6
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 1,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 1,
            z: 6
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 1,
            z: 6
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 2,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 2,
            z: 6
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 2,
            z: 6
          },
          before: 2,
          after: 3
        },
        {
          cell: {
            x: 3,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 3,
            z: 6
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 4,
            z: 6
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 8,
            z: 6
          },
          before: 0,
          after: -1
        },
        {
          cell: {
            x: 0,
            z: 7
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 0,
            z: 7
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 1,
            z: 7
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 1,
            z: 7
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 2,
            z: 7
          },
          before: 0,
          after: 1
        },
        {
          cell: {
            x: 2,
            z: 7
          },
          before: 1,
          after: 2
        },
        {
          cell: {
            x: 0,
            z: 1
          },
          before: -1,
          after: 0
        }
      ],
      redo: []
    },
    wonderSeeds: 2
  },
  fixture: "Expanded v1 plus exactly one ordinary (0,1)+1 command; explicit inherited budget fixture; no DB writes.",
  date: "2026-10-22T21:27:28.221Z",
  parent: {
    path: "evidence/expanded-fixture.json",
    sha256: "88831b1fc67fcb454d6b4d128bcabae1414451f4b39134e84a836dd65eb359ec",
    status: "COMPLETE_VISUAL_BRIEF"
  },
  hashes: {
    "expanded-fixture-v2.ts": "2fbb3438a9698188b9a6c0b5619e389b2c6a8e38bcbfffc9561e5f24a95ebc4d",
    "expanded-fixture-v2.mjs": "6442606ec30216e807930f27f8b7eec21d12bb586bfe26b1f431256a5094ff4a",
    "terrain-transform.mjs": "087f297d4454bcff192340c2fc3fc0f296bbfd9e9641ce5ecbc5d1a4fe4949e4",
    "terrace-convex-field.ts": "9f2ab0880f502ee399866577f8dc041381a60a215ff6cece7a4625c002773ccc",
    "curved-grid.ts": "21535d59d055dad92ef2640334b3587d5fac529d21bdcc5565cf70f7ef279b1d",
    "curved-grid-transform.mjs": "85ee92ca649f26f0286c3036e57e33a1aef990265e440107d74d0b6c8a55cfbc"
  },
  commands: [
    {
      command: {
        type: "expand",
        side: "east"
      },
      accepted: true,
      price: 120
    },
    {
      command: {
        type: "expand",
        side: "west"
      },
      accepted: true,
      price: 240
    },
    {
      command: {
        type: "expand",
        side: "south"
      },
      accepted: true,
      price: 480
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 6,
          z: 0
        },
        delta: -1
      },
      accepted: true,
      before: 1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 1
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 6,
          z: 1
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 6,
          z: 2
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 3
        },
        delta: -1
      },
      accepted: true,
      before: 2,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 3
        },
        delta: -1
      },
      accepted: true,
      before: 1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 4
        },
        delta: 1
      },
      accepted: true,
      before: -3,
      after: -2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 4
        },
        delta: 1
      },
      accepted: true,
      before: -2,
      after: -1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 4
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 8,
          z: 4
        },
        delta: -1
      },
      accepted: true,
      before: 0,
      after: -1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -2,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: -3,
      after: -2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: -2,
      after: -1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: -3,
      after: -2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: -2,
      after: -1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 2,
      after: 3
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 4,
          z: 5
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 8,
          z: 5
        },
        delta: -1
      },
      accepted: true,
      before: 0,
      after: -1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -2,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: -1,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 2,
      after: 3
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 1,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 1,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 1,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 2,
      after: 3
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 2,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 2,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 2,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 2,
      after: 3
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 3,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 3,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 4,
          z: 6
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 8,
          z: 6
        },
        delta: -1
      },
      accepted: true,
      before: 0,
      after: -1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 7
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 7
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 1,
          z: 7
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 1,
          z: 7
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 2,
          z: 7
        },
        delta: 1
      },
      accepted: true,
      before: 0,
      after: 1
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 2,
          z: 7
        },
        delta: 1
      },
      accepted: true,
      before: 1,
      after: 2
    },
    {
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 1
        },
        delta: 1
      },
      accepted: true,
      before: -1,
      after: 0
    }
  ],
  stats: {
    accepted: 50,
    rejected: 0,
    onlyAdditionalHeightChange: "0,1:-1\u21920",
    ownersAndCurrencyUnchanged: true
  },
  physicalChecks: [
    {
      mode: "F",
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 1
        },
        delta: 1
      },
      owners: [
        {
          id: "p1",
          cell: {
            x: 0,
            z: 1
          },
          supported: true,
          physical: {
            samples: 110,
            absent: 0,
            minGap: -0.08010411292092899,
            maxGap: 0.054000000052154065
          }
        },
        {
          id: "starter-flower",
          cell: {
            x: 2,
            z: 3
          },
          supported: true,
          physical: {
            samples: 1152,
            absent: 0,
            minGap: 0.00700000017881397,
            maxGap: 0.06300000004470352
          }
        },
        {
          id: "starter-bench",
          cell: {
            x: 2,
            z: 4
          },
          supported: true,
          physical: {
            samples: 24,
            absent: 0,
            minGap: 0.03405187568220913,
            maxGap: 0.04191250268220903
          }
        }
      ],
      nativeCottage: {
        samples: 1018,
        absent: 0,
        minGap: 0.017600017674267297,
        maxGap: 0.11039999723434447
      },
      cove0_4StillWet: true,
      status: "PHYSICAL_FOOTING_REMAINS",
      limitations: [
        "near-ground source/native mesh vertices; not continuous face collision proof",
        "diagnostic budget inherited; no DB or earned-currency proof",
        "actor snapshots absent; root has separate actual UI53 proof"
      ]
    },
    {
      mode: "H",
      command: {
        type: "terrain-edit",
        cell: {
          x: 0,
          z: 1
        },
        delta: 1
      },
      owners: [
        {
          id: "p1",
          cell: {
            x: 0,
            z: 1
          },
          supported: true,
          physical: {
            samples: 110,
            absent: 0,
            minGap: -0.08211717892092898,
            maxGap: 0.04671046105215407
          }
        },
        {
          id: "starter-flower",
          cell: {
            x: 2,
            z: 3
          },
          supported: true,
          physical: {
            samples: 1152,
            absent: 0,
            minGap: 0.00700000017881397,
            maxGap: 0.07246999129073495
          }
        },
        {
          id: "starter-bench",
          cell: {
            x: 2,
            z: 4
          },
          supported: true,
          physical: {
            samples: 24,
            absent: 0,
            minGap: 0.03133755968220908,
            maxGap: 0.043411385682209036
          }
        }
      ],
      nativeCottage: {
        samples: 1018,
        absent: 0,
        minGap: 0.017600017674267297,
        maxGap: 0.11039999723434447
      },
      cove0_4StillWet: true,
      status: "PHYSICAL_FOOTING_REMAINS",
      limitations: [
        "near-ground source/native mesh vertices; not continuous face collision proof",
        "diagnostic budget inherited; no DB or earned-currency proof",
        "actor snapshots absent; root has separate actual UI53 proof"
      ]
    }
  ],
  status: "PHYSICAL_FOOTING_REMAINS",
  command: "fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/expanded-fixture-v2.mjs"
};

// docs/design/2026-10-23-place-method-comparison/evidence/69-H-wide-shore-final-state.json
var H_wide_shore_final_state_default = {
  candidate: "place-method-H:cardinal-convex-terrace-v2+fixed-two-shear-grid-v1+fixed-core-base-v1+fixed-bilinear-interior-ramp-v1",
  fixture: "expanded-memory-only",
  land: {
    extra: [
      "west",
      "south"
    ],
    capes: [],
    expanded: "east"
  },
  terrain: {
    version: 1,
    heights: {
      "0,4": -3,
      "5,0": 1,
      "5,2": -1,
      "5,1": -1,
      "1,3": 3,
      "2,3": 3,
      "2,2": 2,
      "3,3": 2,
      "1,4": 3,
      "3,4": 3,
      "2,4": 3,
      "3,2": 1,
      "0,3": 2,
      "1,2": 1,
      "1,5": 3,
      "2,5": 3,
      "3,5": 3,
      "8,4": -1,
      "-2,5": 1,
      "-1,5": 2,
      "0,5": 3,
      "4,5": 1,
      "8,5": -1,
      "-2,6": 1,
      "-1,6": 2,
      "0,6": 3,
      "1,6": 3,
      "2,6": 3,
      "3,6": 3,
      "8,6": -1,
      "0,7": 2,
      "1,7": 2,
      "2,7": 2,
      "5,6": -3,
      "5,7": -3,
      "4,7": -3,
      "4,6": -3
    },
    undo: [
      {
        cell: {
          x: 2,
          z: 4
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 6,
          z: 0
        },
        before: 1,
        after: 0
      },
      {
        cell: {
          x: -1,
          z: 1
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: 6,
          z: 1
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: 6,
          z: 2
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: -1,
          z: 3
        },
        before: 2,
        after: 1
      },
      {
        cell: {
          x: -1,
          z: 3
        },
        before: 1,
        after: 0
      },
      {
        cell: {
          x: -1,
          z: 4
        },
        before: -3,
        after: -2
      },
      {
        cell: {
          x: -1,
          z: 4
        },
        before: -2,
        after: -1
      },
      {
        cell: {
          x: -1,
          z: 4
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: 8,
          z: 4
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: -2,
          z: 5
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: -1,
          z: 5
        },
        before: -3,
        after: -2
      },
      {
        cell: {
          x: -1,
          z: 5
        },
        before: -2,
        after: -1
      },
      {
        cell: {
          x: -1,
          z: 5
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: -1,
          z: 5
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: -1,
          z: 5
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 0,
          z: 5
        },
        before: -3,
        after: -2
      },
      {
        cell: {
          x: 0,
          z: 5
        },
        before: -2,
        after: -1
      },
      {
        cell: {
          x: 0,
          z: 5
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: 0,
          z: 5
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 0,
          z: 5
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 0,
          z: 5
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 4,
          z: 5
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 8,
          z: 5
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: -2,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: -1,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: -1,
          z: 6
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 0,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 0,
          z: 6
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 0,
          z: 6
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 1,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 1,
          z: 6
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 1,
          z: 6
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 2,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 2,
          z: 6
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 2,
          z: 6
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 3,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 3,
          z: 6
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 4,
          z: 6
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 8,
          z: 6
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: 0,
          z: 7
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 0,
          z: 7
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 1,
          z: 7
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 1,
          z: 7
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 2,
          z: 7
        },
        before: 0,
        after: 1
      },
      {
        cell: {
          x: 2,
          z: 7
        },
        before: 1,
        after: 2
      },
      {
        cell: {
          x: 0,
          z: 1
        },
        before: -1,
        after: 0
      },
      {
        cell: {
          x: 5,
          z: 6
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: 5,
          z: 6
        },
        before: -1,
        after: -2
      },
      {
        cell: {
          x: 5,
          z: 6
        },
        before: -2,
        after: -3
      },
      {
        cell: {
          x: 5,
          z: 7
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: 5,
          z: 7
        },
        before: -1,
        after: -2
      },
      {
        cell: {
          x: 5,
          z: 7
        },
        before: -2,
        after: -3
      },
      {
        cell: {
          x: 4,
          z: 7
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: 4,
          z: 7
        },
        before: -1,
        after: -2
      },
      {
        cell: {
          x: 4,
          z: 7
        },
        before: -2,
        after: -3
      },
      {
        cell: {
          x: 4,
          z: 6
        },
        before: 1,
        after: 0
      },
      {
        cell: {
          x: 4,
          z: 6
        },
        before: 0,
        after: -1
      },
      {
        cell: {
          x: 4,
          z: 6
        },
        before: -1,
        after: -2
      },
      {
        cell: {
          x: 4,
          z: 6
        },
        before: -2,
        after: -3
      },
      {
        cell: {
          x: 3,
          z: 4
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 3,
          z: 6
        },
        before: 2,
        after: 3
      },
      {
        cell: {
          x: 3,
          z: 5
        },
        before: 2,
        after: 3
      }
    ],
    redo: []
  },
  plots: [
    {
      id: "p1",
      kind: "home",
      cell: {
        x: 0,
        z: 1
      },
      plantedAt: 0,
      stage: 1,
      growth: 0,
      origin: "seed",
      paid: 0,
      builtAt: 0,
      stagedAt: 0,
      style: "flower",
      starter: true
    }
  ],
  landmarks: [
    {
      id: "starter-flower",
      kind: "flower",
      cell: {
        x: 2,
        z: 5
      },
      growth: 6
    },
    {
      id: "starter-bench",
      kind: "bench",
      cell: {
        x: 1,
        z: 6
      },
      growth: 0
    }
  ],
  keepsakes: [],
  villagers: [
    {
      id: "v2",
      species: "rabbit",
      variant: {
        color: 5,
        accessory: 1,
        sparkle: false
      },
      trait: "mellow",
      home: "p1",
      arrivedAt: 0,
      name: "\u3046\u3055\u3053"
    }
  ],
  character: "mixed",
  drops: 9160,
  town: {
    clock: 8,
    bank: 0
  },
  placeProgress: {
    version: 1,
    milestones: {
      P05: {
        at: 1792623259507,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":0,"z":2},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":0,"z":2},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]'
      }
    },
    uses: {
      P05: {
        pokomoko: {
          at: 1792705208200,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
          actorId: "pokomoko",
          targetId: "starter-flower:garden"
        },
        villager: {
          at: 1792705208194,
          ruleId: "P05",
          anchorId: "starter-flower",
          memberIds: [
            "starter-bench",
            "starter-flower"
          ],
          variant: "flower-path",
          revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
          actorId: "v2",
          targetId: "starter-bench"
        }
      }
    },
    shown: {
      P05: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]'
    },
    useHistory: [
      {
        at: 1792623284552,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792623330386,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792623349424,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792623499103,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792623559954,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":3,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":1.5,"z":2.5},{"x":1,"z":3},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792624171760,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792624188479,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792624202094,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792624213243,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",1,2]],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[{"x":1,"z":1},{"x":1,"z":1.5},{"x":1.5,"z":1.5},{"x":0,"z":2},{"x":0.5,"z":2},{"x":1,"z":2},{"x":1.5,"z":2},{"x":2,"z":2},{"x":0,"z":3},{"x":2,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792700079030,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792700091179,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792700104196,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792700117945,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":1,"z":2},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2.5,"z":2.5},{"x":3,"z":2.5},{"x":3.5,"z":2.5},{"x":0,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":1,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792700158080,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792700167298,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792700176965,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792700191413,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792700467964,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792700473681,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792700483364,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792700485731,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",3,3],["starter-flower",3,2]],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":4,"z":2},{"x":2,"z":3},{"x":3,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[{"x":3,"z":1},{"x":2.5,"z":1.5},{"x":3,"z":1.5},{"x":3.5,"z":1.5},{"x":2,"z":2},{"x":2.5,"z":2},{"x":3,"z":2},{"x":3.5,"z":2},{"x":2,"z":3},{"x":4,"z":3},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":3,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":3,"z":2}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792701748899,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792701749530,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792701756415,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792701799416,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,3],["starter-flower",1,3]],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0,"z":3},{"x":0.5,"z":3},{"x":1,"z":3},{"x":2,"z":3},{"x":3,"z":3},{"x":0.5,"z":3.5},{"x":1,"z":3.5},{"x":1,"z":4},{"x":2,"z":4}],[{"x":1,"z":2},{"x":2,"z":2},{"x":0.5,"z":2.5},{"x":1,"z":2.5},{"x":0.5,"z":3},{"x":1,"z":3},{"x":3,"z":3},{"x":1,"z":3.5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":3}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":1,"z":3}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792702829237,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792702833606,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792702841555,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792702847572,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":3,"z":4}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792705072510,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4},{"x":2,"z":5}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":3,"z":4},{"x":2,"z":5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792705074259,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",2,4],["starter-flower",2,3]],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":1,"z":4},{"x":2,"z":4},{"x":3,"z":4},{"x":2,"z":5}],[{"x":2,"z":2},{"x":1.5,"z":2.5},{"x":2,"z":2.5},{"x":2.5,"z":2.5},{"x":1,"z":3},{"x":1.5,"z":3},{"x":2,"z":3},{"x":2.5,"z":3},{"x":3,"z":3},{"x":3,"z":4},{"x":2,"z":5}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":2,"z":4}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":3}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792705143776,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
        actorId: "v2",
        targetId: "starter-flower:garden"
      },
      {
        at: 1792705152175,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
        actorId: "pokomoko",
        targetId: "starter-bench"
      },
      {
        at: 1792705208194,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
        actorId: "v2",
        targetId: "starter-bench"
      },
      {
        at: 1792705208200,
        ruleId: "P05",
        anchorId: "starter-flower",
        memberIds: [
          "starter-bench",
          "starter-flower"
        ],
        variant: "flower-path",
        revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
        actorId: "pokomoko",
        targetId: "starter-flower:garden"
      }
    ]
  },
  places: [
    {
      id: "P05:starter-flower",
      ruleId: "P05",
      revision: '[1,"P05","flower-path","grown",[["starter-bench",1,6],["starter-flower",2,5]],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":1,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[{"x":2,"z":4},{"x":1.5,"z":4.5},{"x":2,"z":4.5},{"x":2.5,"z":4.5},{"x":1,"z":5},{"x":1.5,"z":5},{"x":2,"z":5},{"x":2.5,"z":5},{"x":3,"z":5},{"x":2,"z":5.5},{"x":2.5,"z":5.5},{"x":0,"z":6},{"x":2,"z":6},{"x":1,"z":7}],[],[{"id":"starter-bench","kind":"seat","cell":{"x":1,"z":6}},{"id":"starter-flower:garden","kind":"garden","cell":{"x":2,"z":5}}]]',
      stage: "grown",
      useTargets: [
        {
          id: "starter-bench",
          kind: "seat",
          cell: {
            x: 1,
            z: 6
          }
        },
        {
          id: "starter-flower:garden",
          kind: "garden",
          cell: {
            x: 2,
            z: 5
          }
        }
      ]
    }
  ]
};

// docs/design/2026-10-23-place-method-comparison/memo-samples-check.ts
var hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
var fields = ["land", "terrain", "plots", "landmarks", "villagers", "keepsakes", "placeProgress", "town", "drops", "character"];
var shore = { ...newIsland("memo-shore", 1e3), ...structuredClone(Object.fromEntries(fields.map((field) => [field, H_wide_shore_final_state_default[field]]))) };
var expanded = structuredClone(expanded_fixture_v2_default.state);
var fresh = newIsland("memo-fresh", 1e3);
fresh.terrain = { version: 1, heights: {}, undo: [], redo: [] };
var extreme = structuredClone(fresh);
extreme.terrain.heights = { "0,3": -4, "1,3": -4, "5,0": 12, "4,0": 12 };
var bridge = structuredClone(fresh);
bridge.bridge = { x: 1 };
globalThis.__memoSamplesCounts = {};
var pureCalls = 0;
var exact = globalThis.__memoSamplesFactory((p) => {
  pureCalls++;
  return Object.is(p.x, -0) ? -0 : p.x;
});
assert(Object.is(exact({ x: -0, z: 0 }), -0));
assert(Object.is(exact({ x: 0, z: 0 }), 0));
assert.equal(exact({ x: 1, z: 0 }), 1);
assert.equal(exact({ x: 1 + Number.EPSILON, z: 0 }), 1 + Number.EPSILON);
assert.equal(exact({ x: 1, z: -0 }), 1);
exact({ x: -0, z: 0 });
exact({ x: 1 + Number.EPSILON, z: 0 });
assert.equal(pureCalls, 5, "Do not quantize doubles or merge either axis signed zero");
var other = globalThis.__memoSamplesFactory((p) => p.x + 5);
assert.equal(other({ x: 1, z: 0 }), 6, "Factories must not share previous inputs");
var reports = [];
for (const [name, state] of [["initial30", fresh], ["expanded96", expanded], ["shore96", shore], ["signed-extreme30", extreme], ["bridge30", bridge]]) {
  const before = JSON.stringify(state);
  globalThis.__memoSamplesCounts = {};
  globalThis.gc?.();
  const beforeHeap = process.memoryUsage().heapUsed, start = performance.now();
  const world = editableIslandWorld(state);
  const coldMs = performance.now() - start;
  const heapAfterCold = process.memoryUsage().heapUsed;
  globalThis.gc?.();
  const heapAfterGc = process.memoryUsage().heapUsed, counts = { ...globalThis.__memoSamplesCounts };
  const bounds = landBounds(state), queries = [];
  for (let z = -8; z <= bounds.depth * 4 + 8; z++) for (let x = bounds.minX * 4 - 8; x <= bounds.maxX * 4 + 8; x++) {
    const cell = { x: x / 4, z: z / 4 }, floor = world.floorAt(cell);
    queries.push([
      cell,
      floor,
      world.anchorFloorAt(cell),
      world.anchorAt(cell),
      world.owns(cell),
      world.shoreApproachCells(cell),
      ...world.floors.flatMap((f) => [world.floorAt(cell, f.id), world.sampleFloorAt(cell, f.id)]),
      floor && world.logicalAt(floor.point),
      floor && world.siteAt(floor.point)
    ]);
  }
  const graph = [], routes = [], all = new Set(world.sites.map((s2) => `${s2.cell.x},${s2.cell.z}`));
  const narrowed = new Set([...all].filter((_, i) => i % 7 !== 0));
  for (const site of world.sites) for (const passage of ["walk", "join", "water"]) {
    const neighbors2 = world.neighbors(site.cell, passage);
    graph.push([site.cell, passage, neighbors2, ...neighbors2.map((next) => world.isWalkEdgeSupported(site.cell, next))]);
  }
  for (const from of world.sites.filter((_, i) => i % Math.max(1, Math.floor(world.sites.length / 4)) === 0))
    for (const to of world.sites) for (const passage of ["walk", "join", "water"])
      for (const open of [all, narrowed]) routes.push([from.cell, to.cell, passage, open === all, world.route(from.cell, to.cell, open, passage)]);
  assert.equal(JSON.stringify(state), before);
  assert.strictEqual(editableIslandWorld(state), world, "Warm world cache identity is unchanged");
  const commands = [];
  let accepted = false;
  for (const cell of [{ x: 4, z: 4 }, { x: 1, z: 3 }, { x: 0, z: 4 }, { x: 4, z: 3 }]) {
    const command = { type: "terrain-edit", cell, delta: 1 };
    try {
      const changed = applyIntent(state, { id: `memo-${name}-edit`, command }, 8e3).state;
      const undone = applyIntent(changed, { id: `memo-${name}-undo`, command: { type: "terrain-undo" } }, 8001).state;
      const redone = applyIntent(undone, { id: `memo-${name}-redo`, command: { type: "terrain-redo" } }, 8002).state;
      const nonzero = (s2) => Object.fromEntries(Object.entries(s2.terrain.heights).filter(([, value]) => value !== 0));
      assert.deepEqual(nonzero(undone), nonzero(state));
      assert.deepEqual(redone.terrain, changed.terrain);
      commands.push({
        command,
        accepted: true,
        hashes: [changed, undone, redone].map(hash),
        worldHashes: [changed, undone, redone].map((s2) => hash(editableIslandWorld(s2).definition))
      });
      accepted = true;
      break;
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      commands.push({ command, accepted: false, reason: String(error) });
    }
  }
  if (terrainMethod() === "H" && ["initial30", "shore96", "bridge30"].includes(name))
    assert(accepted, `${name}: at least one ordinary edit/undo/redo cycle must succeed: ${JSON.stringify(commands)}`);
  const protectedCommand = { type: "terrain-edit", cell: { x: 4, z: 4 }, delta: -1, actors: [{ x: 4, z: 4 }] };
  try {
    const result = applyIntent(state, { id: `memo-${name}-actor`, command: protectedCommand }, 8003);
    commands.push({ protectedCommand, accepted: true, hash: hash(result) });
  } catch (error) {
    commands.push({ protectedCommand, accepted: false, reason: String(error) });
  }
  assert.equal(JSON.stringify(state), before);
  reports.push({
    name,
    coldMs,
    counts,
    heapBytes: {
      before: beforeHeap,
      afterCold: heapAfterCold,
      afterGc: heapAfterGc,
      coldDelta: heapAfterCold - beforeHeap,
      retainedDelta: heapAfterGc - beforeHeap
    },
    hashes: {
      definition: hash(world.definition),
      floors: hash(world.floors),
      anchors: hash(world.anchorFloors),
      surfaces: hash(world.surfaces),
      sites: hash(world.sites),
      walkSites: hash(world.walkSites),
      bounds: hash(world.bounds),
      queries: hash(queries),
      graphs: hash(graph),
      routes: hash(routes),
      commands: hash(commands)
    },
    queries: queries.length,
    routes: routes.length,
    ordinaryCycleAccepted: accepted,
    commands
  });
}
console.log(JSON.stringify({
  reports,
  pureChecks: { signedZero: true, adjacentDoubles: true, separateFactories: true },
  scope: "Node with actual browser flag branches. CPU and heap observations include diagnostic counters; afterCold heap is not a peak measurement. No browser/GPU claim."
}));
