import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, RotateCw, X } from 'lucide-react';
import { ISLAND_ITEMS } from '../../domain/island/catalog';
import type { IslandItem, IslandItemKind, IslandRecord, IslandPosition } from '../../domain/island/types';

/** Small object illustrations for choosing possessions; the living world stays in the 3D stage. */
export function ItemPicture({ kind }: { kind: IslandItemKind }) {
    return <svg viewBox="0 0 96 80" aria-hidden="true" className="island-item-picture">
        <ellipse cx="48" cy="69" rx="33" ry="6" fill="#292341" opacity=".12" />
        {kind === 'bench' && <g stroke="#292341" strokeLinecap="round" strokeLinejoin="round">
            <path d="M25 25v42m46-42v42M29 54v15m45-15v15" strokeWidth="5" />
            <rect x="19" y="24" width="58" height="10" rx="3" fill="#e79b50" strokeWidth="2" />
            <rect x="19" y="38" width="58" height="9" rx="3" fill="#e79b50" strokeWidth="2" />
            <path d="m19 50 51-2 9 7-52 3Z" fill="#f75aa4" strokeWidth="2" />
            <path d="m27 58 52-3v4l-52 3Z" fill="#df4b94" strokeWidth="1.5" />
            <path d="m20 43 9 4m40-4 9 4" stroke="#f75aa4" strokeWidth="6" />
            <g fill="#fff1bf" stroke="none"><circle cx="26" cy="29" r="1.5" /><circle cx="70" cy="29" r="1.5" /><circle cx="26" cy="42" r="1.5" /><circle cx="70" cy="42" r="1.5" /></g>
        </g>}
        {kind === 'flower' && <g>
            <path d="M31 65V40m23 25V26m13 39V49" stroke="#087f6a" strokeWidth="3" strokeLinecap="round" />
            <g fill="#32bb83" stroke="#087f6a" strokeWidth="1.5"><path d="M31 59Q17 45 20 56Q24 64 31 63m23-14Q39 36 42 48Q46 56 54 54m0 1Q71 38 67 52Q63 61 54 60m13 2Q80 52 77 61Q74 67 67 66" /><ellipse cx="44" cy="67" rx="17" ry="5" /><ellipse cx="62" cy="68" rx="14" ry="4" /></g>
            {([[31, 38, .8, '#fff0c0'], [54, 25, 1, '#f24e9c'], [68, 47, .72, '#ffbf27']] as const).map(([x, y, size, color]) => <g key={color} transform={`translate(${x} ${y}) scale(${size})`}>
                <g fill={color}><ellipse cy="-7" rx="5" ry="7" /><ellipse cx="7" cy="-2" rx="7" ry="5" transform="rotate(-20 7 -2)" /><ellipse cx="5" cy="6" rx="5" ry="7" transform="rotate(-36 5 6)" /><ellipse cx="-5" cy="6" rx="5" ry="7" transform="rotate(36 -5 6)" /><ellipse cx="-7" cy="-2" rx="7" ry="5" transform="rotate(20 -7 -2)" /></g>
                <circle r="4.5" fill="#ffbf27" /><circle cx="-1.5" cy="-1.5" r="1.5" fill="#ffe599" />
            </g>)}
        </g>}
        {kind === 'lantern' && <g strokeLinecap="round" strokeLinejoin="round">
            <path d="M28 65Q27 59 37 58Q48 58 48 65L46 69H30Z" fill="#9580ca" stroke="#292341" strokeWidth="1.5" />
            <path d="M37 63V15m0 18 22-18" stroke="#e79b50" strokeWidth="7" />
            <path d="M34 14h31" stroke="#f75aa4" strokeWidth="6" />
            <path d="M61 17v7" stroke="#292341" strokeWidth="2.5" />
            <ellipse cx="61" cy="38" rx="8" ry="11" fill="#ffe39a" />
            <path d="m49 28 3 20m21-20-3 20" stroke="#292341" strokeWidth="2" />
            <path d="M47 29Q48 26 54 24L58 20h6l5 4q6 2 7 5Z" fill="#292341" />
            <path d="M50 48h22l-2 4H52Z" fill="#292341" />
            <path d="m61 31 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Z" fill="#fff1bd" />
        </g>}
        {kind === 'swing' && <g strokeLinecap="round" strokeLinejoin="round">
            <path d="m25 19 9 46m37-46-9 46" stroke="#c57f43" strokeWidth="5" />
            <path d="M25 18 13 68m58-50 12 50" stroke="#e79b50" strokeWidth="7" />
            <path d="m18 49 13-1m35 0 12 1M21 17h54" stroke="#f75aa4" strokeWidth="6" />
            <path d="M34 20v34m28-34v34" stroke="#e6d6a2" strokeWidth="3" />
            <path d="m29 53 33-1 6 5-37 2Z" fill="#292341" stroke="#292341" strokeWidth="3" />
            <path d="m31 60 37-2" stroke="#f75aa4" strokeWidth="3" />
            <circle cx="34" cy="19" r="2.5" fill="#292341" /><circle cx="62" cy="19" r="2.5" fill="#292341" />
        </g>}
        {kind === 'mushroom' && <g stroke="#292341" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M39 42h18q-5 14 3 22q2 6-12 6t-12-6q7-12 3-22Z" fill="#e8d9ac" />
            <ellipse cx="48" cy="46" rx="31" ry="9" fill="#cbbd94" />
            <path d="M17 44Q22 21 37 17Q48 14 59 17Q76 23 80 44Q79 49 48 50Q19 49 17 44Z" fill="#ffd447" />
            <g fill="#292341" stroke="none"><ellipse cx="38" cy="26" rx="6" ry="4" /><ellipse cx="62" cy="33" rx="5" ry="4" /><ellipse cx="27" cy="40" rx="4" ry="3" /><ellipse cx="48" cy="43" rx="5" ry="3" /><ellipse cx="58" cy="21" rx="3.5" ry="2.5" /></g>
        </g>}
        {kind === 'fountain' && <g stroke="#292341" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M16 56v7q1 11 32 11t32-11v-7Z" fill="#9580ca" />
            <path d="M16 52v8q1 11 32 11t32-11v-8Z" fill="#fff1bf" />
            <ellipse cx="48" cy="52" rx="32" ry="13" fill="#fff1bf" />
            <ellipse cx="48" cy="52" rx="25" ry="8" fill="#60dcf2" stroke="none" />
            <ellipse cx="48" cy="53" rx="16" ry="4" fill="none" stroke="#baf6ff" strokeWidth="2" />
            <path d="M41 54q-2-4 2-7l1-10h8l1 10q4 3 2 7q-7 3-14 0Z" fill="#bdcbb7" strokeWidth="1" />
            <ellipse cx="48" cy="36" rx="9" ry="3" fill="#fff1bf" strokeWidth="1" />
            <path d="M48 19q-7 12 0 15q7-3 0-15Z" fill="#60dcf2" stroke="none" />
            <g fill="#60dcf2" stroke="none"><ellipse cx="34" cy="41" rx="2.5" ry="4" /><ellipse cx="63" cy="42" rx="2.5" ry="4" /></g>
        </g>}
    </svg>;
}

