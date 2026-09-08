/** Board coordinates: columns point east, rows south. Only this module owns
 * ports and flow order; renderer clocks and learning results are not inputs. */
export const WORKSHOP_PART_IDS = ['straight', 'elbow', 'wheel', 'bell'] as const;
export type WorkshopPartId = typeof WORKSHOP_PART_IDS[number];
export const WORKSHOP_BOARD_SIZE = 4;
export const WORKSHOP_HISTORY_LIMIT = 20;
export type WorkshopRotation = 0 | 1 | 2 | 3;
export type WorkshopDirection = 'north' | 'east' | 'south' | 'west';
export type WorkshopChannel = 'water' | 'shaft';
export interface WorkshopCell { col: number; row: number }
/** Port anchors can be half cells and may lie at the edge of the board. */
export type WorkshopAnchor = WorkshopCell;
export interface WorkshopPartState { assembled: boolean; rotation: WorkshopRotation; position?: WorkshopCell }
export interface WorkshopLayout { parts: Record<WorkshopPartId, WorkshopPartState> }
export interface WorkshopDraft { layout: WorkshopLayout; undo: WorkshopLayout[]; redo: WorkshopLayout[] }
export type WorkshopDraftEdit =
    | { type: 'move'; partId: WorkshopPartId; position: WorkshopCell }
    | { type: 'rotate'; partId: WorkshopPartId; rotation: WorkshopRotation }
    | { type: 'assemble' | 'remove'; partId: WorkshopPartId }
    | { type: 'clear' }
    | { type: 'undo' }
    | { type: 'redo' };
export type WorkshopLayoutConflictCode = 'invalid-layout' | 'invalid-draft' | 'invalid-edit' | 'collision' | 'material-locked';
export class WorkshopLayoutConflict extends Error {
    constructor(public readonly code: WorkshopLayoutConflictCode, message: string) { super(message); this.name = 'WorkshopLayoutConflict'; }
}

