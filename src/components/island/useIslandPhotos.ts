import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { IslandPhotoConflict, islandPhotoId, validateIslandPhotoBlobs,
    type IslandPhotoInput, type IslandPhotoBlobPair, type IslandPhotoConflictCode, type IslandPhotoAlbumSnapshot } from '../../domain/island/photos';
import { deleteIslandPhoto, readIslandPhotoAlbum, saveIslandPhoto } from '../../domain/island/photosRepository';
import { prepareIslandPhoto } from './islandPhotoCapture';
import type { useIslandActions } from './useIslandActions';

type PhotoSubject = Pick<IslandPhotoInput, 'composition' | 'islandName' | 'targetName' | 'targetKey'>;
type PhotoIntent = { type: 'save'; revision: number; input: IslandPhotoInput; blobs: IslandPhotoBlobPair }
    | { type: 'delete'; revision: number; photoId: string };
type PhotoStatus = 'idle' | 'capturing' | 'saving' | 'saved' | 'error';
interface Shutter { id: string; scope: number; revision: number; subject: PhotoSubject; capturedAt: number }

export const islandPhotoErrorMessage = (code?: IslandPhotoConflictCode) => code === 'full'
    ? 'しゃしんが いっぱいだよ。アルバムで のこす しゃしんを えらぼう。'
    : code === 'quota' ? 'この たんまつに あきが たりないよ。しゃしんは まだ のこせていないよ。'
        : code === 'conflict' ? 'アルバムが かわったよ。いまの アルバムを たしかめよう。'
            : code === 'inactive' ? 'いま ひらいている ひとの アルバムを つかおう。'
                : code === 'invalid' ? 'この しゃしんを ひらけなかったよ。のこっている しゃしんは そのままだよ。'
                    : 'まだ のこせていないよ。もういちど ためせるよ。';

