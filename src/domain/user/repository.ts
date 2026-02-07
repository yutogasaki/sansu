import { db } from "../../db";
import { AppData, UserProfile } from "../types";

const APP_DATA_ID = "app";

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
    const localActive = localStorage.getItem("sansu_active_profile");
    const active = localActive && legacyProfiles.some(p => p.id === localActive)
        ? localActive
        : legacyProfiles[0]?.id || null;
    const appData = buildAppData(legacyProfiles, active);

    await db.appData.put({ id: APP_DATA_ID, ...appData });
    if (active) {
        localStorage.setItem("sansu_active_profile", active);
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
    return appData.profiles[id] || null;
};

export const getAllProfiles = async () => {
    const appData = await getAppData();
    return Object.values(appData.profiles);
};

export const setActiveProfileId = async (id: string) => {
    localStorage.setItem("sansu_active_profile", id);
    const appData = await getAppData();
    await saveAppData({ ...appData, activeProfileId: id });
};

export const getActiveProfileId = () => {
    return localStorage.getItem("sansu_active_profile");
};

export const getActiveProfile = async () => {
    const id = getActiveProfileId();
    if (id) return await getProfile(id);

    const appData = await getAppData();
    if (!appData.activeProfileId) return null;
    localStorage.setItem("sansu_active_profile", appData.activeProfileId);
    return appData.profiles[appData.activeProfileId] || null;
};

export const deleteProfile = async (id: string) => {
    const appData = await getAppData();
    const nextProfiles = { ...appData.profiles };
    delete nextProfiles[id];

    const nextActive = appData.activeProfileId === id ? Object.keys(nextProfiles)[0] || null : appData.activeProfileId;
    await saveAppData({
        ...appData,
        activeProfileId: nextActive,
        profiles: nextProfiles
    });
    await db.profiles.delete(id);
};
