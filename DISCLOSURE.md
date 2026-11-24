# Prior Work & Originality Disclosure — CODEFESTTHON 2026

**Event:** CODEFESTTHON 2026 (Organized by SuVa Developers)  
**Submission Track:** AI/ML  
**Project Title:** BudgetMitra (`BM-Fintech-`)  
**Repository:** [https://github.com/workamannakashe-sudo/BM-Fintech-](https://github.com/workamannakashe-sudo/BM-Fintech-)  
**Live Production URL:** [https://ibm-fintech.vercel.app/](https://ibm-fintech.vercel.app/)  

---

## 1. Prior Work Statement

In accordance with CODEFESTTHON 2026 rules regarding transparency and prior work disclosure, this document certifies the origin, history, and development scope of **BudgetMitra**.

BudgetMitra originally started as an entry for the *SkillUp Hackathon × IBM SkillsBuild (Student AI Track)*. For submission to **CODEFESTTHON 2026 (AI/ML Track)**, the project has undergone an extensive engineering overhaul, security hardening, and significant new artificial intelligence and statistical machine learning feature development.

No commit history has been deleted, rewritten, or obscured. All original commits remain visible in the repository history to ensure complete transparency.

---

## 2. Extent of Pre-Existing Work vs. Work Built During CODEFESTTHON 2026

### Pre-Existing Codebase (Prior to CODEFESTTHON)
* Initial front-end layout and wireframes using React 19, Vite, and Tailwind CSS.
* Basic client-side financial context structure and initial mock data seeds.
* Prototype loan amortization formula and heuristic rules for scholarships.

### Substantial New Engineering Built During CODEFESTTHON 2026
Between commits `a448e0f` and `dbfc863`, over **3,800 lines of code** were written, verified, and committed:

1. **Phase 1: User Data Isolation & Zero-Leakage Architecture (Commit `28c07f9`)**
   * Designed `userStorage.ts` ensuring all storage slices are strictly namespaced (`bm:${userId}:${key}`).
   * Completely eliminated demo data fallbacks for authenticated users. Real users now see only their own data.
   * Built a 4-step onboarding wizard (`OnboardingModal.tsx`) capturing academic profile, monthly allowance, budget envelopes, and milestone goals.
   * Added an explicit Guest / Demo Mode banner with isolated memory storage.

2. **Phase 2: Security, Serverless API Proxy & RLS Hardening (Commit `4918a10`)**
   * Migrated exposed client-side Gemini API keys behind a secure serverless backend endpoint (`api/chat.ts`).
   * Implemented sliding-window rate limiting (20 req/min) and prompt sanitization.
   * Wrote idempotent PostgreSQL production migrations (`supabase/migrations/20261124_production_schema.sql`) with Row Level Security (RLS) policies on all tables.
   * Added global React `ErrorBoundary.tsx`, security headers in `vercel.json` (CSP, X-Frame-Options: DENY), and GitHub Actions CI/CD (`.github/workflows/ci.yml`).

3. **Phase 3: Zero-Loss Split Bill Algorithm & Deep Links (Commit `58f1efc`)**
   * Implemented `src/utils/splitBill.ts` featuring a zero-loss equal split algorithm (`calculateExactSplit`) distributing non-divisible cent/paisa remainders to the payer.
   * Enabled dynamic custom friend addition, deletion, and local persistence.
   * Built standard UPI (`generateUpiLink`) and WhatsApp (`generateWhatsAppLink`) deep links.
   * Fixed PDF generator (`pdfGenerator.ts`) to support dynamic currency symbols (`Rs.`, `$`) and calendar dates.

4. **Phase 4 & 5: Core AI/ML Engineering (Commit `dbfc863`)**
   * **Feature A (Statistical Anomaly Detection & Predictive Burn Forecaster):** Built `src/services/anomalyForecast.ts` using Boris Iglewicz and David Hoaglin's Modified Z-Score based on Median Absolute Deviation (MAD). Developed a linear regression end-of-month spend forecaster predicting the exact day a student's allowance will run out.
   * **Feature B (Gemini Vision AI Receipt Scanner):** Built `api/receipt.ts` (Google Gemini 2.5 Flash Vision serverless endpoint) and `src/components/ReceiptScannerModal.tsx` featuring in-memory canvas downscaling (< 1MB) and an editable review modal.
   * **Feature C (Grounded FinBuddy Assistant with Safety Guardrails):** Grounded FinBuddy in real account metrics (with live badge), and introduced strict guardrails refusing speculative stock/crypto advice and offering crisis helpline support (Tele-MANAS 14416).
   * Added test suites bringing total automated test coverage to **111 tests across 24 test suites**.

---

## 3. Git Diff Statistics (New CODEFESTTHON Work)

```
$ git diff --stat a9d946a..dbfc863
 39 files changed, 3816 insertions(+), 458 deletions(-)
```

### Commit Range
* Starting commit: `a9d946a` (Pre-hackathon state)
* Milestone commits:
  * `a448e0f`: Phase 0 comprehensive audit
  * `28c07f9`: Phase 1 user data isolation & onboarding
  * `4918a10`: Phase 2 serverless AI proxy, RLS migrations & CI
  * `58f1efc`: Phase 3 zero-loss split bill algorithm & deep links
  * `dbfc863`: Phase 4 & 5 ML anomaly forecaster, Gemini Vision scanner & grounded AI

---

## 4. Compliance Declaration

We certify that this submission complies with all rules and guidelines of **CODEFESTTHON 2026**. All previously developed work has been openly declared, and the core features evaluated for the AI/ML track were newly authored and committed during the hackathon period.
