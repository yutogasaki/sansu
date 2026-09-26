import { updateLife } from '../../../domain/islandLife/repository';
import { replayLife } from '../../../domain/islandLife/simulation';
import type { LifeUpdateRequest, LifeUpdateResponse } from './lifeUpdateClient';

self.onmessage = async (event: MessageEvent<LifeUpdateRequest>) => {
    const { id, profileId, facts, intent } = event.data;
    try {
        const record = await updateLife(profileId, facts, intent);
        self.postMessage({ id, record, state: replayLife(record) } satisfies LifeUpdateResponse);
    } catch (error) {
        self.postMessage({ id, error: error instanceof Error ? error.message : 'Island update failed' } satisfies LifeUpdateResponse);
    }
};
self.postMessage({ ready: true } satisfies LifeUpdateResponse);
