const stages = {
  start: { label: '01 / はじめの島', title: '「ここから、\nひとつずつ。」', copy: 'ぽこもこの家と、小さな花とベンチ。はじめは、この小さな島から。算数や英語を練習しながら、少しずつ材料を集め、自分の景色を育てていきます。', detail: 'ぽこもこと出会う · 学びはじめる · 最初のたねを置く', image: './images/island-start.png', alt: 'ぽこもこの家、花とベンチがある、はじめの小さな島' },
  village: { label: '02 / 小さな村', title: '「お花のそばに、\nおうちができた。」', copy: '育った家に、仲間が暮らしはじめる。花や木、畑にブランコ。置き方を変えながら、学習の合間に遊べる場所をつくっていこう。', detail: '家と仲間が増える · 花や木を育てる · 遊ぶ場所をつくる', image: './images/island-village.png', alt: '色と形の違う2つの家、花や木、畑、ブランコがある小さな村の配置例' },
  town: { label: '03 / 大きく育った島', title: '「ここ、ぜんぶ。\nわたしが育てた町。」', copy: '形も色も違う家、市場とパン屋、噴水の広場。遊び場に灯台、不思議な建物も。小さな島に、いろいろな過ごし方が生まれます。', detail: '家を育てる · お店や遊び場を置く · 土地を広げる', image: './images/island-town.png', alt: '市場と広場、花の住宅地、遊び場、灯台がある、大きく育った町の配置例' },
};
const image = document.querySelector('#growth-image');
const buttons = [...document.querySelectorAll('[data-stage]')];
let selection = 0;
buttons.forEach(button => button.addEventListener('click', async () => {
  const stage = stages[button.dataset.stage];
  if (!stage) return;
  const current = ++selection;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  for (const [id, value] of Object.entries({ 'stage-label': stage.label, 'stage-title': stage.title, 'stage-copy': stage.copy, 'stage-detail': stage.detail })) document.getElementById(id).textContent = value;
  image.parentElement.setAttribute('aria-busy', 'true');
  const next = new Image(); next.src = stage.image;
  try { await next.decode(); } catch { /* The native image alt preserves the selected content if loading fails. */ }
  if (current !== selection) return;
  image.src = stage.image; image.alt = stage.alt;
  image.parentElement.setAttribute('aria-busy', 'false');
}));
