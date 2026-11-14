export function weeklyQuestion(text){
 return /เชลซี|chelsea/iu.test(text)&&/สัปดาห์|อาทิตย์|7\s*วัน|เจ็ดวัน|นัดหน้า|นัดถัดไป|เตะวันไหน|เจอใคร|next\s+match|this\s+week/iu.test(text)&&!/line[ -]?up|ไลน์|ตัวจริง|โอกาส|คาดการณ์|%|\d{4}-\d{2}-\d{2}/iu.test(text);
}
export async function loadChelseaWeek(){
 const response=await fetch('/api/chelsea-next?scope=week',{credentials:'omit',signal:AbortSignal.timeout(18000)});
 let data;try{data=await response.json();}catch{throw Error('ยังอ่านโปรแกรมเชลซีไม่ได้ กรุณาลองใหม่');}
 if(!response.ok)throw Error(data.error?.message||'ระบบโปรแกรมเชลซียังไม่พร้อม');
 if(data.kind!=='chelsea-week'||!Array.isArray(data.fixtures))throw Error('รูปแบบโปรแกรมไม่ถูกต้อง');return data;
}
export function kickoff(f){return new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'full',...(f.timeConfirmed===false?{}:{timeStyle:'short'})}).format(new Date(f.date))+(f.timeConfirmed===false?' · รอยืนยันเวลา':' น. · เวลาไทย');}
export function weekSummary(data){
 const lines=[`โปรแกรมเชลซี พรีเมียร์ลีก · ${data.from} ถึง ${data.through}`];
 if(data.fixtures.length)for(const f of data.fixtures)lines.push(`${f.home} พบ ${f.away}\n${kickoff(f)}${f.venue?' · '+f.venue:''}`);
 else lines.push('ไม่พบเกมพรีเมียร์ลีกของเชลซีในช่วง 7 วันข้างหน้าในตารางที่ได้รับ');
 if(!data.fixtures.length&&data.nextFixture)lines.push(`นัดถัดไปอยู่นอกช่วงนี้: ${data.nextFixture.home} พบ ${data.nextFixture.away}\n${kickoff(data.nextFixture)}`);
 lines.push(`${data.delivery==='snapshot'?'ตารางสำรองที่บันทึกไว้':'ข้อมูลจาก Chelsea FC'} · ตรวจข้อมูล ${new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.fetchedAt))}`);
 if(data.stale)lines.push('ตารางสำรองเกิน 7 วันแล้ว กรุณาตรวจยืนยันกับสโมสร');
 lines.push('โปรแกรมอาจเปลี่ยนแปลงตามประกาศสโมสร');return lines.join('\n\n');
}
