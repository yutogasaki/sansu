/**
 * G0 whitebox: 数のスイカ
 *
 * 元ネタはスイカゲームの「落とす位置だけが入力」と2048の「同じものが合体」。
 * 合体結果を次の果物ではなく **量の和** にすることで、算数を演出ではなく操作にする。
 *
 * 規則は数の種類に依らず一つだけ。
 *
 * - 触れた2つの量の和が目標量以下なら合体して和になる
 * - 和がちょうど目標量なら弾けて消える（解放）
 * - 和が目標量を超えるなら合体しない（積み上がる）
 *
 * 整数（目標10）、小数（目標1）、分数（目標1）は同じ規則の別profileであり、
 * 整数専用として作ってから小数・分数を後付けしない。
 *
 * production挙動は上書きしない。ここはdev専用ラボのための純粋ドメイン。
 */
import {
    addQuantity,
    compareQuantity,
    createQuantity,
    quantityKey,
    quantityRatio,
    type SuikaDisplay,
    type SuikaQuantity,
} from "./suikaQuantity";

export const G0_SUIKA_EXPERIMENT_ID = "g0-number-suika-v1" as const;

export const SUIKA_WORLD_WIDTH = 100;
export const SUIKA_WORLD_HEIGHT = 150;
export const SUIKA_SPAWN_Y = 11;
export const SUIKA_DEAD_LINE_Y = 26;

const FIXED_DT_MS = 1000 / 120;
const MAX_SUBSTEPS_PER_FRAME = 8;
const GRAVITY = 220;
const AIR_DAMPING = 0.998;
const CONTACT_FRICTION = 0.92;
const CONSTRAINT_ITERATIONS = 8;
const POP_HOLD_MS = 240;
const FLASH_MS = 220;
const REJECT_FLASH_MS = 260;
const REJECT_IMPACT_SPEED = 0.25;
const CHAIN_WINDOW_MS = 620;
const SETTLE_GRACE_MS = 700;
const OVERFLOW_GRACE_MS = 1400;
const BASE_DROP_COOLDOWN_MS = 320;
const QUICK_DROP_COOLDOWN_MS = 200;
const POP_IMPULSE = 2.4;
const POP_SCORE = 100;
const RADIUS_MIN = 4.6;
const RADIUS_SPAN = 9.2;

/** 目標量に対する割合から半径を決める。0.5も1/2も5/10も同じ大きさになる。 */
export const getSuikaRadiusFromRatio = (ratio: number): number => (
    RADIUS_MIN + RADIUS_SPAN * Math.min(1, Math.max(0, ratio))
);

export const getSuikaBallRadius = (
    quantity: SuikaQuantity,
    target: SuikaQuantity,
): number => getSuikaRadiusFromRatio(quantityRatio(quantity, target));

/* ------------------------------------------------------------------ */
/* profile（数の種類）                                                 */
/* ------------------------------------------------------------------ */

export const G0_SUIKA_PROFILE_IDS = ["tens", "decimal", "fraction"] as const;

export type G0SuikaProfileId = typeof G0_SUIKA_PROFILE_IDS[number];

export interface G0SuikaPoolEntry {
    quantity: SuikaQuantity;
    weight: number;
    smallWeight: number;
}

export interface G0SuikaProfile {
    id: G0SuikaProfileId;
    label: string;
    shortLabel: string;
    display: SuikaDisplay;
    target: SuikaQuantity;
    pool: readonly G0SuikaPoolEntry[];
    /** この操作が何を練習させるのかの覚書。production skill IDの正本ではない。 */
    skillHint: string;
}

const poolEntry = (
    n: number,
    d: number,
    weight: number,
    smallWeight: number,
): G0SuikaPoolEntry => ({ quantity: createQuantity(n, d), weight, smallWeight });

