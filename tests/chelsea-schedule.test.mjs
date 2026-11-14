import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedule,londonKickoff,selectNext,FEED_URL} from '../lib/chelsea-schedule.mjs';
import {isChelseaNextQuestion,parseFootballQuestion} from '../dist/assets/js/football-query.mjs';
import {createChelseaNextHandler} from '../api/chelsea-next.mjs';
import {upcomingFrom,fixtureTime} from '../dist/assets/js/chelsea-next.mjs';
const now=new Date('2026-11-12T17:00:00Z');
const row=(overrides={})=>({id:'abc',optaId:'123',competition:'Premier League',status:'PreMatch',isResult:false,isLive:false,postponed:false,matchUp:{home:{clubName:'Chelsea'},away:{clubName:'Test Opponent'}},kickoffDate:'Sat 21 Nov 2026',kickoffTime:'15:00',venue:'Test Ground',tbc:false,...overrides});
const source=(rows=[row()])=>({items:[{items:rows}]});
test('London winter/summer kickoff converts correctly, invalid input rejected',()=>{
 assert.equal(londonKickoff('Sat 21 Nov 2026','15:00'),'2026-11-21T15:00:00.000Z');
 assert.equal(londonKickoff('Sat 22 Aug 2026','15:00'),'2026-08-22T14:00:00.000Z');
 assert.equal(londonKickoff('Mon 31 Feb 2026','15:00'),null);
 assert.equal(londonKickoff('Sat 21 Nov 2026','25:00'),null);
});
test('club schedule only includes mens Chelsea Premier League scheduled games',()=>{
 const data=normalizeSchedule(source([row(),row({competition:'FA Cup'}),row({isResult:true}),row({postponed:true}),row({isLive:true}),row({status:'Cancelled'}),row({matchUp:{home:{clubName:'Chelsea Women'},away:{clubName:'Arsenal Women'}}})]),now.toISOString());
 assert.equal(data.fixtures.length,1);assert.equal(data.fixtures[0].home,'Chelsea');
 assert.equal(data.fixtures[0].date,'2026-11-21T15:00:00.000Z');
 assert.throws(()=>normalizeSchedule({}));
});
test('old snapshots never present elapsed matches as the next match and label stale data',()=>{
 const data=normalizeSchedule(source(),now.toISOString());
 assert.equal(selectNext(data,new Date('2026-11-22')).fixture,null);
 assert.equal(selectNext(data,new Date('2026-11-22')).stale,true);
 assert.equal(upcomingFrom(data,new Date('2026-11-22')).fixture,null);
 assert.match(fixtureTime(data.fixtures[0]),/22:00/);
 assert.match(fixtureTime({...data.fixtures[0],timeConfirmed:false}),/รอยืนยันเวลา/);
});
test('Chelsea next-match intent accepts implicit and explicit team but preserves other questions',()=>{
 for(const q of ['นัดหน้าเจอใคร','เชลซีเตะวันไหน','Chelsea next match','นัดถัดไปของเชลซี','เชลซีเจอใคร'])assert.equal(isChelseaNextQuestion(q),true,q);
 for(const q of ['Liverpool next match','เชลซี พบ ลิเวอร์พูล','เชลซีวันนี้เตะวันไหน','เชลซี 2026-11-21','เชลซีนัดหน้า line up','เชลซีนัดหน้าโอกาสชนะ %'])assert.equal(isChelseaNextQuestion(q,parseFootballQuestion(q)),false,q);
});
test('next-match API deduplicates requests, validates source boundary, and needs no football key',async()=>{
 let calls=0;const handler=createChelseaNextHandler({now:()=>now,fetcher:async(url,options)=>{calls++;assert.equal(url,FEED_URL);assert.equal(options.redirect,'error');return Response.json(source());}});
 const req=()=>new Request('https://local.invalid/api/chelsea-next');
 const [a,b]=await Promise.all([handler(req()),handler(req())]);
 assert.equal(calls,1);assert.equal((await a.json()).fixture.away,'Test Opponent');assert.equal((await b.json()).delivery,'club');
 assert.equal((await handler(new Request(req(),{method:'POST'}))).status,405);
});
test('upstream failure returns dated snapshot rather than invented live fixture',async()=>{
 const handler=createChelseaNextHandler({now:()=>now,fetcher:async()=>{throw new Error('offline')},readSnapshot:async()=>normalizeSchedule(source(),now.toISOString())});
 const response=await handler(new Request('https://local.invalid/api/chelsea-next'));const data=await response.json();
 assert.equal(response.status,200);assert.equal(data.delivery,'snapshot');assert.equal(data.fetchedAt,now.toISOString());
 const empty=createChelseaNextHandler({fetcher:async()=>{throw new Error()},readSnapshot:async()=>{throw new Error()}});
 assert.equal((await empty(new Request('https://local.invalid'))).status,503);
});
