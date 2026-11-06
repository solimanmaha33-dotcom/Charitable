# نظام الجمعية

واجهة عربية لإدارة الأسر والحالات والتبرعات والكفالات. المرحلة الحالية فيها الشكل العربي ودخول الموظفين والصلاحيات. صفحات الحالات والتبرعات ما زالت مؤقتة.

## التشغيل المحلي

استخدم Node.js 24 وnpm. من مجلد المشروع:

```sh
npm ci
npm run dev
```

افتح العنوان اللي بيظهر في الطرفية. الواجهة من اليمين للشمال، وبتشتغل على شاشة عرضها ٣٦٠ بكسل. لمعاينة الشكل فقط لا تحتاج خدمة خارجية. لاختبار الدخول استخدم إعداد Supabase وPages المحلي بالأسفل.

## الفحص

```sh
npm run test
npm run test:worker
npm run typecheck
npm run build
npm run test:e2e
```

اختبارات الواجهة بتستخدم Vitest وReact Testing Library. اختبار المتصفح بيستخدم Playwright، وبيشغّل الخادم المحلي تلقائياً. لو Chromium بتاع Playwright مش متثبت، ثبّته في بيئة تسمح بتنزيل المتصفحات:

```sh
npx playwright install chromium
```

لو عندك Chromium محلي بالفعل، ممكن تحدد مساره. ده الأمر اللي اتجرب في بيئة الشغل الحالية:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

أمر `test:worker` يشغّل اختبارات حدود Pages Functions في Node ضد Supabase محلي حقيقي؛ يحتاج Docker وSupabase المحلي. `npm run build:functions` يتحقق من تجميع الوظائف لبيئة Cloudflare.

## تنظيم الشغل

- `src/app/`: تشغيل التطبيق والمسارات.
- `src/shared/`: شكل الصفحة والمكونات المشتركة.
- المزايا اللي هتتضاف مكانها `src/features/`، وربط الخدمات مكانه `src/services/`.
- [تقدم الشغل](docs/progress.md) و[خطة التنفيذ](docs/superpowers/plans/2026-11-05-charitable-case-system.md).

المسارات المحمية تطلب جلسة موظف صالحة، وقاعدة البيانات تفرض الصلاحيات مستقلة عن الواجهة. نستخدم بيانات وهمية وفحوص محلية فقط؛ التطبيق غير منشور.


## دخول محلي كامل

```sh
npm run supabase:start
npm run test:db
npm run test:worker
```

انسخ `.env.example` إلى `.env.local` و`.dev.vars.example` إلى `.dev.vars`. استخدم قيم **Supabase المحلي فقط** من `npx supabase status` في الملفات المتجاهلة من Git. المتصفح يحتاج الرابط والمفتاح العام فقط؛ service-role يذهب إلى `.dev.vars` فقط. لا تنسخ القيم إلى المستندات أو سجلات الاختبارات.

```sh
npm run build
npm run build:functions
npm run dev:pages
```

افتح `http://127.0.0.1:8788`. إعداد أول مدير عام واستعادة الدخول موثقان في [نموذج البيانات](docs/data-model.md). لا يوجد حساب افتراضي أو كلمة سر ثابتة. اختبارات API تنشئ حسابات وهمية وتحذفها بعد الاختبار.

في بيئة العمل الحالية، healthcheck داخل حاوية Auth يرسل طلبه المحلي عبر proxy ويستقبل 403 رغم أن الخدمة تعمل. استخدم `npm run supabase:start -- --ignore-health-check` فقط لهذه المشكلة المؤكدة، ثم أثبت الصحة الحقيقية بـ`npm run test:db` و`npm run test:worker`. لم نعطّل التحقق من TLS أو مصادقة الطلبات. يستغرق أول تنزيل للحاويات مساحة كبيرة مع Docker VFS.
