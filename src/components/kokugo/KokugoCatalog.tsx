import { KokugoKanjiCatalog } from './KokugoKanjiCatalog';
import { kanjiUnitInfo } from '../../domain/kokugo/kanji/curriculum';
import { useEffect, useState } from 'react';
import { AGE_BANDS, KOKUGO_UNITS, TRACKS } from '../../domain/kokugo/curriculum';
import { itemsForUnit } from '../../domain/kokugo/catalog';
import type { KokugoPlan, KokugoTrack } from '../../domain/kokugo/types';
export function KokugoCatalog({ profileId, band, onBand, busy, pending, onResume, onChoose, onRead }: {
    profileId: string; band: number; onBand: (band: number) => void; busy: boolean; pending?: KokugoPlan;
    onResume: () => void; onChoose: (unit: string, target?: string) => void; onRead: () => void;
}) {
    const [track, setTrack] = useState<KokugoTrack>('K');
    useEffect(() => { setTrack(band >= 4 ? 'R' : band >= 2 ? 'H' : 'K'); }, [band]);
    return <section>
        <p className="kokugo-eyebrow">ことばを ひろげる</p><h1>国語を まなぼう</h1>
        <p>すきな 内容から はじめよう。学年を こえて えらべるよ。</p>
        {pending && <div className="kokugo-panel"><h2>とちゅうの れんしゅう</h2><button className="kokugo-primary" disabled={busy} onClick={onResume}>つづきから</button>
            <p>ほかの単元は、この区切りの あとで えらべるよ。</p></div>}
        <div className="kokugo-band"><label htmlFor="kokugo-band">学年の めやす</label> <select id="kokugo-band" value={band} disabled={busy} onChange={e => onBand(Number(e.target.value))}>{AGE_BANDS.map((title, index) => <option value={index} key={title}>{title}</option>)}</select></div>
        <div className="kokugo-tracks" role="group" aria-label="国語の 領域">{TRACKS.map(t => <button aria-pressed={track === t.id} key={t.id} onClick={() => setTrack(t.id)}>{t.title}</button>)}</div>
        <p>{TRACKS.find(t => t.id === track)?.description}</p>
        {track === 'H' && <KokugoKanjiCatalog profileId={profileId} band={band} busy={busy || !!pending} onChoose={onChoose} />}
        <div className="kokugo-units">{KOKUGO_UNITS.filter(unit => unit.track === track && !kanjiUnitInfo(unit.id)).sort((a, b) => Math.abs(a.band - band) - Math.abs(b.band - band)).map(unit => <button key={unit.id} disabled={busy || !!pending} onClick={() => onChoose(unit.id)}>
            <span className="kokugo-eyebrow">{unit.id} · {AGE_BANDS[unit.band]}ごろから{Math.abs(unit.band - band) <= 1 ? ' · いまの候補' : ''}</span>
            <strong>{unit.title}</strong><small>{itemsForUnit(unit.id)[0]?.form === 'activity' ? '書く・話す 活動' : '例を 見て、3もん'}</small>
        </button>)}</div>
        <div className="kokugo-panel"><h2>本を よむ</h2><p>答えを えらばずに、お話を 読めるよ。</p><button onClick={onRead}>お話を えらぶ</button></div>
    </section>;
}
