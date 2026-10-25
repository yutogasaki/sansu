import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown, PawPrint, X, Waypoints, Shovel } from 'lucide-react';
import type { Villager } from '../../../domain/growingIsland/types';
import { villagerName } from './growingCopy';
import type { MenuPictures } from './menuMiniatures';
import { IslandToyIcon } from '../IslandToyIcon';
import './growingIslandMenu.css';

export interface GrowingIslandMenuProps {
    villagers: Villager[];
    faces: Record<string, string>;
    pictures?: MenuPictures;
    drops: number;
    busy: boolean;
    onClose: () => void;
    onFriends: () => void;
    onVoyages?: () => void;
    onTerrain?: () => void;
    onTrace: () => void;
    onShow: () => void;
    onFlowers: () => void;
    onGuide: () => void;
    utilities?: ReactNode;
    bridge?: { built: boolean; ready: boolean; reason: string };
    onBridge?: () => void;
}

/** A small, optional paper beside the live island; every entry opens its real destination. */
export function GrowingIslandMenuContents(props: GrowingIslandMenuProps) {
    const { villagers, pictures } = props;
    return <div className="growing-pocket-entries">
        <button className="growing-pocket-friends" aria-label="なかま" aria-describedby="growing-menu-population" onClick={props.onFriends}>
            <span className="growing-pocket-friend-model" aria-hidden="true">{pictures?.friends && villagers.length ? <img src={pictures.friends} alt="" /> : <PawPrint size={32} strokeWidth={1.5} />}</span>
            <span className="growing-pocket-main-copy"><strong>なかまに あう</strong><small id="growing-menu-population">{villagers.length}にん · {villagers.length ? villagers.slice(0, 2).map(villagerName).join('・') : 'これからの なかま'}</small></span>
        </button>
        <div className="growing-pocket-memories" aria-label="しまの くらし">
            {props.onTerrain && <button disabled={props.busy} onClick={props.onTerrain}><Shovel size={29} aria-hidden="true" /><span>じめんを かえる</span></button>}
            {props.onVoyages && <button disabled={props.busy} onClick={props.onVoyages}><IslandToyIcon kind="boat" size={32} /><span>海図と ふね</span></button>}
            <button onClick={props.onTrace}><IslandToyIcon kind="palette" size={32} /><span>はたを つくる</span></button>
            <button aria-label="しゃしん・みせる" onClick={props.onShow}><IslandToyIcon kind="camera" size={32} /><span>しゃしん</span></button>
            <button onClick={props.onFlowers}><IslandToyIcon kind="display" size={32} /><span>はなずかん</span></button>
            {props.bridge && <button disabled={props.busy || (!props.bridge.built && !props.bridge.ready)} onClick={props.onBridge}
                aria-label={props.bridge.built ? 'はしを みにいく' : 'はしを つくる'} title={!props.bridge.built && !props.bridge.ready ? props.bridge.reason : undefined}>
                <Waypoints size={29} aria-hidden="true" /><span>{props.bridge.built ? 'はしを みる' : 'はしを つくる'}</span>
            </button>}
            <button className="growing-pocket-guide" aria-label="しまの あそびかた" onClick={props.onGuide}><IslandToyIcon kind="book" size={32} /><span>あそびかた</span></button>
        </div>
        {props.bridge && !props.bridge.built && !props.bridge.ready && <p className="growing-pocket-bridge-note">はし：{props.bridge.reason}</p>}
        {props.utilities && <details className="growing-pocket-tools growing-pocket-other">
            <summary><span>そのほか</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="growing-pocket-utilities">{props.utilities}</div>
        </details>}
    </div>;
}

export function GrowingIslandMenu(props: GrowingIslandMenuProps) {
    const { onClose } = props;
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => {
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !(event.target instanceof Element && event.target.closest('[role="dialog"]'))) { event.preventDefault(); onClose(); } };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [onClose]);
    return <section className="growing-menu growing-pocket-menu" aria-label="メニュー" data-menu-candidate="island-direct-play-v2">
        <header className="growing-pocket-heading"><h2>しまのメニュー</h2><button ref={close} className="growing-close" aria-label="メニューを とじる" onClick={props.onClose}><X size={20} aria-hidden="true" /></button></header>
        <GrowingIslandMenuContents {...props} />
    </section>;
}
