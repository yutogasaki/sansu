import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { resolveIslandAppearance, ISLAND_APPEARANCE_PART_SLOTS, type IslandAppearancePartId, type IslandAppearanceSlotId } from '../../domain/island/appearance';
import { getIslandCosmetics, getIslandCustomization, CUSTOMIZATION_CATALOG, canonicalIslandCustomizationAction,
    hasIslandCustomizationItem, IslandCustomizationConflict, previewIslandCustomization as previewAction,
    type IslandCosmetics, type IslandCustomizationAction, type IslandCustomizationItemId } from '../../domain/island/customization';
import { customizeIsland } from '../../domain/island/customizationRepository';
import { IslandConflict } from '../../domain/island/repository';
import { hasValidIslandRewardGoal } from '../../domain/island/rewardGoal';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';
import { previewIslandCustomization } from './islandCustomizationPreview';
import { executeIslandCustomizationRequest, type IslandCustomizationRequest } from './islandCustomizationRequest';

type Restore = Extract<IslandCustomizationAction, { type: 'restore-part' }>;
function sameStoredValue(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return false;
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && keys.length === Object.keys(right).length
        && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameStoredValue(left[key], right[key]));
}
/** Only the goal and write metadata may differ. Resolve an absent legacy
 * wallet exactly as the writer does; never normalize ownership or appearance. */
