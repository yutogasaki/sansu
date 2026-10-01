import { useEffect, useMemo, useRef, useState } from 'react';
import { ENGLISH_WORDS } from '../../../domain/english/words';
import { learnedWords } from '../../../domain/growingIsland/room';
import { getProfile } from '../../../domain/user/repository';

const SIZE = 240, GOAL = .6;

/** Letters from words the child learned, plus numbers: what they trace is what they know. */
function glyphChoices(letters: string[], day: number) {
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const picked = [...new Set(letters)].slice(0, 3);
    while (picked.length < 3) picked.push(String.fromCharCode(65 + (day + picked.length * 7) % 26));
    return [...picked, digits[day % digits.length]];
}

function glyphMask(glyph: string) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
    const g = canvas.getContext('2d')!;
    g.font = `900 ${SIZE * .78}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(glyph, SIZE / 2, SIZE / 2 + SIZE * .04);
    return g.getImageData(0, 0, SIZE, SIZE).data;
}

/**
 * なぞって かざる (spec 52 §13.4): trace a letter or number from what you learned; when most of
 * it is covered, your own drawing becomes the picture on the island flag. Nothing is graded.
 */
export function TracePanel({ profileId, onSave, onClose }: { profileId: string; onSave: (image: string, glyph: string) => void; onClose: () => void }) {
    const [letters, setLetters] = useState<string[]>([]);
    const day = useMemo(() => Math.floor(Date.now() / 86_400_000), []);
    const choices = useMemo(() => glyphChoices(letters, day), [letters, day]);
    const [glyph, setGlyph] = useState<string>();
    const [coverage, setCoverage] = useState(0);
    const canvas = useRef<HTMLCanvasElement>(null), ink = useRef<HTMLCanvasElement | null>(null), mask = useRef<Uint8ClampedArray | null>(null);
    const last = useRef<{ x: number; y: number } | undefined>(undefined);

    useEffect(() => {
        let live = true;
        void getProfile(profileId).then(profile => {
            if (!live || !profile) return;
            const words = learnedWords(profile.vocabWords ?? {}, ENGLISH_WORDS);
            setLetters(words.slice(-12).map(w => w.id.replace(/_lv\d+$/, '')[0]?.toUpperCase()).filter((c): c is string => Boolean(c && /[A-Z]/.test(c))));
        }).catch(() => undefined);
        return () => { live = false; };
    }, [profileId]);

    const current = glyph ?? choices[0];
    const draw = () => {
        const view = canvas.current?.getContext('2d'); if (!view || !ink.current) return;
        view.clearRect(0, 0, SIZE, SIZE);
        view.font = `900 ${SIZE * .78}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif`;
        view.textAlign = 'center'; view.textBaseline = 'middle'; view.fillStyle = '#ece6da'; view.fillText(current, SIZE / 2, SIZE / 2 + SIZE * .04);
        view.drawImage(ink.current, 0, 0);
    };
    useEffect(() => {
        ink.current = document.createElement('canvas'); ink.current.width = ink.current.height = SIZE;
        mask.current = glyphMask(current); setCoverage(0); draw();
        // Redraw only when the traced glyph changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current]);

    const measure = () => {
        const data = ink.current?.getContext('2d')?.getImageData(0, 0, SIZE, SIZE).data, shape = mask.current;
        if (!data || !shape) return;
        let inside = 0, covered = 0;
        for (let i = 3; i < shape.length; i += 16) if (shape[i] > 128) { inside++; if (data[i] > 64) covered++; }
        setCoverage(inside ? covered / inside : 0);
    };
    const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: (event.clientX - rect.left) / rect.width * SIZE, y: (event.clientY - rect.top) / rect.height * SIZE };
    };
    const stroke = (to: { x: number; y: number }) => {
        const g = ink.current?.getContext('2d'); if (!g) return;
        const from = last.current ?? to;
        const gradient = g.createLinearGradient(0, 0, SIZE, SIZE);
        ['#e2574c', '#f2c14b', '#5fae5a', '#4f9bd9', '#9a74d6'].forEach((c, i) => gradient.addColorStop(i / 4, c));
        g.strokeStyle = gradient; g.lineWidth = 22; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(to.x, to.y); g.stroke();
        last.current = to; draw();
    };
    const done = coverage >= GOAL;
    const save = () => {
        if (!ink.current) return;
        const out = document.createElement('canvas'); out.width = out.height = 128;
        out.getContext('2d')!.drawImage(ink.current, 0, 0, 128, 128);
        onSave(out.toDataURL('image/png'), current);
    };

    return <div className="growing-overlay" role="dialog" aria-label="なぞって かざる">
        <div className="growing-overlay-body growing-trace">
            <strong>なぞって かざろう</strong>
            <div className="growing-row">{choices.map(c => <button key={c} aria-pressed={c === current} onClick={() => setGlyph(c)}>{c}</button>)}</div>
            <canvas ref={canvas} width={SIZE} height={SIZE} className="growing-trace-canvas" aria-label={`${current}を なぞる`}
                onPointerDown={event => { try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* An ended pointer cannot be captured. */ } last.current = undefined; stroke(point(event)); }}
                onPointerMove={event => { if (event.buttons || event.pointerType === 'touch') { if (last.current) stroke(point(event)); } }}
                onPointerUp={() => { last.current = undefined; measure(); }} />
            <div className="growing-loading-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, coverage / GOAL * 100)}%` }} /></div>
            <p className="growing-flower-note">{done ? 'できたね！ しまの はたに かざれるよ' : 'ゆびで もじを なぞってね'}</p>
            <div className="growing-row">
                <button className="growing-primary" disabled={!done} onClick={save}>はたに かざる</button>
                <button onClick={() => { ink.current?.getContext('2d')?.clearRect(0, 0, SIZE, SIZE); setCoverage(0); draw(); }}>けす</button>
                <button onClick={onClose}>とじる</button>
            </div>
        </div>
    </div>;
}
