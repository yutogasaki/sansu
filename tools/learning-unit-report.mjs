import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

// The report data is inert JSON. Escaping '<' also prevents a label from closing its script tag.
const inlineJson = (value) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029',
}[character]));

function activateReport() {
    const report = JSON.parse(document.getElementById('report-data').textContent);
    const unitById = new Map(report.units.map(unit => [unit.id, unit]));
    const itemsByUnit = new Map();
    for (const item of report.mappings) {
        if (!itemsByUnit.has(item.unitId)) itemsByUnit.set(item.unitId, []);
        itemsByUnit.get(item.unitId).push(item);
    }
    const controls = Object.fromEntries(['view', 'subject', 'level', 'availability', 'search']
        .map(id => [id, document.getElementById(id)]));
    const body = document.getElementById('catalog-body');
    const heading = document.getElementById('catalog-heading');
    const count = document.getElementById('result-count');
    const previous = document.getElementById('previous');
    const next = document.getElementById('next');
    const pageSize = 100;
    let page = 0;

    function element(tag, value, className) {
        const node = document.createElement(tag);
        if (value !== undefined) node.textContent = value;
        if (className) node.className = className;
        return node;
    }

    function cell(primary, secondary) {
        const td = element('td');
        td.append(element('span', primary));
        if (secondary) td.append(element('span', secondary, 'subline'));
        return td;
    }

    function unitName(id) {
        const unit = unitById.get(id);
        return unit ? `${unit.label} (${id})` : id;
    }

    function dependencies(unit) {
        const td = element('td');
        if (unit.prerequisites.length) {
            td.append(element('span', `必須: ${unit.prerequisites.map(unitName).join(' / ')}`));
        }
        if (unit.suggestedPrerequisites.length) {
            td.append(element('span', `推奨: ${unit.suggestedPrerequisites.map(unitName).join(' / ')}`, 'subline'));
        }
        if (!td.childNodes.length) td.textContent = '指定なし';
        return td;
    }

    const levels = [...new Set(report.mappings.map(item => item.legacyLevel))].sort((a, b) => a - b);
    for (const level of levels) {
        const option = element('option', `Lv.${level}`);
        option.value = String(level);
        controls.level.append(option);
    }

    function render() {
        const isUnits = controls.view.value === 'units';
        const query = controls.search.value.trim().toLocaleLowerCase('ja');
        const records = isUnits ? report.units : report.mappings;
        const filtered = records.filter(record => {
            const unit = isUnits ? record : unitById.get(record.unitId);
            const items = isUnits ? (itemsByUnit.get(record.id) ?? []) : [record];
            if (controls.subject.value && record.subject !== controls.subject.value) return false;
            if (controls.availability.value && unit?.availability !== controls.availability.value) return false;
            if (controls.level.value && !items.some(item => item.legacyLevel === Number(controls.level.value))) return false;
            return !query || JSON.stringify({ unit, items }).toLocaleLowerCase('ja').includes(query);
        });
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        page = Math.max(0, Math.min(page, totalPages - 1));
        const headers = isUnits
            ? ['教科 / 状況', '単元', '系統', '旧レベル / 教材', '前提関係']
            : ['教科 / 旧レベル', '教材ID', '単元', '表現・方法', '問題の型'];
        heading.replaceChildren(...headers.map(label => {
            const th = element('th', label);
            th.scope = 'col';
            return th;
        }));
        const rows = filtered.slice(page * pageSize, (page + 1) * pageSize).map(record => {
            const row = element('tr');
            const subject = record.subject === 'math' ? '算数' : '英語';
            if (isUnits) {
                const unit = record;
                const items = itemsByUnit.get(unit.id) ?? [];
                const legacyLevels = [...new Set(items.map(item => item.legacyLevel))].sort((a, b) => a - b);
                const titleCell = cell(unit.label, unit.id);
                if (unit.notes) titleCell.append(element('span', unit.notes, 'note'));
                const itemCell = cell(legacyLevels.length ? legacyLevels.map(level => `Lv.${level}`).join(', ') : '所属なし');
                if (items.length) {
                    const detail = element('details');
                    detail.append(element('summary', `${items.length}教材`));
                    detail.append(element('div', items.map(item => `${item.itemId} [${item.representation}; ${item.variants.join(', ')}]`).join('\n'), 'item-list'));
                    itemCell.append(detail);
                }
                row.append(cell(subject, unit.availability === 'planned' ? '未実装' : '既存教材'), titleCell,
                    cell(unit.strand), itemCell, dependencies(unit));
            } else {
                const unit = unitById.get(record.unitId);
                row.append(cell(subject, `Lv.${record.legacyLevel}`), cell(record.itemId),
                    cell(unit?.label ?? '単元なし', record.unitId), cell(record.representation), cell(record.variants.join(', ')));
            }
            return row;
        });
        body.replaceChildren(...rows);
        if (!rows.length) {
            const row = element('tr');
            const empty = cell('一致する内容がありません。条件を変更してください。');
            empty.colSpan = headers.length;
            row.append(empty);
            body.append(row);
        }
        count.textContent = `${filtered.length.toLocaleString('ja-JP')}件 · ${page + 1} / ${totalPages}ページ（1ページ${pageSize}件）`;
        previous.disabled = page === 0;
        next.disabled = page + 1 >= totalPages;
    }

    for (const control of Object.values(controls)) {
        control.addEventListener(control === controls.search ? 'input' : 'change', () => { page = 0; render(); });
    }
    previous.addEventListener('click', () => { page--; render(); });
    next.addEventListener('click', () => { page++; render(); });
    document.getElementById('reset').addEventListener('click', () => {
        for (const [name, control] of Object.entries(controls)) control.value = name === 'view' ? 'units' : '';
        page = 0;
        render();
    });
    render();
}

