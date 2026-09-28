import { growthStage, type LifeAction, type LifeRecord, type LifeState, type ResidentId, type LifeItem, type Visit } from './model';
import { homeCell } from './space';

export type FriendId = Exclude<ResidentId, 'pokomoko'>;
export interface ResidencyCutover {
    rules: 'island-friends-v1'; profileId: string; at: number; actionCount: number;
    initialFriends: FriendId[]; priorActions: LifeAction[]; validationHash: string;
}
export interface ResidencyState {
    joined: FriendId[];
    invitations: Partial<Record<FriendId, { at: number; itemIds: string[]; reason: 'flowers' | 'water' | 'shared-meal' }>>;
}
async function digest(value: ResidencyCutover) {
    const { validationHash: ignored, ...payload } = value; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function prepareResidency(record: LifeRecord, newlyCreated: boolean): Promise<LifeRecord> {
    if (record.residencyCutover) {
        validateResidency(record);
        if (record.residencyCutover.validationHash !== await digest(record.residencyCutover)) throw new Error('なかまの記録を確認できません。');
        return { ...record, version: 21 };
    }
    const cutover: ResidencyCutover = { rules: 'island-friends-v1', profileId: record.profileId, at: record.now, actionCount: record.actions.length,
        initialFriends: newlyCreated ? [] : ['rabbit', 'otter'], priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    return { ...record, version: 21, residencyCutover: cutover };
}
export function validateResidency(record: LifeRecord) {
    const c = record.residencyCutover;
    if (record.version === 21 && !c || c && (record.version !== 21 || c.rules !== 'island-friends-v1' || c.profileId !== record.profileId || !record.soilCutover
        || !Number.isFinite(c.at) || !Array.isArray(c.initialFriends) || !Array.isArray(c.priorActions)
        || !/^[a-f0-9]{64}$/.test(c.validationHash)
        || c.at < record.soilCutover.at || c.at > record.now || !Number.isInteger(c.actionCount)
        || c.actionCount < record.soilCutover.actionCount || c.actionCount > record.actions.length
        || new Set(c.initialFriends).size !== c.initialFriends.length || c.initialFriends.some(id => !['rabbit', 'otter'].includes(id))
        || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || record.actions.slice(0, c.actionCount).some(a => a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => a.at < c.at))) throw new Error('なかまの切替記録を確認できません。');
    if (!c && record.actions.some(a => a.command.type === 'invite-friend')) throw new Error('なかまの切替記録がありません。');
}
export function beginResidency(state: LifeState, cutover: ResidencyCutover) {
    state.residency = { joined: [...cutover.initialFriends], invitations: {} };
    state.residents = state.residents.filter(r => r.id === 'pokomoko' || cutover.initialFriends.includes(r.id));
}
export function inviteFriend(state: LifeState, friend: FriendId) {
    if (!['rabbit', 'otter'].includes(friend) || !state.residency) throw new Error('なかまの記録をよみなおしてね。');
    if (state.residency.joined.includes(friend)) return;
    if (!state.residency.invitations[friend]) throw new Error('すきな ばしょが できたら あそびに くるよ。');
    state.residency.joined.push(friend);
    state.residents.push({ id: friend, cell: { ...homeCell }, enjoyed: 0, enjoyedBy: {} });
    state.residents.sort((a, b) => ['pokomoko', 'rabbit', 'otter'].indexOf(a.id) - ['pokomoko', 'rabbit', 'otter'].indexOf(b.id));
}
/** A completed, explicit hero visit supplies the invitation, never a purchase or timer alone. */
export function noticeFriendPlace(state: LifeState, residentId: ResidentId, item: LifeItem | undefined, visit: Visit, heroRequested: boolean) {
    const residence = state.residency;
    if (!residence || residentId !== 'pokomoko' || !item?.cell || (!heroRequested && !visit.observationTest)) return;
    const near = (other: LifeItem) => other.cell && Math.abs(other.cell.x - item.cell!.x) + Math.abs(other.cell.z - item.cell!.z) <= 2;
    const bloom = state.items.find(other => other.kind === 'flower' && growthStage(other) === 2 && near(other));
    const plant = state.items.find(other => ['flower', 'planter'].includes(other.kind) && near(other));
    const friend: FriendId | undefined = item.kind === 'bench' && bloom ? 'rabbit' : item.kind === 'water-bowl' && plant ? 'otter' : undefined;
    if (friend && !residence.joined.includes(friend) && !residence.invitations[friend]) {
        residence.invitations[friend] = { at: state.now, itemIds: [item.id, (friend === 'rabbit' ? bloom : plant)!.id], reason: friend === 'rabbit' ? 'flowers' : 'water' };
    }
}

/** Sustained real deliveries/meals can also welcome a friend; no currency or land gate. */
export function noticeSharedMeals(state: LifeState, tableId: string) {
    if (!state.residency || !state.food || state.food.delivered < 3 || state.food.eaten < 3) return;
    for (const friend of ['rabbit', 'otter'] as const) {
        if (!state.residency.joined.includes(friend) && !state.residency.invitations[friend]) {
            state.residency.invitations[friend] = { at: state.now, itemIds: [tableId], reason: 'shared-meal' };
        }
    }
}