export function IslandRewards({ island, disabled, onChoose, onContinue, onClose }: {
    island: IslandRecord; disabled: boolean; onChoose: (rewardId: string, kind: IslandItemKind) => void;
    onContinue: () => void; onClose: () => void;
}) {
    const reward = island.pendingRewards[0];
    return <section className="island-sheet island-rewards" aria-label="しまへの おくりもの">
        <div className="island-sheet-title"><div><p className="island-eyebrow">しまへの おくりもの</p><h2>どれを むかえる？</h2></div>
            <button className="island-icon-button" aria-label="しまへ もどる" onClick={onClose} disabled={disabled}><X size={20} /></button></div>
        {reward && <div className="island-reward-choices">{reward.choices.map(kind => <button className="island-reward" key={kind}
            disabled={disabled} onClick={() => onChoose(reward.id, kind)}><ItemPicture kind={kind} /><strong>{ISLAND_ITEMS[kind].name}</strong></button>)}</div>}
        {island.completedSets === 2 && <p className="island-milestone">はしが つながった！ あたらしい にわにも おけるよ。</p>}
        {island.completedSets === 4 && <p className="island-milestone">キツネが あそびに きたよ。いっしょに すごそう。</p>}
        {island.completedSets === 6 && <p className="island-milestone">とうだいに あかりが ともったよ！</p>}
        <button className="island-primary island-continue" disabled={disabled} onClick={onContinue}>つづけて とく <ArrowRight size={20} /></button>
        <p className="island-note">おくりものは あとで えらんでも いいよ{island.pendingRewards.length > 1 ? `（${island.pendingRewards.length}こ）` : ''}</p>
    </section>;
}

