import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { IslandScene } from './runtime';

afterEach(() => vi.unstubAllGlobals());

it('redraws a resized room before yielding to the animation loop, including reduced-motion idle rooms', () => {
    vi.stubGlobal('document', { hidden: false });
    const calls: string[] = [];
    const runtime = Object.assign(Object.create(IslandScene.prototype), {
        disposed: false, lost: false, onscreen: true,
        host: { clientWidth: 390, clientHeight: 620 }, rendererSize: new THREE.Vector2(),
        scene: {}, homeCamera: {},
        renderer: {
            getSize: (size: THREE.Vector2) => size.set(390, 300),
            setSize: () => calls.push('clear'),
            render: () => calls.push('render'),
        },
        frameKeepsakeRoom: () => { calls.push('fit'); return true; },
        requestFrame: () => calls.push('schedule'),
    });
    runtime.resize();
    expect(calls).toEqual(['clear', 'fit', 'render', 'schedule']);
    calls.length = 0;
    runtime.renderer.getSize = (size: THREE.Vector2) => size.set(390, 620);
    runtime.resize();
    expect(calls).toEqual(['fit', 'schedule']);
    calls.length = 0;
    runtime.renderer.getSize = (size: THREE.Vector2) => size.set(390, 300);
    vi.stubGlobal('document', { hidden: true });
    runtime.resize();
    expect(calls).toEqual(['clear', 'fit', 'schedule']);
});
