(()=>{'use strict';
 function close(figure,button){figure.classList.remove('pd-original');button.setAttribute('aria-pressed','false');button.textContent='原寸で読む';button.focus({preventScroll:true});button.scrollIntoView({block:'nearest'});}
 document.addEventListener('click',event=>{
  const button=event.target.closest('.pd-zoom');if(!button)return;
  const figure=button.closest('.pd-diagram');if(button.getAttribute('aria-pressed')==='true'){close(figure,button);return;}
  figure.classList.add('pd-original');button.setAttribute('aria-pressed','true');button.textContent='全体の説明へ戻る';const graphic=figure.querySelector('.pd-graphic');graphic.scrollLeft=0;graphic.scrollTop=0;graphic.focus({preventScroll:true});
 });
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const figure=event.target.closest('.pd-original');if(figure){event.preventDefault();close(figure,figure.querySelector('.pd-zoom'));}});
})();
