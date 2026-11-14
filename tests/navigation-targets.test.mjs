import {test} from 'node:test';import assert from 'node:assert/strict';import {readdir,readFile,access} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('dist');
test('all static local links and asset references resolve, including fragment destinations',async()=>{
 const names=(await readdir(root)).filter(n=>n.endsWith('.html'));const docs=new Map(await Promise.all(names.map(async n=>[n,await readFile(path.join(root,n),'utf8')])));
 const errors=[];
 for(const [name,html] of docs){
  for(const match of html.matchAll(/\b(href|src)="([^"]*)"/g)){
   const raw=match[2].replaceAll('&amp;','&');if(!raw||/^(https?:|mailto:|tel:|data:|\/\/)/.test(raw))continue;
   const url=new URL(raw,'https://local.test/'+name);if(url.origin!=='https://local.test')continue;
   const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
   try{await access(path.join(root,relative));}catch{errors.push(name+': '+raw);continue;}
   if(url.hash&&docs.has(relative)){
    const id=decodeURIComponent(url.hash.slice(1));const ids=[...docs.get(relative).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);if(!ids.includes(id))errors.push(name+': missing '+raw);
   }
  }
 }
 assert.deepEqual(errors,[]);
});
