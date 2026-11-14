# استكمال ملف الحالة Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إكمال بيانات الحالة، وتعديل أفرادها، ورفع البحث الاجتماعي، ومتابعة المساعدات الشهرية مع توقيع مطبوع.

**Architecture:** إضافة تحقق مشترك لرقم بالغ واحد مع بقاء الحفظ القديم، وترحيل قاعدة بيانات إضافي فقط لتصنيف المرفقات وحالة الأب لكل فرد. تُستخدم خدمات الحالة الحالية للرفع والتعديل، وتظل ملفات الصور وPDF خاصة. صفحة الحالة تجمع التنبيه وقائمة الأفراد وسجل الصرف، والطباعة تعرض البيانات المناسبة لكل تصنيف.

**Tech Stack:** React 19, TypeScript, Supabase PostgreSQL/RLS, Cloudflare Pages Functions, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-case-profile-completion-design.md`

## Global Constraints

- كل النصوص التي يراها الموظف تبقى بعامية مصرية بسيطة وواضحة.
- لا تعدّل أي migration قديم؛ أضف migrations جديدة متسلسلة عند الحاجة (`032–035`).
- لا تحذف ملفات أو جداول أو سجلات قائمة، ولا تفتح وصولًا عامًا للمرفقات.
- رقم قومي صحيح لبالغ عمره ١٨ سنة أو أكتر لازم يتسجل؛ أرقام الأطفال تفضل اختيارية.
- لا تمنع غيبة البحث الاجتماعي حفظ الحالة.
- احترم إعداد تقليل الحركة في تنبيه نقص البحث الاجتماعي.

## Review Focus

- رقم قومي موجود لكنه تاريخ ميلاده غير صالح أو أقل من ١٨: اختبر رفضه في `caseIdentity.test.ts` وفي SQL.
- مرفق قديم بلا نوع جديد: اختبر أن `document_type` الافتراضي `general` وأنه يظل ظاهرًا.
- إرسال ملف بلا نوع حالة أو حذف آخر نوع مباشرة من قاعدة البيانات: اختبر الرفض.
- ملفات أرملة أو مطلقة أو هجر: اختبر اختفاء بيانات الأب للأرملة وخانات المسؤول للتصنيفات الثلاثة في الشاشة والطباعة.
- فرد غير طفل أو ملف ليس «أخرى»: اختبر عدم إظهار أو حفظ حالة الأب الخاصة بالأيتام.
- مساعدة ملغاة أو شهر بلا مصروفات: اختبر عدم ظهور توقيع مطلوب للحركة الملغاة وظهور إجمالي الشهر الصحيح.

---

### Task 1: التحقق من الرقم القومي والسن في نموذج الحالة

**Files:**
- Create: `src/features/cases/caseIdentity.ts`
- Test: `src/features/cases/caseIdentity.test.ts`
- Modify: `src/features/cases/CaseIntakeForm.tsx`
- Test: `src/features/cases/CaseIntakeForm.test.tsx`
- Modify/Test: `src/services/cases.ts`, `src/services/cases.test.ts`

**Interfaces:**
- Produce `hasAdultCaseIdentity(candidates, today)` where each candidate has `nationalId` and reviewed `dateOfBirth`; return true only for a valid 14-digit Egyptian ID with a valid reviewed birth date making the person at least 18 by Cairo date.
- Consume existing `ageOn`, `cairoToday`, and `parseEgyptianNationalId` helpers.

- [x] أضف اختبارات للحالات: بالغ صحيح، كل الأرقام ناقصة، رقم قصير، تاريخ ميلاد غير صالح، شخص عمره ١٧، وحدّ يوم الميلاد الثامن عشر.
- [x] شغّل `npm test -- src/features/cases/caseIdentity.test.ts` وتأكد إن الاختبارات بتفشل بسبب غياب الدالة.
- [x] نفّذ الدالة وأضف تحقق الواجهة والخدمة من وجود رقم بالغ واحد بين الأب والأم والمسؤول.
- [x] رتّب كل خانة رقم قومي بالغ يتبعها السن المحسوب، واجعل تاريخ الميلاد قابلًا للمراجعة بدون إدخال يدوي للعمر.
- [x] اختبر منع الحفظ بدون رقم بالغ، مع بقاء رقم الطفل اختياريًا، واختبر رسائل مصرية.
- [x] شغّل اختبارات `caseIdentity`, `CaseIntakeForm`, و`cases`.

### Task 2: ترحيل قاعدة البيانات لملف البحث وحالة الأب للفرد

**Files:**
- Create: `supabase/migrations/032_case_profile_completion.sql`
- Create: `supabase/tests/case_profile_completion.test.sql`
- Modify only if needed: `src/services/cases.test.ts`

**Interfaces:**
- Add `case_attachments.document_type` constrained to `general` or `social_research`, default `general`.
- Add nullable `family_members.father_status` constrained to `الأب موجود` or `يتيم الأب`.
- Add protected RPCs `add_case_member_profile` and `update_case_member_profile` for `casesWrite` staff.
- Enforce one valid adult National ID in the case-save and identity-update database paths without making old rows fail reads.

- [x] أضف pgTAP اختبارات للحقول والقيود، رقم بالغ مطلوب في الحفظ المباشر، فشل الرقم القصير/القاصر، وصلاحية الكتابة على حالة الأب وتعديل الفرد.
- [x] شغّل اختبار قاعدة البيانات الجديد وتأكد من فشله قبل الترحيل.
- [x] أضف migration رقم 032 دون لمس migrations السابقة، وحافظ على المرفقات والملفات التاريخية.
- [x] أعد تشغيل اختبار pgTAP الجديد واختبارات `case_member_identity` و`case_contact_validation`.

### Task 3: رفع البحث الاجتماعي وعرض حالته

**Files:**
- Modify: `functions/api/case-files/upload.ts`
- Modify/Test: `src/services/cases.ts`, relevant service tests
- Modify: `src/features/cases/CaseIntakeForm.tsx`
- Modify/Test: `src/features/cases/CaseAttachmentsPanel.tsx`, matching panel tests
- Modify: `src/shared/app.css`

**Interfaces:**
- Extend `uploadCaseAttachment(caseFileId, file, documentType?)`; omitted type remains `general`.
- Add `documentType` to `CaseAttachment`; upload endpoint accepts only the two allowed types.

- [x] اختبر تصنيف البحث الاجتماعي منفصلًا عن المرفق العام، ورفض نوع مرفق غير معروف.
- [x] أضف اختيار PDF أو صورة للبحث الاجتماعي في نموذج الحالة ولوحة المرفقات، وارفعه بنوعه.
- [x] أظهر مؤشرًا أصفر هادئًا ورسالة مصرية عند غياب البحث، وأوقف الحركة عند `prefers-reduced-motion`.
- [x] أظهر حالة خضراء عند وجود البحث، واختبر بقاء التنبيه دون منع الحفظ.
- [x] شغّل اختبارات الرفع/المرفقات و`npm run build:functions`.

### Task 4: تعديل الأفراد واختيار حالة الأب في «أخرى»

**Files:**
- Create: `src/features/cases/memberRelationship.ts`
- Test: `src/features/cases/memberRelationship.test.ts`
- Modify: `src/services/cases.ts`
- Modify/Test: `src/features/cases/CaseMemberForm.tsx`, `CaseMemberForm.test.tsx`
- Modify/Test: `src/features/cases/CaseDetailsPage.tsx`, `CaseDetailsPage.test.tsx`

**Interfaces:**
- Add `father_status` to `Member` and a `showFatherStatus` prop to `CaseMemberForm`.
- Add service calls for atomic add and edit of member name, relationship, demographics, and family-specific father status.
- `isChildRelationship(value)` recognizes ابن، ابنة، ولد، طفلة and common Egyptian spelling variants.

- [x] اختبر تحديد صلة الطفل بالعربي وعدم اعتبار الزوج أو القريب طفلًا.
- [x] أضف اختبارات الإضافة والتعديل مع الاسم والقرابة وباقي البيانات، واختيار حالة الأب للطفل في «أخرى» فقط.
- [x] أظهر/أخفِ الأفراد بزر مستقل، وأضف تعديلًا لكل فرد مع تحديث القائمة بعد الحفظ.
- [x] شغّل اختبارات نموذج الفرد وصفحة الحالة واختبارات الخدمات.

### Task 5: إخفاء البيانات غير المناسبة في العرض والطباعة

**Files:**
- Modify/Test: `src/features/cases/CaseDetailsPage.tsx`, `CaseDetailsPage.test.tsx`
- Modify/Test: `src/features/cases/CasePrintDocument.tsx`, `CasePrintDocument.test.tsx`

- [x] أضف اختبارات تؤكد أن الأرملة لا تعرض اسم الأب أو رقمه أو صحته أو عمله، وأن خانات المسؤول مخفية للأرملة والمطلقة والهجر.
- [x] أخفِ البيانات نفسها من صفحة الحالة والطباعة، مع استمرار إظهار بيانات الأم والأفراد.
- [x] أظهر نوع البحث الاجتماعي في قائمة المرفقات المطبوعة.
- [x] شغّل اختبارات التفاصيل والطباعة.

### Task 6: ملخص المساعدات الشهرية والتوقيع المطبوع

**Files:**
- Modify/Test: `src/features/cases/CaseDisbursementsPanel.tsx`, `CaseDisbursementsPanel.test.tsx`
- Modify/Test: `src/features/cases/CasePrintDocument.tsx`, `CasePrintDocument.test.tsx`

**Interfaces:**
- Add a pure helper for current-month active disbursement count and total, using the Cairo month.
- Print one blank handwritten beneficiary signature line per active disbursement.

- [x] اختبر إجمالي الشهر الحالي واستبعاد الحركات الملغاة والبيانات من شهر آخر.
- [x] وضّح في صفحة الحالة أن هذا سجل المساعدة المصروفة خلال الشهر، مع الإجمالي.
- [x] أضف عمود توقيع مستفيد فارغ لكل حركة غير ملغاة في نموذج الطباعة، ولا تطلب توقيعًا للحركات الملغاة.
- [x] شغّل اختبارات لوحة الصرف والطباعة.

### Task 7: مراجعة المشروع والتوثيق والنشر

**Files:**
- Modify: `docs/AI_AGENT_PROJECT_GUIDE.md`
- Modify: `docs/data-model.md`
- Modify: `docs/progress.md`

- [x] حدّث دليل المشروع ونموذج البيانات وسجل التقدم بملف البحث الاجتماعي، رقم البالغ، حالة الأب لكل طفل، وسجل المساعدات.
- [x] شغّل `npm run typecheck`, `npm test`, `npm run test:worker`, `npm run test:db`, `npm run build`, و`npm run build:functions`.
- [x] راجع diff للتأكد من بقاء النصوص المصرية وعدم تعديل migrations سابقة أو كشف مرفقات، ومن اشتراط نوع حالة واحد على الأقل في قاعدة البيانات.
- [x] ثبّت التغييرات في commit محلي.
- [x] ادفع فرع التنفيذ إلى GitHub.
- [x] تأكد من مخرجات المالك أن migrations `032–035` اتطبقت على Supabase الصحيح.
- [ ] حدّث فرع `preview` وتأكد من نجاح نشر Cloudflare.
