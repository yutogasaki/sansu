// Frozen author assessment for v6. A new candidate requires a fresh review.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8').then(JSON.parse);
const report = await read('verification-v6/report.json'), manifest = await read('art-manifest.json');
assert.equal(manifest.candidate, 'native05-landscape-owned-art-v6');
assert(report.pass && report.captures.length === 24 && report.scenarios.length === 2);
assert.deepEqual(report.initialInputs, report.finalInputs);
for (const [name, expected] of Object.entries(report.initialInputs)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(name, root))).digest('hex'), expected);
}
await mkdir(new URL('verification-logs/', root), { recursive:true });
for (const [source, name] of [['/tmp/sansu-landscape-viewer-v6-01.txt','viewer-v6.txt'],
    ['/tmp/sansu-landscape-artifact-v6-03.txt','artifact-v6.txt'], ['/tmp/sansu-landscape-blender-06.txt','blender-v6.txt'],
    ['/tmp/sansu-landscape-silhouettes-v6.txt','silhouettes-v6.txt'], ['/tmp/sansu-landscape-network-probe-02.txt','favicon-diagnosis.txt']]) {
    await copyFile(source, new URL(`verification-logs/${name}`, root));
}
await copyFile('tools/qa-landscape-art-viewer.mjs', new URL('verification-v6/qa.mjs', root));
const gate = {
    schema:'sansu-landscape-art-gate-v1', reviewedAt:new Date().toISOString(), candidate:manifest.candidate,
    actualTarget:report.target, delivery:'standalone-art-viewer', gameplayMapped:false,
    buildRevision:manifest.sha256, modelSha256:manifest.sha256,
    appRevisionUnchanged:'ac0ff3668b023114a22c9911aa0d9faf7b86b4e7',
    appDeliveryFlag:'Normal production native-owned-art default false; this proposal is not in the app',
    evidenceType:'Real Blender art and standalone browser screenshots, not the actual owned island',
    benchmark:{candidate:'whole-island-native-3d-05', sha256:manifest.sourceGlbSha256, userAdoptedDirection:true, sourceBytesUnchanged:true},
    visualAppeal:{verdict:'HOLD_FOR_WHOLE_ISLAND_ADOPTION', score:46, outOf:60, authorOnly:true, independentObservers:0,
        axes:[
            {axis:'Enter the world',score:8,reason:'Deep bays, raised water and the hollow tree give the eye distinct destinations.'},
            {axis:'Character attachment',score:6,reason:'The original figures remain specific, but only three are visible and the full frame has little relational acting.'},
            {axis:'Material touch',score:9,reason:'Actual original bark, tiles, colored leaves, mineral bowls and transmissive shell are distinct.'},
            {axis:'Composition and depth',score:8,reason:'Hill / water / flower room / bay settle into separate layers; the left grove remains sparse.'},
            {axis:'Pop and focal color',score:9,reason:'Fan leaves, pink petals, blue water and owned roof colors remain readable in daylight.'},
            {axis:'Incident and payoff',score:6,reason:'A still authored proposal suggests shared places but shows no actual owner growth or actor use.'}],
        evidence:['showcase-preview.png','water-garden-preview.png','verification-v6/390-grown-whole-day-01.png','verification-v6/768-grown-whole-day-13.png'],
        sourceParityApproved:false, fullImplementationVisualGatePassed:false},
    continuityScreen:{verdict:'PASS_SCOPED_ART_IDENTITIES', silhouettes:['proposal-silhouette-64.png','source-silhouette-64.png'],
        fixedRegionOverlay:'house-surface-overlay.svg', actualHouseSurfaceTolerance:1e-5, sameCameraSourceSwitch:true,
        expectedComparisonCandidates:2, unexpectedMixedCandidates:0, visibleFigureSubsetOnly:true, savedLayoutContinuityNotProven:true},
    comprehensionSafety:{verdict:'NOT_EVALUATED_INDEPENDENTLY',independentChildren:0,understoodCount:null,wantMoreCount:null,dangerInterpretations:null},
    runtimeIntegrity:{verdict:'NOT_APPLICABLE_TO_GAME',viewerVerdict:'PASS_SCOPED_ART_VIEWER_V6',report:'verification-v6/report.json',
        captures:24,widths:[390,768],artifactReport:'artifact-check.json',appSaveOrWalkMappingProven:false,
        mobileAppAssetBudgetMeasured:false,gameCoreOrPwaRerun:false,previousAppEvidence:'../2026-10-11-native-owned-island/gate-review.json'},
    artifactLog:{fixed:['Oversized furniture in draft 01','Furniture buried by real court caps in draft 02','p26 on a steep cliff in draft 03',
        'Road-edge clipping in draft 04','Convex hill cutting through wide road quads in draft 05'],
        intentional:['Close views crop portions of the distant fan crown; the whole view contains the full island',
            'Uniform art sizing and new anchors differ from the saved gameplay layout','Ground meadow flowers are scenery, not newly bought mature plants'],
        remaining:['Sparse grove and thin interpersonal story compared with the target',
            'One shared cell-to-floor map, placement hits, entrances, roads and walk paths are not implemented for this proposal',
            'Natural growth, independent child comprehension, device performance and PWA delivery are not measured here']},
    contactSheet:'contact-sheet.html',verdict:'HOLD_FULL_ISLAND_RUNTIME_ACCEPTANCE',
    completionUnit:'One editable whole-island art proposal using the same 8 homes / 27 placed / 2 stored diagnostic owners. Actual app whole-island integration remains open.'
};
await writeFile(new URL('gate-review.json',root), JSON.stringify(gate,null,2)+'\n');
const items = report.captures.map(c => {
    const name = {whole:'全島',grove:'大樹',village:'水の庭',harbor:'入り江',garden:'花の庭'}[c.view];
    const phase = c.phase === 'previous' ? '採用原本（完成美術15軒）' : '造形案（家8軒）';
    return `<figure><a href="verification-v6/${c.file}"><img src="verification-v6/${c.file}" alt="${c.width}幅・${phase}・${name}・${c.lighting}"></a><figcaption>${c.width}幅 / ${phase} / ${name} / ${c.lighting}<br><code>${c.model}</code><br><code>${c.loadedModelSha256.slice(0,16)}</code></figcaption></figure>`;
});
await writeFile(new URL('contact-sheet.html',root), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全島造形 v6 · 実表示の確認</title><style>body{margin:0;padding:28px;background:#f4f6f9;color:#29374a;font-family:system-ui,sans-serif}h1{font-size:23px}p{max-width:900px;line-height:1.75;font-size:14px}a{color:#3767aa}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:24px}figure{margin:0;background:white;border:1px solid #e2e7ef;border-radius:12px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:12px;font-size:12px;line-height:1.7;overflow-wrap:anywhere}.silhouettes{display:flex;gap:24px}.silhouettes img{width:64px;height:64px;image-rendering:pixelated}.overlay{max-width:520px}</style><h1>全島造形 v6 · 24枚の実表示</h1><p>standaloneの美術表示。本人のGrowingWorldとは別です。同じ8軒・27配置物・2収納物から構成しますが、造形anchorは保存位置と異なります。採用原本との明示切替を含みます。自然な取得・成長・通行や本体PWAの証拠には使いません。</p><p>モデルSHA: <code>${manifest.sha256}</code><br>美術：作者46/60・HOLD / 無説明理解と安全：独立N=0 / 本体runtime：未接続。表示検査だけPASS。</p><p><a href="index.html">3D表示</a> · <a href="gate-review.json">三つの判定</a> · <a href="verification-v6/report.json">実表示の原記録</a> · <a href="artifact-check.json">所有物・実meshの一致</a></p><div class="silhouettes"><div><img src="source-silhouette-64.png" alt="採用原本の64px黒シルエット">採用原本</div><div><img src="proposal-silhouette-64.png" alt="造形案の64px黒シルエット">造形案</div></div><p>家の同じ根座標で実meshを重ねます。移設・一様拡大は除外し、形の頂点と色の一致を検査しています。</p><a href="house-surface-overlay.svg"><img class="overlay" src="house-surface-overlay.svg" alt="現行kitと書出後の8軒の家の実meshを重ねた図"></a><section>${items.join('')}</section></html>`);
console.log(JSON.stringify({candidate:manifest.candidate,captures:items.length,visualScore:46,verdict:gate.verdict}));
