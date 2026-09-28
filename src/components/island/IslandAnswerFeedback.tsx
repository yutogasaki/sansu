import { lazy, Suspense, type CSSProperties } from 'react';
import { Moon, Rainbow, Sprout, Star } from 'lucide-react';
import type { IslandLearningFeedback } from './learningFeedback';
import type { Style } from '../../domain/islandLife/model';
import { partyStampCount, PARTY_STAMPS, type IslandLearningParty } from '../../domain/island/learningParty';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';
import original from '../../assets/pokomoko-learning-poses.webp';

const Actor = lazy(() => import('./PokomokoLearningActor'));
const stampIcons = [Star, Moon, Rainbow];
const colors = ['#386bff', '#ff7ab6', '#ffda46', '#4dd9bb'];

/** A compact stage shares the worksheet's edge. Awards still come from saved receipts. */
export function IslandAnswerFeedback({ feedback, party, burst, inputCue, active = true, level = 0, pulse, onCue, heroStyle }: {
    feedback?: IslandLearningFeedback; party: IslandLearningParty; burst?: PokomokoBurst; inputCue?: PokomokoInputCue;
    active?: boolean; level?: number; pulse?: () => number; onCue?: (kind: 'catch' | 'place' | 'jump' | 'land') => void;
    heroStyle?: Style;
}) {
    const result = feedback?.text ? feedback : undefined;
    const stamps = partyStampCount(party), riding = party.rideRemaining > 0 || Boolean(burst?.riding);
    const pose = burst?.kind ?? (inputCue ? 'input' : 'ready');
    const progress = riding ? 5 : party.streak % 5 || (party.streak ? 5 : 0);
    const peak = Boolean(burst && ['jump', 'ride', 'stamp', 'section'].includes(burst.kind));
    const Stamp = stampIcons[Math.max(0, stamps - 1)];
    const message = result && ['retry', 'step', 'supported'].includes(result.kind) ? result.text
        : burst?.kind === 'stamp' ? `${feedback?.party?.stamp ?? PARTY_STAMPS[Math.max(0, stamps - 1)]} ゲット！`
        : riding ? 'ほしのり！' : party.streak % 5 === 4 ? 'あと1つ！' : party.streak ? 'れんぞく！' : '';
    return <div className={`island-workbench-message pokomoko-learning-feedback${burst ? ' pokomoko-burst' : ''}`}
        data-feedback-candidate="pokomoko-pop-live-v5" data-burst={burst?.kind} data-peak={peak}
        data-pose={pose} data-riding={riding} data-streak={party.streak} data-charge={party.streak % 5} data-stamps={stamps}>
        <div className="pokomoko-play-scene">
            <div className="pokomoko-stage-colors" aria-hidden="true"><i /><i /></div>
            {level > 0 && <svg className="pokomoko-stage-flags" viewBox="0 0 400 36" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 4Q200 28 400 4" fill="none" stroke="#191d48" strokeWidth="2" />
                {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${i * 38 - 5} ${8 + 7 * Math.sin(i / 10 * Math.PI)}l24 0 -12 18Z`} fill={colors[i % 4]} stroke="#191d48" strokeWidth="1.5" />)}
            </svg>}
            {level >= 2 && <div className="pokomoko-stage-stars" aria-hidden="true"><Star /><Star /><Star /></div>}
            {peak && <div key={burst?.id} className="pokomoko-stage-rays" aria-hidden="true" />}
            <div className="pokomoko-charge" role="img" aria-label={`5れんぞくで ほしのり、いま${progress}こ`}>
                {Array.from({ length: 5 }, (_, i) => <span key={i} data-filled={i < progress}><Star fill={i < progress ? 'currentColor' : 'none'} /></span>)}
            </div>
            <Suspense fallback={<span className="pokomoko-learning-actor" aria-hidden="true"><span className="pokomoko-actor-fallback" style={{ backgroundImage: `url(${original})` }} /></span>}>
                <Actor active={active} level={level} inputCue={inputCue} burst={burst} pulse={pulse} onCue={onCue} heroStyle={heroStyle} />
            </Suspense>
            <div className="pokomoko-learning-caption" role="status" aria-live="polite" aria-atomic="true">
                <div className="pokomoko-party-headline" data-result={result?.kind ?? 'ready'}>
                    {result?.kind === 'supported' && <Sprout size={25} />}
                    {party.streak > 0 && !['retry', 'step', 'supported'].includes(result?.kind ?? '') && <strong key={party.streak} className="pokomoko-combo-number" data-long={party.streak >= 100}>{party.streak}</strong>}
                    <span>{message}</span>
                </div>
                {riding && <span className="pokomoko-ride-lights" aria-label={`ほしのり あと${party.rideRemaining}もん`}>{[0, 1, 2].map(i => <i key={i} data-filled={i < party.rideRemaining} />)}</span>}
            </div>
            {burst?.kind === 'stamp' && <span key={`stamp-${burst.id}`} className="pokomoko-new-stamp" aria-hidden="true"><Stamp /></span>}
            {peak && <div key={`confetti-${burst?.id}`} className="pokomoko-stage-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i, '--color': colors[i % 4] } as CSSProperties} />)}</div>}
            <div className="pokomoko-stamp-shelf" aria-label={`あつめた ひかり ${party.light}こ、スタンプ ${stamps}こ、ぜんぶで3こ`}>
                {stampIcons.map((StampIcon, i) => stamps > i && <span key={PARTY_STAMPS[i]} data-earned="true" aria-label={`${PARTY_STAMPS[i]} もっている`}><StampIcon size={19} fill="currentColor" /></span>)}
            </div>
        </div>
    </div>;
}
