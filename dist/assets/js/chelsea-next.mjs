const snapshotUrl=new URL('../../data/chelsea-next.json',import.meta.url);
let pending,latest;
export function upcomingFrom(data,now=new Date()){
 if(!Array.isArray(data?.fixtures)||!Number.isFinite(Date.parse(data.fetchedAt)))throw new Error('ยังไม่มีข้อมูลโปรแกรมที่ตรวจสอบได้');
 const fixtures=data.fixtures.filter(f=>f.competition==='Premier League'&&[f.home,f.away].includes('Chelsea')&&Date.parse(f.date)>now.getTime()).sort((a,b)=>a.date.localeCompare(b.date));
 return {...data,kind:'chelsea-next',fixture:fixtures[0]||null,fixtures:fixtures.slice(0,3),stale:now.getTime()-Date.parse(data.fetchedAt)>7*86400000};
}
function refreshFromServer(){
 if(pending)return pending;
 pending=(async()=>{
  const r=await fetch('/api/chelsea-next',{credentials:'omit',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('ยังโหลดโปรแกรมนัดถัดไปไม่ได้');
  const data=upcomingFrom(await r.json());latest={data,loaded:Date.now()};
  window.dispatchEvent(new CustomEvent('chelsea-schedule-updated',{detail:data}));return data;
 })().finally(()=>{pending=null});return pending;
}
export async function loadChelseaNext(){
 if(latest&&Date.now()-latest.loaded<300000)return upcomingFrom(latest.data);
 try{
  const r=await fetch(snapshotUrl,{credentials:'omit',cache:'no-cache',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error();
  const data=upcomingFrom({...await r.json(),delivery:'snapshot'});latest={data,loaded:Date.now()};
  // Show a dated snapshot immediately; a newer server result updates the card when ready.
  refreshFromServer().catch(()=>{});return data;
 }catch{return refreshFromServer();}
}
export function fixtureTime(fixture){
 const d=new Date(fixture.date);
 if(fixture.timeConfirmed===false)return new Intl.DateTimeFormat('th-TH',{dateStyle:'full',timeZone:'Europe/London'}).format(d)+' · รอยืนยันเวลาเริ่มแข่ง';
 return new Intl.DateTimeFormat('th-TH',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(d)+' น. · เวลาไทย';
}
export function freshness(data){
 const stamp=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(data.fetchedAt));
 return (data.stale?'ข้อมูลสำรองเกิน 7 วัน กรุณาตรวจยืนยันกับสโมสร · ':data.delivery==='snapshot'?'ตารางสำรองล่าสุด · ':'')+'อัปเดต '+stamp+' · โปรแกรมอาจเปลี่ยนแปลง';
}
