import { db } from "../../db";
import { UserProfile } from "../types";

export const saveProfile = async (profile: UserProfile) => {
    await db.profiles.put(profile);
};

export const getProfile = async (id: string) => {
    return await db.profiles.get(id);
};

export const getAllProfiles = async () => {
    return await db.profiles.toArray();
};

export const setActiveProfileId = (id: string) => {
    localStorage.setItem("sansu_active_profile", id);
};

export const getActiveProfileId = () => {
    return localStorage.getItem("sansu_active_profile");
};

export const getActiveProfile = async () => {
    const id = getActiveProfileId();
    if (!id) return null;
    return await getProfile(id);
};

export const deleteProfile = async (id: string) => {
    await db.profiles.delete(id);
    // Also cleanup logs and memory?
    // For now, keep it simple.
};
