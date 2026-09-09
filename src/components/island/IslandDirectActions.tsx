import { useLayoutEffect, useRef } from 'react';
import { Eye, Flower2, Move, PackageOpen, PawPrint, X } from 'lucide-react';
import { ISLAND_ITEMS } from '../../domain/island/catalog';
import { getIslandGrowthTarget, getIslandHabitatLevel, ISLAND_HABITATS } from '../../domain/island/growth';
import { getIslandExperience, type IslandResidentId } from '../../domain/island/experience';
import type { IslandItem, IslandPlan, IslandRecord } from '../../domain/island/types';
import type { IslandDirectTarget } from './islandDirectTargets';
import { islandGrowthPreview } from './islandGrowthPreview';
import './IslandDirectActions.css';

export function IslandDirectActions({ target, island, plan, disabled, preview, onPreview, onGrow, onPlay, onMove, onInventory, onClose }: {
    target: IslandDirectTarget; island: IslandRecord; plan?: IslandPlan; disabled: boolean; preview: boolean;
    onPreview: () => void; onGrow: () => void; onPlay: (itemId: string, residentId?: IslandResidentId) => void;
    onMove: (item: IslandItem) => void; onInventory: () => void; onClose: () => void;
}) {
    const close = useRef<HTMLButtonElement>(null);
    useLayoutEffect(() => {
        close.current?.focus({ preventScroll: true });
        const dismiss = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault(); event.stopPropagation(); onClose();
        };
        document.addEventListener('keydown', dismiss, true);
        return () => document.removeEventListener('keydown', dismiss, true);
    }, [target, onClose]);
    const item = target.kind === 'item' ? island.items.find(item => item.id === target.id && item.position) : undefined;
    const garden = target.kind === 'garden';
    const next = garden ? islandGrowthPreview(island, 'garden') : undefined;
    const growing = getIslandGrowthTarget(island) === 'garden';
    const frozen = plan?.status === 'active' ? plan.growthTarget : undefined;
    const title = garden ? 'にわ' : target.kind === 'resident' ? getIslandExperience(island).residents[target.id].name : item ? ISLAND_ITEMS[item.kind].name : 'しま';
    return <section className="island-direct-panel" aria-label={`${title}の そうさ`}>
        <div className="island-direct-heading"><h2>{garden ? <Flower2 size={20} /> : <PawPrint size={20} />}{title}</h2>
            <button ref={close} type="button" className="island-icon-button" aria-label="そうさを とじる" onClick={onClose}><X size={20} /></button></div>
        {garden ? <>
            <p>{preview ? `つぎの すがた：${next?.description ?? ''}` : getIslandHabitatLevel(island, 'garden') === 3 ? '大きく 育ったよ' : growing ? 'ここを 育てるよ' : '学んだぶん、えらんだ ばしょが 育つよ'}</p>
            {frozen && frozen !== 'garden' && <p className="island-direct-note">いまの もんだいは {ISLAND_HABITATS.find(place => place.id === frozen)?.name}へ。にわは つぎから。</p>}
            {next && <div className="island-direct-buttons"><button className="island-secondary" disabled={disabled} aria-pressed={preview} onClick={onPreview}><Eye size={18} />{preview ? 'いまの すがた' : 'つぎの すがた'}</button>
                <button className="island-primary" disabled={disabled || growing} onClick={onGrow}>{growing ? 'ここを 育てるよ' : 'ここを 育てる'}</button></div>}
            {!island.items.some(item => item.habitatId === 'garden' && item.position) && <button className="island-secondary" disabled={disabled} onClick={onInventory}><PackageOpen size={18} />もちものから おく</button>}
        </> : target.kind === 'resident' ? <>
            <p>どこで いっしょに あそぼう？</p>
            <div className="island-direct-play-list">{island.items.filter(item => item.position).map(item => <button key={item.id} className="island-secondary" disabled={disabled} onClick={() => onPlay(item.id, target.id)}>{ISLAND_ITEMS[item.kind].name}で あそぶ</button>)}</div>
            {!island.items.some(item => item.position) && <button className="island-secondary" disabled={disabled} onClick={onInventory}>もちものを おく</button>}
        </> : item ? <div className="island-direct-buttons">
            <button className="island-primary" disabled={disabled} onClick={() => onPlay(item.id)}><PawPrint size={18} />あそぶ</button>
            <button className="island-secondary" disabled={disabled} onClick={() => onMove(item)}><Move size={18} />うごかす</button>
        </div> : null}
    </section>;
}
