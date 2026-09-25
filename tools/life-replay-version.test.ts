import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lifeReplayVersion } from './life-replay-version';

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function fixture() {
    const root = mkdtempSync(path.join(tmpdir(), 'life-rules-')); roots.push(root);
    const put = (name: string, contents: string) => {
        const target = path.join(root, name); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, contents);
    };
    put('package-lock.json', '{}');
    put('src/replay.ts', "import { rate } from './rules'; export const replay = () => rate;");
    put('src/rules.ts', 'export { rate } from "./growth";');
    put('src/growth.ts', 'export const rate = 1;');
    const version = (env = { MODE: 'production' }) => lifeReplayVersion(root, env, ['src/replay.ts']);
    return { root, put, version };
}
it('preserves rules identity across redeploys and unrelated UI/art/docs changes', () => {
    const { put, version } = fixture(); const first = version();
    put('src/App.tsx', 'export const App = () => null;');
    put('public/island.webp', 'new image'); put('docs/change.md', 'new docs');
    expect(version()).toBe(first); expect(version()).toBe(first);
});
it('invalidates transitive rules, dependency packages and environment changes', () => {
    const { put, version } = fixture(); const first = version();
    put('src/growth.ts', 'export const rate = 2;'); expect(version()).not.toBe(first);
    put('src/growth.ts', 'export const rate = 1;'); expect(version()).toBe(first);
    put('package-lock.json', '{"version":2}'); expect(version()).not.toBe(first);
    put('package-lock.json', '{}'); expect(version({ MODE: 'test' })).not.toBe(first);
    put('vite.config.ts', 'export default { define: { GROWTH_RATE: 2 } };');
    expect(version()).not.toBe(first);
});
it('includes literal dynamic imports and fails closed on unresolved or computed imports', () => {
    const { put, version } = fixture();
    put('src/replay.ts', 'export const replay = () => import("./growth");');
    const first = version(); put('src/growth.ts', 'export const rate = 3;'); expect(version()).not.toBe(first);
    put('src/replay.ts', 'export const replay = (name: string) => import(name);');
    expect(() => version()).toThrow('Nonliteral');
    put('src/replay.ts', 'export { rate } from "./missing";'); expect(() => version()).toThrow('Unresolved');
});
it('does not follow erased type dependencies into unrelated presentation code', () => {
    const { put, version } = fixture();
    put('src/replay.ts', 'import type { UI } from "./ui"; export const replay = (x: UI) => x;');
    put('src/ui.ts', 'export type UI = number;'); const first = version();
    put('src/ui.ts', 'export type UI = string;'); expect(version()).toBe(first);
});
