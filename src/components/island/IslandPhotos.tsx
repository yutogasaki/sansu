import { IslandPanelHeading } from './IslandPanelHeading';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Download, Image, RotateCcw, Trash2 } from 'lucide-react';
import { loadIslandPhotoBlobs, loadIslandPhotoThumbnail } from '../../domain/island/photosRepository';
import type { IslandPhotoMetadata } from '../../domain/island/photos';
import { downloadStoredIslandPhoto } from './islandPhotoCapture';
import type { useIslandPhotos } from './useIslandPhotos';
import { IslandAlbumBinding, IslandAlbumStamp, type IslandAlbumDecoration } from './IslandAlbumDecoration';
import './IslandPhotos.css';
import './IslandPanel.css';
import { useIslandNavigation } from './useIslandNavigation';

type PhotoState = ReturnType<typeof useIslandPhotos>;

function usePhotoUrl(blob?: Blob) {
    const [image, setImage] = useState<{ blob: Blob; url: string }>();
    useEffect(() => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setImage({ blob, url });
        return () => URL.revokeObjectURL(url);
    }, [blob]);
    return image?.blob === blob ? image?.url : undefined;
}

function PhotoPreview({ blob, name }: { blob: Blob; name: string }) {
    const url = usePhotoUrl(blob);
    return url ? <img src={url} alt={`${name}の とった しゃしん`} /> : <p role="status">しゃしんを ひらいているよ…</p>;
}

export function IslandPhotoCamera({ photos, targets, targetId, disabled, onTarget, onCapture, onGallery, onClose, onLearn }: {
    photos: PhotoState; targets: { id: string; label: string }[]; targetId: string; disabled: boolean;
    onTarget: (id: string) => void; onCapture: () => void; onGallery: () => void; onClose: () => void; onLearn: () => void;
}) {
    return <section className="island-sheet island-panel island-photo-camera" data-testid="island-photo-camera" data-photo-status={photos.status}>
        <IslandPanelHeading title="しゃしんを とる" kind="close" onExit={onClose} disabled={disabled} exitAriaLabel="カメラを とじる" />
        <div className="island-photo-targets island-panel-choices" role="group" aria-label="うつす もの">{targets.map(target =>
            <button key={target.id} className="island-secondary" aria-pressed={targetId === target.id}
                disabled={disabled || photos.processing} onClick={() => onTarget(target.id)}>{target.label}</button>)}</div>
        {photos.preview && <figure className="island-photo-preview" data-photo-saved={photos.status === 'saved'}>
            <PhotoPreview blob={photos.preview.blobs.image} name={photos.preview.input.targetName ?? photos.preview.input.islandName} />
            <figcaption>{photos.status === 'saved' ? 'しゃしんの たなに のこしたよ。'
                : photos.status === 'saving' ? 'しゃしんの たなに のこしているよ…' : 'まだ のこせていない しゃしん'}</figcaption>
        </figure>}
        {photos.error && <p className="island-photo-error" role="alert">{photos.error}</p>}
        {photos.readError && <p className="island-photo-error" role="alert">{photos.readError}
            <button className="island-text-button" onClick={photos.retryRead}>もういちど ひらく</button></p>}
        <div className="island-photo-actions">
            <button className="island-primary" data-photo-action="capture" disabled={disabled || photos.processing || !photos.snapshot} onClick={onCapture}>
                <Camera size={22} />{photos.status === 'capturing' ? 'しゃしんに しているよ…' : photos.preview ? 'もう 1まい とる' : 'しゃしんを とる'}</button>
            {photos.canRetry && <button className="island-secondary" disabled={disabled || photos.processing} onClick={photos.retry}><RotateCcw size={18} />もういちど のこす</button>}
            {photos.preview && <button className="island-secondary" onClick={() => downloadStoredIslandPhoto(photos.preview!.blobs.image)}><Download size={18} />PNGで とりだす</button>}
            <button className="island-secondary" disabled={disabled} onClick={onGallery}><Image size={18} />しゃしんを みる</button>
        </div>
        <button className="island-text-button island-photo-learn" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} /></button>
    </section>;
}

