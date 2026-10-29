/* Chelsea fan experience: progressive enhancement, native scrolling and real links. */
(() => {
 'use strict';
 const root=document.documentElement;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const preferenceKey='ohm.experience.motion';
 let paused=false;
 try{paused=localStorage.getItem(preferenceKey)==='off';}catch{}
 const off=()=>paused||reduce.matches;
 const toggle=document.createElement('button');
 toggle.type='button';toggle.className='motion-toggle';
 const progress=document.createElement('div');progress.className='scroll-progress';progress.setAttribute('aria-hidden','true');
 document.body.append(progress);(document.querySelector('#more-links')||document.body).append(toggle);
 const revealTargets=[...document.querySelectorAll('.page-intro,.section-head,.player.has-photo,.coach-photo-card,.person-card,.squad-card,.gallery-item,.explore-card,.stats,.journal-memory,.journal-panel,.page-pager,.about-portrait,.dream-card')];
 const observer='IntersectionObserver' in window?new IntersectionObserver(records=>{
  for(const record of records)if(record.isIntersecting){record.target.classList.add('is-revealed');observer.unobserve(record.target);}
 },{threshold:.07,rootMargin:'0px 0px 30px 0px'}):null;
 for(const [i,el] of revealTargets.entries()){
  el.style.setProperty('--reveal-delay',`${Math.min(i%4,3)*45}ms`);
  if(observer&&!off()){el.classList.add('reveal-ready');observer.observe(el);}else el.classList.add('is-revealed');
 }
 const tiltTargets=[...document.querySelectorAll('.player.has-photo,.coach-photo-card,.person-card,.squad-card,.gallery-item,.explore-card,.about-portrait,.stadium')];
 function resetTilt(el){el.style.setProperty('--tilt-x','0deg');el.style.setProperty('--tilt-y','0deg');}
 for(const el of tiltTargets){
  el.dataset.tilt='';let frame=0;
  el.addEventListener('pointermove',event=>{
   if(off()||!fine.matches||event.pointerType==='touch')return;
   const r=el.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(off())return;el.style.setProperty('--tilt-x',`${Math.max(-3,Math.min(3,-y*6))}deg`);el.style.setProperty('--tilt-y',`${Math.max(-4,Math.min(4,x*8))}deg`);});
  },{passive:true});
  el.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);resetTilt(el);});
  el.addEventListener('focusout',()=>resetTilt(el));
 }
 function updatePreference(){
  root.classList.toggle('motion-off',off());
  toggle.setAttribute('aria-pressed',String(off()));
  toggle.textContent=off()?'เอฟเฟกต์ · ปิด':'เอฟเฟกต์ · เปิด';
  toggle.setAttribute('aria-label',reduce.matches?'เอฟเฟกต์ปิดตามการตั้งค่าลดการเคลื่อนไหวของอุปกรณ์':off()?'เปิดเอฟเฟกต์การเคลื่อนไหว':'ปิดเอฟเฟกต์การเคลื่อนไหว');
  toggle.disabled=reduce.matches;
  if(off()){for(const el of revealTargets)el.classList.add('is-revealed');for(const el of tiltTargets)resetTilt(el);root.style.setProperty('--scene-offset','0px');}
 }
 toggle.addEventListener('click',()=>{paused=!paused;try{localStorage.setItem(preferenceKey,paused?'off':'on');}catch{}updatePreference();});
 reduce.addEventListener('change',updatePreference);updatePreference();
 let scrollFrame=0;
 function updateScroll(){
  scrollFrame=0;
  const max=root.scrollHeight-innerHeight;
  root.style.setProperty('--scroll-progress',max>0?String(Math.min(1,Math.max(0,scrollY/max))):'0');
  root.style.setProperty('--scene-offset',off()?'0px':`${Math.min(12,scrollY*.025)}px`);
 }
 function queueScroll(){if(!scrollFrame&&!document.hidden)scrollFrame=requestAnimationFrame(updateScroll);}
 addEventListener('scroll',queueScroll,{passive:true});addEventListener('resize',queueScroll,{passive:true});addEventListener('pageshow',queueScroll);updateScroll();
 document.addEventListener('click',event=>{
  if(off())return;
  const target=event.target.closest('button,.button,.textlink,.page-pager a');
  if(!target||target.disabled||target.closest('.photo-dialog')||!target.animate)return;
  target.classList.add('has-interaction');
  const r=target.getBoundingClientRect();
  const pulse=document.createElement('span');pulse.className='interaction-ripple';pulse.setAttribute('aria-hidden','true');
  pulse.style.setProperty('--ripple-x',`${event.detail?event.clientX-r.left:r.width/2}px`);
  pulse.style.setProperty('--ripple-y',`${event.detail?event.clientY-r.top:r.height/2}px`);
  target.append(pulse);pulse.animate([{transform:'translate(-50%,-50%) scale(0)',opacity:.45},{transform:'translate(-50%,-50%) scale('+Math.max(r.width,r.height)*2/16+')',opacity:0}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'}).finished.catch(()=>{}).finally(()=>pulse.remove());
 });
 root.classList.add('experience-ready');
})();
