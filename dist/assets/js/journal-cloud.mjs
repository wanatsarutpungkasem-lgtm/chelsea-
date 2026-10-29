import {validateEntry} from './journal-model.mjs';
export function cloudEntries(rows){return rows.map(row=>({...validateEntry(row.content),cloudVersion:row.version}));}
export function pendingImports(local,cloud){const known=new Set(cloud.map(e=>e.id));return local.filter(e=>!known.has(e.id)).map(validateEntry);}
export function publicationLabel(entry,publications){const p=publications.find(p=>p.id===entry.id);return !p?'ฉบับร่าง · ยังไม่เผยแพร่':p.source_version===entry.cloudVersion?'เผยแพร่แล้ว':'มีร่างแก้ไข · ฉบับที่เผยแพร่ยังเป็นเวอร์ชันก่อน';}
export function createJournalStore(client){
 const check=result=>{if(result.error)throw result.error;return result.data;};
 return {
  async publications(){return check(await client.from('journal_publications').select('id,content,source_version,published_at').order('published_at',{ascending:false}).limit(500))||[];},
  async drafts(){return cloudEntries(check(await client.from('journal_entries').select('content,version').order('updated_at',{ascending:false}).limit(500))||[]);},
  async save(entry,userId,previous){
   const content=validateEntry(entry);let query;
   if(previous)query=client.from('journal_entries').update({content}).eq('id',entry.id).eq('version',previous.cloudVersion);
   else query=client.from('journal_entries').insert({id:entry.id,owner_id:userId,content});
   const row=check(await query.select('content,version').maybeSingle());
   if(!row)throw Error('บันทึกถูกแก้ไขจากอีกหน้าต่างแล้ว กรุณาโหลดข้อมูลใหม่ก่อนแก้ต่อ');
   return cloudEntries([row])[0];
  },
  async publish(id){check(await client.from('journal_publications').upsert({id},{onConflict:'id'}).select('id').single());},
  async unpublish(id){check(await client.from('journal_publications').delete().eq('id',id));}
 };
}
