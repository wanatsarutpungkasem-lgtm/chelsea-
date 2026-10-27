export const TIMEZONE = 'Asia/Bangkok';
export function bangkokDate(now = new Date(), offset = 0) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(p => [p.type, p.value]));
  const date = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + offset));
  return date.toISOString().slice(0, 10);
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function normalize(value = '') {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const aliases = [
  ['chelsea', /เชลซี|chelsea/iu], ['arsenal', /อาร์เซนอล|อาร์เซน่อล|arsenal/iu],
  ['liverpool', /ลิเวอร์พูล|liverpool/iu], ['manchester united', /แมนยู|แมนเชสเตอร์ ยูไนเต็ด|manchester united|man utd/iu],
  ['manchester city', /แมนซิตี้|แมนเชสเตอร์ ซิตี้|manchester city|man city/iu],
  ['tottenham', /สเปอร์ส|ท็อตแนม|tottenham|spurs/iu], ['newcastle', /นิวคาสเซิล|newcastle/iu],
  ['barcelona', /บาร์เซโลนา|บาร์เซโลน่า|barcelona/iu], ['real madrid', /เรอัล มาดริด|real madrid/iu],
  ['bayern', /บาเยิร์น|bayern/iu], ['juventus', /ยูเวนตุส|juventus/iu],
  ['paris saint germain', /ปารีส|เปแอสเช|paris saint germain|psg/iu],
  ['buriram', /บุรีรัมย์|buriram/iu], ['muangthong', /เมืองทอง|muangthong/iu]
];
export function parseFootballQuestion(text, now = new Date()) {
  const q = text.trim();
  let date = bangkokDate(now, /พรุ่งนี้|tomorrow/iu.test(q) ? 1 : /เมื่อวาน|เมื่อคืน|yesterday/iu.test(q) ? -1 : 0);
  const iso = q.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const slash = q.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (iso) date = iso[0];
  else if (slash) {
    let year = +slash[3]; if (year > 2400) year -= 543;
    date = `${year}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }
  const teams = aliases.filter(([, re]) => re.test(q)).map(([name]) => name);
  if (!teams.length && /\s(?:vs\.?|v\.?|พบ|เจอ|ปะทะ)\s/iu.test(q)) {
    const clean = q.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
      .replace(/คาดการณ์|วิเคราะห์|ผลบอล|สกอร์|บอล|วันนี้|พรุ่งนี้|เมื่อวาน|ใครชนะ|จบเท่าไหร่|prediction|predict|score|today|tomorrow|yesterday/giu, '').trim();
    teams.push(...clean.split(/\s+(?:vs\.?|v\.?|พบ|เจอ|ปะทะ)\s+/iu).map(normalize).filter(Boolean).slice(0, 2));
  }
  const sport = /(ผลบอล|สกอร์|โปรแกรมบอล|ตารางบอล|บอลวันนี้|บอลพรุ่งนี้|บอลเมื่อวาน|บอลสด|คู่ไหน|ใครเตะ|ใครแข่ง|มีบอล|แข่ง.*บ้าง|เตะ.*บ้าง|เกมคู่|คู่นี้|เกมนี้|แข่งขัน|แข่งวัน|คาดการณ์|วิเคราะห์บอล|ใครชนะ|ชนะ.*ไหม|โอกาส.*ชนะ|ชนะ.*กี่|เปอร์เซ็นต์|fixture|score|prediction|live|\svs\s|\sv\.\s)/iu.test(q) || teams.length > 0;
  return {
    sport, date, valid: validDate(date), teams,
    live: /(บอลสด|กำลังแข่ง|live)/iu.test(q),
    prediction: /(คาดการณ์|วิเคราะห์|โอกาส|เปอร์เซ็นต์|ใครชนะ|ชนะ.*ไหม|prediction|predict|%)/iu.test(q),
    finished: /(จบ|ผลบอลเมื่อวาน|ผลเมื่อคืน|finished)/iu.test(q)
  };
}