/** A shutter owns one frame, identity and revision until the user leaves or retries. */
export function useIslandPhotos(profileId: string, enabled: boolean,
    run: ReturnType<typeof useIslandActions>['run']) {
    const [status, setStatus] = useState<PhotoStatus>('idle');
    const [error, setError] = useState<string>();
    const [requestId, setRequestId] = useState<string>();
    const [preview, setPreview] = useState<{ input: IslandPhotoInput; blobs: IslandPhotoBlobPair }>();
    const [savedPhotoId, setSavedPhotoId] = useState<string>();
    const [canRetry, setCanRetry] = useState(false);
    const [readAttempt, setReadAttempt] = useState(0);
    const [published, setPublished] = useState<IslandPhotoAlbumSnapshot>();
    const latestAlbum = useRef<IslandPhotoAlbumSnapshot | undefined>(undefined);
    const activeOwner = useRef({ profileId, enabled });
    const scope = useRef(0);
    const mounted = useRef(false);
    const shutter = useRef<Shutter | undefined>(undefined);
    const pending = useRef<PhotoIntent | undefined>(undefined);
    const working = useRef(false);
    const album = useLiveQuery(async () => {
        if (!enabled) return undefined;
        try { return { snapshot: await readIslandPhotoAlbum(profileId), owner: profileId }; }
        catch (cause) { return { error: islandPhotoErrorMessage(cause instanceof IslandPhotoConflict ? cause.code : undefined), owner: profileId }; }
    }, [profileId, enabled, readAttempt]);

    const cancel = useCallback(() => {
        scope.current += 1;
        shutter.current = undefined; pending.current = undefined; working.current = false;
        setRequestId(undefined); setPreview(undefined); setSavedPhotoId(undefined);
        setStatus('idle'); setError(undefined); setCanRetry(false);
    }, []);
    const remember = useCallback((snapshot: IslandPhotoAlbumSnapshot) => {
        if (snapshot.album.profileId !== activeOwner.current.profileId) return;
        const previous = latestAlbum.current;
        if (!previous || previous.album.profileId !== snapshot.album.profileId || previous.album.revision < snapshot.album.revision) {
            // A receipt replay can succeed without another Dexie mutation event.
            // Publish its revision synchronously, before the next shutter gesture.
            latestAlbum.current = snapshot;
            setPublished(snapshot);
        }
    }, []);
    useLayoutEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; scope.current += 1; shutter.current = undefined; pending.current = undefined; };
    }, []);
    useLayoutEffect(() => {
        const changedProfile = activeOwner.current.profileId !== profileId;
        activeOwner.current = { profileId, enabled };
        if (changedProfile) { latestAlbum.current = undefined; setPublished(undefined); }
        if (changedProfile || !enabled) cancel();
        if (enabled && album?.owner === profileId && album.snapshot) remember(album.snapshot);
    }, [album, enabled, profileId, cancel, remember]);
    useEffect(() => {
        const visibility = () => { if (document.hidden) cancel(); };
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, [cancel]);

    const current = (owner: number) => mounted.current && scope.current === owner && activeOwner.current.profileId === profileId
        && activeOwner.current.enabled && !document.hidden;
    const execute = async (intent: PhotoIntent, owner: number) => {
        if (!current(owner)) return;
        working.current = true; setStatus('saving'); setError(undefined); setCanRetry(false);
        let reported = false;
        const result = await run(async () => {
            if (!current(owner)) return undefined;
            try {
                return intent.type === 'save'
                    ? await saveIslandPhoto(profileId, intent.revision, intent.input, intent.blobs)
                    : await deleteIslandPhoto(profileId, intent.revision, intent.photoId);
            } catch (cause) {
                reported = true;
                if (current(owner)) {
                    const code = cause instanceof IslandPhotoConflict ? cause.code : undefined;
                    setError(islandPhotoErrorMessage(code)); setCanRetry(!code || code === 'quota'); setStatus('error');
                }
                return undefined;
            }
        });
        if (!current(owner)) return;
        working.current = false;
        if (!result) {
            if (!reported) { setError(islandPhotoErrorMessage()); setCanRetry(true); setStatus('error'); }
            return;
        }
        remember(result);
        pending.current = undefined; setCanRetry(false);
        if (intent.type === 'save' && (!result.present || !latestAlbum.current?.photos.some(photo => photo.id === result.photoId))) {
            setStatus('error'); setError('この しゃしんは アルバムから はずされているよ。');
        } else {
            setStatus(intent.type === 'save' ? 'saved' : 'idle');
            setSavedPhotoId(intent.type === 'save' ? result.photoId : undefined);
        }
    };

    const capture = (subject: PhotoSubject) => {
        const snapshot = latestAlbum.current;
        if (!current(scope.current) || working.current || snapshot?.album.profileId !== profileId) return;
        cancel(); working.current = true;
        const id = islandPhotoId(profileId, crypto.randomUUID());
        shutter.current = { id, subject: { ...subject }, scope: scope.current,
            revision: snapshot.album.revision, capturedAt: Date.now() };
        setStatus('capturing'); setRequestId(id);
    };
    const consume = (id: string, frame?: string) => {
        const capture = shutter.current;
        if (!capture || capture.id !== id || !current(capture.scope)) return;
        // Consume before decode/hash: remounts and repeated callbacks cannot recapture.
        shutter.current = undefined; setRequestId(undefined);
        void (async () => {
            try {
                if (!frame) throw new Error('No rendered island');
                const prepared = await prepareIslandPhoto(frame, () => current(capture.scope));
                if (!current(capture.scope)) return;
                const input: IslandPhotoInput = { ...capture.subject, id, profileId, capturedAt: capture.capturedAt,
                    image: prepared.image, thumbnail: prepared.thumbnail };
                setPreview({ input, blobs: prepared.blobs });
                await validateIslandPhotoBlobs(input, prepared.blobs);
                if (!current(capture.scope)) return;
                const intent: PhotoIntent = { type: 'save', revision: capture.revision, input, blobs: prepared.blobs };
                pending.current = intent;
                await execute(intent, capture.scope);
            } catch {
                if (!current(capture.scope)) return;
                working.current = false; setStatus('error'); setCanRetry(false);
                setError('まだ しゃしんに できなかったよ。もういちど とってみよう。');
            }
        })();
    };
    const remove = async (photoId: string) => {
        const snapshot = latestAlbum.current;
        if (!current(scope.current) || working.current || snapshot?.album.profileId !== profileId) return false;
        const intent: PhotoIntent = { type: 'delete', revision: snapshot.album.revision, photoId };
        pending.current = intent;
        await execute(intent, scope.current);
        return pending.current === undefined;
    };
    const retry = () => {
        if (pending.current && !working.current && enabled && canRetry) void execute(pending.current, scope.current);
    };
    const queried = album?.owner === profileId ? album.snapshot : undefined;
    const ownedPublished = published?.album.profileId === profileId ? published : undefined;
    const snapshot = !ownedPublished || queried && queried.album.revision > ownedPublished.album.revision ? queried : ownedPublished;
    return { snapshot: enabled ? snapshot : undefined,
        readError: album?.owner === profileId ? album.error : undefined,
        retryRead: () => setReadAttempt(value => value + 1), status, error, preview, savedPhotoId, requestId,
        capture, consume, cancel, remove, retry, canRetry, processing: status === 'capturing' || status === 'saving' };
}
