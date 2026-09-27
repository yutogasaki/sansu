import { useId, type CSSProperties } from 'react';
import { Moon, Rainbow, Sprout, Star } from 'lucide-react';
import type { IslandLearningFeedback } from './learningFeedback';
import { partyStampCount, PARTY_STAMPS, type IslandLearningParty } from '../../domain/island/learningParty';
import pokomoko from '../../assets/pokomoko-arcade-poses.webp';
import rim from '../../assets/pokomoko-arcade-rim.webp';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';
import './PokomokoLearningFeedback.css';

const sockets = [[53.5, 96], [84.2, 79.4], [125.3, 66.4], [174.8, 60], [222.2, 65.1]];
const stampIcons = [Star, Moon, Rainbow];
const star = 'M0 -15 4.7 -5 15 -3.2 7.5 4.3 9.3 15 0 10 -9.3 15 -7.5 4.3 -15 -3.2 -4.7 -5Z';

/** The sockets and companion stand on the actual problem board, not a separate HUD. */
export function IslandAnswerFeedback({ feedback, party, burst, inputCue }: {
    feedback?: IslandLearningFeedback; party: IslandLearningParty; burst?: PokomokoBurst; inputCue?: PokomokoInputCue;
}) {
    const id = useId().replace(/:/g, '');
    const result = feedback?.text ? feedback : undefined;
    const stamps = partyStampCount(party), riding = party.rideRemaining > 0 || Boolean(burst?.riding);
    const pose = burst?.kind ?? (inputCue ? 'input' : 'ready');
    const progress = riding ? 5 : party.streak % 5 || (party.streak ? 5 : 0);
    const Stamp = stampIcons[Math.max(0, stamps - 1)];
    const message = result && ['retry', 'step', 'supported'].includes(result.kind) ? result.text
        : burst?.kind === 'stamp' ? `${feedback?.party?.stamp ?? PARTY_STAMPS[Math.max(0, stamps - 1)]} ゲット！`
        : riding ? 'ほしのり！' : party.streak % 5 === 4 ? 'あと1つ！' : party.streak ? 'れんぞく！' : result?.kind === 'correct' ? result.text : '';
    return <div className="island-workbench-message pokomoko-learning-feedback" data-feedback-candidate="pokomoko-star-arcade-v4"
        data-pose={pose} data-variant={burst?.variant ?? 0} data-riding={riding} data-streak={party.streak} data-charge={party.streak % 5} data-stamps={stamps}>
        <div className="pokomoko-play-scene">
            <img className="pokomoko-rim-art" src={rim} alt="" aria-hidden="true" />
            <svg className="pokomoko-arcade-rim" viewBox="0 0 360 130" preserveAspectRatio="none" aria-label={`5れんぞくで ほしのり、いま${progress}こ`} role="img">
                <defs>
                    <linearGradient id={`${id}-gold`} x2="0" y2="1"><stop stopColor="#fff3a0" /><stop offset=".3" stopColor="#ffda4a" /><stop offset=".72" stopColor="#f2ad1f" /><stop offset="1" stopColor="#b77717" /></linearGradient>
                    <linearGradient id={`${id}-rainbow`}><stop stopColor="#ed6875" /><stop offset=".25" stopColor="#f4b53c" /><stop offset=".5" stopColor="#39b5ba" /><stop offset=".75" stopColor="#508ee0" /><stop offset="1" stopColor="#9879d2" /></linearGradient>
                </defs>
                {riding && <path className="pokomoko-rim-rainbow" d="M25 108Q180 7 335 108" stroke={`url(#${id}-rainbow)`} strokeWidth="25" fill="none" />}
                {sockets.map(([x, y], i) => <g key={i}
                    transform={`translate(${x} ${y}) scale(.62)`} data-filled={i < progress}
                    data-arriving={Boolean(burst) && burst?.kind !== 'step' && i === progress - 1} className="pokomoko-star-socket">
                    {i < progress && <path d={star} fill={`url(#${id}-gold)`} stroke="#fff2ac" strokeWidth="1.8" strokeLinejoin="round" />}
                </g>)}
            </svg>
            {burst && burst.kind !== 'step' && progress > 0 && <span key={`socket-${burst.id}`} className="pokomoko-socket-flight" aria-hidden="true"
                style={{ '--socket-left': `${sockets[progress - 1][0] / 360 * 100}%`, '--socket-top': `${sockets[progress - 1][1]}px` } as CSSProperties}>
                <Star fill="currentColor" />
            </span>}
            <span key={burst?.id ?? 'rest'} className={`pokomoko-learning-actor${burst ? ' pokomoko-burst' : ''}`} data-burst={burst?.kind} aria-hidden="true">
                <span className="pokomoko-learning-shadow" />
                <span className="pokomoko-rider">
                    <span className="pokomoko-ride-trail"><i /><i /><i /></span>
                    <span className="pokomoko-sprite" style={{ backgroundImage: `url(${pokomoko})` }} />
                </span>
            </span>
            <div className="pokomoko-learning-caption" role="status" aria-live="polite" aria-atomic="true">
                <div className="pokomoko-party-headline" data-result={result?.kind ?? 'ready'}>
                    {result?.kind === 'supported' && <Sprout size={25} />}
                    {party.streak > 0 && !['retry', 'step', 'supported'].includes(result?.kind ?? '') && <strong key={party.streak} className="pokomoko-combo-number">{party.streak}</strong>}
                    <span>{message}</span>
                </div>
                {riding && <span className="pokomoko-ride-lights" aria-label={`ほしのり あと${party.rideRemaining}もん`}>{[0, 1, 2].map(i => <i key={i} data-filled={i < party.rideRemaining} />)}</span>}
            </div>
            {burst?.kind === 'stamp' && <span key={`stamp-${burst.id}`} className="pokomoko-new-stamp" aria-hidden="true"><Stamp /></span>}
            <div className="pokomoko-stamp-shelf" aria-label={`あつめた ひかり ${party.light}こ、スタンプ ${stamps}こ、ぜんぶで3こ`}>
                {stampIcons.map((StampIcon, i) => stamps > i && <span key={PARTY_STAMPS[i]} data-earned="true" aria-label={`${PARTY_STAMPS[i]} もっている`}><StampIcon size={19} fill="currentColor" /></span>)}
            </div>
        </div>
    </div>;
}
