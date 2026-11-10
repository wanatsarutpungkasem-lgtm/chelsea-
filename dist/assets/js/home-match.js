(() => {
 'use strict';
 const button=document.querySelector('#home-match-load'), output=document.querySelector('#home-match-result');
 if(!button||!output)return;
 function show(title,detail){const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=detail;output.replaceChildren(h,p);}
 button.addEventListener('click',async()=>{
  button.disabled=true;button.textContent='กำลังตรวจโปรแกรม…';
  show('กำลังค้นหาโปรแกรมเชลซี','ข้อมูลจาก API-Football');
  try{
   const params=new URLSearchParams({mode:'fixtures',upcoming:'1',teams:JSON.stringify(['Chelsea']),league:'39'});
   const response=await fetch('/api/football?'+params,{credentials:'omit',signal:AbortSignal.timeout(20000)});
   let data;try{data=await response.json();}catch{throw new Error('บริการฟุตบอลยังไม่พร้อม กรุณาลองอีกครั้งภายหลัง');}
   if(!response.ok)throw new Error(data.error?.message||'โหลดโปรแกรมไม่สำเร็จ');
   const fixture=data.fixtures?.find(f=>f.league?.name==='Premier League'&&[f.home?.name,f.away?.name].includes('Chelsea'));
   if(!fixture){show('ยังไม่พบคู่เชลซีในช่วงนี้','ค้นเฉพาะวันนี้และพรุ่งนี้ในพรีเมียร์ลีก นัดถัดไปอาจอยู่นอกช่วงที่ค้นได้');return;}
   const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(fixture.date));
   show(fixture.home.name+' vs '+fixture.away.name,date+' น. · '+(fixture.status==='TBD'?'รอยืนยันเวลา':'ยังไม่เริ่มแข่งขัน'));
   if(data.fetchedAt){const stamp=document.createElement('small');stamp.textContent='ข้อมูลจาก API-Football · ตรวจเมื่อ '+new Intl.DateTimeFormat('th-TH',{timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(data.fetchedAt));output.append(stamp);}
  }catch(error){show('ยังตรวจโปรแกรมไม่ได้',error.name==='TimeoutError'?'การเชื่อมต่อใช้เวลานาน กรุณาลองใหม่':error.message);}
  finally{button.disabled=false;button.textContent='ตรวจโปรแกรมอีกครั้ง ↗';}
 });
})();
