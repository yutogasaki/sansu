import './style.css';
import { boards, CANDIDATE } from './boards';
import { achieved, clone, pairs, play } from './engine';
import { createJournal, decode, fresh, replay, save, STORAGE_KEY, type Session } from './state';
import { animateFall, animateMerge, delay, element, reduced, renderBoard } from './view';

let session: Session = fresh();
let loaded = false;
let storageNotice = '';
try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { session = decode(raw); loaded = true; }
} catch {
    storageNotice = '前のつづきを読み込めませんでした。この回は最初から遊べます。';
}
const journal = createJournal();
let selected: number | null = null;
let generation = 0;
let busy = false;
let audio: AudioContext | undefined;
const board = () => boards.find(b => b.id === session.boardId)!;
const snapshot = () => { const states = replay(session); return states[states.length - 1]; };
const message = (text: string) => { element('message').textContent = text; };
const record = (event: string, details: Record<string, unknown> = {}) => journal.record(event, session, details);

function persist() {
    let ok = false;
    try { ok = save(session, localStorage); } catch { /* Access itself can be denied on file URLs. */ }
    element('storage').textContent = ok ? 'この端末に、つづきを保存しています。操作ログは保存対象外です。' : '保存できない環境です。ページを閉じると、つづきは残りません。';
    element('storage-warning').hidden = ok && !storageNotice;
    element('storage-warning').textContent = ok ? storageNotice : 'つづきを保存できません。このページではそのまま遊べます。';
}

function settings() {
    element('target').textContent = String(board().target);
    element('target5').setAttribute('aria-pressed', String(board().target === 5));
    element('target10').setAttribute('aria-pressed', String(board().target === 10));
    element('dots').setAttribute('aria-pressed', String(session.dots));
    element('dots').textContent = session.dots ? 'つぶ あり' : 'つぶ なし';
    element('sound').setAttribute('aria-pressed', String(session.sound));
    element('sound').textContent = session.sound ? '音 あり' : '音 なし';
    element('board').classList.toggle('numbers-only', !session.dots);
    element<HTMLSelectElement>('board-select').value = session.boardId;
    element('pause').hidden = !session.paused;
    element<HTMLButtonElement>('end').disabled = session.paused;
    element<HTMLButtonElement>('undo').disabled = !session.moves.length || session.paused;
    element<HTMLButtonElement>('retry').disabled = session.paused;
    element<HTMLButtonElement>('next').disabled = session.paused;
}

function render(text?: string) {
    const current = board();
    const state = snapshot();
    const won = achieved(current, state.columns, state.best);
    element('level').textContent = `${current.id.split('-')[1]} / 6 · ${current.name}`;
    element('goal').textContent = current.goal === 'all' ? 'ぜんぶ つなげよう' : `${current.goal}れんさ つなげよう`;
    const rows = Math.max(...current.columns.map(c => c.length));
    element('board').style.setProperty('--rows', String(Math.max(2, rows)));
    document.querySelector('.stack-label')!.textContent = rows > 1 ? 'うえの かずは、あとから おちる' : 'ふたつの かずを あわせよう';
    element('chain').textContent = state.last ? `${state.last} れんさ` : '';
    element('chain').classList.toggle('complete', won);
    element('board').dataset.boardId = current.id;
    element('board').dataset.won = String(won);
    element('board').dataset.busy = String(busy);
    const focusedColumn = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.column : undefined;
    renderBoard(state.columns, pick, busy || session.paused || won, selected);
    if (focusedColumn !== undefined) document.querySelector<HTMLElement>(`.tile[data-row="0"][data-column="${focusedColumn}"]`)?.focus({ preventScroll: true });
    settings();
    message(text ?? (won ? 'ぴったり！ つながったね' : state.last ?
        pairs(state.columns, current.target).length ? 'のこった くみも つなげてみよう' : 'べつの はじめかたも ためせるよ' :
        'したの ふたつを えらんでね'));
}

function cancel() { generation++; busy = false; selected = null; }

