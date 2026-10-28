import { KokugoLevelSummary } from '../progress/KokugoLevelSummary';
import { kokugoUnitLevel } from '../../domain/kokugo/progressView';
import { Button } from '../ui/Button';
import type { KokugoCourse } from '../../domain/kokugo/types';
import { KokugoKanjiCatalog } from './KokugoKanjiCatalog';
import { kanjiUnitInfo } from '../../domain/kokugo/kanji/curriculum';
import { useEffect, useState } from 'react';
import { AGE_BANDS, KOKUGO_UNITS, TRACKS } from '../../domain/kokugo/curriculum';
import { itemsForUnit } from '../../domain/kokugo/catalog';
import type { KokugoPlan, KokugoTrack } from '../../domain/kokugo/types';
export function KokugoCatalog({ profileId, band, onBand, busy, pending, onResume, onChoose, onRead, easy = false, course, onContinue, onSaving }: {
    onSaving?: (saving: boolean) => void; easy?: boolean; course?: KokugoCourse; onContinue?: () => void;
    profileId: string; band: number; onBand: (band: number) => void; busy: boolean; pending?: KokugoPlan;
    onResume: () => void; onChoose: (unit: string, target?: string) => void; onRead: () => void;
}) {
    const t = (simple: string, normal: string) => easy ? simple : normal;
    const [track, setTrack] = useState<KokugoTrack>('K');
    useEffect(() => { setTrack(band >= 4 ? 'R' : band >= 2 ? 'H' : 'K'); }, [band]);
    return <section>
        <p className="kokugo-eyebrow">ことばを ひろげる</p><h2 className="kokugo-catalog-title">{t('こくごを まなぼう', '国語を まなぼう')}</h2>
        <p>{t('すきな ないようから はじめよう。がくねんを こえて えらべるよ。', 'すきな 内容から はじめよう。学年を こえて えらべるよ。')}</p>
        {pending && <div className="kokugo-panel"><h2>とちゅうの れんしゅう</h2><button className="kokugo-primary" disabled={busy} onClick={onResume}>つづきから</button>
            <p>ほかの単元は、この区切りの あとで えらべるよ。</p></div>}
        {!pending && course && <div className="kokugo-panel kokugo-continue"><KokugoLevelSummary profileId={profileId} easy={easy} brief />
            <Button disabled={busy} onClick={onContinue}>{t('この つづきを やる', 'この続きから練習する')}</Button></div>}
        <div className="kokugo-band"><label htmlFor="kokugo-band">{t('がくねんの めやす', '学年の めやす')}</label> <select id="kokugo-band" value={band} disabled={busy} onChange={e => onBand(Number(e.target.value))}>{AGE_BANDS.map((title, index) => <option value={index} key={title}>{easy ? title.replace('小学', 'しょうがく').replace('年', 'ねん') : title}</option>)}</select></div>
        <div className="kokugo-tracks" role="group" aria-label="国語の 領域">{TRACKS.map(option => <button aria-pressed={track === option.id} key={option.id} disabled={busy} onClick={() => setTrack(option.id)}>{easy ? ({ K: 'かな', H: 'かんじ', V: 'ことば', S: 'ぶん', R: 'よむ', E: 'つたえる' })[option.id] : option.title}</button>)}</div>
        <p>{easy ? ({ K: 'おとと もじを つなぐ', H: 'ことばの なかで よむ・かく', V: 'いみや つかいかたを ひろげる', S: 'ことばを つないで つたえる', R: 'ぶんの なかの てがかりを みつける', E: 'かく・はなす・かんがえを まとめる' })[track] : TRACKS.find(option => option.id === track)?.description}</p>
        {track === 'H' && <KokugoKanjiCatalog easy={easy} onSaving={onSaving} profileId={profileId} band={band} busy={busy || !!pending} onChoose={onChoose} />}
        <div className="kokugo-units">{KOKUGO_UNITS.filter(unit => unit.track === track && !kanjiUnitInfo(unit.id)).sort((a, b) => Math.abs(a.band - band) - Math.abs(b.band - band)).map(unit => <button data-kokugo-unit={unit.id} key={unit.id} disabled={busy || !!pending} onClick={() => onChoose(unit.id)}>
            <span className="kokugo-eyebrow">{kokugoUnitLevel(unit.id) ? `Lv${kokugoUnitLevel(unit.id)} · ` : ''}{AGE_BANDS[unit.band]}ごろから{Math.abs(unit.band - band) <= 1 ? ' · いまの候補' : ''}</span>
            <strong>{unit.title}</strong><small>{itemsForUnit(unit.id)[0]?.form === 'activity' ? t('かく・はなす かつどう', '書く・話す 活動') : t('れいを みて、3もん', '例を 見て、3もん')}</small>
        </button>)}</div>
        <div className="kokugo-panel"><h2>{t('ほんを よむ', '本を よむ')}</h2><p>答えを えらばずに、お話を 読めるよ。</p><button disabled={busy} onClick={onRead}>{t('おはなしを えらぶ', 'お話を えらぶ')}</button></div>
    </section>;
}
