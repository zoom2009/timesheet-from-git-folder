# Timesheet

เว็บแดชบอร์ดส่วนตัวสำหรับทำ timesheet จาก git history — สแกนทุก repo ในโฟลเดอร์ที่เรากำหนด
แล้วสรุปว่าแต่ละวันเราทำอะไรไปบ้าง โดยดูจาก commit ของเราเอง พร้อมปุ่มให้ AI ช่วยสรุปเป็นข้อความสั้นๆ
แล้วติ๊ก "เสร็จ" เก็บไว้รายวัน

เหมาะกับคนที่ต้อง report งานรายวันหรือรายเดือน แล้วอยากรู้ว่าเมื่อวาน/เดือนที่แล้วทำอะไรไปบ้าง

## ฟีเจอร์

- สแกนทุก git repo ในโฟลเดอร์ที่กำหนด (ค่าเริ่มต้น `~/projects`)
- กรองเฉพาะ commit ที่เขียนโดยอีเมลของเรา (ตั้งได้หลายอีเมล)
- จัดกลุ่มตามวัน (เขตเวลาไทย) → repo → branch
- กด "สรุปด้วย AI" ต่อ branch ได้ข้อความสั้นๆ เอาไปใส่ timesheet ได้เลย
- ติ๊ก "เสร็จ" รายวัน ค่าเก็บถาวรในฐานข้อมูล
- เลือกดูย้อนหลังได้ทุกปี/เดือน พร้อมปุ่ม "เดือนนี้"

## หลักการทำงาน

- **หน้าเว็บ:** Next.js (App Router) + Tailwind ใน `app/page.tsx`
- **ฐานข้อมูล:** Convex เก็บผลสรุป AI และสถานะ "เสร็จ" รายวัน
- **การสแกน:** API route `/api/commits` รัน `git log` บนเครื่องเราแล้วส่งผลกลับเป็น JSON
  ⇒ **ต้องรันบนเครื่องตัวเองเท่านั้น** (รันบน Vercel ไม่ได้ เพราะเซิร์ฟเวอร์ไม่มี repo ของเรา)

## สิ่งที่ต้องมี

- [Bun](https://bun.sh) ใช้เป็น package manager
- Git
- บัญชี [Convex](https://convex.dev) (ฟรี) สำหรับเก็บข้อมูลสรุป

## วิธีติดตั้ง

### 1. ติดตั้ง dependencies

```bash
bun install
```

### 2. สร้างโปรเจกต์ Convex ของตัวเอง (ครั้งแรกครั้งเดียว)

```bash
bunx convex dev
```

คำสั่งนี้จะเปิดเบราว์เซอร์ให้ login แล้วสร้าง project ใหม่ให้ พร้อมเขียนค่า
`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`
ลงใน `.env.local` ให้อัตโนมัติ (ครั้งแรกให้ตอบสร้าง project ใหม่)

### 3. ตั้งค่าโฟลเดอร์และอีเมลของเราใน `.env.local`

```bash
# โฟลเดอร์ที่เก็บ repos (ถ้าไม่ใส่ จะใช้ ~/projects)
TRUE_PROJECTS_DIR=/Users/you/my-projects

# อีเมลที่ใช้ commit หลายอันคั่นด้วย , (ถ้าไม่ใส่ จะนับทุกคน)
AUTHOR_EMAILS=me@example.com,me@work.com
```

ดูตัวอย่างครบๆ ได้ที่ไฟล์ `.env.example`

### 4. รันเว็บ

```bash
bun run dev
```

เปิด http://localhost:3000 ได้เลย

> เคล็ดลับ: ถ้าจะแก้ backend (โฟลเดอร์ `convex/`) ให้เปิดอีกหน้าต่างรัน `bunx convex dev` ค้างไว้
> เพื่อให้โค้ด sync ขึ้น Convex ทันที ถ้าแก้แค่หน้าเว็บอย่างเดียวไม่ต้องรันก็ได้

## ตัวแปรแวดล้อม

ตั้งค่าใน `.env.local` (ไฟล์นี้ไม่ถูก push ขึ้น git)

| ตัวแปร | จำเป็น | ความหมาย | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `TRUE_PROJECTS_DIR` | ไม่ | โฟลเดอร์แม่ที่เก็บ git repos (สแกนทุก repo ลูก) | `~/projects` |
| `AUTHOR_EMAILS` | ไม่ | อีเมลผู้เขียน commit คั่นด้วย `,` | ไม่ใส่ = นับทุกคน |
| `CONVEX_DEPLOYMENT` | ใช่ | deployment ของ Convex | ได้จาก `bunx convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | ใช่ | URL ของ Convex | ได้จาก `bunx convex dev` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | ใช่ | URL ของ Convex | ได้จาก `bunx convex dev` |

แก้ `.env.local` แล้วต้องรีสตาร์ท dev server ค่าใหม่จึงจะมีผล

## วิธีใช้

1. เลือกปี + เดือน หรือกด **"เดือนนี้"**
2. ดูรายการ commit แยกเป็น วัน → repo → branch
3. กด **"สรุปด้วย AI"** ที่ branch ที่ต้องการ ให้ AI สรุปเป็นข้อความสั้นๆ 1–5 บรรทัด
   (ผลสรุปถูกเก็บไว้ กด "สรุปใหม่" เพื่อสร้างใหม่ได้)
4. ติ๊ก **"เสร็จ"** ท้ายวัน เพื่อมาร์ควันนั้นว่าเรียบร้อยแล้ว

## AI สรุปทำงานอย่างไร

- ใช้ AI Gateway ของ Convex ซึ่งมีโมเดลฟรีให้ใช้ — ไม่ต้องมี API key
- ถ้าโมเดลหลักไม่ว่าง (rate limit) จะสลับไปโมเดลสำรองให้อัตโนมัติ
- ถ้าโดน 429 ทั้งคู่ ให้รอสักครู่แล้วกดอีกครั้ง
- อยากเปลี่ยนโมเดล แก้ที่ `MODELS` ใน `convex/summaries.ts`

## คำสั่งที่ใช้บ่อย

```bash
bun run dev      # รันเว็บ
bun run build    # build สำหรับ production
bun test         # รันเทสต์
bun run lint     # ตรวจ lint
```

## โครงสร้างโปรเจกต์

```
app/page.tsx               หน้าเว็บหลัก (UI ทั้งหมด)
app/api/commits/route.ts   API สแกน git
lib/git-scan.ts            สแกน repo + เรียก git log (อ่านค่าจาก env)
lib/commits.ts             ฟังก์ชันจัดกลุ่ม commit (มีเทสต์)
convex/summaries.ts        เรียก AI + เก็บผลสรุป
convex/completedDays.ts    สถานะ "เสร็จ" รายวัน
```
