import { ISLAND_VISUAL_CANDIDATE } from '../../domain/island/feature';
import { useEffect, useRef, useState } from 'react';
import type { IslandScene } from './three/runtime';
import type { IslandStageProps } from './three/types';
import type { ReactNode } from 'react';
import './IslandStage.css';

const DEFAULT_CAPTION = 'カワウソと ウサギが くらす しま';

export function IslandStage(props: IslandStageProps & { milestoneNotice?: ReactNode }) {
    const host = useRef<HTMLDivElement>(null);
    const runtime = useRef<IslandScene | null>(null);
    const current = useRef(props);
    const failedPlayId = useRef<string | undefined>(undefined);
    const [caption, setCaption] = useState(DEFAULT_CAPTION);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        current.current = props;
        runtime.current?.update(props);
    }, [props]);

    useEffect(() => {
        const request = props.playRequest;
        if (!failed || !request || failedPlayId.current === request.id) return;
        failedPlayId.current = request.id;
        props.onPlayResult?.({ requestId: request.id, itemId: request.itemId, status: 'unavailable', reason: 'renderer' });
    }, [failed, props]);

    useEffect(() => {
        let disposed = false;
        let failedThisAttempt = false;
        const fail = () => {
            if (disposed) return;
            failedThisAttempt = true;
            setCaption('しまが うまく みえないよ');
            setFailed(true);
        };
        void import('./three/runtime').then(({ IslandScene: Scene }) => {
            if (disposed || !host.current) return;
            try {
                setCaption(DEFAULT_CAPTION);
                const scene = new Scene(host.current, {
                    ground: point => current.current.onGroundPoint?.(point),
                    select: id => current.current.onItemSelect?.(id),
                    playResult: result => current.current.onPlayResult?.(result),
                    placementSuggestion: suggestion => current.current.onPlacementSuggestion?.(suggestion),
                    discovery: (id, itemId) => current.current.onDiscovery?.(id, itemId),
                    caption: value => { if (!disposed && !failedThisAttempt) setCaption(value); },
                    failure: fail,
                    ready: () => {
                        if (attempt === 0 || disposed || failedThisAttempt) return;
                        failedPlayId.current = undefined;
                        current.current.onRendererRecovered?.();
                    },
                }, attempt > 0 ? current.current.playRequest?.id : undefined);
                runtime.current = scene;
                scene.update(current.current);
            } catch { fail(); }
        }).catch(fail);
        return () => { disposed = true; runtime.current?.dispose(); runtime.current = null; };
    }, [attempt]);

    return <figure className={`island-stage${props.learning ? ' island-stage--learning' : ''}${props.preview ? ' island-stage--placing' : ''}`}
        data-art-candidate={ISLAND_VISUAL_CANDIDATE} data-visual-candidate={ISLAND_VISUAL_CANDIDATE}
        data-island-theme={props.cosmetics?.themeId ?? 'moon-garden'} data-island-accent={props.cosmetics?.accentId ?? 'none'}
        data-customization-candidate="island-cosmetics-v1">
        <div className="island-stage__canvas" ref={host} role="img" aria-label={caption}
            data-testid="island-stage" data-renderer={failed ? 'fallback' : 'loading'} hidden={failed} />
        {failed && <div className="island-stage__fallback" role="img" aria-label={caption}>
            <span className="island-stage__fallback-land" aria-hidden="true">⌂</span>
            <p>しまが うまく みえないよ。<br />もんだいと もちものは つかえるよ。</p>
            <button type="button" className="island-stage__retry" onClick={() => { setCaption('しまを ひらいているよ'); setFailed(false); setAttempt(value => value + 1); }}>もういちど みる</button>
        </div>}
        {!failed && props.milestoneNotice}
        <figcaption className={`island-stage__caption${caption === DEFAULT_CAPTION ? ' island-stage__caption--quiet' : ''}`} aria-live="polite" aria-atomic="true">{caption}</figcaption>
    </figure>;
}

export default IslandStage;
