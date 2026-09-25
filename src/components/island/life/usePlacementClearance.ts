import { PlacementWait } from './placementWait';
import { useCallback, useEffect, useRef, useState } from 'react';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { HOUR, type LifeCommand, type LifeState } from '../../../domain/islandLife/model';
import { placementClearanceEnd, planPlacementClearance } from '../../../domain/islandLife/placementClearance';
import { replayLife } from '../../../domain/islandLife/simulation';
import type { useIslandLife } from './useIslandLife';

/** Wait for a saved retreat to be visibly completed before committing the user's placement. */
export function usePlacementClearance(controls: ReturnType<typeof useIslandLife>, disabled: boolean) {
    const latest = useRef(controls);
    useEffect(() => { latest.current = controls; }, [controls]);
    const disabledRef = useRef(disabled);
    useEffect(() => { disabledRef.current = disabled; }, [disabled]);
    const waiting = useRef(new PlacementWait());
    const [clearing, setClearing] = useState(false);
    const cancel = useCallback(() => {
        waiting.current.cancel(); setClearing(false);
    }, []);
    useEffect(() => cancel, [controls.record?.profileId, cancel]);
    useEffect(() => { if (disabled) cancel(); }, [disabled, cancel]);
    useEffect(() => {
        const changed = () => { if (document.visibilityState !== 'visible') cancel(); };
        document.addEventListener('visibilitychange', changed);
        return () => document.removeEventListener('visibilitychange', changed);
    }, [cancel]);
    const onFrame = useCallback((state: LifeState) => {
        waiting.current.frame(state.now, document.visibilityState === 'visible');
    }, []);
    const prepare = async (command: LifeCommand): Promise<number | undefined> => {
        const record = latest.current.currentRecord();
        if (!record || disabledRef.current) return undefined;
        if (command.type !== 'buy' && command.type !== 'move') return record.revision;
        const token = waiting.current.begin(), profileId = record.profileId;
        const current = () => waiting.current.current(token) && !disabledRef.current && document.visibilityState === 'visible'
            && latest.current.currentRecord()?.profileId === profileId;
        // Match updateLife's bounded wall-clock advance before deciding whether
        // a resident actually needs to step aside. Empty clearances must not
        // write an extra revision and rebuild the whole WebGL world.
        const at = record.now + Math.max(0, Math.min(7 * 24 * HOUR, Date.now() - record.realAt));
        const state = replayLife(record, at), kind = command.type === 'buy' ? command.kind : state.items.find(i => i.id === command.itemId)?.kind;
        if (!kind) return undefined;
        try {
            if (planPlacementClearance(state, { kind, cell: command.cell,
                ...(command.type === 'move' ? { itemId: command.itemId } : {}) }).moves.length === 0) {
                return current() ? record.revision : undefined;
            }
        } catch { /* Preserve the existing authoritative validation and error UI. */ }
        const release = holdPwaUpdateForCriticalPersistence(); setClearing(true);
        try {
            const success = await latest.current.refresh({ id: crypto.randomUUID(), revision: record.revision,
                command: { type: 'clear-placement', kind, cell: command.cell, ...(command.type === 'move' ? { itemId: command.itemId } : {}) } });
            if (!success || !current()) return undefined;
            const cleared = replayLife(latest.current.currentRecord()!);
            const end = placementClearanceEnd(cleared);
            if (end > cleared.now && !await waiting.current.wait(token, end)) return undefined;
            return current() ? latest.current.currentRecord()?.revision : undefined;
        } finally { release(); if (waiting.current.current(token)) setClearing(false); }
    };
    return { prepare, onFrame, cancel, clearing };
}
