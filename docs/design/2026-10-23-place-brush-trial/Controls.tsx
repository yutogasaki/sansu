import { useState } from 'react';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import type { Safety } from './model';
import { shapeOf, type PlaceShape } from './directional-field';
import { trialHistoryOf } from './persistent-model';
import { compositeEnabled, compositeOf, type PlaceSlot } from './composite-field';
import { assemblyEnabled, coastSetEnabled } from './assembly-mode';
import { compositeHistoryOf } from './composite-model';
import { coastalTrialMode } from './coastal-section';

type Slot = PlaceSlot;
const slotDefault = (slot: Slot): PlaceShape => slot.startsWith('bay') ? { center: slot === 'bay2' ? { x: -2, z: 0 } : { x: -1, z: 7 }, height: -.55, radius: 2, entrance: 1.2 } : ({ center: slot === 'west' ? { x: -1, z: 4 } : { x: 5, z: 5 },
    height: slot === 'west' ? .5 : .9, radius: 1.6, entrance: 1.2, flatRadius: 1.75,
    ...(slot === 'east' ? { rampDirection: 'west' as const } : {}) });

export function PlaceControls({ state, cell, clearSelection, editing, enter, safety, act, undo, redo, busy, persisted, revision }: {
    state: GrowingState; cell?: Cell; clearSelection: () => void; editing: boolean; enter: () => void; safety: () => Safety | undefined;
    act: (action: 'apply' | 'undo' | 'redo', shape: PlaceShape, safety: Safety, slot?: Slot) => Promise<boolean>; undo: number; redo: number;
    busy: boolean; persisted: boolean; revision?: number;
}) {
    const composite = compositeEnabled();
    const assembly = assemblyEnabled();
    const initial = composite ? compositeOf(state)?.west ?? slotDefault('west') : undefined;
    const [slot, setSlot] = useState<Slot>('west');
    const bay = assembly ? slot.startsWith('bay') : ['bay08', 'bay12', 'bay08spread'].includes(coastalTrialMode());
    const [height, setHeight] = useState(initial?.height ?? (bay ? -.55 : .9)), [radius, setRadius] = useState(initial?.radius ?? 1.6);
    const [entrance, setEntrance] = useState(initial?.entrance ?? 1.2), [flatRadius, setFlatRadius] = useState(initial?.flatRadius ?? 0);
    const [bayDepth, setBayDepth] = useState(.8);
    const [rampDirection, setRampDirection] = useState<NonNullable<PlaceShape['rampDirection']>>(initial?.rampDirection ?? 'north');
    const [message, setMessage] = useState('場所を選んで、輪郭と入口を一緒に変えます。');
    const chooseSlot = (next: Slot) => {
        clearSelection(); // A ground click for the previous slot must not win over this slot's saved center.
        setSlot(next);
        const shape = compositeOf(state)?.[next] ?? slotDefault(next);
        setHeight(shape.height); setRadius(shape.radius); setEntrance(shape.entrance);
        setBayDepth(shape.bayDepth ?? .8);
        setFlatRadius(shape.flatRadius ?? 0); setRampDirection(shape.rampDirection ?? 'north');
    };
    const center = cell ?? (composite ? compositeOf(state)?.[slot]?.center ?? slotDefault(slot).center : { x: 5, z: 5 });
    const run = async (action: 'apply' | 'undo' | 'redo') => {
        const guard = safety(); if (!guard || busy) return;
        const ok = await act(action, { center, height, radius, entrance,
            ...(flatRadius ? { flatRadius } : {}), ...(assembly && bay ? { bayDepth } : {}),
            ...(height >= 0 && rampDirection !== 'north' ? { rampDirection } : {}) }, guard, composite ? slot : undefined);
        setMessage(ok ? persisted ? '場所を保存しました（試作専用DB）' : '場所を変更しました（メモリ内のみ）' : '変更できません。足場や保存のメッセージを確認してください。');
    };
    return <details style={{ position: 'fixed', top: 300, right: 8, zIndex: 102, width: 230, maxHeight: '50vh', overflow: 'auto', padding: 10,
        background: '#fff', color: '#243348', borderRadius: 12, border: '1px solid #8998a8', fontSize: 13 }}>
        <summary>場所の編集試作</summary><p>{assembly ? `湾と西・東の高台を組み合わせます。${persisted ? '専用DBへ保存します。' : '保存しません。'}` : composite ? persisted ? '西と東の2つの場所を試作専用DBへ保存します。' : '西と東の2つの場所を残す比較です。保存しません。' : persisted ? '試作専用DBへ保存します。' : '保存しない比較です。'}{bay ? '入り江を選び、岸の位置をタップしてください。' : <>高台は坂の向きを選べます。{!composite && '入り江は南に水路。'}</>}</p>
        {!editing ? <button onClick={enter}>場所を編集する</button> : <>
            {composite && <label>編集する場所 <select aria-label="編集する場所" value={slot} onChange={e => chooseSlot(e.target.value as Slot)}>
                <option value="west">西</option><option value="east">東</option>{assembly && <option value="bay">湾</option>}{coastSetEnabled() && <option value="bay2">湾2</option>}</select></label>}
            <p>選択位置：{center.x}, {center.z}{!cell && '（地面をタップで変更）'}</p>
            <label>高さ <select aria-label="場所の高さ" value={height} onChange={e => setHeight(Number(e.target.value))}>
                {!bay && <><option value={.9}>高台</option><option value={.5}>低い丘</option></>}{(!composite || bay) && <option value={-.55}>入り江</option>}</select></label><br />
            <label>輪郭 <select aria-label="場所の輪郭" value={radius} onChange={e => setRadius(Number(e.target.value))}>
                <option value={1.2}>小さく</option><option value={1.6}>ふつう</option><option value={2}>広く</option>{assembly && bay && <option value={3}>大きな湾</option>}</select></label><br />
            {assembly && bay && <><label>岸の奥行き <select aria-label="湾の奥行き" value={bayDepth} onChange={e => setBayDepth(Number(e.target.value))}>
                <option value={.8}>浅く</option><option value={1.6}>中ほど</option><option value={2.4}>深く</option></select></label><br /></>}
            <label>平面 <select aria-label="平らな面の広さ" disabled={bay} value={flatRadius} onChange={e => setFlatRadius(Number(e.target.value))}>
                <option value={0}>輪郭から決める（比較元）</option><option value={1.75}>家具と通路の面</option></select></label><br />
            <label>入口 <select aria-label="入口の幅" value={entrance} onChange={e => setEntrance(Number(e.target.value))}>
                <option value={.4}>せまく</option><option value={1.2}>ふつう</option><option value={2}>広く</option></select></label>
            <br /><label>坂の向き <select aria-label="坂の向き" disabled={height < 0} value={rampDirection}
                onChange={e => setRampDirection(e.target.value as NonNullable<PlaceShape['rampDirection']>)}>
                <option value="north">北</option><option value="west">西</option><option value="east">東</option><option value="south">南</option></select></label>
            <p><button disabled={busy} onClick={() => void run('apply')}>場所をまとめて変える</button></p>
            <button disabled={!undo || busy} onClick={() => void run('undo')}>場所を戻す</button>{' '}
            <button disabled={!redo || busy} onClick={() => void run('redo')}>場所をやり直す</button><p role="status">{message}</p>
        </>}
        <pre data-place-shape style={{ fontSize: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify({ shape: composite ? undefined : shapeOf(state) ?? null,
            shapes: composite ? compositeOf(state) : undefined, slot: composite ? slot : undefined, undo, redo, persisted, revision,
            history: composite ? compositeHistoryOf(state) : trialHistoryOf(state) })}</pre>
    </details>;
}
