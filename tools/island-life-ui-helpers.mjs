import assert from 'node:assert/strict';
import {waitForAsync} from './island-e2e-helpers.mjs';
export async function saved(page, id, project = false) { return page.evaluate(async ({id, project}) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const record = await lifeDb.worlds.get(id); return { record, state: replayLife(record, project ? record.now + Math.max(0, Date.now() - record.realAt) : record.now) }; }, {id, project}); }
export async function closeMenu(page) { const b = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await b.isVisible()) await b.click(); }
export async function inventory(page, id) {
    await closeMenu(page); await page.getByRole('button', { name: 'つくる', exact: true }).click();
    await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
    const previous=page.getByRole('button',{name:'まえの ページ',exact:true});
    while(await previous.isVisible()&&await previous.isEnabled())await previous.click();
    const item=page.locator(`[data-life-item="${id}"]`),next=page.getByRole('button',{name:'つぎの ページ',exact:true});
    for(let count=0;count<15;count++){
        if(await item.isVisible()){await item.click();return;}
        assert(await next.isVisible()&&await next.isEnabled(),`Inventory item missing: ${id}`);await next.click();
    }
    throw new Error(`Inventory pagination exceeded: ${id}`);
}
export async function putCell(page, cell) {
    const at = await page.locator('.life-world').evaluate((n, c) => {
        const { projection, view } = JSON.parse(n.dataset.lifeCamera), r = n.getBoundingClientRect(); const mul = (m, v) => [0,1,2,3].map(r => m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
        const p = mul(projection, mul(view, [c.x-2.5,.045,c.z-2,1])); return { x:r.left+(p[0]/p[3]+1)*r.width/2,y:r.top+(1-p[1]/p[3])*r.height/2 };
    }, cell);
    await page.touchscreen.tap(at.x, at.y); await page.locator(`[data-life-placement-cell="${cell.x},${cell.z}"][data-life-placement-valid="true"]`).waitFor(); await page.getByRole('button', { name: 'ここに おく', exact: true }).click(); await closeMenu(page);
}
export async function buy(page,kind,cell,id) {
    const count=(await saved(page,id)).record.actions.length;
    await closeMenu(page);await page.getByRole('button',{name:'つくる',exact:true}).click();await page.getByRole('group',{name:'しまの ていれ'}).getByRole('button',{name:'つくる',exact:true}).click();
    const pageNumber=Math.floor(['flower','bench','swing','lantern','sapling','water-bowl','picnic-table','pinwheel','flower-arch','sandbox','garden-hut','library'].indexOf(kind)/2)+1;
    assert(pageNumber>0);if(pageNumber>1)await page.getByRole('button',{name:`${pageNumber}ページめ`,exact:true}).click();
    await page.locator(`[data-life-buy="${kind}"]`).click();await putCell(page,cell);
    await waitForAsync(page,async({id,kind,cell,count})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const r=await lifeDb.worlds.get(id);return r.actions.slice(count).some(a=>a.command.type==='buy'&&a.command.kind===kind&&a.command.cell.x===cell.x&&a.command.cell.z===cell.z);},{id,kind,cell,count});
}

export async function callResident(page, itemId, profileId) {
    const count=(await saved(page,profileId)).record.actions.length;
    await inventory(page,itemId);await page.getByRole('button',{name:'ぽこもこを よぶ',exact:true}).click();await closeMenu(page);
    await waitForAsync(page,async({profileId,itemId,count})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const r=await lifeDb.worlds.get(profileId);return r.actions.slice(count).some(a=>a.command.type==='visit'&&a.command.itemId===itemId);},{profileId,itemId,count});
}
export async function moveItem(page,itemId,cell,profileId){
    const count=(await saved(page,profileId)).record.actions.length;
    await inventory(page,itemId);await page.getByRole('button',{name:'うごかす',exact:true}).click();await putCell(page,cell);
    await waitForAsync(page,async({profileId,itemId,cell,count})=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const r=await lifeDb.worlds.get(profileId);return r.actions.slice(count).some(a=>a.command.type==='move'&&a.command.itemId===itemId&&a.command.cell.x===cell.x&&a.command.cell.z===cell.z);},{profileId,itemId,cell,count});
}
export async function openObservation(page,itemId){
    await inventory(page,itemId);await page.getByRole('button',{name:'みてみる',exact:true}).click();await page.locator('.life-observation [data-rendered="true"]').waitFor();
}
