# Security checklist — อ้ายโอห์ม แฟนเชลซี

## กติกาหลัก

- GitHub Pages เป็นเว็บไซต์สาธารณะ ห้ามเก็บรหัสผ่าน API key, service-role key, token หรือข้อมูลส่วนตัวไว้ใน `dist/` หรือ GitHub
- ฝั่งเบราว์เซอร์ใช้ได้เฉพาะ Supabase publishable key และต้องเปิด RLS ทุกตารางที่เปิดผ่าน Data API
- API-Football key ต้องอยู่ใน Supabase Edge Function Secrets ชื่อ `FOOTBALL_API_KEY` เท่านั้น
- Dashboard ต้องตรวจสิทธิ์ด้วย `auth.uid()` และ owner allow-list ในฐานข้อมูล ไม่ใช้ `user_metadata` ตัดสินสิทธิ์
- บันทึกร่างเป็นข้อมูลส่วนตัว ห้ามเผยแพร่โดยอัตโนมัติ การเผยแพร่ต้องเป็นปุ่มแยก
- ข่าวและบทสัมภาษณ์ต้องมี URL ต้นฉบับ วันที่ และป้ายแยกข้อเท็จจริง/ความเห็น

## ตรวจแล้วเมื่อ 30 ต.ค. 2026

- ตาราง public ที่ใช้งานเปิด RLS แล้ว
- ไม่พบ Edge Function เดิมในโปรเจกต์ก่อนเริ่มงาน
- Security Advisor พบ 1 คำเตือน: Leaked Password Protection ยังปิดอยู่
- Performance Advisor พบเพียงดัชนีที่ยังไม่ถูกใช้งาน 2 รายการ ซึ่งไม่ใช่ช่องโหว่

## เจ้าของเว็บไซต์ต้องทำ

1. เปิด Leaked Password Protection ใน Supabase Auth ตามเอกสาร: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
2. สร้าง API-Football key ใหม่ เพราะ key เดิมเคยถูกส่งในแชต จากนั้นตั้งเป็น Edge Function Secret `FOOTBALL_API_KEY`
3. ห้ามส่งรหัสผ่านหรือ key ใหม่ในแชต ให้กรอกใน Supabase Dashboard โดยตรง
4. เปิด MFA สำหรับบัญชี GitHub และ Supabase

## ขอบเขตที่ยังต้องเพิ่มก่อนเปิดสาธารณะเต็มรูปแบบ

- Rate limit ส่วนกลางสำหรับ Football Edge Function หากจำนวนผู้ชมเพิ่มมากขึ้น
- Password recovery ของบัญชีเจ้าของ Dashboard
- Content Security Policy ผ่านโฮสต์ที่รองรับ response headers (GitHub Pages ตั้ง header เองไม่ได้)
