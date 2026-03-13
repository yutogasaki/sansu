import { useState, useEffect, useCallback, useRef } from "react";
import { getActiveProfile, saveProfile } from "../domain/user/repository";
import { UserProfile, MemoryState } from "../domain/types";
import { db } from "../db";

export interface DevPanelState {
    profile: UserProfile | null;
    loading: boolean;
    error: string | null;
}

export const useDevPanel = () => {
    const [state, setState] = useState<DevPanelState>({
        profile: null,
        loading: true,
        error: null
    });
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const updateState = useCallback((updater: DevPanelState | ((prev: DevPanelState) => DevPanelState)) => {
        if (!isMountedRef.current) {
            return;
        }

        setState(updater);
    }, []);

    const syncProfileState = useCallback((profile: UserProfile | null) => {
        updateState(prev => ({ ...prev, profile }));
    }, [updateState]);

    const persistProfile = useCallback(async (profile: UserProfile) => {
        await saveProfile(profile);
        syncProfileState(profile);
    }, [syncProfileState]);

    const loadProfile = useCallback(async () => {
        updateState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const profile = await getActiveProfile();
            updateState({ profile: profile || null, loading: false, error: null });
        } catch (err) {
            updateState({ profile: null, loading: false, error: String(err) });
        }
    }, [updateState]);

    // Load profile on mount
    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    // Update profile field
    const updateProfile = useCallback(async <K extends keyof UserProfile>(
        key: K,
        value: UserProfile[K]
    ) => {
        if (!state.profile) return;

        const updated = { ...state.profile, [key]: value };
        await persistProfile(updated);
    }, [state.profile, persistProfile]);

    // Update nested periodicTestState
    const updatePeriodicTestState = useCallback(async (
        subject: 'math' | 'vocab',
        field: 'isPending',
        value: boolean
    ) => {
        if (!state.profile) return;

        const currentState = state.profile.periodicTestState || {
            math: { isPending: false, lastTriggeredAt: null, reason: null },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null }
        };

        const updated: UserProfile = {
            ...state.profile,
            periodicTestState: {
                ...currentState,
                [subject]: {
                    ...currentState[subject],
                    [field]: value
                }
            }
        };

        await persistProfile(updated);
    }, [state.profile, persistProfile]);

    // Get math memory states
    const getMathMemoryStates = useCallback(async (): Promise<MemoryState[]> => {
        if (!state.profile) return [];
        return db.memoryMath
            .where('profileId').equals(state.profile.id)
            .toArray();
    }, [state.profile]);

    // Get vocab memory states
    const getVocabMemoryStates = useCallback(async (): Promise<MemoryState[]> => {
        if (!state.profile) return [];
        return db.memoryVocab
            .where('profileId').equals(state.profile.id)
            .toArray();
    }, [state.profile]);

    // Update math memory state
    const updateMathMemoryState = useCallback(async (
        skillId: string,
        updates: Partial<MemoryState>
    ) => {
        if (!state.profile) return;

        const existing = await db.memoryMath.get([state.profile.id, skillId]);
        if (existing) {
            await db.memoryMath.put({
                ...existing, ...updates,
                profileId: state.profile.id,
                updatedAt: new Date().toISOString(),
            });
        }
    }, [state.profile]);

    // Update vocab memory state
    const updateVocabMemoryState = useCallback(async (
        wordId: string,
        updates: Partial<MemoryState>
    ) => {
        if (!state.profile) return;

        const existing = await db.memoryVocab.get([state.profile.id, wordId]);
        if (existing) {
            await db.memoryVocab.put({
                ...existing, ...updates,
                profileId: state.profile.id,
                updatedAt: new Date().toISOString(),
            });
        }
    }, [state.profile]);

    return {
        ...state,
        loadProfile,
        updateProfile,
        updatePeriodicTestState,
        getMathMemoryStates,
        getVocabMemoryStates,
        updateMathMemoryState,
        updateVocabMemoryState
    };
};
