import { CATALOG, type LifeItem, type LifeResident, type LifeState, type ResidentId } from '../../../domain/islandLife/model';

const residentNames: Record<ResidentId, string> = { pokomoko: 'ぽこもこ', rabbit: 'うさぎ', otter: 'カワウソ' };

export interface LifeObservationCue {
    id: string;
    residentId: ResidentId;
    itemId: string;
    symbol: '!' | '?';
    message: string;
}

export type LifeObservationSnapshot = Record<string, string>;

function discoveryKey(resident: LifeResident) {
    const discovery = resident.discovery;
    return discovery ? `${discovery.itemId}:${discovery.mood}:${discovery.at}` : undefined;
}

/** Keep only the tiny identity needed to suppress a repeated discovery cue. */
export function observationSnapshot(state: Pick<LifeState, 'residents'>): LifeObservationSnapshot {
    return Object.fromEntries(state.residents.flatMap(resident => {
        const key = discoveryKey(resident);
        return key ? [[resident.id, key]] : [];
    }));
}

/** Turn a newly noticed placed item into a readable, optional cue. */
export function observationTransitions(state: Pick<LifeState, 'residents' | 'items'>,
    previous: Readonly<LifeObservationSnapshot> | undefined): LifeObservationCue[] {
    if (!previous) return [];
    return state.residents.flatMap(resident => {
        const discovery = resident.discovery;
        const key = discoveryKey(resident);
        const item = discovery && state.items.find(candidate => candidate.id === discovery.itemId && candidate.cell);
        if (!discovery || !key || previous[resident.id] === key || !item) return [];
        const label = CATALOG[item.kind].label;
        const curious = discovery.mood === 'curious';
        return [{ id: `${resident.id}:${key}`, residentId: resident.id, itemId: item.id,
            symbol: curious ? '?' as const : '!' as const,
            message: `${residentNames[resident.id]}が ${label}を ${curious ? 'みているよ' : 'みつけたよ'}` }];
    });
}

export function observationItemLabel(item: Pick<LifeItem, 'kind'>) {
    return CATALOG[item.kind].label;
}
