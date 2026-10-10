import type { PlacePack } from './pack';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
if (!import.meta.env.DEV) {
    root.textContent = 'この診断入口は開発環境でのみ利用できます。';
} else {
    void start().catch(error => { root.textContent = String(error instanceof Error ? error.message : error); });
}
async function start() {
    const [{ parsePlacePack }, { createPlacePreview, readPlacePreview, readPlaceSelection, restorePlaceSelection }] = await Promise.all([import('./pack'), import('./store')]);
    const sessionKey = 'sansu_place_qa_session_v1';
    type Session = { original: string | null; created: { id: string; source: string; payloadHash: string; sourceHash: string }[] };
    let session: Session | undefined;
    try { session = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null') ?? undefined; } catch { /* A corrupt diagnostic session is replaced; native rows stay untouched. */ }
    if (!session || !Array.isArray(session.created) || !(session.original === null || typeof session.original === 'string'))
        session = { original: await readPlaceSelection(), created: [] };
    const currentSession = session;
    const saveSession = () => sessionStorage.setItem(sessionKey, JSON.stringify(currentSession));
    saveSession();
    root.innerHTML = `<header><p class="eyebrow">DEV · EXPLICIT SYNTHETIC FIXTURE</p><h1>育つ場所の開発確認</h1>
        <p>成熟した 15 配置・4 組み合わせ・島全体を、実際のアプリで確認する入口です。</p>
        <p class="note">診断用のしずく・土地・成長・住人です。学習で取得した証拠、自然な 7 日成長、実描画・実使用の証拠にはしません。</p></header>
        <main><section><h2>1 · 診断ファイルを読む</h2><label for="fixture-file">生成した place fixtures JSON</label>
        <button id="read-latest">最新の20配置を読む</button>
        <input id="fixture-file" type="file" accept="application/json,.json">
        <p id="pack-info">ファイルはまだ読み込んでいません。</p>
        <label for="fixture-case">確認する配置</label><select id="fixture-case" disabled><option>ファイルを読み込んでください</option></select>
        <button id="create-preview" disabled>新しい診断プロフィールを作る</button>
        <p>復元先は Preview DB の placedIslands。毎回、新しい qa-place-preview-* 所有者を作ります。</p></section>
        <section><h2>2 · 実際のアプリで確認</h2><label for="preview-owner">作成した診断プロフィール</label><select id="preview-owner"></select>
        <div class="actions"><a id="open-app" href="/#/island">実際のアプリへ</a><button id="refresh-snapshot">保存状態を読み直す</button></div>
        <p id="native-summary" data-qa-native-summary></p><p id="provenance"></p>
        <details><summary>保存された native snapshot（読み取りのみ）</summary><pre id="native-snapshot" data-place-native></pre></details>
        <p>実際のアプリで遊んだあと、このページに戻って保存状態を読み直せます。</p></section>
        <section><h2>3 · 元のプロフィールへ戻す</h2><p id="original-owner"></p>
        <button id="restore-selection">元の選択へ戻す</button><p>戻しても診断用プロフィールは残ります。元の人の島・学習データには書き込みません。</p></section></main>
        <p id="status" role="status" aria-live="polite"></p><footer>開発確認専用 · build <span id="build"></span> · production 入口なし</footer>`;
    const node = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const file = node<HTMLInputElement>('#fixture-file'), choices = node<HTMLSelectElement>('#fixture-case'), owners = node<HTMLSelectElement>('#preview-owner');
    const create = node<HTMLButtonElement>('#create-preview'), refresh = node<HTMLButtonElement>('#refresh-snapshot'), restore = node<HTMLButtonElement>('#restore-selection'), latest = node<HTMLButtonElement>('#read-latest');
    const status = node<HTMLParagraphElement>('#status');
    node('#build').textContent = `${__APP_VERSION__} / ${__BUILD_REVISION__}`;
    node('#original-owner').textContent = `元の選択: ${currentSession.original ?? 'プロフィール未選択'}`;
    let pack: PlacePack | undefined, busy = false;
    const option = (value: string, label: string) => { const element = document.createElement('option'); element.value = value; element.textContent = label; return element; };
    const controls = () => {
        create.disabled = busy || !pack; choices.disabled = busy || !pack; file.disabled = busy; latest.disabled = busy;
        owners.disabled = busy || !currentSession.created.length; refresh.disabled = busy || !owners.value; restore.disabled = busy;
    };
    const native = async () => {
        if (!owners.value) { node('#native-summary').textContent = '診断プロフィールはまだありません。'; node('#native-snapshot').textContent = ''; return; }
        const snapshot = await readPlacePreview(owners.value), record = snapshot.record;
        root.dataset.qaPlaceOwner = owners.value; root.dataset.qaActiveOwner = snapshot.activeProfileId ?? '';
        node('#native-summary').textContent = `${snapshot.database} / ${snapshot.table} · owner ${owners.value} · record v${record?.version ?? '?'} · revision ${record?.revision ?? '?'} · active ${snapshot.activeProfileId ?? 'なし'}`;
        node('#native-snapshot').textContent = JSON.stringify(snapshot, null, 2);
        const original = currentSession.created.find(entry => entry.id === owners.value);
        node('#provenance').textContent = original ? `明示的な成熟診断 ${original.source} · source ${original.sourceHash} · payload ${original.payloadHash}` : '';
    };
    const populateOwners = (selected = owners.value) => {
        owners.replaceChildren(...currentSession.created.map(entry => option(entry.id, `${entry.source} · ${entry.id.slice(-8)}`)));
        if (selected && currentSession.created.some(entry => entry.id === selected)) owners.value = selected;
        controls();
    };
    const action = async (work: () => Promise<void>) => {
        if (busy) return; busy = true; status.textContent = '確認しています…'; controls();
        try { await work(); } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
        finally { busy = false; controls(); }
    };
    const readPack = async (text: string) => {
        pack = undefined; choices.replaceChildren(option('', 'ファイルを読み込んでください'));
        node('#pack-info').textContent = '診断ファイルを確認しています…';
        pack = await parsePlacePack(text);
        choices.replaceChildren(...pack.cases.map(entry => option(entry.id, entry.id.replace('qa-place-', '').replace('-v1', ''))));
        node('#pack-info').textContent = `${pack.cases.length} 件 · source ${pack.sourceHash} · payload ${pack.payloadHash}`;
        status.textContent = '現在の実装で 20 件の配置・所有者・経路を確認しました。';
    };
    file.onchange = () => { void action(async () => {
        const selected = file.files?.[0]; if (!selected) { status.textContent = 'ファイルを選んでください。'; return; }
        await readPack(await selected.text());
    }); };
    latest.onclick = () => { void action(async () => {
        const response = await fetch('/prototypes/place-qa/fixtures.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('最新の診断ファイルがありません。生成してから読み直してください。');
        await readPack(await response.text());
    }); };
    create.onclick = () => { void action(async () => {
        const entry = pack?.cases.find(entry => entry.id === choices.value); if (!entry || !pack) throw new Error('診断の配置を選んでください。');
        const id = await createPlacePreview(entry);
        currentSession.created.push({ id, source: entry.id, sourceHash: pack.sourceHash, payloadHash: pack.payloadHash }); saveSession();
        populateOwners(id); await native(); status.textContent = '新しい診断プロフィールを選択しました。実際のアプリへ進めます。';
    }); };
    refresh.onclick = () => { void action(async () => { await native(); status.textContent = '保存状態を読み直しました。実績は追加していません。'; }); };
    owners.onchange = () => { void action(async () => { await native(); status.textContent = '表示する保存状態を切り替えました。アプリの選択は変えていません。'; }); };
    restore.onclick = () => { void action(async () => { await restorePlaceSelection(currentSession.original); await native(); status.textContent = '元のプロフィール選択に戻しました。'; }); };
    populateOwners(); await native();
}
