import { readableLifeVersion } from '../../../domain/islandLife/model';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { lifeDb } from '../../../domain/islandLife/repository';
import { emptyDiscoveryJournal, type DiscoveryJournal } from '../../../domain/islandLife/discoveryJournal';

/** Read the latest namespace without ticking the economy or merging learning facts. */
export function useDiscoveryJournal(profileId: string) {
    const [journal, setJournal] = useState<DiscoveryJournal>();
    const [error, setError] = useState(''), [retry, setRetry] = useState(0);
    useEffect(() => {
        setJournal(undefined); setError('');
        const subscription = liveQuery(() => lifeDb.worlds.get(profileId)).subscribe({
            next: world => {
                if (!world || !readableLifeVersion(world.version) || world.discoveryJournal && world.discoveryJournal.version !== 1) {
                    setJournal(undefined); setError('きろくを ひらけなかったよ。'); return;
                }
                setJournal(world.discoveryJournal ?? emptyDiscoveryJournal()); setError('');
            },
            error: () => { setJournal(undefined); setError('きろくを よみこめなかったよ。'); },
        });
        return () => subscription.unsubscribe();
    }, [profileId, retry]);
    return { journal, error, retry: () => setRetry(value => value + 1) };
}
