import { Check, Leaf, Repeat2 } from 'lucide-react';
import type { SubjectKey } from '../../domain/types';
import './IslandSubjectChoice.css';

export function IslandSubjectChoice({ subject, selected, disabled, onChange }: {
    subject: SubjectKey;
    selected: boolean;
    disabled: boolean;
    onChange: (selected: boolean) => void;
}) {
    const label = subject === 'math' ? 'さんすう' : 'えいたんご';
    return <button type="button" className="island-learning-subject island-subject-choice"
        aria-label={`つぎも ${label}`} aria-pressed={selected} disabled={disabled} onClick={() => onChange(!selected)}>
        <span><Leaf size={14} aria-hidden="true" />{label}</span>
        <small>{selected ? <Check size={13} aria-hidden="true" /> : <Repeat2 size={13} aria-hidden="true" />}つぎも やる</small>
    </button>;
}
