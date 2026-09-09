import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { summarizeIslandLearningKeepsake } from '../../domain/island/learningKeepsakes';
import { IslandLearningKeepsakes, type IslandLearningKeepsakesProps } from './IslandLearningKeepsakes';

function props(completedSets = 0): IslandLearningKeepsakesProps {
    const island = { ...createIsland('child', 1), completedSets };
    return { island, section: 'keepsakes', disabled: false, onClose: vi.fn(), onLearn: vi.fn(), onShowRoom: vi.fn(), onSelect: vi.fn(), onPhoto: vi.fn(),
        controls: { act: vi.fn(async () => true), pending: undefined, error: undefined, retry: undefined,
            selectedId: 'first-completion', select: vi.fn(), summary: summarizeIslandLearningKeepsake(island, 'first-completion', [], []),
            reading: false, readError: undefined, retryRead: vi.fn() } };
}
const action = (html: string, value: string) => html.match(new RegExp(`<button[^>]*data-keepsake-action="${value}"[^>]*>`))?.[0];
const choice = (html: string, value: string) => html.match(new RegExp(`<button[^>]*data-keepsake-choice="${value}"[^>]*>`))?.[0];
describe('real learning keepsake record and display choices', () => {
    it('keeps album reading and returning available during a background discovery save', () => {
        const p = props(1); p.section = 'home'; p.disabled = true; p.comparisonDisabled = false;
        p.onAlbum = vi.fn(); p.onPhotos = vi.fn();
        const html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(action(html, 'album')).not.toContain('disabled');
        expect(action(html, 'close')).not.toContain('disabled');
        expect(action(html, 'photos')).toContain('disabled');
        expect(action(html, 'open-keepsakes')).toContain('disabled');
        expect(p.controls.act).not.toHaveBeenCalled();
    });

    it('keeps house destinations and directly available challenge controls and names the exit', () => {
        const p = props(); p.section = 'home'; p.onAlbum = vi.fn();
        p.challenge = <div data-challenge-content>チャレンジの条件と操作</div>;
        const html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(html.indexOf('data-keepsake-action="notices"')).toBeLessThan(html.indexOf('data-challenge-content'));
        expect(html).not.toContain('class="island-house-challenge"');
        expect(html).toContain('data-challenge-content');
        expect(p.controls.act).not.toHaveBeenCalled();
    });


    it('keeps all 16 future milestones readable with no award claim or invented old date', () => {
        const p = props(), before = structuredClone(p.island), html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(html.match(/data-keepsake-choice=/g)).toHaveLength(16);
        expect(choice(html, 'completed-1000')).toContain('data-keepsake-state="locked"');
        expect(choice(html, 'completed-1000')).not.toContain('disabled');
        expect(action(html, 'display')).toContain('disabled'); expect(action(html, 'display-earned')).toContain('disabled');
        expect(action(html, 'learn')).not.toContain('disabled'); expect(html).toContain('あと 1かい');
        expect(html).not.toContain('data-keepsake-earned-date'); expect(html).not.toContain('たしかめられた まなびの きろく');
        expect(p.island).toEqual(before); expect(p.controls.act).not.toHaveBeenCalled();
    });
    it('separates the selected record, stored entitlement, and multiple saved displays', () => {
        const p = props(10); p.island.learningKeepsakes = { version: 1, displayed: ['first-completion', 'completed-10'] };
        p.controls.selectedId = 'completed-5'; p.controls.summary = summarizeIslandLearningKeepsake(p.island, 'completed-5', [], []);
        const before = structuredClone(p.island), html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(choice(html, 'completed-5')).toContain('aria-pressed="true"'); expect(choice(html, 'completed-5')).toContain('data-keepsake-state="stored"');
        expect(choice(html, 'first-completion')).toContain('aria-pressed="false"'); expect(choice(html, 'first-completion')).toContain('data-keepsake-state="displayed"');
        expect(action(html, 'display')).not.toContain('disabled'); expect(action(html, 'store')).toBeUndefined();
        expect(action(html, 'display-earned')).not.toContain('disabled'); expect(html).toContain('2こ かざっているよ・3こ もっているよ');
        expect(p.island).toEqual(before); expect(p.controls.act).not.toHaveBeenCalled();
        p.controls.selectedId = 'completed-10'; const displayed = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(action(displayed, 'display')).toBeUndefined(); expect(action(displayed, 'store')).not.toContain('disabled');
    });
    it('shows only supplied verified history and omits a missing milestone date', () => {
        const p = props(25); p.controls.summary = { keepsakeId: 'first-completion', available: true, completedSets: 25,
            requiredCompletedSets: 1, recordScope: 'partial', verifiedCompletedSets: 1, problemCount: 3,
            subjects: [{ subject: 'math', problemCount: 3 }], examples: [{ subject: 'math', questionText: '1 + 2 = ?' }] };
        const partial = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(partial).toContain('1かいの くぎり・3もん'); expect(partial).toContain('さんすう：3もん'); expect(partial).toContain('1 + 2 = ?');
        expect(partial).toContain('のこっている きろくの ぶん'); expect(partial).not.toContain('data-keepsake-earned-date');
        p.controls.summary.completedAt = Date.UTC(2025, 0, 2); const dated = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(dated).toContain('2025年1月2日の きねん');
    });
    it('keeps learning, closing and room viewing available while an uncertain display blocks new intents', () => {
        const p = props(10); p.controls.pending = { type: 'display-earned' }; p.controls.error = 'たしかめよう。'; p.controls.retry = vi.fn(async () => true);
        const html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(action(html, 'display')).toContain('disabled'); expect(action(html, 'display-earned')).toContain('disabled');
        expect(choice(html, 'completed-5')).toContain('disabled'); expect(action(html, 'retry')).not.toContain('disabled');
        expect(action(html, 'learn')).not.toContain('disabled'); expect(action(html, 'room')).not.toContain('disabled');
        expect(html.match(/<button[^>]*aria-label="いえを とじる"[^>]*>/)?.[0]).not.toContain('disabled');
        expect(html).toContain('もっているものを ぜんぶ かざる きろく'); expect(html).toContain('けしきの きろくとは べつ');
    });
    it('puts the earned first award action ahead of the collection and keeps future awards and history optional', () => {
        const p = props(1), html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(html.indexOf('data-keepsake-action="display"')).toBeLessThan(html.indexOf('data-keepsake-choice="first-completion"'));
        expect(html.match(/<details[^>]*data-keepsake-history[^>]*>/)?.[0]).not.toContain('open');
        expect(html.match(/<details[^>]*data-keepsake-future[^>]*>/)?.[0]).not.toContain('open');
        expect(html.indexOf('data-keepsake-choice="first-completion"')).toBeLessThan(html.indexOf('data-keepsake-future'));
        expect(html.match(/data-keepsake-choice=/g)).toHaveLength(16);
        expect(html).toContain('いえを みわたす'); expect(html).not.toContain('きねんの へや');
    });
    it('shows optional treasured destinations and only notices backed by real pending gifts', () => {
        const p = props(1); p.section = 'home'; p.onAlbum = vi.fn(); p.onShared = vi.fn(); p.onRewards = vi.fn();
        const quiet = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(action(quiet, 'album')).toBeDefined(); expect(action(quiet, 'shared')).toBeDefined(); expect(action(quiet, 'rewards')).toBeUndefined();
        p.island.pendingRewards = [{ id: 'earned-gift', planId: 'completed-plan', earnedAt: 1, choices: ['flower', 'lantern', 'bench'] }];
        p.section = 'notices';
        const before = structuredClone(p.island), notice = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(action(notice, 'rewards')).not.toContain('disabled'); expect(notice).toContain('おくりものが 1こ あるよ。');
        expect(p.island).toEqual(before); expect(p.controls.act).not.toHaveBeenCalled();
    });

    it('defaults to a lived-in house overview, with no automatic award selection or display operation', () => {
        const p = props(1); delete p.section; p.onAlbum = vi.fn(); p.onShared = vi.fn();
        const before = structuredClone(p.island), html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} />);
        expect(html).toContain('data-keepsake-section="home"');
        for (const target of ['album', 'shared', 'notices', 'open-keepsakes', 'learn', 'close']) expect(action(html, target)).toBeDefined();
        expect(action(html, 'display')).toBeUndefined(); expect(action(html, 'display-earned')).toBeUndefined();
        expect(html).not.toContain('data-keepsake-choice='); expect(html).not.toContain('はじめの いっぽ');
        expect(p.controls.select).not.toHaveBeenCalled(); expect(p.controls.act).not.toHaveBeenCalled(); expect(p.island).toEqual(before);
    });
    it('reflects controlled house object selection without changing saved awards, and returns through home rather than leaving the island', () => {
        const p = props(10); p.onSectionChange = vi.fn(); p.controls.pending = { type: 'display-earned' };
        const before = structuredClone(p.island);
        for (const section of ['notices', 'keepsakes', 'home'] as const) {
            const html = renderToStaticMarkup(<IslandLearningKeepsakes {...p} section={section} />);
            expect(html).toContain(`data-keepsake-section="${section}"`);
            expect(action(html, 'close')).not.toContain('disabled'); expect(action(html, 'learn')).not.toContain('disabled');
            if (section === 'home') expect(action(html, 'home')).toBeUndefined(); else expect(action(html, 'home')).not.toContain('disabled');
            if (section === 'notices') { expect(html).toContain('いまは あたらしい おしらせは ないよ'); expect(action(html, 'rewards')).toBeUndefined(); }
        }
        expect(p.controls.act).not.toHaveBeenCalled(); expect(p.controls.select).not.toHaveBeenCalled(); expect(p.onSectionChange).not.toHaveBeenCalled();
        expect(p.island).toEqual(before);
    });

});
