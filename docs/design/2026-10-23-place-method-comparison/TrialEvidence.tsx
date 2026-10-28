import { useMemo } from 'react';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { terrainMethod } from './section-profile';
import { candidateId } from './candidate';
import { TrialCadence } from './TrialCadence';
import { LiveUse } from './LiveUse';
import { TrialTiming } from './TrialTiming';
import { expandedTrialEnabled, comparisonScene } from './TrialIsland';

/** Developer-only, visible read-only evidence. It cannot grant objects or uses. */
export function TrialEvidence({ state }: { state: GrowingState }) {
    const snapshot = useMemo(() => ({
        candidate: candidateId(), fixture: expandedTrialEnabled() ? `${comparisonScene()}-memory-only` : 'ordinary-saved-island',
        land: state.land, terrain: state.terrain, bridge: state.bridge,
        plots: state.plots, landmarks: state.landmarks, keepsakes: state.keepsakes,
        villagers: state.villagers, character: state.character,
        drops: state.drops, town: state.town, placeProgress: state.placeProgress,
        places: derivePlaces(state).map(place => ({ id: place.id, ruleId: place.ruleId,
            revision: place.revision, stage: place.stage, useTargets: place.useTargets })),
    }), [state]);
    if (!new URLSearchParams(location.search).has('trialEvidence') && !expandedTrialEnabled()) return null;
    const link = (method: string) => { const url = new URL(location.href); url.searchParams.set('terrainTrial', method); return url.href; };
    const fixed = new URLSearchParams(location.search).get('trialCamera') === 'fixed';
    const fixtureLink = new URL(location.href);
    if (expandedTrialEnabled()) fixtureLink.searchParams.delete('trialScene');
    else { fixtureLink.searchParams.set('trialScene', 'expanded'); fixtureLink.searchParams.set('growthTrial', 'inherit'); }
    const cameraLink = new URL(location.href); if (fixed) cameraLink.searchParams.delete('trialCamera'); else cameraLink.searchParams.set('trialCamera', 'fixed');
    const shoreLink = new URL(location.href); shoreLink.searchParams.set('trialScene', 'shore');
    return <>{expandedTrialEnabled() && <div style={{ position: 'fixed', top: 135, left: 8, zIndex: 99, padding: 4, background: '#fff', color: '#773017', fontSize: 11 }}>比較用96区画・操作は保存しません</div>}<details style={{ position: 'fixed', right: 8, top: 150, maxWidth: 'min(440px, 92vw)', maxHeight: 'calc(100vh - 170px)', overflow: 'auto', zIndex: 100,
        background: '#fff', color: '#253248', border: '1px solid #8998a8', borderRadius: 8, padding: 8, fontSize: 12 }}>
        <summary>比較の記録 · {terrainMethod()}</summary>
        <p>ローカル試験。読み取り専用。方式内で表示・床・経路を共有します。</p>
        {expandedTrialEnabled() && <p><strong>拡張後の比較データ</strong>：通貨は診断用。操作はこのページのメモリ内だけに反映し、再読込で初期に戻ります。</p>}
        <p><a href={fixtureLink.href}>{expandedTrialEnabled() ? '実保存の島をこの試作方式で開く' : '拡張後の比較データを開く'}</a>{expandedTrialEnabled() && '（移動先での操作は保存されます）'}</p>
        <p><a href={shoreLink.href}>16手で作った高台と水際の比較データ</a>（通常操作で再現した高さ・配置。保存再開の試験ではありません）</p>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{[
            ['A', 'A：連続地表'], ['B', 'B：設計した断面'], ['C', 'C：つながる海岸'],
            ['D', 'D：使える段丘'], ['F', 'F：高さを守る段丘'], ['G', 'G：土地から作る岸'], ['H', 'H：曲がった土地'],
        ].map(([method, label]) => <a key={method} style={{ whiteSpace: 'nowrap', padding: 4 }} href={link(method)}>{label}</a>)}</p>
        <p><a href={cameraLink.href}>{fixed ? '通常カメラへ戻る' : '形の比較用にカメラを固定する'}</a>{fixed && '（比較中は回転・拡大しません）'}</p>
        <details><summary>描画の観測</summary><TrialCadence /></details>
        <details><summary>CPU区間の観測</summary><TrialTiming /></details>
        <details><summary>このページで起きた利用</summary><LiveUse /></details>
        <pre data-trial-evidence style={{ maxHeight: '50vh', overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(snapshot, null, 2)}</pre>
    </details></>;
}
