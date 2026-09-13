import { Check, Sparkles } from 'lucide-react';
import { CATALOG, LIFE_RULES, type LifeCommand, type LifeItem, type LifeState } from '../../../domain/islandLife/model';
import LifeProductPreview from './LifeProductPreview';

export default function LifeAppearance({ state, item, locked, onHero, onAction }: {
    state: LifeState; item?: LifeItem; locked: boolean; onHero: () => void;
    onAction: (command: LifeCommand, message: string) => Promise<void>;
}) {
    const target = item?.kind === 'lantern' ? undefined : item;
    const current = target?.style ?? state.heroStyle;
    return <div className="life-appearance">
        <div className="life-section-intro"><b>{target ? CATALOG[target.kind].label : 'ぽこもこ'}の いろ</b>
            {target && <button disabled={locked} onClick={onHero}>ぽこもこの いろへ</button>}</div>
        <p>{!target ? 'くびの スカーフが かわるよ。' : target.kind === 'flower' && target.growth < LIFE_RULES.budHours ? 'つぼみに なると、この いろに なるよ。' : 'すきな いろに きがえよう。'}</p>
        <div className="life-styles life-appearance-cards">
            {([['original', 'もとの いろ'], ['sunshine', 'ひだまり'], ['starlight', 'ほしあかり']] as const).map(([style, label]) => {
                const owned = state.styles.includes(style), active = current === style;
                const missing = LIFE_RULES.stylePrice - state.light;
                return <button key={style} data-life-style={style} aria-pressed={active}
                    disabled={locked || !owned && missing > 0}
                    onClick={() => { if (!active) void onAction({ type: 'style', style, itemId: target?.id }, 'いろが かわったよ。いつでも もどせるよ。'); }}>
                    <LifeProductPreview kind={target?.kind} growth={target?.growth} style={style} />
                    <b>{label}</b><span className="life-style-state">{active ? <><Check size={14} /><span>この いろ</span></> : owned ? 'つかえる' : <><Sparkles size={14} /><span>{missing > 0 ? `あと ${missing}` : LIFE_RULES.stylePrice}</span><span>ひかり</span></>}</span>
                </button>;
            })}
        </div>
    </div>;
}
