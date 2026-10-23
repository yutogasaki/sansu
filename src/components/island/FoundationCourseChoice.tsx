import type { FoundationCourse, FoundationUnit } from '../../domain/englishFoundation/types';
import { FOUNDATION_UNITS } from '../../domain/englishFoundation/catalog';
import './FoundationLearning.css';
export function FoundationCourseChoice({ busy, onChoose, onLater, queued = false }: {
    busy: boolean; onChoose: (course: FoundationCourse, unit?: FoundationUnit) => void; onLater: () => void; queued?: boolean;
}) {
    return <section className="foundation-learning island-sheet" aria-labelledby="foundation-course-title" data-foundation-screen="course-choice">
        <p className="foundation-eyebrow">えいご</p><h2 id="foundation-course-title">どこから はじめよう？</h2>
        {queued && <p>いまの もんだいの つぎから かわるよ。</p>}
        <div className="foundation-course-options">{FOUNDATION_UNITS.map(unit => <button className="foundation-course-option" disabled={busy} key={unit.id} onClick={() => onChoose('foundation', unit.id)}>
            <span className="foundation-course-icon" aria-hidden="true">{unit.id === 'F01' ? 'ABC' : '♪'}</span><span>{unit.title}<small>{unit.id === 'F01' ? 'もじの かたちと なまえ' : 'きこえた おとから えを えらぼう'}</small></span>
        </button>)}<button className="foundation-course-option" disabled={busy} onClick={() => onChoose('vocabulary')}><span className="foundation-course-icon" aria-hidden="true">book</span><span>えいたんごを よむ<small>えいごを よんで、いみを えらぼう</small></span></button></div>
        <button className="island-text-button" disabled={busy} onClick={onLater}>あとで きめる</button>
    </section>;
}
