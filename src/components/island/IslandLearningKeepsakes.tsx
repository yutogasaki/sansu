import { useState } from 'react';
import { ArrowLeft, ArrowRight, Award, BookOpen, Camera, Check, Gift, House, PackageOpen, Sparkles, Star, Trophy, X } from 'lucide-react';
import { getIslandLearningKeepsakes, isIslandLearningKeepsakeAvailable, ISLAND_LEARNING_KEEPSAKES,
    type IslandLearningKeepsakeAction, type IslandLearningKeepsakeId } from '../../domain/island/learningKeepsakes';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandLearningKeepsakes } from './useIslandLearningKeepsakes';
import './IslandLearningKeepsakes.css';
import './IslandPanel.css';

export type IslandHouseSection = 'home' | 'keepsakes' | 'notices';
export interface IslandLearningKeepsakesProps {
    section?: IslandHouseSection;
    onSectionChange?: (section: IslandHouseSection) => void;
    island: IslandRecord;
    controls: ReturnType<typeof useIslandLearningKeepsakes>;
    disabled: boolean;
    comparisonDisabled?: boolean;
    onClose: () => void;
    onLearn: () => void;
    onPhoto?: () => void;
    onSelect?: (id: IslandLearningKeepsakeId) => void;
    onShowRoom?: () => void;
    onPhotos?: () => void;
    onAlbum?: () => void;
    onShared?: () => void;
    onRewards?: () => void;
}
const subjectName = (subject: string) => subject === 'math' ? 'さんすう' : subject === 'vocab' ? 'えいご' : 'まなんだ こと';
const awardName = (id: IslandLearningKeepsakeId) => ISLAND_LEARNING_KEEPSAKES.find(item => item.id === id)!.name;
function displayAction(keepsakeId: IslandLearningKeepsakeId, displayed: boolean): IslandLearningKeepsakeAction {
    return { type: 'display', keepsakeId, displayed };
}

/** The page supplies the actual house. Reading an award never places one;
 * only the explicit display controls save the person's display selection. */
