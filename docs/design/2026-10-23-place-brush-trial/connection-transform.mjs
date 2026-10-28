const directory='docs/design/2026-10-23-place-brush-trial/connection-seams';
function once(source,a,b){if(source.split(a).length!==2)throw Error(`Connection transform changed: ${a}`);return source.replace(a,b);}
export function connectionTransform(source,id){
 let names=[],depth='../../../';
 if(id.endsWith('/src/domain/growingIsland/places.ts')){
  names=['connectedGalleryInput'];
  source=once(source,'? placeGalleryRoute(state, { footprint, entrances }, anchor.cell, world) : [];',`? (() => { const input=connectedGalleryInput(footprint, entrances, main.map(item=>item.cell), anchor.cell); return placeGalleryRoute(state,input,input.anchor,world); })() : [];`);
 }
 if(id.endsWith('/src/components/island/growing/placeFlowerGeometry.ts')){
  depth='../../../../';names=['connectionEnabled','connectionPatch'];
  source=once(source,'function gardenFloor(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, cells: Cell[]) {',`function gardenFloor(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, cells: Cell[]) {
    if(connectionEnabled()){connectionPatch(g,layout,cells,'#93927e',.95,'place-flower-connected-soil');return;}`);
 }
 if(id.endsWith('/src/components/island/growing/native/nativePlaceGrove.ts')){
  depth='../../../../../';names=['connectionEnabled','connectionPatch'];
  source=once(source,'const points = owners.map(({ owner }) => layout.point(owner!.cell!));',`const points = owners.map(({ owner }) => layout.point(owner!.cell!));
    if(connectionEnabled()) connectionPatch(g,layout,owners.map(({owner})=>owner!.cell!),'#886f57',.65,'place-connected-root-soil');`);
 }
 if(id.endsWith('/src/components/island/growing/placePondGeometry.ts')){
  depth='../../../../';names=['connectionEnabled','connectionBank'];
  source=once(source,'const water = g.mesh(pond.geometry, material, [0, 0, 0], group);',`if(connectionEnabled())connectionBank(g,layout,pond.geometry);
    const water = g.mesh(pond.geometry, material, [0, 0, 0], group);`);
 }
 if(id.endsWith('/src/components/island/growing/placePaths.ts')){
  depth='../../../../';names=['connectionEnabled'];source=once(source,"color: '#c2c1dd', roughness: 1","color: connectionEnabled() ? '#a4a69a' : '#c2c1dd', roughness: 1");
 }
 return names.length?`import { ${names.join(', ')} } from '${depth}${directory}';\n`+source:source;
}
