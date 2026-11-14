# อ้ายโอห์ม — ไฟล์อัปโหลด GitHub / Vercel 14 พ.ย. 2026

1. แตก ZIP แล้วเปิดโฟลเดอร์ที่แตกออกมา
2. ใน repository wanatsarutpungkasem-lgtm/chelsea- เลือก Add file → Upload files
3. ลากไฟล์และโฟลเดอร์ข้างในขึ้นไป โดยให้ package.json, vercel.json, dist/, api/, lib/, netlify/, src/, scripts/, tests/ อยู่ที่ราก repository ไม่ซ้อนโฟลเดอร์ชื่อชุด ZIP
4. บน Mac กด Command+Shift+. เพื่อมองเห็น .github และ .gitignore แล้วอัปโหลดด้วย
5. กด Commit changes จากนั้นดู Vercel → Deployments จนสถานะ Ready

หาก Vercel ยังเชื่อม repository นี้และ branch ที่อัปโหลดอยู่ จะ deploy อัตโนมัติ การอัปโหลดไป production branch (มักเป็น main) อาจอัปเดตเว็บจริงทันที หากต้องการ Preview ให้สร้าง branch ใหม่ เช่น preview/glass-3d แล้วอัปโหลด branch นั้น

Vercel: Framework Other, Root Directory เป็นราก repository, Output Directory dist, Build Command npm test (อยู่ใน vercel.json แล้ว) ไฟล์ 3D ที่ build แล้วรวมอยู่ใน dist/assets/energy ต้องอัปโหลด boot.js และ main-*.js ให้ครบพร้อมกัน

netlify/functions เป็นโค้ดร่วมที่ api/football.mjs นำเข้า จึงต้องเก็บโฟลเดอร์นี้ แม้ใช้ Vercel แทน Netlify

ไม่ต้องใส่ API key ในโค้ด ตั้ง FOOTBALL_API_KEY และ Supabase server credentials ที่จำเป็นใน Vercel Environment Variables เดิม ไม่ได้รวมข้อมูลลับหรือ .env ใน ZIP นี้

มีโล่กระจกแตกร้าวขอบบาง หมุน 360° และนัดพรีเมียร์ลีกถัดไป รวมทั้งบอตถามนัดหน้า รุ่นนี้ยังไม่ได้ยืนยัน social login ครบวงจร สกอร์/Line-up/คาดการณ์ขึ้นกับ API quota และการตั้งค่าที่ Vercel

GitHub Actions อัปเดตตารางสัปดาห์ละครั้งอยู่ใน .github/workflows/chelsea-schedule.yml ต้องอยู่บน default branch และ Actions ได้รับอนุญาตให้เขียน commit ดู docs/CHELSEA-NEXT-MATCH.md ไม่ได้ทดสอบรัน workflow บน GitHub จริง

ทดสอบก่อนจัดชุด: npm test ผ่าน 54 รายการ วันที่ 14 พ.ย. 2026 ไม่ได้ deploy ขึ้นเว็บในขั้นตอนจัด ZIP

มีรูปส่วนตัวที่โอมให้ใช้ในเว็บไซต์ไว้แล้ว ตราเชลซีและภาพกระจกที่โอมเลือกยังรวมอยู่ตามคำขอเดิม ไม่ได้รวมไฟล์ฐานข้อมูลหรือไฟล์ภาพจากโฟลเดอร์ review-assets-not-for-upload
