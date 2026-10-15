// Small parser for HTML emitted by our controlled generators; no DOM/network dependency.
export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
export const decode = value => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (_, c) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[c] ?? String.fromCodePoint(c.startsWith('#x') ? parseInt(c.slice(2),16) : Number(c.slice(1)))));
const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
export function parse(html) {
  const root = {tag:'root', attrs:{}, children:[]}, stack = [root];
  const tokens = html.match(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+|</gi) || [];
  for (const token of tokens) {
    const raw = token.match(/^<(script|style)\b([^>]*)>([\s\S]*)<\/\1\s*>$/i);
    if (raw) { const attrs={}; for(const m of raw[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[m[1]]=decode(m[2]??m[3]??m[4]??''); stack.at(-1).children.push({tag:raw[1].toLowerCase(),attrs,children:[{raw:raw[3]}]}); continue; }
    const end = token.match(/^<\/([\w-]+)/);
    if (end) { const index = stack.findLastIndex(n=>n.tag===end[1].toLowerCase()); if(index>0)stack.length=index; continue; }
    const start = token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);
    if (!start) { stack.at(-1).children.push({raw:token}); continue; }
    const attrs = {};
    for (const m of start[2].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1]] = decode(m[2] ?? m[3] ?? m[4] ?? '');
    const node = {tag:start[1].toLowerCase(),attrs,children:[]}; stack.at(-1).children.push(node);
    if(!voids.has(node.tag))stack.push(node);
  }
  return root;
}
export const serialize = n => n.raw !== undefined ? n.raw : n.tag==='root' ? n.children.map(serialize).join('') : `<${n.tag}${Object.entries(n.attrs).map(([k,v])=>` ${k}="${escape(v)}"`).join('')}>${n.children.map(serialize).join('')}${voids.has(n.tag)?'':`</${n.tag}>`}`;
export function visit(node, fn) { fn(node); for(const child of node.children || [])visit(child,fn); }
export function elements(node, test) { const found=[]; visit(node,n=>{if(n.tag&&test(n))found.push(n);});return found; }
export const textOf = n => decode(n.raw !== undefined ? n.raw.replace(/<[^>]*>/g,'') : (n.children || []).map(textOf).join(' ')).replace(/\s+/g,' ').trim();
export const hasClass = (n,c) => (n.attrs?.class||'').split(' ').includes(c);
export const fragment = html => parse(html).children;
export const disclosure = (nodes, label='元の記録と確認根拠') => ({tag:'details',attrs:{class:'ai-detail'},children:[{tag:'summary',attrs:{},children:[{raw:escape(label)}]},...nodes]});

// Shared by generation and verification; URLs in attributes remain intact.
export const technicalSurface = /confirmation-\d|trial\d|SHA256|\b[a-f\d]{16,64}\b|\b[\da-f]{8}-[\da-f-]{27,}\b|(?:\.agents|docs|src|public|output|assets)\/|\/(?:Users|tmp|private)\/|\b(?:npm|npx|node|git|pnpm)\s+(?:run\s+)?[\w:-]+|Command failed|(?:Assertion|Type|Reference|Syntax)?Error:|ENOENT|EACCES|Unexpected fixture source|Repository evidence must|\b[\w.-]+\.(?:md|mjs|cjs|js|tsx?|jsonl?|html|log|txt|ya?ml|sh)\b|\b(?:renderer|runtime|HOLD|PASS|FAIL|writer)\b|core[\d,]+|classic\d+|source\/dist|実SW/i;
export function surfaceText(n) {
  if(n.tag==='details')return surfaceText(n.children.find(c=>c.tag==='summary')||{raw:''});
  if(['script','style'].includes(n.tag))return '';
  return n.raw!==undefined?textOf(n):(n.children||[]).map(surfaceText).join(' ');
}

// Headings/card names are navigation labels, never a place for execution history.
export const headingRecord = /(?:20\d{2}[-/]\d{2}[-/]\d{2}|\b\d{1,2}\/\d{1,2}\b)|(?:(?<![a-z])[vcr]\d+(?:\.\d+)*)|(?:[MPRCX]\d+(?:[・〜/]|(?=の|後|と)))|(?:core[\d,]+|classic\d+|source\/dist|writer|実SW)|(?:：.*(?:現在|次|確認|保持))|(?:固定\d+)|(?:native-?\d+)|(?:checkpoint|source recovery|normal false build)|\b(?=[a-f0-9]*[a-f])[a-f0-9]{7,40}\b/i;
export const headingIssue = value => technicalSurface.test(value) || headingRecord.test(value) || value.length > 48;
export function surfaceLabels(node, inDetails=false, result=[]) {
  if(!inDetails && (/^h[1-6]$/.test(node.tag) || node.tag==='summary' || hasClass(node,'asset-name')))result.push(textOf(node.tag==='summary'?{...node,children:node.children.filter(n=>n.tag!=='img')}:node));
  for(const child of node.children||[])surfaceLabels(child,inDetails||node.tag==='details',result);
  return result;
}
