import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv[2];assert(out,'Specify spine output JSON');
// Authored study inputs based on the current C3 timber; the app's original branches remain the fallback.
const base=[
 {p:[[2.9,0,-3.35],[2.8,1.4,-3.55],[2.1,2.6,-3.9],[.9,3.1,-3.8],[-1.7,3.2,-3.4],[-3.65,4.1,-4.6]],r:.92,tip:.03,cool:false},
 {p:[[2.8,.25,-3.5],[3.15,1.9,-3.75],[2.9,3.65,-4],[3.5,4.9,-4.4]],r:.62,tip:.035,cool:false},
 {p:[[2.9,.15,-3.4],[1.5,.70,-3.4],[.4,1.7,-3.65],[-1.3,1.35,-3.4],[-2.9,-.04,-3.1]],r:.48,tip:.19,cool:false},
 {p:[[2.4,.05,-3.8],[1.9,1.2,-4.3],[.9,2.3,-4.5],[-.8,2.5,-4.4]],r:.52,tip:.22,cool:true},
 {p:[[2.8,.03,-3.6],[3.4,.25,-3.45],[4.1,-.04,-3.3]],r:.26,tip:.10,cool:false},
];
const roots=[
 {p:[[2.85,.8,-3.55],[2,.24,-3.45],[.7,.08,-3.45],[-.65,-.13,-3.35]],r:.46,tip:.02,cool:false},
 {p:[[2.8,.6,-3.6],[3.25,.12,-3.5],[3.58,-.24,-3.35]],r:.35,tip:.02,cool:false},
];
const recess={p:[[2.55,.55,-3.85],[1.8,.22,-4.05],[.65,-.16,-4.12]],r:.38,tip:.025,cool:true};
const sample=b=>{const c=new T.CatmullRomCurve3(b.p.map(p=>new T.Vector3(...p)));return{cool:b.cool,points:Array.from({length:49},(_,i)=>[...c.getPointAt(i/48).toArray(),b.r+(b.tip-b.r)*i/48])};};
await writeFile(out,JSON.stringify({coordinateSpace:'canopy local, before existing root.scale.y=.67 and center shift',variants:{
 traced:{blend:.16,baseCount:5,spines:base.map(sample)},
 buttress:{blend:.32,baseCount:5,spines:[...base,...roots].map(sample)},
 recess:{blend:.42,baseCount:5,spines:[...base,...roots,recess].map(sample)},
}},null,2));