async function chime(chain: number) {
    if (!session.sound) return;
    try {
        audio ??= new AudioContext();
        await audio.resume();
        if (!session.sound) return;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = 392 * Math.pow(1.25, chain - 1);
        gain.gain.setValueAtTime(.0001, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(.08, audio.currentTime + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .22);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(); oscillator.stop(audio.currentTime + .24);
    } catch {
        session.sound = false; settings(); persist();
        element('storage').textContent += ' 音はこの環境で使えません。音なしで遊べます。';
    }
}

async function pick(column: number) {
    if (busy || session.paused) return;
    const current = board();
    const state = snapshot();
    if (achieved(current, state.columns, state.best)) return;
    if (selected === column) { selected = null; render(); return; }
    if (selected === null) { selected = column; record('select', { column }); render('となりの かずを えらんでね'); return; }
    if (Math.abs(selected - column) !== 1) {
        selected = column; record('select', { column, replacedNonAdjacent: true }); render('となりどうしを えらんでね'); return;
    }
    const pair = Math.min(column, selected);
    const values = [state.columns[pair][0], state.columns[pair + 1][0]];
    const sum = values[0] + values[1];
    record('manual_pair', { pair, values, sum, valid: sum === current.target });
    selected = null;
    if (sum !== current.target) { render(`${values[0]} と ${values[1]} は ${sum}。えらびなおせるよ`); return; }
    const steps = play(state.columns, current.target, pair);
    const token = ++generation;
    session.moves.push(pair);
    // Commit a whole deterministic move before presentation: reload cannot store half a cascade.
    record('manual_clear', { pair, values, chain: 1 });
    steps.slice(1).forEach((step, i) => record('automatic_clear', {
        pair: step.pair, values: step.values, chain: i + 2, phase: 'resolved',
    }));
    session.afterUndo = false;
    persist(); busy = true;
    element('board').dataset.busy = 'true';
    settings();
    for (const [index, step] of steps.entries()) {
        if (token !== generation) return;
        renderBoard(clone(step.before), pick, true, null);
        element('chain').textContent = `${index + 1} れんさ`;
        message(`${step.values[0]} ＋ ${step.values[1]} ＝ ${current.target}${index ? '　つながった！' : '　ぴったり！'}`);
        animateMerge(step.pair); void chime(index + 1);
        await delay(reduced() ? 230 : 380);
        if (token !== generation) return;
        renderBoard(clone(step.after), pick, true, null); animateFall(step.pair);
        await delay(reduced() ? 130 : 400);
    }
    if (token !== generation) return;
    busy = false; record('presentation_complete', { chains: steps.length }); render();
}

function openBoard(id: string, reason: string) {
    if (!boards.some(b => b.id === id)) return;
    cancel();
    session = { ...session, boardId: id, moves: [], paused: false, afterUndo: false,
        visits: { ...session.visits, [id]: (session.visits[id] || 0) + 1 } };
    record(reason); persist(); render();
}

for (const target of [5, 10]) element(`target${target}`).onclick = () => {
    if (board().target !== target) openBoard(`${target}-1`, 'target_change');
};
element('undo').onclick = () => {
    if (!session.moves.length) return;
    cancel(); session.moves.pop(); session.afterUndo = true; record('undo'); persist(); render('べつの くみも ためしてみよう');
};
element('retry').onclick = () => openBoard(session.boardId, 'replay_board');
element('next').onclick = () => {
    const index = Number(session.boardId.split('-')[1]);
    openBoard(`${board().target}-${index % 6 + 1}`, 'next_board');
};
element('end').onclick = () => {
    cancel(); session.paused = true; record('end'); persist(); render(); element('resume').focus();
};
element('resume').onclick = () => {
    session.paused = false; record('resume'); persist(); render(); element('end').focus();
};
element('dots').onclick = () => { session.dots = !session.dots; record('dots_change'); persist(); settings(); };
element('sound').onclick = () => {
    session.sound = !session.sound; record('sound_change'); settings(); persist();
    if (session.sound) void chime(1);
};
const select = element<HTMLSelectElement>('board-select');
for (const b of boards) select.add(new Option(`${b.target}をつくる・${b.id.split('-')[1]} ${b.name}`, b.id));
select.onchange = () => openBoard(select.value, 'board_select');
element('export').onclick = () => {
    record('export');
    const blob = new Blob([JSON.stringify(journal.export(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `pittari-${new Date().toISOString().replace(/:/g, '-')}.json`;
    anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const revision = typeof __BUILD_REVISION__ === 'undefined' ? 'development-local' : __BUILD_REVISION__;
document.querySelector<HTMLElement>('main')!.dataset.buildRevision = revision;
element('identity').textContent = `${CANDIDATE} / ${revision} / 独立試作`;
record(loaded ? 'reload_resume' : 'session_start');
persist(); render();