export const G0_SUIKA_PROFILES: Record<G0SuikaProfileId, G0SuikaProfile> = {
    tens: {
        id: "tens",
        label: "10をつくる",
        shortLabel: "せいすう",
        display: "integer",
        target: createQuantity(10),
        pool: [
            poolEntry(1, 1, 4, 6),
            poolEntry(2, 1, 4, 6),
            poolEntry(3, 1, 3, 3),
            poolEntry(4, 1, 3, 2),
            poolEntry(5, 1, 2, 1),
        ],
        skillHint: "compose_10 / add_1d_* / add_2d1d_make10 / sub_2d1d_back_add",
    },
    decimal: {
        id: "decimal",
        label: "1をつくる（小数）",
        shortLabel: "しょうすう",
        display: "decimal",
        target: createQuantity(1),
        pool: [
            poolEntry(1, 10, 4, 6),
            poolEntry(2, 10, 4, 6),
            poolEntry(3, 10, 3, 3),
            poolEntry(4, 10, 3, 2),
            poolEntry(5, 10, 2, 1),
        ],
        skillHint: "dec_place_value / dec_add / dec_sub / scale_10x",
    },
    fraction: {
        id: "fraction",
        label: "1をつくる（分数）",
        shortLabel: "ぶんすう",
        display: "fraction",
        target: createQuantity(1),
        pool: [
            poolEntry(1, 6, 4, 6),
            poolEntry(1, 4, 4, 5),
            poolEntry(1, 3, 3, 3),
            poolEntry(1, 2, 2, 1),
        ],
        skillHint: "frac_part_whole / frac_equiv_visual / frac_add_same / frac_add_diff",
    },
};

export const isG0SuikaProfileId = (
    value: string,
): value is G0SuikaProfileId => (
    (G0_SUIKA_PROFILE_IDS as readonly string[]).includes(value)
);

/* ------------------------------------------------------------------ */
/* おまもり（run間で貯まるローグライト層）                             */
/* ------------------------------------------------------------------ */

export const G0_SUIKA_CHARM_IDS = [
    "small-hands",
    "wide-vessel",
    "pop-blast",
    "far-sight",
    "quick-hand",
] as const;

export type G0SuikaCharmId = typeof G0_SUIKA_CHARM_IDS[number];

export interface G0SuikaCharmDefinition {
    id: G0SuikaCharmId;
    label: string;
    detail: string;
    glyph: string;
}

export const G0_SUIKA_CHARMS: Record<G0SuikaCharmId, G0SuikaCharmDefinition> = {
    "small-hands": {
        id: "small-hands",
        label: "ちいさいて",
        detail: "ちいさい たまが よく でる",
        glyph: "·",
    },
    "wide-vessel": {
        id: "wide-vessel",
        label: "ひろいうつわ",
        detail: "うつわが ひろくなる",
        glyph: "⌣",
    },
    "pop-blast": {
        id: "pop-blast",
        label: "はじけるちから",
        detail: "そろったとき つよく とばす",
        glyph: "★",
    },
    "far-sight": {
        id: "far-sight",
        label: "さきよみ",
        detail: "つぎの つぎまで みえる",
        glyph: "◇",
    },
    "quick-hand": {
        id: "quick-hand",
        label: "はやおとし",
        detail: "つづけて はやく おとせる",
        glyph: "»",
    },
};

export const isG0SuikaCharmId = (value: string): value is G0SuikaCharmId => (
    (G0_SUIKA_CHARM_IDS as readonly string[]).includes(value)
);

/* ------------------------------------------------------------------ */
/* 型                                                                  */
/* ------------------------------------------------------------------ */

export interface G0SuikaBall {
    id: string;
    quantity: SuikaQuantity;
    radius: number;
    x: number;
    y: number;
    px: number;
    py: number;
    bornAtMs: number;
    popAtMs: number | null;
    flashUntilMs: number;
    rejectUntilMs: number;
}

export type G0SuikaEventKind = "merge" | "target-pop" | "reject";

export interface G0SuikaEvent {
    id: string;
    kind: G0SuikaEventKind;
    left: SuikaQuantity;
    right: SuikaQuantity;
    result: SuikaQuantity;
    x: number;
    y: number;
    chainDepth: number;
    scoreGained: number;
    atMs: number;
}

export type G0SuikaRunStatus = "playing" | "over";

