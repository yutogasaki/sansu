const stages = {
  start: { label: '01 / はじめの島', title: '「ここから、\nひとつずつ。」', copy: 'ぽこもこの家と、小さな花とベンチ。はじめは、この小さな島から。算数や英語を練習しながら、少しずつ材料を集め、自分の景色を育てていきます。', detail: 'ぽこもこと出会う · 学びはじめる · 最初のたねを置く', image: './images/island-start.png', alt: 'ぽこもこの家、花とベンチがある、はじめの小さな島' },
  village: { label: '02 / 小さな村', title: '「お花のそばに、\nおうちができた。」', copy: '育った家に、仲間が暮らしはじめる。花や木、畑にブランコ。置き方を変えながら、学習の合間に遊べる場所をつくっていこう。', detail: '家と仲間が増える · 花や木を育てる · 遊ぶ場所をつくる', image: './images/island-village.png', alt: '色と形の違う2つの家、花や木、畑、ブランコがある小さな村の配置例' },
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
  for (const [id, value] of Object.entries({ 'stage-label': stage.label, 'stage-title': stage.title, 'stage-copy': stage.copy, 'stage-detail': stage.detail, 'stage-source': button.dataset.stage === 'town' ? '完成イメージ（開発中）。この地形・建物は、現在のゲームにはまだ登場しません。' : '現在のゲーム画面／紹介用に成長・住人・配置を設定した例です。' })) document.getElementById(id).textContent = value;
  image.parentElement.setAttribute('aria-busy', 'true');
  const next = new Image(); next.src = stage.image;
  try { await next.decode(); } catch { /* The native image alt preserves the selected content if loading fails. */ }
  if (current !== selection) return;
  image.src = stage.image; image.alt = stage.alt;
  image.parentElement.setAttribute('aria-busy', 'false');
}));
