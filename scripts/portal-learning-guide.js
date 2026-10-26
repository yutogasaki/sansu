(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('journey-data').textContent);
  const first = document.getElementById('journey-first');
  const inputs = [...document.querySelectorAll('[data-journey-level]')];
  const summary = document.getElementById('journey-summary');
  function update() {
    const levels = Object.fromEntries(inputs.map(input => [input.dataset.journeyLevel, Number(input.value)]));
    const stages = data.gates.filter(g => ['math', 'english', 'kokugo'].some(k => levels[k] >= g[k]));
    document.querySelectorAll('[data-journey-stage]').forEach(row => {
      const qualified = stages.some(g => g.stage === Number(row.dataset.journeyStage));
      row.classList.toggle('is-open', qualified && first.checked);
      row.classList.toggle('is-qualified', qualified && !first.checked);
      row.querySelector('[data-journey-state]').textContent = qualified ? (first.checked ? '選べる' : '資格あり') : 'これから';
    });
    const title = document.createElement('strong');
    const explanation = document.createElement('p');
    if (first.checked) {
      title.textContent = `小島 ＋ ${stages.length}つの追加航路`;
      explanation.textContent = stages.length ? `後続の${stages.length}枠で、好きな未選択の島を一つずつ選べます。同じ段階を別の教科で達成しても枠は増えません。` : '最初の小島へ出航できます。次の航路は、どれかの教科の内容確認で開きます。';
    } else {
      title.textContent = stages.length ? `学習から ${stages.length}枠の資格あり` : '最初の小島から始めよう';
      explanation.textContent = stages.length ? '初回の家と仲間の体験はまだ。学習の資格は残し、初航海を体験した後に追加の行き先を選ぶ案です。' : '家を置く → 開く → 仲間を迎える。この三つで最初の航路が開きます。';
    }
    summary.replaceChildren(title, explanation);
  }
  first.addEventListener('change', update);
  inputs.forEach(input => input.addEventListener('change', update));
  document.getElementById('journey-reset').addEventListener('click', () => {
    first.checked = false;
    inputs.forEach(input => { input.value = '-1'; });
    update();
  });
  function revealLevel() {
    const id = location.hash.slice(1);
    if (!['levels-math', 'levels-english', 'levels-kokugo'].includes(id)) return;
    const target = document.getElementById(id);
    const details = target?.closest('details');
    if (details) details.open = true;
    target?.scrollIntoView({block: 'start'});
  }
  window.addEventListener('hashchange', revealLevel);
  update();
  revealLevel();
})();
