import assert from 'node:assert/strict';
import { activate, button } from './island-e2e-helpers.mjs';

export const ONBOARDING_CANDIDATE = 'island-touch-first-v1';

export async function onboardingStores(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = [...db.objectStoreNames].sort(), tx = db.transaction(names, 'readonly');
        const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const entries = await Promise.all(names.map(async name => {
            const table = tx.objectStore(name), [keys, rows] = await Promise.all([read(table.getAllKeys()), read(table.getAll())]);
            return [name, { keys, rows }];
        }));
        db.close(); return Object.fromEntries(entries);
    });
}

export function assertProfileFree(stores) {
    for (const [name, { rows }] of Object.entries(stores)) {
        if (name === 'appData') {
            assert(rows.length <= 1);
            for (const row of rows) { assert.deepEqual(row.profiles, {}); assert.equal(row.activeProfileId, null); }
        } else assert.deepEqual(rows, [], `${name}: Welcome/setup must not create profile, memory, learning or game state`);
    }
}

export async function armOnboardingObservation(page) {
    await page.addInitScript(() => {
        window.__onboardingObservation = { clicks: [], frames: [], routes: [], timeOrigin: performance.timeOrigin };
        const observation = window.__onboardingObservation;
        const scene = () => {
            const stage = document.querySelector('[data-testid="island-stage"]'), d = stage?.dataset;
            if (!d) return null;
            return { at: performance.now(), frameTimestamp: Number(d.frameTimestamp), drawCount: Number(d.drawCount),
                requestId: d.playRequestId, status: d.playStatus, renderer: d.renderer,
                residents: JSON.parse(d.residentStates || '[]'), items: JSON.parse(d.furnitureState || '[]'),
                cameraFrame: d.cameraFrame, artDirection: d.artDirection };
        };
        document.addEventListener('click', event => {
            const target = event.target.closest?.('button');
            observation.clicks.push({ at: performance.now(), trusted: event.isTrusted, label: target?.textContent.trim(),
                x: event.clientX, y: event.clientY, step: document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep,
                hash: location.hash, scene: scene() });
        }, true);
        const route = (event, via = 'hashchange') => observation.routes.push({ at: performance.now(), hash: event?.newURL ? new URL(event.newURL).hash : location.hash, via });
        addEventListener('hashchange', route); route(undefined, 'initial');
        // HashRouter uses native history state updates, which do not dispatch
        // hashchange. Observe their completed URL changes without adding routes.
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            history[method] = function (...args) {
                const result = original.apply(this, args);
                route(undefined, method);
                return result;
            };
        }
        new MutationObserver(records => {
            if (!records.some(record => record.attributeName === 'data-draw-count')) return;
            const current = scene();
            if (current) observation.frames.push(current);
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-draw-count'] });
    });
}

export async function onboardingControls(page, selector) {
    const result = [];
    for (const control of await page.locator(selector).all()) {
        await control.scrollIntoViewIfNeeded();
        const measured = await control.evaluate(element => {
            const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { name: element.getAttribute('aria-label') || element.textContent.trim(), width: r.width, height: r.height,
                visible: r.top >= -.5 && r.left >= -.5 && r.bottom <= innerHeight + .5 && r.right <= innerWidth + .5,
                hit: hit === element || element.contains(hit), disabled: element.disabled };
        });
        assert(measured.width >= 43.5 && measured.height >= 43.5 && measured.visible && measured.hit && !measured.disabled,
            `Real onboarding target: ${JSON.stringify(measured)}`);
        result.push(measured);
    }
    assert(result.length, 'Every setup stage exposes actual choices');
    return result;
}

export async function untouchedStep(page, step, baseline) {
    await page.locator(`[data-onboarding-step="${step}"][data-onboarding-candidate="${ONBOARDING_CANDIDATE}"]`).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.island-setup-sheet h1').count(), 1, 'One explicit question per screen');
    assert.equal(await page.locator('.island-setup-options [aria-checked="true"], .island-setup-options [aria-pressed="true"], .island-setup-options :checked').count(), 0);
    assert.deepEqual(await onboardingStores(page), baseline, `Waiting at unchosen ${step} cannot auto-pick settings or create state`);
    return onboardingControls(page, '.island-setup-options button, .island-setup-name input, .island-setup-header button');
}

export async function welcomePlay(page, itemId, label, touch, reduced = false, keyboard = false) {
    const before = await onboardingStores(page);
    const previous = await page.locator('[data-testid="island-stage"]').getAttribute('data-play-request-id');
    if (keyboard) { await button(page, label).focus(); await page.keyboard.press('Enter'); }
    else await activate(button(page, label), touch);
    await page.waitForFunction(({ previous, itemId }) => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return d?.playRequestId && d.playRequestId !== previous && d.playStatus === 'playing'
            && JSON.parse(d.residentStates || '[]').some(resident => resident.itemId === itemId);
    }, { previous, itemId });
    const requestId = await page.locator('[data-testid="island-stage"]').getAttribute('data-play-request-id');
    await page.waitForFunction(itemId => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return JSON.parse(d?.residentStates || '[]').some(resident => resident.itemId === itemId
            && resident.action === (itemId === 'starter-flower' ? 'sniff' : 'admire') && resident.usePhase >= 1);
    }, itemId);
    assert.deepEqual(await onboardingStores(page), before, 'Actual furniture play remains entirely transient before profile creation');
    const observation = await page.evaluate(() => window.__onboardingObservation);
    const click = observation.clicks.findLast(click => click.label === label);
    assert(click?.trusted);
    const frames = observation.frames.filter(frame => frame.at >= click.at && frame.requestId === requestId);
    const minimumDraws = reduced ? 1 : 2;
    assert(frames.length >= minimumDraws, 'Read actual draws since the invitation; reduced motion may render its static result in one draw');
    const actors = frames.map(frame => frame.residents.find(resident => resident.itemId === itemId)).filter(Boolean);
    assert(actors.length >= minimumDraws);
    const displacement = Math.max(...actors.map(actor => Math.hypot(...actor.position.map((value, i) => value - actors[0].position[i]))));
    const phaseRange = Math.max(...actors.map(actor => actor.usePhase)) - Math.min(...actors.map(actor => actor.usePhase));
    if (!reduced) assert(displacement > .02 || phaseRange > .1, 'A real resident visibly moves or completes its furniture use after the invitation');
    else assert(actors.every(actor => actor.action !== 'walk' && actor.usePhase >= 1), 'Reduced motion shows the actual final furniture-use pose immediately');
    return { itemId, requestId, trustedClick: click, actualDraws: frames.length, displacement, phaseRange, final: actors.at(-1) };
}

