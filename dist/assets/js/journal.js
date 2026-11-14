import {ownerAccessResult} from './auth-access.mjs';
import {createConfirmationResender} from './auth-confirmation.mjs';
import {JOURNAL_KEY,validateEntry,parseBackup} from './journal-model.mjs';
import {createJournalStore,pendingImports,publicationLabel} from './journal-cloud.mjs';
const $=s=>document.querySelector(s),form=$('#journal-form'),status=$('#journal-status'),list=$('#journal-entries');
let recoveryFlow=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
let confirmationSender;
let entries=[],publications=[],local=[],healthy=true,owner=null,sessionUser=null,mode='public',epoch=0,authRun=0,busy=false,authMode='signin',loading=false,loadFailed=false,client,store;
const tell=text=>{status.textContent=text;};
const authTell=text=>{$('#auth-status').textContent=text;};
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const readableError=error=>{
 const message=error?.message||'';
 if(error?.code==='23505')return 'มีบันทึกรหัสเดียวกันแล้ว กรุณากดโหลดข้อมูลใหม่แล้วนำเข้าอีกครั้ง ข้อมูลทั้งชุดยังไม่ถูกนำเข้า';
 if(/Invalid login credentials/i.test(message))return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หากยังไม่เคยสร้างบัญชีเว็บไซต์ ให้กดสร้างบัญชีครั้งแรก';
 if(/Email not confirmed/i.test(message))return 'ยังไม่ได้ยืนยันอีเมล กดส่งอีเมลยืนยันอีกครั้ง แล้วเปิดลิงก์จากกล่องจดหมายครับ';
 if(/expired|otp_expired|invalid.*token/i.test(message))return 'ลิงก์หมดอายุหรือใช้แล้ว กรุณาขอลิงก์ใหม่';
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
 $('#journal-editor').hidden=!editable;$('#journal-backup').hidden=!editable;$('#owner-controls').hidden=!sessionUser;$('#owner-login').hidden=!!sessionUser&&!recoveryFlow;$('#sync-local').hidden=!owner;$('#cloud-mode').hidden=!owner;
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
 if(!filtered.length){list.append(node('p',loading?'กำลังโหลดบันทึก…':loadFailed?'ยังโหลดบันทึกไม่ได้ กดโหลดข้อมูลใหม่เพื่อลองอีกครั้ง':entries.length?'ไม่พบบันทึกตามตัวกรอง':mode==='public'?'โอห์มยังไม่ได้เผยแพร่บันทึกครับ กลับมาอ่านเรื่องราวหลังเกมได้ที่หน้านี้':'ยังไม่มีบันทึก เริ่มเขียนจากแมตช์ที่โอมเลือกได้เลยครับ','journal-empty'));return;}
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
function clearPrivate(invalidate=true){if(invalidate)authRun++;epoch++;loading=false;loadFailed=false;owner=null;sessionUser=null;mode='public';entries=[];publications=[];reset();tell('');render();}
async function reload(nextMode){
 const request=++epoch;mode=nextMode;entries=[];publications=[];loading=nextMode!=='local';loadFailed=false;render();
 if(mode==='local'){entries=local;render();tell(healthy?'บันทึกเดิมยังอยู่ในเครื่อง การนำขึ้นคลาวด์ต้องกดแยกต่างหาก':'อ่านบันทึกเดิมไม่ได้ จึงหยุดเขียนทับไว้');return;}
 if(!store){loading=false;loadFailed=true;render();tell('เชื่อมต่อคลาวด์ไม่ได้ ยังเปิดสมุดในเครื่องและส่งออกไฟล์สำรองได้');return;}
 try{
  const published=await store.publications();let next=published.map(p=>validateEntry(p.content));
  if(nextMode==='cloud'){await requireOwner();next=await store.drafts();}
  if(request!==epoch)return;publications=published;entries=next;render();
 }catch(error){if(request===epoch){entries=[];loadFailed=true;tell('โหลดบันทึกไม่สำเร็จ: '+readableError(error));}}finally{if(request===epoch){loading=false;render();}}
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
 const access=ownerAccessResult(claim);
 if(access!=='owner'){authTell(access==='unavailable'?'เข้าสู่ระบบแล้ว แต่ยังตรวจสิทธิ์เจ้าของไม่ได้ กรุณาลองใหม่':'เข้าสู่ระบบสมาชิกแล้ว · สิทธิ์เขียนบันทึกสงวนให้เจ้าของ');await reload('public');}
 else{owner=data.user;authTell('เข้าสู่ระบบเจ้าของแล้ว · ฉบับร่างอ่านได้เฉพาะโอห์ม');await reload('cloud');}
 if(!recoveryFlow){document.querySelector('#membership-dialog')?.close();if(location.hash==='#owner-access')history.replaceState(null,'',location.pathname+location.search+'#dashboard');}
}
form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 const value=Object.fromEntries(new FormData(form)),previous=entries.find(e=>e.id===value.id),now=new Date().toISOString();const entry=validateEntry({...value,id:previous?.id||crypto.randomUUID(),createdAt:previous?.createdAt||now,updatedAt:now});
 if(mode==='local'){persistLocal(previous?local.map(e=>e.id===entry.id?entry:e):[...local,entry]);reset();tell('บันทึกในเบราว์เซอร์นี้แล้ว ยังไม่ได้ส่งขึ้นคลาวด์');}
 else if(mode==='cloud'){const user=await requireOwner();await store.save(entry,user.id,previous);reset();await reload('cloud');tell('บันทึกฉบับร่างบนคลาวด์แล้ว ยังไม่เปลี่ยนฉบับสาธารณะ');}
 else throw Error('กรุณาเข้าสู่ระบบเจ้าของก่อนเขียนบันทึก');
 });});
