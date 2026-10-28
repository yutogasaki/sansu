(() => {
  'use strict';
  const root = document.querySelector('.pp');
  if (!root) return;
  // The choices only switch editorial diagrams; no model, storage or network writes.
  for (const lab of root.querySelectorAll('[data-depth-lab]')) {
    const controls=lab.querySelector('[data-depth-controls]');
    const views=[...lab.querySelectorAll('[data-depth-view]')];
    const update=()=>{
      const current=controls.querySelector('input:checked')?.value;
      for(const view of views)view.hidden=view.dataset.depthView!==current;
    };
    controls.hidden=false;
    controls.addEventListener('change',update);
    update();
  }
  const input = root.querySelector('#pp-search');
  const select = root.querySelector('#pp-state');
  const features = [...root.querySelectorAll('[data-feature]')];
  const groups = [...root.querySelectorAll('[data-feature-group]')];
  const buttons = [...root.querySelectorAll('[data-feature-category]')];
  const normalize = s => s.normalize('NFKC').toLocaleLowerCase().trim();
  const searchText = new Map(features.map(el => [el, normalize(el.textContent)]));
  let category = 'all';
  function filter() {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const feature of features) {
      const show = (category === 'all' || feature.dataset.category === category)
        && (select.value === 'all' || feature.dataset.state === select.value)
        && terms.every(term => searchText.get(feature).includes(term));
      feature.hidden = !show;
      if (show) count++;
      if (terms.length) feature.open = show;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-feature]:not([hidden])');
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.featureCategory === category));
    root.querySelector('#pp-result').textContent = `${features.length}項目中 ${count}項目を表示しています。`;
    root.querySelector('#pp-empty').hidden = count !== 0;
  }
  for (const element of root.querySelectorAll('[data-feature-tools]')) element.hidden = false;
  input.addEventListener('input', filter);
  select.addEventListener('change', filter);
  for (const button of buttons) button.addEventListener('click', () => {
    category = button.dataset.featureCategory;
    filter();
  });
  for (const button of root.querySelectorAll('[data-feature-reset]')) button.addEventListener('click', () => {
    input.value = '';
    select.value = 'all';
    category = 'all';
    features.forEach(el => { el.open = false; });
    filter();
    input.focus({preventScroll:true});
  });
  // A direct feature link reveals its explanation even after the user has filtered.
  function revealHash() {
    let id;
    try { id=decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target?.matches('[data-feature]')) return;
    input.value = '';
    select.value = 'all';
    category = 'all';
    filter();
    target.open = true;
    target.scrollIntoView({block:'start'});
  }
  window.addEventListener('hashchange', revealHash);
  revealHash();
})();