export function buildLearningReportHtml(report) {
    const metrics = [
        ['算数の教材', report.inventory.mathItems], ['算数の単元', report.inventory.mathUnits],
        ['英語の教材', report.inventory.englishItems], ['英語の単元', report.inventory.englishUnits],
    ];
    const validation = report.catalogErrors.length
        ? `<p class="error">対応表に${report.catalogErrors.length}件の問題があります。</p><ul>${report.catalogErrors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`
        : '<p class="success">対応表の構造検査: 問題なし</p>';
    const scenarios = report.scenarios.map((scenario, index) => {
        const evaluation = scenario.evaluation && typeof scenario.evaluation === 'object' ? scenario.evaluation : {};
        const units = Array.isArray(evaluation.units) ? evaluation.units : [];
        const readyCount = units.filter(unit => unit.readiness === 'ready').length;
        const retainedCount = units.filter(unit => unit.retention === 'confirmed').length;
        const summary = units.length ? `<p class="scenario-result">旧レベルの集計条件: ${evaluation.legacyLevel11Evidence ? '充足' : '未充足'}<br>
            単元の理解確認: <strong>${readyCount} / ${units.length}</strong> · 定着確認: <strong>${retainedCount} / ${units.length}</strong></p>` : '';
        const unitTable = units.length ? `<details><summary>${units.length}単元の評価を見る</summary><div class="table-wrap"><table class="scenario-table">
            <thead><tr><th scope="col">単元</th><th scope="col">理解</th><th scope="col">定着</th><th scope="col">前提未確認</th></tr></thead>
            <tbody>${units.map(unit => `<tr><td>${escapeHtml(unit.label)}</td><td>${unit.readiness === 'ready' ? '確認済み' : '未確認'}</td>
                <td>${unit.retention === 'confirmed' ? '確認済み' : '未確認'}</td><td>${escapeHtml(unit.unconfirmedPrerequisites?.length ?? 0)}件</td></tr>`).join('')}</tbody>
        </table></div></details>` : '';
        return `<article class="scenario"><h3>${index + 1}. ${escapeHtml(scenario.name)}</h3><p>${escapeHtml(scenario.description)}</p>
            ${summary}${unitTable}<details><summary>証拠・条件の全データを見る</summary><pre>${escapeHtml(JSON.stringify(scenario.evaluation, null, 2))}</pre></details></article>`;
    }).join('');

    return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sansu 学習単元の比較レポート</title><link rel="icon" href="data:,">
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;color:#243237;background:#f5f7f6;font-size:15px;line-height:1.65;color-scheme:light}
*{box-sizing:border-box}body{margin:0}main{max-width:1480px;margin:0 auto;padding:40px 28px 72px}h1{font-size:clamp(25px,3vw,38px);line-height:1.3;margin:8px 0 16px}h2{font-size:23px;margin:0 0 12px}h3{font-size:17px;margin:0 0 8px}p{margin:8px 0 14px}.eyebrow{font-weight:650;color:#496861;letter-spacing:.05em}.intro{max-width:880px}.muted,.subline{color:#62736f;font-size:12px}.notice{border-left:4px solid #b08431;background:#fff6df;padding:14px 18px;margin:24px 0}.notice p{margin:0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.metric{background:#fff;border:1px solid #dce4df;border-radius:10px;padding:16px 20px}.metric span{display:block;font-size:13px;color:#536961}.metric strong{font-size:30px;font-weight:650}.section{margin-top:32px}.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:18px 0}.controls label{display:flex;flex-direction:column;gap:4px;font-size:13px}.search{flex:1;min-width:220px}select,input,button{font:inherit;border:1px solid #bac9c2;border-radius:7px;padding:8px 10px;background:#fff;color:inherit;min-height:42px}button{cursor:pointer}button:hover:not(:disabled){background:#e8f1ec}button:disabled{opacity:.4;cursor:default}input:focus,select:focus,button:focus-visible,summary:focus-visible{outline:3px solid #72ad9a;outline-offset:2px}.table-wrap{overflow:auto;border:1px solid #dce4df;border-radius:10px;background:#fff}table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;table-layout:fixed}th{background:#eaf0ec;font-weight:650}th,td{padding:13px 15px;border-bottom:1px solid #e4eae6;vertical-align:top;overflow-wrap:anywhere}th:first-child{width:12%}th:nth-child(2){width:29%}th:nth-child(3){width:15%}th:nth-child(4){width:18%}tbody tr:last-child td{border-bottom:0}.subline,.note{display:block;margin-top:4px}.note{font-size:12px;margin-top:7px}.pager{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:12px 0}.pager-buttons{display:flex;gap:8px}.item-list{white-space:pre-line;margin-top:8px;font-size:12px}.success{color:#245c43}.error{color:#9b3030}.scenarios{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.scenario{background:#fff;border:1px solid #dce4df;border-radius:10px;padding:18px}.scenario p{font-size:14px}summary{cursor:pointer;color:#285b49;min-height:28px}pre{font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f2;padding:14px;border-radius:6px;max-height:560px;overflow:auto}li+li{margin-top:6px}footer{margin-top:36px;font-size:12px;color:#62736f}noscript p{padding:18px;background:#fff6df}
@media(max-width:720px){main{padding:24px 14px 48px}.metrics{grid-template-columns:repeat(2,1fr);gap:8px}.metric{padding:12px 14px}.scenarios{grid-template-columns:1fr}table{min-width:880px}.controls label{flex:1;min-width:130px}.controls .search{flex-basis:100%}.pager{align-items:start;flex-direction:column}.metric strong{font-size:26px}}
@media print{main{padding:0}.controls,.pager-buttons{display:none}.table-wrap{overflow:visible}table{font-size:10px}.scenario{break-inside:avoid}.notice{background:#fff}pre{max-height:none}.metrics{grid-template-columns:repeat(4,1fr)}}
.scenario-result{background:#edf3ef;padding:10px 12px;border-radius:6px}.scenario details+details{margin-top:9px}.scenario-table{min-width:0;table-layout:auto;font-size:12px}.scenario-table th{width:auto!important}.scenario-table th,.scenario-table td{padding:8px}
</style></head><body><main>
<header><div class="eyebrow">SANSU · 学習設計の検証</div><h1>学習単元の比較レポート</h1>
<p class="intro">既存の教材を概念・語義ごとの単元へ対応させ、算数Lv11の習得証拠を比較する試作です。単元、表現・方法、問題の型を分けて確認できます。</p>
<p class="muted">カタログ版: ${escapeHtml(report.catalogVersion)} · 生成: ${escapeHtml(new Date().toISOString())}</p></header>
<aside class="notice"><p><strong>比較用の仮判定です。</strong> 通常の出題選択・SRS・解放・昇格は変更しません。シナリオは人工的に作った回答例で、実際の子どもの学習結果ではありません。</p></aside>
<div class="metrics">${metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value.toLocaleString('ja-JP'))}</strong></div>`).join('')}</div>
${validation}
<section class="section" aria-labelledby="catalog-title"><h2 id="catalog-title">全教材の対応表</h2>
<p>既存のレベルは保存されている所属を示します。単元数は証拠を記録する粒度で、子ども向けのレッスン数ではありません。「未実装」の前提を通常出題の関門にしません。</p>
<div class="controls">
<label>表示<select id="view"><option value="units">単元</option><option value="items">教材項目</option></select></label>
<label>教科<select id="subject"><option value="">すべて</option><option value="math">算数</option><option value="vocab">英語</option></select></label>
<label>旧レベル<select id="level"><option value="">すべて</option></select></label>
<label>提供状況<select id="availability"><option value="">すべて</option><option value="existing">既存教材</option><option value="planned">未実装</option></select></label>
<label class="search">単元名・ID・前提・表現を検索<input id="search" type="search" placeholder="例: 繰り上がり、orange、hissan"></label>
<button id="reset" type="button">条件を解除</button></div>
<div class="pager"><span id="result-count" role="status" aria-live="polite"></span><div class="pager-buttons"><button id="previous" type="button">前の100件</button><button id="next" type="button">次の100件</button></div></div>
<div class="table-wrap"><table aria-label="学習単元と教材の対応"><thead><tr id="catalog-heading"></tr></thead><tbody id="catalog-body"></tbody></table></div>
<noscript><p>対応表の検索にはJavaScriptを有効にしてください。全データは同じフォルダのreport.jsonにも保存されています。</p></noscript>
</section>
<section class="section" aria-labelledby="scenario-title"><h2 id="scenario-title">算数Lv11の比較シナリオ</h2><p>偏った反復、支援、別の問題、後日の確認などを区別できるか確かめます。以下の結果から実際の学習効果を推定しません。</p><div class="scenarios">${scenarios}</div></section>
<section class="section" aria-labelledby="limitations-title"><h2 id="limitations-title">今回確認できる範囲</h2><ul>${report.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
<footer>このHTMLは単体で開けます。外部へのデータ送信や、アプリ内の学習記録の変更は行いません。</footer>
</main><script id="report-data" type="application/json">${inlineJson(report)}</script><script>(${activateReport.toString()})();</script></body></html>`;
}

async function main() {
    const server = await createServer({
        root: repoRoot,
        configFile: false,
        appType: 'custom',
        logLevel: 'error',
        resolve: { alias: { '@': path.join(repoRoot, 'src') } },
        server: { middlewareMode: true, watch: null, hmr: false },
        optimizeDeps: { noDiscovery: true, include: [] },
    });
    let report;
    try {
        const { buildLearningPilotReport } = await server.ssrLoadModule('/src/domain/learning/pilotReport.ts');
        report = await buildLearningPilotReport();
    } finally {
        await server.close();
    }
    const outputDirectory = path.resolve(repoRoot, process.env.SANSU_LEARNING_REPORT_DIR || 'output/learning-units');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.join(outputDirectory, 'report.html'), buildLearningReportHtml(report));
    console.log(`学習単元レポート: ${path.join(outputDirectory, 'report.html')}`);
    console.log(`対応表の問題: ${report.catalogErrors.length}件 / 比較シナリオ: ${report.scenarios.length}件`);
    if (report.catalogErrors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
