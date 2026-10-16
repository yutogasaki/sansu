'use strict';
const schema = require('./flow.schema.json');
// Only the JSON Schema keywords used in flow.schema.json. No external dependency.
function validate(value, rule = schema, at = '$') {
  const issues = [], fail = message => issues.push(`${at}: ${message}`);
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (rule.type && !(rule.type === 'integer' ? Number.isInteger(value) : type === rule.type)) return [`${at}: expected ${rule.type}`];
  if (rule.enum && !rule.enum.includes(value)) fail('unknown value');
  if (rule.anyOf && !rule.anyOf.some(r => !validate(value, r, at).length)) fail('invalid alternative');
  if (typeof value === 'string') {
    if (rule.minLength && value.trim().length < rule.minLength) fail('empty text');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail('unsafe identifier');
    if (rule.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) fail('invalid date');
  }
  if (typeof value === 'number' && rule.minimum !== undefined && value < rule.minimum) fail('below minimum');
  if (Array.isArray(value)) {
    if (rule.minItems && value.length < rule.minItems) fail('empty collection');
    value.forEach((x,i) => issues.push(...validate(x,rule.items,`${at}[${i}]`)));
  } else if (type === 'object') {
    for (const key of rule.required || []) if (!Object.hasOwn(value,key)) fail('missing '+key);
    for (const [key,r] of Object.entries(rule.properties || {})) if (Object.hasOwn(value,key)) issues.push(...validate(value[key],r,`${at}.${key}`));
  }
  return issues;
}
function checkGraph(flow) {
  const issues = validate(flow);
  if (issues.length) return issues;
  const check = (ok,message) => {if (!ok) issues.push(message);};
  const maps = {};
  for (const key of ['nodes','goals','stages','items','artifacts','checks']) {
    maps[key] = new Map(flow[key].map(x => [x.id,x]));
    check(maps[key].size === flow[key].length,'Duplicate '+key+' id');
  }
  const refs = [['stages','goal_id','goals'],['items','stage_id','stages'],['items','current_node','nodes'],['artifacts','item_id','items'],['checks','artifact_id','artifacts']];
  for (const [key,field,target] of refs) for (const row of flow[key]) check(maps[target].has(row[field]),`Unknown ${key}.${field}`);
  for (const [parent,children,field] of [['goals','stages','goal_id'],['stages','items','stage_id'],['items','artifacts','item_id'],['artifacts','checks','artifact_id']])
    for (const x of flow[parent]) check(flow[children].some(c => c[field] === x.id),`Missing ${children} for ${parent}`);
  const orders = new Set();
  for (const item of flow.items) {
    check(!orders.has(item.order),'Duplicate work order'); orders.add(item.order);
    check(item.status === 'stopped' ? typeof item.why_stopped === 'string' && !!item.why_stopped.trim() : item.why_stopped === null,'Stopped work needs reason; others use null');
    check(!item.needs_yu.required || !!item.needs_yu.content.trim() && item.status !== 'done','Decision needs content and unfinished work');
  }
  const links = new Set(), outgoing = new Map(flow.items.map(i => [i.id,[]]));
  for (const dep of flow.dependencies) {
    check(maps.items.has(dep.from) && maps.items.has(dep.to),'Unknown dependency target');
    const key = dep.from+'>'+dep.to; check(!links.has(key),'Duplicate dependency'); links.add(key);
    outgoing.get(dep.from)?.push(dep.to);
  }
  const seen = new Set(), active = new Set();
  function visit(id) {if(active.has(id)){issues.push('Dependency cycle');return;}if(seen.has(id))return;active.add(id);for(const next of outgoing.get(id)||[])visit(next);active.delete(id);seen.add(id);}
  for (const id of outgoing.keys()) visit(id);
  return issues;
}
function assertGraph(flow) {const issues = checkGraph(flow);if(issues.length)throw Error('Invalid work graph: '+issues.join('; '));return flow;}
module.exports = {schema,validate,checkGraph,assertGraph};
