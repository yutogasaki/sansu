'use strict';
// Graphviz adapter derived from JISHU's renderer; dependency is local and locked.
const fs=require('node:fs');
const wrap=(text,max=16)=>{const rows=[''];let length=0;for(const c of text){const w=/[\x00-\x7f]/.test(c)?0.6:1;if(length+w>max){rows.push('');length=0;}rows[rows.length-1]+=c;length+=w;}return rows;};
(async()=>{
 const {instance,graphvizVersion}=await import('@viz-js/viz');const viz=await instance(),diagrams=JSON.parse(fs.readFileSync(0,'utf8')),outputs=[];
 for(const d of diagrams){
  const graph={name:d.id,directed:true,graphAttributes:{rankdir:d.direction==='TD'?'TB':d.direction||'TB',bgcolor:'transparent',pad:0.3,ranksep:0.65,nodesep:0.4},nodeAttributes:{shape:'box',style:'rounded,filled',fillcolor:'#f3f5fa',color:'#9da9bd',fontcolor:'#252934',fontname:'Helvetica',fontsize:16,penwidth:1.2},edgeAttributes:{color:'#64748b',fontcolor:'#39465d',fontname:'Helvetica',fontsize:16,arrowsize:0.8,penwidth:1.3},nodes:d.nodes.map(n=>({name:n.id,attributes:{label:wrap(n.label).join('\n'),margin:0.2}})),edges:d.edges.map(e=>({tail:e.from,head:e.to,attributes:{label:wrap(e.label,12).join('\n'),...(e.kind==='related'?{arrowhead:'none'}:e.kind==='bidirectional'?{dir:'both'}:{}),...(e.dashed?{style:'dashed'}:{})}}))};
  const result=viz.render(graph,{format:'svg',engine:'dot'});if(result.status!=='success')throw Error(JSON.stringify(result.errors));
  let svg=result.output.slice(result.output.indexOf('<svg'));const box=svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);if(!box)throw Error('DIAGRAM_SVG_VIEWBOX');const width=Math.ceil(Number(box[3])),height=Math.ceil(Number(box[4]));
  svg=svg.replace(/\bwidth="[\d.]+pt"/,'width="'+width+'"').replace(/\bheight="[\d.]+pt"/,'height="'+height+'"');outputs.push({svg,width,height});
 }
 process.stdout.write(JSON.stringify({generator:'@viz-js/viz 3.31.0 / Graphviz '+graphvizVersion,diagrams:outputs}));
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
