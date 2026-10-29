# อ้ายโอห์ม แฟนเชลซี

เว็บไซต์ส่วนตัว: https://wanatsarutpungkasem-lgtm.github.io/chelsea-/

หน้าเว็บไซต์อยู่ใน `dist/` และ GitHub Actions เผยแพร่จากโฟลเดอร์นี้ HTML, CSS และ JavaScript แยกไฟล์กัน

ระบบสมุดบันทึกใช้ Supabase Auth เก็บร่างส่วนตัวและฉบับเผยแพร่แยกตาราง มี RLS ตรวจสิทธิ์ที่ฐานข้อมูล ดู [วิธีสมัครและอัปเดต](README-CLOUD-JOURNAL.md)

ทดสอบด้วย Node.js 22 ขึ้นไป: `npm test`

เปิดเว็บในเครื่อง: `node scripts/preview.mjs` แล้วเปิด http://127.0.0.1:4173/dashboard.html

ระบบสกอร์ฟุตบอลเดิมอยู่ใน `netlify/functions/` และยังต้องย้าย backend ก่อนใช้งานผ่าน GitHub Pages ได้ ไม่ใส่ API key หรือ service-role key ในไฟล์ที่เผยแพร่
