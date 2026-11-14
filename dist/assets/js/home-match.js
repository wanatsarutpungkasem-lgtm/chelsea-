import {loadChelseaWeek,kickoff} from './chelsea-week.mjs';
const button=document.querySelector('#home-match-load'),output=document.querySelector('#home-match-result');
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
button?.addEventListener('click',async()=>{
 button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='กำลังตรวจโปรแกรม…';output.setAttribute('aria-busy','true');
 output.replaceChildren(el('p','กำลังตรวจตารางเชลซีจากสโมสร…'));
 try{
  const data=await loadChelseaWeek();output.replaceChildren(el('p',`${data.from} — ${data.through} · เวลาไทย`,'week-range'));
  if(!data.fixtures.length){output.append(el('h3','ยังไม่มีเกมในช่วงนี้'),el('p','ไม่พบเกมพรีเมียร์ลีกของเชลซีในช่วงที่ค้นจากตารางที่ได้รับ'));
   if(data.nextFixture)output.append(el('p',`นัดถัดไปนอกช่วงนี้: ${data.nextFixture.home} พบ ${data.nextFixture.away} · ${kickoff(data.nextFixture)}`));
  }
  for(const f of data.fixtures){const card=el('article','','week-fixture');card.append(el('span','PREMIER LEAGUE','week-badge'),el('h3',`${f.home} พบ ${f.away}`),el('p',kickoff(f)));if(f.venue)card.append(el('small',f.venue));output.append(card);}
  output.append(el('small',`${data.delivery==='snapshot'?'ตารางสำรอง':'Chelsea FC'} · ตรวจข้อมูล ${new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(data.fetchedAt))}${data.stale?' · เกิน 7 วัน กรุณาตรวจยืนยัน':''}`));
  const source=el('a','ตรวจตารางจากสโมสร ↗','week-source');source.href='https://www.chelseafc.com/en/matches/mens-fixtures-and-results';source.target='_blank';source.rel='noopener noreferrer';output.append(source);
 }catch(error){output.replaceChildren(el('h3','ยังตรวจโปรแกรมไม่ได้'),el('p',error.message));}
 finally{button.disabled=false;button.removeAttribute('aria-busy');output.removeAttribute('aria-busy');button.textContent='ตรวจโปรแกรม 7 วันอีกครั้ง ↗';}
});