export interface G0SuikaRunState {
    runId: string;
    runOrdinal: number;
    profileId: G0SuikaProfileId;
    target: SuikaQuantity;
    status: G0SuikaRunStatus;
    charms: readonly G0SuikaCharmId[];
    worldWidth: number;
    simTimeMs: number;
    accumulatorMs: number;
    rngState: number;
    ballCounter: number;
    eventCounter: number;
    balls: G0SuikaBall[];
    queue: SuikaQuantity[];
    aimX: number;
    lastDropAtMs: number | null;
    score: number;
    dropCount: number;
    mergeCount: number;
    targetPopCount: number;
    bestChain: number;
    chainDepth: number;
    chainUntilMs: number;
    overflowSinceMs: number | null;
    endedAtMs: number | null;
    events: G0SuikaEvent[];
    /** そのrunで実際に成立した式。どの関係を触ったかの記録。 */
    seenRecipes: string[];
}

export interface G0SuikaRunSummary {
    runId: string;
    runOrdinal: number;
    profileId: G0SuikaProfileId;
    durationMs: number;
    score: number;
    dropCount: number;
    targetPopCount: number;
    bestChain: number;
    recipeCount: number;
    charms: readonly G0SuikaCharmId[];
}

export interface G0SuikaSession {
    sessionSeed: string;
    profileId: G0SuikaProfileId;
    run: G0SuikaRunState;
    history: G0SuikaRunSummary[];
    charms: readonly G0SuikaCharmId[];
    charmOffer: readonly G0SuikaCharmId[];
    replayStarts: number;
    profileSwitches: number;
    offerRngState: number;
}

/* ------------------------------------------------------------------ */
/* 乱数（seed固定・決定論）                                             */
/* ------------------------------------------------------------------ */

const hashSeed = (seed: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

interface RandomDraw {
    value: number;
    state: number;
}

const nextRandom = (state: number): RandomDraw => {
    const next = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(next ^ (next >>> 15), 1 | next);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296, state: next };
};

interface QuantityDraw {
    quantity: SuikaQuantity;
    state: number;
}

const drawQuantity = (
    state: number,
    profile: G0SuikaProfile,
    charms: readonly G0SuikaCharmId[],
): QuantityDraw => {
    const useSmall = charms.includes("small-hands");
    const weightOf = (entry: G0SuikaPoolEntry) => (
        useSmall ? entry.smallWeight : entry.weight
    );
    const total = profile.pool.reduce(
        (sum, entry) => sum + weightOf(entry),
        0,
    );
    const draw = nextRandom(state);
    let cursor = draw.value * total;

    for (const entry of profile.pool) {
        cursor -= weightOf(entry);
        if (cursor < 0) return { quantity: entry.quantity, state: draw.state };
    }
    return {
        quantity: profile.pool[profile.pool.length - 1].quantity,
        state: draw.state,
    };
};

/* ------------------------------------------------------------------ */
/* おまもり効果                                                        */
/* ------------------------------------------------------------------ */

export const getSuikaWorldWidth = (
    charms: readonly G0SuikaCharmId[],
): number => (
    charms.includes("wide-vessel")
        ? SUIKA_WORLD_WIDTH * 1.14
        : SUIKA_WORLD_WIDTH
);

export const getSuikaPreviewLength = (
    charms: readonly G0SuikaCharmId[],
): number => (charms.includes("far-sight") ? 3 : 2);

export const getSuikaDropCooldownMs = (
    charms: readonly G0SuikaCharmId[],
): number => (
    charms.includes("quick-hand")
        ? QUICK_DROP_COOLDOWN_MS
        : BASE_DROP_COOLDOWN_MS
);

/* ------------------------------------------------------------------ */
/* run生成                                                             */
/* ------------------------------------------------------------------ */

const QUEUE_LENGTH = 4;

