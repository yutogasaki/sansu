import { describe, expect, it } from 'vitest';
import { buildLearningPilotReport, createMathPilotScenarios } from '../src/domain/learning/pilotReport';
import { evaluateMathLevel11Pilot } from '../src/domain/learning/evidence';
import { getMathLevel11Practice } from '../src/domain/learning/unitPractice';
import { buildLearningReportHtml } from './learning-unit-report.mjs';

describe('learning report historical and current evidence', () => {
    it('keeps past confirmations visible when every current deadline has expired', () => {
        const report = buildLearningPilotReport();
        const scenario = createMathPilotScenarios()[4];
        const evaluation = evaluateMathLevel11Pilot(scenario.records, 'synthetic-pilot', '2026-10-12T12:00:00.000Z');
        const html = buildLearningReportHtml({ ...report, scenarios: [{ ...scenario, evaluation,
            practice: getMathLevel11Practice(evaluation) }] });
        expect(html).toContain('過去の遅延確認実績: <strong>7 / 7</strong>');
        expect(html).toContain('現在: 期限到来 <strong>7</strong>単元');
        expect(html.match(/<td>実績あり<\/td>/g)).toHaveLength(7);
        expect(html).toContain('次回確認期限（UTC）');
        expect(html).toContain('過去の遅延確認実績は現在の想起確率を表しません');
        expect(html).not.toContain('通常の出題選択・SRS・解放・昇格は変更しません');
    });

    it('shows a failed facet as current recheck while keeping the past success count', () => {
        const report = buildLearningPilotReport();
        const html = buildLearningReportHtml({ ...report, scenarios: [report.scenarios[5]] });
        expect(html).toContain('過去の遅延確認実績: <strong>7 / 7</strong>');
        expect(html).toContain('要再確認 <strong>1</strong>単元');
        expect(html).toContain('Lv11必要型の確認: 未充足');
        expect(html).toContain('失敗・支援・未知文脈から要再確認');
        expect(html).toContain('証拠・条件・選択順の全データを見る');
    });
});
