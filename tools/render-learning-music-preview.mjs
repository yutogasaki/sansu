import ts from 'typescript';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
// Deterministic comparison, not a recording of physical speakers or live play.
const out='docs/design/2026-09-29-learning-rich-audio';
await fs.mkdir(out, { recursive: true });
const path='src/components/island/learningMusicScore.ts';
const before=execFileSync('git',['show',`91f1eb3b:${path}`],{encoding:'utf8'});
for(const [name,source] of [['before',before],['after',await fs.readFile(path,'utf8')]]){
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const score=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const rate=22050,seconds=16,channels=[new Float32Array(rate*seconds),new Float32Array(rate*seconds)];
const stereo=(data,loop)=>score.learningStereo?score.learningStereo(data,rate,loop):[data,data];
const stems=score.createLearningStems(rate).map(data=>stereo(data,true));
for(let i=0;i<channels[0].length;i++){
const time=i/rate,levels=score.learningStemLevels(Math.min(1,time/12));
for(let c=0;c<2;c++)for(let s=0;s<4;s++)channels[c][i]+=stems[s][c][i%stems[s][c].length]*levels[s]*.36*.68;
}
for(const [at,kind,digit] of [[1,'tap','2'],[1.18,'correct','2'],[3,'tap','4'],[3.18,'correct','4'],[6,'rise','6'],[7,'tap','6'],[7.18,'peak','6'],[10,'tap','3'],[10.18,'correct','3'],[13.8,'tap','8'],[14,'section','8']]){
 const data=stereo(score.createLearningCue(kind,rate,score.learningInputPitch(at,digit),score.learningChordAt(at),Math.min(1,at/12)),false);
 for(let c=0;c<2;c++)for(let i=0;i<data[c].length&&Math.round(at*rate)+i<channels[c].length;i++)channels[c][Math.round(at*rate)+i]+=data[c][i]*.68;
}
const wav=Buffer.alloc(44+channels[0].length*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
let peak=0;for(let i=0;i<channels[0].length;i++)for(let c=0;c<2;c++){const value=channels[c][i];peak=Math.max(peak,Math.abs(value));if(Math.abs(value)>1)throw new Error('clip');wav.writeInt16LE(Math.round(value*32767),44+i*4+c*2);}
await fs.writeFile(`${out}/${name}.wav`,wav);console.log(name,peak);
}
