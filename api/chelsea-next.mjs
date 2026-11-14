import {readFile} from 'node:fs/promises';
import {fetchClubSchedule,selectNext,selectWeek} from '../lib/chelsea-schedule.mjs';
export function createChelseaNextHandler({fetcher=fetch,now=()=>new Date(),readSnapshot=async()=>JSON.parse(await readFile(new URL('../dist/data/chelsea-next.json',import.meta.url),'utf8'))}={}){
 let cached=null,pending=null,retryAt=0;
 return async function handler(request){
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  let value,delivery='club';
  try{
   if(now().getTime()<retryAt)throw new Error('Source cooling down');
   if(!cached||now().getTime()-Date.parse(cached.fetchedAt)>6*3600000){
    pending ||= fetchClubSchedule(fetcher,now()).then(v=>(cached=v)).finally(()=>{pending=null});
    await pending;
   }
   value=cached;
  }catch{
   if(now().getTime()>=retryAt)retryAt=now().getTime()+300000;
   delivery='snapshot';
   try{value=cached||await readSnapshot();}catch{return Response.json({error:{message:'ยังโหลดโปรแกรมนัดถัดไปไม่ได้ กรุณาลองใหม่ภายหลัง'}},{status:503});}
  }
  const select=new URL(request.url).searchParams.get('scope')==='week'?selectWeek:selectNext;
  try{return Response.json(select(value,now(),delivery),{headers:{'Cache-Control':delivery==='club'?'public, max-age=60, s-maxage=3600, stale-while-revalidate=3600':'public, max-age=60, s-maxage=300','X-Content-Type-Options':'nosniff'}});}
  catch{return Response.json({error:{message:'ข้อมูลโปรแกรมแข่งยังไม่พร้อม กรุณาลองใหม่'}},{status:503});}
 };
}
export const chelseaNextHandler=createChelseaNextHandler();
export default async function endpoint(req,res){
 const result=await chelseaNextHandler(new Request(new URL(req.url,'https://ohm-fanchelsea.vercel.app'),{method:req.method}));
 res.statusCode=result.status;result.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await result.text());
}
