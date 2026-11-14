import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectWeek,normalizeSchedule,londonKickoff} from '../lib/chelsea-schedule.mjs';
import {createChelseaNextHandler} from '../api/chelsea-next.mjs';
import {weeklyQuestion,weekSummary} from '../dist/assets/js/chelsea-week.mjs';
const now=new Date('2026-11-14T12:00:00Z');
const fixture=(date,overrides={})=>({id:'1',home:'Chelsea',away:'Test Opponent',competition:'Premier League',date,timeConfirmed:true,...overrides});
const snapshot=fixtures=>({schemaVersion:1,source:'Test club feed',fetchedAt:now.toISOString(),fixtures});
test('week uses Bangkok dates, includes seventh day, excludes elapsed and eighth-day matches',()=>{
 const result=selectWeek(snapshot([fixture('2026-11-14T11:00:00Z'),fixture('2026-11-21T15:00:00Z'),fixture('2026-11-21T17:00:00Z'),fixture('2026-11-20T15:00:00Z',{competition:'FA Cup'})]),now);
 assert.equal(result.from,'2026-11-14');assert.equal(result.through,'2026-11-21');assert.equal(result.fixtures.length,1);assert.equal(result.fixture.date,'2026-11-21T15:00:00Z');
 const midnight=selectWeek(snapshot([]),new Date('2026-12-31T17:10:00Z'));assert.equal(midnight.from,'2027-01-01');assert.equal(midnight.through,'2027-01-08');
});
test('empty week does not mislabel an outside-window next match as being this week',()=>{
 const result=selectWeek(snapshot([fixture('2026-11-25T15:00:00Z')]),now,'snapshot');assert.equal(result.fixture,null);assert.equal(result.nextFixture.away,'Test Opponent');assert.match(weekSummary(result),/นัดถัดไปอยู่นอกช่วงนี้/);assert.match(weekSummary(result),/ตารางสำรอง/);
});
test('weekly bot intent never swallows dated, lineup or prediction questions',()=>{
 for(const q of ['เชลซีเตะวันไหน','โปรแกรมเชลซี 7 วัน','Chelsea next match'])assert.equal(weeklyQuestion(q),true);
 for(const q of ['เชลซี 2026-11-21','เชลซีนัดหน้าไลน์อัป','เชลซีนัดหน้าโอกาสชนะ %','Liverpool next match'])assert.equal(weeklyQuestion(q),false);
});
test('week endpoint falls back honestly to a dated snapshot and rejects methods',async()=>{
 const handler=createChelseaNextHandler({now:()=>now,fetcher:async()=>{throw Error('offline')},readSnapshot:async()=>snapshot([fixture('2026-11-21T15:00:00Z')])});
 const res=await handler(new Request('https://local.invalid/api/chelsea-next?scope=week'));const data=await res.json();assert.equal(res.status,200);assert.equal(data.kind,'chelsea-week');assert.equal(data.delivery,'snapshot');assert.equal(data.fixtures.length,1);
 assert.equal((await handler(new Request('https://local.invalid/api/chelsea-next',{method:'POST'}))).status,405);
 const unavailable=createChelseaNextHandler({fetcher:async()=>{throw Error()},readSnapshot:async()=>{throw Error()}});assert.equal((await unavailable(new Request('https://local.invalid/api/chelsea-next?scope=week'))).status,503);
});
test('official schedule normalization handles BST and ignores cancelled or other-team matches',()=>{
 assert.equal(londonKickoff('Sat 22 Aug 2026','15:00'),'2026-08-22T14:00:00.000Z');assert.equal(londonKickoff('Mon 31 Feb 2026','15:00'),null);
 const row={competition:'Premier League',status:'PreMatch',matchUp:{home:{clubName:'Chelsea'},away:{clubName:'Test Opponent'}},kickoffDate:'Sat 21 Nov 2026',kickoffTime:'15:00'};
 assert.equal(normalizeSchedule({items:[{items:[row,{...row,status:'Cancelled'},{...row,isResult:true},{...row,competition:'FA Cup'}]}]}).fixtures.length,1);
});