export function IslandInventory({ items, disabled, onSelect, onClose }: {
    items: IslandItem[]; disabled: boolean; onSelect: (item: IslandItem) => void; onClose: () => void;
}) {
    return <section className="island-sheet" aria-label="しまの もちもの">
        <div className="island-sheet-title"><div><p className="island-eyebrow">じぶんの しまを ととのえよう</p><h2>どれを うごかす？</h2></div>
            <button className="island-icon-button" aria-label="もちものを とじる" onClick={onClose}><X size={20} /></button></div>
        <div className="island-inventory">{items.map((item, index) => <button key={item.id} disabled={disabled} className="island-reward"
            aria-label={`${ISLAND_ITEMS[item.kind].name} ${index + 1}を うごかす`} onClick={() => onSelect(item)}>
            <ItemPicture kind={item.kind} /><strong>{ISLAND_ITEMS[item.kind].name}</strong><small>{item.position ? 'しまに ある' : 'しまって ある'}</small></button>)}</div>
    </section>;
}

export function IslandPlay({ items, disabled, selectedId, message, onSelect, onMove, onInventory, onContinue, onClose }: {
    items: IslandItem[]; disabled: boolean; selectedId?: string; message?: string;
    onSelect: (id: string) => void; onMove: (item: IslandItem) => void; onInventory: () => void; onContinue: () => void; onClose: () => void;
}) {
    const placed = items.filter(item => item.position);
    const selected = placed.find(item => item.id === selectedId);
    return <section className="island-sheet island-play" aria-label="どうぶつと あそぶ">
        <div className="island-sheet-title"><h2>どこで あそぼう？</h2>
            <button className="island-icon-button" aria-label="あそびを とじる" onClick={onClose} disabled={disabled}><X size={20} /></button></div>
        <p className="island-play-message" role="status">{message ?? (placed.length ? 'しまの ものか、したの えを えらんでね。' : 'もちものから おくと、どうぶつが あそべるよ。')}</p>
        {!placed.length && <button className="island-secondary island-play-move" disabled={disabled} onClick={onInventory}>もちものを ひらく</button>}
        <div className="island-inventory island-play-choices" role="group" aria-label="あそぶ もの">{placed.map((item, index) => <button key={item.id} disabled={disabled}
            className="island-reward" aria-pressed={item.id === selectedId}
            aria-label={`${ISLAND_ITEMS[item.kind].name} ${index + 1}で あそぶ`} onClick={() => onSelect(item.id)}>
            <ItemPicture kind={item.kind} /><strong>{ISLAND_ITEMS[item.kind].name}</strong><small>{ISLAND_ITEMS[item.kind].description}</small>
        </button>)}</div>
        <div className="island-play-actions">
            {selected && <button className="island-text-button" disabled={disabled} onClick={() => onMove(selected)}>{ISLAND_ITEMS[selected.kind].name}を うごかす</button>}
            <button className="island-secondary island-play-return" disabled={disabled} onClick={onContinue}>ひかりを とどける <ArrowRight size={18} /></button>
        </div>
    </section>;
}

export function IslandPlacement({ item, valid, disabled, onPoint, onRotate, onSave, onStore, onCancel }: {
    item: IslandItem; valid: boolean; disabled: boolean; onPoint: (point: IslandPosition) => void;
    onRotate: () => void; onSave: () => void; onStore: () => void; onCancel: () => void;
}) {
    const point = item.position ?? { x: 0, z: 1 };
    const move = (x: number, z: number) => onPoint({ x: point.x + x, z: point.z + z });
    return <section className="island-sheet island-placement" aria-label="おく ばしょを えらぶ">
        <div className="island-sheet-title"><div><p className="island-eyebrow">{ISLAND_ITEMS[item.kind].name}</p><h2>どこに おこう？</h2></div>
            <button className="island-icon-button" aria-label="いどうを やめる" disabled={disabled} onClick={onCancel}><X size={20} /></button></div>
        <p className="island-placement-hint" role="status">{valid ? 'にわを タッチ。やじるしでも うごかせるよ。' : 'もうすこし ひろい ばしょへ うごかそう。'}</p>
        <div className="island-placement-row"><div className="island-direction-controls" aria-label="いどう">
            <button className="island-icon-button" aria-label="ひだりへ" disabled={disabled} onClick={() => move(-.25, 0)}><ArrowLeft /></button>
            <button className="island-icon-button" aria-label="おくへ" disabled={disabled} onClick={() => move(0, -.25)}><ArrowUp /></button>
            <button className="island-icon-button" aria-label="てまえへ" disabled={disabled} onClick={() => move(0, .25)}><ArrowDown /></button>
            <button className="island-icon-button" aria-label="みぎへ" disabled={disabled} onClick={() => move(.25, 0)}><ArrowRight /></button>
            <button className="island-icon-button" aria-label="まわす" disabled={disabled} onClick={onRotate}><RotateCw size={20} /></button>
        </div><button className="island-primary" disabled={disabled || !valid} onClick={onSave}><Check size={20} />ここに おく</button></div>
        <button className="island-text-button" disabled={disabled} onClick={onStore}>いまは しまっておく</button>
    </section>;
}
