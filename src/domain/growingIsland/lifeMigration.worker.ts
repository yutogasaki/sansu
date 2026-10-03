import { replayLifeForMigration } from './lifeMigration';
import type { LifeMigrationRequest, LifeMigrationResponse } from './lifeMigrationClient';

self.onmessage = async (event: MessageEvent<LifeMigrationRequest>) => {
    try {
        const { record, realNow } = event.data;
        self.postMessage({ state: await replayLifeForMigration(record, realNow) } satisfies LifeMigrationResponse);
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : 'Island migration failed' } satisfies LifeMigrationResponse);
    }
};
