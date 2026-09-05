import { useEffect, useState } from 'react';
import { PARTS } from '../../domain/park/course';
import { simulateCourse } from '../../domain/park/simulation';
import { PART_KINDS, type PartKind } from '../../domain/park/types';
import { PartIcon } from './PartArt';
import { ParkStage } from './ParkStage';
import { beatDuration } from './playback';

function PartDemo({ kind }: { kind: PartKind }) {
    const layout: (PartKind | null)[] = kind === 'bubble' ? ['slide', 'bubble', 'trampoline']
        : kind === 'paint' ? ['paint', 'bubble', 'trampoline'] : ['slide', kind, 'bubble'];
    const beats = simulateCourse(layout);
    const [index, setIndex] = useState(-1);
    const duration = index >= 0 ? beatDuration(beats[index]) : 0;
    useEffect(() => {
        if (index < 0 || index >= beats.length - 1) return;
        const timer = window.setTimeout(() => setIndex(i => i + 1), duration);
        return () => window.clearTimeout(timer);
    }, [index, beats.length, duration]);
    return <div className="park-demo"><ParkStage layout={layout} beat={index >= 0 ? beats[index] : undefined} />
        <button className="park-text-button" onClick={() => setIndex(0)}>▷ うごきを みる</button></div>;
}

export function PartWorkshop({ first, disabled, onChoose, onBack }: {
    first: boolean; disabled: boolean; onChoose: (kind: PartKind) => void; onBack: () => void;
}) {
    const [kind, setKind] = useState<PartKind>(first ? 'bubble' : 'mat');
    const [all, setAll] = useState(false);
    const kinds: readonly PartKind[] = first ? ['bubble'] : all ? PART_KINDS : ['mat', 'bell'];
    return <section className="park-workshop">
        <button className="park-text-button" disabled={disabled} onClick={onBack}>← コースへ もどる</button>
        <h2>つぎは なにを つくる？</h2>
        <div className="park-catalog">{kinds.map(candidate => <button key={candidate} className="park-part" disabled={disabled}
            aria-pressed={kind === candidate} onClick={() => setKind(candidate)}>
            <PartIcon kind={candidate} /><span>{PARTS[candidate].name}</span><small>{PARTS[candidate].effect}</small>
        </button>)}</div>
        {!first && !all && <button className="park-text-button" onClick={() => setAll(true)}>ほかの ぶひんも みる</button>}
        <PartDemo key={kind} kind={kind} />
        <button className="park-button park-primary" disabled={disabled} onClick={() => onChoose(kind)}>{PARTS[kind].name}を つくる</button>
        <p className="park-note">みじかい おべんきょうの あとで、ひとつ つくれるよ。</p>
    </section>;
}
