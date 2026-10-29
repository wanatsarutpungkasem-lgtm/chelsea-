import {JOURNAL_KEY,validateEntry,parseBackup} from './journal-model.mjs';
import {createJournalStore,pendingImports,publicationLabel} from './journal-cloud.mjs';
const $=s=>document.querySelector(s),form=$('#journal-form'),status=$('#journal-status'),list=$('#journal-entries');
let entries=[],publications=[],local=[],healthy=true,owner=null,sessionUser=null,mode='public',epoch=0,authRun=0,busy=false,authMode='signin',client,store;
const tell=text=>{status.textContent=text;};
const authTell=text=>{$('#auth-status').textContent=text;};
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const readableError=error=>{
 const message=error?.message||'';
 if(/Invalid login credentials/i.test(message))return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หากยังไม่เคยสร้างบัญชีเว็บไซต์ ให้กดสร้างบัญชีครั้งแรก';
 if(/Email not confirmed/i.test(message))return 'กรุณายืนยันอีเมลจากลิงก์ที่ได้รับก่อนเข้าสู่ระบบ';
 if(/rate.limit|too many|security purposes/i.test(message))return 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
 if(/not the approved|confirmed email|permission denied|row.level|42501/i.test(message))return 'บัญชีนี้ยังไม่มีสิทธิ์เจ้าของ กรุณาใช้อีเมลเจ้าของที่ยืนยันแล้ว';
 if(/fetch|network/i.test(message))return 'เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ต ข้อความในแบบฟอร์มยังอยู่';
 return message||'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง';
};
try{const raw=localStorage.getItem(JOURNAL_KEY);if(raw)local=parseBackup(raw);}catch{healthy=false;}
function reset(){form.reset();form.elements.id.value='';$('#editor-title').textContent='เขียนบันทึกใหม่';}
function persistLocal(next){if(!healthy)throw Error('อ่านบันทึกเดิมในเครื่องไม่ได้ จึงหยุดการเขียนทับไว้');if(next.length>500)throw Error('เก็บบันทึกในเครื่องได้สูงสุด 500 เรื่อง');try{localStorage.setItem(JOURNAL_KEY,JSON.stringify({version:1,entries:next}));}catch{throw Error('พื้นที่ในเครื่องเต็มหรือถูกปิด กรุณาส่งออกไฟล์สำรอง');}local=next;entries=local;}
function controls(){
 const editable=mode==='local'||(mode==='cloud'&&owner);
 $('#journal-editor').hidden=!editable;$('#journal-backup').hidden=!editable;$('#owner-controls').hidden=!sessionUser;$('#owner-login').hidden=!!sessionUser;$('#sync-local').hidden=!owner;$('#cloud-mode').hidden=!owner;
 $('#write-entry').textContent=editable?'เขียนบันทึกใหม่ ↗':'พื้นที่เจ้าของ ↗';$('#write-entry').href=editable?'#journal-editor':'#owner-access';
 $('#save-journal').textContent=mode==='cloud'?'บันทึกฉบับร่างบนคลาวด์':'บันทึกในเบราว์เซอร์นี้';
 $('#journal-mode').textContent=mode==='cloud'?'สมุดบันทึกบนคลาวด์ · เฉพาะเจ้าของ':mode==='local'?'สมุดเดิมในเบราว์เซอร์นี้':'บันทึกที่เผยแพร่โดยโอห์ม';
 $('#mode-description').textContent=mode==='cloud'?'บันทึกร่างข้ามเครื่องได้ การเผยแพร่เป็นปุ่มแยก แก้ร่างแล้วฉบับสาธารณะจะยังไม่เปลี่ยน':mode==='local'?'เก็บเฉพาะเครื่องนี้ ยังไม่เผยแพร่หรือซิงก์ ส่งออกไฟล์สำรองไว้ก่อนล้างข้อมูลเบราว์เซอร์':'อ่านเรื่องราวหลังเกมที่โอห์มเลือกแบ่งปัน ฉบับร่างเข้าถึงได้เฉพาะบัญชีเจ้าของ';
 $('#entries-title').textContent=mode==='public'?'เรื่องราวที่โอห์มแบ่งปัน':'เรื่องราวที่บันทึกไว้';
 $('#start-memory').hidden=!editable;
}
function edit(entry){for(const key of ['id','title','matchDate','opponent','score','mood','motm','body','moment','image'])form.elements[key].value=entry[key];$('#editor-title').textContent='แก้ไขบันทึก';form.elements.title.focus();tell('กำลังแก้ไขฉบับร่าง ฉบับที่เผยแพร่จะเปลี่ยนเมื่อกดเผยแพร่อีกครั้งเท่านั้น');}
function button(text,action){const b=node('button',text,'journal-secondary');b.type='button';b.disabled=busy;b.addEventListener('click',action);return b;}
function render(){
 controls();$('#entry-count').textContent=entries.length;$('#moment-count').textContent=entries.filter(e=>e.moment).length;list.replaceChildren();
 const q=$('#journal-search').value.trim().toLocaleLowerCase(),mood=$('#mood-filter').value;
 const filtered=entries.filter(e=>(mood==='all'||e.mood===mood)&&[e.title,e.opponent,e.body,e.moment,e.motm].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>b.matchDate.localeCompare(a.matchDate)||b.createdAt.localeCompare(a.createdAt));
 if(!filtered.length){list.append(node('p',entries.length?'ไม่พบบันทึกตามตัวกรอง':mode==='public'?'โอห์มยังไม่ได้เผยแพร่บันทึกครับ กลับมาอ่านเรื่องราวหลังเกมได้ที่หน้านี้':'ยังไม่มีบันทึก เริ่มเขียนจากแมตช์ที่โอมเลือกได้เลยครับ','journal-empty'));return;}
 for(const e of filtered){
  const card=node('article',undefined,'journal-entry');const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(e.matchDate+'T00:00:00Z'));
  card.append(node('small',date+' · เชลซี พบ '+e.opponent),node('h3',e.title));
  if(mode==='cloud')card.append(node('p',publicationLabel(e,publications),'entry-state'));
  if(e.mood)card.append(node('span',e.mood,'entry-tag'));if(e.score)card.append(node('p','สกอร์ที่บันทึก: '+e.score));
  if(e.image){const img=node('img');img.src='assets/images/'+e.image;img.alt='ภาพจากคอลเลกชันประกอบบันทึก';img.loading='lazy';card.append(img);}
  card.append(node('p',e.body));if(e.motm)card.append(node('p','นักเตะที่ผมประทับใจ: '+e.motm));if(e.moment)card.append(node('blockquote',e.moment));
  if(mode!=='public')card.append(button('แก้ไขบันทึก',()=>edit(e)));
  if(mode==='cloud'&&owner){const actions=node('div',undefined,'journal-actions');actions.append(button(publications.some(p=>p.id===e.id)?'เผยแพร่ฉบับแก้ไข':'เผยแพร่บันทึกนี้',()=>run(async()=>{await requireOwner();await store.publish(e.id);await reload('cloud');tell('เผยแพร่ฉบับที่บันทึกไว้แล้ว ผู้เยี่ยมชมอ่านได้ทันที');})));
   if(publications.some(p=>p.id===e.id))actions.append(button('นำออกจากหน้าสาธารณะ',()=>run(async()=>{await requireOwner();await store.unpublish(e.id);await reload('cloud');tell('นำออกจากหน้าสาธารณะแล้ว ฉบับร่างยังอยู่บนคลาวด์');})));
   card.append(actions);
  }list.append(card);
 }
}
async function run(action){if(busy)return;busy=true;form.querySelector('button[type=submit]').disabled=true;render();try{await action();}catch(error){tell(readableError(error));authTell(readableError(error));}finally{busy=false;form.querySelector('button[type=submit]').disabled=false;render();}}
async function requireOwner(){if(!client||!owner)throw Error('กรุณาเข้าสู่ระบบเจ้าของก่อน');const {data,error}=await client.auth.getUser();if(error&&(!error.status||error.status>=500))throw error;if(error||data.user?.id!==owner.id){clearPrivate();throw Error('session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');}const result=await client.rpc('is_chat_owner');if(result.error||result.data!==true){clearPrivate();throw Error('บัญชีนี้ยังไม่มีสิทธิ์เจ้าของ');}return data.user;}
function clearPrivate(invalidate=true){if(invalidate)authRun++;epoch++;owner=null;sessionUser=null;mode='public';entries=[];publications=[];reset();tell('');render();}
async function reload(nextMode){
 const request=++epoch;mode=nextMode;entries=[];publications=[];render();
 if(mode==='local'){entries=local;render();tell(healthy?'บันทึกเดิมยังอยู่ในเครื่อง การนำขึ้นคลาวด์ต้องกดแยกต่างหาก':'อ่านบันทึกเดิมไม่ได้ จึงหยุดเขียนทับไว้');return;}
 if(!store){tell('เชื่อมต่อคลาวด์ไม่ได้ ยังเปิดสมุดในเครื่องและส่งออกไฟล์สำรองได้');return;}
 try{
  const published=await store.publications();let next=published.map(p=>validateEntry(p.content));
  if(nextMode==='cloud'){await requireOwner();next=await store.drafts();}
  if(request!==epoch)return;publications=published;entries=next;render();
 }catch(error){if(request===epoch){entries=[];render();tell('โหลดบันทึกไม่สำเร็จ: '+readableError(error));}}
}
async function refreshAuth(){
 if(!client)return;const request=++authRun;
 const {data,error}=await client.auth.getUser();if(request!==authRun)return;
 if(!error&&owner&&data.user?.id===owner.id){
  const check=await client.rpc('is_chat_owner');if(request!==authRun)return;
  if(!check.error&&check.data===true){sessionUser=data.user;owner=data.user;authTell('เข้าสู่ระบบเจ้าของแล้ว · ฉบับร่างอ่านได้เฉพาะโอม');render();return;}
 }
 clearPrivate(false);
 if(error||!data.user){authTell('เข้าสู่ระบบเพื่อเขียนฉบับร่างและเผยแพร่บันทึกของโอห์ม');await reload('public');return;}
 sessionUser=data.user;const claim=await client.rpc('claim_chat_owner');if(request!==authRun)return;
 if(claim.error||claim.data!==true){authTell('เข้าสู่ระบบแล้ว แต่บัญชีนี้ไม่มีสิทธิ์เจ้าของ');await reload('public');return;}
 owner=data.user;authTell('เข้าสู่ระบบเจ้าของแล้ว · ฉบับร่างอ่านได้เฉพาะโอม');await reload('cloud');
}
form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 const value=Object.fromEntries(new FormData(form)),previous=entries.find(e=>e.id===value.id),now=new Date().toISOString();const entry=validateEntry({...value,id:previous?.id||crypto.randomUUID(),createdAt:previous?.createdAt||now,updatedAt:now});
 if(mode==='local'){persistLocal(previous?local.map(e=>e.id===entry.id?entry:e):[...local,entry]);reset();tell('บันทึกในเบราว์เซอร์นี้แล้ว ยังไม่ได้ส่งขึ้นคลาวด์');}
 else if(mode==='cloud'){const user=await requireOwner();await store.save(entry,user.id,previous);reset();await reload('cloud');tell('บันทึกฉบับร่างบนคลาวด์แล้ว ยังไม่เปลี่ยนฉบับสาธารณะ');}
 else throw Error('กรุณาเข้าสู่ระบบเจ้าของก่อนเขียนบันทึก');
 });});
