import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.md') ? [`${dir}/${e.name}`] : []);
const title = file => read(file).match(/^# (.+)$/m)?.[1] || path.basename(file);
const href = (from, to) => path.relative(path.dirname(from), to).split(path.sep).map(encodeURIComponent).join('/');
const pages = [['.agents/index.html', '概要'], ['.agents/tasks/index.html', 'タスク'], ['docs/index.html', 'ドキュメント'], ['.agents/map.html', '仕様と実装']];
const mapEntries = [
  { area: '学ぶ', name: 'ぽこもこの全画面演出と音', status: '本番で確認済み', done: '学習v8の入力運搬・連続正解・区間の祝福と進行する音楽を実装。本番の庭・家との往復とoffline再開を確認。', next: '実機の音量と負荷、読み上げ、利用者評価を確認する。', stages: ['仕様07に反映', 'v8を公開', '画面・入力・往復・offlineを確認', '実機・利用者待ち'], specs: ['docs/product/07_ui_design_guideline.md'], task: 'docs/tasks/active/2026-09-20-whole-app-ux-coherence.md', code: ['src/components/island/IslandAnswerFeedback.tsx'] },
  { area: '性能', name: '起動と30品の島', status: '軽量化を本番反映', done: '同じ30品の三角形・描画数を保持し、raycast CPUを約84〜85%削減。', next: '最新desktopのフレーム時間37.8/55.3msは33.3ms未達。実iPhoneの起動・描画・電池と残る負荷を確認する。', stages: ['既存契約を維持', '描画・判定を軽量化', '同じ30品で前後比較', '実iPhone・電力待ち'], specs: ['docs/product/48_island_life_spec.md'], task: 'docs/tasks/active/2026-09-23-island-performance.md', code: ['src/components/island/life/fantasy/staticBatch.ts'] },
  { area: '学ぶ', name: '通常の算数・英語', status: '現行で利用', done: '通常問題、ヒント、復習、学習記録を利用できる。', next: '島との行き来を実際の子どもが説明なしで使えるか確認する。', stages: ['確定', '現行で利用', '自動確認済み', '利用者確認待ち'], specs: ['docs/product/01_app_spec.md', 'docs/product/02_math_skills.md', 'docs/product/03_english_skills.md'], code: ['src/pages/Study.tsx', 'src/hooks/useStudySession.ts'] },
  { area: '島で暮らす', name: '学習から島の暮らしへ', status: '家庭内で利用', done: 'しずくで購入・配置し、成長や住人の利用を見られる。', next: '現行の島の美術と実際の子どもの理解を確認する。', stages: ['確定', '家庭内で利用', '局所確認済み', '利用者確認待ち'], specs: ['docs/product/28_mystic_island_spec.md', 'docs/product/48_island_life_spec.md'], code: ['src/components/island/life/IslandLife.tsx', 'src/domain/islandLife/simulation.ts'] },
  { area: '島で暮らす', name: '今の島の家・室内・学習の行き来', status: '直接入室を復元', done: '庭の家・ナビの「いえ」から既存の室内へ直接入る。床の移動、棚・アルバム・写真、同じ学習の再開を保持。', next: '写真保存のWebKit問題と実機Safari、子どもの無説明利用を確認する。', stages: ['確定', '既存の室内へ接続', '両幅・昼夕夜・offline確認', '実機・利用者待ち'], specs: ['docs/product/43_island_navigation_spec.md', 'docs/product/48_island_life_spec.md'], task: 'docs/tasks/active/2026-09-20-whole-app-ux-coherence.md', code: ['src/pages/Island.tsx', 'src/components/island/IslandStage.tsx', 'src/components/island/IslandHouseOverview.tsx'] },
  { area: '島で暮らす', name: '発見と島の世界美術', status: '一部実装', done: '島の入口と一部の発見体験を改善した。', next: '巨大植物、光と影、地形のつながりを整えて同じ版で比較する。', stages: ['採用', '一部実装', '局所確認済み', '利用者確認待ち'], specs: ['docs/product/50_mysterious_island_discovery_spec.md'], task: 'docs/tasks/active/2026-09-27-living-fantasy-first-playable.md', code: ['src/components/island/life/IslandLife.tsx'] },
  { area: '自然と町を育てる', name: '育つ→運ぶ→食べる', status: '一部実装', done: '今の島で、うえ木ばちのハーブが育ち、同じ住人が食卓へ運び、在庫があると食べる一周を家庭内本番へ統合。旧Nature Townの別画面は使わない。', next: '更新・オフラインと学習往復は確認済み。来訪・入居も同じLifeへ接続済み。実機と子どもの理解を確認する。', stages: ['方針を採用', '家庭内本番へ統合', '更新・offline・保存を確認', '実機・利用者待ち'], specs: ['docs/product/island-nature-integration.md', 'docs/product/48_island_life_spec.md'], task: 'docs/tasks/active/2026-09-22-island-nature-integration.md', code: ['src/domain/islandLife/foodLoop.ts', 'src/components/island/life/IslandLife.tsx', 'src/components/island/life/residentMotion.ts'] },
  { area: '自然と町を育てる', name: '水ばち・木陰で鉢の育ちが変わる', status: '一部実装', done: '今の島で水ばち・育った木の近さから土の水分と木陰を計算し、鉢の育つ速さが変わる。', next: '実機で湿った土と鉢の変化が伝わるか確認する。', stages: ['局所ルールを採用', '鉢の成長へ接続', '計算テストを確認', '実機・利用者待ち'], specs: ['docs/product/48_island_life_spec.md', 'docs/product/island-nature-integration.md'], task: 'docs/tasks/active/2026-09-22-island-nature-integration.md', code: ['src/domain/islandLife/foodLoop.ts', 'src/domain/islandLife/soilMoisture.ts'] },
  { area: '自然と町を育てる', name: 'みずみちをつなぐ', status: '一部実装', done: '今の島に1マス2しずくの「みずみち」を追加。水ばちから辺でつながる最大8マスが青くなり、遠くの土へ水が届く。切断・再接続は保存後も再現。', next: '実機の絵の魅力と子どもの理解を確認する。', stages: ['仕様を採用', '現行の島に水路を実装', '計算・保存を確認', '実機・利用者待ち'], specs: ['docs/product/48_island_life_spec.md', 'docs/product/island-nature-integration.md'], task: 'docs/tasks/active/2026-09-22-island-nature-integration.md', code: ['src/domain/islandLife/waterChannels.ts', 'src/components/island/life/IslandLife.tsx', 'src/components/island/life/decorationGeometry.ts'] },
  { area: '自然と町を育てる', name: '土がゆっくり湿り、乾く', status: '一部実装', done: '通水後は時間をかけて土が湿り、切断後もゆっくり乾く。鉢の育ちと地面の淡い色、持ち物の説明に反映する。', next: '更新・オフラインは確認済み。子どもが見ただけで分かるかを確認する。固定地形水源は未接続。', stages: ['仕様を採用', '今の島に実装', '計算・保存・ローカル画面を確認', '実機・利用者待ち'], specs: ['docs/product/48_island_life_spec.md', 'docs/product/13_data_storage_migration_spec.md'], task: 'docs/tasks/active/2026-09-22-island-nature-integration.md', code: ['src/domain/islandLife/soilMoisture.ts', 'src/components/island/life/landscape.ts', 'src/components/island/life/IslandLife.tsx'] },
  { area: '自然と町を育てる', name: '来訪・入居・土地拡張', status: '今の島へ実装', done: '好きな場所や共同食から来訪を知らせ、本人の招待で仲間と暮らす。既存3住人と土地を保持し、土地12/24/48の購入へ接続。', next: '実機・子どもの理解と固定地形水源、次期の二つの時計を検討する。', stages: ['仕様48/51へ反映', '保存21で実装', '実購入・招待・再開を確認', '実機・利用者待ち'], specs: ['docs/product/island-nature-integration.md', 'docs/product/48_island_life_spec.md'], task: 'docs/tasks/active/2026-09-22-island-nature-integration.md', code: ['src/domain/islandLife/residency.ts', 'src/components/island/life/LifeCommunity.tsx'] },
  { area: '見た目・使いやすさ', name: '共通画面と行き来', status: '基本改善済み', done: '入口・戻る・小さい画面・読み上げ用の基本対応を改善した。', next: '実機の操作、実際の読み上げ、子どもの無説明利用を確認する。', stages: ['確定', '基本改善済み', '自動確認済み', '実機・利用者待ち'], specs: ['docs/product/43_island_navigation_spec.md', 'docs/product/44_display_layout_spec.md'], task: 'docs/tasks/active/2026-09-20-whole-app-ux-coherence.md', code: ['src/domain/island/navigation.ts'] },
  { area: '記録・保存', name: '写真と保存', status: '実Safari待ち', done: '保存機能は実装済み。保存付きブラウザでは成功を確認した。', next: 'iPhone/iPadのSafariかホーム画面版で撮影・保存・再読込する。', stages: ['確定', '実装済み', 'ブラウザ差あり', '実Safari待ち'], specs: ['docs/product/13_data_storage_migration_spec.md'], task: '.agents/tasks/BLOCKED.md', code: ['src/domain/island/photosRepository.ts'] },
];
const otherModes = [
  { name: 'ぴったり連鎖', state: '終了', detail: '開発用の独立試作。入口とコードを撤去し、仕様・検証記録だけを保管。', file: 'docs/product/archive/27_gameplay_first_pittari_spec.md' },
  { name: '旧遊園地', state: '公開終了', detail: '入口は島へ戻す。過去の作品と保存契約を守る。', file: 'docs/product/22_shared_subject_build_and_play_spec.md' },
  { name: '旧探索', state: '直接URLのみ', detail: '島の入口から撤去。/explore の画面と保存データは残す。島の完成度には含めない。', file: 'docs/product/10_exploration_game_spec.md' },
  { name: '2人遊び', state: '直接URLのみ', detail: '島の入口から撤去。/battle と /battle/play の画面と保存データは残す。', file: 'docs/product/09_battle_spec.md' },
  { name: '家から店への接続試作', state: '開発環境だけ', detail: 'ローカルの開発サーバーで専用設定を付けたときだけ動く模型。普段遊ぶ島の家や公開版には出ない。', file: 'docs/product/45_home_journey_preview_spec.md' },
  { name: '旧Nature Town画面', state: '開発用のみ', detail: '独立した町は仕上げず、自然・運搬の仕組みを今の島へ取り込む。', file: 'docs/product/island-nature-integration.md' },
];
const formatSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;
const fileSize = file => fs.statSync(path.join(root, file)).size;
const walkFiles = dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? walkFiles(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []) : [];
const assetFiles = ['assets', 'public/assets', 'src/assets'].flatMap(walkFiles).filter(file => /\.(?:png|jpe?g|webp|avif|svg|glb|gltf|mp3|wav|ogg|mp4|webm|pdf)$/i.test(file));
const assetGroups = Object.entries(Object.groupBy(assetFiles, file => file.split('/').slice(0, file.startsWith('public/') || file.startsWith('src/') ? 3 : 2).join('/'))).map(([folder, files]) => ({ folder, files, bytes: files.reduce((sum, file) => sum + fileSize(file), 0) })).sort((a, b) => b.bytes - a.bytes || a.folder.localeCompare(b.folder));
const evidenceFiles = walkFiles('docs/design').filter(file => /\.(?:png|jpe?g|webp|avif|svg|glb|gltf|mp3|wav|ogg|mp4|webm|pdf|zip)$/i.test(file));
const evidenceGroups = Object.entries(Object.groupBy(evidenceFiles, file => file.split('/').slice(0, file.startsWith('docs/design/audits/') ? 4 : 3).join('/'))).map(([folder, files]) => ({ folder, files, bytes: files.reduce((sum, file) => sum + fileSize(file), 0) })).sort((a, b) => (b.folder.match(/20\d{2}-\d{2}-\d{2}/)?.[0] || '').localeCompare(a.folder.match(/20\d{2}-\d{2}-\d{2}/)?.[0] || '') || a.folder.localeCompare(b.folder));
const specIndex = [...read('docs/product/README.md').matchAll(/^\| \[([^\]]+)\]\(([^)]+\.md)\) \| ([^|]+) \| ([^|]+) \|$/gm)].map(([, name, relativeFile, description, position]) => ({ name, file: `docs/product/${relativeFile}`, description, position })).filter(item => fs.existsSync(path.join(root, item.file)));
const pastSpec = item => /\/((?:08|09|10|11|14|15|16|17|18|19|22|27)_[^/]+)\.md$/.test(item.file);
const plannedSpec = item => !pastSpec(item) && (/次期案|提案|未決|開発版/.test(item.position) || /\/45_[^/]+\.md$/.test(item.file));
const adoptedSpec = item => !pastSpec(item) && !plannedSpec(item) && /採用済み/.test(item.position);
const currentSpecs = specIndex.filter(item => !pastSpec(item) && !plannedSpec(item) && !adoptedSpec(item));
const adoptedSpecs = specIndex.filter(adoptedSpec);
const plannedSpecs = specIndex.filter(plannedSpec);
const pastSpecs = specIndex.filter(pastSpec);
const pastAsset = group => group.folder.startsWith('public/assets/explore') || group.folder.startsWith('src/assets/natureTown');
const assetNames = { bench: 'ベンチ', bridge: '橋', cart: '荷車', fence: '柵', flowerbed: '花壇', 'garden-hut': '庭の小屋', mailbox: '郵便箱', planter: '植木鉢', rock: '岩', signpost: '案内板', 'stepping-stones': '飛び石', streetlamp: '街灯', toolbox: '工具箱', tree: '木', 'watering-can': 'じょうろ' };
const assetGroupName = folder => folder.startsWith('assets/island-') ? `${assetNames[folder.slice('assets/island-'.length).replace(/-v\d+$/, '')] || '島の素材'}の候補` : ({ 'assets/final': '選んだ候補', 'assets/meshy_raw': '生成直後の元データ', 'assets/pipeline': '制作パイプライン', 'assets/source': '参考元データ', 'public/assets/explore': '旧探索の配信素材', 'src/assets/natureTown': '旧Nature Townの素材' })[folder] || folder;
const fileLink = (output, file, label = path.basename(file)) => `<a href="${href(output, file)}">${esc(label)}</a>`;
const imageFile = file => /\.(?:png|jpe?g|webp|avif|svg)$/i.test(file);
const dimensionCache = new Map();
function imageDimensions(file) {
  if (dimensionCache.has(file)) return dimensionCache.get(file);
  let value = '';
  if (/\.(?:png|jpe?g|webp)$/i.test(file)) {
    const fd = fs.openSync(path.join(root, file), 'r');
    const buffer = Buffer.alloc(Math.min(fileSize(file), 65536));
    try { fs.readSync(fd, buffer, 0, buffer.length, 0); } finally { fs.closeSync(fd); }
    let width = 0, height = 0;
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.length >= 24) {
      width = buffer.readUInt32BE(16); height = buffer.readUInt32BE(20);
    } else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const kind = buffer.toString('ascii', 12, 16);
      if (kind === 'VP8 ' && buffer.length >= 30) { width = buffer.readUInt16LE(26) & 0x3fff; height = buffer.readUInt16LE(28) & 0x3fff; }
      if (kind === 'VP8X' && buffer.length >= 30) { width = buffer.readUIntLE(24, 3) + 1; height = buffer.readUIntLE(27, 3) + 1; }
      if (kind === 'VP8L' && buffer.length >= 25) { const bits = buffer.readUInt32LE(21); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; }
    } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      for (let offset = 2; offset + 9 < buffer.length;) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        const marker = buffer[offset + 1], length = buffer.readUInt16BE(offset + 2);
        if (length < 2) break;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) { height = buffer.readUInt16BE(offset + 5); width = buffer.readUInt16BE(offset + 7); break; }
        offset += length + 2;
      }
    }
    if (width > 0 && height > 0) value = `${width}×${height} px`;
  }
  dimensionCache.set(file, value);
  return value;
}
const assetItem = (output, folder, file, bytes, preview = true, label = path.relative(folder, file)) => `<div class="asset-item">${preview && imageFile(file) ? `<a class="asset-thumb" href="${href(output, file)}" aria-label="${esc(label)} を開く"><img src="${href(output, file)}" alt="" loading="lazy" decoding="async"></a>` : `<span class="asset-thumb asset-placeholder" aria-hidden="true">${esc(path.extname(file).slice(1).toUpperCase() || 'FILE')}</span>`}<span class="asset-name">${fileLink(output, file, label)}</span><span class="asset-size">${formatSize(bytes)}${imageDimensions(file) ? `<small>${imageDimensions(file)}</small>` : ''}</span></div>`;
function renderMap(output) {
  const stageNames = ['方針', '通常のアプリ', '確認できた範囲', '実機・利用者'];
  const stageTone = value => /未|待ち|差あり|別の町画面/.test(value) ? 'waiting' : /一部|局所|基本|開発版/.test(value) ? 'partial' : 'done';
  const bands = [
    { label: '現行で使える', count: mapEntries.filter(item => ['現行で利用', '家庭内で利用', '公開版にある'].includes(item.status)).length },
    { label: '一部実装・基本改善', count: mapEntries.filter(item => ['一部実装', '基本改善済み'].includes(item.status)).length },
    { label: '今の島にはない', count: mapEntries.filter(item => item.status === '今の島にはない').length },
    { label: '実機確認待ち', count: mapEntries.filter(item => item.status === '実Safari待ち').length },
  ];
  const rows = mapEntries.map(item => {
    const sources = item.specs.map(file => fileLink(output, file, path.basename(file).replace(/_spec\.md$/, '').replace(/\.md$/, ''))).join(' · ');
    const code = item.code.filter(file => fs.existsSync(path.join(root, file))).map(file => `${fileLink(output, file)} <small>${formatSize(fileSize(file))}</small>`).join('<br>');
    const task = item.task ? `<br><span class="path">現在地: ${fileLink(output, item.task, path.basename(item.task))}</span>` : '';
    const progress = item.stages.map((value, index) => `<li class="stage stage-${stageTone(value)}"><span>${stageNames[index]}</span><strong>${esc(value)}</strong></li>`).join('');
    return `<article class="map-row card" data-search="${esc(`${item.area} ${item.name} ${item.status} ${item.done} ${item.next} ${item.stages.join(' ')} ${item.specs.join(' ')} ${item.code.join(' ')}`.toLowerCase())}"><div class="map-heading"><div><span class="badge">${esc(item.area)}</span><h2>${esc(item.name)}</h2></div><span class="status">${esc(item.status)}</span></div><div class="map-summary"><p><strong>今の状態</strong>${esc(item.done)}</p><p><strong>次にすること</strong>${esc(item.next)}</p></div><ol class="progress-track" aria-label="${esc(item.name)}の進行状況">${progress}</ol><details class="map-sources"><summary>仕様書・作業記録・コードを見る</summary><div><section><h3>仕様と現在地</h3><p>${sources}${task}</p></section><section><h3>${item.status === '今の島にはない' ? '別の試作のコード（今の島には未統合）' : '今のアプリのコード'}</h3><p>${code || '—'}</p></section></div></details></article>`;
  }).join('');
  const renderAssetGroup = group => {
    const previews = group.files.filter(imageFile).slice(0, 4);
    const remaining = group.files.filter(file => !previews.includes(file));
    return `<details class="asset-group card" data-search="${esc(`${assetGroupName(group.folder)} ${group.folder} ${group.files.join(' ')}`.toLowerCase())}"><summary>${previews[0] ? `<img class="group-thumb" src="${href(output, previews[0])}" alt="" loading="lazy" decoding="async">` : '<span class="group-thumb asset-placeholder" aria-hidden="true">FILE</span>'}<span class="group-name"><strong>${esc(assetGroupName(group.folder))}</strong><small>${esc(group.folder)}</small></span><span>${group.files.length}点 · ${formatSize(group.bytes)}</span></summary><div class="asset-list"><p class="asset-note">代表画像${previews.length}点。クリックで原寸を開けます。</p>${previews.map(file => assetItem(output, group.folder, file, fileSize(file))).join('')}${remaining.length ? `<details class="asset-full-list"><summary>残り${remaining.length}ファイルと容量</summary>${remaining.map(file => assetItem(output, group.folder, file, fileSize(file), false)).join('')}</details>` : ''}</div></details>`;
  };
  const currentAssetGroups = assetGroups.filter(group => !pastAsset(group));
  const candidateGroups = currentAssetGroups.filter(group => group.folder.startsWith('assets/island-'));
  const sourceGroups = currentAssetGroups.filter(group => !group.folder.startsWith('assets/island-'));
  const groups = `<h3 class="group-title">島の素材候補 <small>${candidateGroups.length}フォルダ</small></h3><section class="asset-groups">${candidateGroups.map(renderAssetGroup).join('')}</section><h3 class="group-title">元データ・制作工程 <small>${sourceGroups.length}フォルダ</small></h3><section class="asset-groups">${sourceGroups.map(renderAssetGroup).join('')}</section>`;
  const pastGroups = assetGroups.filter(pastAsset).map(renderAssetGroup).join('');
  const evidence = evidenceGroups.map(group => {
    const currentFoodLoop = group.folder === 'docs/design/2026-09-27-island-food-loop';
    if (currentFoodLoop) {
      const captures = group.files.filter(imageFile).sort((a, b) => a.localeCompare(b, 'ja'));
      const readme = `${group.folder}/README.md`;
      const label = file => `${path.basename(file).startsWith('390') ? 'スマホ' : 'タブレット'}・${path.basename(file).includes('carrying') ? '運ぶ' : path.basename(file).includes('delivered') ? '届く' : '食べた後のようす'}`;
      return `<details class="asset-group card" data-search="${esc(`今の島 食料 収穫 運搬 食卓 ${group.folder} ${captures.join(' ')}`.toLowerCase())}"><summary><img class="group-thumb" src="${href(output, captures[0])}" alt="" loading="lazy"><strong>今の島の食料の一周</strong><span>${captures.length}枚 · ${formatSize(group.bytes)}</span></summary><div class="asset-list"><p class="asset-note">現行の島をローカルで動かした記録。スマホ・タブレットの「運ぶ→届く→食べた」。実機と子どもの理解は未確認。${fileLink(output, readme, '記録と確認条件を見る')}</p><div class="evidence-gallery">${captures.map(file => assetItem(output, group.folder, file, fileSize(file), true, label(file))).join('')}</div></div></details>`;
    }
    if (group.folder === 'docs/design/2026-09-27-island-water-channel') {
      const captures = group.files.filter(imageFile).sort((a, b) => a.localeCompare(b, 'ja'));
      const label = file => `${path.basename(file).startsWith('390') ? 'スマホ' : 'タブレット'}・${path.basename(file).includes('catalog') ? 'みずみちの商品' : path.basename(file).includes('disconnected') ? '切れている' : path.basename(file).includes('reconnected') ? 'つなぎ直した' : path.basename(file).includes('summary') ? '文字のようす' : '水が通る'}`;
      return `<details class="asset-group card" data-search="${esc(`今の島 水路 みずみち 商品 通水 切断 再接続 ${group.folder} ${captures.join(' ')}`.toLowerCase())}"><summary><img class="group-thumb" src="${href(output, captures.find(file => file.includes('connected')) ?? captures[0])}" alt="" loading="lazy"><strong>今の島のみずみち</strong><span>${captures.length}枚 · ${formatSize(group.bytes)}</span></summary><div class="asset-list"><p class="asset-note">現行の島をローカルで動かした記録。スマホ・タブレットの「商品→つながる→切れる→戻す」。実機と子どもの理解は未確認。${fileLink(output, `${group.folder}/README.md`, '記録と確認条件を見る')}</p><div class="evidence-gallery">${captures.map(file => assetItem(output, group.folder, file, fileSize(file), true, label(file))).join('')}</div></div></details>`;
    }
    if (group.folder === 'docs/design/2026-09-27-island-soil-moisture') {
      const captures = group.files.filter(imageFile).sort((a, b) => a.localeCompare(b, 'ja'));
      const label = file => `${path.basename(file).startsWith('390') ? 'スマホ' : 'タブレット'}・${path.basename(file).includes('soil-rewet') ? 'また湿る' : path.basename(file).includes('soil-wet') ? '時間がたって湿る' : path.basename(file).includes('soil-dry') ? '時間がたって乾く' : path.basename(file).includes('disconnected') ? '水路が切れた直後' : path.basename(file).includes('reconnected') ? 'つなぎ直した直後' : path.basename(file).includes('catalog') ? 'みずみちの商品' : path.basename(file).includes('summary') ? '文字のようす' : '水路をつないだ直後'}`;
      return `<details class="asset-group card" data-search="${esc(`今の島 土 水分 湿る 乾く 時間 水路 ${group.folder} ${captures.join(' ')}`.toLowerCase())}"><summary><img class="group-thumb" src="${href(output, captures.find(file => file.includes('soil-wet')) ?? captures[0])}" alt="" loading="lazy"><strong>今の島の土が湿り、乾く</strong><span>${captures.length}枚 · ${formatSize(group.bytes)}</span></summary><div class="asset-list"><p class="asset-note">現行の島をローカルで動かした記録。スマホ・タブレットの接続直後→6時間後→切断→乾燥→再接続。DEVの診断時計を使用し、実機と子どもの理解は未確認。${fileLink(output, `${group.folder}/README.md`, '記録と確認条件を見る')}</p><div class="evidence-gallery">${captures.map(file => assetItem(output, group.folder, file, fileSize(file), true, label(file))).join('')}</div></div></details>`;
    }
    const largest = group.files.map(file => ({ file, bytes: fileSize(file) })).sort((a, b) => b.bytes - a.bytes).slice(0, 3);
    const firstImage = largest.find(item => imageFile(item.file));
    return `<details class="asset-group card" data-search="${esc(`${group.folder} ${largest.map(item => item.file).join(' ')}`.toLowerCase())}"><summary><strong>${esc(group.folder)}</strong><span>${group.files.length}点 · ${formatSize(group.bytes)}</span></summary><div class="asset-list"><p class="asset-note">容量の大きい3件。過去の検証記録で、現行画面の完成を示すものではありません。</p>${largest.map(({ file, bytes }) => assetItem(output, group.folder, file, bytes, file === firstImage?.file)).join('')}${group.files.length > largest.length ? `<p class="path">残り${group.files.length - largest.length}件は記録フォルダを参照。</p>` : ''}</div></details>`;
  }).join('');
  const generated = pages.filter(([file]) => file !== output).map(([file, label]) => `<li>${fileLink(output, file, label)} <span class="path">${formatSize(fileSize(file))}</span></li>`).join('');
  const renderSpec = item => `<article class="spec-row card" data-search="${esc(`${item.name} ${item.file} ${item.description} ${item.position}`.toLowerCase())}"><div>${fileLink(output, item.file, item.name)}<p>${esc(item.description)}</p></div><div><span class="status">${esc(item.position)}</span><span class="path">${formatSize(fileSize(item.file))}</span></div></article>`;
  const specs = currentSpecs.map(renderSpec).join('');
  const adopted = adoptedSpecs.map(renderSpec).join('');
  const planned = plannedSpecs.map(renderSpec).join('');
  const oldSpecs = pastSpecs.map(renderSpec).join('');
  const specSections = `<h3 class="group-title">現在のルール <small>${currentSpecs.length}件</small></h3><section class="spec-list">${specs}</section><h3 class="group-title">採用済み・実装を確認するもの <small>${adoptedSpecs.length}件</small></h3><section class="spec-list">${adopted}</section><h3 class="group-title">開発用・次期案 <small>${plannedSpecs.length}件</small></h3><section class="spec-list">${planned}</section>`;
  const modeRows = otherModes.map(mode => `<div class="mode-row" data-search="${esc(`${mode.name} ${mode.state} ${mode.detail}`.toLowerCase())}"><strong>${esc(mode.name)}</strong><span class="status">${esc(mode.state)}</span><p>${esc(mode.detail)}</p>${fileLink(output, mode.file, '判断の根拠')}</div>`).join('');
  const currentAssetFiles = currentAssetGroups.flatMap(group => group.files);
  return `<section class="intro" id="overview"><p class="eyebrow">ぽこもこと不思議な島</p><h2>どこまで進んだ？</h2><p>主な${mapEntries.length}項目を「今使える」「途中」「これから」に分けました。数字は掲載項目の件数で、アプリ全体の完成率ではありません。</p><div class="progress-overview" aria-label="掲載項目の進行状況">${bands.map(band => `<div><strong>${band.count}</strong><span>${esc(band.label)}</span></div>`).join('')}</div><p class="map-help">「今の島」は通常起動で遊べる画面、「別の試作」は専用の開発設定でだけ動く実験です。旧試作の画面が動いても、今の島にその遊びが入ったことにはなりません。</p></section><nav class="map-jumps" aria-label="このページの目次"><a href="#overview">全体</a><a href="#progress">進み具合</a><a href="#specs">仕様の分類</a><a href="#assets">画像と容量</a><a href="#legacy">旧モード</a><a href="#evidence">検証記録</a></nav><h2 class="section-title" id="progress">島と学習の進み具合</h2><section class="map-list">${rows}</section><h2 class="section-title" id="specs">仕様書を役割で探す</h2><p><a href="${href(output, 'docs/product/README.md')}">仕様書の地図</a>に載る現行・採用済み仕様です。仕様があるだけで完成したことにはなりません。「採用済み」は実装済みと同じ意味ではありません。</p>${specSections}<h2 class="section-title" id="assets">画像・生成素材と容量</h2><p>${currentAssetFiles.length}ファイル・合計${formatSize(currentAssetFiles.reduce((sum, file) => sum + fileSize(file), 0))}。制作中の元画像や3Dも含むため、アプリの容量ではありません。画像は縦横ピクセル数も表示します。</p>${groups}<details class="archive-section" id="legacy"><summary>今の島とは別の遊び・試作を見る</summary><p>今の島の進捗には含めません。現時点の扱いを示します。</p><div class="mode-list">${modeRows}</div><h3>関連する仕様・昔の案</h3><section class="spec-list">${oldSpecs}</section><h3>旧探索・旧町の素材</h3><section class="asset-groups">${pastGroups}</section></details><details class="archive-section" id="evidence"><summary>制作・検証で作った画像や記録を見る</summary><p>${evidenceFiles.length}ファイル。過去の比較や検証を含み、現在版の完成を意味しません。今の島の食料・水路・土の記録は各画面幅の全画像を表示し、その他はフォルダごとに容量の大きい3件を表示します。</p><section class="asset-groups">${evidence}</section></details><h2 class="section-title">このポータルのHTML</h2><p>Markdownから作った閲覧用ページです。</p><ul>${generated}</ul>`;
}
const queue = (() => {
  let category = 'その他';
  const items = [];
  for (const line of read('.agents/tasks/TASKS.md').split('\n')) {
    const heading = line.match(/^### (.+)$/);
    if (heading) category = heading[1];
    const tableItem = line.match(/^\| ([^|]+?) \| \[(.+?)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\) \| ([^|]+?) \| ([^|]+?) \|$/);
    const linkedItem = line.match(/^- \[(.+?)\]\(\.\.\/\.\.\/(docs\/tasks\/active\/[^\s)]+\.md)\)：(.+)$/);
    const legacyItem = line.match(/^- (.+?) -> (docs\/tasks\/active\/[^\s`]+\.md)\s*$/);
    if (tableItem) items.push({ name: `${tableItem[2]}：${tableItem[4]} 次：${tableItem[5]}`, file: tableItem[3], category: tableItem[1].trim() });
    else if (linkedItem) items.push({ name: `${linkedItem[1]}：${linkedItem[3]}`, file: linkedItem[2], category });
    else if (legacyItem) items.push({ name: legacyItem[1], file: legacyItem[2], category });
  }
  return items;
})();
const docs = walk('docs');
const docGroups = [
  {
    label: 'はじめに',
    description: '仕様・タスク・共有知識の入口。何を探すか迷ったときはここから。',
    matches: file => ['docs/index.md', 'docs/product/island-nature-integration.md', 'docs/product/README.md', 'docs/tasks/README.md', 'docs/wiki/index.md'].includes(file),
  },
  {
    label: '自然と町の仕組みの再利用資料',
    description: '旧Nature Townで検証した計算と操作。別の町として仕上げず、統合方針に従って今の島へ取り込む。',
    matches: file => file.startsWith('docs/product/nature-town/'),
  },
  {
    label: '仕様（何を作るか）',
    description: '製品、学習、画面、島、別モードのルール。現行・旧モード・試作の区別は「仕様書の地図」を参照。',
    matches: file => file.startsWith('docs/product/') && !file.startsWith('docs/product/archive/'),
  },
  {
    label: 'タスク（今何をするか）',
    description: '実行中の詳細、次の候補、過去のタスク資料。現在地は「現在のタスク一覧」を優先。',
    matches: file => file.startsWith('docs/tasks/') && !file.startsWith('docs/tasks/archive/'),
  },
  {
    label: '設計・実画面・検証記録',
    description: '特定の版や画面で確認した証拠。現行仕様や現在のタスクの代わりにはしない。',
    matches: file => file.startsWith('docs/design/'),
  },
  {
    label: '開発と検証のルール',
    description: '検証方針、共同作業、リリース、保存移行などの手順。',
    matches: file => file.startsWith('docs/ai/') || file.startsWith('docs/runbooks/'),
  },
  {
    label: '共有知識と設計判断',
    description: '複数の仕事で長く使う用語、リスク、分析、設計判断。',
    matches: file => file.startsWith('docs/wiki/') || file.startsWith('docs/adr/'),
  },
  {
    label: '過去の案・試作',
    description: '現在の作業から退避した資料。削除ではなく履歴の保管。今の仕様や開発指示として読まない。',
    matches: file => file.startsWith('docs/product/archive/') || file.startsWith('docs/tasks/archive/'),
  },
  {
    label: '完了履歴',
    description: '過去に完了した事実。現在の挙動は仕様書で確認する。',
    matches: file => file.startsWith('docs/done/'),
  },
];
function card(output, file, name = title(file), expanded = false) {
  const text = read(file);
  const excerpt = text.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').filter(l => l.trim() && !/^(#|\||```)/.test(l)).slice(0, 2).join(' ').slice(0, 210);
  return `<article class="card" data-search="${esc(`${name} ${file} ${expanded ? text : excerpt}`.toLowerCase())}"><h2><a href="${href(output, file)}">${esc(name)}</a></h2><p class="path">${esc(file)}</p><p>${esc(excerpt)}</p>${expanded ? `<details><summary>詳細を読む</summary><pre>${esc(text)}</pre></details>` : ''}</article>`;
}
function render([output, label]) {
  let content;
  if (label === '概要') {
    content = `<section class="intro"><p class="eyebrow">REPOSITORY OVERVIEW</p><h2>ぽこもこと不思議な島</h2><p>子どもがくり返し遊びたくなる、算数・英語の学習PWA。学習と島の暮らしをつなぎ、学習記録は端末内に保存します。</p><div class="stats"><span><strong>${queue.length}</strong> 実行キュー</span><span><strong>${docs.length}</strong> ドキュメント</span><span>React 19 / TypeScript / Vite / Dexie</span></div></section><h2 class="section-title">人向けの入口</h2><section class="grid">${['docs/index.md', 'docs/product/README.md', '.agents/tasks/TASKS.md', 'docs/tasks/backlog.md'].map(f => card(output, f)).join('')}</section><h2 class="section-title">開発ルールの入口</h2><section class="grid">${['CONSTITUTION.md', 'docs/product/01_app_spec.md', '.agents/agent-guide.md', 'docs/ai/verification_matrix.md', 'docs/ai/ownership_map.md'].map(f => card(output, f)).join('')}</section><section class="intro"><h2>ローカルで使う</h2><p>アプリの起動</p><pre>nvm use\nnpm ci\nnpm run dev</pre><p>このHTMLを更新 / 更新漏れを確認</p><pre>npm run agent:index\nnpm run agent:index:check</pre><p>HTMLは閲覧用の生成物です。内容を変えるときは元のMarkdownを編集して再生成してください。</p></section>`;
  } else if (label === 'タスク') {
    const categories = [...new Set(queue.map(item => item.category))];
    content = `<p>実行キューに登録された ${queue.length} 件。「何の話か／現在地／次の一手」で分類しています。登録は実装済み・公開済みを意味しません。</p>${categories.map(category => `<section class="doc-group"><h2 class="section-title">${esc(category)}</h2><div class="grid">${queue.filter(item => item.category === category).map(item => card(output, item.file, item.name, true)).join('')}</div></section>`).join('')}<h2 class="section-title">保留・計画・完了記録</h2><section class="grid">${['.agents/tasks/BLOCKED.md', 'docs/tasks/backlog.md', '.agents/tasks/DONE.md'].map(f => card(output, f, title(f), true)).join('')}</section>`;
  } else if (label === '仕様と実装') {
    content = renderMap(output);
  } else {
    const assigned = new Set();
    const sections = docGroups.map(group => {
      const files = docs.filter(file => !assigned.has(file) && group.matches(file));
      files.forEach(file => assigned.add(file));
      return { ...group, files };
    });
    const remaining = docs.filter(file => !assigned.has(file));
    if (remaining.length) sections.push({ label: 'その他', description: '上の分類に含まれない補助文書。', files: remaining });
    content = sections.filter(section => section.files.length).map(section => `<section class="doc-group"><h2 class="section-title">${esc(section.label)}</h2><p>${esc(section.description)}</p><div class="grid">${section.files.map(file => card(output, file)).join('')}</div></section>`).join('');
  }
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="generator" content="tools/generate-agent-index.mjs"><title>Sansu · ${label}</title><style>
:root{color-scheme:light;--ink:#213b35;--muted:#61736c;--line:#d8e1d9;--paper:#fffef9;--accent:#28634f}*{box-sizing:border-box}body{margin:0;background:#f3f5ef;color:var(--ink);font:15px/1.75 system-ui,-apple-system,sans-serif}a{color:var(--accent);text-underline-offset:4px}header{background:var(--paper);border-bottom:1px solid var(--line)}nav,main{max-width:1180px;margin:auto;padding:20px 28px}nav{display:flex;align-items:center;gap:24px;flex-wrap:wrap}nav strong{margin-right:auto;letter-spacing:.12em}nav a{text-decoration:none;padding:6px 2px}nav a[aria-current]{border-bottom:2px solid var(--accent);font-weight:700}main{padding-top:42px;padding-bottom:70px}h1{font-size:clamp(28px,5vw,44px);letter-spacing:-.035em;margin:0}h2{font-size:18px;line-height:1.5;margin:0 0 10px}p{margin:10px 0}.subtitle,.path,footer{color:var(--muted)}.eyebrow{font-size:12px;letter-spacing:.16em}.intro{padding:28px;background:#e7eee4;border:1px solid var(--line);border-radius:14px;margin:28px 0}.intro h2{font-size:26px}.stats{display:flex;flex-wrap:wrap;gap:24px;margin-top:22px}.stats strong{font-size:30px;margin-right:5px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:22px;overflow-wrap:anywhere}.path{font:12px/1.6 ui-monospace,monospace}.section-title{margin:32px 0 16px}label{display:block;font-weight:600;margin-top:24px}input{width:100%;font:inherit;padding:13px 16px;border:1px solid #93aa9b;border-radius:8px;background:var(--paper);margin:8px 0 24px;color:var(--ink)}summary{cursor:pointer;color:var(--accent);padding:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 ui-monospace,monospace;background:#f0f3ed;padding:16px;border-radius:8px;max-height:560px;overflow:auto}.map-list,.asset-groups,.spec-list{display:grid;gap:12px}.map-row{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr);gap:24px}.map-row h2{margin:8px 0 4px}.map-row h3{font-size:12px;letter-spacing:.08em;color:var(--muted);margin:0}.map-row p{margin:4px 0}.map-row small{color:var(--muted);white-space:nowrap}.spec-row{display:flex;justify-content:space-between;gap:20px;padding:12px 20px}.spec-row p{margin:0;color:var(--muted)}.spec-row>div:last-child{text-align:right;min-width:160px}.badge,.status{font-size:12px;padding:3px 9px;border-radius:99px;background:#e7eee4;margin-right:6px}.status{background:#fff1ce}.asset-group{padding:12px 20px}.asset-group summary{display:flex;justify-content:space-between;gap:16px;align-items:center}.asset-group summary span,.asset-list span{color:var(--muted);white-space:nowrap}.asset-list{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}.asset-list>div{display:flex;justify-content:space-between;gap:16px;padding:3px 0;border-bottom:1px solid #edf0e9}.asset-list a{overflow-wrap:anywhere}footer{margin-top:40px;font-size:13px}[hidden]{display:none!important}:focus-visible{outline:3px solid #b27523;outline-offset:4px}@media(max-width:760px){.map-row{grid-template-columns:1fr}.spec-row{display:block}.spec-row>div:last-child{text-align:left;min-width:0;margin-top:8px}.asset-group summary,.asset-list>div{align-items:flex-start}.asset-group summary span{font-size:12px}}@media(max-width:640px){nav,main{padding-left:18px;padding-right:18px}nav{gap:16px}.grid{grid-template-columns:1fr}.intro{padding:20px}.card{padding:18px}}
.asset-item{display:grid!important;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:12px;padding:7px 0!important}.asset-thumb{display:flex;align-items:center;justify-content:center;width:64px;height:54px;border-radius:6px;background:#edf0e9;overflow:hidden;text-decoration:none}.asset-thumb img{width:100%;height:100%;object-fit:contain}.asset-placeholder{font:10px ui-monospace,monospace;color:var(--muted);letter-spacing:.08em}.asset-name{min-width:0;white-space:normal!important}.asset-size{white-space:nowrap}@media(max-width:640px){.asset-item{grid-template-columns:52px minmax(0,1fr);gap:10px}.asset-thumb{width:52px;height:48px}.asset-size{grid-column:2;justify-self:start;font-size:12px}}
.progress-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:22px 0}.progress-overview>div{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.progress-overview strong{display:block;font-size:30px;line-height:1.2}.progress-overview span{font-size:13px}.map-help{font-size:13px;color:var(--muted)}.map-row{display:block}.map-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.map-heading h2{font-size:22px;margin:5px 0 10px}.map-heading .status{white-space:nowrap;font-weight:700}.map-summary{display:grid;grid-template-columns:1fr 1fr;gap:14px}.map-summary p{margin:0;padding:12px 14px;border-radius:9px;background:#f4f6f0}.map-summary strong{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}.progress-track{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;list-style:none;margin:16px 0 0;padding:0}.stage{padding:10px;border-radius:8px;background:#eef2e9;border:1px solid #d9e2d5}.stage span{display:block;font-size:11px;line-height:1.3;color:var(--muted)}.stage strong{display:block;font-size:12px;line-height:1.4;margin-top:4px}.stage-partial{background:#fff4dc;border-color:#ecdcb7}.stage-waiting{background:#f4f3f0;border-color:#e0ded8}.map-sources{border-top:1px solid var(--line);margin-top:16px}.map-sources>div{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding-top:8px}.map-sources h3{margin:0;font-size:12px}.archive-section{margin:32px 0;padding:20px;background:#e9ece7;border:1px solid var(--line);border-radius:12px}.archive-section>summary{font-size:18px;font-weight:700}.archive-section h3{margin-top:25px}.archive-section .asset-groups{margin-top:14px}@media(max-width:760px){.progress-overview,.progress-track{grid-template-columns:repeat(2,minmax(0,1fr))}.map-summary,.map-sources>div{grid-template-columns:1fr}.map-heading{display:block}.map-heading .status{display:inline-block;margin-bottom:10px}}@media(max-width:400px){.progress-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.progress-track{gap:5px}.stage{padding:8px}}
.mode-list{display:grid;gap:10px}.mode-row{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:15px}.mode-row>strong{font-size:17px;margin-right:10px}.mode-row p{margin:5px 0}.mode-row a{font-size:13px}
.map-jumps{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:20px 0 28px}.map-jumps a{display:inline-block;padding:8px 12px;background:var(--paper);border:1px solid var(--line);border-radius:99px;text-decoration:none;font-weight:700;font-size:13px}.map-jumps a:hover{background:#e7eee4}.group-title{font-size:17px;margin:26px 0 10px}.group-title small{font-size:12px;font-weight:500;color:var(--muted);margin-left:6px}.asset-note{font-size:12px;color:var(--muted)}.asset-full-list{border-top:1px solid var(--line);margin-top:12px}.asset-full-list>summary{font-weight:700}.asset-full-list .asset-item{font-size:13px}.asset-full-list .asset-thumb{width:46px;height:38px}.asset-full-list .asset-item{grid-template-columns:46px minmax(0,1fr) auto}.asset-group>summary strong{max-width:70%;overflow-wrap:anywhere}#progress,#specs,#assets,#legacy,#evidence{scroll-margin-top:18px}@media(max-width:640px){.map-jumps{gap:6px}.map-jumps a{font-size:12px;padding:7px 9px}.asset-group>summary{display:block}.asset-group>summary strong{display:block;max-width:none}.asset-group>summary span{display:block}.asset-full-list .asset-item{grid-template-columns:38px minmax(0,1fr)}.asset-full-list .asset-thumb{width:38px;height:34px}}
.asset-group>summary{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:14px;align-items:center}.group-thumb{display:block;width:62px;height:52px;object-fit:contain;border-radius:6px;background:#edf0e9}.asset-group>summary strong{max-width:none}.asset-group>summary>span:last-child{white-space:nowrap}@media(max-width:640px){.asset-group>summary{display:grid;grid-template-columns:52px minmax(0,1fr);gap:9px}.group-thumb{width:52px;height:48px}.asset-group>summary>span:last-child{grid-column:2}}
.asset-group>summary .group-name{white-space:normal;min-width:0}.group-name strong,.group-name small{display:block;line-height:1.5}.group-name small{font:11px/1.5 ui-monospace,monospace;color:var(--muted);overflow-wrap:anywhere}.asset-group>summary .group-name strong{font-size:15px}
.asset-size{text-align:right}.asset-size small{display:block;color:var(--muted);font-size:11px;line-height:1.45}@media(max-width:640px){.asset-size{text-align:left}}
.evidence-gallery{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.evidence-gallery .asset-item{display:block!important;padding:10px!important;border:1px solid var(--line);border-radius:9px;background:#f7f9f4}.evidence-gallery .asset-thumb{width:100%;height:250px;margin-bottom:8px}.evidence-gallery .asset-name{display:block;font-weight:700}.evidence-gallery .asset-size{display:block;text-align:left;font-size:12px}@media(max-width:640px){.evidence-gallery{grid-template-columns:1fr}.evidence-gallery .asset-thumb{height:260px}}
</style></head><body><header><nav aria-label="メインナビゲーション"><strong>SANSU</strong>${pages.map(([f, n]) => `<a href="${href(output, f)}"${f === output ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav></header><main><h1>${label}</h1><p class="subtitle">Sansu repository · Markdownから生成した閲覧用ポータル</p><label for="search">このページを検索</label><input id="search" type="search" placeholder="タイトル・ファイル名・キーワード"><p id="result" role="status" hidden></p>${content}<footer>正本は各カードのリンク先です。更新: <code>npm run agent:index</code> · <a href="${href(output, 'docs/runbooks/repository-portal.md')}">使い方</a></footer></main><script>
const search=document.querySelector('#search');const cards=[...document.querySelectorAll('[data-search]')];search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let count=0;for(const card of cards){card.hidden=!card.dataset.search.includes(q);if(!card.hidden)count++;}for(const group of document.querySelectorAll('.doc-group,.spec-list,.asset-groups')){const visible=[...group.querySelectorAll(':scope > [data-search],:scope > .card')].some(card=>!card.hidden);group.hidden=!visible;if(group.previousElementSibling?.classList.contains('group-title'))group.previousElementSibling.hidden=!visible;}for(const archive of document.querySelectorAll('.archive-section')){if(q&&[...archive.querySelectorAll('[data-search]')].some(card=>!card.hidden))archive.open=true;}const result=document.querySelector('#result');result.hidden=!q;result.textContent=count+' 件を表示';});
</script></body></html>\n`;
}
let stale = false;
for (const page of pages) {
  const html = render(page);
  const destination = path.join(root, page[0]);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== html) { console.error(`Stale: ${page[0]} — npm run agent:index`); stale = true; }
  } else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, html); console.log(`Generated: ${page[0]}`); }
}
if (stale) process.exitCode = 1;
