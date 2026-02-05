import { useState, useEffect, useCallback } from "react";
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

    // Load profile on mount
    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const profile = await getActiveProfile();
            setState({ profile, loading: false, error: null });
        } catch (err) {
            setState({ profile: null, loading: false, error: String(err) });
        }
    };

    // Update profile field
    const updateProfile = useCallback(async <K extends keyof UserProfile>(
        key: K,
        value: UserProfile[K]
    ) => {
        if (!state.profile) return;

        const updated = { ...state.profile, [key]: value };
        await saveProfile(updated);
        setState(prev => ({ ...prev, profile: updated }));
    }, [state.profile]);

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

        await saveProfile(updated);
        setState(prev => ({ ...prev, profile: updated }));
    }, [state.profile]);

    // Get math memory states
    const getMathMemoryStates = useCallback(async (): Promise<MemoryState[]> => {
        if (!state.profile) return [];
        const items = await db.memoryMath
            .filter((item: any) => item.profileId === state.profile!.id)
            .toArray();
        return items;
    }, [state.profile]);

    // Get vocab memory states
    const getVocabMemoryStates = useCallback(async (): Promise<MemoryState[]> => {
        if (!state.profile) return [];
        const items = await db.memoryVocab
            .filter((item: any) => item.profileId === state.profile!.id)
            .toArray();
        return items;
    }, [state.profile]);

    // Update math memory state
    const updateMathMemoryState = useCallback(async (
        skillId: string,
        updates: Partial<MemoryState>
    ) => {
        if (!state.profile) return;

        const existing = await db.memoryMath.get([state.profile.id, skillId]);
        if (existing) {
            const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
            await db.memoryMath.put({ ...updated, profileId: state.profile.id });
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
            const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
            await db.memoryVocab.put({ ...updated, profileId: state.profile.id });
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
