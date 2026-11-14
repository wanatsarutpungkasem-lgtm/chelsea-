import {loadChelseaNext,fixtureTime,freshness} from './chelsea-next.mjs';
const button=document.querySelector('#home-match-load'),output=document.querySelector('#home-match-result');
if(button&&output){
 const show=(title,detail)=>{const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=detail;output.replaceChildren(h,p);};
 function render(data){
   const f=data.fixture;
   show(f?f.home+' vs '+f.away:'ยังไม่มีนัดถัดไปที่ยืนยันได้',f?fixtureTime(f)+' · '+f.venue:'ตารางปัจจุบันไม่มีคู่พรีเมียร์ลีกในอนาคต กรุณาตรวจประกาศสโมสร');
   const small=document.createElement('small');small.textContent=freshness(data);output.append(small);
   const link=document.createElement('a');link.href='https://www.chelseafc.com/en/matches/mens-fixtures-and-results';link.textContent='แหล่งข้อมูล: Chelsea FC ↗';link.target='_blank';link.rel='noopener noreferrer';output.append(document.createElement('br'),link);
 }
 async function load(){
  button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='กำลังอัปเดตโปรแกรม…';
  try{render(await loadChelseaNext());}catch(e){show('ยังโหลดนัดถัดไปไม่ได้',e.message);}
  finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent='ตรวจข้อมูลอีกครั้ง ↗';}
 }
 window.addEventListener('chelsea-schedule-updated',event=>render(event.detail));
 button.addEventListener('click',load);load();
}
