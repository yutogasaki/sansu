import * as T from 'three';
import { isFacility } from '../../../domain/islandLife/footprint';
import { activityPhase } from '../../../domain/islandLife/activity';
import type { LifeState } from '../../../domain/islandLife/model';
import { buildHeldWork } from './facilityGeometry';
import type { IslandMaterials } from '../three/primitives';
export function makeFacilityMotion(materials: IslandMaterials, bodies: T.Group[], heads: T.Group[], enabled: boolean) {
    const props = (enabled ? bodies : []).map((body, index) => {
        const book = buildHeldWork('library', materials), tools = buildHeldWork('garden-hut', materials);
        book.position.set(0,index ? .49 : .42,index ? .38 : .30); tools.position.set(0,index ? .45 : .38,index ? .40 : .30); body.add(book, tools); return { book, tools };
    });
    return (visible: LifeState, now: number, reduced: boolean) => {
        const result = new Map<string, { kind: 'library' | 'garden-hut'; action: 'reading' | 'tool-care' }>();
        props.forEach((pair, index) => {
            pair.book.visible = pair.tools.visible = false;
            const resident = visible.residents[index], visit = resident.visit, item = visible.items.find(i => i.id === visit?.itemId && i.cell);
            if (!visit || now >= visit.end || !item || !isFacility(item.kind) || activityPhase(visible, resident, now) !== item.kind) return;
            const prop = item.kind === 'library' ? pair.book : pair.tools; prop.visible = true;
            prop.rotation.z = reduced ? 0 : Math.sin((now - visit.start) / (item.kind === 'library' ? 2200 : 800)) * .045;
            prop.updateWorldMatrix(true, true);
            const head = heads[index], local = head.parent!.worldToLocal(prop.getWorldPosition(new T.Vector3())).sub(head.position);
            head.rotation.order = 'YXZ'; head.rotation.y = Math.atan2(local.x,local.z); head.rotation.x = T.MathUtils.clamp(-Math.atan2(local.y,Math.hypot(local.x,local.z)),-.3,.6);
            result.set(resident.id,{kind:item.kind,action:item.kind === 'library' ? 'reading' : 'tool-care'});
        });
        return result;
    };
}