export const createG0SuikaRun = (
    sessionSeed: string,
    runOrdinal = 0,
    charms: readonly G0SuikaCharmId[] = [],
    profileId: G0SuikaProfileId = "tens",
): G0SuikaRunState => {
    const profile = G0_SUIKA_PROFILES[profileId];
    const worldWidth = getSuikaWorldWidth(charms);
    let rngState = hashSeed(`${sessionSeed}:${profileId}:run-${runOrdinal}`);
    const queue: SuikaQuantity[] = [];

    for (let index = 0; index < QUEUE_LENGTH; index += 1) {
        const draw = drawQuantity(rngState, profile, charms);
        queue.push(draw.quantity);
        rngState = draw.state;
    }

    return {
        runId: `${G0_SUIKA_EXPERIMENT_ID}:${profileId}:run-${runOrdinal}`,
        runOrdinal,
        profileId,
        target: profile.target,
        status: "playing",
        charms,
        worldWidth,
        simTimeMs: 0,
        accumulatorMs: 0,
        rngState,
        ballCounter: 0,
        eventCounter: 0,
        balls: [],
        queue,
        aimX: worldWidth / 2,
        lastDropAtMs: null,
        score: 0,
        dropCount: 0,
        mergeCount: 0,
        targetPopCount: 0,
        bestChain: 0,
        chainDepth: 0,
        chainUntilMs: 0,
        overflowSinceMs: null,
        endedAtMs: null,
        events: [],
        seenRecipes: [],
    };
};

export const createG0SuikaSession = (
    sessionSeed: string = G0_SUIKA_EXPERIMENT_ID,
    profileId: G0SuikaProfileId = "tens",
): G0SuikaSession => ({
    sessionSeed,
    profileId,
    run: createG0SuikaRun(sessionSeed, 0, [], profileId),
    history: [],
    charms: [],
    charmOffer: [],
    replayStarts: 0,
    profileSwitches: 0,
    offerRngState: hashSeed(`${sessionSeed}:charm-offer`),
});

/* ------------------------------------------------------------------ */
/* 物理（Verlet・固定ステップ・決定論）                                  */
/* ------------------------------------------------------------------ */

const integrate = (balls: G0SuikaBall[], dtSec: number): void => {
    const accel = GRAVITY * dtSec * dtSec;
    for (const ball of balls) {
        const vx = (ball.x - ball.px) * AIR_DAMPING;
        const vy = (ball.y - ball.py) * AIR_DAMPING;
        ball.px = ball.x;
        ball.py = ball.y;
        ball.x += vx;
        ball.y += vy + accel;
    }
};

const applyWalls = (balls: G0SuikaBall[], worldWidth: number): void => {
    for (const ball of balls) {
        const minX = ball.radius;
        const maxX = worldWidth - ball.radius;
        const maxY = SUIKA_WORLD_HEIGHT - ball.radius;

        if (ball.x < minX) {
            ball.x = minX;
            ball.py = ball.y - (ball.y - ball.py) * CONTACT_FRICTION;
        } else if (ball.x > maxX) {
            ball.x = maxX;
            ball.py = ball.y - (ball.y - ball.py) * CONTACT_FRICTION;
        }

        if (ball.y > maxY) {
            ball.y = maxY;
            ball.px = ball.x - (ball.x - ball.px) * CONTACT_FRICTION;
        }
    }
};

const separatePairs = (balls: G0SuikaBall[]): void => {
    for (let i = 0; i < balls.length; i += 1) {
        const a = balls[i];
        for (let j = i + 1; j < balls.length; j += 1) {
            const b = balls[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDistance = a.radius + b.radius;
            const squared = dx * dx + dy * dy;
            if (squared >= minDistance * minDistance) continue;

            const distance = Math.sqrt(squared) || 0.0001;
            const overlap = (minDistance - distance) * 0.5;
            const nx = dx / distance;
            const ny = dy / distance;
            const massA = b.radius / minDistance;
            const massB = a.radius / minDistance;

            a.x -= nx * overlap * 2 * massA;
            a.y -= ny * overlap * 2 * massA;
            b.x += nx * overlap * 2 * massB;
            b.y += ny * overlap * 2 * massB;
        }
    }
};

const solveConstraints = (balls: G0SuikaBall[], worldWidth: number): void => {
    for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration += 1) {
        separatePairs(balls);
        applyWalls(balls, worldWidth);
    }
};

/* ------------------------------------------------------------------ */
/* 合体ルール                                                          */
/* ------------------------------------------------------------------ */