function chooseAuthMode(next){
 authMode=next;const login=$('#owner-login'),signup=next==='signup',resetting=next==='reset',updating=next==='update';
 login.elements.password.value='';login.elements.confirmPassword.value='';
 login.elements.email.closest('label').hidden=updating;login.elements.email.required=!updating;
 login.elements.password.closest('label').hidden=resetting;login.elements.password.required=!resetting;
 $('#confirm-password-field').hidden=!(signup||updating);login.elements.confirmPassword.required=signup||updating;
 login.elements.password.autocomplete=signup||updating?'new-password':'current-password';login.elements.password.minLength=signup||updating?8:6;
 $('#auth-submit').textContent=signup?'สร้างบัญชี':resetting?'ส่งลิงก์กู้รหัสผ่าน':updating?'บันทึกรหัสผ่านใหม่':'เข้าสู่ระบบ';
 $('#owner-signup').textContent=signup||resetting?'มีบัญชีแล้ว → เข้าสู่ระบบ':'สร้างบัญชีใหม่';$('#owner-signup').hidden=updating;
 $('#forgot-password')?.toggleAttribute('hidden',next!=='signin');$('#resend-confirmation')?.toggleAttribute('hidden',next!=='signin');
 login.querySelector('.oauth-options')?.toggleAttribute('hidden',resetting||updating);login.querySelector('.oauth-divider')?.toggleAttribute('hidden',resetting||updating);
 document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===next)));
 authTell(signup?'สมัครด้วยอีเมลและรหัสผ่านอย่างน้อย 8 ตัวอักษร แล้วเปิดลิงก์ยืนยันในอีเมล':resetting?'ใส่อีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่':updating?'ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร':'ยินดีต้อนรับกลับมา เข้าสู่ระบบเพื่อเปิดพื้นที่ของคุณ');
}
$('#owner-signup').addEventListener('click',()=>{if(!busy)chooseAuthMode(authMode==='signin'?'signup':'signin');});
$('#owner-login').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 if(!client)throw Error('ระบบล็อกอินยังเชื่อมต่อไม่ได้');
 const login=event.target,{email,password,confirmPassword}=Object.fromEntries(new FormData(login));
 if(authMode==='reset'){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('กรอกอีเมลให้ถูกต้องก่อนครับ');
  const result=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:new URL('dashboard.html',location.href).href});if(result.error)throw result.error;
  chooseAuthMode('signin');authTell('หากอีเมลนี้มีบัญชี จะได้รับลิงก์กู้รหัสผ่าน กรุณาตรวจกล่องจดหมายและสแปม');return;
 }
 if(authMode==='update'){
  if(password.length<8||password!==confirmPassword)throw Error('รหัสผ่านใหม่ต้องตรงกันและยาวอย่างน้อย 8 ตัวอักษร');
  const result=await client.auth.updateUser({password});login.elements.password.value='';login.elements.confirmPassword.value='';if(result.error)throw result.error;
  recoveryFlow=false;chooseAuthMode('signin');await refreshAuth();tell('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');return;
 }
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
$('#refresh-journal').addEventListener('click',()=>{if(busy)return;if([...form.querySelectorAll('input:not([type=hidden]),textarea')].some(e=>e.value)&&!confirm('โหลดข้อมูลใหม่และล้างข้อความที่ยังไม่บันทึกในแบบฟอร์มไหมครับ?'))return;reset();tell('');reload(mode);});
$('#cloud-mode').addEventListener('click',()=>{if(busy)return;reset();reload('cloud');});
$('#local-mode').addEventListener('click',()=>{if(busy)return;reset();reload('local');$('#membership-dialog')?.close();location.hash='journal-editor';});$('#public-mode').addEventListener('click',()=>{if(busy)return;reset();reload('public');$('#membership-dialog')?.close();location.hash='dashboard';});
$('#sync-local').addEventListener('click',()=>run(async()=>{const user=await requireOwner();if(!healthy)throw Error('อ่านบันทึกในเครื่องไม่ได้ กรุณานำเข้าจากไฟล์สำรอง');const drafts=await store.drafts();const pending=pendingImports(local,drafts);if(drafts.length+pending.length>500)throw Error('นำเข้ารวมกันได้สูงสุด 500 เรื่อง');await store.importDrafts(pending,user.id);await reload('cloud');tell('นำขึ้นคลาวด์เป็นร่าง '+pending.length+' เรื่อง ข้อมูลเดิมในเครื่องยังอยู่ และยังไม่ได้เผยแพร่');}));
$('#cancel-edit').addEventListener('click',()=>{reset();tell('ล้างเฉพาะแบบฟอร์มแล้ว บันทึกเดิมยังอยู่');});
$('#start-memory').addEventListener('click',()=>{if([...form.querySelectorAll('input:not([type=hidden]),textarea')].some(e=>e.value)&&!confirm('แทนข้อความที่ยังไม่บันทึกด้วยข้อมูลนัดชิงสโมสรโลกไหมครับ?'))return;reset();form.elements.title.value='วันที่เชลซีเป็นแชมป์โลก';form.elements.matchDate.value='2025-07-13';form.elements.opponent.value='Paris Saint-Germain';form.elements.score.value='เชลซี 3–0 PSG';form.elements.body.focus();tell('เติมข้อเท็จจริงการแข่งขันแล้ว ความรู้สึกของโอมรอให้เล่าด้วยตัวเองครับ');});
$('#journal-search').addEventListener('input',render);$('#mood-filter').addEventListener('change',render);
$('#export-journal').addEventListener('click',()=>{if(mode==='public')return;if(mode==='local'&&!healthy){tell('อ่านบันทึกเดิมไม่ได้ จึงยังสร้างไฟล์สำรองที่สมบูรณ์ไม่ได้');return;}const blob=new Blob([JSON.stringify({version:1,entries:entries.map(validateEntry)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='ohm-blue-journal-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);tell('สร้างไฟล์สำรองฉบับร่างแล้ว ไฟล์นี้อาจมีเรื่องราวส่วนตัว เก็บไว้กับโอมครับ');});
$('#import-journal').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;run(async()=>{if(file.size>2_000_000)throw Error('ไฟล์ใหญ่เกิน 2 MB');const imported=parseBackup(await file.text()),added=pendingImports(imported,entries);if(entries.length+added.length>500)throw Error('รวมบันทึกได้สูงสุด 500 เรื่อง');if(mode==='local')persistLocal([...local,...added]);else if(mode==='cloud'){const user=await requireOwner();await store.importDrafts(added,user.id);await reload('cloud');}else throw Error('กรุณาเข้าสู่ระบบเจ้าของก่อนนำเข้า');tell('นำเข้าเป็นร่าง '+added.length+' เรื่อง โดยไม่ทับรหัสเดิมและยังไม่เผยแพร่');});event.target.value='';});
try{const config=window.OM_CHAT_CONFIG;if(!window.supabase||!config)throw Error();client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:'ohm.journal.auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});store=createJournalStore(client);
 confirmationSender=createConfirmationResender({send:args=>client.auth.resend(args)});
 client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){recoveryFlow=true;setTimeout(()=>{chooseAuthMode('update');$('#owner-login').hidden=false;const d=$('#membership-dialog');if(d&&!d.open)d.showModal();},0);}else if(event==='SIGNED_OUT'){clearPrivate();setTimeout(()=>refreshAuth(),0);}else if(event==='TOKEN_REFRESHED'){if(owner)setTimeout(()=>requireOwner().catch(error=>{tell(readableError(error));}),0);}else if(['SIGNED_IN','INITIAL_SESSION','USER_UPDATED'].includes(event))setTimeout(()=>refreshAuth(),0);});
}catch{authTell('ระบบคลาวด์ยังเชื่อมต่อไม่ได้ สามารถเปิดสมุดเดิมในเครื่องและสำรองไฟล์ไว้ได้');}
render();if(client)refreshAuth();

// OAuth uses the same session and server-side owner checks as email sign-in.
{
 const login=document.querySelector('#owner-login');
 const social=document.createElement('div');social.className='oauth-options';
 social.setAttribute('role','group');social.setAttribute('aria-label','เข้าสู่ระบบด้วยบัญชีโซเชียล');
 const icons={
  google:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.3c1.9-1.8 2.9-4.4 2.9-7.7Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.7c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.8A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.6a6 6 0 0 1 0-3.2V7.6H3a10 10 0 0 0 0 8.8Z"/><path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.9 1.5L18.8 5A10 10 0 0 0 3 7.6l3.4 2.8C7.2 8 9.4 6.2 12 6.2Z"/></svg>',
  github:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.76-.24.76-.54v-2.1c-3.12.68-3.78-1.33-3.78-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.71 2.62 1.22 3.26.93.1-.73.39-1.22.71-1.5-2.49-.28-5.1-1.25-5.1-5.54 0-1.22.43-2.22 1.15-3-.12-.29-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.67.11 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.85v-8.38H7.05V12h3.05V9.36c0-3.01 1.79-4.68 4.53-4.68 1.31 0 2.68.23 2.68.23v2.95H15.8c-1.49 0-1.95.93-1.95 1.88V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z"/></svg>'
 };
 for(const [provider,label] of [['google','Google'],['github','GitHub'],['facebook','Facebook']]){
  const button=document.createElement('button');button.type='button';button.className='oauth-button oauth-'+provider;
  button.setAttribute('aria-label','เข้าสู่ระบบด้วย '+label);
  button.innerHTML=icons[provider]+'<span>'+label+'</span>';button.disabled=true;button.dataset.provider=provider;button.title='กำลังตรวจบริการ';
  button.addEventListener('click',async()=>{
   if(!client){authTell('ยังเชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาลองใหม่');return;}
   const buttons=[...social.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);button.setAttribute('aria-busy','true');
   authTell('กำลังเชื่อมต่อ '+label+'…');
   try{
    const cfg=window.OM_CHAT_CONFIG;
    const response=await fetch(cfg.supabaseUrl+'/auth/v1/settings',{headers:{apikey:cfg.publishableKey},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('ตรวจบริการเข้าสู่ระบบไม่ได้ กรุณาลองใหม่');
    const settings=await response.json();
    if(settings.external?.[provider]!==true)throw Error('การเข้าสู่ระบบด้วย '+label+' ยังไม่เปิดใช้งาน กรุณาใช้อีเมลก่อน');
    const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:new URL('dashboard.html',location.href).href}});
    if(error)throw error;
   }catch(error){authTell(error.message||'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');}
   finally{buttons.forEach(b=>b.disabled=b.dataset.available!=='true');button.removeAttribute('aria-busy');}
  });social.append(button);
 }
 const hint=document.createElement('p');hint.className='journal-footnote';hint.textContent='ใช้บัญชีที่มีอีเมลตรงกับบัญชีเจ้าของที่อนุมัติไว้ การเข้าสู่ระบบไม่ได้ให้สิทธิ์แก้ไขบันทึกโดยอัตโนมัติ';
 const divider=document.createElement('p');divider.className='oauth-divider';divider.textContent='หรือใช้บัญชีโซเชียล';
 login.append(divider,social,hint);
 const helpers=node('div',undefined,'auth-helper-actions');
 const forgot=node('button','ลืมรหัสผ่าน?','auth-text-button');forgot.id='forgot-password';forgot.type='button';forgot.addEventListener('click',()=>{if(!busy)chooseAuthMode('reset');});
 const resend=node('button','ส่งอีเมลยืนยันอีกครั้ง','auth-text-button');resend.id='resend-confirmation';resend.type='button';
 resend.addEventListener('click',async()=>{if(busy||!confirmationSender)return;resend.disabled=true;try{await confirmationSender.resend(login.elements.email.value,new URL('dashboard.html',location.href).href);authTell('ส่งคำขออีเมลยืนยันแล้ว กรุณาตรวจกล่องจดหมายและสแปม');}catch(e){authTell(readableError(e));}finally{setTimeout(()=>resend.disabled=false,60000);}});
 helpers.append(forgot,resend);login.querySelector('.journal-actions').after(helpers);
 const cfg=window.OM_CHAT_CONFIG;
 fetch(cfg.supabaseUrl+'/auth/v1/settings',{headers:{apikey:cfg.publishableKey},signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(settings=>{
  for(const button of social.querySelectorAll('button')){const enabled=settings.external?.[button.dataset.provider]===true;button.dataset.available=String(enabled);button.disabled=!enabled;button.title=enabled?'เข้าสู่ระบบด้วย '+button.dataset.provider:'ผู้ให้บริการนี้ยังไม่เปิด';if(!enabled){const state=node('small','ยังไม่เปิด');button.append(state);}}
  hint.textContent='ล็อกอินได้เฉพาะบริการที่เปิดอยู่ · บัญชีสมาชิกอ่านโพสต์ได้ สิทธิ์เขียนเป็นของเจ้าของเท่านั้น';
 }).catch(()=>{hint.textContent='ยังตรวจบริการโซเชียลไม่ได้ กรุณาใช้อีเมลหรือลองรีเฟรชอีกครั้ง';});
}

// Keep authentication behind an explicit membership action, outside the journal.
{
 const access=$('#owner-access');
 const dialog=document.createElement('dialog');dialog.className='membership-dialog';dialog.id='membership-dialog';dialog.setAttribute('aria-labelledby','owner-title');
 const close=node('button','×','membership-close');close.type='button';close.setAttribute('aria-label','ปิดหน้าต่างสมาชิก');
 const tabs=document.createElement('div');tabs.className='membership-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','เลือกเข้าสู่ระบบหรือสมัครสมาชิก');
 for(const [key,label] of [['signin','เข้าสู่ระบบ'],['signup','สมัครสมาชิก']]){
  const button=node('button',label);button.type='button';button.dataset.authMode=key;button.setAttribute('aria-pressed',String(key==='signin'));
  button.addEventListener('click',()=>{if(busy)return;chooseAuthMode(key);tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});tabs.append(button);
 }
 access.querySelector('.eyebrow').textContent='BLUE AT HEART · MEMBERS';
 $('#owner-title').textContent='ยินดีต้อนรับสู่บ้านสีน้ำเงิน';
 dialog.append(close,tabs,access);document.body.append(dialog);
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 const open=()=>{if(location.hash==='#owner-access')history.replaceState(null,'',location.pathname+location.search);if(!dialog.open)dialog.showModal();dialog.scrollTop=0;};
 const action=$('#write-entry');
 action.addEventListener('click',event=>{if(action.getAttribute('href')==='#owner-access'){event.preventDefault();open();}});
 const membership=node('button','เข้าสู่ระบบ / สมัครสมาชิก','button membership-launch');membership.type='button';membership.setAttribute('aria-haspopup','dialog');membership.setAttribute('aria-controls',dialog.id);membership.addEventListener('click',open);
 const intro=document.querySelector('.dashboard-heading')||action.parentElement;intro.append(membership);
 const syncLabel=()=>{if(!owner&&mode==='public')action.textContent='เข้าสู่ระบบ / สมัครสมาชิก ↗';membership.hidden=!sessionUser;if(sessionUser)membership.textContent='บัญชีของฉัน';else membership.textContent='เข้าสู่ระบบ / สมัครสมาชิก';};
 new MutationObserver(syncLabel).observe(action,{attributes:true,attributeFilter:['href']});syncLabel();
 // One clear entry point; the original journal action remains the primary link.
 syncLabel();
 chooseAuthMode('signin');
 const authError=new URLSearchParams(location.hash.slice(1)).get('error_description')||new URLSearchParams(location.search).get('error_description');
 if(authError){authTell(readableError({message:authError}));history.replaceState(null,'',location.pathname);open();}
 if(location.hash==='#owner-access')open();
 if(recoveryFlow){chooseAuthMode('update');$('#owner-login').hidden=false;open();}
}
