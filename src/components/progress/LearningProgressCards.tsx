import { useEffect, useState } from 'react';
import { Check, Circle, BookOpen } from 'lucide-react';
import type { SubjectKey, UserProfile } from '../../domain/types';
import { readLearningProgress } from '../../domain/learning/progressRepository';
import { learningLevelTitle } from '../../domain/learning/progressView';
import { independentCorrectCount } from '../../domain/learning/independentProgress';
import { MATH_SKILL_LABELS } from '../../domain/math/labels';
import { getWord } from '../../domain/english/words';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { InsetPanel, SurfacePanel, SurfacePanelHeader } from '../ui/SurfacePanel';

export function LearningProgressCards({ profile, refreshKey, onLearn, onTest }: {
    profile: UserProfile; refreshKey: boolean; onLearn: () => void; onTest: (subject: SubjectKey) => void;
}) {
    const [result, setResult] = useState<{ owner: string; data?: Awaited<ReturnType<typeof readLearningProgress>>; error?: boolean }>();
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        if (refreshKey) return;
        let cancelled = false;
        void readLearningProgress(profile).then(data => { if (!cancelled) setResult({ owner: profile.id, data }); })
            .catch(() => { if (!cancelled) setResult({ owner: profile.id, error: true }); });
        return () => { cancelled = true; };
    }, [profile, refreshKey, retry]);
    const data = result?.owner === profile.id ? result.data : undefined;
    const subjects: SubjectKey[] = profile.subjectMode === 'mix' ? ['math', 'vocab'] : [profile.subjectMode];
    return <SurfacePanel className="space-y-4 rounded-[28px] p-5" aria-label="つぎへの道">
        <SurfacePanelHeader title="つぎへの 道" description="いまの ばしょと、つぎに できること" />
        {result?.owner === profile.id && result.error ? <div role="alert">きろくを 読みこめなかったよ。
            <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>もういちど 読みこむ</Button></div>
            : !data ? <p role="status">きろくを 読みこんでいるよ…</p> : subjects.map(subject => {
                const view = data[subject];
                const existing = profile.periodicTestSets?.[subject];
                const testLevel = existing?.subject === subject && existing.problems.length === 20
                    && (existing.level === view.main || profile.periodicTestState?.[subject]?.isPending) ? existing.level : view.main;
                const successes = data.memories[subject].filter(memory => independentCorrectCount(memory) > 0 && memory.lastIndependentCorrectAt)
                    .sort((a, b) => b.lastIndependentCorrectAt!.localeCompare(a.lastIndependentCorrectAt!)).slice(0, 3);
                return <InsetPanel key={subject} className="space-y-3 p-4" aria-label={subject === 'math' ? 'さんすうの進みぐあい' : 'えいたんごの進みぐあい'}>
                    <div><p className="text-xs font-bold text-pokomoko-muted">{subject === 'math' ? 'さんすう' : 'えいたんご'} · Lv{view.main}</p>
                        <h3 className="text-lg font-bold">{learningLevelTitle(subject, view.main)}</h3>
                        {view.next !== null && <p className="text-sm text-pokomoko-muted">つぎ：{learningLevelTitle(subject, view.next)} · Lv{view.next}</p>}</div>
                    <p className="text-sm font-bold">{view.message}</p>
                    <ul className="space-y-3">{view.conditions.map(condition => <li key={condition.label}>
                        <div className="flex items-center gap-2 text-sm font-bold">{condition.met ? <Check size={16} aria-label="確認できた" /> : <Circle size={16} aria-label="確認中" />}{condition.label}</div>
                        {condition.target !== undefined && condition.target > 0 && <ProgressBar className="mt-2 h-2.5" aria-label={condition.label} value={condition.count ?? 0} max={condition.target} />}
                        <p className="mt-1 text-xs text-pokomoko-muted">{condition.detail}</p>
                    </li>)}</ul>
                    {view.conditions.length > 0 && <p className="text-xs text-pokomoko-muted">数だけでなく、ひとりで 解けるかも たしかめるよ。</p>}
                    {successes.length > 0 && <div className="space-y-2 border-t pt-3">
                        <h4 className="text-sm font-bold">ひとりで できた きろく</h4>
                        {successes.map(memory => <div key={memory.id} className="text-xs">
                            <p className="font-bold">{subject === 'math' ? MATH_SKILL_LABELS[memory.id] ?? 'さんすう' : getWord(memory.id)?.surface ?? memory.id}</p>
                            <p className="text-pokomoko-muted">{new Date(memory.lastIndependentCorrectAt!).toLocaleDateString('ja-JP')} にできた · {memory.needsRelearning ? 'もういちど れんしゅう中' : Date.parse(memory.nextReview) <= Date.now() ? 'ふくしゅうの ころだよ' : `つぎの ふくしゅう ${new Date(memory.nextReview).toLocaleDateString('ja-JP')}`}</p>
                        </div>)}
                        <p className="text-xs text-pokomoko-muted">日をあけて また解くと、覚えているか たしかめられるよ。</p>
                    </div>}
                    <div className="space-y-2 border-t pt-3">
                        <p className="text-sm font-bold flex items-center gap-2"><BookOpen size={16} aria-hidden="true" />しあげチャレンジ · 20もん</p>
                        <p className="text-xs text-pokomoko-muted">{learningLevelTitle(subject, testLevel)} · Lv{testLevel}の かくにん。いつでも えらべるよ。</p>
                        <p className="text-xs text-pokomoko-muted">レベルを すすめるための テストではないよ。</p>
                        <Button variant="secondary" className="min-h-11 w-full" onClick={() => onTest(subject)}>{subject === 'math' ? 'さんすう' : 'えいたんご'}の しあげに ちょうせん</Button>
                    </div>
                </InsetPanel>;
            })}
        <Button className="min-h-11 w-full" onClick={onLearn}>まなぶ</Button>
    </SurfacePanel>;
}