export const canSuikaMerge = (
    left: SuikaQuantity,
    right: SuikaQuantity,
    target: SuikaQuantity,
): boolean => compareQuantity(addQuantity(left, right), target) <= 0;

export const isSuikaTargetHit = (
    left: SuikaQuantity,
    right: SuikaQuantity,
    target: SuikaQuantity,
): boolean => compareQuantity(addQuantity(left, right), target) === 0;

export const getSuikaRecipeKey = (
    left: SuikaQuantity,
    right: SuikaQuantity,
): string => {
    const [first, second] = compareQuantity(left, right) <= 0
        ? [left, right]
        : [right, left];
    return `${quantityKey(first)}+${quantityKey(second)}`;
};

interface ContactPair {
    a: G0SuikaBall;
    b: G0SuikaBall;
    overlap: number;
    approachSpeed: number;
}

const collectContacts = (balls: G0SuikaBall[]): ContactPair[] => {
    const contacts: ContactPair[] = [];
    for (let i = 0; i < balls.length; i += 1) {
        const a = balls[i];
        if (a.popAtMs !== null) continue;
        for (let j = i + 1; j < balls.length; j += 1) {
            const b = balls[j];
            if (b.popAtMs !== null) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDistance = a.radius + b.radius;
            const squared = dx * dx + dy * dy;
            if (squared > minDistance * minDistance) continue;

            const distance = Math.sqrt(squared) || 0.0001;
            const nx = dx / distance;
            const ny = dy / distance;
            const relativeVx = (b.x - b.px) - (a.x - a.px);
            const relativeVy = (b.y - b.py) - (a.y - a.py);

            contacts.push({
                a,
                b,
                overlap: minDistance - distance,
                approachSpeed: -(relativeVx * nx + relativeVy * ny),
            });
        }
    }
    return contacts;
};

const pushEvent = (
    run: G0SuikaRunState,
    event: Omit<G0SuikaEvent, "id">,
): void => {
    run.eventCounter += 1;
    run.events.push({ ...event, id: `${run.runId}:e${run.eventCounter}` });
    if (run.events.length > 24) run.events.splice(0, run.events.length - 24);
};

const resolveMerges = (run: G0SuikaRunState): void => {
    const contacts = collectContacts(run.balls);
    if (contacts.length === 0) return;

    // 同一ステップ内で複数の接触が同時成立しうるので、重なりの深い順に
    // 貪欲に確定する。決定論を保つため、同点はidで比較する。
    contacts.sort((left, right) => (
        right.overlap - left.overlap
        || left.a.id.localeCompare(right.a.id)
        || left.b.id.localeCompare(right.b.id)
    ));

    const consumed = new Set<string>();
    const created: G0SuikaBall[] = [];

    for (const contact of contacts) {
        const { a, b } = contact;
        if (consumed.has(a.id) || consumed.has(b.id)) continue;

        const sum = addQuantity(a.quantity, b.quantity);

        if (compareQuantity(sum, run.target) > 0) {
            // 目標量を超える組は合体しない。無反応だと壊れて見えるので短く弾く。
            // 積み上がって静止している対は毎フレーム光らせない。
            if (contact.approachSpeed > REJECT_IMPACT_SPEED) {
                if (a.rejectUntilMs < run.simTimeMs) {
                    pushEvent(run, {
                        kind: "reject",
                        left: a.quantity,
                        right: b.quantity,
                        result: sum,
                        x: (a.x + b.x) / 2,
                        y: (a.y + b.y) / 2,
                        chainDepth: 0,
                        scoreGained: 0,
                        atMs: run.simTimeMs,
                    });
                }
                const rejectUntil = run.simTimeMs + REJECT_FLASH_MS;
                a.rejectUntilMs = rejectUntil;
                b.rejectUntilMs = rejectUntil;
            }
            continue;
        }

        consumed.add(a.id);
        consumed.add(b.id);

        run.chainDepth = run.simTimeMs <= run.chainUntilMs
            ? run.chainDepth + 1
            : 1;
        run.chainUntilMs = run.simTimeMs + CHAIN_WINDOW_MS;
        run.bestChain = Math.max(run.bestChain, run.chainDepth);
        run.mergeCount += 1;
        run.ballCounter += 1;

        const recipeKey = getSuikaRecipeKey(a.quantity, b.quantity);
        if (!run.seenRecipes.includes(recipeKey)) {
            run.seenRecipes.push(recipeKey);
        }

        const isPop = compareQuantity(sum, run.target) === 0;
        const blastBonus = run.charms.includes("pop-blast") ? 1.5 : 1;
        const scoreGained = isPop
            ? Math.round(POP_SCORE * run.chainDepth * blastBonus)
            : Math.max(1, Math.round(quantityRatio(sum, run.target) * 10));
        run.score += scoreGained;
        if (isPop) run.targetPopCount += 1;

        const merged: G0SuikaBall = {
            id: `${run.runId}:b${run.ballCounter}`,
            quantity: sum,
            radius: getSuikaBallRadius(sum, run.target),
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            px: (a.px + b.px) / 2,
            py: (a.py + b.py) / 2,
            bornAtMs: run.simTimeMs,
            popAtMs: isPop ? run.simTimeMs + POP_HOLD_MS : null,
            flashUntilMs: run.simTimeMs + FLASH_MS,
            rejectUntilMs: 0,
        };
        created.push(merged);

        pushEvent(run, {
            kind: isPop ? "target-pop" : "merge",
            left: a.quantity,
            right: b.quantity,
            result: sum,
            x: merged.x,
            y: merged.y,
            chainDepth: run.chainDepth,
            scoreGained,
            atMs: run.simTimeMs,
        });
    }

    if (consumed.size === 0) return;
    run.balls = run.balls
        .filter((ball) => !consumed.has(ball.id))
        .concat(created);
};

