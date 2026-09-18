import { entrance } from '../../domain/natureTown/grid';
import type { Resident, WorldState } from '../../domain/natureTown/types';
import { names } from './catalog';
export function residentAppearance(resident: Resident): 'pokomoko' | 'rabbit' | 'otter' {
    return resident.appearanceRef.endsWith('rabbit') ? 'rabbit' : resident.appearanceRef.endsWith('otter') ? 'otter' : 'pokomoko';
}
export function residentName(world: WorldState, resident: Resident) {
    const kind = residentAppearance(resident), name = { pokomoko: 'ぽこもこ', rabbit: 'うさぎ', otter: 'カワウソ' }[kind];
    const peers = world.residents.filter(r => residentAppearance(r) === kind);
    return peers.length > 1 ? `${name} ${peers.findIndex(r => r.id === resident.id) + 1}` : name;
}
export function residentDetails(world: WorldState, resident: Resident) {
    const job = world.jobs.find(j => j.id === resident.jobId);
    const targetId = job ? (job.phase === 'toSource' ? job.sourceId : job.hubId) : resident.targetId;
    const prop = world.props.find(p => p.id === targetId && !p.stored);
    const insect = world.insectVisits.find(v => v.id === targetId);
    const destination = prop ? entrance(prop) : insect?.position ?? resident.path[resident.path.length - 1];
    const destinationName = prop ? names[prop.kind] : insect ? '小さな虫' : targetId?.startsWith('water:') ? '水べ' : 'さんぽの ばしょ';
    let activity = resident.state === 'reacting' ? 'いっしょに ひとやすみ' : resident.path.length ? `${destinationName}へ いどうちゅう` : 'ひとやすみ';
    if (job?.phase === 'toSource') activity = '畑へ うけとりに いくところ';
    else if (resident.carriedFood > 0) activity = job ? '食たくへ はこんでいるよ' : '食べものを 持って、道を さがしているよ';
    return { activity, destination, destinationName, cart: !!job?.usingCart, carried: resident.carriedFood, reserved: job?.phase === 'toSource' ? job.quantity : 0 };
}
