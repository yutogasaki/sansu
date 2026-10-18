const stages = {
  start: { label: '01 / はじめの島', title: '「ここから、\nひとつずつ。」', copy: '赤い屋根の小さな家と、紫の葉が広がる大樹。花の間の小道を抜けると、青い海へ続く桟橋が。こんな小さな居場所から、島の景色を育てていくイメージです。', detail: '最初の家 · 大樹の木陰 · 海へ続く小道', image: './images/island-start-cove.jpg', alt: '開発中のイメージ。紫の大樹と赤い屋根の家、花の小道と桟橋がある小さな島' },
  village: { label: '02 / 小さな村', title: '「お花のそばに、\nおうちができた。」', copy: '大樹と赤い屋根の家のそばに、青とピンクの屋根が仲間入り。入り江にかかる橋と、花に囲まれた小道が家々をつなぎます。小さな島に、暮らしが集まっていくイメージです。', detail: '集まる家々 · 入り江の橋 · 花でつながる小道', image: './images/island-village-cove.jpg', alt: '開発中のイメージ。紫の大樹のそばに3軒の家が集まり、入り江の橋と花の小道でつながる村' },
  town: { label: '03 / 育った島の完成イメージ', title: '森も、泉も、入り江も。\nひとつの世界へ。', copy: '青紫の葉が広がる大樹。丘から流れる青い泉。橋の向こうには、貝殻の屋根の集会所。小さな家から、歩いてみたくなる景色がつながる島を目指しています。', detail: '森の住まい · 丘の水庭 · 入り江の街並み', image: './images/island-complete.png', alt: '森、泉、橋と入り江がつながる、育った島の3D完成イメージ' },
};
const image = document.querySelector('#growth-image');
const buttons = [...document.querySelectorAll('[data-stage]')];
let selection = 0;
buttons.forEach(button => button.addEventListener('click', async () => {
  const stage = stages[button.dataset.stage];
  if (!stage) return;
  const current = ++selection;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  for (const [id, value] of Object.entries({ 'stage-label': stage.label, 'stage-title': stage.title, 'stage-copy': stage.copy, 'stage-detail': stage.detail, 'stage-source': button.dataset.stage === 'town' ? '完成イメージ（開発中）。この地形・建物は、現在のゲームにはまだ登場しません。' : '開発中のイメージ。現在のゲーム画面ではありません。' })) document.getElementById(id).textContent = value;
  image.parentElement.setAttribute('aria-busy', 'true');
  const next = new Image(); next.src = stage.image;
  try { await next.decode(); } catch { /* The native image alt preserves the selected content if loading fails. */ }
  if (current !== selection) return;
  image.src = stage.image; image.alt = stage.alt;
  image.parentElement.setAttribute('aria-busy', 'false');
}));
