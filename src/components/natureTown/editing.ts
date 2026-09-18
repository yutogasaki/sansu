import type { CellPos, Prop, WorldCommandPayload, WorldState } from '../../domain/natureTown/types';
import { at, key } from '../../domain/natureTown/grid';

export type OverlayKind = 'path' | 'bridge' | 'channel';
export type Tool = Prop['kind'] | OverlayKind | 'erase';
export const isBrush = (tool?: Tool): boolean => !!tool && ['path', 'bridge', 'channel', 'erase'].includes(tool);

/** Interpolate skipped pointer samples, but never bridge an outside/cancelled segment. */
export function extendStroke(before: CellPos[], position: CellPos, connect = true): CellPos[] {
    const next = [...before];
    let [x, y] = connect && next.length ? next[next.length - 1] : position;
    if (!connect || !next.length) next.push(position);
    while (x !== position[0]) { x += Math.sign(position[0] - x); next.push([x, y]); }
    while (y !== position[1]) { y += Math.sign(position[1] - y); next.push([x, y]); }
    const unique = new Map(next.map(p => [key(p), p]));
    unique.delete(key(position)); unique.set(key(position), position);
    return [...unique.values()];
}

export interface EditIntent { payload: WorldCommandPayload; inverse?: WorldCommandPayload }
export function editIntent(world: WorldState, preview: CellPos[], tool?: Tool, moving?: string, erase: OverlayKind = 'path', newId = 'placement-preview'): EditIntent | undefined {
    const position = preview[preview.length - 1];
    if (!position) return;
    if (moving) {
        const prop = world.props.find(p => p.id === moving);
        if (!prop) return;
        return {
            payload: { type: prop.stored ? 'restoreProp' : 'moveProp', propId: prop.id, position, rotation: prop.rotation },
            inverse: prop.stored ? { type: 'storeProp', propId: prop.id } : { type: 'moveProp', propId: prop.id, position: prop.position, rotation: prop.rotation },
        };
    }
    if (tool === 'erase') {
        const original = preview.filter(p => at(world, p)?.[erase]);
        return {
            payload: { type: 'removeOverlay', kind: erase, cells: preview },
            inverse: original.length ? { type: erase === 'path' ? 'paintPath' : erase === 'bridge' ? 'placeBridge' : 'paintChannel', cells: original } : undefined,
        };
    }
    if (tool === 'path' || tool === 'bridge' || tool === 'channel') {
        const added = preview.filter(p => !at(world, p)?.[tool]);
        return {
            payload: { type: tool === 'path' ? 'paintPath' : tool === 'bridge' ? 'placeBridge' : 'paintChannel', cells: preview },
            inverse: added.length ? { type: 'removeOverlay', kind: tool, cells: added } : undefined,
        };
    }
    if (tool) return {
        payload: { type: 'placeProp', id: newId, kind: tool, position, rotation: 0 },
        inverse: { type: 'storeProp', propId: newId },
    };
}
