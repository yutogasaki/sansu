import { describe, expect, it } from 'vitest';
import { getSceneText, stageText } from './sceneText';

describe('ikimono scene text', () => {
    it('uses egg stage and returns basic scene structure when profile is absent', () => {
        const scene = getSceneText(null, '2026-02-19', 2, null, false);

        expect(scene.stage).toBe('egg');
        expect(scene.aura.length).toBe(3);
        expect(scene.nowLine.length).toBeGreaterThan(0);
        expect(scene.moodLine.length).toBeGreaterThan(0);
        expect(scene.whisper).toContain('すこし');
    });

    it('switches whisper/mood wording by kanji mode and event', () => {
        const kana = getSceneText(null, '2026-02-19', 0, 'periodic_test', false);
        const kanji = getSceneText(null, '2026-02-19', 0, 'periodic_test', true);

        expect(kana.moodLine).toContain('きょうは すこし きりっと。');
        expect(kanji.moodLine).toContain('今日は少し、きりっと。');
        expect(kana.whisper).toContain('なにか');
        expect(kanji.whisper).toContain('何か');
    });

    it('exposes stage labels for kana/kanji modes', () => {
        expect(stageText.egg.kana).toBe('たまご');
        expect(stageText.egg.kanji).toBe('卵');
        expect(stageText.adult.kana).toBe('おとな');
        expect(stageText.adult.kanji).toBe('大人');
    });
});
