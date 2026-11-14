export const SOURCE_URL='https://www.chelseafc.com/en/matches/mens-fixtures-and-results';
export const FEED_URL='https://www.chelseafc.com/en/api/fixtures/upcoming?pageId=30EGwHPO9uwBCc75RQY6kg';
const MONTHS={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
// The club's feed uses London local time; account for GMT/BST before displaying Bangkok time.
export function londonKickoff(date,time){
 const m=/^(?:\w{3} )?(\d{1,2}) (\w{3}) (\d{4})$/.exec(date||''), t=/^(\d{2}):(\d{2})$/.exec(time||'');
 if(!m||!t||MONTHS[m[2]]===undefined||+t[1]>23||+t[2]>59)return null;
 const utc=Date.UTC(+m[3],MONTHS[m[2]],+m[1],+t[1],+t[2]);
 const day=new Date(utc);if(day.getUTCDate()!==+m[1])return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(day).map(p=>[p.type,p.value]));
 const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);
 return new Date(utc-(local-utc)).toISOString();
}
export function normalizeSchedule(data,fetchedAt=new Date().toISOString()){
 if(!Array.isArray(data?.items))throw new Error('Unrecognized club schedule');
 const rows=data.items.flatMap(group=>Array.isArray(group.items)?group.items:[]);
 const fixtures=rows.filter(r=>r.competition==='Premier League'&&!r.isResult&&!r.isLive&&!r.postponed&&r.status==='PreMatch'&&[r.matchUp?.home?.clubName,r.matchUp?.away?.clubName].includes('Chelsea')).map(r=>{
  const date=londonKickoff(r.kickoffDate,r.kickoffTime);
  if(!date)return null;
  return {id:String(r.optaId||r.id),home:r.matchUp.home.clubName,away:r.matchUp.away.clubName,date,timeConfirmed:!r.tbc,venue:typeof r.venue==='string'?r.venue:'',competition:'Premier League'};
 }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
 return {schemaVersion:1,source:'Chelsea FC · โปรแกรมทีมชาย',sourceUrl:SOURCE_URL,fetchedAt,fixtures};
}
export function selectNext(snapshot,now=new Date(),delivery='snapshot'){
 if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.fixtures)||!Number.isFinite(Date.parse(snapshot.fetchedAt)))throw new Error('Invalid schedule snapshot');
 const fixtures=snapshot.fixtures.filter(f=>f.competition==='Premier League'&&[f.home,f.away].includes('Chelsea')&&Number.isFinite(Date.parse(f.date))&&Date.parse(f.date)>now.getTime()).sort((a,b)=>a.date.localeCompare(b.date));
 return {...snapshot,kind:'chelsea-next',fixtures:fixtures.slice(0,3),fixture:fixtures[0]||null,delivery,stale:now.getTime()-Date.parse(snapshot.fetchedAt)>7*86400000,note:'พรีเมียร์ลีกทีมชาย · โปรแกรมและเวลาอาจเปลี่ยนแปลงตามประกาศสโมสร'};
}
export async function fetchClubSchedule(fetcher=fetch,now=new Date()){
 const response=await fetcher(FEED_URL,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Club schedule unavailable');
 if(!response.headers.get('content-type')?.includes('json'))throw new Error('Unexpected schedule format');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000)throw new Error('Schedule too large');chunks.push(value);}}catch(e){await reader.cancel();throw e;}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return normalizeSchedule(JSON.parse(new TextDecoder().decode(bytes)),now.toISOString());
}

// Bangkok calendar window: today through the seventh day ahead, future kickoffs only.
export function selectWeek(snapshot,now=new Date(),delivery='club'){
 const data=selectNext(snapshot,now,delivery);
 const date=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const from=date(now),end=new Date(from+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+7);const through=end.toISOString().slice(0,10);
 const fixtures=snapshot.fixtures.filter(f=>f.competition==='Premier League'&&[f.home,f.away].includes('Chelsea')&&Date.parse(f.date)>now.getTime()&&date(new Date(f.date))<=through).sort((a,b)=>a.date.localeCompare(b.date));
 return {...data,kind:'chelsea-week',from,through,fixtures,fixture:fixtures[0]||null,nextFixture:data.fixture,note:'พรีเมียร์ลีกทีมชาย · วันนี้ถึง 7 วันข้างหน้า · เวลาไทย · โปรแกรมอาจเปลี่ยนแปลง'};
}
