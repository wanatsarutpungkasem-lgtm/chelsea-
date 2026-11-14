// Only resends an existing signup confirmation; never grants ownership.
export function createConfirmationResender({send,now=()=>Date.now(),cooldownMs=60000}){
 let retryAt=0,pending=false;
 return {remaining:()=>Math.max(0,Math.ceil((retryAt-now())/1000)),async resend(email,redirectTo){
  email=String(email||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('กรอกอีเมลที่ใช้สมัครในช่องอีเมลก่อนครับ');
  if(pending||now()<retryAt)throw Error('กรุณารอก่อนส่งอีเมลอีกครั้ง');
  pending=true;retryAt=now()+cooldownMs;
  try{const result=await send({type:'signup',email,options:{emailRedirectTo:redirectTo}});if(result.error)throw result.error;return result;}finally{pending=false;}
 }};
}
