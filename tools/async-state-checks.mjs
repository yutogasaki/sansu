import assert from 'node:assert/strict';

// Playwright 1.58 checks an async waitForFunction predicate's Promise for
// truthiness before it resolves. Keep asynchronous reads in awaited Node polls.
export async function waitForPageState(page, predicate, arg, { timeout = 30000, description = 'saved state' } = {}) {
    const deadline = performance.now() + timeout;
    const expired = () => new Error(`Timed out after ${timeout}ms waiting for ${description}`);
    while (performance.now() < deadline) {
        let timer;
        let result;
        try {
            result = await Promise.race([
                page.evaluate(predicate, arg),
                new Promise((_, reject) => { timer = setTimeout(() => reject(expired()), Math.max(0, deadline - performance.now())); }),
            ]);
        } finally { clearTimeout(timer); }
        if (result === true) return;
        await new Promise(resolve => setTimeout(resolve, Math.min(16, Math.max(0, deadline - performance.now()))));
    }
    throw expired();
}

// These compatibility fixtures explicitly use math. This is the established
// smoke-test boundary after the first node and its learning segment are saved.
export async function waitForExploreNumericReady(page, { timeout = 30000, runId, problemId } = {}) {
    await page.waitForFunction(({ runId, problemId }) => {
        const world = document.querySelector('.explore-world');
        const attempt = document.querySelector('[data-testid="explore-attempt"]');
        const stage = document.querySelector('.explore-immersive');
        const digit = document.querySelector('button[aria-label="1"]');
        return location.hash === '#/explore'
            && world?.getAttribute('data-run-persistence') === 'ready'
            && world.getAttribute('data-run-status') === 'active'
            && attempt?.getAttribute('data-save-state') === 'idle'
            && Boolean(attempt.dataset.runId && attempt.dataset.problemId)
            && attempt.dataset.runId === world.dataset.runId
            && (!runId || attempt.dataset.runId === runId)
            && (!problemId || attempt.dataset.problemId === problemId)
            && stage?.getAttribute('data-state') === 'idle'
            && stage.querySelector('.explore-immersive-keypad-shell')?.getAttribute('aria-disabled') === 'false'
            && digit instanceof HTMLButtonElement && !digit.disabled
            && stage.querySelector('output')?.getAttribute('aria-label') === 'こたえ 未入力';
    }, { runId, problemId }, { timeout });
    return page.evaluate(() => ({
        runId: document.querySelector('.explore-world').dataset.runId,
        problemId: document.querySelector('[data-testid="explore-attempt"]').dataset.problemId,
        checkpointRevision: Number(document.querySelector('.explore-world').dataset.checkpointRevision),
    }));
}

export function assertExploreCheckpoint(run, profileId, ready) {
    assert(run, 'The ready Explore screen must have a saved active run');
    assert.equal(run.status, 'active');
    assert.equal(run.runId, ready.runId);
    assert.equal(run.profileId, profileId);
    assert(run.activeCheckpoint, 'The ready Explore run must have its checkpoint');
    assert.equal(run.activeCheckpoint.state.runId, ready.runId);
    assert.equal(run.activeCheckpoint.state.profileId, profileId);
    assert.equal(run.activeCheckpoint.state.pendingProblem?.problem?.id, ready.problemId);
    assert.equal(run.activeCheckpoint.revision, ready.checkpointRevision);
}
