import { api, rng } from './inspect.mjs';
import { writeFileSync } from 'node:fs';
const samples = {};
for (const [target, alternate] of [['hard','difficult'],['way_lv12','method']]) {
  for (let seed=1; seed<=10000;seed++) {
    const p=api.generateVocabProblem(target,{random:rng(seed*7919)});
    if(p.inputConfig.choices.some(x=>x.value===alternate)) { samples[target]={seed,question:p.questionText,example:api.ENGLISH_EXAMPLE_SENTENCES.find(x=>x.wordId===target)?.english,choices:p.inputConfig.choices,correct:p.correctAnswer};break; }
  }
}
let quotientOne=0, averageShortcut=0, advancedCount=0;
const failures=[];
const fractionCompareModes={sameDenominator:0,sameNumerator:0,equivalent:0,otherUnequal:0};
for(let seed=1;seed<=10000;seed++) {
 const gen=id=>api.MATH_GENERATORS[id]({random:rng(seed*7919)});
 const div=gen('div_2d2d_exact'); if(div.correctAnswer==='1') quotientOne++;
 const average=gen('average_basic');const numbers=average.questionText.split(' の ')[0].split('、').map(Number);
 if((numbers[0]+numbers.at(-1))/2===Number(average.correctAnswer)) averageShortcut++;
 const fraction=gen('frac_compare');const [a,b,c,d]=fraction.questionText.match(/\d+/g).map(Number);
 const key=a*d===b*c?'equivalent':b===d?'sameDenominator':a===c?'sameNumerator':'otherUnequal';fractionCompareModes[key]++;
 for(const id of ['large_number_unit','dec_compare','frac_compare','percent_basic','average_basic','ratio_basic','speed_basic']) {
   const p=gen(id); const ns=p.questionText.match(/\d+(?:\.\d+)?/g)?.map(Number); let expected;
   if(id==='large_number_unit') expected=Number(p.questionText.split(' は ')[0].replaceAll(',',''))/(p.questionText.includes('おく')?1e8:1e4);
   if(id==='dec_compare') expected=ns[0]===ns[1]?'=':ns[0]>ns[1]?'>':'<';
   if(id==='frac_compare') expected=ns[0]*ns[3]===ns[1]*ns[2]?'=':ns[0]*ns[3]>ns[1]*ns[2]?'>':'<';
   if(id==='percent_basic') expected=p.questionText.includes('なん%')?ns[0]/ns[1]*100:ns[0]*ns[1]/100;
   if(id==='average_basic') expected=ns.reduce((a,b)=>a+b,0)/ns.length;
   if(id==='ratio_basic') expected=p.questionText.includes('= □')?ns[0]*ns[2]/ns[1]:ns[1]*ns[2]/ns[0];
   if(id==='speed_basic') expected=p.questionText.endsWith('きょりは？')?ns[0]*ns[1]:ns[0]/ns[1];
   advancedCount++; if(typeof expected==='string'?expected!==p.correctAnswer:Math.abs(expected-Number(p.correctAnswer))>1e-7) failures.push({id,seed,p,expected});
 }
}
const mismatches=['hard','apply','measure','present','age','heart','sound','free','step','sense','potential','cold','back','atmosphere'];
const manualReview=mismatches.map(id=>({...api.ENGLISH_WORDS.find(x=>x.id===id),example:api.ENGLISH_EXAMPLE_SENTENCES.find(x=>x.wordId===id)?.english}));
const result={samples,distributionSeeds:10000,quotientOne,averageShortcut,fractionCompareModes,advancedCount,failures,manualReview};
writeFileSync('docs/audits/2026-10-01-learning-content/probes.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(failures.length) process.exitCode=1;