function chooseAuthMode(next){
 authMode=next;const login=$('#owner-login');login.elements.password.value='';login.elements.confirmPassword.value='';
 $('#confirm-password-field').hidden=next!=='signup';login.elements.confirmPassword.required=next==='signup';
 login.elements.password.autocomplete=next==='signup'?'new-password':'current-password';login.elements.password.minLength=next==='signup'?8:6;
 $('#auth-submit').textContent=next==='signup'?'สร้างบัญชีและส่งอีเมลยืนยัน':'เข้าสู่ระบบ';
 $('#owner-signup').textContent=next==='signup'?'มีบัญชีเว็บไซต์แล้ว → เข้าสู่ระบบ':'ยังไม่มีบัญชี → สร้างบัญชีเว็บครั้งแรก';
 authTell(next==='signup'?'ขั้นที่ 1: ตั้งรหัสผ่านเว็บไซต์อย่างน้อย 8 ตัวอักษร · ขั้นที่ 2: ยืนยันอีเมล · ขั้นที่ 3: กลับมาเข้าสู่ระบบ':'ใช้อีเมลและรหัสผ่านที่สร้างสำหรับเว็บไซต์นี้ หากยังไม่เคยสมัคร ให้เลือกสร้างบัญชีครั้งแรก');
}
$('#owner-signup').addEventListener('click',()=>{if(!busy)chooseAuthMode(authMode==='signup'?'signin':'signup');});
$('#owner-login').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 if(!client)throw Error('ระบบล็อกอินยังเชื่อมต่อไม่ได้');
 const login=event.target,{email,password,confirmPassword}=Object.fromEntries(new FormData(login));
 if(authMode==='signup'){
  if(password!==confirmPassword)throw Error('รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน');
  authTell('กำลังสร้างบัญชีเว็บไซต์…');
  const result=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:new URL('dashboard.html',location.href).href}});
  login.elements.password.value='';login.elements.confirmPassword.value='';if(result.error)throw result.error;
  if(result.data.session)await refreshAuth();else {chooseAuthMode('signin');authTell('ขั้นที่ 2: เปิดอีเมลยืนยันบัญชีและกดลิงก์ยืนยัน จากนั้นกลับมากรอกรหัสผ่านที่เพิ่งตั้ง แล้วกดเข้าสู่ระบบ');}
 }else{
  authTell('กำลังเข้าสู่ระบบ…');const result=await client.auth.signInWithPassword({email:email.trim(),password});login.elements.password.value='';if(result.error)throw result.error;await refreshAuth();
 }
});});
$('#owner-signout').addEventListener('click',()=>run(async()=>{clearPrivate();const result=await client.auth.signOut();if(result.error)throw result.error;await reload('public');authTell('ออกจากระบบแล้ว แสดงเฉพาะบันทึกสาธารณะ');}));
$('#cloud-mode').addEventListener('click',()=>{if(busy)return;reset();reload('cloud');});
$('#local-mode').addEventListener('click',()=>{if(busy)return;reset();reload('local');});$('#public-mode').addEventListener('click',()=>{if(busy)return;reset();reload('public');});
$('#sync-local').addEventListener('click',()=>run(async()=>{const user=await requireOwner();if(!healthy)throw Error('อ่านบันทึกในเครื่องไม่ได้ กรุณานำเข้าจากไฟล์สำรอง');const drafts=await store.drafts();const pending=pendingImports(local,drafts);if(drafts.length+pending.length>500)throw Error('นำเข้ารวมกันได้สูงสุด 500 เรื่อง');for(const entry of pending)await store.save(entry,user.id,null);await reload('cloud');tell('นำขึ้นคลาวด์เป็นร่าง '+pending.length+' เรื่อง ข้อมูลเดิมในเครื่องยังอยู่ และยังไม่ได้เผยแพร่');}));
$('#cancel-edit').addEventListener('click',()=>{reset();tell('ล้างเฉพาะแบบฟอร์มแล้ว บันทึกเดิมยังอยู่');});
$('#start-memory').addEventListener('click',()=>{if([...form.querySelectorAll('input:not([type=hidden]),textarea')].some(e=>e.value)&&!confirm('แทนข้อความที่ยังไม่บันทึกด้วยข้อมูลนัดชิงสโมสรโลกไหมครับ?'))return;reset();form.elements.title.value='วันที่เชลซีเป็นแชมป์โลก';form.elements.matchDate.value='2025-07-13';form.elements.opponent.value='Paris Saint-Germain';form.elements.score.value='เชลซี 3–0 PSG';form.elements.body.focus();tell('เติมข้อเท็จจริงการแข่งขันแล้ว ความรู้สึกของโอมรอให้เล่าด้วยตัวเองครับ');});
$('#journal-search').addEventListener('input',render);$('#mood-filter').addEventListener('change',render);
$('#export-journal').addEventListener('click',()=>{if(mode==='public')return;if(mode==='local'&&!healthy){tell('อ่านบันทึกเดิมไม่ได้ จึงยังสร้างไฟล์สำรองที่สมบูรณ์ไม่ได้');return;}const blob=new Blob([JSON.stringify({version:1,entries:entries.map(validateEntry)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='ohm-blue-journal-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);tell('สร้างไฟล์สำรองฉบับร่างแล้ว ไฟล์นี้อาจมีเรื่องราวส่วนตัว เก็บไว้กับโอมครับ');});
$('#import-journal').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;run(async()=>{if(file.size>2_000_000)throw Error('ไฟล์ใหญ่เกิน 2 MB');const imported=parseBackup(await file.text()),added=pendingImports(imported,entries);if(entries.length+added.length>500)throw Error('รวมบันทึกได้สูงสุด 500 เรื่อง');if(mode==='local')persistLocal([...local,...added]);else if(mode==='cloud'){const user=await requireOwner();for(const entry of added)await store.save(entry,user.id,null);await reload('cloud');}else throw Error('กรุณาเข้าสู่ระบบเจ้าของก่อนนำเข้า');tell('นำเข้าเป็นร่าง '+added.length+' เรื่อง โดยไม่ทับรหัสเดิมและยังไม่เผยแพร่');});event.target.value='';});
try{const config=window.OM_CHAT_CONFIG;if(!window.supabase||!config)throw Error();client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:'ohm.journal.auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});store=createJournalStore(client);
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearPrivate();setTimeout(()=>refreshAuth(),0);}else if(event==='TOKEN_REFRESHED'){if(owner)setTimeout(()=>requireOwner().catch(error=>{tell(readableError(error));}),0);}else if(['SIGNED_IN','INITIAL_SESSION','USER_UPDATED'].includes(event))setTimeout(()=>refreshAuth(),0);});
}catch{authTell('ระบบคลาวด์ยังเชื่อมต่อไม่ได้ สามารถเปิดสมุดเดิมในเครื่องและสำรองไฟล์ไว้ได้');}
render();if(client)refreshAuth();
