## 🔐 Webhook Verification Setup Guide

### ปัญหา
Google Apps Script ไม่สามารถเข้าถึง HTTP headers เพื่ออ่าน `X-Line-Signature` ได้

### ✅ วิธีแก้: Cloudflare Worker Proxy

#### Step 1: สร้าง Cloudflare Worker
1. ไปที่ https://dash.cloudflare.com → Workers
2. สร้าง new Worker
3. Copy code จาก `cloudflare-worker.js`
4. เปลี่ยน `YOUR_DEPLOYMENT_ID` เป็น Apps Script deployment ID จริง

#### Step 2: Add SECRET
1. ใน Cloudflare Workers → Settings → Environment Variables
2. เพิ่ม: `LINE_CHANNEL_SECRET` = (ค่าจาก LINE Channel Secret)

#### Step 3: Update LINE Webhook URL
1. ไปที่ LINE Developers Console → Channel Settings
2. เปลี่ยน Webhook URL เป็น:
   ```
   https://your-cloudflare-worker-domain.workers.dev
   ```
3. Enable "Use webhook"

#### Step 4: ทดสอบ
```bash
# TEST
curl -X POST https://your-cloudflare-domain.workers.dev \
  -H "X-Line-Signature: test-signature" \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'
```

### 🚀 Alternative: ถ้าไม่อยากใช้ Cloudflare
1. ใช้ AWS API Gateway + Lambda แทน
2. ใช้ Vercel Functions
3. ใช้ Firebase Functions

ทั้งหมดสามารถ verify signature ได้ก่อนส่งให้ Apps Script