const resolvePops = (run: G0SuikaRunState): void => {
    const popping = run.balls.filter(
        (ball) => ball.popAtMs !== null && ball.popAtMs <= run.simTimeMs,
    );
    if (popping.length === 0) return;

    const impulse = run.charms.includes("pop-blast")
        ? POP_IMPULSE * 1.8
        : POP_IMPULSE;

    run.balls = run.balls.filter((ball) => !popping.includes(ball));

    for (const popped of popping) {
        const reach = popped.radius * 2.4;
        for (const ball of run.balls) {
            const dx = ball.x - popped.x;
            const dy = ball.y - popped.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;
            if (distance > reach + ball.radius) continue;
            const strength = impulse
                * (1 - Math.min(1, distance / (reach + ball.radius)));
            ball.px -= (dx / distance) * strength;
            ball.py -= (dy / distance) * strength;
        }
    }
};

/* ------------------------------------------------------------------ */
/* あふれ判定                                                          */
/* ------------------------------------------------------------------ */

const updateOverflow = (run: G0SuikaRunState): void => {
    const overflowing = run.balls.some((ball) => (
        ball.popAtMs === null
        && ball.y - ball.radius < SUIKA_DEAD_LINE_Y
        && run.simTimeMs - ball.bornAtMs > SETTLE_GRACE_MS
    ));

    if (!overflowing) {
        run.overflowSinceMs = null;
        return;
    }

    if (run.overflowSinceMs === null) {
        run.overflowSinceMs = run.simTimeMs;
        return;
    }

    if (run.simTimeMs - run.overflowSinceMs >= OVERFLOW_GRACE_MS) {
        run.status = "over";
        run.endedAtMs = run.simTimeMs;
    }
};

/* ------------------------------------------------------------------ */
/* 公開API                                                             */
/* ------------------------------------------------------------------ */

const cloneRun = (run: G0SuikaRunState): G0SuikaRunState => ({
    ...run,
    balls: run.balls.map((ball) => ({ ...ball })),
    queue: [...run.queue],
    events: [...run.events],
    seenRecipes: [...run.seenRecipes],
});

/**
 * 可変フレーム時間を固定サブステップへ分割して進める。
 * 同じ入力列と同じdt列からは必ず同じ盤面になる。
 */
