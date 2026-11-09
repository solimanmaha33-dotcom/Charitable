# توحيد عدّ الحالات والفلاتر Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** اعتبار كل ملف أسرة حالة واحدة، وعرض أعداد الحالات والأطفال والأيتام مع البحث وفلاتر الأعمار والتصنيفات.

**Architecture:** دوال حساب واختيار صغيرة في `src/features/families/caseMetrics.ts` تستخدم أفراد الأسرة وتصنيفات الحالات المحمّلة بالفعل. تستخدمها قائمة الحالات والرئيسية، دون تعديل قاعدة البيانات.

**Tech Stack:** React، TypeScript، Vitest، Supabase client الحالي.

**Spec:** `docs/superpowers/specs/2026-11-08-case-counts-and-filters-design.md`

## Global Constraints

- كل ملف أسرة فريد يُحسب حالة واحدة.
- الطفل فرد عمره أقل من ١٨ سنة، واليتيم فرد أقل من ١٨ سنة بملف مصنّف يتيم الأم أو الأب.
- فلاتر العمر: أقل من ١٨، أقل من ٢١، وكبار السن من ٦٠ سنة فأكثر.
- البحث النصي يعمل مع فلتر العمر/الأيتام وتصنيف الحالة.
- الأعمار تُحسب بتاريخ القاهرة؛ من لا يملك تاريخ ميلاد لا يدخل في عدّ أو فلتر الأعمار.
- لا تعديل على البيانات أو الصلاحيات أو قاعدة البيانات.

## Review Focus

- يُحسب العمر بتاريخ القاهرة؛ يزيد العمر في يوم الميلاد نفسه ولا يُحسب قبله.
- الفرد بلا تاريخ ميلاد لا يُحسب ضمن أعمار الأطفال أو فلاتر السن.
- الأسرة التي فيها أكثر من طفل يتيم تُحسب فيها الأفراد كلهم، مع بقاء الأسرة نتيجة واحدة في القائمة.
- عند وجود تصنيف حالة وعمر معاً، لا تظهر الأسرة إلا إذا حقق كلا الشرطين.
- البحث عن اسم أو كود يظل يعمل بعد اختيار الفلاتر.

---

### Task 1: حساب الأعداد وتحديد ملفات الحالات المطابقة

**Files:**
- Create: `src/features/families/caseMetrics.ts`
- Test: `src/features/families/caseMetrics.test.ts`
- Read-only inputs: types in `src/services/cases.ts`, age helper in `src/features/families/memberAge.ts`

**Interfaces:**
- Produces `countCaseMembers(cases: CaseRecord[], members: FamilyMember[], today: string): { children: number; orphans: number }`.
- Produces `matchesCaseDirectoryFilter(familyId: string, cases: CaseRecord[], members: FamilyMember[], ageFilter: 'all' | 'orphans' | 'under18' | 'under21' | 'elderly', category: CaseCategory | '', today: string): boolean`.
- `orphans` counts each member under 18 once when any case for that family is categorized `يتيم الأم` or `يتيم الأب`.

- [x] **Step 1: Write failing tests** for age boundaries (17/18/20/21/59/60), missing birth date, two orphan children in one family, no orphan classification, multiple case rows per family, and combined age/category filters.
- [x] **Step 2: Run** `npm test -- --run src/features/families/caseMetrics.test.ts`; confirm the missing module causes failure.
- [x] **Step 3: Implement** the two exported functions using `ageOn`, unique person IDs across family links (see ledger ruling), and current case categories.
- [x] **Step 4: Run** the targeted test; expect all cases to pass.

### Task 2: عرض الملخص والفلاتر في الصفحات

**Files:**
- Modify: `src/features/families/FamilyListPage.tsx`
- Test: `src/features/families/FamilyListPage.test.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Test: `src/features/home/HomePage.test.tsx`
- Modify: `docs/data-model.md`, `docs/progress.md`

**Interfaces:**
- Consumes `countCaseMembers` and `matchesCaseDirectoryFilter` from Task 1.
- قائمة الحالات تحسب عدد الملفات المعروضة من الأسر الفريدة، وتعرض إجمالي ملفات الحالات والأطفال والأيتام.
- الرئيسية تعرض الحالات والأطفال والأيتام؛ لا تعرض الأسر كعداد إضافي.
- البحث وتصنيف الحالة الحاليان يظلان، ويضاف إليهما فلتر عمر/أيتام مستقل.

- [x] **Step 1: Write failing tests** verifying the three counts, removal of the duplicate family card, each new filter, category plus age filtering, and text search plus filters.
- [x] **Step 2: Run** `npm test -- --run src/features/families/FamilyListPage.test.tsx src/features/home/HomePage.test.tsx`; confirm the new assertions fail.
- [x] **Step 3: Implement** counts and two compatible filters; keep each family as one table row and use clear Arabic labels.
- [x] **Step 4: Update** `docs/data-model.md` and `docs/progress.md` with counting rules and completed behavior.
- [x] **Step 5: Run** the targeted tests, then `npm test -- --run`, `npm run typecheck`, and `npm run build`; expect all to pass.
- [x] **Step 6: Commit** with message `feat: unify case counts and filters`.
