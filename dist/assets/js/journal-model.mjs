export const JOURNAL_KEY='ohm.blue-journal.v1';
export const MOODS=['','มีความสุข','ภูมิใจ','ลุ้นสุดใจ','เสียดาย','ยังเชียร์เสมอ'];
export const IMAGES=['','om-chelsea.jpg','blue-on-the-road.jpg'];
export function validateEntry(input){
 if(!input||typeof input!=='object')throw Error('รูปแบบบันทึกไม่ถูกต้อง');
 const limits={id:80,title:120,matchDate:10,opponent:80,score:25,mood:30,motm:100,body:4000,moment:1000,image:80,createdAt:40,updatedAt:40};
 const out={};for(const [key,max] of Object.entries(limits)){if(typeof input[key]!=='string'||input[key].length>max)throw Error('ข้อมูลบันทึกไม่ครบหรือยาวเกินกำหนด');out[key]=input[key].trim();}
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(out.id)||!out.title||!out.opponent||!out.body)throw Error('กรุณากรอกชื่อบันทึก คู่แข่ง และความรู้สึกหลังเกม');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(out.matchDate)||!Number.isFinite(Date.parse(out.matchDate+'T00:00:00Z'))||new Date(out.matchDate+'T00:00:00Z').toISOString().slice(0,10)!==out.matchDate)throw Error('วันที่ไม่ถูกต้อง');
 if(!MOODS.includes(out.mood)||!IMAGES.includes(out.image))throw Error('ตัวเลือกไม่ถูกต้อง');
 for(const k of ['createdAt','updatedAt'])if(!Number.isFinite(Date.parse(out[k])))throw Error('วันที่บันทึกไม่ถูกต้อง');
 return out;
}
export function parseBackup(text){const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.entries)||data.entries.length>500)throw Error('ไฟล์สำรองไม่ถูกต้อง หรือมีบันทึกเกิน 500 เรื่อง');const entries=data.entries.map(validateEntry);if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('ไฟล์มีรหัสบันทึกซ้ำ');return entries;}