export const stepG0SuikaRun = (
    run: G0SuikaRunState,
    frameMs: number,
): G0SuikaRunState => {
    if (run.status === "over") return run;

    const next = cloneRun(run);
    next.accumulatorMs = Math.min(
        next.accumulatorMs + Math.max(0, frameMs),
        FIXED_DT_MS * MAX_SUBSTEPS_PER_FRAME,
    );

    const dtSec = FIXED_DT_MS / 1000;
    while (next.accumulatorMs >= FIXED_DT_MS) {
        next.accumulatorMs -= FIXED_DT_MS;
        next.simTimeMs += FIXED_DT_MS;
        integrate(next.balls, dtSec);
        solveConstraints(next.balls, next.worldWidth);
        resolveMerges(next);
        resolvePops(next);
        updateOverflow(next);
        if (next.status === "over") break;
    }

    return next;
};

export const aimG0SuikaRun = (
    run: G0SuikaRunState,
    x: number,
): G0SuikaRunState => {
    if (run.status === "over") return run;
    const radius = getSuikaBallRadius(run.queue[0], run.target);
    const clamped = Math.min(
        Math.max(x, radius),
        run.worldWidth - radius,
    );
    if (clamped === run.aimX) return run;
    return { ...run, aimX: clamped };
};

export const canDropG0SuikaBall = (run: G0SuikaRunState): boolean => {
    if (run.status === "over") return false;
    if (run.lastDropAtMs === null) return true;
    return run.simTimeMs - run.lastDropAtMs
        >= getSuikaDropCooldownMs(run.charms);
};

export const dropG0SuikaBall = (run: G0SuikaRunState): G0SuikaRunState => {
    if (!canDropG0SuikaBall(run)) return run;

    const profile = G0_SUIKA_PROFILES[run.profileId];
    const next = cloneRun(run);
    const quantity = next.queue[0];
    next.ballCounter += 1;
    next.balls.push({
        id: `${next.runId}:b${next.ballCounter}`,
        quantity,
        radius: getSuikaBallRadius(quantity, next.target),
        x: next.aimX,
        y: SUIKA_SPAWN_Y,
        px: next.aimX,
        py: SUIKA_SPAWN_Y,
        bornAtMs: next.simTimeMs,
        popAtMs: null,
        flashUntilMs: 0,
        rejectUntilMs: 0,
    });

    const draw = drawQuantity(next.rngState, profile, next.charms);
    next.queue = [...next.queue.slice(1), draw.quantity];
    next.rngState = draw.state;
    next.lastDropAtMs = next.simTimeMs;
    next.dropCount += 1;

    const nextRadius = getSuikaBallRadius(next.queue[0], next.target);
    next.aimX = Math.min(
        Math.max(next.aimX, nextRadius),
        next.worldWidth - nextRadius,
    );

    return next;
};

export const summarizeG0SuikaRun = (
    run: G0SuikaRunState,
): G0SuikaRunSummary => ({
    runId: run.runId,
    runOrdinal: run.runOrdinal,
    profileId: run.profileId,
    durationMs: run.endedAtMs ?? run.simTimeMs,
    score: run.score,
    dropCount: run.dropCount,
    targetPopCount: run.targetPopCount,
    bestChain: run.bestChain,
    recipeCount: run.seenRecipes.length,
    charms: run.charms,
});

/* ------------------------------------------------------------------ */
/* セッション（run間の持ち越し）                                        */
/* ------------------------------------------------------------------ */

const rollCharmOffer = (
    session: G0SuikaSession,
): { offer: G0SuikaCharmId[]; rngState: number } => {
    const pool = G0_SUIKA_CHARM_IDS.filter(
        (charmId) => !session.charms.includes(charmId),
    );
    let state = session.offerRngState;
    const offer: G0SuikaCharmId[] = [];
    const remaining = [...pool];

    while (offer.length < 3 && remaining.length > 0) {
        const draw = nextRandom(state);
        state = draw.state;
        const index = Math.min(
            remaining.length - 1,
            Math.floor(draw.value * remaining.length),
        );
        offer.push(remaining[index]);
        remaining.splice(index, 1);
    }

    return { offer, rngState: state };
};

