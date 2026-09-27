import { Circle, Moon, Rainbow, Sparkles, Sprout, Star, X } from 'lucide-react';
import type { IslandLearningFeedback } from './learningFeedback';
import { partyStampCount, PARTY_STAMPS, type IslandLearningParty } from '../../domain/island/learningParty';
import pokomoko from '../../assets/pokomoko-learning-poses.webp';
import { PokomokoLearningBurst } from './PokomokoLearningEffects';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';
import './PokomokoLearningFeedback.css';

const stampIcons = [Star, Moon, Rainbow];

/** The scene and counters show saved play; animation never gates the next answer. */
export function IslandAnswerFeedback({ feedback, party, burst, inputCue }: {
    feedback?: IslandLearningFeedback; party: IslandLearningParty; burst?: PokomokoBurst; inputCue?: PokomokoInputCue;
}) {
    const result = feedback?.text ? feedback : undefined;
    const stamps = partyStampCount(party), riding = party.rideRemaining > 0 || Boolean(burst?.riding);
    const pose = burst?.kind ?? (inputCue ? 'input' : 'ready');
    const Icon = result?.kind === 'retry' ? X : result?.kind === 'supported' ? Sprout : Circle;
    const progress = party.streak % 5 || (party.streak ? 5 : 0);
    const vehicle = stamps >= 3 ? 'rainbow' : stamps >= 2 ? 'moon' : 'star';
    const Stamp = stampIcons[Math.max(0, stamps - 1)];
    const headline = result?.kind === 'retry' || result?.kind === 'step' || result?.kind === 'supported' ? result.text
        : burst?.kind === 'stamp' ? `${feedback?.party?.stamp ?? PARTY_STAMPS[Math.max(0, stamps - 1)]}の スタンプ！`
        : riding ? 'ほしのりタイム！' : party.streak ? 'れんぞく せいかい！' : result?.kind === 'correct' ? result.text : 'ひかりを あつめよう';
    return <div className="island-workbench-message pokomoko-learning-feedback" data-feedback-candidate="pokomoko-star-ride-v2"
        data-pose={pose} data-variant={burst?.variant ?? 0} data-riding={riding} data-streak={party.streak} data-charge={party.streak % 5} data-stamps={stamps}>
        <div className="pokomoko-play-scene">
            <svg className="pokomoko-scenery" viewBox="0 0 420 120" preserveAspectRatio="none" aria-hidden="true">
                <g className="pokomoko-clouds" fill="currentColor"><path d="M14 34c-3-12 12-19 18-11 8-15 26-7 24 5 16-4 20 13 7 15H20c-6 0-9-3-6-9Z" /><path d="M321 27c-2-10 9-14 15-9 8-12 22-6 22 4 13-3 19 11 6 14h-35c-7 0-12-4-8-9Z" /></g>
                <path className="pokomoko-hill-far" d="M0 96Q70 67 136 98T280 90T420 87V120H0Z" />
                <path className="pokomoko-hill-near" d="M0 108Q92 92 175 110T320 103T420 104V120H0Z" />
                <path className="pokomoko-ground-stitch" d="M0 115Q92 99 175 117T320 110T420 111" />
            </svg>
            <div className="pokomoko-sky-stars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
            <div className="pokomoko-stamp-shelf" aria-label={`スタンプ ${stamps}こ、ぜんぶで3こ`}>
                {stampIcons.map((StampIcon, i) => <span key={PARTY_STAMPS[i]} data-earned={stamps > i} aria-label={`${PARTY_STAMPS[i]}${stamps > i ? ' もっている' : ' まだ'}`}><StampIcon size={17} fill={stamps > i ? 'currentColor' : 'none'} /></span>)}
            </div>
            <span key={burst?.id ?? 'rest'} className="pokomoko-learning-actor" aria-hidden="true">
                <span className="pokomoko-learning-shadow" />
                <span className="pokomoko-rider">
                    <span className="pokomoko-ride-trail"><i /><i /><i /></span>
                    <span className="pokomoko-vehicle" data-vehicle={vehicle}>{vehicle === 'rainbow' ? <Rainbow /> : vehicle === 'moon' ? <Moon /> : <Star />}</span>
                    <span className="pokomoko-sprite" style={{ backgroundImage: `url(${pokomoko})` }} />
                </span>
                <PokomokoLearningBurst burst={burst} />
            </span>
            {burst && burst.kind !== 'step' && <span key={`light-${burst.id}`} className="pokomoko-caught-light" aria-hidden="true"><Star fill="currentColor" />{burst.light > 0 && <b>+{burst.light}</b>}</span>}
            {burst?.kind === 'stamp' && <span key={`stamp-${burst.id}`} className="pokomoko-new-stamp" aria-hidden="true"><Stamp /></span>}
            <div className="pokomoko-learning-caption" role="status" aria-live="polite" aria-atomic="true">
                <div className="pokomoko-party-headline" data-result={result?.kind ?? 'ready'}>
                    {result && ['retry', 'step', 'supported'].includes(result.kind) ? <Icon size={21} /> : <Sparkles size={17} />}
                    <span>{headline}</span>
                </div>
                <div className="pokomoko-combo-line">
                    <strong key={party.streak} className="pokomoko-combo-number">{party.streak || <Star size={29} />}</strong>
                    <span>{party.streak ? 'れんぞく' : 'ぽこもこと いっしょ'}{riding && party.light < 30 && <b className="pokomoko-double">ひかり ×2</b>}</span>
                </div>
                {riding ? <div className="pokomoko-ride-count">{party.rideRemaining ? <>あと <b>{party.rideRemaining}</b> もん</> : 'とどいた！'} <span aria-hidden="true">{[0, 1, 2].map(i => <Star key={i} size={12} fill={i < party.rideRemaining ? 'currentColor' : 'none'} />)}</span></div>
                    : <div className="pokomoko-combo-goal"><span className="pokomoko-combo-meter" aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <i key={i} data-filled={i <= progress}><Star size={12} fill={i <= progress ? 'currentColor' : 'none'} /></i>)}</span><span>{party.streak % 5 === 4 ? 'つぎで ほしのり！' : '5れんぞくで ほしのり'}</span></div>}
            </div>
        </div>
        <div className="pokomoko-light-collection" aria-label={`あつめた ひかり ${party.light}こ、スタンプ ${stamps}こ`}>
            <Star size={13} fill="currentColor" /><span>{stamps === 3 ? 'スタンプ ぜんぶ あつまった！' : `つぎの スタンプまで あと${10 - party.light % 10}こ`}</span>
            <span className="pokomoko-collection-track" aria-hidden="true"><i style={{ width: `${stamps === 3 ? 100 : party.light % 10 * 10}%` }} /></span>
            <b>{party.light}<small> / 30</small></b>
        </div>
    </div>;
}
