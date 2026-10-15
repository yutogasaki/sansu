const schema = require('./project.schema.json');

// Deliberately implements only the keywords used by our checked-in schema.
// The schema itself remains consumable by Draft 2020-12 validators.
function validate(value, rule = schema, at = '$') {
  const errors = [];
  const fail = message => errors.push(`${at}: ${message}`);
  if (rule.const !== undefined && value !== rule.const) fail('unexpected constant');
  if (rule.type) {
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if (type !== rule.type) return [`${at}: expected ${rule.type}`];
  }
  if (rule.anyOf && !rule.anyOf.some(r => validate(value, r, at).length === 0)) fail('invalid date or date-time');
  if (typeof value === 'string') {
    if (rule.minLength && value.trim().length < rule.minLength) fail('empty string');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail('invalid pattern');
    if (rule.format === 'date') {
      const d = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value) fail('invalid date');
    }
    if (rule.format === 'date-time') {
      const m = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/);
      if (!m || +m[1]>23 || +m[2]>59 || +m[3]>59 || +(m[4]||0)>23 || +(m[5]||0)>59 || !Number.isFinite(Date.parse(value)) || validate(value.slice(0,10),{format:'date'}).length) fail('invalid date-time');
    }
  }
  if (Array.isArray(value)) {
    if (rule.uniqueItems && new Set(value.map(x => JSON.stringify(x))).size !== value.length) fail('duplicate item');
    if (rule.items) value.forEach((v, i) => errors.push(...validate(v, rule.items, `${at}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const k of rule.required || []) if (!Object.hasOwn(value, k)) fail(`missing ${k}`);
    for (const [k, v] of Object.entries(value)) {
      if (Object.hasOwn(rule.properties || {}, k)) errors.push(...validate(v, rule.properties[k], `${at}.${k}`));
      else if (rule.additionalProperties === false) fail(`unknown field ${k}`);
    }
  }
  return errors;
}
function assertProject(value) {
  const errors = validate(value);
  if (errors.length) throw new Error(errors.join('\n'));
  return value;
}
module.exports = {schema, validate, assertProject};