const directions: readonly WorkshopDirection[] = ['north', 'east', 'south', 'west'];
const vectors: Record<WorkshopDirection, WorkshopCell> = {
    north: { col: 0, row: -1 }, east: { col: 1, row: 0 }, south: { col: 0, row: 1 }, west: { col: -1, row: 0 },
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
export const isWorkshopPartId = (value: unknown): value is WorkshopPartId => WORKSHOP_PART_IDS.some(id => id === value);
const rotation = (value: unknown): value is WorkshopRotation => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
export const isWorkshopCell = (value: unknown): value is WorkshopCell => record(value) && keys(value, ['col', 'row'])
    && typeof value.col === 'number' && Number.isInteger(value.col) && value.col >= 0 && value.col < WORKSHOP_BOARD_SIZE
    && typeof value.row === 'number' && Number.isInteger(value.row) && value.row >= 0 && value.row < WORKSHOP_BOARD_SIZE;
const sameCell = (a: WorkshopCell, b: WorkshopCell) => a.col === b.col && a.row === b.row;
const copyCell = (cell: WorkshopCell): WorkshopCell => ({ col: cell.col || 0, row: cell.row || 0 });

export function createEmptyWorkshopLayout(): WorkshopLayout {
    return { parts: { straight: { assembled: false, rotation: 0 }, elbow: { assembled: false, rotation: 0 },
        wheel: { assembled: false, rotation: 0 }, bell: { assembled: false, rotation: 0 } } };
}

/** Missing optional extension defaults belong to its owner. Malformed layouts
 * are rejected, never turned into an empty design. Unassembled frames may move. */
export function hasValidWorkshopLayout(value: unknown): value is WorkshopLayout {
    if (!record(value) || !keys(value, ['parts']) || !record(value.parts)
        || Object.keys(value.parts).length !== WORKSHOP_PART_IDS.length || !keys(value.parts, WORKSHOP_PART_IDS)) return false;
    const occupied = new Set<string>();
    return WORKSHOP_PART_IDS.every(id => {
        const part = (value.parts as Record<string, unknown>)[id];
        if (!record(part) || !keys(part, ['assembled', 'rotation', 'position'])
            || typeof part.assembled !== 'boolean' || !rotation(part.rotation)
            || (part.position !== undefined && !isWorkshopCell(part.position))) return false;
        if (part.position === undefined) return true;
        const cell = part.position as WorkshopCell, key = `${cell.col}:${cell.row}`;
        if (occupied.has(key)) return false;
        occupied.add(key);
        return true;
    });
}

export function normalizeWorkshopLayout(value: unknown): WorkshopLayout {
    if (!hasValidWorkshopLayout(value)) throw new WorkshopLayoutConflict('invalid-layout', 'さくひんの きろくを よみなおしてね');
    const result = createEmptyWorkshopLayout();
    for (const id of WORKSHOP_PART_IDS) {
        const part = value.parts[id];
        result.parts[id] = { assembled: part.assembled, rotation: (part.rotation || 0) as WorkshopRotation,
            ...(part.position ? { position: copyCell(part.position) } : {}) };
    }
    return result;
}

export function hasValidWorkshopDraft(value: unknown): value is WorkshopDraft {
    return record(value) && keys(value, ['layout', 'undo', 'redo']) && hasValidWorkshopLayout(value.layout)
        && Array.isArray(value.undo) && Array.isArray(value.redo)
        && value.undo.length + value.redo.length <= WORKSHOP_HISTORY_LIMIT
        && Array.from(value.undo).every(hasValidWorkshopLayout) && Array.from(value.redo).every(hasValidWorkshopLayout);
}

export function normalizeWorkshopDraft(value: unknown): WorkshopDraft {
    if (!hasValidWorkshopDraft(value)) throw new WorkshopLayoutConflict('invalid-draft', 'おためしの きろくを よみなおしてね');
    return { layout: normalizeWorkshopLayout(value.layout), undo: value.undo.map(normalizeWorkshopLayout), redo: value.redo.map(normalizeWorkshopLayout) };
}

export function createWorkshopDraft(layout: WorkshopLayout = createEmptyWorkshopLayout()): WorkshopDraft {
    return { layout: normalizeWorkshopLayout(layout), undo: [], redo: [] };
}

export function canonicalWorkshopDraftEdit(value: unknown): WorkshopDraftEdit {
    if (record(value)) {
        if ((value.type === 'clear' || value.type === 'undo' || value.type === 'redo') && keys(value, ['type'])) return { type: value.type };
        if (isWorkshopPartId(value.partId)) {
            if (value.type === 'move' && keys(value, ['type', 'partId', 'position']) && isWorkshopCell(value.position)) {
                return { type: value.type, partId: value.partId, position: copyCell(value.position) };
            }
            if (value.type === 'rotate' && keys(value, ['type', 'partId', 'rotation']) && rotation(value.rotation)) {
                return { type: value.type, partId: value.partId, rotation: (value.rotation || 0) as WorkshopRotation };
            }
            if ((value.type === 'assemble' || value.type === 'remove') && keys(value, ['type', 'partId'])) return { type: value.type, partId: value.partId };
        }
    }
    throw new WorkshopLayoutConflict('invalid-edit', 'ぶひんと ばしょを えらびなおしてね');
}

/** The caller derives permission from recorded specimen identities. History
 * never carries that authority or changes the observations that earned it. */
export function reduceWorkshopDraft(draft: WorkshopDraft, edit: WorkshopDraftEdit, assemblableParts: readonly WorkshopPartId[]): WorkshopDraft {
    const next = normalizeWorkshopDraft(draft), intent = canonicalWorkshopDraftEdit(edit);
    if (!Array.isArray(assemblableParts) || !assemblableParts.every(isWorkshopPartId)
        || [next.layout, ...next.undo, ...next.redo].some(layout => WORKSHOP_PART_IDS.some(id => layout.parts[id].assembled && !assemblableParts.includes(id)))) {
        throw new WorkshopLayoutConflict('material-locked', 'そざいを しらべてから つくろう');
    }
    if (intent.type === 'undo' || intent.type === 'redo') {
        const source = intent.type === 'undo' ? next.undo : next.redo;
        const target = intent.type === 'undo' ? next.redo : next.undo;
        const previous = source.pop();
        if (previous) { target.push(next.layout); next.layout = previous; }
        return next;
    }
    const before = normalizeWorkshopLayout(next.layout);
    if (intent.type === 'clear') {
        for (const id of WORKSHOP_PART_IDS) delete next.layout.parts[id].position;
    } else {
        const part = next.layout.parts[intent.partId];
        if (intent.type === 'assemble') {
            if (!assemblableParts.includes(intent.partId)) throw new WorkshopLayoutConflict('material-locked', 'そざいを しらべてから つくろう');
            part.assembled = true;
        } else if (intent.type === 'move') {
            if (WORKSHOP_PART_IDS.some(id => id !== intent.partId && next.layout.parts[id].position
                && sameCell(next.layout.parts[id].position!, intent.position))) throw new WorkshopLayoutConflict('collision', 'ここには べつの ぶひんが あるよ');
            part.position = copyCell(intent.position);
        } else if (intent.type === 'rotate') part.rotation = intent.rotation;
        else delete part.position;
    }
    if (JSON.stringify(before) !== JSON.stringify(next.layout)) {
        next.undo = [...next.undo, before].slice(-WORKSHOP_HISTORY_LIMIT);
        next.redo = [];
    }
    return next;
}

export interface WorkshopPort {
    ownerId: WorkshopPartId | 'source'; position: WorkshopCell; direction: WorkshopDirection;
    channel: WorkshopChannel; role: 'input' | 'output'; anchor: WorkshopAnchor;
}
export interface WorkshopConnection { from: WorkshopPort; to: WorkshopPort }
export interface WorkshopPartDefinition {
    name: string; input: { direction: WorkshopDirection; channel: WorkshopChannel };
    output?: { direction: WorkshopDirection; channel: WorkshopChannel };
}
export const WORKSHOP_PARTS: Readonly<Record<WorkshopPartId, WorkshopPartDefinition>> = {
    straight: { name: 'まっすぐの みぞ', input: { direction: 'west', channel: 'water' }, output: { direction: 'east', channel: 'water' } },
    elbow: { name: 'まがりみぞ', input: { direction: 'west', channel: 'water' }, output: { direction: 'south', channel: 'water' } },
    wheel: { name: 'こまどの すいしゃ', input: { direction: 'west', channel: 'water' }, output: { direction: 'east', channel: 'shaft' } },
    bell: { name: 'かいの ベル', input: { direction: 'west', channel: 'shaft' } },
};
export const WORKSHOP_SOURCE_PORT: Readonly<WorkshopPort> = Object.freeze({ ownerId: 'source', position: Object.freeze({ col: -1, row: 1 }),
    direction: 'east', channel: 'water', role: 'output', anchor: Object.freeze({ col: -.5, row: 1 }) });

export function rotateWorkshopDirection(direction: WorkshopDirection, turns: WorkshopRotation): WorkshopDirection {
    return directions[(directions.indexOf(direction) + turns) % directions.length];
}

/** Ports are also returned for unfinished frames so the renderer can show
 * their future fit. resolve/simulate require assembly before transmitting. */
export function getWorkshopPartPorts(partId: WorkshopPartId, part: WorkshopPartState): WorkshopPort[] {
    if (!part.position) return [];
    const definition = WORKSHOP_PARTS[partId];
    return (['input', 'output'] as const).flatMap(role => {
        const base = definition[role];
        if (!base) return [];
        const direction = rotateWorkshopDirection(base.direction, part.rotation), vector = vectors[direction];
        return [{ ownerId: partId, position: copyCell(part.position!), direction, channel: base.channel, role,
            anchor: { col: part.position!.col + vector.col * .5, row: part.position!.row + vector.row * .5 } }];
    });
}

export type WorkshopStopReason = 'empty' | 'unassembled' | 'misaligned' | 'wrong-channel' | 'board-edge' | 'loop';
export interface WorkshopStop { reason: WorkshopStopReason; at: WorkshopAnchor; target: WorkshopCell; partId?: WorkshopPartId }
export type WorkshopBeat =
    | { type: 'flow'; channel: WorkshopChannel; from: WorkshopAnchor; to: WorkshopAnchor; fromId: WorkshopPartId | 'source'; toId: WorkshopPartId | 'source' }
    | { type: 'wheel' | 'bell'; partId: WorkshopPartId; at: WorkshopAnchor }
    | ({ type: 'stop' } & WorkshopStop);
export interface WorkshopSimulation { beats: WorkshopBeat[]; reachedPartIds: WorkshopPartId[]; complete: boolean; stop?: WorkshopStop }

function nextConnection(layout: WorkshopLayout, output: WorkshopPort): WorkshopConnection | WorkshopStop {
    const step = vectors[output.direction], target = { col: output.position.col + step.col, row: output.position.row + step.row };
    const at = copyCell(output.anchor);
    if (!isWorkshopCell(target)) return { reason: 'board-edge', at, target };
    const partId = WORKSHOP_PART_IDS.find(id => layout.parts[id].position && sameCell(layout.parts[id].position!, target));
    if (!partId) return { reason: 'empty', at, target };
    const part = layout.parts[partId];
    if (!part.assembled) return { reason: 'unassembled', at, target, partId };
    const input = getWorkshopPartPorts(partId, part).find(port => port.role === 'input')!;
    if (input.direction !== rotateWorkshopDirection(output.direction, 2)) return { reason: 'misaligned', at, target, partId };
    if (input.channel !== output.channel) return { reason: 'wrong-channel', at, target, partId };
    return { from: output, to: input };
}

/** All valid physical edges, including disconnected islands of parts. The
 * simulator separately traces only edges actually reached from the source. */
export function resolveWorkshopConnections(value: WorkshopLayout): WorkshopConnection[] {
    const layout = normalizeWorkshopLayout(value);
    const outputs = [WORKSHOP_SOURCE_PORT, ...WORKSHOP_PART_IDS.flatMap(id => layout.parts[id].assembled
        ? getWorkshopPartPorts(id, layout.parts[id]).filter(port => port.role === 'output') : [])];
    return outputs.flatMap(output => {
        const result = nextConnection(layout, output);
        return 'from' in result ? [result] : [];
    });
}

/** Each water/shaft segment touches the same half-cell anchors the renderer
 * uses. Reaching a part is a potential visible outcome, never a saved discovery. */
export function simulateWorkshop(value: WorkshopLayout): WorkshopSimulation {
    const layout = normalizeWorkshopLayout(value), beats: WorkshopBeat[] = [], reachedPartIds: WorkshopPartId[] = [];
    let output: WorkshopPort = WORKSHOP_SOURCE_PORT;
    beats.push({ type: 'flow', channel: 'water', from: copyCell(output.position), to: copyCell(output.anchor), fromId: 'source', toId: 'source' });
    const stopped = (stop: WorkshopStop): WorkshopSimulation => {
        beats.push({ type: 'stop', ...stop });
        return { beats, reachedPartIds, complete: false, stop };
    };
    for (let turn = 0; turn <= WORKSHOP_PART_IDS.length; turn++) {
        const connection = nextConnection(layout, output);
        if (!('from' in connection)) return stopped(connection);
        const id = connection.to.ownerId as WorkshopPartId, part = layout.parts[id], center = copyCell(part.position!);
        if (reachedPartIds.includes(id)) return stopped({ reason: 'loop', at: copyCell(output.anchor), target: center, partId: id });
        reachedPartIds.push(id);
        beats.push({ type: 'flow', channel: output.channel, from: copyCell(output.anchor), to: center, fromId: output.ownerId, toId: id });
        if (id === 'wheel' || id === 'bell') beats.push({ type: id, partId: id, at: copyCell(center) });
        if (id === 'bell') return { beats, reachedPartIds, complete: true };
        output = getWorkshopPartPorts(id, part).find(port => port.role === 'output')!;
        beats.push({ type: 'flow', channel: output.channel, from: center, to: copyCell(output.anchor), fromId: id, toId: id });
    }
    return stopped({ reason: 'loop', at: copyCell(output.anchor), target: copyCell(output.position) });
}