function PhotoImage({ photo }: { photo: IslandPhotoMetadata }) {
    const [loaded, setLoaded] = useState<{ blob?: Blob; error?: boolean }>();
    useEffect(() => {
        let alive = true;
        void loadIslandPhotoThumbnail(photo.profileId, photo.id).then(blob => {
            if (alive) setLoaded(blob ? { blob } : { error: true });
        }).catch(() => { if (alive) setLoaded({ error: true }); });
        return () => { alive = false; };
    }, [photo.profileId, photo.id]);
    const url = usePhotoUrl(loaded?.blob);
    return url ? <img src={url} alt={`${photo.targetName ?? photo.islandName}の しゃしん`} />
        : <span className="island-photo-loading" role="status">{loaded?.error ? 'しゃしんを ひらけなかったよ' : 'ひらいているよ…'}</span>;
}

function PhotoDetail({ photo, photos, decoration, disabled, onRemove }: { photo: IslandPhotoMetadata; photos: PhotoState; decoration?: IslandAlbumDecoration; disabled: boolean; onRemove: (id: string) => void }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [downloadError, setDownloadError] = useState(false);
    const [readAttempt, setReadAttempt] = useState(0);
    const deleteTrigger = useRef<HTMLButtonElement>(null);
    const cancelDelete = useRef<HTMLButtonElement>(null);
    const dismissDelete = () => { setConfirmDelete(false); deleteTrigger.current?.focus({ preventScroll: true }); };
    useEffect(() => { if (confirmDelete) cancelDelete.current?.focus(); }, [confirmDelete]);
    // Leaving or changing profile cancels delivery of a delayed image read.
    const [exportBlob, setExportBlob] = useState<Blob>();
    useEffect(() => {
        let alive = true;
        setExportBlob(undefined); setDownloadError(false);
        void loadIslandPhotoBlobs(photo.profileId, photo.id).then(blobs => {
            if (alive) { if (blobs) setExportBlob(blobs.image); else setDownloadError(true); }
        }).catch(() => { if (alive) setDownloadError(true); });
        return () => { alive = false; };
    }, [photo.profileId, photo.id, readAttempt]);
    return <article className="island-photo-detail" data-photo-id={photo.id}>
        <figure>{exportBlob ? <PhotoPreview blob={exportBlob} name={photo.targetName ?? photo.islandName} />
            : <p role="status">{downloadError ? 'しゃしんを ひらけなかったよ' : 'ひらいているよ…'}</p>}<figcaption><strong>{photo.targetName ?? photo.islandName}</strong>
            <span>{photo.islandName} · {new Date(photo.capturedAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</span></figcaption><IslandAlbumStamp decoration={decoration} /></figure>
        <div className="island-photo-actions"><button className="island-secondary" disabled={!exportBlob}
            onClick={() => exportBlob && downloadStoredIslandPhoto(exportBlob)}><Download size={18} />PNGで とりだす</button>
            <button ref={deleteTrigger} className="island-text-button" disabled={disabled || photos.processing} onClick={() => setConfirmDelete(true)}><Trash2 size={17} />この しゃしんを はずす</button></div>
        {downloadError && <div className="island-photo-error" role="alert"><p>しゃしんを ひらけなかったよ。もういちど ためせるよ。</p>
            <button className="island-secondary" disabled={disabled || photos.processing} onClick={() => setReadAttempt(value => value + 1)}>しゃしんを ひらきなおす</button></div>}
        {confirmDelete && <div className="island-photo-delete" role="group" aria-label="しゃしんを はずす かくにん" onKeyDown={event => {
            if (event.key === 'Escape' && !disabled && !photos.processing) { event.preventDefault(); event.stopPropagation(); dismissDelete(); }
        }}><p>この しゃしんを たなから はずす？</p>
            <button ref={cancelDelete} className="island-secondary" disabled={disabled || photos.processing} onClick={dismissDelete}>のこしておく</button>
            <button className="island-secondary" disabled={disabled || photos.processing} onClick={() => onRemove(photo.id)}>はずす</button></div>}
    </article>;
}

export function IslandPhotoAlbumPreview({ photo, decoration }: { photo?: IslandPhotoMetadata; decoration: IslandAlbumDecoration }) {
    return <div className="island-photo-album-preview" aria-label="アルバムの おためし"><IslandAlbumBinding decoration={decoration}>
        <figure>{photo ? <PhotoImage key={photo.id} photo={photo} /> : <div className="island-photo-empty"><Camera size={36} /><span>しゃしんを のこす ばしょ</span></div>}
            <figcaption>{photo ? photo.targetName ?? photo.islandName : 'すきな けしきを ここに'}</figcaption><IslandAlbumStamp decoration={decoration} /></figure>
    </IslandAlbumBinding></div>;
}

export function IslandPhotoGallery({ photos, decoration, disabled, onCamera, onClose, onLearn }: {
    photos: PhotoState; decoration?: IslandAlbumDecoration; disabled: boolean; onCamera: () => void; onClose: () => void; onLearn: () => void;
}) {
    const navigation = useIslandNavigation();
    const [localSelectedId, setLocalSelectedId] = useState<string>();
    const selectedId = navigation ? navigation.photoId : localSelectedId;
    const activeSelection = useRef(selectedId);
    useLayoutEffect(() => {
        activeSelection.current = selectedId;
        return () => { activeSelection.current = undefined; };
    }, [selectedId]);
    const setSelectedId = (id?: string) => {
        if (navigation) { if (id) navigation.open(`/island?view=photos&photo=${encodeURIComponent(id)}`); else navigation.back(); }
        else setLocalSelectedId(id);
    };
    const remove = async (id: string) => {
        // History can change the selected photo without leaving the live album.
        // The deleted row disappearing alone must not invalidate a genuine completion.
        if (activeSelection.current !== id) return;
        if (await photos.remove(id) && activeSelection.current === id) setSelectedId(undefined);
    };
    const selected = photos.snapshot?.photos.find(photo => photo.id === selectedId);
    return <section className="island-sheet island-panel island-photo-gallery" data-testid="island-photo-gallery">
        <IslandPanelHeading title="しゃしん" kind={selectedId ? 'close' : 'back'}
            onExit={selectedId ? () => setSelectedId(undefined) : onClose} disabled={disabled || photos.processing}
            exitAriaLabel={selectedId ? undefined : 'しゃしんの アルバムから もどる'} />
        {photos.error && <p className="island-photo-error" role="alert">{photos.error}</p>}
        {photos.canRetry && <button className="island-secondary" disabled={disabled || photos.processing} onClick={photos.retry}>もういちど ためす</button>}
        <IslandAlbumBinding decoration={decoration}>{photos.readError ? <p role="alert">{photos.readError}<button className="island-text-button" onClick={photos.retryRead}>もういちど ひらく</button></p>
            : !photos.snapshot ? <p role="status">アルバムを ひらいているよ…</p>
                : selected ? <PhotoDetail key={selected.id} photo={selected} photos={photos} decoration={decoration} disabled={disabled} onRemove={id => { void remove(id); }} />
                    : selectedId ? <div role="status"><p>この しゃしんは いま たなに ないよ。とじると ほかの しゃしんを みられるよ。</p></div>
                    : photos.snapshot.photos.length ? <><p className="island-photo-count">{photos.snapshot.photos.length} / 12まい</p>
                        <div className="island-photo-grid">{photos.snapshot.photos.map(photo => <button key={photo.id} className="island-photo-card"
                            data-photo-id={photo.id} onClick={() => setSelectedId(photo.id)}><PhotoImage photo={photo} />
                            <span>{photo.targetName ?? photo.islandName}</span><small>{new Date(photo.capturedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</small><IslandAlbumStamp decoration={decoration} /></button>)}</div></>
                        : <div className="island-photo-empty"><Camera size={42} aria-hidden="true" /><p>すきな けしきを とって<br />ここに のこそう。</p><IslandAlbumStamp decoration={decoration} /></div>}</IslandAlbumBinding>
        {!selectedId && <div className="island-photo-actions"><button className="island-secondary" disabled={disabled} onClick={onCamera}><Camera size={18} />しゃしんを とる</button>
            {!navigation && <button className="island-primary" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} /></button>}</div>}
    </section>;
}
