import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEntry,parseBackup} from '../dist/assets/js/journal-model.mjs';
import {cloudEntries,pendingImports,publicationLabel,createJournalStore} from '../dist/assets/js/journal-cloud.mjs';
const entry={id:'qa-entry',title:'แมตช์ที่อยากจำ',matchDate:'2025-07-13',opponent:'PSG',score:'3–0',mood:'ภูมิใจ',motm:'',body:'ข้อความของเจ้าของ',moment:'',image:'',createdAt:'2026-10-29T10:00:00Z',updatedAt:'2026-10-29T10:00:00Z'};
test('backups reject corrupt/duplicate entries and impossible dates',()=>{
 assert.throws(()=>parseBackup(JSON.stringify({version:1,entries:[entry,entry]})));
 assert.throws(()=>validateEntry({...entry,matchDate:'2026-02-30'}));
 assert.throws(()=>validateEntry({...entry,image:'https://unknown.example/image.jpg'}));
});
test('entry validation discards unknown/private fields before saving or publishing',()=>{
 assert.deepEqual(validateEntry({...entry,secret:'not for publication',cloudVersion:4}),entry);
});
test('cloud imports preserve existing IDs without overwriting and publication remains an explicit action',()=>{
 assert.deepEqual(pendingImports([entry,{...entry,id:'second'}],[entry]).map(e=>e.id),['second']);
 assert.equal(publicationLabel({...entry,cloudVersion:2},[]),'ฉบับร่าง · ยังไม่เผยแพร่');
 assert.equal(publicationLabel({...entry,cloudVersion:2},[{id:entry.id,source_version:2}]),'เผยแพร่แล้ว');
 assert.match(publicationLabel({...entry,cloudVersion:3},[{id:entry.id,source_version:2}]),/เวอร์ชันก่อน/);
});
test('cloud version stays outside export content',()=>{
 const [cloud]=cloudEntries([{content:entry,version:7}]);assert.equal(cloud.cloudVersion,7);assert.deepEqual(validateEntry(cloud),entry);
});
test('saving uses optimistic version checks, never writes public snapshots and detects stale edits',async()=>{
 const calls=[];const query={update(v){calls.push(['update',v]);return this;},eq(k,v){calls.push(['eq',k,v]);return this;},select(){return this;},async maybeSingle(){return {data:null,error:null};}};
 const store=createJournalStore({from(table){calls.push(['from',table]);return query;}});
 await assert.rejects(store.save(entry,'owner',{cloudVersion:5}),/อีกหน้าต่าง/);
 assert.deepEqual(calls.filter(c=>c[0]==='eq'),[['eq','id','qa-entry'],['eq','version',5]]);
 assert.equal(calls.filter(c=>c[0]==='from'&&c[1]==='journal_publications').length,0);
});
test('publishing sends only an ID; server selects the saved snapshot',async()=>{
 let sent;const query={upsert(v){sent=v;return this;},select(){return this;},async single(){return {data:{id:entry.id}};}};
 await createJournalStore({from(){return query;}}).publish(entry.id);assert.deepEqual(sent,{id:entry.id});
});
