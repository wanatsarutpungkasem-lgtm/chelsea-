const output=document.querySelector('#fan-latest-result'),retry=document.querySelector('#fan-latest-retry');
function element(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
async function load(){
 retry.hidden=true;output.replaceChildren(element('p','กำลังโหลดบันทึกที่เผยแพร่…'));
 try{
  const config=window.OM_CHAT_CONFIG;if(!config)throw Error('configuration');
  // Only public snapshots: no session token, draft endpoint, or browser storage.
  const url=new URL('/rest/v1/journal_publications',config.supabaseUrl);
  url.search=new URLSearchParams({select:'id,content,published_at',order:'published_at.desc',limit:'1'});
  const response=await fetch(url,{headers:{apikey:config.publishableKey},credentials:'omit',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('publication unavailable');
  const rows=await response.json();if(!Array.isArray(rows))throw Error('invalid response');
  if(!rows.length){output.replaceChildren(element('h4','เรื่องราวดี ๆ กำลังรอให้เล่า'),element('p','โอห์มยังไม่ได้เผยแพร่บันทึก เมื่อพร้อมแบ่งปัน เรื่องราวล่าสุดจะปรากฏที่นี่'));return;}
  const entry=rows[0].content;
  if(!entry||typeof entry.title!=='string'||typeof entry.body!=='string')throw Error('invalid entry');
  const title=element('h4',entry.title.slice(0,120));
  const meta=element('p',[entry.opponent?'เชลซี พบ '+entry.opponent:'',entry.score,entry.mood].filter(Boolean).join(' · '));meta.className='fan-entry-meta';
  const body=element('p',entry.body.slice(0,240)+(entry.body.length>240?'…':''));
  output.replaceChildren(title,meta,body);
  if(entry.motm)output.append(element('p','นักเตะประจำเกมของโอห์ม · '+entry.motm));
  const published=new Date(rows[0].published_at);if(Number.isFinite(published.getTime()))output.append(element('small','เผยแพร่ '+new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(published)));
 }catch(error){console.warn('Public journal unavailable:',error.message);output.replaceChildren(element('h4','ยังโหลดบันทึกไม่ได้'),element('p','ลองอีกครั้ง หรือเปิดอ่านที่สมุดบันทึกได้ครับ'));retry.hidden=false;}
}
if(output&&retry){retry.addEventListener('click',load);if(document.readyState!=='complete')window.addEventListener('load',load,{once:true});else load();}
