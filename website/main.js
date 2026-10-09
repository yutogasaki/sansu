const stages = {
  start: { number: '01', label: 'はじめの島', title: '「ここから、\nわたしの島。」', copy: '大きな木と、小さな家。ぽこもこと過ごす島のはじまりです。まずは島をさわって、歩いてみよう。最初の一歩は、自分のペースで。', detail: 'ぽこもこと出会う / 島をさわる / 小さくはじめる', image: './images/island-start.png', alt: '大きな木とぽこもこの家がある、はじめの小さな島' },
  growing: { number: '02', label: '少し育った島', title: '「ここに、お花を\n置いてみよう。」', copy: '花やベンチ、水ばちを置くと、島に過ごす場所が増えていく。住人が歩いて、座って、遊びにくる。自分の工夫が、景色になっていきます。', detail: '花や木を育てる / 置き方を工夫する / 住人と遊ぶ', image: './images/island-growing.png', alt: '花やベンチが増えて、2人の住人が暮らす少し育った島' },
  thriving: { number: '03', label: 'にぎわう島', title: '「こんなに、\nにぎやかになった！」', copy: '家が育ち、住人が増え、土地が広がる。あちらでひと休み、こちらではお花のそばへ。小さかった島が、自分で育てたにぎやかな場所になっていきます。', detail: '家と住人が増える / 土地を広げる / くらしを眺める', image: './images/island-thriving.png', alt: '8つの住人の家、花やベンチ、13人の住人がいる、大きく広がった島の配置例' },
};
const image = document.querySelector('#growth-image');
const buttons = document.querySelectorAll('[data-stage]');
buttons.forEach(button => button.addEventListener('click', () => {
  const stage = stages[button.dataset.stage];
  if (!stage) return;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  image.src = stage.image;
  image.alt = stage.alt;
  for (const [id, value] of Object.entries({ 'stage-number': stage.number, 'stage-label': stage.label, 'stage-title': stage.title, 'stage-copy': stage.copy, 'stage-detail': stage.detail })) {
    document.getElementById(id).textContent = value;
  }
}));
