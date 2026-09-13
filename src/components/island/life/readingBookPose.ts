import type { Object3D } from 'three';

export const READING_GESTURE_MS = 8000;
/** Rotate only the held object, keeping the existing resident and hand pose. */
export function poseReadingBook(book: Object3D, elapsed: number, reduced: boolean, base = 0) {
    const turn = Math.max(0, Math.min(1, (elapsed - 2500) / 1000));
    book.rotation.y = base + Math.PI * (reduced ? elapsed < 3000 ? 1 : 0 : 1 - turn * turn * (3 - 2 * turn));
    book.updateWorldMatrix(true, true);
    return elapsed < 2500 ? 'upside-down' : elapsed < 3500 ? 'turning' : 'upright';
}
