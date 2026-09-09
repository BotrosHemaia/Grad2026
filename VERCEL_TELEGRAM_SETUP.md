# تشغيل إشعارات تيليجرام من Vercel

هذا الحل لا يحتاج إلى Firebase Functions أو ترقية مشروع Firebase إلى Blaze.

## 1. استخراج بيانات Firebase Admin

1. افتح Firebase Console واختر المشروع `theatre-demo`.
2. افتح **Project settings** ثم **Service accounts**.
3. اضغط **Generate new private key** واحفظ ملف JSON في مكان آمن.
4. لا تنسخ ملف JSON إلى المشروع ولا ترفعه على GitHub.

## 2. إضافة المتغيرات السرية في Vercel

افتح مشروعك في Vercel ثم **Settings → Environment Variables**، وأضف القيم التالية لكل البيئات التي تستخدمها (Production وPreview عند الحاجة):

| اسم المتغير | القيمة |
|---|---|
| `TELEGRAM_BOT_TOKEN` | توكن البوت من BotFather |
| `TELEGRAM_CHAT_ID` | رقم الـ Chat ID الذي ظهر لك |
| `FIREBASE_PROJECT_ID` | قيمة `project_id` من ملف JSON |
| `FIREBASE_CLIENT_EMAIL` | قيمة `client_email` من ملف JSON |
| `FIREBASE_PRIVATE_KEY` | قيمة `private_key` كاملة، من `BEGIN PRIVATE KEY` إلى `END PRIVATE KEY` |

لا تستخدم بادئة `VITE_` مع أي متغير من هذه المتغيرات، لأنها أسرار خاصة بالسيرفر.

## 3. النشر

بعد نسخ الملفات إلى مشروعك:

```powershell
npm install
npm run build
git add .
git commit -m "Add secure Telegram reservation alerts"
git push
```

بعد إضافة المتغيرات السرية، افتح **Deployments** داخل Vercel وأعد نشر آخر نسخة (**Redeploy**) حتى تستخدم الوظيفة القيم الجديدة.

## 4. التجربة

1. افتح محادثة البوت على تيليجرام واضغط **Start** أو أرسل `/start`.
2. نفّذ حجزًا تجريبيًا من الموقع المنشور على Vercel.
3. يجب أن تصلك رسالة بها رقم الحجز، الأسماء، الهاتف، المقاعد، طريقة الدفع، اسم الخادم، والإجمالي.

إذا تم تسجيل الحجز لكن تعذّر إرسال الإشعار، سيظل الحجز محفوظًا ولن يُطلب من الضيف إعادة الحجز. يمكن مراجعة الخطأ من **Vercel → Logs**، كما يظل الحجز ظاهرًا لحظيًا في لوحة الإدارة.