/** Explicitly labeled fault probe only; the primary flows never patch native IDB. */
export async function installOnboardingFault(page, kind) {
    assert(['abort-once', 'hold-completion'].includes(kind));
    // Install before Dexie opens the database: its core binds the native
    // database.transaction method during open. Remain dormant until the real
    // final setup action, so setup reads and the blank app record are untouched.
    await page.addInitScript(kind => {
        const probe = window.__onboardingFault = { kind, hits: 0, armed: false, installedAt: performance.now() };
        window.__armOnboardingFault = () => { probe.armed = true; probe.armedAt = performance.now(); };
        if (kind === 'abort-once') {
            const original = IDBObjectStore.prototype.add;
            IDBObjectStore.prototype.add = function (value, ...rest) {
                const request = original.call(this, value, ...rest);
                if (probe.armed && this.name === 'profiles' && this.transaction.db.name === 'SansuDatabase' && !probe.hits) {
                    probe.hits++; probe.profileId = value.id; probe.attemptedProfile = structuredClone(value);
                    const tx = this.transaction;
                    request.addEventListener('success', () => { probe.abortedAt = performance.now(); tx.abort(); });
                    IDBObjectStore.prototype.add = original;
                }
                return request;
            };
        } else {
            const original = IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction = function (...args) {
                const tx = original.apply(this, args), names = [...tx.objectStoreNames];
                if (probe.armed && this.name === 'SansuDatabase' && tx.mode === 'readwrite' && ['profiles', 'appData', 'memoryMath'].every(name => names.includes(name)) && !probe.hits) {
                    probe.hits++; IDBDatabase.prototype.transaction = original;
                    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
                    if (!descriptor?.set) throw new Error('Native oncomplete interception is unavailable');
                    let assigned;
                    Object.defineProperty(tx, 'oncomplete', { configurable: true, get: () => assigned, set(callback) {
                        assigned = callback;
                        descriptor.set.call(tx, function (event) {
                            probe.committedAt = performance.now();
                            window.__releaseOnboardingCompletion = () => {
                                probe.releasedAt = performance.now(); window.__releaseOnboardingCompletion = undefined;
                                callback.call(this, event);
                            };
                        });
                    } });
                }
                return tx;
            };
        }
    }, kind);
}
