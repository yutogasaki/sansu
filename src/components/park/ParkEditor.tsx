import { useState } from 'react';
import { PARTS } from '../../domain/park/course';
import type { ParkEdit, ParkRecord } from '../../domain/park/types';
import { PartIcon } from './PartArt';

export function ParkEditor({ park, disabled, onEdit }: { park: ParkRecord; disabled: boolean; onEdit: (edit: ParkEdit) => void }) {
    const [selected, setSelected] = useState<string>();
    const [transfer, setTransfer] = useState<Extract<ParkEdit, { type: 'place' }>>();
    const course = park.courses.find(c => c.id === park.activeCourseId)!;
    const selectedPart = park.parts.find(p => p.id === selected);
    const chooseSlot = (slot: number) => {
        if (!selected) { setSelected(course.slots[slot] ?? undefined); return; }
        const from = park.courses.find(c => c.id !== course.id && c.slots.includes(selected));
        const edit: Extract<ParkEdit, { type: 'place' }> = { type: 'place', courseId: course.id, slot, partId: selected, fromCourseId: from?.id };
        if (from) setTransfer(edit);
        else { onEdit(edit); setSelected(undefined); }
    };
    return <section className="park-editor" aria-label="コースを つくる">
        <p className="park-instruction">{selectedPart ? `${PARTS[selectedPart.kind].name}を おく ばしょを タップ` : 'ぶひんを えらんで、ばしょを タップ'}</p>
        <div className="park-slots" style={{ gridTemplateColumns: `repeat(${course.slots.length}, 1fr)` }}>
            {course.slots.map((id, i) => {
                const part = park.parts.find(p => p.id === id);
                return <button key={i} className="park-slot" disabled={disabled} aria-pressed={Boolean(id && id === selected)}
                    aria-label={`ばしょ ${i + 1}${part ? ` ${PARTS[part.kind].name}` : ' あき'}`} onClick={() => chooseSlot(i)}>
                    <span className="park-position">{i + 1}</span>
                    {part ? <PartIcon kind={part.kind} /> : <span className="park-empty">＋</span>}
                </button>;
            })}
        </div>
        <div className="park-inventory" aria-label="もっている ぶひん">
            {park.parts.map(part => {
                const placed = park.courses.find(c => c.slots.includes(part.id));
                return <button key={part.id} className="park-part" aria-pressed={selected === part.id} disabled={disabled}
                    onClick={() => { setSelected(part.id); setTransfer(undefined); }}>
                    <PartIcon kind={part.kind} /><span>{PARTS[part.kind].name}</span>
                    <small>{placed ? placed.id === course.id ? 'このコース' : placed.name || `コース ${park.courses.indexOf(placed) + 1}` : 'おけるよ'}</small>
                </button>;
            })}
        </div>
        {transfer && <div className="park-support" role="group" aria-label="べつのコースから うつす">
            <p>{park.courses.find(c => c.id === transfer.fromCourseId)?.name || `コース ${park.courses.findIndex(c => c.id === transfer.fromCourseId) + 1}`}から はずして、ここに うつすよ。</p>
            <button className="park-button" disabled={disabled} onClick={() => { onEdit(transfer); setTransfer(undefined); setSelected(undefined); }}>ここへ うつす</button>
            <button className="park-text-button" disabled={disabled} onClick={() => setTransfer(undefined)}>やめる</button>
        </div>}
        <div className="park-editor-actions">
            {selected && <button className="park-text-button" disabled={disabled} onClick={() => setSelected(undefined)}>えらびなおす</button>}
            {selected && course.slots.includes(selected) && <button className="park-text-button" disabled={disabled}
                onClick={() => { onEdit({ type: 'remove', courseId: course.id, slot: course.slots.indexOf(selected) }); setSelected(undefined); }}>はずして しまう</button>}
            {course.slots.length < 6 && <button className="park-text-button" disabled={disabled} onClick={() => onEdit({ type: 'add-slot', courseId: course.id })}>＋ ばしょを ふやす</button>}
        </div>
    </section>;
}
