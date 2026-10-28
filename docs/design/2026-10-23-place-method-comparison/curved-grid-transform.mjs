const prefix = (alwaysH) => `import { curvedGridPoint, curvedGridCell } from '../../../docs/design/2026-10-23-place-method-comparison/curved-grid';\nconst curvedGridTrial = () => ${alwaysH ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('terrainTrial') === 'H'"};\n`;
function replaceOnce(source, before, after) {
    if (source.split(before).length !== 2) throw Error(`H source mismatch: ${before.slice(0, 100)}`);
    return source.replace(before, after);
}
/** Browser selection is explicit terrainTrial=H. Node diagnostics must request
 * alwaysH:true; no environment/storage/global flag participates in tests. */
export function curvedGridLandscapeTransform(source, { alwaysH = false } = {}) {
    source = replaceOnce(source, 'export function landscapePoint(cell: Cell): Cell {', 'function originalLandscapePoint(cell: Cell): Cell {');
    source = replaceOnce(source, 'export function landscapeCell(point: Cell): Cell {', 'function originalLandscapeCell(point: Cell): Cell {');
    return prefix(alwaysH) + source + '\nexport function landscapePoint(cell: Cell): Cell { const point = originalLandscapePoint(cell); return curvedGridTrial() ? curvedGridPoint(point) : point; }\nexport function landscapeCell(point: Cell): Cell { return originalLandscapeCell(curvedGridTrial() ? curvedGridCell(point) : point); }\n';
}
/** The fixed cottage is the one native root still using an absolute position.
 * Follow the same real floor as all owners in H; keep its scale and local art. */
export function curvedGridWorldSceneTransform(source, { alwaysH = false } = {}) {
    const enabled = alwaysH ? 'true' : "typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('terrainTrial') === 'H'";
    return replaceOnce(source,
        'house.position.set(2.5 - layout.center, .035, -1.5); if (!nativeCottage) house.scale.setScalar(.8);',
        `if (${enabled}) house.position.copy(layout.point({ x: 2.5, z: .5 }, .035));\n            else house.position.set(2.5 - layout.center, .035, -1.5);\n            if (!nativeCottage) house.scale.setScalar(.8);`);
}
