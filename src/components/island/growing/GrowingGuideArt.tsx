import { useEffect, useState } from 'react';
import type { AchievementId, GuidanceEvidence } from '../../../domain/growingIsland';
import welcome from '../../../assets/growing-guide/welcome-pop-v1.webp?inline';
import grow from '../../../assets/growing-guide/grow-pop-v1.webp?inline';
import color from '../../../assets/growing-guide/color-pop-v1.webp?inline';
import move from '../../../assets/growing-guide/move-pop-v1.webp?inline';
import music from '../../../assets/growing-guide/music-pop-v1.webp?inline';
import expand from '../../../assets/growing-guide/expand-pop-v1.webp?inline';

const illustrations: Record<AchievementId, string> = { A1: welcome, A2: grow, A3: color, A4: move, A5: music, A6: expand };

/** Pop illustrations invite play; a separate portrait depicts the immutable saved object. */
export function GrowingGuideArt({ id, evidence, className = '' }: { id: AchievementId; evidence?: GuidanceEvidence; className?: string }) {
    const request = JSON.stringify({ id, evidence });
    return <span className={`growing-guide-art ${evidence ? 'growing-guide-art-memory' : ''} ${className}`} data-guide-art={id} data-art-candidate="guide-pop-toys-v6"
        data-memory-flag={evidence?.snapshot.flagColor}>
        <img className="growing-guide-illustration" src={illustrations[id]} width={720} height={480} alt="" />
        {evidence && <ModelPicture key={request} request={request} />}
    </span>;
}

function ModelPicture({ request }: { request: string }) {
    const [picture, setPicture] = useState<string>();
    useEffect(() => {
        let live = true;
        const { id, evidence } = JSON.parse(request) as { id: AchievementId; evidence?: GuidanceEvidence };
        void import('./guideMemoryPictures').then(module => module.guidePicture(id, evidence))
            .then(url => { if (live) setPicture(url); }).catch(() => { /* Saved memory and navigation remain available. */ });
        return () => { live = false; };
    }, [request]);
    return picture ? <span className="growing-guide-personal">
        <img data-memory-picture src={picture} width={600} height={400} alt="" /><span>あのときの すがた</span>
    </span> : null;
}
