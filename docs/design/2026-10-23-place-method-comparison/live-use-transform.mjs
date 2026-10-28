/** Read-only trial instrumentation; the repository's production source is unchanged. */
export function liveUseTransform(source) {
    const retries = '                    due.forEach(retry => world.life.retryPlaceUse(retry.receipt));';
    const send = `                        Promise.resolve(actionHandler(receipt)).then(saved => {
                            if (saved === false) useRetry.push({ receipt, at: performance.now() + 1500 });
                        }).catch(() => useRetry.push({ receipt, at: performance.now() + 1500 }));`;
    for (const [name, needle] of [['retry queue', retries], ['rendered receipt delivery', send]]) {
        if (source.split(needle).length !== 2) throw Error(`Live use ${name} integration changed; inspect the renderer before proceeding`);
    }
    return "import { recordTrialLiveUse } from '../../../../docs/design/2026-10-23-place-method-comparison/LiveUse';\n"
        + source.replace(retries, `                    const trialRetried = new Set(due.map(retry => retry.receipt));
${retries}`).replace(send, `                        const trialPlace = layer.places.find(place => place.id === receipt.placeId && place.revision === receipt.revision);
                        const trialTarget = trialPlace?.useTargets.find(target => target.id === receipt.targetId);
                        const trialObservation = {
                            observedAtMs: Date.now(), observedFrameTimeMs: now,
                            delivery: trialRetried.has(receipt) ? 'retry' as const : 'fresh-life-receipt' as const,
                            receipt: { ...receipt }, worldId: layout.world.id, worldRevision: layout.world.revision ?? null,
                            actorPosition: { x: position.x, y: position.y, z: position.z },
                            target: trialTarget && { id: trialTarget.id, kind: trialTarget.kind, cell: { ...trialTarget.cell } },
                            currentPlaceRevisionMatches: Boolean(trialPlace && trialTarget),
                            documentVisibility: document.visibilityState, active: latest.current.active, playActive: latest.current.playActive,
                            inFrustum: true, renderSucceeded: true,
                        };
                        Promise.resolve(actionHandler(receipt)).then(saved => {
                            if (saved === false) useRetry.push({ receipt, at: performance.now() + 1500 });
                            if (saved === true) {
                                try { recordTrialLiveUse(trialObservation); }
                                catch { /* Observation failure must not retry or change the app action. */ }
                            }
                        }).catch(() => useRetry.push({ receipt, at: performance.now() + 1500 }));`);
}
