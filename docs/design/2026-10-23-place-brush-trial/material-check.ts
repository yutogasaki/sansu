import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as T from 'three';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildComparisonGround } from '../2026-10-23-place-method-comparison/ground';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { replacePlace } from './model';
import { applyContinuousMaterial } from './continuous-material';

const state = replacePlace(structuredClone(fixture.state) as unknown as GrowingState,
    { center: { x: 5, z: 5 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 }, { actors: [], occupiedPlaceTargets: [] });
const layout = sceneLayout(state, true), ground = buildComparisonGround(layout, state);
const geometry = ground.floor.geometry, material = ground.floor.material, world = layout.world;
const arrays = () => Object.fromEntries([...Object.entries(geometry.attributes), ['index', geometry.getIndex()!]].map(([name, attribute]) => {
    assert(attribute instanceof T.BufferAttribute);
    return [name, createHash('sha256').update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)).digest('hex')];
}));
const before = arrays(), geometryId = geometry.id, children = [...ground.root.children], floorBefore = world.floorAt({ x: 5, z: 5 });
const firstHook = material.onBeforeCompile, firstKey = material.customProgramCacheKey;
assert.equal(applyContinuousMaterial(ground, 'baseline'), ground);
assert.equal(material.onBeforeCompile, firstHook);
assert.equal(material.customProgramCacheKey, firstKey);
let previousHookCalls = 0;
material.onBeforeCompile = (shader, renderer) => { previousHookCalls++; firstHook.call(material, shader, renderer); };
assert.equal(applyContinuousMaterial(ground, 'continuous'), ground);
const patchedHook = material.onBeforeCompile;
applyContinuousMaterial(ground, 'continuous');
assert.equal(material.onBeforeCompile, patchedHook);
const shader = { vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: T.UniformsUtils.clone(T.ShaderLib.standard.uniforms) } as Parameters<T.MeshStandardMaterial['onBeforeCompile']>[0];
// The real hook does not access a renderer. This checks source composition,
// not WebGL compilation or the actual visual result, which need a browser.
material.onBeforeCompile(shader, undefined as unknown as T.WebGLRenderer);
assert.equal(previousHookCalls, 1);
assert(shader.fragmentShader.includes('float grain=fract(sin(dot(floor(p*65.)'));
assert(shader.fragmentShader.includes('diffuseColor.rgb*=1.+(grain-.5)*.045*fade;'));
assert(shader.fragmentShader.includes('normalize(continuousGroundNormal).y'));
assert(!shader.fragmentShader.includes('#include <color_fragment>'));
assert.equal(shader.fragmentShader.split('diffuseColor.rgb *= continuousColor;').length, 2);
assert(shader.fragmentShader.indexOf('diffuseColor.rgb *= continuousColor;') < shader.fragmentShader.indexOf('float grain='));
assert(shader.vertexShader.includes('continuousGroundNormal = normal;'));
assert(shader.vertexShader.includes('terrainPoint=position;'));
assert.deepEqual(arrays(), before);
assert.equal(geometry.id, geometryId); assert.equal(ground.floor.geometry, geometry); assert.equal(ground.floor.material, material);
assert.deepEqual(ground.root.children, children);
assert.deepEqual(world.floorAt({ x: 5, z: 5 }), floorBefore);
assert.equal(material.customProgramCacheKey(), `${firstKey.call(material)}:continuous-ground-v1`);
assert.throws(() => material.onBeforeCompile({ ...shader, vertexShader: 'missing anchors', fragmentShader: 'missing anchors' }, undefined as unknown as T.WebGLRenderer), /shader changed/);
console.log(JSON.stringify({ status: 'PASS', at: new Date().toISOString(), scope: 'Actual transformed floor geometry and shader source composition; no GPU/visual claim',
    geometrySHA256: before, geometryIdentityUnchanged: true, floorAndChildrenUnchanged: true,
    existingGrainRetained: true, duplicateApplicationIsNoop: true, wrongShaderAnchorsReject: true,
    cacheKey: material.customProgramCacheKey(), material: ground.root.userData.strategyTrial }, null, 2));
ground.dispose();
