import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Execute the actual pure domain sources; no production or saved profiles are modified.
const root = process.cwd();
const out = `${root}/docs/audits/2026-10-01-learning-content`;
const paths = execFileSync('rg', ['--files', 'src/domain/math', 'src/domain/english', 'src/domain/learning', 'src/utils', 'docs/product'], { encoding: 'utf8' }).trim().split('\n').sort();
const hashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const before = hashes();
const compiled = await build({ stdin: { contents: `
export { MATH_GENERATORS } from './src/domain/math/index';
export { MATH_CURRICULUM } from './src/domain/math/curriculum';
export { MATH_SKILL_LABELS } from './src/domain/math/labels';
export { createMathProgressProfile } from './src/domain/math/testFixtures';
export { ENGLISH_WORDS } from './src/domain/english/words';
export { generateVocabProblem } from './src/domain/english/generator';
export { ENGLISH_EXAMPLE_SENTENCES } from './src/domain/english/examples';
export { MATH_LEARNING_UNITS, MATH_ITEM_MAPPINGS } from './src/domain/learning/mathCatalog';
export { validateLearningCatalog } from './src/domain/learning/catalog';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false });
export const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
export const rng = seed => { let state = seed; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const failures = [];
let mathCount = 0, oracleCount = 0, vocabCount = 0;
const stages = [undefined, 0, 3, 10, 20, 40, 100];
const skills = Object.values(api.MATH_CURRICULUM).flat();
for (const id of skills) {
  if (!api.MATH_GENERATORS[id] || !api.MATH_SKILL_LABELS[id] || !api.MATH_ITEM_MAPPINGS.some(x => x.itemId === id)) failures.push({ id, reason: 'missing metadata' });
}
const mathInventory = [];
function rational(text) { const parts = text.trim().split(/\s+/); const f = parts.pop().split('/').map(Number); return (parts.length ? Number(parts[0]) : 0) + (f.length === 2 ? f[0] / f[1] : f[0]); }
for (const [id, gen] of Object.entries(api.MATH_GENERATORS)) {
  const stats = { id, level: api.MATH_ITEM_MAPPINGS.find(x => x.itemId === id)?.legacyLevel, label: api.MATH_SKILL_LABELS[id], types: {}, visualKinds: {}, samples: [], distinctQuestions: new Set(), stages: {} };
  for (const stage of stages) {
    const stageStats = { count: 0, minAnswer: Infinity, maxAnswer: -Infinity, minOperand: Infinity, maxOperand: -Infinity };
    for (let seed = 1; seed <= 100; seed++) {
      try {
        const p = gen({ random: rng(seed * 7919), ...(stage === undefined ? {} : { profile: api.createMathProgressProfile(id, stage) }) });
        mathCount++; stageStats.count++;
        if (p.categoryId !== id || !p.learningContext || p.correctAnswer === undefined) failures.push({ id, stage, seed, reason: 'contract' });
        stats.types[p.inputType] = (stats.types[p.inputType] ?? 0) + 1;
        const kind = p.questionVisual?.kind ?? 'none'; stats.visualKinds[kind] = (stats.visualKinds[kind] ?? 0) + 1;
        stats.distinctQuestions.add(p.questionText);
        if (seed === 1) stats.samples.push({ stage: stage ?? 'no-profile', question: p.questionText, answer: p.correctAnswer, visual: p.questionVisual, context: p.learningContext });
        const choices = p.inputConfig?.choices;
        if (choices && (new Set(choices.map(x => x.value)).size !== choices.length || new Set(choices.map(x => x.label)).size !== choices.length || !choices.some(x => x.value === p.correctAnswer))) failures.push({ id, stage, seed, reason: 'choices' });
        if (p.inputType === 'multi-number' && p.inputConfig?.fields?.length !== p.correctAnswer.length) failures.push({ id, stage, seed, reason: 'fields' });
        const m = p.questionText?.match(/^([\d./\s]+)\s([+−\-×÷])\s([\d./\s]+)\s*=/);
        if (m) {
          const a = rational(m[1]), b = rational(m[3]);
          for (const n of [a, b]) { stageStats.minOperand = Math.min(stageStats.minOperand,n); stageStats.maxOperand=Math.max(stageStats.maxOperand,n); }
          const expected = m[2] === '+' ? a + b : ['-', '−'].includes(m[2]) ? a - b : m[2] === '×' ? a * b : a / b;
          const fields = p.inputConfig?.fields?.map(x => x.label).join('/');
          const ans = !Array.isArray(p.correctAnswer) ? Number(p.correctAnswer) : fields === 'しょう/あまり' ? Number(p.correctAnswer[0]) + Number(p.correctAnswer[1])/b : fields === '整数/分子/分母' ? Number(p.correctAnswer[0])+Number(p.correctAnswer[1])/Number(p.correctAnswer[2]) : Number(p.correctAnswer[0])/Number(p.correctAnswer[1]);
          oracleCount++;
          if (!Number.isFinite(ans) || Math.abs(ans - expected) > 1e-7 || expected < 0) failures.push({id,stage,seed,reason:'arithmetic',question:p.questionText,answer:p.correctAnswer,expected});
          stageStats.minAnswer = Math.min(stageStats.minAnswer,ans);stageStats.maxAnswer=Math.max(stageStats.maxAnswer,ans);
        }
      } catch (e) { failures.push({ id, stage, seed, reason: String(e) }); }
    }
    stats.stages[stage ?? 'no-profile'] = stageStats;
  }
  stats.distinctQuestions = stats.distinctQuestions.size; mathInventory.push(stats);
}
const examples = new Map(api.ENGLISH_EXAMPLE_SENTENCES.map(x => [x.wordId, x.english]));
const vocabInventory = api.ENGLISH_WORDS.map(x => ({ ...x, example: examples.get(x.id) ?? null }));
for (const word of api.ENGLISH_WORDS) for (const kanjiMode of [false, true]) for (let seed=1;seed<=10;seed++) {
  const p = api.generateVocabProblem(word.id, {kanjiMode,random:rng(seed*7919)});vocabCount++;
  if (p.inputConfig.choices.length !== 4 || new Set(p.inputConfig.choices.map(x=>x.label)).size !== 4 || !p.inputConfig.choices.some(x=>x.value===p.correctAnswer)) failures.push({id:word.id,kanjiMode,seed,reason:'vocab choices'});
}
const spellings = new Map(); for(const word of vocabInventory){ const key=word.surface??word.id; spellings.set(key,[...(spellings.get(key)??[]),word]); }
const duplicates = [...spellings].filter(([,rows])=>rows.length>1).map(([surface,items])=>({surface,items}));
const prereqGaps = api.MATH_LEARNING_UNITS.filter(x=>x.availability==='existing').map(x=>({unit:x.id,missing:x.prerequisites.filter(p=>api.MATH_LEARNING_UNITS.find(u=>u.id===p)?.availability==='planned')})).filter(x=>x.missing.length);
const laterSuggestions = api.MATH_LEARNING_UNITS.flatMap(u=>u.suggestedPrerequisites.map(p=>({unit:u.id,level:Math.min(...api.MATH_ITEM_MAPPINGS.filter(x=>x.unitId===u.id).map(x=>x.legacyLevel)), prerequisite:p,prerequisiteLevel:Math.min(...api.MATH_ITEM_MAPPINGS.filter(x=>x.unitId===p).map(x=>x.legacyLevel))}))).filter(x=>Number.isFinite(x.level)&&Number.isFinite(x.prerequisiteLevel)&&x.prerequisiteLevel>x.level);
const summary = { mathSkills: skills.length, generators:Object.keys(api.MATH_GENERATORS).length, mathLevels:Object.keys(api.MATH_CURRICULUM).length, mathCount,oracleCount,vocabItems:vocabInventory.length,distinctSpellings:spellings.size,vocabCount,exampleCount:examples.size,missingExamples:vocabInventory.filter(x=>!x.example).map(x=>x.id),catalogErrors:api.validateLearningCatalog(),failures,prereqGaps,laterSuggestions,duplicates,levelCounts:Object.entries(api.MATH_CURRICULUM).map(([level,items])=>({level:Number(level),skills:items.length})) };
writeFileSync(`${out}/inventory.json`, JSON.stringify({summary,math:mathInventory,vocab:vocabInventory},null,2));
writeFileSync(`${out}/source.json`,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),before,after:hashes(),unchanged:JSON.stringify(before)===JSON.stringify(hashes())},null,2));
console.log(JSON.stringify(summary,null,2));
if (failures.length || summary.catalogErrors.length) process.exitCode = 1;
