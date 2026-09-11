import { CATALOG, HOUR, LIFE_RULES, LIFE_STEP_MS, vigor, type LifeAction, type LifeCommand, type LifeRecord, type LifeState, type LifeResident, type Cell } from './model';
import { districts, homeCell, sameCell, usablePlacement, pathToActivity } from './space';

function initial(now: number): LifeState {
    return { now, activityVersion: 1, drops: 0, light: 0, items: [], styles: ['original'], heroStyle: 'original', days: {},
        residents: (['pokomoko', 'rabbit', 'otter'] as const).map((id, index) => ({ id, cell: index === 0 ? { ...homeCell } : { x: 3, z: index }, enjoyed: 0, enjoyedBy: {} })) };
}
function hash(s: string) { let n = 2166136261; for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619); return n >>> 0; }
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export const favorite = (r: LifeResident) => r.id === 'rabbit' ? 'flower' : r.id === 'otter' ? 'swing' : 'bench';
export function residentCell(r: LifeResident, now: number) {
    return r.visit ? r.visit.path[Math.min(r.visit.path.length - 1, Math.max(0, Math.floor((now - r.visit.start) / LIFE_STEP_MS)))] : r.cell;
}
export function arrangeVisits(s: LifeState) {
    const developed = s.activityVersion === 2 ? new Set(districts(s).flatMap(d => d.ids)) : new Set<string>();
    // A fixed assignment order lets the first two residents monopolize two seats.
    // An explicit hero destination comes first; otherwise give less-served residents a turn.
    const order = s.activityVersion === 1 ? s.residents : [...s.residents].sort((a, b) => {
        if (s.target && a.id === 'pokomoko') return -1;
        if (s.target && b.id === 'pokomoko') return 1;
        const newFavorite = (r: LifeResident) => Number(Boolean(r.discovery && s.now - r.discovery.at < 15000
            && s.items.some(i => i.id === r.discovery!.itemId && i.kind === favorite(r))));
        return a.enjoyed - b.enjoyed || newFavorite(b) - newFavorite(a)
            || hash(`${a.id}:${Math.floor(s.now / LIFE_RULES.activityMs)}`) - hash(`${b.id}:${Math.floor(s.now / LIFE_RULES.activityMs)}`);
    });
    for (const r of order) {
        if (r.visit && !s.items.some(i => i.id === r.visit!.itemId && i.cell)) { r.visit = undefined; r.cell = { ...homeCell }; }
        if (r.visit) continue;
        const choices = s.items.filter(i => i.cell && i.kind !== 'lantern').flatMap(i => {
            const reserved = s.activityVersion === 2 ? s.residents.filter(other => other !== r && other.visit).map(other => other.visit!.path[other.visit!.path.length - 1]) : [];
            const path = pathToActivity(s, r.cell, i, reserved); if (!path) return [];
            const crowd = s.residents.filter(other => other.visit?.itemId === i.id).length;
            if (crowd >= (i.kind === 'swing' || s.activityVersion === 2 && i.kind === 'bench' ? 1 : 2)) return [];
            const like = r.id === 'rabbit' ? i.kind === 'flower' : r.id === 'otter' ? i.kind === 'swing' : i.kind === 'bench';
            const lamp = s.items.some(l => l.kind === 'lantern' && l.cell && Math.abs(l.cell.x - i.cell!.x) + Math.abs(l.cell.z - i.cell!.z) <= 2);
            if (s.activityVersion === 1) return [{ item: i, path, weight: 2 + (like ? 5 : 0) + (i.id === s.target ? r.id === 'pokomoko' ? 100 : 3 : 0) + (lamp ? 2 : 0) - path.length * .08 }];
            const nearFavorite = i.kind === 'bench' && s.items.some(n => n.cell && n.kind === favorite(r) && distance(n.cell, i.cell!) <= 2);
            const heroPlace = s.items.find(n => n.id === s.residents[0].visit?.itemId)?.cell;
            const nearHero = r.id !== 'pokomoko' && heroPlace && distance(heroPlace, i.cell!) <= 2;
            const discovered = r.discovery && s.now - r.discovery.at < 15000 ? s.items.find(n => n.id === r.discovery!.itemId)?.cell : undefined;
            const newPlace = discovered ? i.id === r.discovery!.itemId ? 12 : distance(discovered, i.cell!) <= 2 ? 5 : 0 : 0;
            return [{ item: i, path, weight: 2 + (like ? 8 : 0) + (nearFavorite ? 5 : 0) + (nearHero ? 7 : 0)
                + newPlace + (developed.has(i.id) ? 2 : 0) + (lamp ? 2 : 0) - path.length * .08 }];
        });
        if (!choices.length) continue;
        let dice = hash(`${r.id}:${r.enjoyed}:${Math.floor(s.now / LIFE_RULES.activityMs)}`) / 2 ** 32 * choices.reduce((n, c) => n + c.weight, 0);
        const requested = r.id === 'pokomoko' && s.target ? choices.find(c => c.item.id === s.target) : undefined;
        if (r.id === 'pokomoko' && s.target && !requested) continue;
        const chosen = requested ? requested
            : choices.find(c => (dice -= c.weight) <= 0) ?? choices[0];
        r.visit = { itemId: chosen.item.id, path: chosen.path, from: { ...r.cell }, start: s.now, end: s.now + LIFE_RULES.activityMs };
    }
}
function advance(s: LifeState, to: number) {
    if (!Number.isFinite(to) || to < s.now) throw new Error('Invalid world time');
    arrangeVisits(s);
    while (s.now < to) {
        let next = to;
        if (s.lastAchievement !== undefined) for (const boundary of [24, 72].map(h => s.lastAchievement! + h * HOUR)) if (boundary > s.now) next = Math.min(next, boundary);
        for (const r of s.residents) if (r.visit) next = Math.min(next, r.visit.end);
        const hours = (next - s.now) / HOUR * vigor(s);
        for (const i of s.items) if (i.kind === 'flower' && i.cell) i.growth = Math.min(LIFE_RULES.bloomHours, i.growth + hours);
        s.now = next;
        for (const r of s.residents) if (r.visit && r.visit.end <= next) {
            const kind = s.items.find(i => i.id === r.visit!.itemId)?.kind;
            if (kind) r.enjoyedBy[kind] = (r.enjoyedBy[kind] ?? 0) + 1;
            r.cell = r.visit.path[r.visit.path.length - 1]; r.visit = undefined; r.enjoyed++; s.light++;
        }
        arrangeVisits(s);
    }
}
function fail(message: string): never { throw new Error(message); }
export function applyCommand(s: LifeState, event: LifeAction) {
    const c = event.command;
    if (c.type === 'buy') {
        if (!CATALOG[c.kind]) fail('この どうぐは まだ ないよ。');
        if (s.drops < CATALOG[c.kind].price) fail('しずくが もうすこし いるよ。');
        if (s.items.length >= LIFE_RULES.maxItems) fail('もちものが いっぱいだよ。');
        const item = { id: event.id, kind: c.kind, cell: undefined, growth: 0, style: 'original' as const,
            access: s.activityVersion === 2 && ['bench', 'swing'].includes(c.kind) ? 'front' as const : undefined };
        s.items.push(item);
        if (!usablePlacement(s, item.id, c.cell)) { s.items.pop(); fail('そこには おけないよ。みちを あけてね。'); }
        s.items[s.items.length - 1] = { ...item, cell: c.cell }; s.drops -= CATALOG[c.kind].price;
        if (s.activityVersion === 2) for (const r of s.residents) {
            const likes = favorite(r) === c.kind;
            const close = distance(residentCell(r, s.now), c.cell) <= 3;
            const interested = hash(`${event.id}:${r.id}`) % 10 < (likes ? 10 : close ? 7 : 3);
            if (!interested || r.id === 'pokomoko' && s.target) continue;
            r.discovery = { itemId: item.id, at: s.now, mood: likes || close ? 'notice' : 'curious' };
            r.cell = residentCell(r, s.now); r.visit = undefined;
        }
    } else if (c.type === 'expand') {
        if (s.expanded) fail('この しまは ここまで ひろがったよ。');
        if (!['east', 'west'].includes(c.side) || s.drops < LIFE_RULES.expansionPrice) fail('しずくが もうすこし いるよ。');
        s.expanded = c.side; s.drops -= LIFE_RULES.expansionPrice;
    } else if (c.type === 'style') {
        if (!['original', 'sunshine', 'starlight'].includes(c.style)) fail('その いろは まだ ないよ。');
        const item = c.itemId ? s.items.find(i => i.id === c.itemId) : undefined;
        if (c.itemId && !item) fail('もう しまってある ものかも。');
        if (!s.styles.includes(c.style)) { if (s.light < LIFE_RULES.stylePrice) fail('ひかりが もうすこし いるよ。'); s.light -= LIFE_RULES.stylePrice; s.styles.push(c.style); }
        if (item) item.style = c.style; else s.heroStyle = c.style;
    } else {
        const item = s.items.find(i => i.id === c.itemId);
        if (!item) fail('その ものが みつからないよ。');
        if (c.type === 'visit') {
            if (!item.cell || item.kind === 'lantern' || !pathToActivity(s, homeCell, item)) fail('ここでは あそべないよ。');
            const changed = s.target !== item.id;
            s.target = item.id;
            const hero = s.residents[0];
            if (hero.visit?.itemId !== item.id) {
                if (hero.visit) hero.cell = residentCell(hero, s.now);
                hero.visit = undefined;
            }
            if (changed && s.activityVersion === 2) for (const other of s.residents.slice(1)) {
                // One invitation per new destination. The resident still chooses
                // their own reachable, uncrowded place; no instant light is paid.
                const interested = hash(`${event.id}:${other.id}`) % 10 < 7;
                if (interested && other.visit?.itemId !== item.id) { other.cell = residentCell(other, s.now); other.visit = undefined; }
            }
        } else {
            if (c.type === 'move' && !usablePlacement(s, item.id, c.cell)) fail('そこには おけないよ。みちを あけてね。');
            // Reroute all walkers after any edit; interrupted visits never yield light.
            for (const r of s.residents) { r.cell = s.activityVersion === 2 ? residentCell(r, s.now) : { ...homeCell }; r.visit = undefined; r.discovery = undefined; }
            if (c.type === 'remove') { s.items = s.items.filter(i => i.id !== item.id); s.drops += Math.floor(CATALOG[item.kind].price / 2); }
            else item.cell = c.type === 'move' ? c.cell : undefined;
            if (c.type === 'move' && s.activityVersion === 2 && ['bench', 'swing'].includes(item.kind)) item.access = 'front';
            if (s.target === item.id) s.target = undefined;
        }
    }
    // Edits must also invalidate paths planned before a new obstacle was bought.
    for (const r of s.residents) {
        const occupied = (p: typeof r.cell) => s.items.some(i => i.cell && sameCell(i.cell, p));
        if (r.visit && r.visit.path.some(occupied)) {
            r.cell = residentCell(r, s.now);
            r.visit = undefined;
        }
        if (occupied(r.cell)) { r.cell = { ...homeCell }; r.visit = undefined; }
    }
    arrangeVisits(s);
}
export function replayLife(record: LifeRecord, to = record.now): LifeState {
    const s = initial(record.createdAt);
    const events = [...record.credits.map(c => ({ at: c.at, credit: c, action: undefined, switchVersion: false, rank: 0 })),
        ...record.actions.map((a, index) => ({ at: a.at, credit: undefined, action: a, switchVersion: false,
            rank: a.at === record.activitiesV2At && index < (record.activitiesV2After ?? 0) ? .5 : 2 })),
        ...(record.activitiesV2At === undefined ? [] : [{ at: record.activitiesV2At, credit: undefined, action: undefined, switchVersion: true, rank: 1 }])]
        .sort((a, b) => a.at - b.at || a.rank - b.rank);
    const credited = new Set<string>();
    for (const event of events) {
        if (event.at > to) break;
        advance(s, Math.max(s.now, event.at));
        if (event.credit) {
            const c = event.credit; if (credited.has(c.id)) continue; credited.add(c.id);
            s.drops += LIFE_RULES.dropsPerProblem;
            s.days[c.day] = (s.days[c.day] ?? 0) + 1;
            if (s.days[c.day] === LIFE_RULES.dailyGoal) s.lastAchievement = c.at;
        } else if (event.switchVersion) {
            s.activityVersion = 2;
            for (const r of s.residents) { r.cell = residentCell(r, s.now); r.visit = undefined; }
            arrangeVisits(s);
        } else if (event.action) applyCommand(s, event.action);
    }
    advance(s, Math.max(s.now, to)); return s;
}
export function commandLife(record: LifeRecord, command: LifeCommand, id: string, now: number) {
    if (record.actions.some(a => a.id === id)) return record;
    const event = { id, at: now, command }; applyCommand(replayLife(record, now), event);
    return { ...record, now, revision: record.revision + 1, actions: [...record.actions, event] };
}
