import { useEffectEvent, useLayoutEffect, useRef } from 'react';
import { Eye, Flower2, Move, PackageOpen, PawPrint, Images } from 'lucide-react';
import { ISLAND_ITEMS } from '../../domain/island/catalog';
import { getIslandGrowthTarget, getIslandHabitatLevel, ISLAND_HABITATS } from '../../domain/island/growth';
import { getIslandExperience, type IslandResidentId } from '../../domain/island/experience';
import type { IslandItem, IslandPlan, IslandRecord } from '../../domain/island/types';
import type { IslandDirectTarget } from './islandDirectTargets';
import { islandGrowthPreview } from './islandGrowthPreview';
import { IslandPanelHeading } from './IslandPanelHeading';
import './IslandDirectActions.css';

export function IslandDirectActions({ target, island, plan, disabled, preview, onPreview, onGrow, onPlay, onBrowsePlay, onMove, onInventory, onClose }: {
    target: IslandDirectTarget; island: IslandRecord; plan?: IslandPlan; disabled: boolean; preview: boolean;
    onPreview: () => void; onGrow: () => void; onPlay: (itemId: string, residentId?: IslandResidentId) => void;
    onBrowsePlay: (residentId: IslandResidentId) => void;
    onMove: (item: IslandItem) => void; onInventory: () => void; onClose: () => void;
}) {
    const close = useRef<HTMLButtonElement>(null);
    const dismissPanel = useEffectEvent(onClose);
    const targetKey = `${target.kind}:${'id' in target ? target.id : ''}`;
    useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => close.current?.focus({ preventScroll: true }));
        const dismiss = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault(); event.stopPropagation(); dismissPanel();
        };
        document.addEventListener('keydown', dismiss, true);
        return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', dismiss, true); };
    }, [targetKey]);
    const item = target.kind === 'item' ? island.items.find(item => item.id === target.id && item.position) : undefined;
    const garden = target.kind === 'garden';
    const next = garden ? islandGrowthPreview(island, 'garden') : undefined;
    const growing = getIslandGrowthTarget(island) === 'garden';
    const frozen = plan?.status === 'active' ? plan.growthTarget : undefined;
    const title = garden ? 'にわ' : target.kind === 'resident' ? getIslandExperience(island).residents[target.id].name : item ? ISLAND_ITEMS[item.kind].name : 'しま';
    return <section className="island-direct-panel" aria-label={`${title}の そうさ`}>
        <IslandPanelHeading title={<>{garden ? <Flower2 size={20} /> : <PawPrint size={20} />}{title}{target.kind === 'resident' ? 'と あそぶ' : ''}</>}
            exitRef={close} kind="close" onExit={onClose} exitAriaLabel="そうさを とじる" />
        <div className="island-direct-body">
        {garden ? <>
            <p>{preview ? `つぎの すがた：${next?.description ?? ''}` : getIslandHabitatLevel(island, 'garden') === 3 ? '大きく 育ったよ' : growing ? 'ここを 育てるよ' : '学んだぶん、えらんだ ばしょが 育つよ'}</p>
            {frozen && frozen !== 'garden' && <p className="island-direct-note">いまの もんだいは {ISLAND_HABITATS.find(place => place.id === frozen)?.name}へ。にわは つぎから。</p>}
            {next && <div className="island-direct-buttons"><button className="island-secondary" disabled={disabled} aria-pressed={preview} onClick={onPreview}><Eye size={18} />{preview ? 'いまの すがた' : 'つぎの すがた'}</button>
                <button className="island-primary" disabled={disabled || growing} onClick={onGrow}>{growing ? 'ここを 育てるよ' : 'ここを 育てる'}</button></div>}
            {!island.items.some(item => item.habitatId === 'garden' && item.position) && <button className="island-secondary" disabled={disabled} onClick={onInventory}><PackageOpen size={18} />もちものから おく</button>}
        </> : target.kind === 'resident' ? <>
            {island.items.some(item => item.position) ? <>
                <p>しまの あそび道具を タップしてね。</p>
                <button className="island-secondary" disabled={disabled} onClick={() => onBrowsePlay(target.id)}><Images size={20} />えから えらぶ</button>
            </> : <><p>道具を おくと、いっしょに あそべるよ。</p>
                <button className="island-secondary" disabled={disabled} onClick={onInventory}>もちものを おく</button></>}
        </> : item ? <div className="island-direct-buttons">
            <button className="island-primary" disabled={disabled} onClick={() => onPlay(item.id)}><PawPrint size={18} />あそぶ</button>
            <button className="island-secondary" disabled={disabled} onClick={() => onMove(item)}><Move size={18} />うごかす</button>
        </div> : null}</div>
    </section>;
}
