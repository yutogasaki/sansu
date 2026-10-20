(()=>{'use strict';
const buttons=[...document.querySelectorAll('[data-review-request]')],opener=document.querySelector('[data-context-open]'),select=document.querySelector('[data-workspace-work]');
if(!buttons.length||!opener||!select)return;
const templates=JSON.parse(document.querySelector('#review-loop-templates').textContent);
function sync(){for(const button of buttons)button.disabled=opener.disabled||select.disabled||!select.value;}
new MutationObserver(sync).observe(opener,{attributes:true,attributeFilter:['disabled']});
select.addEventListener('change',sync);addEventListener('popstate',sync);sync();
for(const button of buttons)button.addEventListener('click',()=>{sync();if(button.disabled)return;opener.click();const request=document.querySelector('#context-request');if(!request||!document.querySelector('#context-dialog')?.open)return;request.value=templates[button.dataset.reviewRequest];request.dispatchEvent(new Event('input',{bubbles:true}));request.focus();request.setSelectionRange(0,0);request.scrollTop=0;});
})();