export function IslandLearningKeepsakes({ island, controls, disabled, onClose, onLearn, onPhoto, onSelect, onShowRoom, comparisonDisabled = disabled,
    onPhotos, onAlbum, onShared, onRewards, section, onSectionChange }: IslandLearningKeepsakesProps) {
    const [localSection, setLocalSection] = useState<IslandHouseSection>('home');
    const currentSection = section ?? localSection;
    const changeSection = (next: IslandHouseSection) => {
        if (section === undefined) setLocalSection(next);
        onSectionChange?.(next);
    };
    const state = getIslandLearningKeepsakes(island);
    const selected = ISLAND_LEARNING_KEEPSAKES.find(item => item.id === controls.selectedId)!;
    const earned = ISLAND_LEARNING_KEEPSAKES.filter(item => isIslandLearningKeepsakeAvailable(island, item.id));
    const future = ISLAND_LEARNING_KEEPSAKES.filter(item => !isIslandLearningKeepsakeAvailable(island, item.id));
    const available = isIslandLearningKeepsakeAvailable(island, selected.id), displayed = state.displayed.includes(selected.id);
    const busy = disabled || Boolean(controls.pending), summary = controls.summary;
    const remaining = Math.max(0, selected.requiredCompletedSets - island.completedSets);
    const SelectedIcon = selected.slot === 'certificate' ? Award : Trophy;
    const choices = (items: readonly typeof ISLAND_LEARNING_KEEPSAKES[number][]) => items.map(item => {
        const available = isIslandLearningKeepsakeAvailable(island, item.id), onShelf = state.displayed.includes(item.id);
        const status = !available ? 'これから' : onShelf ? 'かざっている' : 'しまっている';
        const Icon = item.slot === 'certificate' ? Award : Trophy;
        return <button key={item.id} className="island-secondary island-keepsake-choice" disabled={busy}
            aria-pressed={selected.id === item.id} data-keepsake-choice={item.id} data-keepsake-state={!available ? 'locked' : onShelf ? 'displayed' : 'stored'}
            onClick={() => { controls.select(item.id); if (onShelf) onSelect?.(item.id); else onShowRoom?.(); }}>
            <Icon size={24} aria-hidden="true" /><strong>{item.name}</strong>
            <small>{onShelf && <Check size={14} aria-hidden="true" />}{status}</small>
        </button>;
    });
    return <section className="island-sheet island-panel island-learning-keepsakes" aria-label="いえ"
        data-testid="island-learning-keepsakes" data-keepsake-section={currentSection} data-keepsake-selected={selected.id}>
        <div className="island-sheet-title"><h2><House size={22} aria-hidden="true" />いえ</h2>
            <button className="island-icon-button island-panel-back" data-keepsake-action="close" disabled={comparisonDisabled} aria-label="いえを とじる" onClick={onClose}>
                <X size={20} aria-hidden="true" /><span>もどる</span></button></div>
        {currentSection !== 'home' && <button className="island-secondary island-house-back" data-keepsake-action="home"
            disabled={disabled} onClick={() => changeSection('home')}><ArrowLeft size={17} aria-hidden="true" />いえの なかへ</button>}
        {currentSection === 'home' && <div className="island-house-overview">
            <p>だいじなものを みたり、きねんを かざったり。</p>
            <nav className="island-house-destinations" aria-label="いえの なかで みるもの">
                {onAlbum && <button className="island-secondary" data-keepsake-action="album" disabled={comparisonDisabled} onClick={onAlbum}>
                    <BookOpen size={26} aria-hidden="true" /><strong>アルバム</strong><small>おもいでを ひらく</small></button>}
                {onPhotos && <button className="island-secondary" data-keepsake-action="photos" disabled={disabled} onClick={onPhotos}>
                    <Camera size={26} aria-hidden="true" /><strong>しゃしん</strong><small>とった しゃしんを みる</small></button>}
                {onShared && <button className="island-secondary" data-keepsake-action="shared" disabled={disabled} onClick={onShared}>
                    <Sparkles size={26} aria-hidden="true" /><strong>かざりと きおく</strong><small>だいじなものを みる</small></button>}
                <button className="island-secondary" data-keepsake-action="open-keepsakes" disabled={disabled} onClick={() => changeSection('keepsakes')}>
                    <Trophy size={26} aria-hidden="true" /><strong>まなびの きねん</strong><small>{state.displayed.length}こ かざっているよ</small></button>
                <button className="island-secondary" data-keepsake-action="notices" disabled={disabled} onClick={() => changeSection('notices')}>
                    <Gift size={26} aria-hidden="true" /><strong>おしらせ</strong><small>{island.pendingRewards.length > 0 ? `おくりもの ${island.pendingRewards.length}こ` : 'けいじばんを みる'}</small></button>
            </nav>
        </div>}
        {currentSection === 'notices' && <article className="island-house-notices" aria-label="いえの おしらせ">
            <h3>おしらせ</h3>
            {island.pendingRewards.length > 0 ? <><p>おくりものが {island.pendingRewards.length}こ あるよ。</p>
                {onRewards && <button className="island-primary" data-keepsake-action="rewards" disabled={disabled} onClick={onRewards}>
                    <Gift size={18} aria-hidden="true" />おくりものを みる<ArrowRight size={17} aria-hidden="true" /></button>}</>
                : <p>いまは あたらしい おしらせは ないよ</p>}
        </article>}
        {currentSection === 'keepsakes' && <>
        <article className="island-keepsake-detail" aria-label="えらんだ きねんの きろく">
            <div className="island-keepsake-selected"><SelectedIcon size={36} aria-hidden="true" /><div>
                <p className="island-keepsake-eyebrow">まなびの きねん</p><h3>{selected.name}</h3>
                <p>{available ? displayed ? 'いま かざっているよ' : 'もっているよ・かざってみよう' : 'これからの きねん'}</p>
            </div></div>
            <p className="island-keepsake-milestone">{available ? `${selected.requiredCompletedSets}かいの まなびの くぎりを おえた きねんだよ。`
                : `あと ${remaining}かい、まなびの くぎりを おえると かざれるよ。`}</p>
            <div className="island-panel-actions island-keepsake-actions">
                <button className="island-primary" data-keepsake-action={displayed ? 'store' : 'display'} disabled={busy || !available}
                    onClick={() => { void controls.act(displayAction(selected.id, !displayed)); }}>
                    {displayed ? <PackageOpen size={18} aria-hidden="true" /> : <Star size={18} aria-hidden="true" />}
                    {displayed ? 'しまう' : 'いえに かざる'}</button>
                {onShowRoom && <button className="island-secondary" data-keepsake-action="room" disabled={disabled} onClick={onShowRoom}>
                    <House size={18} aria-hidden="true" />いえを みわたす</button>}
            </div>
            {controls.error && <div className="island-error" role="alert"><p>{controls.error}</p>
                {controls.retry && <button className="island-secondary" data-keepsake-action="retry" disabled={disabled} onClick={() => { void controls.retry!(); }}>たなの きろくを たしかめる</button>}</div>}
            {controls.pending && <p role="status">{controls.pending.type === 'display-earned' ? 'もっているものを ぜんぶ かざる'
                : `${awardName(controls.pending.keepsakeId)}を ${controls.pending.displayed ? 'かざる' : 'しまう'}`} きろくを たしかめているよ。</p>}
        </article>
        <div className="island-keepsake-collection-heading"><h3>もっている きねん</h3><p>{state.displayed.length}こ かざっているよ・{earned.length}こ もっているよ</p></div>
        {earned.length > 0 ? <div className="island-keepsake-choices island-panel-choices" role="group" aria-label="もっている きねんを えらぶ">{choices(earned)}</div>
            : <p className="island-keepsake-note">まなびの くぎりを おえると、きねんが ふえていくよ。</p>}
        <button className="island-secondary island-keepsake-display-all" data-keepsake-action="display-earned"
            disabled={busy || earned.length === state.displayed.length} onClick={() => { void controls.act({ type: 'display-earned' }); }}>
            <Trophy size={18} aria-hidden="true" />もっているものを ぜんぶ かざる</button>
        <details className="island-keepsake-history" data-keepsake-history><summary>まなびの きろくを みる</summary>
            <p className="island-keepsake-count">まなびの くぎりを <strong>{island.completedSets}かい</strong> おえたよ。</p>
            {available && summary?.completedAt !== undefined && <p data-keepsake-earned-date>
                {new Date(summary.completedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}の きねん</p>}
            {available && summary && summary.recordScope !== 'count-only' && <div>
                <h4>たしかめられた まなびの きろく</h4>
                <p>{summary.verifiedCompletedSets}かいの くぎり{summary.problemCount !== undefined ? `・${summary.problemCount}もん` : ''}</p>
                {summary.subjects.length > 0 && <ul>{summary.subjects.map(entry => <li key={entry.subject}>{subjectName(entry.subject)}：{entry.problemCount}もん</li>)}</ul>}
                {summary.examples.length > 0 && <ul>{summary.examples.map((entry, index) => <li key={`${entry.subject}:${index}`}>{entry.questionText}</li>)}</ul>}
                {summary.recordScope === 'partial' && <p>のこっている きろくの ぶんを みているよ。</p>}
            </div>}
            {controls.reading && <p role="status">まなんだ きろくを ひらいているよ…</p>}
            {controls.readError && <div className="island-error" role="alert"><p>{controls.readError}</p>
                <button className="island-secondary" onClick={controls.retryRead} disabled={disabled}>きろくを ひらきなおす</button></div>}
        </details>
        {future.length > 0 && <details className="island-keepsake-future" data-keepsake-future><summary>これからの きねん（{future.length}こ）</summary>
            <div className="island-keepsake-choices island-panel-choices" role="group" aria-label="これからの きねんを えらぶ">{choices(future)}</div>
        </details>}
        <p className="island-keepsake-note">むりょうで かざったり しまったり できるよ。たなに かざるものは、けしきの きろくとは べつに のこるよ。</p>
        </>}
        <footer className="island-panel-footer">
            {onPhoto && <button className="island-secondary" disabled={disabled} onClick={onPhoto}><Camera size={18} aria-hidden="true" />しゃしんに のこす</button>}
            <button className="island-secondary" data-keepsake-action="learn" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} aria-hidden="true" /></button>
        </footer>
    </section>;
}
