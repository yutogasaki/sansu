import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { completeOnboardingProfile, type OnboardingSelection } from '../user/onboarding';
import { enterFirstPlay, readFirstPlay } from '../user/firstPlay';
const databases: SansuDatabase[] = [];
const setup = () => { const d = new SansuDatabase(`kokugo-first-${crypto.randomUUID()}`); databases.push(d); return d; };
const selection: OnboardingSelection = { name: '', grade: 2, subject: 'math', mathRange: 'q_count', englishRange: null, kokugoCourse: true };
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(databases.splice(0).map(d => d.delete())); });
it('starts a real first-play owner in Kokugo atomically, without seeding arithmetic ability or a legacy plan', async () => {
    const d = setup(), first = await enterFirstPlay(d);
    const receipt = await completeOnboardingProfile(selection, first.ownerId, 'first', d);
    expect(await d.kokugoCourses.get(first.ownerId)).toMatchObject({ preferred: true, band: 3 });
    expect((await readFirstPlay(d))?.completed).toBe(true);
    expect(await d.memoryMath.count()).toBe(0); expect(await d.memoryVocab.count()).toBe(0);
    expect(await d.islandPlans.count()).toBe(0); expect(await d.logs.count()).toBe(0);
    expect(await completeOnboardingProfile(selection, first.ownerId, 'first', d)).toEqual(receipt);
    expect(await d.profiles.count()).toBe(1);
});
it('rolls back creation and the completion marker when the Kokugo preference cannot save', async () => {
    const d = setup(), first = await enterFirstPlay(d);
    vi.spyOn(d.kokugoCourses, 'add').mockRejectedValueOnce(new Error('disk-full'));
    await expect(completeOnboardingProfile(selection, first.ownerId, 'first', d)).rejects.toThrow('disk-full');
    expect(await d.profiles.count()).toBe(0); expect(await d.kokugoCourses.count()).toBe(0);
    expect((await readFirstPlay(d))?.completed).toBe(false);
    await completeOnboardingProfile(selection, first.ownerId, 'first', d);
    expect(await d.profiles.count()).toBe(1);
});
it('adds a Kokugo-only sibling while retaining the first child and its preference', async () => {
    const d = setup();
    await completeOnboardingProfile({ ...selection, name: '上の子' }, 'older', 'first', d);
    const before = await d.profiles.get('older');
    await completeOnboardingProfile({ ...selection, name: '下の子', grade: -2 }, 'younger', 'add', d);
    expect(await d.profiles.get('older')).toEqual(before);
    expect(await d.kokugoCourses.get('older')).toMatchObject({ preferred: true, band: 3 });
    expect(await d.kokugoCourses.get('younger')).toMatchObject({ preferred: true, band: 0 });
    expect(await d.memoryMath.count()).toBe(0);
});