export const stepG0SuikaSession = (
    session: G0SuikaSession,
    frameMs: number,
): G0SuikaSession => {
    const run = stepG0SuikaRun(session.run, frameMs);
    if (run === session.run) return session;

    if (run.status === "over" && session.run.status !== "over") {
        const { offer, rngState } = rollCharmOffer(session);
        return {
            ...session,
            run,
            history: [...session.history, summarizeG0SuikaRun(run)],
            charmOffer: offer,
            offerRngState: rngState,
        };
    }

    return { ...session, run };
};

export const aimG0SuikaSession = (
    session: G0SuikaSession,
    x: number,
): G0SuikaSession => {
    const run = aimG0SuikaRun(session.run, x);
    return run === session.run ? session : { ...session, run };
};

export const dropG0SuikaSession = (
    session: G0SuikaSession,
): G0SuikaSession => {
    const run = dropG0SuikaBall(session.run);
    return run === session.run ? session : { ...session, run };
};

export const replayG0SuikaSession = (
    session: G0SuikaSession,
): G0SuikaSession => {
    if (session.run.status !== "over") return session;
    return {
        ...session,
        run: createG0SuikaRun(
            session.sessionSeed,
            session.run.runOrdinal + 1,
            session.charms,
            session.profileId,
        ),
        charmOffer: [],
        replayStarts: session.replayStarts + 1,
    };
};

/**
 * 数の種類を切り替える。おまもりと履歴は持ち越し、runだけ作り直す。
 * 整数で覚えた規則がそのまま小数・分数で通じるかを同じ座りで見るため。
 */
export const switchG0SuikaProfile = (
    session: G0SuikaSession,
    profileId: G0SuikaProfileId,
): G0SuikaSession => {
    if (profileId === session.profileId) return session;

    const history = session.run.status === "over"
        ? session.history
        : [...session.history, summarizeG0SuikaRun(session.run)];

    return {
        ...session,
        profileId,
        run: createG0SuikaRun(
            session.sessionSeed,
            session.run.runOrdinal + 1,
            session.charms,
            profileId,
        ),
        history,
        charmOffer: [],
        profileSwitches: session.profileSwitches + 1,
    };
};

export const pickG0SuikaCharm = (
    session: G0SuikaSession,
    charmId: G0SuikaCharmId,
): G0SuikaSession => {
    if (!session.charmOffer.includes(charmId)) return session;
    if (session.charms.includes(charmId)) return session;
    return {
        ...session,
        charms: [...session.charms, charmId],
        charmOffer: [],
    };
};

/* ------------------------------------------------------------------ */
/* 診断メトリクス                                                      */
/* ------------------------------------------------------------------ */

export interface G0SuikaMetrics {
    completedRuns: number;
    replayStarts: number;
    profileSwitches: number;
    bestScore: number;
    totalTargetPops: number;
    bestChain: number;
    averageDurationMs: number | null;
    averageDropCount: number | null;
    playedProfileIds: readonly G0SuikaProfileId[];
    triedDifferentCharms: boolean;
}

export const getG0SuikaMetrics = (
    session: G0SuikaSession,
): G0SuikaMetrics => {
    const { history } = session;
    const completedRuns = history.length;

    return {
        completedRuns,
        replayStarts: session.replayStarts,
        profileSwitches: session.profileSwitches,
        bestScore: history.reduce(
            (best, entry) => Math.max(best, entry.score),
            0,
        ),
        totalTargetPops: history.reduce(
            (total, entry) => total + entry.targetPopCount,
            0,
        ),
        bestChain: history.reduce(
            (best, entry) => Math.max(best, entry.bestChain),
            0,
        ),
        averageDurationMs: completedRuns === 0
            ? null
            : history.reduce((total, entry) => total + entry.durationMs, 0)
                / completedRuns,
        averageDropCount: completedRuns === 0
            ? null
            : history.reduce((total, entry) => total + entry.dropCount, 0)
                / completedRuns,
        playedProfileIds: [...new Set(history.map((entry) => entry.profileId))],
        triedDifferentCharms: session.charms.length > 0,
    };
};
