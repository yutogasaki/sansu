import { ArrowRight, Check } from 'lucide-react';
import type { SubjectKey } from '../../domain/types';
import { learningLevelTitle } from '../../domain/learning/progressView';
import { IslandToyIcon } from '../island/IslandToyIcon';
import { Button } from '../ui/Button';
import pokomoko from '../../assets/pokomoko-learning-poses.webp';
import './FinishChallenge.css';
import { finishStudyPath } from './finishNavigation';
import { useFinishContinuation, type FinishContinuation } from '../../hooks/useFinishContinuation';
import { islandEnabled } from '../../domain/island/feature';

export type FinishPayoff = { passed: boolean; subject: SubjectKey; level: number; newLevel?: number; correctCount: number; totalQuestions: number };

function FinishPath({ subject, level, nextLevel, cleared = false }: { subject: SubjectKey; level: number; nextLevel?: number | null; cleared?: boolean }) {
    return <div className={`finish-path${cleared ? ' finish-path--cleared' : ''}`}>
        <div className="finish-milestone">
            <span className="finish-milestone-label">{cleared ? 'クリア！' : 'いま ここ'}</span>
            <div className="finish-stamp finish-stamp--current">
                <span className="finish-companion" style={{ backgroundImage: `url(${pokomoko})` }} aria-hidden="true" />
                <span>Lv</span><strong>{level}</strong>
                {cleared && <Check className="finish-clear-mark" size={22} aria-hidden="true" />}
            </div>
            <span className="finish-level-title">{learningLevelTitle(subject, level)}</span>
        </div>
        <ArrowRight className="finish-path-arrow" size={26} aria-hidden="true" />
        <div className="finish-milestone">
            <span className="finish-milestone-label">{cleared ? 'ひらいたよ' : 'つぎ'}</span>
            <div className="finish-stamp finish-stamp--next"><span>Lv</span><strong>{nextLevel ?? level + 1}</strong></div>
            <span className="finish-level-title">{learningLevelTitle(subject, nextLevel ?? level + 1)}</span>
        </div>
    </div>;
}

export function FinishChallengeEntry({ subject, level, nextLevel, onStart }: { subject: SubjectKey; level: number; nextLevel?: number | null; onStart: () => void }) {
    return <section className="finish-card" aria-label={`${subject === 'math' ? 'さんすう' : 'えいご'}の しあげ`}>
        <div className="finish-card-heading"><IslandToyIcon kind="album" size={38} /><span>{subject === 'math' ? 'さんすう' : 'えいご'}の しあげ</span></div>
        <h2>つぎの はんいへ すすもう</h2>
        <p className="finish-description">ひとりで 解けることが ふえたね。<br />しあげを クリアすると、つぎが ひらくよ。</p>
        <FinishPath subject={subject} level={level} nextLevel={nextLevel} />
        <p className="finish-rule">20もん · ひとりで ぜんもんできたら クリア</p>
        <Button size="xl" className="finish-primary" onClick={onStart}>しあげに ちょうせん<ArrowRight size={18} aria-hidden="true" /></Button>
    </section>;
}

export function FinishChallengeResult({ result, onNavigate, ownerId }: { result: FinishPayoff; onNavigate: (path: string) => void; ownerId?: string }) {
    const continuation = useFinishContinuation(ownerId);
    return <FinishChallengeResultView result={result} onNavigate={onNavigate} continuation={continuation} />;
}

export function FinishChallengeResultView({ result, onNavigate, continuation }: { result: FinishPayoff; onNavigate: (path: string) => void; continuation: FinishContinuation }) {
    const opened = result.passed && result.newLevel !== undefined;
    return <main className="finish-page finish-result" data-finish-state={opened ? 'cleared' : result.passed ? 'passed' : 'practice'}>
        <section className="finish-card" aria-labelledby="finish-result-title">
            <div className="finish-result-icon"><IslandToyIcon kind={result.passed ? 'keepsake' : 'album'} size={58} /></div>
            <p className="finish-eyebrow">しあげの きろく</p>
            <h1 id="finish-result-title">{result.passed ? `${learningLevelTitle(result.subject, result.level)} クリア！` : 'できたところを ふやそう'}</h1>
            <p className="finish-description">{opened ? 'あたらしい はんいが ひらいたよ。' : result.passed ? 'ひとりで 解けた きろくが のこったよ。' : 'できた きろくは のこっているよ。\nれんしゅうしてから、あたらしい もんだいで ちょうせんしよう。'}</p>
            {opened && <FinishPath subject={result.subject} level={result.level} nextLevel={result.newLevel} cleared />}
            <div className="finish-score"><strong>{result.correctCount}<span> / {result.totalQuestions}もん</span></strong><span>ひとりで できた</span></div>
            {opened && continuation === 'pending' && <p className="finish-description">とちゅうの れんしゅうを つづけるよ。<br />あたらしい はんいは つぎの くぎりから。</p>}
            <Button size="xl" className="finish-primary" onClick={() => onNavigate(islandEnabled() ? '/island?start=learn' : '/study')}>{opened ? continuation === 'fresh' ? 'つぎを はじめる' : 'つづけて まなぶ' : 'れんしゅうする'}<ArrowRight size={18} aria-hidden="true" /></Button>
            {!result.passed && <Button size="xl" variant="secondary" onClick={() => onNavigate(`${finishStudyPath(result.subject)}&retry=${Date.now()}`)}>もういちど しあげに ちょうせん</Button>}
            <Button size="lg" variant="ghost" onClick={() => onNavigate('/stats')}>きろくを みる</Button>
        </section>
    </main>;
}
