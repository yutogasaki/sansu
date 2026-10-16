#!/usr/bin/env node
'use strict';
// Definition checks and a pure transition preview. No commands or external writes.
const fs = require('node:fs');
const path = require('node:path');
const DEFAULT = path.join(__dirname, 'portal-flow.json');
const {checkGraph} = require('./graph-check.cjs');
const REQUIRED_NODES = ['research', 'implement', 'checks', 'visual_review', 'fix', 'yu_decision', 'local_commit', 'deploy', 'stopped', 'done'];
const GUARDS = ['always', 'yu_approved', 'hub_portal_yu_approved', 'no_publish', 'retry_available', 'retry_exhausted'];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function checkFlow(flow) {
  if (flow?.schemaVersion === 2) return checkGraph(flow);
  const issues = [];
  const check = (ok, message) => { if (!ok) issues.push(message); };
  if (!plain(flow)) return ['Flow must be an object'];
  check(flow.schemaVersion === 1, 'Unsupported schemaVersion');
  for (const key of ['title', 'description', 'as_of', 'scope_note']) check(nonempty(flow[key]), `Missing ${key}`);
  for (const key of ['nodes', 'edges', 'rules', 'items']) {
    if (!Array.isArray(flow[key])) return [...issues, `${key} must be an array`];
    if (!flow[key].every(plain)) return [...issues, `${key} entries must be objects`];
  }
  const ids = new Set(flow.nodes.map(n => n.id));
  check(ids.size === flow.nodes.length, 'Duplicate node');
  check(ids.size === REQUIRED_NODES.length && REQUIRED_NODES.every(id => ids.has(id)), 'Required nodes must match the contract (no push node)');
  for (const n of flow.nodes) {
    check(nonempty(n.title) && nonempty(n.description), 'Node needs Japanese title and description');
    check(['main', 'recovery'].includes(n.lane), 'Unknown node lane');
  }
  const review = flow.nodes.find(n => n.id === 'visual_review');
  check(review?.read_only === true && review?.reviewer === 'independent_ai', 'Visual review must be independent and read-only');
  check(flow.retry_policy?.max_per_cause === 2 && flow.retry_policy?.at_limit === 'next_failure_stops' && flow.retry_policy?.no_progress === 'stop_and_report', 'Retry policy must stop on next failure at two, or no progress');
  const edgeIds = new Set();
  for (const e of flow.edges) {
    check(nonempty(e.id) && !edgeIds.has(e.id), 'Missing or duplicate edge id'); edgeIds.add(e.id);
    check(ids.has(e.from) && ids.has(e.to), 'Edge references unknown node');
    check(nonempty(e.label) && ['pass', 'approve', 'publish', 'finish', 'fail', 'no_progress'].includes(e.event) && GUARDS.includes(e.guard), 'Invalid edge event, guard or label');
    check(typeof e.primary === 'boolean', 'Edge needs primary flag');
    check(Object.keys(e).every(k => ['id', 'from', 'to', 'event', 'label', 'guard', 'primary'].includes(k)), 'Unknown edge field (actions are not allowed)');
    if (e.to === 'deploy') check(e.from === 'local_commit' && e.event === 'publish' && e.guard === 'hub_portal_yu_approved', 'Deploy edge must require hub portal and Yu approval');
    if (e.to === 'local_commit') check(e.from === 'yu_decision' && e.event === 'approve' && e.guard === 'yu_approved', 'Commit edge must require Yu approval');
    if (e.event === 'fail') check((e.to === 'fix' && e.guard === 'retry_available') || (e.to === 'stopped' && e.guard === 'retry_exhausted'), 'Failure must fix below the limit and stop at the limit');
    if (e.event === 'no_progress') check(e.to === 'stopped' && e.guard === 'always', 'No progress must stop and report');
  }
  const has = (from, to, event, guard) => flow.edges.filter(e => e.from === from && e.to === to && e.event === event && e.guard === guard).length === 1;
  for (const id of REQUIRED_NODES) {
    if (['stopped', 'done'].includes(id)) { check(!flow.edges.some(e => e.from === id), 'Terminal nodes cannot automatically restart'); continue; }
    check(has(id, 'fix', 'fail', 'retry_available') && has(id, 'stopped', 'fail', 'retry_exhausted') && has(id, 'stopped', 'no_progress', 'always'), 'Every working node needs bounded failure and no-progress routes');
  }
  // The main route is ordered by the JSON, never a second renderer-owned graph.
  const main = flow.nodes.filter(n => n.lane === 'main');
  const primary = flow.edges.filter(e => e.primary);
  check(main.length === 8 && main[0]?.id === 'research' && main.at(-1)?.id === 'done', 'Main route must run from research to done');
  check(primary.length === main.length - 1 && main.slice(1).every((n, i) => primary.some(e => e.from === main[i].id && e.to === n.id)), 'Primary edges must join the JSON main route');
  check(has('fix', 'checks', 'pass', 'always') && has('local_commit', 'done', 'finish', 'no_publish'), 'Missing recheck or local-only completion route');

  const expected = {push: 'forbidden', deploy: 'allowed', local_commit: 'allowed', repo_concurrency: 'limited', supabase_change: 'forbidden', codex_settings: 'forbidden', legacy_pages: 'preserve'};
  check(flow.rules.length === Object.keys(expected).length && new Set(flow.rules.map(r => r.action)).size === flow.rules.length, 'Rules must be unique and exhaustive');
  for (const r of flow.rules) {
    check(Object.hasOwn(expected, r.action) && r.effect === expected[r.action], 'Unknown permission or forbidden action allowed (including push)');
    check(Object.keys(r).every(k => ['action', 'effect', 'description', 'scope', 'requires_yu', 'max_active_per_repo', 'until'].includes(k)), 'Unknown rule permission field');
    check(nonempty(r.description), 'Rule needs description');
  }
  const rule = action => flow.rules.find(r => r.action === action);
  check(rule('push')?.effect === 'forbidden', 'Explicit push prohibition required');
  check(rule('deploy')?.scope === 'hub-portal' && rule('deploy')?.requires_yu === true, 'Deploy limited to hub portal with explicit approval');
  check(rule('local_commit')?.requires_yu === true, 'Local commit requires authorization');
  check(rule('repo_concurrency')?.max_active_per_repo === 1, 'One active item per repository required');
  check(rule('legacy_pages')?.until === 'equivalence_confirmed_and_yu_approved', 'Legacy pages must be preserved until equivalence and Yu approval');
  const itemIds = new Set(), orders = new Set(), active = new Set();
  for (const i of flow.items) {
    check(/^[A-Za-z0-9-]+$/.test(i.id || '') && !itemIds.has(i.id), 'Invalid or duplicate item id'); itemIds.add(i.id);
    check(nonempty(i.title) && nonempty(i.repo) && nonempty(i.next), 'Item needs title, repo and next');
    check(ids.has(i.current_node), 'Item references unknown current_node');
    check(['active', 'queued', 'stopped', 'done'].includes(i.status), 'Unknown item status');
    check((i.current_node === 'stopped') === (i.status === 'stopped'), 'Stopped node and status must agree');
    check((i.current_node === 'done') === (i.status === 'done'), 'Done node and status must agree');
    check(i.status === 'stopped' ? nonempty(i.why_stopped) : i.why_stopped === null, 'Stopped item needs reason; other items use null');
    check(plain(i.needs_yu) && typeof i.needs_yu.required === 'boolean' && typeof i.needs_yu.content === 'string' && (!i.needs_yu.required || nonempty(i.needs_yu.content)), 'needs_yu requires bool and content');
    if (i.needs_yu?.required) {
      const y = i.needs_yu;
      check(i.status !== 'done', 'Completed items cannot request a decision');
      check(Array.isArray(y.options) && y.options.length >= 2 && y.options.every(o => plain(o) && nonempty(o.label) && nonempty(o.effect) && nonempty(o.next_work)), 'Decision needs options with labels, effects and next work');
      check(['confirmed', 'missing', 'resume_condition'].every(key => nonempty(y[key])), 'Decision needs confirmed facts, missing evidence and a resume condition');
      check(nonempty(y.recommendation) && Array.isArray(y.options) && y.options.some(o => o?.label === y.recommendation) && nonempty(y.reason), 'Decision needs a recommended option and reason');
      check(typeof y.evidence_href === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]+(?:\.html)?(?:#[A-Za-z0-9_-]+)?$/.test(y.evidence_href), 'Decision needs a site-local evidence link');
    }
    check(plain(i.retries) && Object.entries(i.retries).every(([cause, n]) => nonempty(cause) && Number.isInteger(n) && n >= 0 && n <= flow.retry_policy?.max_per_cause), 'Retries exceed limit or are invalid');
    check(Number.isInteger(i.order) && i.order > 0 && !orders.has(i.order), 'Invalid or duplicate item order'); orders.add(i.order);
    check(Array.isArray(i.evidence) && i.evidence.length > 0 && i.evidence.every(nonempty), 'Item needs evidence (mark unverified assumptions)');
    if (i.status === 'active') { check(!active.has(i.repo.toLowerCase()), 'Multiple active items in one repository'); active.add(i.repo.toLowerCase()); }
    if (i.current_node === 'deploy') check(i.repo === 'hub', 'Only hub items may reach deploy');
  }
  if (flow.goals !== undefined) issues.push(...checkGraph(flow));
  return issues;
}
function assertFlow(flow) {
  const issues = checkFlow(flow);
  if (issues.length) throw new Error('Invalid portal flow: ' + issues.join('; '));
  return flow;
}
function readFlow(file = DEFAULT) { return assertFlow(JSON.parse(fs.readFileSync(file, 'utf8'))); }

function transition(flow, itemId, event, context = {}) {
  assertFlow(flow);
  if (flow.schemaVersion !== 1) throw new Error('Project graphs are read-only; use the repository ledger for transitions');
  const item = flow.items.find(i => i.id === itemId);
  if (!item) throw new Error('Unknown item');
  if (event === 'fail' && !nonempty(context.cause)) throw new Error('Failure requires a cause');
  const count = Object.hasOwn(item.retries, context.cause) ? item.retries[context.cause] : 0;
  const guards = {always: true, yu_approved: context.yuApproved === true,
    hub_portal_yu_approved: item.repo === 'hub' && context.target === 'hub-portal' && context.yuApproved === true,
    no_publish: context.publish !== true, retry_available: count < flow.retry_policy.max_per_cause,
    retry_exhausted: count >= flow.retry_policy.max_per_cause};
  const matches = flow.edges.filter(e => e.from === item.current_node && e.event === event && guards[e.guard]);
  if (matches.length !== 1) throw new Error('Transition unavailable or ambiguous');
  const next = structuredClone(item), edge = matches[0];
  next.current_node = edge.to;
  next.status = edge.to === 'stopped' ? 'stopped' : edge.to === 'done' ? 'done' : 'active';
  next.why_stopped = edge.to === 'stopped' ? (context.reason || (event === 'fail' ? '同じ原因の上限に達した後の不合格。停止して報告。' : '進展なし。停止して報告。')) : null;
  if (event === 'fail' && edge.to === 'fix') Object.defineProperty(next.retries, context.cause, {value: count + 1, enumerable: true, configurable: true, writable: true});
  // The caller must supply a concrete comparison and evidence for the new decision.
  if (edge.to === 'yu_decision') next.needs_yu = {...structuredClone(context.decision), required: true};
  if (event === 'approve') next.needs_yu = {...next.needs_yu, required: false, content: '指定された次の操作は承認済み。公開する場合は別途承認が必要です。'};
  // Check the prospective ledger too: queued items cannot steal an active repo slot.
  assertFlow({...flow, items: flow.items.map(i => i.id === itemId ? next : i)});
  return next;
}
if (require.main === module) {
  try { const flow = readFlow(process.argv[2]); console.log(`PASS: ${flow.nodes.length} nodes, ${flow.edges?.length ?? 0} edges, ${flow.items.length} items; ${flow.schemaVersion === 1 ? "hub policy checked" : "read-only project graph"}`); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = {DEFAULT, checkFlow, assertFlow, readFlow, transition};
