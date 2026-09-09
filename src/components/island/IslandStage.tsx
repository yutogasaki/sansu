import { ISLAND_VISUAL_CANDIDATE } from '../../domain/island/feature';
import { useEffect, useRef, useState } from 'react';
import type { IslandScene } from './three/runtime';
import type { IslandStageProps } from './three/types';
import type { ReactNode } from 'react';
import { IslandCameraToolbar } from './IslandCameraToolbar';
import { canControlIslandCamera, initialIslandCameraView, type IslandCameraView } from './three/islandCameraControls';
import './IslandStage.css';

const DEFAULT_CAPTION = 'カワウソと ウサギが くらす しま';
const deliveredState = (props: IslandStageProps, sharedId?: string): IslandStageProps => ({ ...props,
    sharedRequest: props.sharedRequest?.command.type === 'stop' || props.sharedRequest?.id === sharedId ? props.sharedRequest : undefined });

export function IslandStage(props: IslandStageProps & { milestoneNotice?: ReactNode; expressionCaptionKey?: string }) {
    const host = useRef<HTMLDivElement>(null);
    const runtime = useRef<IslandScene | null>(null);
    const current = useRef(props);
    const failedPlayId = useRef<string | undefined>(undefined);
    const capturedPhotoId = useRef<string | undefined>(undefined);
    const scrolledPhotoId = useRef<string | undefined>(undefined);
    const handledSharedId = useRef<string | undefined>(undefined);
    const deliveredSharedId = useRef<string | undefined>(undefined);
    const [captionState, setCaption] = useState<{ text: string; context?: string }>({ text: DEFAULT_CAPTION });
    const caption = captionState.context === props.expressionCaptionKey ? captionState.text : DEFAULT_CAPTION;
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [cameraView, setCameraView] = useState<IslandCameraView>(initialIslandCameraView);
    const cameraEnabled = canControlIslandCamera(props);
    const workshopActive = Boolean(props.workshop?.active && !failed);
    const sharedActive = Boolean(props.shared?.active && !failed);
    const { sharedRequest, onSharedFeedback } = props;
    const sharedEnabled = props.shared?.active;
    const sceneLabel = workshopActive
        ? props.workshop?.mode === 'build' ? 'みぞと 水車を つなぐ いりえ' : 'ものを しらべる いりえ'
        : props.learningKeepsakes && !props.learning ? 'しまの いえ。だいじなものと まなびの きねん'
        : sharedActive ? 'しまの かざりと なかま'
        : props.expressionFlagFocus && !props.learning ? 'しまの はたと かざり'
        : props.preview ? 'しまの ものを おく ばしょを えらんでいるよ'
        : props.expressionCaptionKey && caption === DEFAULT_CAPTION ? 'なかまの みじたくと しまの けしき' : caption;

    useEffect(() => {
        current.current = props;
        runtime.current?.update(deliveredState(props, deliveredSharedId.current));
    }, [props]);

    useEffect(() => {
        const cancelUnsent = () => { if (document.hidden) handledSharedId.current = current.current.sharedRequest?.id; };
        document.addEventListener('visibilitychange', cancelUnsent);
        return () => document.removeEventListener('visibilitychange', cancelUnsent);
    }, []);

    useEffect(() => {
        const request = sharedRequest;
        if (!request || handledSharedId.current === request.id) return;
        if (request.command.type === 'stop') { handledSharedId.current = request.id; deliveredSharedId.current = request.id; return; }
        if (!sharedEnabled || document.hidden) { handledSharedId.current = request.id; return; }
        host.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
        if (!failed && !ready) return;
        handledSharedId.current = request.id;
        if (failed) { onSharedFeedback?.('しまを もういちど ひらいてから ためそう。'); return; }
        let cancelled = false, secondFrame: number | undefined;
        const hidden = () => { if (document.hidden) cancelled = true; };
        document.addEventListener('visibilitychange', hidden);
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                if (cancelled || document.hidden || !current.current.shared?.active || current.current.sharedRequest?.id !== request.id) return;
                deliveredSharedId.current = request.id;
                runtime.current?.update(deliveredState(current.current, request.id));
            });
        });
        return () => {
            cancelled = true; cancelAnimationFrame(firstFrame); if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
            document.removeEventListener('visibilitychange', hidden);
        };
    }, [sharedRequest, sharedEnabled, onSharedFeedback, failed, ready]);

    useEffect(() => {
        const id = props.photoRequestId;
        if (!id || capturedPhotoId.current === id) return;
        if (scrolledPhotoId.current !== id) {
            scrolledPhotoId.current = id;
            host.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
        if (!failed && !ready) return;
        let secondFrame: number | undefined;
        // IntersectionObserver must see the actual canvas before the shutter.
        // The preview below it may have moved the next-shot button offscreen.
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                if (current.current.photoRequestId !== id || document.hidden || capturedPhotoId.current === id) return;
                capturedPhotoId.current = id;
                let frame: string | undefined;
                try { if (!failed) frame = runtime.current?.captureImage(); } catch { /* UI reports an unavailable frame. */ }
                current.current.onPhoto?.(id, frame);
            });
        });
        return () => { cancelAnimationFrame(firstFrame); if (secondFrame !== undefined) cancelAnimationFrame(secondFrame); };
    }, [props.photoRequestId, failed, ready]);

    useEffect(() => {
        const request = props.playRequest;
        if (!failed || !request || failedPlayId.current === request.id) return;
        failedPlayId.current = request.id;
        props.onPlayResult?.({ requestId: request.id, itemId: request.itemId, status: 'unavailable', reason: 'renderer' });
    }, [failed, props]);

    useEffect(() => {
        setReady(false);
        let disposed = false;
        let failedThisAttempt = false;
        const fail = () => {
            if (disposed) return;
            failedThisAttempt = true;
            setCaption({ text: 'しまが うまく みえないよ', context: current.current.expressionCaptionKey });
            setFailed(true);
        };
        void import('./three/runtime').then(({ IslandScene: Scene }) => {
            if (disposed || !host.current) return;
            try {
                setCaption({ text: DEFAULT_CAPTION, context: current.current.expressionCaptionKey });
                const scene = new Scene(host.current, {
                    home: () => current.current.onHomeEnter?.(),
                    homeAction: action => current.current.onHomeAction?.(action),
                    ground: point => current.current.onGroundPoint?.(point),
                    select: id => current.current.onItemSelect?.(id),
                    playResult: result => current.current.onPlayResult?.(result),
                    placementSuggestion: suggestion => current.current.onPlacementSuggestion?.(suggestion),
                    furniturePlacement: result => current.current.onFurniturePlacement?.(result),
                    discovery: (id, itemId) => current.current.onDiscovery?.(id, itemId),
                    workshopAction: action => current.current.onWorkshopAction?.(action),
                    workshopSpecimenSelect: id => current.current.onWorkshopSpecimenSelect?.(id),
                    workshopPartSelect: id => current.current.onWorkshopPartSelect?.(id),
                    workshopFeedback: kind => current.current.onWorkshopFeedback?.(kind),
                    sharedAction: action => current.current.onSharedAction?.(action),
                    sharedDisplaySelect: id => current.current.onSharedDisplaySelect?.(id),
                    sharedFeedback: value => current.current.onSharedFeedback?.(value),
                    caption: value => { if (!disposed && !failedThisAttempt) setCaption({ text: value, context: current.current.expressionCaptionKey }); },
                    failure: fail,
                    cameraView: setCameraView,
                    ready: () => {
                        if (disposed || failedThisAttempt) return;
                        setReady(true);
                        if (attempt === 0) return;
                        failedPlayId.current = undefined;
                        current.current.onRendererRecovered?.();
                    },
                }, attempt > 0 ? current.current.playRequest?.id : undefined, attempt > 0 ? current.current.workshopRequest?.id : undefined,
                    attempt > 0 ? current.current.sharedRequest?.id : undefined);
                runtime.current = scene;
                scene.update(deliveredState(current.current, deliveredSharedId.current));
            } catch { fail(); }
        }).catch(fail);
        return () => { disposed = true; runtime.current?.dispose(); runtime.current = null; };
    }, [attempt]);

    return <figure className={`island-stage${props.learning ? ' island-stage--learning' : ''}${props.preview ? ' island-stage--placing' : ''}${cameraEnabled ? ' island-stage--viewing' : ''}${props.workshop?.active ? ' island-stage--workshop' : ''}`}
        onPointerDownCapture={props.workshop?.active ? props.onWorkshopGesture : undefined} onKeyDownCapture={props.workshop?.active ? props.onWorkshopGesture : undefined}
        data-art-candidate={ISLAND_VISUAL_CANDIDATE} data-visual-candidate={ISLAND_VISUAL_CANDIDATE}
        data-island-theme={props.cosmetics?.themeId ?? 'moon-garden'} data-island-accent={props.cosmetics?.accentId ?? 'none'}
        data-customization-candidate="island-cosmetics-parts-v2" data-experience-candidate="island-experience-v1"
        data-expression-candidate="island-expression-v1"
        data-keepsake-room={props.learningKeepsakes && !props.learning ? 'true' : undefined}
        data-flag-focus={props.expressionFlagFocus && !props.learning ? 'true' : undefined}
        data-workshop-candidate={props.workshop?.active ? 'island-workshop-v1' : undefined}>
        <div className="island-stage__viewport">
            <div className="island-stage__canvas" ref={host} role="img" aria-label={sceneLabel}
                data-testid="island-stage" data-renderer={failed ? 'fallback' : 'loading'} hidden={failed} />
            {failed && <div className="island-stage__fallback" role="img" aria-label={caption}>
                <span className="island-stage__fallback-land" aria-hidden="true">⌂</span>
                <p>しまが うまく みえないよ。<br />もんだいと もちものは つかえるよ。</p>
                <button type="button" className="island-stage__retry" onClick={() => { setCaption({ text: 'しまを ひらいているよ', context: props.expressionCaptionKey }); setFailed(false); setAttempt(value => value + 1); }}>もういちど みる</button>
            </div>}
            {!failed && props.milestoneNotice}
        </div>
        {!failed && cameraEnabled && <div className="island-stage__controls">
            <IslandCameraToolbar view={cameraView} disabled={props.photographing} onAction={action => runtime.current?.controlCamera(action)} />
            <p className="island-camera-hint">ひろげて 拡大・なぞって 移動</p>
        </div>}
        <figcaption hidden={workshopActive || sharedActive || Boolean(props.preview) || Boolean(props.expressionCaptionKey) && caption === DEFAULT_CAPTION} className={`island-stage__caption${caption === DEFAULT_CAPTION ? ' island-stage__caption--quiet' : ''}`} aria-live="polite" aria-atomic="true">{caption}</figcaption>
    </figure>;
}

export default IslandStage;
