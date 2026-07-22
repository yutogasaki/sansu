import {
    commitExploreAttempt,
    finishExploreRun,
    startExploreRun,
} from "./persistenceRepository";
import type {
    CommitExploreAttemptInput,
    ExploreAttemptCommitReceipt,
    ExploreRunFinishReceipt,
    ExploreRunRecord,
    FinishExploreRunInput,
    StartExploreRunInput,
} from "./persistenceTypes";

interface ExploreStartE2EControl {
    failuresRemaining?: number;
}

interface ExploreCommitE2EControl {
    delayMs?: number;
    failuresRemaining?: number;
}

interface ExploreProblemPlanE2EControl {
    delayMs?: number;
    delaysRemaining?: number;
}

interface ExploreFinishE2EControl {
    failuresRemaining?: number;
}

interface ExploreRunE2EControl {
    maxEnergy?: number;
    seed?: string;
    now?: number;
}

interface ExploreBenchmarkE2EControl {
    fixtureId?: string;
    startIndex?: number;
}

declare global {
    interface Window {
        __SANSU_E2E__?: {
            exploreStart?: ExploreStartE2EControl;
            exploreCommit?: ExploreCommitE2EControl;
            exploreProblemPlan?: ExploreProblemPlanE2EControl;
            exploreFinish?: ExploreFinishE2EControl;
            exploreRun?: ExploreRunE2EControl;
            exploreBenchmark?: ExploreBenchmarkE2EControl;
        };
    }
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
});

export const waitForExploreProblemPlanE2E = async (
    signal?: AbortSignal,
): Promise<void> => {
    const control = import.meta.env.DEV && typeof window !== "undefined"
        ? window.__SANSU_E2E__?.exploreProblemPlan
        : undefined;
    const delayMs = Math.max(0, Math.round(control?.delayMs ?? 0));
    const delaysRemaining = control?.delaysRemaining;
    if (delayMs === 0 || delaysRemaining === 0) return;
    if (typeof delaysRemaining === "number") {
        control!.delaysRemaining = Math.max(0, delaysRemaining - 1);
    }

    await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason);
            return;
        }
        const timeoutId = window.setTimeout(() => {
            signal?.removeEventListener("abort", handleAbort);
            resolve();
        }, delayMs);
        const handleAbort = () => {
            window.clearTimeout(timeoutId);
            reject(signal?.reason);
        };
        signal?.addEventListener("abort", handleAbort, { once: true });
    });
};

/**
 * UI-only port around the repository. The development hook creates stable E2E
 * race/failure windows without changing Dexie semantics or production builds.
 */
export const commitExploreAttemptFromUi = async (
    input: CommitExploreAttemptInput,
): Promise<ExploreAttemptCommitReceipt> => {
    const control = import.meta.env.DEV && typeof window !== "undefined"
        ? window.__SANSU_E2E__?.exploreCommit
        : undefined;
    const delayMs = Math.max(0, Math.round(control?.delayMs ?? 0));
    if (delayMs > 0) await wait(delayMs);

    if ((control?.failuresRemaining ?? 0) > 0) {
        control!.failuresRemaining = (control?.failuresRemaining ?? 1) - 1;
        throw new Error("Injected exploration commit failure");
    }

    return commitExploreAttempt(input);
};

export const startExploreRunFromUi = async (
    input: StartExploreRunInput,
): Promise<ExploreRunRecord> => {
    const control = import.meta.env.DEV && typeof window !== "undefined"
        ? window.__SANSU_E2E__?.exploreStart
        : undefined;
    if ((control?.failuresRemaining ?? 0) > 0) {
        control!.failuresRemaining = (control?.failuresRemaining ?? 1) - 1;
        throw new Error("Injected exploration start failure");
    }
    return startExploreRun(input);
};

export const finishExploreRunFromUi = async (
    input: FinishExploreRunInput,
): Promise<ExploreRunFinishReceipt> => {
    const control = import.meta.env.DEV && typeof window !== "undefined"
        ? window.__SANSU_E2E__?.exploreFinish
        : undefined;
    if ((control?.failuresRemaining ?? 0) > 0) {
        control!.failuresRemaining = (control?.failuresRemaining ?? 1) - 1;
        throw new Error("Injected exploration finish failure");
    }
    return finishExploreRun(input);
};

export const getExploreRunE2EOptions = () => {
    if (!import.meta.env.DEV || typeof window === "undefined") return {};
    const control = window.__SANSU_E2E__?.exploreRun;
    const maxEnergy = control?.maxEnergy;
    const seed = typeof control?.seed === "string" && control.seed.trim()
        ? control.seed.trim()
        : undefined;
    const now = Number.isSafeInteger(control?.now) && (control?.now ?? 0) >= 0
        ? control?.now
        : undefined;
    return {
        config: Number.isSafeInteger(maxEnergy) && (maxEnergy ?? 0) >= 1
            ? { maxEnergy }
            : undefined,
        seed,
        now,
    };
};

export const getExploreBenchmarkE2EOptions = () => {
    if (!import.meta.env.DEV || typeof window === "undefined") return {};
    const control = window.__SANSU_E2E__?.exploreBenchmark;
    const fixtureId = typeof control?.fixtureId === "string" && control.fixtureId.trim()
        ? control.fixtureId.trim()
        : undefined;
    const startIndex = Number.isSafeInteger(control?.startIndex)
        && (control?.startIndex ?? -1) >= 0
        ? control?.startIndex
        : undefined;
    return { fixtureId, startIndex };
};
