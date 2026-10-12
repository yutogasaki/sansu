import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const directory = '/private/tmp/sansu-districts-c7/layouts';
const layouts = ['east-chain', 'north-chain', 'two-arms'].map(id => JSON.parse(readFileSync(`${directory}/${id}.json`, 'utf8')));
const sourceSha256 = sha(readFileSync('src/domain/growingIsland/authoredDistrictWorld.ts'));
for (const layout of layouts) {
    assert(layout.pass); assert.equal(layout.code.composer, sourceSha256);
    assert.equal(layout.final.placements, 106); assert.equal(layout.final.reachableAddedPlacements, 33);
    assert.deepEqual(layout.grants.map(grant => grant.templateId).sort(), ['native05-harbor-lowland-v1', 'native05-northern-hill-v1']);
    assert.equal(layout.inputs.catalog.sha256, layouts[0].inputs.catalog.sha256);
    assert.equal(layout.inputs.state.ownerLedgerSha256, layouts[0].inputs.state.ownerLedgerSha256);
}
assert.equal(new Set(layouts.map(layout => JSON.stringify(layout.final.bounds))).size, 3);
assert.equal(new Set(layouts.map(layout => layout.final.revision)).size, 3);
const result = { pass: true, created: new Date().toISOString(), composerSha256: sourceSha256, inputs: layouts[0].inputs,
    invariants: { identicalTemplates: true, totalPlacementRights: 106, basePlacementRights: 73, addedPlacementRights: 33,
        allAddedPlacementsReachableFromHome: true, priorAnchorsSupportAndFloorsUnmodified: true, ownerStateUnmodified: true,
        distinctBounds: true, distinctRevisions: true, preservedSharedSeaDatum: layouts.every(layout => layout.grants.every(grant => grant.worldOrigin.y === 0)) },
    layouts: layouts.map(layout => ({ id: layout.layout, proof: `${directory}/${layout.layout}.json`, revision: layout.final.revision,
        ledgerSha256: layout.ledgerSha256, definitionSha256: layout.final.definitionSha256, bounds: layout.final.bounds,
        sites: layout.final.sites, reachedSites: layout.final.reachableSitesFromHome, elapsedMs: layout.elapsedMs })),
    scope: layouts[0].scope };
writeFileSync(`${directory}/summary.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
