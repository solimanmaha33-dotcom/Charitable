# تحسين الخط العربي Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** عرض العربية بخط Noto Sans Arabic محلي موحد في كل أجهزة معاينة النظام.

**Architecture:** تُضاف ملفات الخط من حزمة npm مفتوحة المصدر وتُستورد في CSS العام، ثم يُختار الخط قبل خطوط النظام الحالية. لا يعتمد العرض على طلب خارجي.

**Tech Stack:** React, Vite, CSS, @fontsource/noto-sans-arabic.

**Spec:** `docs/superpowers/specs/2026-11-06-arabic-font-design.md`

## Global Constraints

- الخط محلي من نفس موقع التطبيق، دون طلب خارجي.
- العربية والنصوص الحالية تبقى كما هي.
- التغيير محصور في الخط العام وملفات توثيقه.

## Review Focus

- الأوزان العادية والعريضة يجب أن تتوفر دون تركيب صناعي غير مقصود.
- وجود خط احتياطي إذا تعذر تحميل ملف الخط.
- يجب أن يشير البناء إلى ملف موجود داخل حزمة التطبيق.

### Task 1: تضمين الخط العربي والتحقق منه

**Files:**
- Modify: `package.json` and `package-lock.json`
- Modify: `src/shared/app.css`
- Modify: `docs/progress.md`
- Create: this plan and the linked design doc

- [x] أضف `@fontsource/noto-sans-arabic` كاعتمادية مباشرة.
- [x] استورد ملفي CSS للوزنين 400 و700 في CSS العام، واجعل `Noto Sans Arabic` أول اختيار لخط الواجهة.
- [x] شغّل `npm run build`، وافحص ناتج `dist` للتأكد من تضمين ملفات الخط.
- [x] افتح معاينة محلية وافحص الشكل العربي وطلبات الشبكة؛ يجب ألا يطلب المتصفح الخط من نطاق خارجي.
- [x] حدّث `docs/progress.md` بنتيجة التحقق.
