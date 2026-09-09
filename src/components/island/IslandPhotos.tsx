import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Download, Image, RotateCcw, Trash2, X } from 'lucide-react';
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
        <div className="island-sheet-title"><h2>しゃしんを とろう</h2>
            <button className="island-icon-button island-panel-back" aria-label="カメラを とじる" disabled={disabled} onClick={onClose}><X size={20} /><span>とじる</span></button></div>
        <div className="island-photo-targets island-panel-choices" role="group" aria-label="うつす もの">{targets.map(target =>
            <button key={target.id} className="island-secondary" aria-pressed={targetId === target.id}
                disabled={disabled || photos.processing} onClick={() => onTarget(target.id)}>{target.label}</button>)}</div>
        {photos.preview && <figure className="island-photo-preview" data-photo-saved={photos.status === 'saved'}>
            <PhotoPreview blob={photos.preview.blobs.image} name={photos.preview.input.targetName ?? photos.preview.input.islandName} />
            <figcaption>{photos.status === 'saved' ? 'アルバムに のこしたよ。'
                : photos.status === 'saving' ? 'アルバムに のこしているよ…' : 'まだ のこせていない しゃしん'}</figcaption>
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

function PhotoDetail({ photo, photos, decoration, disabled, onBack }: { photo: IslandPhotoMetadata; photos: PhotoState; decoration?: IslandAlbumDecoration; disabled: boolean; onBack: () => void }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [downloadError, setDownloadError] = useState(false);
    // Leaving or changing profile cancels delivery of a delayed image read.
    const [exportBlob, setExportBlob] = useState<Blob>();
    useEffect(() => {
        let alive = true;
        void loadIslandPhotoBlobs(photo.profileId, photo.id).then(blobs => {
            if (alive) { if (blobs) setExportBlob(blobs.image); else setDownloadError(true); }
        }).catch(() => { if (alive) setDownloadError(true); });
        return () => { alive = false; };
    }, [photo.profileId, photo.id]);
    return <article className="island-photo-detail" data-photo-id={photo.id}>
        <button className="island-text-button" onClick={onBack}><X size={20} />とじる</button>
        <figure>{exportBlob ? <PhotoPreview blob={exportBlob} name={photo.targetName ?? photo.islandName} />
            : <p role="status">{downloadError ? 'しゃしんを ひらけなかったよ' : 'ひらいているよ…'}</p>}<figcaption><strong>{photo.targetName ?? photo.islandName}</strong>
            <span>{photo.islandName} · {new Date(photo.capturedAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</span></figcaption><IslandAlbumStamp decoration={decoration} /></figure>
        <div className="island-photo-actions"><button className="island-secondary" disabled={!exportBlob}
            onClick={() => exportBlob && downloadStoredIslandPhoto(exportBlob)}><Download size={18} />PNGで とりだす</button>
            <button className="island-text-button" disabled={disabled || photos.processing} onClick={() => setConfirmDelete(true)}><Trash2 size={17} />この しゃしんを はずす</button></div>
        {downloadError && <p role="alert">まだ とりだせなかったよ。ひらきなおして ためそう。</p>}
        {confirmDelete && <div className="island-photo-delete"><p>この しゃしんを アルバムから はずす？</p>
            <button className="island-secondary" disabled={disabled || photos.processing} onClick={() => setConfirmDelete(false)}>のこしておく</button>
            <button className="island-secondary" disabled={disabled || photos.processing} onClick={() => { void photos.remove(photo.id).then(removed => { if (removed) onBack(); }); }}>はずす</button></div>}
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
    const setSelectedId = (id?: string) => {
        if (navigation) { if (id) navigation.open(`/island?view=photos&photo=${encodeURIComponent(id)}`); else navigation.back(); }
        else setLocalSelectedId(id);
    };
    const selected = photos.snapshot?.photos.find(photo => photo.id === selectedId);
    return <section className="island-sheet island-panel island-photo-gallery" data-testid="island-photo-gallery">
        {!selectedId && <div className="island-sheet-title"><h2>しゃしんの アルバム</h2>
            <button className="island-icon-button island-panel-back" disabled={disabled} aria-label="しゃしんの アルバムから もどる" onClick={onClose}><ArrowLeft size={20} /><span>もどる</span></button></div>}
        {photos.error && <p className="island-photo-error" role="alert">{photos.error}</p>}
        {photos.canRetry && <button className="island-secondary" disabled={disabled || photos.processing} onClick={photos.retry}>もういちど ためす</button>}
        <IslandAlbumBinding decoration={decoration}>{photos.readError ? <p role="alert">{photos.readError}<button className="island-text-button" onClick={photos.retryRead}>もういちど ひらく</button></p>
            : !photos.snapshot ? <p role="status">アルバムを ひらいているよ…</p>
                : selected ? <PhotoDetail key={selected.id} photo={selected} photos={photos} decoration={decoration} disabled={disabled} onBack={() => setSelectedId(undefined)} />
                    : selectedId ? <div role="alert"><p>この しゃしんを ひらけなかったよ。</p><button className="island-secondary" onClick={() => setSelectedId(undefined)}><X size={20} />とじる</button></div>
                    : photos.snapshot.photos.length ? <><p className="island-photo-count">{photos.snapshot.photos.length} / 12まい</p>
                        <div className="island-photo-grid">{photos.snapshot.photos.map(photo => <button key={photo.id} className="island-photo-card"
                            data-photo-id={photo.id} onClick={() => setSelectedId(photo.id)}><PhotoImage photo={photo} />
                            <span>{photo.targetName ?? photo.islandName}</span><small>{new Date(photo.capturedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</small><IslandAlbumStamp decoration={decoration} /></button>)}</div></>
                        : <div className="island-photo-empty"><Camera size={42} aria-hidden="true" /><p>すきな けしきを とって<br />ここに のこそう。</p><IslandAlbumStamp decoration={decoration} /></div>}</IslandAlbumBinding>
        {!selectedId && <div className="island-photo-actions"><button className="island-secondary" disabled={disabled} onClick={onCamera}><Camera size={18} />しゃしんを とる</button>
            {!navigation && <button className="island-primary" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} /></button>}</div>}
    </section>;
}
