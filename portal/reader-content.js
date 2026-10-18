/* Render the same source record as prose, exact original text, or JSON. */
window.sansuDocumentView = (row, mode, resolveLink) => {
 const root=document.createElement('div');root.className='document-body';
 if(mode!=='reading'||!row.source?.endsWith('.md')){
  const pre=document.createElement('pre');pre.className='reader-text';
  pre.textContent=mode==='data'?JSON.stringify(row,null,2):row.body;root.append(pre);return root;
 }
 const inline=(text,parent)=>{
  const pattern=/!?\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;let start=0;
  for(const match of text.matchAll(pattern)){
   parent.append(document.createTextNode(text.slice(start,match.index)));
   const image=match[0].startsWith('![');
   const node=document.createElement(image?'img':match[1]?'a':match[3]?'strong':'code');
   node.textContent=match[1]||match[3]||match[4];
   if(match[1]){
    const url=resolveLink(match[2]);
    if(url&&['http:','https:','file:'].includes(url.protocol)){if(image){node.src=url.href;node.alt=match[1];node.loading='lazy';}else node.href=url.href;}
    else node.removeAttribute('href');
   }
   parent.append(node);start=match.index+match[0].length;
  }
  parent.append(document.createTextNode(text.slice(start)));
 };
 const lines=row.body.split(/\r?\n/);let list,table,code,paragraph;
 const flush=()=>{list=null;table=null;paragraph=null;};
 for(const line of lines){
  if(/^```/.test(line)){if(code){code=null;}else{flush();const pre=document.createElement('pre');code=document.createElement('code');pre.append(code);root.append(pre);}continue;}
  if(code){code.textContent+=line+'\n';continue;}
  if(!line.trim()){flush();continue;}
  if(/^\s*\|?\s*:?-{3,}/.test(line))continue;
  if(/^\|/.test(line)){
   if(!table){flush();const wrapper=document.createElement('div');wrapper.className='reader-table';table=document.createElement('table');wrapper.append(table);root.append(wrapper);}
   const tr=document.createElement('tr');
   for(const cell of line.replace(/^\||\|$/g,'').split('|')){const td=document.createElement(table.rows.length?'td':'th');inline(cell.trim(),td);tr.append(td);}table.append(tr);continue;
  }
  const heading=line.match(/^(#{1,6})\s+(.+)$/);
  if(heading){flush();const h=document.createElement('h'+Math.min(heading[1].length+1,6));inline(heading[2],h);root.append(h);continue;}
  const item=line.match(/^\s*(?:[-*+] |\d+\. )(.+)$/);
  if(item){paragraph=null;table=null;if(!list){list=document.createElement('ul');root.append(list);}const li=document.createElement('li');inline(item[1],li);list.append(li);continue;}
  list=null;table=null;
  if(/^>/.test(line)){const quote=document.createElement('blockquote');inline(line.replace(/^>\s?/,''),quote);root.append(quote);paragraph=null;continue;}
  if(!paragraph){paragraph=document.createElement('p');root.append(paragraph);}else paragraph.append(document.createTextNode(' '));inline(line,paragraph);
 }
 return root;
};
