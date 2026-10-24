import { beforeEach, expect, it, vi } from 'vitest';
import type { UserProfile } from '../../domain/types';
import type { IslandPlan } from '../../domain/island/types';

// Run the real effect lifecycle so late reads cannot resurrect a dismissed invitation.
const hooks = vi.hoisted(() => {
    let state: unknown, deps: unknown[] | undefined, cleanup: (() => void) | undefined;
    let effect: (() => void | (() => void)) | undefined;
    return {
        reset() { cleanup?.(); state = deps = cleanup = effect = undefined; },
        useState() { return [state, (next: unknown) => { state = next; }]; },
        useEffect(next: typeof effect, nextDeps: unknown[]) {
            if (deps && deps.every((d, i) => Object.is(d, nextDeps[i]))) return;
            cleanup?.(); deps = nextDeps; effect = next;
        },
        commit() { if (effect) { cleanup = effect() || undefined; effect = undefined; } },
    };
});
const mocks = vi.hoisted(() => ({ read: vi.fn(), app: vi.fn(), open: vi.fn() }));
vi.mock('react', async original => ({ ...await original<object>(), useState: hooks.useState, useEffect: hooks.useEffect }));
vi.mock('../../domain/learning/progressRepository', () => ({ readLearningProgress: mocks.read }));
vi.mock('../../domain/user/repository', () => ({ getAppData: mocks.app }));
vi.mock('../island/useIslandNavigation', () => ({ useIslandNavigation: () => ({ open: mocks.open }) }));
import { LearningProgressCue } from './LearningProgressCue';

const profile = { id: 'child', mathMainLevel: 16, vocabMainLevel: 1 } as UserProfile;
const plan = { id: 'reservation', profileId: profile.id, subject: 'math', cursor: 0 } as IslandPlan;
const onOpen = vi.fn();
function render(overrides: Partial<Parameters<typeof LearningProgressCue>[0]> = {}) {
    const tree = LearningProgressCue({ profile, plan, active: true, onOpen, ...overrides }); hooks.commit(); return tree;
}
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => {
    hooks.reset(); vi.clearAllMocks(); mocks.app.mockResolvedValue({ activeProfileId: profile.id });
    mocks.read.mockResolvedValue({ finish: { math: { status: 'ready' }, vocab: { status: 'practice' } } });
});
it('uses the current subject and confirmation route; saving disables the button', async () => {
    expect(render()).toBeNull(); await settle();
    const button = render({ busy: true })!.props.children;
    expect(button.props.disabled).toBe(true);
    expect(button.props['aria-label']).toContain('Lv17');
    const enabled = render()!.props.children;
    enabled.props.onClick();
    expect(onOpen).toHaveBeenCalledOnce(); expect(mocks.open).toHaveBeenCalledWith('/learn?challenge=math');
});
it('does not invite partway through a section or for a different owner', () => {
    expect(render({ plan: { ...plan, cursor: 1 } })).toBeNull();
    expect(render({ plan: { ...plan, profileId: 'other' } })).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
});
it('discards an in-flight read when input or navigation deactivates the cue', async () => {
    let finish!: (value: unknown) => void;
    mocks.read.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(); expect(render({ active: false })).toBeNull();
    finish({ finish: { math: { status: 'ready' } } }); await settle();
    expect(render({ active: false })).toBeNull();
    expect(render()).toBeNull(); // Requires a new successful read.
});
it('does not reuse readiness across a new profile, reservation, subject, or failed read', async () => {
    render(); await settle(); expect(render()).not.toBeNull();
    expect(render({ profile: { ...profile } })).toBeNull();
    expect(render({ plan: { ...plan, id: 'next' } })).toBeNull();
    expect(render({ plan: { ...plan, subject: 'vocab' } })).toBeNull();
    mocks.read.mockRejectedValueOnce(new Error('read failed'));
    const failedPlan = { ...plan, id: 'failed-read' };
    expect(render({ plan: failedPlan })).toBeNull(); await settle(); expect(render({ plan: failedPlan })).toBeNull();
});
it('suppresses not-ready and changed active-profile results', async () => {
    mocks.app.mockResolvedValue({ activeProfileId: 'other' });
    render(); await settle(); expect(render()).toBeNull();
    mocks.app.mockResolvedValue({ activeProfileId: profile.id });
    mocks.read.mockResolvedValue({ finish: { math: { status: 'paused' } } });
    render({ plan: { ...plan, id: 'next' } }); await settle();
    expect(render({ plan: { ...plan, id: 'next' } })).toBeNull();
});
