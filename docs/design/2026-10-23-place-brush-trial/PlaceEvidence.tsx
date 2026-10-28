import { useMemo } from 'react';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { candidateId } from '../2026-10-23-place-method-comparison/candidate';
import { LiveUse } from '../2026-10-23-place-method-comparison/LiveUse';
import { TrialCadence } from '../2026-10-23-place-method-comparison/TrialCadence';
import { TrialTiming } from '../2026-10-23-place-method-comparison/TrialTiming';
import { expandedTrialEnabled } from '../2026-10-23-place-method-comparison/TrialIsland';
import { shapeOf } from './directional-field';
import { trialHistoryOf } from './persistent-model';
import { localTrialEnabled, TRIAL_DATABASE } from './trial-store';
import { coastalTrialMode } from './coastal-section';
import { compositeEnabled, compositeOf } from './composite-field';
import { compositeHistoryOf } from './composite-model';
import { compositeSavedMode, COMPOSITE_DATABASE } from './composite-store';
import { assemblySavedMode, ASSEMBLY_DATABASE } from './assembly-store';
import { assemblyEnabled, connectivityGuardEnabled } from './assembly-mode';
import { shoulderTrialMode } from './shoulder-section';

/** Diagnostic view of the actual record; no button can manufacture a receipt. */
export function TrialEvidence({ state }: { state: GrowingState }) {
    const composite = compositeEnabled(), twoSaved = compositeSavedMode(), assembly = assemblyEnabled(), assemblySaved = assemblySavedMode(), persisted = localTrialEnabled() || twoSaved || assemblySaved;
    const snapshot = useMemo(() => ({ candidate: candidateId(), fixture: assembly ? assemblySaved ? 'assembly-isolated-indexeddb' : 'assembly-memory-only' : composite ? twoSaved ? 'two-isolated-indexeddb' : 'two-memory-only' : persisted ? 'shore-isolated-indexeddb' : 'shore-memory-only',
        connectivityGuard: connectivityGuardEnabled(), database: assemblySaved ? ASSEMBLY_DATABASE : twoSaved ? COMPOSITE_DATABASE : persisted ? TRIAL_DATABASE : null, shoreMode: coastalTrialMode(), shoulderMode: shoulderTrialMode(), shape: composite ? undefined : shapeOf(state),
        shapes: composite ? compositeOf(state) : undefined, history: composite ? compositeHistoryOf(state) : trialHistoryOf(state), state,
        places: derivePlaces(state).map(place => ({ id: place.id, ruleId: place.ruleId, revision: place.revision,
            stage: place.stage, useTargets: place.useTargets })),
    }), [state, persisted, composite, twoSaved, assembly, assemblySaved]);
    if (!expandedTrialEnabled()) return null;
    return <>
        <div style={{ position: 'fixed', top: 135, left: 8, zIndex: 99, padding: 4, background: '#fff', color: '#773017', fontSize: 11 }}>
            {assembly ? `比較用96区画・湾と高台・${assemblySaved ? '専用DBへ保存' : '保存しません'}` : composite ? twoSaved ? '比較用96区画・2つの場所・専用DBへ保存' : '比較用96区画・2つの場所・保存しません' : persisted ? '比較用96区画・専用DBへ保存' : '比較用96区画・操作は保存しません'}
        </div>
        <details style={{ position: 'fixed', right: 8, top: 250, maxWidth: 'min(440px, 92vw)', maxHeight: 'calc(100vh - 270px)', overflow: 'auto', zIndex: 100,
            background: '#fff', color: '#253248', border: '1px solid #8998a8', borderRadius: 8, padding: 8, fontSize: 12 }}>
            <summary>比較の記録 · 場所v23</summary>
            <p>{assemblySaved ? '湾・高台・地形・所有物を新しい専用DBへ保存します。旧試作や本人の島は読み書きしません。' : twoSaved ? '2つの場所を別の試作専用DBに保存します。元の単一場所の保存や本来の島は読み書きしません。' : composite ? '場所と共通の履歴をメモリ内で比較します。再読込で初期に戻ります。' : persisted ? '専用DBを使う保存試作です。形・家具・利用の保存に既存の本体writerを使用します。' : 'メモリ内の比較です。再読込で初期に戻ります。'}</p>
            <p>学習と自然進行の自動同期は停止しています。通常配布・実機・子どもの理解の受入ではありません。</p>
            {shoulderTrialMode() !== 'off' && <p>東の高台の北側だけ、肩の断面を比較します。高さ0.9・平面1.75・西向き入口1.2の形で有効。比較方式：{shoulderTrialMode()}。保存はできません。</p>}
            <details><summary>描画の観測</summary><TrialCadence /></details>
            <details><summary>CPU区間の観測</summary><TrialTiming /></details>
            <details><summary>このページで起きた利用</summary><LiveUse /></details>
            <pre data-trial-evidence style={{ maxHeight: '50vh', overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(snapshot, null, 2)}</pre>
        </details>
    </>;
}
