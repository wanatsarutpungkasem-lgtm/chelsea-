import {readFile,writeFile,readdir} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);
for(const name of await readdir(root)){
 if(!name.endsWith('.html'))continue;
 const file=new URL(name,root);let html=await readFile(file,'utf8');
 html=html.replaceAll('assets/images/people/chelsea-crest.webp','assets/images/ohm-mark.svg').replaceAll('alt="ตราสโมสรเชลซี"','alt="โลโก้อ้ายโอห์ม"');
 html=html.replace(/src="assets\/images\/people\/[^" ]+\.webp"/g,'src="assets/images/blue-archive-art.svg"');
 html=html.replace(/<figure\b[^>]*data-category="club"[\s\S]*?<\/figure>/g,'');
 if(name==='favorites.html')html=html.replace('นักเตะชุดปัจจุบัน','รายชื่อนักเตะในคลัง').replace('MY FOOTBALL FAVORITES','OHM’S BLUE ARCHIVE');
 await writeFile(file,html);
}
console.log('Updated original fan branding; retained original asset files for review.');
