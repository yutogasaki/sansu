import { PLACE_CATALOG } from '../../domain/growingIsland/placeCatalog';
import { readable } from '../../domain/growingIsland/syncProjection';
import { derivePlaces } from '../../domain/growingIsland/places';
import { derivePlaceRelations } from '../../domain/growingIsland/placeRelations';
import { isReachable, occupant, reachableFromHome } from '../../domain/growingIsland/space';
import type { GrowingRecord } from '../../domain/growingIsland/repository';
import type { UserProfile } from '../../domain/types';

export const PLACE_PACK_SCHEMA = 'sansu-growing-place-fixtures-v1';
export interface PlaceCase {
    id: string; synthetic: true; conditions: string[]; profile: UserProfile; island: GrowingRecord;
    expected: { places?: { ruleId: string; variant: string }[]; wholePlaces?: { ruleId: string; variant: string }[]; relations?: string[]; families?: string[]; homes?: number; homeStage?: number; realUseRequiredForP06?: boolean };
    projection: { places: ReturnType<typeof derivePlaces>; relations: ReturnType<typeof derivePlaceRelations> };
}
export interface PlacePack {
    schema: typeof PLACE_PACK_SCHEMA; synthetic: true; epoch: number; timezone: string;
    sourceHash: string; sources: Record<string, string>; payloadHash: string; cases: PlaceCase[];
}
export const stableJSON = (value: unknown): string => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export async function hashJSON(value: unknown) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJSON(value)));
    return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}
function requireValue(valid: unknown, text: string): asserts valid { if (!valid) throw new Error(text); }

/** The file is a local, explicitly synthetic fixture, never a child's backup or earned history. */
export async function parsePlacePack(text: string): Promise<PlacePack> {
    requireValue(text.length <= 6_000_000, '診断ファイルが大きすぎます。');
    const pack = JSON.parse(text) as PlacePack;
    requireValue(pack?.schema === PLACE_PACK_SCHEMA && pack.synthetic === true, '育つ場所の診断ファイルを選んでください。');
    requireValue(Array.isArray(pack.cases) && pack.cases.length === 20, '15 配置・4 組み合わせ・島全体の 20 件が必要です。');
    requireValue(/^[a-f0-9]{64}$/.test(pack.sourceHash) && /^[a-f0-9]{64}$/.test(pack.payloadHash), 'ファイルの版情報がありません。');
    requireValue(await hashJSON(pack.cases) === pack.payloadHash && await hashJSON(pack.sources) === pack.sourceHash, 'ファイルの内容とハッシュが一致しません。生成し直してください。');
    const ids = new Set<string>();
    for (const entry of pack.cases) {
        requireValue(/^qa-place-[a-z0-9-]+$/.test(entry.id) && !ids.has(entry.id), '診断 ID が重複しています。'); ids.add(entry.id);
        requireValue(entry.synthetic === true && entry.profile.id === entry.id && entry.island.profileId === entry.id
            && entry.island.state.seed === entry.id && entry.island.version === 4, '診断の所有者・保存版が一致しません。');
        requireValue(entry.profile.todayCount === 0 && !entry.profile.recentAttempts?.length && entry.island.state.learned.length === 0, '診断ファイルに学習の実績を含められません。');
        readable(entry.island);
        const state = entry.island.state, progress = state.placeProgress!;
        requireValue(!Object.keys(progress.uses).length && !Object.keys(progress.shown).length && !progress.useHistory?.length && !progress.milestones.P06, '診断ファイルに実描画・実使用・P06 の実績を含められません。');
        const placed = [...state.plots, ...state.landmarks], reached = reachableFromHome(state);
        requireValue(placed.length <= 160, '診断の配置数が上限を超えています。');
        for (const item of placed) if (item.cell) {
            requireValue(Number.isInteger(item.cell.x) && Number.isInteger(item.cell.z) && !occupant(state, item.cell, item.id), '配置の座標や重なりが一致しません。');
            if (item.kind === 'home') requireValue(isReachable(item.cell, reached), '家への経路がありません。');
        }
        const places = derivePlaces(state), relations = derivePlaceRelations(state, places);
        requireValue(stableJSON({ places, relations }) === stableJSON(entry.projection), '現在の実装と診断の形が一致しません。ファイルを生成し直してください。');
        for (const expected of [...entry.expected.places ?? [], ...entry.expected.wholePlaces ?? []]) requireValue(places.some(place => place.ruleId === expected.ruleId && place.variant === expected.variant && place.stage === 'grown'), '成熟した配置の前提が一致しません。');
        if (entry.expected.homes) requireValue(state.plots.filter(plot => plot.kind === 'home' && plot.cell).length === entry.expected.homes, '島全体の家の所有数が一致しません。');
        if (entry.expected.homeStage) requireValue(state.plots.filter(plot => plot.kind === 'home').every(plot => plot.stage === entry.expected.homeStage), '島全体の家の成熟段階が一致しません。');
        for (const expected of entry.expected.relations ?? []) requireValue(relations.some(relation => relation.id === expected), '場所を結ぶ経路が一致しません。');
    }
    for (const goal of PLACE_CATALOG.goals.filter(goal => goal.id !== 'P06')) for (const variant of goal.variants)
        requireValue(ids.has(`qa-place-${goal.id.toLowerCase()}-${variant.id}-v1`), '現在の 15 配置が揃っていません。');
    for (const relation of PLACE_CATALOG.combinations) requireValue(ids.has(`qa-place-${relation.id.toLowerCase()}-v1`), '4 組み合わせが揃っていません。');
    requireValue(ids.has('qa-place-whole-island-v1'), '島全体の診断がありません。');
    return pack;
}

/** Preserve fixture ages and ownership; rebase only the explicit diagnostic opening clock. */
export function preparePlacePreview(entry: PlaceCase, id: string, now: number) {
    requireValue(/^qa-place-preview-[a-z0-9-]+$/.test(id), '新しい診断プロフィールが必要です。');
    const profile = { ...structuredClone(entry.profile), id, name: `配置診断 ${entry.id.slice(9, -3)}`.slice(0, 12) };
    const island = structuredClone(entry.island);
    island.profileId = id; island.state.seed = id; island.revision = 0;
    island.createdAt = now; island.updatedAt = now; island.state.nature.realAt = now;
    readable(island);
    return { profile, island };
}
