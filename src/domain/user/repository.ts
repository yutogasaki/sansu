import { db, type SansuDatabase } from "../../db";
import { AppData, UserProfile } from "../types";
import { clearProfileStorageData, profileStorage } from "../../utils/storage";

const APP_DATA_ID = "app";

const hydrateProfileMemory = async (profile: UserProfile): Promise<UserProfile> => {
    const [mathMemory, vocabMemory] = await Promise.all([
        db.memoryMath.where("profileId").equals(profile.id).toArray(),
        db.memoryVocab.where("profileId").equals(profile.id).toArray(),
    ]);

    if (mathMemory.length === 0 && vocabMemory.length === 0) {
        return profile;
    }

    const mathSkills = { ...(profile.mathSkills || {}) };
    mathMemory.forEach((memory) => {
        mathSkills[memory.id] = memory;
    });

    const vocabWords = { ...(profile.vocabWords || {}) };
    vocabMemory.forEach((memory) => {
        vocabWords[memory.id] = memory;
    });

    return {
        ...profile,
        mathSkills,
        vocabWords,
    };
};

const buildAppData = (profiles: UserProfile[], activeProfileId: string | null): AppData => {
    const map: Record<string, UserProfile> = {};
    profiles.forEach(p => {
        map[p.id] = p;
    });
    return {
        schemaVersion: 1,
        activeProfileId,
        profiles: map
    };
};

export const getAppData = async (): Promise<AppData> => {
    const stored = await db.appData.get(APP_DATA_ID);
    if (stored) {
        return {
            schemaVersion: stored.schemaVersion,
            activeProfileId: stored.activeProfileId,
            profiles: stored.profiles
        };
    }

    const legacyProfiles = await db.profiles.toArray();
    const localActive = profileStorage.getActiveId();
    const active = localActive && legacyProfiles.some(p => p.id === localActive)
        ? localActive
        : legacyProfiles[0]?.id || null;
    const appData = buildAppData(legacyProfiles, active);

    await db.appData.put({ id: APP_DATA_ID, ...appData });
    if (active) {
        profileStorage.setActiveId(active);
    }

    return appData;
};

export const saveAppData = async (data: AppData) => {
    await db.appData.put({ id: APP_DATA_ID, ...data });
};

export const saveProfile = async (profile: UserProfile) => {
    const appData = await getAppData();
    const updated: AppData = {
        ...appData,
        profiles: {
            ...appData.profiles,
            [profile.id]: profile
        }
    };
    await saveAppData(updated);
    await db.profiles.put(profile);
};

export const getProfile = async (id: string) => {
    const appData = await getAppData();
    const profile = appData.profiles[id];
    return profile ? hydrateProfileMemory(profile) : null;
};

export const getAllProfiles = async () => {
    const appData = await getAppData();
    return Promise.all(Object.values(appData.profiles).map(hydrateProfileMemory));
};

export const setActiveProfileId = async (id: string) => {
    profileStorage.setActiveId(id);
    const appData = await getAppData();
    await saveAppData({ ...appData, activeProfileId: id });
};

export const getActiveProfileId = () => {
    return profileStorage.getActiveId();
};

export const getActiveProfile = async () => {
    const appData = await getAppData();
    const localActiveId = getActiveProfileId();
    const hasProfile = (id: string | null): id is string => Boolean(id && appData.profiles[id]);

    const resolvedActiveId = hasProfile(localActiveId)
        ? localActiveId
        : hasProfile(appData.activeProfileId)
            ? appData.activeProfileId
            : Object.keys(appData.profiles)[0] || null;

    if (!resolvedActiveId) {
        if (localActiveId) {
            profileStorage.clearActiveId();
        }
        if (appData.activeProfileId !== null) {
            await saveAppData({ ...appData, activeProfileId: null });
        }
        return null;
    }

    if (localActiveId !== resolvedActiveId) {
        profileStorage.setActiveId(resolvedActiveId);
    }
    if (appData.activeProfileId !== resolvedActiveId) {
        await saveAppData({ ...appData, activeProfileId: resolvedActiveId });
    }

    return hydrateProfileMemory(appData.profiles[resolvedActiveId]);
};

export const deleteProfileOwnedIndexedDbRows = async (
    database: SansuDatabase,
    id: string,
) => Promise.all([
    database.profiles.delete(id),
    database.logs.where("profileId").equals(id).delete(),
    database.memoryMath.where("profileId").equals(id).delete(),
    database.memoryVocab.where("profileId").equals(id).delete(),
    database.exploreRuns.where("profileId").equals(id).delete(),
    database.exploreRunEvents.where("profileId").equals(id).delete(),
    database.exploreDiscoveries.where("profileId").equals(id).delete(),
]);

export const deleteProfile = async (id: string) => {
    let nextActive: string | null = null;

    await db.transaction(
        "rw",
        [
            db.appData,
            db.profiles,
            db.logs,
            db.memoryMath,
            db.memoryVocab,
            db.exploreRuns,
            db.exploreRunEvents,
            db.exploreDiscoveries,
        ],
        async () => {
            const appData = await getAppData();
            const nextProfiles = { ...appData.profiles };
            delete nextProfiles[id];

            nextActive = appData.activeProfileId === id
                ? Object.keys(nextProfiles)[0] || null
                : appData.activeProfileId;
            await saveAppData({
                ...appData,
                activeProfileId: nextActive,
                profiles: nextProfiles
            });
            await deleteProfileOwnedIndexedDbRows(db, id);
        },
    );

    clearProfileStorageData(id);

    if (nextActive) {
        profileStorage.setActiveId(nextActive);
    } else {
        profileStorage.clearActiveId();
    }
};
