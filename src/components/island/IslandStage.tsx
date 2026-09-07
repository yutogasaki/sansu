import { ISLAND_VISUAL_CANDIDATE } from '../../domain/island/feature';
import { useEffect, useRef, useState } from 'react';
import type { IslandScene } from './three/runtime';
import type { IslandStageProps } from './three/types';
import './IslandStage.css';

export function IslandStage(props: IslandStageProps) {
    const host = useRef<HTMLDivElement>(null);
    const runtime = useRef<IslandScene | null>(null);
    const current = useRef(props);
    const failedPlayId = useRef<string | undefined>(undefined);
    const [caption, setCaption] = useState('カワウソと ウサギが くらす しま');
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
        void import('./three/runtime').then(({ IslandScene: Scene }) => {
            if (disposed || !host.current) return;
            try {
                const scene = new Scene(host.current, {
                    ground: point => current.current.onGroundPoint?.(point),
                    select: id => current.current.onItemSelect?.(id),
                    playResult: result => current.current.onPlayResult?.(result),
                    placementSuggestion: suggestion => current.current.onPlacementSuggestion?.(suggestion),
                    caption: setCaption,
                    failure: () => setFailed(true),
                });
                runtime.current = scene;
                scene.update(current.current);
            } catch { setFailed(true); }
        }).catch(() => { if (!disposed) setFailed(true); });
        return () => { disposed = true; runtime.current?.dispose(); runtime.current = null; };
    }, [attempt]);

    return <figure className={`island-stage${props.learning ? ' island-stage--learning' : ''}${props.preview ? ' island-stage--placing' : ''}`}
        data-art-candidate={ISLAND_VISUAL_CANDIDATE} data-visual-candidate={ISLAND_VISUAL_CANDIDATE}>
        <div className="island-stage__canvas" ref={host} role="img" aria-label={caption}
            data-testid="island-stage" data-renderer={failed ? 'fallback' : 'loading'} hidden={failed} />
        {failed && <div className="island-stage__fallback" role="img" aria-label={caption}>
            <span className="island-stage__fallback-land" aria-hidden="true">⌂</span>
            <p>しまが うまく みえないよ。<br />もんだいと もちものは つかえるよ。</p>
            <button type="button" className="island-stage__retry" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>もういちど みる</button>
        </div>}
        <figcaption className="island-stage__caption" aria-live="polite" aria-atomic="true">{caption}</figcaption>
    </figure>;
}

export default IslandStage;
