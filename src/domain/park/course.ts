import type { ParkEdit, ParkRecord, PartKind } from './types';

export const PARTS: Record<PartKind, { name: string; effect: string }> = {
    slide: { name: 'すべりだい', effect: 'しゅーっと いきおいが つく' },
    trampoline: { name: 'トランポリン', effect: 'いきおいが あると ひとつ とびこす' },
    bubble: { name: 'シャボンゲート', effect: 'くぐると あわが つく' },
    mat: { name: 'ゆっくりマット', effect: 'いきおいを おさえて ゆっくり' },
    bell: { name: 'ベル', effect: 'じめんを とおると ちりん' },
    paint: { name: 'いろゲート', effect: 'からだと このあとの あわが ももいろに' },
};

export function createPark(profileId: string, now: number): ParkRecord {
    return {
        profileId, schemaVersion: 1, revision: 0, completedPlans: 0, updatedAt: now,
        parts: [{ id: 'starter-slide', kind: 'slide' }, { id: 'starter-trampoline', kind: 'trampoline' }],
        courses: [{ id: 'course-1', name: '', slots: ['starter-slide', 'starter-trampoline', null] }],
        activeCourseId: 'course-1',
    };
}

export function assertPark(park: ParkRecord) {
    if (park.schemaVersion !== 1 || !Number.isSafeInteger(park.revision)
        || park.courses.length < 1 || park.courses.length > 3
        || !park.courses.some(c => c.id === park.activeCourseId)) throw new Error('Park data needs review');
    const ids = new Set(park.parts.map(p => p.id));
    if (ids.size !== park.parts.length || park.parts.some(p => !PARTS[p.kind])
        || new Set(park.courses.map(c => c.id)).size !== park.courses.length) throw new Error('Invalid park inventory');
    const placed = new Set<string>();
    for (const c of park.courses) {
        if (c.slots.length < 3 || c.slots.length > 6) throw new Error('Invalid course size');
        for (const id of c.slots) {
            if (!id) continue;
            if (!ids.has(id) || placed.has(id)) throw new Error('A part must have one location');
            placed.add(id);
        }
    }
}

export function courseLayout(park: ParkRecord, courseId: string): (PartKind | null)[] {
    const course = park.courses.find(c => c.id === courseId);
    if (!course) throw new Error('Course not found');
    return course.slots.map(id => park.parts.find(p => p.id === id)?.kind ?? null);
}

export function editPark(park: ParkRecord, edit: ParkEdit): ParkRecord {
    assertPark(park);
    const next = structuredClone(park);
    if (edit.type === 'add-course') {
        if (next.courses.length >= 3) throw new Error('Three courses maximum');
        const id = `course-${next.courses.length + 1}`;
        next.courses.push({ id, name: '', slots: [null, null, null] });
        next.activeCourseId = id;
    } else {
        const course = next.courses.find(c => c.id === edit.courseId);
        if (!course) throw new Error('Course not found');
        if (edit.type === 'select-course') next.activeCourseId = course.id;
        if (edit.type === 'rename') course.name = edit.name.trim().slice(0, 24);
        if (edit.type === 'add-slot') {
            if (course.slots.length >= 6) throw new Error('Six positions maximum');
            course.slots.push(null);
        }
        if (edit.type === 'place' || edit.type === 'remove') {
            if (!Number.isInteger(edit.slot) || edit.slot < 0 || edit.slot >= course.slots.length) throw new Error('Invalid position');
            if (edit.type === 'remove') course.slots[edit.slot] = null;
            else {
                if (!next.parts.some(p => p.id === edit.partId)) throw new Error('Part not owned');
                const source = next.courses.find(c => c.slots.includes(edit.partId));
                if (source && source.id !== course.id && edit.fromCourseId !== source.id) {
                    throw new Error('Moving a part from another course needs explicit selection');
                }
                if (source) {
                    const position = source.slots.indexOf(edit.partId);
                    // Swap within a course. Across courses, return the displaced part to inventory.
                    source.slots[position] = source.id === course.id ? course.slots[edit.slot] : null;
                }
                course.slots[edit.slot] = edit.partId;
            }
        }
    }
    assertPark(next);
    return next;
}
