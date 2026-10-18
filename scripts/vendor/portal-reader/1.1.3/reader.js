/* PortalReader 1.0.1 — JISHU search state and MMmind asynchronous copy recovery. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PortalReader = api;
})(globalThis, function () {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase();
  function restoreFilters(fields, href) {
    const params = new URL(href).searchParams;
    for (const [key, field] of Object.entries(fields)) {
      if (!field) continue;
      const value = params.get(key) || '';
      field.value = field.options && ![...field.options].some(option => option.value === value) ? '' : value;
    }
  }
  function saveFilters(fields, location, history) {
    const url = new URL(location.href);
    for (const [key, field] of Object.entries(fields)) {
      if (field?.value) url.searchParams.set(key, field.value);
      else url.searchParams.delete(key);
    }
    try { history.replaceState(history.state, '', url); return true; }
    catch { return false; } // file: restrictions must not disable filtering.
  }
  function bindCopy({button, field, status, dialog, success = 'コピーしました。まだ送信していません。', failure = '自動コピーを利用できません。文面を選択しました。⌘C または Ctrl+C でコピーしてください。', writeText}) {
    if (!button || !field || !status) throw Error('Copy controls are missing');
    let attempt = 0;
    const cancel = () => { attempt++; button.disabled = false; };
    const select = () => { field.focus(); field.select(); };
    const click = async () => {
      if (button.disabled) return;
      const ticket = ++attempt, text = field.value;
      const current = () => ticket === attempt && (!dialog || dialog.open);
      button.disabled = true;
      try {
        const write = writeText || (value => {
          if (!globalThis.navigator?.clipboard?.writeText) throw Error('Clipboard unavailable');
          return globalThis.navigator.clipboard.writeText(value);
        });
        await write(text);
        if (current()) status.textContent = field.value === text ? success : '変更前の文面をコピーしました。現在の文面をもう一度コピーしてください。';
      } catch {
        if (current()) { select(); status.textContent = failure; }
      } finally { if (current()) button.disabled = false; }
    };
    button.addEventListener('click', click);
    dialog?.addEventListener('close', cancel);
    return {cancel, select, dispose() { cancel(); button.removeEventListener('click', click); dialog?.removeEventListener('close', cancel); }};
  }
  return Object.freeze({version: '1.1.3', normalize, restoreFilters, saveFilters, bindCopy});
});
