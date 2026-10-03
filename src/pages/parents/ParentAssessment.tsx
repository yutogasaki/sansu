import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, FileText, Tablet } from 'lucide-react';
import type { SubjectKey, UserProfile } from '../../domain/types';
import { updateProfileAtomically } from '../../domain/user/repository';
import { preparePaperTest, savePaperTestScore, cancelPaperTest, type PendingPaperTest } from '../../domain/test/paperTestRepository';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import { learningLevelTitle } from '../../domain/learning/progressView';
import { PaperTestScoreModal } from '../../components/domain/PaperTestScoreModal';
import { PrintableTestPreview } from '../../components/domain/PrintableTestPreview';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { InsetPanel, SegmentedControl } from '../../components/ui/SurfacePanel';

/** Mounted only inside the guardian gate. Saved paper snapshots remain authoritative. */
export function ParentAssessment({ profile, onUpdate }: { profile: UserProfile; onUpdate: (profile: UserProfile) => void }) {
    const navigate = useNavigate();
    const [subject, setSubject] = useState<SubjectKey>(profile.subjectMode === 'vocab' ? 'vocab' : 'math');
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const ownerRef = useRef(profile.id);
    ownerRef.current = profile.id;
    const [error, setError] = useState<string>();
    const [preview, setPreview] = useState<{ paper: PendingPaperTest; name: string }>();
    const triggerRef = useRef<HTMLElement | null>(null);
    const [scoring, setScoring] = useState<PendingPaperTest>();
    const [cancelling, setCancelling] = useState<PendingPaperTest>();
    const pending = [...(profile.pendingPaperTests ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const paper = pending.find(item => item.subject === subject);
    const mainLevel = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const savedSet = profile.periodicTestSets?.[subject];
    const online = savedSet?.subject === subject && savedSet.problems.length === 20
        && (savedSet.level === mainLevel || profile.periodicTestState?.[subject]?.isPending) ? savedSet : undefined;
    const level = online?.level ?? mainLevel;
    const minutes = profile.periodicTestTimeLimitSeconds ? Math.floor(profile.periodicTestTimeLimitSeconds / 60) : 0;

    async function job(action: (owner: string) => Promise<void>) {
        if (busyRef.current) return;
        const owner = profile.id;
        busyRef.current = true; setBusy(true); setError(undefined);
        const release = holdPwaUpdateForCriticalPersistence();
        try { await action(owner); }
        catch (cause) {
            if (ownerRef.current === owner) setError(cause instanceof Error ? cause.message : '保存できませんでした。もう一度お試しください。');
        } finally { release(); busyRef.current = false; setBusy(false); }
    }
    const update = (next: UserProfile, owner: string) => { if (ownerRef.current === owner) onUpdate(next); };
    const print = () => job(async owner => {
        const result = await preparePaperTest(owner, subject);
        if (ownerRef.current !== owner) return;
        update(result.profile, owner);
        if (!result.paper.testSet || result.paper.testSet.problems.length !== 20) {
            throw new Error('以前の紙テストには問題が保存されていません。点数を入力するか、採点待ちを取り消して新しく作成してください。');
        }
        setPreview({ paper: result.paper, name: result.profile.name });
    });
    const timer = (value: number) => job(async owner => {
        const next = await updateProfileAtomically(owner, current => ({ ...current, periodicTestTimeLimitSeconds: value ? value * 60 : undefined }));
        if (!next) throw new Error('プロフィールが見つかりません。画面を開き直してください。');
        update(next, owner);
    });
    const score = (count: number) => job(async owner => {
        if (!scoring) return;
        const next = await savePaperTestScore(owner, scoring, count);
        if (!next) throw new Error('プロフィールが見つかりません。画面を開き直してください。');
        update(next, owner);
        if (ownerRef.current === owner) setScoring(undefined);
    });
    const cancel = () => job(async owner => {
        if (!cancelling) return;
        const next = await cancelPaperTest(owner, cancelling.id);
        if (!next) throw new Error('プロフィールが見つかりません。画面を開き直してください。');
        update(next, owner);
        if (ownerRef.current === owner) setCancelling(undefined);
    });

    return <div className="parent-assessment" data-parent-assessment="true">
        <p className="parent-purpose">20問で今の理解を確認します。レベルは変わりません。</p>
        <SegmentedControl aria-label="確認する科目" options={[{ value: 'math', label: '算数' }, { value: 'vocab', label: '英語' }]}
            value={subject} onChange={value => { if (!busy) { setSubject(value as SubjectKey); setError(undefined); } }} />
        <div className="parent-assessment-range">
            <span className="parent-level">Lv<strong>{level}</strong></span>
            <div><span>{online ? '保存済みの確認範囲' : '現在の範囲'}</span><h3>{learningLevelTitle(subject, level)}</h3></div>
        </div>
        {paper && <p className="parent-purpose">紙の採点待ち：{paper.subject === 'math' ? '算数' : '英語'} Lv{paper.level}。再印刷は作成時の問題です。</p>}
        <div className="parent-assessment-methods">
            <Button disabled={busy} onClick={() => navigate(`/study?session=periodic-test&focus_subject=${subject}&back_to=%2Fparents`)}><Tablet size={18} aria-hidden="true" />アプリで確認</Button>
            <Button variant="secondary" disabled={busy} onClick={event => { triggerRef.current = event.currentTarget; void print(); }}><FileText size={18} aria-hidden="true" />{paper ? '同じ問題を印刷' : '印刷・PDF'}</Button>
        </div>
        <details className="parent-details parent-timer">
            <summary>時間制限：{minutes ? `${minutes}分` : 'なし'}<ChevronDown size={18} aria-hidden="true" /></summary>
            <div role="group" aria-label="制限時間" className="parent-timer-options">
                {[0, 5, 10, 15, 20].map(value => <button key={value} type="button" aria-pressed={minutes === value} disabled={busy} onClick={() => void timer(value)}>
                    {minutes === value && <Check size={15} aria-hidden="true" />}{value ? `${value}分` : 'なし'}
                </button>)}
            </div>
        </details>
        {pending.length > 0 && <div className="parent-paper-pending">
            <h3>紙の採点待ち</h3>
            {pending.map(item => <InsetPanel key={item.id} className="parent-paper-item">
                <p><strong>{item.subject === 'math' ? '算数' : '英語'} Lv.{item.level}</strong><span>{new Date(item.createdAt).toLocaleDateString('ja-JP')} 作成</span></p>
                <div><Button size="sm" variant="secondary" disabled={busy} onClick={() => setScoring(item)}>点数入力</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancelling(item)}>採点待ちを取り消す</Button></div>
            </InsetPanel>)}
        </div>}
        {busy && <p role="status">保存しています…</p>}
        {error && <p role="alert" className="parent-error">{error}</p>}
        {preview?.paper.testSet && <PrintableTestPreview testSet={preview.paper.testSet} paperId={preview.paper.id} profileName={preview.name}
            onClose={() => setPreview(undefined)} returnFocusTo={triggerRef.current} />}
        {scoring && <PaperTestScoreModal isOpen subject={scoring.subject} level={scoring.level} onSubmit={score} isSaving={busy} error={error}
            onDismiss={() => { if (!busy) { setScoring(undefined); setError(undefined); } }} />}
        <Modal isOpen={Boolean(cancelling)} onClose={() => { if (!busy) setCancelling(undefined); }} title="採点待ちを取り消す"
            footer={<Button disabled={busy} onClick={() => void cancel()}>採点待ちを取り消す</Button>}>
            <p>この紙テストの採点待ちを取り消します。学習記録と過去の確認結果は残ります。</p>
            {error && <p role="alert">{error}</p>}
        </Modal>
    </div>;
}