function onlyRewardGoalChanged(previous: IslandRecord, next: IslandRecord): boolean {
    if (!hasValidIslandRewardGoal(previous) || !hasValidIslandRewardGoal(next)) return false;
    const comparable = (island: IslandRecord) => {
        const customization = { ...getIslandCustomization(island), desiredItemId: null };
        if (customization.appearance === undefined) delete customization.appearance;
        return { ...island, revision: 0, updatedAt: 0, rewardGoal: undefined, customization };
    };
    return sameStoredValue(comparable(previous), comparable(next));
}
export function useIslandCustomization(island: IslandRecord | undefined, active: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (island: IslandRecord) => void) {
    const [preview, setPreview] = useState<IslandCosmetics>();
    const [selectedId, setSelectedId] = useState<IslandCustomizationItemId>('moon-garden');
    const [selectedSlot, setSelectedSlot] = useState<IslandAppearanceSlotId>();
    const [restore, setRestore] = useState<Restore>();
    const [selectionReady, setSelectionReady] = useState(false);
    const [celebration, setCelebration] = useState<string>();
    const [error, setError] = useState<string>();
    const [canRetry, setCanRetry] = useState(false);
    const pending = useRef<IslandCustomizationRequest | undefined>(undefined);
    const running = useRef<Promise<IslandRecord | undefined> | undefined>(undefined);
    const owner = useRef({ island, active, onSaved, mounted: false });
    const epoch = useRef(0);
    const reset = useCallback(() => {
        epoch.current += 1; setPreview(undefined); setCelebration(undefined); setSelectionReady(false); setRestore(undefined); setSelectedSlot(undefined);
        // An unknown purchase keeps its receipt through closing/reopening. It is never sent automatically.
        if (!pending.current) { setError(undefined); setCanRetry(false); }
    }, []);
    useLayoutEffect(() => {
        const previous = owner.current.island, changedProfile = previous?.profileId !== island?.profileId;
        if (changedProfile) { pending.current = undefined; running.current = undefined; setError(undefined); setCanRetry(false); }
        if (changedProfile || owner.current.active && !active) reset();
        else if (previous && island && previous.profileId === island.profileId && island.revision > previous.revision
            && !(active && onlyRewardGoalChanged(previous, island))) {
            // liveQuery may deliver our own committed purchase before its writer resolves.
            // Refresh the visible base without mistaking that delivery for an exit.
            if (!pending.current) epoch.current += 1;
            setPreview(undefined); setSelectionReady(false); setRestore(undefined); setSelectedSlot(undefined); setCelebration(undefined);
        }
        owner.current = { island: previous && island?.profileId === previous.profileId && previous.revision > island.revision ? previous : island,
            active, onSaved, mounted: true };
    }, [island, active, onSaved, reset]);
    useLayoutEffect(() => {
        const hidden = () => { if (document.hidden) epoch.current += 1; };
        document.addEventListener('visibilitychange', hidden);
        return () => { owner.current.mounted = false; epoch.current += 1; document.removeEventListener('visibilitychange', hidden); };
    }, []);
    const accepting = useCallback(() => owner.current.mounted && owner.current.active && !document.hidden, []);
    const open = useCallback((requestedId?: IslandCustomizationItemId) => {
        const current = owner.current.island; if (!current) return;
        const state = getIslandCustomization(current), id = requestedId ?? state.desiredItemId;
        setSelectedId(id ?? state.themeId); setSelectedSlot(undefined); setRestore(undefined);
        setPreview(id ? previewIslandCustomization(getIslandCosmetics(current), id) : getIslandCosmetics(current));
        setSelectionReady(Boolean(id)); setCelebration(undefined);
    }, []);
    const browse = useCallback(() => { setSelectionReady(false); setRestore(undefined); setSelectedSlot(undefined); setCelebration(undefined); }, []);
    const select = useCallback((id: IslandCustomizationItemId, slot?: IslandAppearanceSlotId) => {
        const current = owner.current.island; if (!current || !accepting() || pending.current) return;
        setSelectedId(id); setSelectedSlot(slot); setRestore(undefined); setSelectionReady(true);
        setPreview(previous => previewIslandCustomization(previous ?? getIslandCosmetics(current), id, slot)); setCelebration(undefined);
    }, [accepting]);
    const selectRestore = useCallback((partId: IslandAppearancePartId, slot?: IslandAppearanceSlotId) => {
        const current = owner.current.island; if (!current || !accepting() || pending.current) return;
        const action: Restore = { type: 'restore-part', partId, ...(slot ? { slot } : {}) };
        setRestore(action); setSelectedSlot(slot); setSelectionReady(true); setCelebration(undefined);
        setPreview(previous => previewAction(previous ?? getIslandCosmetics(current), action));
    }, [accepting]);
    const undoPart = useCallback((partId: IslandAppearancePartId, slot?: IslandAppearanceSlotId) => {
        const current = owner.current.island; if (!current || !accepting() || pending.current) return;
        const saved = getIslandCosmetics(current), savedAppearance = resolveIslandAppearance(saved);
        setPreview(previous => {
            const cosmetics = previous ?? saved, appearance = resolveIslandAppearance(cosmetics);
            for (const key of slot ? [slot] : ISLAND_APPEARANCE_PART_SLOTS[partId]) appearance.slots[key] = savedAppearance.slots[key];
            return { ...cosmetics, appearance };
        }); browse();
    }, [accepting, browse]);
    const execute = useCallback((request: IslandCustomizationRequest): Promise<IslandRecord | undefined> => {
        if (running.current) return running.current;
        const current = owner.current.island; if (!current || !accepting()) return Promise.resolve(undefined);
        const profileId = current.profileId, started = epoch.current;
        const owned = () => owner.current.mounted && owner.current.island?.profileId === profileId;
        const publish = (updated: IslandRecord) => {
            if (owner.current.island!.revision <= updated.revision) owner.current.island = updated;
            owner.current.onSaved(owner.current.island!);
        };
        setError(undefined); setCanRetry(false);
        const promise = (async () => {
            const result = await run(async () => {
                if (!accepting() || !owned() || epoch.current !== started) return { deferred: true as const };
                try { return { island: await executeIslandCustomizationRequest({ current: request }, request.revision, request.action,
                    intent => customizeIsland(profileId, intent.revision, intent.action)) }; }
                catch (cause) { return { cause }; }
            });
            if (!owned()) return;
            if (result && 'island' in result && result.island) {
                if (pending.current === request) pending.current = undefined;
                publish(result.island); setError(undefined); setCanRetry(false);
                if (!accepting() || epoch.current !== started) return;
                const action = request.action;
                if (action.type !== 'desire' && action.type !== 'clear-desire') {
                    setPreview(getIslandCosmetics(owner.current.island!));
                    setSelectionReady(false); setRestore(undefined); setSelectedSlot(undefined);
                    setCelebration(action.type === 'purchase' && !hasIslandCustomizationItem(current, action.itemId)
                        ? `${CUSTOMIZATION_CATALOG.find(item => item.id === action.itemId)!.name}が しまに とどいた！` : undefined);
                }
                return owner.current.island;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandCustomizationConflict) {
                pending.current = undefined;
                try { const latest = await db.islands.get(profileId); if (latest && owned()) publish(latest); } catch { /* Keep the confirmed rejection; never auto-rebase. */ }
                if (owned()) { setPreview(undefined); setSelectionReady(false); setError('しまの ようすを たしかめて、もういちど えらぼう。'); setCanRetry(false); }
            } else {
                setError('そうさの けっかを たしかめよう。'); setCanRetry(true);
            }
        })().finally(() => { if (running.current === promise) running.current = undefined; });
        running.current = promise; return promise;
    }, [accepting, run]);
    const act = useCallback((action: IslandCustomizationAction) => {
        const current = owner.current.island; if (!current || !accepting()) return Promise.resolve(undefined);
        let intent: IslandCustomizationAction;
        try { intent = canonicalIslandCustomizationAction(action); } catch { setError('えらびなおして ためそう。'); return Promise.resolve(undefined); }
        if (pending.current && JSON.stringify(pending.current.action) !== JSON.stringify(intent)) {
            setError('さきの そうさの けっかを たしかめよう。'); setCanRetry(!running.current); return Promise.resolve(undefined);
        }
        const request = pending.current ?? { revision: current.revision, action: Object.freeze(intent) };
        pending.current = request; return execute(request);
    }, [accepting, execute]);
    const retry = useCallback(() => pending.current ? execute(pending.current) : Promise.resolve(undefined), [execute]);
    return { preview, selectedId, selectedSlot, selectionReady, restore, celebration, error, retry: canRetry ? retry : undefined,
        reset, open, browse, select, selectRestore, undoPart, act };
}
