import { useLayoutEffect, useRef, type PointerEvent } from 'react';
import { Waves, Route, Unplug, Bug, Footprints } from 'lucide-react';
import type { CellPos, DomainEvent, WorldState } from '../../domain/natureTown/types';
import { channelSources } from '../../domain/natureTown/environment';
import { context } from '../../domain/natureTown/world';
import { key } from '../../domain/natureTown/grid';
import LifeResidentPortrait from '../island/life/LifeResidentPortrait';
import { names, icons } from './catalog';
import { FoodPile, FarmPatch, FoodTable } from './LivingPieces';
import { FoodTransfers } from './FoodTransfers';
import { recentEvent, type Connection } from './livingPresentation';
import { residentAppearance, residentName } from './residentDetails';
interface MapProps {
    world: WorldState;
    events: DomainEvent[];
    connections: Map<string, Connection>;
    selected?: CellPos;
    preview: CellPos[];
    onCell: (position: CellPos, connect?: boolean) => void;
    overview: boolean;
    overlay: 'none' | 'moisture' | 'shade' | 'traffic';
    brush?: boolean;
    editing?: boolean;
    panOnly?: boolean;
    invalidPreview?: boolean;
    residentId?: string;
    onResident: (id: string) => void;
    focus?: { position: CellPos; request: number };
}
export function TownMap({ world, events, connections, selected, preview, onCell, overview, overlay, brush, editing, panOnly, invalidPreview, residentId, onResident, focus }: MapProps) {
    const ref = useRef<HTMLDivElement>(null), geometry = useRef<{ size: number; maxY: number } | null>(null);
    const center = useRef({ x: 8, y: 8 });
    const stroke = useRef<{ pointerId: number; last?: string; outside: boolean } | null>(null);
    const side = 16, size = overview ? 27 : 48;
    const { reached } = channelSources(world, context());
    const visitorHub = world.offer?.status === 'pending' ? world.props.find(p => p.id === world.offer?.preferredHubId) : undefined;
    const maxX = Math.max(...world.chunks.map(c => c.coordinate[0])) * side + side;
    const maxY = Math.max(...world.chunks.map(c => c.coordinate[1])) * side + side;
    const allCells = world.chunks.flatMap(ch => ch.cells), available = new Set(allCells.map(c => key(c.position)));
    const props = new Map(world.props.filter(p => !p.stored).map(p => [key(p.position), p]));
    const pendingCells = new Set(preview.map(key));
    const resident = world.residents.find(r => r.id === residentId);
    const routeCells = new Set(resident?.path.map(key));
    // Preserve the world coordinate at the viewport center across zoom and northern expansion.
    useLayoutEffect(() => {
        const view = ref.current;
        if (!view) return;
        const { x, y } = center.current;
        view.scrollLeft = x * size - view.clientWidth / 2;
        view.scrollTop = (maxY - y) * size - view.clientHeight / 2;
        geometry.current = { size, maxY };
    }, [size, maxY]);
    useLayoutEffect(() => {
        const view = ref.current;
        if (!view || !focus) return;
        view.scrollLeft = (focus.position[0] + .5) * size - view.clientWidth / 2;
        view.scrollTop = (maxY - focus.position[1] - .5) * size - view.clientHeight / 2;
        // A focus request is deliberate and one-shot, never automatic tracking on every tick.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focus]);
    const sample = (event: PointerEvent<HTMLDivElement>, start = false) => {
        const view = event.currentTarget, bounds = view.getBoundingClientRect(), active = stroke.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
        if (x < 0 || y < 0 || x >= view.clientWidth || y >= view.clientHeight) { active.outside = true; active.last = undefined; return; }
        const position: CellPos = [Math.floor((x + view.scrollLeft) / size), maxY - 1 - Math.floor((y + view.scrollTop) / size)];
        const cellKey = key(position);
        if (!available.has(cellKey)) { active.outside = true; active.last = undefined; return; }
        if (active.last === cellKey) return;
        onCell(position, !start && !active.outside);
        active.last = cellKey; active.outside = false;
    };
    return <div className={`town-map-scroll ${brush ? 'town-brush-active' : ''}`} ref={ref} aria-label={brush ? 'なぞって道をえらぶ地図' : 'しまの地図。スクロールで移動できます'}
        onScroll={event => {
            const view = event.currentTarget, previous = geometry.current;
            if (previous) center.current = { x: (view.scrollLeft + view.clientWidth / 2) / previous.size, y: previous.maxY - (view.scrollTop + view.clientHeight / 2) / previous.size };
        }}
        onPointerDown={event => {
            if (!brush) return;
            if (!event.isPrimary || event.button !== 0) { stroke.current = null; return; }
            event.preventDefault();
            stroke.current = { pointerId: event.pointerId, outside: false };
            event.currentTarget.setPointerCapture(event.pointerId); sample(event, true);
        }}
        onPointerMove={event => { if (brush && stroke.current) sample(event); }}
        onPointerUp={event => {
            if (stroke.current?.pointerId !== event.pointerId) return;
            sample(event); stroke.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { stroke.current = null; }} onLostPointerCapture={() => { stroke.current = null; }}>
        <div className="town-map" style={{ width: maxX * size, height: maxY * size }} data-testid="town-map">
            {allCells.map(c => {
                const cellKey = key(c.position), prop = props.get(cellKey), Icon = prop ? icons[prop.kind] : null;
                const insects = world.insectVisits.some(v => key(v.position) === cellKey);
                const connection = prop && connections.get(prop.id);
                const chosen = selected && key(selected) === cellKey, pending = pendingCells.has(cellKey);
                const value = overlay === 'moisture' ? c.moisture : overlay === 'shade' ? c.shade : Math.min(1, c.traffic / 12);
                return <button key={cellKey} type="button" data-cell={cellKey}
                    className={`town-cell ${c.terrain} ${c.path ? 'path' : ''} ${c.bridge ? 'bridge' : ''} ${c.channel ? 'channel' : ''} ${prop ? `prop-${prop.kind}` : ''} ${chosen ? 'selected' : ''} ${pending ? 'pending' : ''} ${pending && invalidPreview ? 'invalid' : ''}`}
                    style={{ left: c.position[0] * size, top: (maxY - c.position[1] - 1) * size, width: size, height: size }}
                    onClick={event => { if (!panOnly && (!brush || event.detail === 0)) onCell(c.position); }}
                    aria-label={`${c.position[0]},${c.position[1]} ${prop ? names[prop.kind] : c.bridge ? '橋' : c.channel ? '水路' : c.path ? '道' : c.terrain === 'water' ? '川' : '地面'}`} aria-pressed={!!chosen}>
                    {overlay !== 'none' && <span className={`town-overlay ${overlay}`} style={{ opacity: value * .7 }}/>}
                    {c.terrain === 'water' && !c.bridge && <Waves size={20}/>}
                    {c.path && !prop && <Route size={14}/>}
                    {c.channel && <span className={`town-channel-mark ${reached.has(cellKey) ? 'flowing' : 'dry'}`}>≋</span>}
                    {prop?.kind === 'farm' ? <FarmPatch farm={prop} harvest={recentEvent(events, prop.id, 'FoodHarvested')}/> : prop?.kind === 'hub' ? <FoodTable food={prop.inventory.food} meal={recentEvent(events, prop.id, 'MealServed')}/> : Icon && <Icon size={prop?.kind === 'tree' ? 34 : 27} strokeWidth={1.7}/>}
                    {prop?.kind === 'farm' && prop.inventory.food > 0 && <span className="town-basket"><FoodPile count={prop.inventory.food}/></span>}
                    {connection && connection !== 'connected' && <span className="town-supply-break" data-connection={connection} role="img" aria-label={connection === 'blocked' ? '食たくへ通れない' : connection === 'far' ? '食たくまで遠い' : '食たく未接続'}><Unplug size={15}/></span>}
                    {routeCells.has(cellKey) && <span className="town-route-dot" aria-hidden="true"/>}
                    {pending && invalidPreview && <span className="town-invalid-mark" aria-hidden="true">×</span>}
                    {insects && <Bug className="town-bug" size={15}/>}
                    {overlay === 'traffic' && c.traffic > 1 && <Footprints size={14}/>}
                </button>;
            })}
            {world.residents.map((r, index) => <button type="button" key={r.id} className={`town-resident-marker ${r.id === residentId ? 'chosen' : ''}`}
                style={{ left: r.position[0] * size + (size - 44) / 2, top: (maxY - r.position[1] - 1) * size + (size - 44) / 2, zIndex: r.id === residentId ? 10 : 5 + index % 3, pointerEvents: editing ? 'none' : undefined }}
                tabIndex={editing ? -1 : 0} aria-hidden={editing || undefined} aria-label={`${residentName(world, r)}のようす`} onClick={() => onResident(r.id)}>
                <LifeResidentPortrait resident={residentAppearance(r)}/>
                {r.carriedFood > 0 && <span className="town-cargo"><FoodPile count={r.carriedFood} cart={!!world.jobs.find(j => j.id === r.jobId)?.usingCart}/></span>}
                {r.state === 'reacting' && <span className="town-greeting">♪</span>}
            </button>)}
            <FoodTransfers events={events} size={size} maxY={maxY} width={maxX * size}/>
            {visitorHub && 'entrance' in visitorHub && <span className="town-person town-visitor" style={{ position: 'absolute', left: visitorHub.entrance[0] * size, top: (maxY - visitorHub.entrance[1] - 1) * size }} title="すんでみたい旅人">
                <LifeResidentPortrait resident={world.offer?.templateId === 'r5' ? 'rabbit' : world.offer?.templateId === 'r6' ? 'otter' : 'pokomoko'}/><span className="town-greeting">?</span>
            </span>}
        </div>
    </div>;
}
