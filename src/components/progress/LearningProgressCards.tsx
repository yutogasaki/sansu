import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Flag, Pause, Lock, Sparkles } from 'lucide-react';
import type { SubjectKey, UserProfile } from '../../domain/types';
import { readLearningProgress } from '../../domain/learning/progressRepository';
import { learningLevelTitle } from '../../domain/learning/progressView';
import { independentCorrectCount } from '../../domain/learning/independentProgress';
import { MATH_SKILL_LABELS } from '../../domain/math/labels';
import { getWord } from '../../domain/english/words';
import { Button } from '../ui/Button';
import { FinishPreparation } from './FinishPreparation';
import { SurfacePanel } from '../ui/SurfacePanel';
import { IslandToyIcon } from '../island/IslandToyIcon';
import pokomoko from '../../assets/pokomoko-learning-poses.webp';
import './LearningProgressCards.css';

function LevelTitle({ subject, level }: { subject: SubjectKey; level: number }) {
    return <>{learningLevelTitle(subject, level).split(' ').map((word, index) => <span key={`${index}-${word}`} className="inline-block">{index > 0 ? ' ' : ''}{word}</span>)}</>;
}

export function LearningProgressCards({ profile, refreshKey, onLearn, onTest, onFinish }: {
    profile: UserProfile; refreshKey: boolean; onLearn: () => void; onTest: (subject: SubjectKey) => void; onFinish: (subject: SubjectKey) => void;
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
    return <SurfacePanel className="learning-progress-card space-y-3 rounded-[28px] p-5" aria-label="つぎへの道" data-progress-candidate="finish-path-v2">
        <header className="flex items-center gap-2"><IslandToyIcon kind="island" size={32} /><h2 className="text-base font-bold">つぎへの 道</h2></header>
        {result?.owner === profile.id && result.error ? <div role="alert">きろくを 読みこめなかったよ。
            <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>もういちど 読みこむ</Button></div>
            : !data ? <p role="status">きろくを 読みこんでいるよ…</p> : subjects.map(subject => {
                const view = data[subject];
                const existing = profile.periodicTestSets?.[subject];
                const testLevel = existing?.subject === subject && existing.problems.length === 20
                    && (existing.level === view.main || profile.periodicTestState?.[subject]?.isPending) ? existing.level : view.main;
                const successes = data.memories[subject].filter(memory => independentCorrectCount(memory) > 0 && memory.lastIndependentCorrectAt)
                    .sort((a, b) => b.lastIndependentCorrectAt!.localeCompare(a.lastIndependentCorrectAt!)).slice(0, 3);
                const subjectLabel = subject === 'math' ? 'さんすう' : 'えいたんご';
                return <section key={`${profile.id}-${subject}`} className="space-y-3" data-progress-stage={view.stage}
                    aria-label={subject === 'math' ? 'さんすうの進みぐあい' : 'えいたんごの進みぐあい'}>
                    <p className="progress-subject">{subjectLabel}</p>
                    <div className="progress-path grid grid-cols-[1fr_32px_1fr] items-start gap-2 p-3">
                        <div className="min-w-0 text-center">
                            <p className="progress-location mb-2 flex min-h-8 items-center justify-center text-xs font-bold">いま ここ</p>
                            <div className="progress-patch progress-patch-current mx-auto flex size-16 flex-col items-center justify-center text-white">
                                <span className="progress-companion" style={{ backgroundImage: `url(${pokomoko})` }} aria-hidden="true" /><span className="text-[10px] font-bold">Lv</span><strong className="text-3xl leading-none">{view.main}</strong>
                            </div>
                            <h3 className="progress-level-title mt-2 text-sm font-bold leading-snug"><LevelTitle subject={subject} level={view.main} /></h3>
                        </div>
                        <ArrowRight className="progress-path-arrow mt-12 text-pokomoko-muted" size={24} aria-hidden="true" />
                        <div className="min-w-0 text-center">
                            <p className="mb-2 min-h-8 text-xs font-bold">{view.next === null ? 'ここまで 到着' : <>しあげクリアで<br /><span className="whitespace-nowrap">レベルアップ</span></>}</p>
                            <div className="progress-patch progress-patch-next mx-auto flex size-16 flex-col items-center justify-center text-pokomoko-muted">
                                {view.next === null ? <Flag size={28} aria-hidden="true" /> : <><span className="text-[10px] font-bold">Lv</span><strong className="text-3xl leading-none">{view.next}</strong></>}
                            </div>
                            <p className="progress-level-title mt-2 text-sm font-bold leading-snug">{view.next === null ? 'ふくしゅうへ' : <LevelTitle subject={subject} level={view.next} />}</p>
                        </div>
                    </div>
                    {view.next !== null && <p className="progress-route text-center text-xs font-bold">れんしゅう → しあげ20もん → Lv{view.next}</p>}
                    {view.stage === 'paused' && <p className="flex items-start gap-2 text-xs text-pokomoko-muted"><Pause size={16} className="shrink-0" aria-hidden="true" />{view.message}</p>}
                    {view.stage === 'ready' ? <div className="progress-finish-ready">
                        <p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={18} aria-hidden="true" />クリアで Lv{view.next}へ！</p>
                        <Button className="progress-challenge progress-challenge-ready min-h-12 h-auto w-full gap-3 py-3 text-left" onClick={() => onFinish(subject)}
                            aria-label={`${subjectLabel}の しあげに ちょうせん`}>
                            <IslandToyIcon kind="album" size={34} className="shrink-0" />
                            <span className="flex-1"><span className="block text-base">レベルアップへ</span><span className="block text-xs font-normal">しあげ20もん · ぜんもんで Lv{view.next}へ</span></span>
                            <ArrowRight size={20} aria-hidden="true" />
                        </Button>
                    </div> : view.stage !== 'complete' && <div className="progress-finish-locked flex items-center gap-3 rounded-2xl p-3">
                        <Lock size={20} className="shrink-0" aria-hidden="true" /><span><strong className="block text-sm">{view.stage === 'paused' ? 'つぎの レベルは おやすみ中' : 'じゅんびが そろったら しあげへ'}</strong>
                        <span className="block text-xs">クリアで Lv{view.next}へ すすめるよ</span></span>
                    </div>}
                    <FinishPreparation view={view} />
                    <details className="group border-b border-[var(--pokomoko-edge)] pb-1">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-xl text-xs font-bold text-pokomoko-muted focus-visible:outline-2 focus-visible:outline-[var(--pokomoko-blue)] [&::-webkit-details-marker]:hidden">
                            くわしく<ChevronDown size={16} className="group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="space-y-4 pb-4 text-xs">
                            <p className="font-bold">{view.message}</p>
                            {view.conditions.length > 0 && <p className="text-pokomoko-muted">数だけでなく、ひとりで 解けるかも たしかめるよ。</p>}
                            {successes.length > 0 && <div className="space-y-2">
                                <h4 className="font-bold">ひとりで できた きろく</h4>
                                {successes.map(memory => <div key={memory.id}>
                                    <p className="font-bold">{subject === 'math' ? MATH_SKILL_LABELS[memory.id] ?? 'さんすう' : getWord(memory.id)?.surface ?? memory.id}</p>
                                    <p className="text-pokomoko-muted">{new Date(memory.lastIndependentCorrectAt!).toLocaleDateString('ja-JP')} にできた · {memory.needsRelearning ? 'もういちど れんしゅう中' : Date.parse(memory.nextReview) <= Date.now() ? 'ふくしゅうの ころだよ' : `つぎの ふくしゅう ${new Date(memory.nextReview).toLocaleDateString('ja-JP')}`}</p>
                                </div>)}
                                <p className="text-pokomoko-muted">日をあけて また解くと、覚えているか たしかめられるよ。</p>
                            </div>}
                            {view.next !== null && <p className="text-pokomoko-muted">しあげは レベルアップの チャレンジ。20もん ぜんぶ ひとりで できると、Lv{view.next}へ すすめるよ。</p>}
                            <Button variant="secondary" className="h-auto min-h-11 w-full py-2" onClick={() => onTest(subject)}>かくにんテスト · Lv{testLevel} · 20もん</Button>
                            <p className="text-pokomoko-muted">かくにんテストは いつでも できるよ。てんすうを きろくして、できることを たしかめよう。レベルは かわらないよ。</p>
                        </div>
                    </details>
                </section>;
            })}
        <Button className="min-h-11 w-full" onClick={onLearn}>まなぶ</Button>
    </SurfacePanel>;
}
