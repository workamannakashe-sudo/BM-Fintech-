# BudgetMitra Full Codebase Audit (Phase 0)
**Date:** 2026-11-24  
**Project:** BudgetMitra (`BM-Fintech-`)  
**Target Submission:** CODEFESTTHON 2026 — Track: AI/ML  

---

## 1. Demo-Data Leakage

The codebase currently contains extensive demo data leakage where hardcoded records, seed services, and fallback values bleed into authenticated user accounts.

### Files and Functions Containing Seed / Demo Data

| File | Function / Variable | Seed / Demo Content | Runs After Real Login? |
| :--- | :--- | :--- | :--- |
| `src/context/LedgerContext.tsx` | Initial `useState` hooks (lines 77-96) | `DEFAULT_PROFILE_INR_STUDENT` ("Rahul Sharma", Rs 15,000 allowance), `DEFAULT_BUDGETS_INR_STUDENT`, `SEED_TRANSACTIONS_INR_STUDENT` (10 transactions: Dominos, PG rent, etc.), `DEFAULT_GOALS_INR_STUDENT` ("Emergency Fund", "Laptop Upgrade"), `DEFAULT_LOANS_INR_STUDENT` | **YES.** On page reload or fresh mount before remote fetch finishes, or whenever `localStorage` is empty, real users immediately see Rahul Sharma's transactions and goals. |
| `src/context/AuthContext.tsx` | `registerUser` (lines 291-294) | `initialBudgets = { ...DEFAULT_BUDGETS_INR_STUDENT }`, `initialTransactions = [ ...SEED_TRANSACTIONS_INR_STUDENT ]`, `initialGoals = [ ...DEFAULT_GOALS_INR_STUDENT ]`, `initialLoans = [ ...DEFAULT_LOANS_INR_STUDENT ]` | **YES.** Every brand new user who signs up automatically receives 10 fake transactions, 2 fake savings goals, and fake student loans pre-injected into their account registry. |
| `src/context/AuthContext.tsx` | `login` (lines 272-274) | Fallback to `DEFAULT_BUDGETS_INR_STUDENT`, `SEED_TRANSACTIONS_INR_STUDENT`, `DEFAULT_GOALS_INR_STUDENT`, `DEFAULT_LOANS_INR_STUDENT` if account slices are undefined. | **YES.** In offline / fallback scenarios, missing fields are populated with seed data. |
| `src/services/financialSeeds.ts` | `SEED_TRANSACTIONS_INR_STUDENT`, `SEED_TRANSACTIONS_USD_STUDENT`, `DEFAULT_GOALS_*`, `DEFAULT_LOANS_*` | Hardcoded transactions (PG hostel rent Rs 5,500, Dominos pizza Rs 950), Emergency Fund (Rs 15,000 / Rs 8,000), Laptop Upgrade (Rs 45,000 / Rs 12,000), Vidya Lakshmi Loan (Rs 2,50,000). | Exported and imported into state initialization. |
| `src/pages/SplitBill.tsx` | `INITIAL_FRIENDS` (lines 29-36) | Hardcoded static friends: "Rohan S.", "Sneha P.", "Priyansh K.", "Neha M.", "Aman N.", "Tanvi D.". | **YES.** Split bill always displays these hardcoded friends; users cannot manage their own contact list. (README also referenced "Jony, Amy, Lisa, Drake, Sarah, Rohan"). |
| `src/services/ibmBob.ts` | Fallback rules (lines 42, 62, 71, 77) | Hardcoded hints and examples: "Emergency Fund (₹5,000)", "study abroad", "laptop". | Visible when asking AI assistant while state is unpopulated. |
| `src/context/AuthContext.tsx` | `ensureDemoAccount` (lines 69-87) | Pre-creates demo user `rahul@budgetmitra.in` with password hash in `bm_user_accounts` registry. | Global registry in localStorage. |
| `src/context/LedgerContext.tsx` | `persistSlice` / `useEffect` (lines 104-124) | Un-namespaced localStorage keys: `bm_profile`, `bm_budgets`, `bm_transactions`, `bm_goals`, `bm_loans`. | **YES.** State is saved globally without user ID prefix. When User A logs out and User B logs in, User B inherits User A's un-namespaced keys. |
| `src/context/AuthContext.tsx` | `logout` (lines 328-341) | Only removes `bm_authenticated`, `bm_is_guest`, `bm_current_user_email`. Leaves `bm_transactions`, `bm_goals`, `bm_budgets`, `bm_profile`, `bm_loans`, `bm_xp`, `bm_streak` in storage and React state. | **YES.** Next user inherits previous user's ledger data. |

---

## 2. Security

1. **Gemini API Key Exposure**:
   - `src/services/gemini.ts` reads `import.meta.env.VITE_GEMINI_API_KEY` and fallback `localStorage.getItem("fw_gemini_api_key")`.
   - Any key prefixed with `VITE_` is baked directly into client bundle assets (`dist/assets/vendor-ai-*.js`). Anyone visiting the web app can extract the raw Google Gemini API key from network requests or bundle inspection.
   - User inputs can also be typed into a client-side localStorage key.
   - **Fix Required:** Move all Gemini API interactions to serverless API routes (`/api/chat` and `/api/receipt`) protected by Supabase JWT authorization and per-user rate limiting.

2. **Supabase Client Credentials & RLS Status**:
   - `src/utils/supabase/client.ts` hardcodes a fallback Supabase Project URL (`https://aaopluetljjrvykcrxew.supabase.co`) and anon publishable key (`sb_publishable_N9Iig0qzCLHdsa7v5plMfQ_96cIVXCr`).
   - The publishable anon key is permissible client-side in Supabase architecture, *provided* RLS is strictly enforced.
   - Database RLS Status (`supabase_schema.sql`):
     - `profiles`: RLS enabled, select/insert/update scoped to `auth.uid() = id`.
     - `transactions`: RLS enabled, select/insert/update/delete scoped to `auth.uid() = user_id`.
     - `budgets`: RLS enabled, select/insert/update/delete scoped to `auth.uid() = user_id`.
     - `schemes`: Public read, no write for authenticated users (reference data).
     - `chat_messages`: RLS enabled, select/insert/delete scoped to `auth.uid() = user_id`.
     - **Missing Tables in SQL Schema:** Tables `savings_goals` and `loans` referenced by `src/services/supabaseFinancial.ts` are *missing* from `supabase_schema.sql`! If created without proper RLS policies, they could be unsecured or fail queries.
     - **Field Name Mismatches:** In `supabase_schema.sql`, `budgets` table uses `limit_amount`, but `supabaseFinancial.ts` selects `monthly_limit`. `transactions` table uses `created_at`, but `supabaseFinancial.ts` expects `date`.

3. **Git History & Secret Scan**:
   - Git log scan showed historical commits referencing credential inputs (`abf9a95`, `9352584`).
   - No raw Google Gemini `AIzaSy...` production secret was committed directly in tracked code files (only a test stub `AIzaSyD1234567890abcdef` in `src/__tests__/security.test.ts`).
   - However, if the live Vercel deployment has `VITE_GEMINI_API_KEY` configured in environment variables, that key was bundled in production client builds and must be rotated once the serverless proxy is in place.

4. **XSS & Injection Surfaces**:
   - `dangerouslySetInnerHTML`: **None found** in the codebase.
   - Input sanitization: `src/utils/security.ts` contains `sanitizePromptQuery` and CSV cell escaping against formula injection (`=`, `+`, `-`, `@`).
   - Prompt Injection: While client-side sanitization strips delimiters, raw client-to-Gemini requests could still be bypassed by tampering with browser code. Serverless endpoint validation will enforce strict payload bounds (e.g. 1000 characters).

---

## 3. Auth and Data Flow

1. **Session Handling & Route Protection**:
   - Managed via `App.tsx` state (`isAuthenticated`). There is no router library (React Router); page switches occur via `activeTab` string state.
   - If not authenticated, `App.tsx` renders `<Login />`.
   - On page refresh, `AuthContext.tsx` checks `localStorage.getItem("bm_authenticated") === "true"` and queries `supabase.auth.getSession()`.
2. **Failure Modes**:
   - In `AuthContext.tsx`: if Supabase login or remote fetch fails, the app falls through to `localStorage` user registry (`bm_user_accounts`). If that account is missing or has empty arrays, it silently loads Rahul Sharma's seed data.
3. **Logout & User Switch Behavior**:
   - On logout, only auth flag keys are removed. The React state in `LedgerContext` is **never reset**.
   - If User A logs out and User B logs in on the same browser, User B briefly sees User A's un-namespaced local state, and if User B has no records in Supabase, User A's data is copied into User B's account.

---

## 4. README Truthfulness

| README Claim | Status | Evidence & Reality |
| :--- | :--- | :--- |
| **"51/51 tests passing across 13 suites"** | **FALSE / OUTDATED** | Current test suite actually has **93 tests passing across 22 test files**! The badge and text are outdated. |
| **"WCAG AA compliant"** | **PARTIAL** | Basic color tokens and semantic tags exist, but several components have contrast issues in dark mode, missing aria attributes on custom icon buttons, and no focus trap in modals. |
| **"OCR receipt scanner"** | **FALSE** | `SplitBill.tsx` and `SplitBillModal.tsx` trigger: `onClick={() => alert("Receipt uploaded and auto-scanned via OCR!")}`. Completely fake alert. |
| **"Google Sheets two-way sync"** | **FALSE** | `sheetsSync.ts` provides a one-way `no-cors` `fetch(syncUrl)` outbound POST. It does NOT read from Google Sheets or perform two-way synchronization. |
| **"Multilingual (English/Hindi/Marathi)"** | **PARTIAL** | Gemini prompts include instructions to output in Hindi/Marathi when requested. However, the application UI (buttons, labels, nav, errors) is entirely English, and the offline fallback engine `ibmBob.ts` only responds in English. |
| **"PDF statements"** | **PARTIAL** | `pdfGenerator.ts` generates a jsPDF document, but hardcodes `$` signs everywhere (e.g. `$15000.00`) even when currency is INR, and does not handle rupee symbols or dynamic currencies properly. |
| **"WhatsApp/UPI deep-links"** | **TRUE** | `SplitBill.tsx` correctly generates `upi://pay` links and `https://wa.me/?text=...` with URI encoding. |
| **"Lighthouse/zero build errors"** | **PARTIAL** | Build passes with code-splitting chunks. However, `npm run lint` fails with an invalid hook call error in `src/pages/Budget.tsx` line 42 (`useFinancial()` called inside `useMemo`). |
| **Self-awarded "10/10" judging scores** | **INAPPROPRIATE** | README contains a self-graded judging matrix awarding itself 10/10 across all categories. Must be removed for CODEFESTTHON submission. |

---

## 5. Broken or Placeholder Code

1. **React Hook Rule Violation in `src/pages/Budget.tsx`**:
   - Line 42: `const list = useFinancial().transactions;` inside a `useMemo` callback. Causes `oxlint` error and React runtime console warnings.
2. **Fake OCR Action**:
   - `SplitBill.tsx` line 218: `onClick={() => alert("Receipt OCR initialized: Upload bill photo to auto-extract items!")}`.
3. **Hardcoded Contacts in Split Bill**:
   - Fixed array of 6 friends (`Rohan S.`, `Sneha P.`, `Priyansh K.`, `Neha M.`, `Aman N.`, `Tanvi D.`). No ability to add, edit, or delete friends.
4. **TODOs in Code**:
   - 8 TODO comments in `src/pages/Scholarships.tsx` and 4 in `supabase_schema.sql` regarding verification against official scholarship websites.
5. **Leftover IBM Prompts / Branding**:
   - `IBM_BOB_USAGE.docx` in repo root.
   - `AI Financial CoPilot - Hackathon PPT .zip` in repo root.
   - Text in `README.md`: `> **Student Developer Note**: [describe specific Bob usage here]`.
   - Mentions of IBM Bob and SkillUp Hackathon throughout docs and prompts.

---

## 6. Repo Hygiene

1. **Files to Remove**:
   - `AI Financial CoPilot - Hackathon PPT .zip` (old hackathon slides).
   - `IBM_BOB_USAGE.docx` (old hackathon submission form).
2. **Missing Configuration Files**:
   - `.env.example` is missing.
   - `LICENSE` is missing (needed for open hackathon submission).
   - `SECURITY.md` is missing.
   - `vercel.json` is missing (needed for serverless routes and security headers).
3. **Incorrect Repository & Project URLs**:
   - README links point to `https://github.com/workamannakashe-sudo/IBM-Fintech-` (actual repo name is `BM-Fintech-`).

---

## 7. Production Gaps

1. **Error Boundaries**: No top-level React Error Boundary exists. Any unhandled UI throw results in a white screen.
2. **Empty & Loading States**: Real new users with 0 transactions currently see seed transactions instead of a clean, motivating empty state with onboarding actions.
3. **Offline & State Persistence**: Local storage keys are un-namespaced. Logging in as another user can overwrite or inherit local cache.
4. **CI/CD**: No GitHub Actions workflow exists for automated linting, typechecking, and tests on push.

---

## Prioritized Action Plan

1. **Phase 1: Fix Demo Data Leakage**
   - Isolate authenticated users from seed data. Initialize empty arrays for new users.
   - Namespace all localStorage keys by user ID (`bm:{userId}:*`).
   - Implement an explicit Guest/Demo Mode with a persistent banner and in-memory store.
   - Build a first-time user Onboarding flow (allowance, course, first envelope/goal).
   - Clear all state and caches on logout.

2. **Phase 2: Security & Production Hardening**
   - Create serverless API routes (`/api/chat` and `/api/receipt`) in Vercel to protect Gemini API key.
   - Clean client code: remove `VITE_GEMINI_API_KEY` from client bundle.
   - Add `.env.example` and `vercel.json` with security headers.
   - Fix Supabase schema migrations for `savings_goals` and `loans`, ensure RLS with triggers.
   - Add Global React Error Boundary and Toast notifications.

3. **Phase 3: Fix Fake or Half-Built Features**
   - Replace fake OCR alert with real AI receipt analysis (Gemini Vision via `/api/receipt`).
   - Enable custom friends list in Split Bill with proper remainder rounding.
   - Fix PDF generator to support INR/USD dynamically and render clean currency labels.
   - Fix lint rule error in `Budget.tsx`.

4. **Phase 4: Tests and Quality Gates**
   - Add unit and integration tests for data isolation, onboarding, demo mode, and new modules.
   - Add `npm run verify` script.
   - Maintain 100% green tests and typecheck.

5. **Phase 5: New AI/ML Features (CODEFESTTHON Core)**
   - **Feature A:** Spending Anomaly Detection & Allowance Exhaustion Forecaster.
   - **Feature B:** AI Receipt Scanner via Gemini Vision (`/api/receipt`).
   - **Feature C:** Grounded Multilingual FinBuddy Assistant with data provenance indicators.

6. **Phase 6: Submission Package & Cleanup**
   - Add `DISCLOSURE.md` (Prior Work Disclosure compliant with CODEFESTTHON rules).
   - Add `SUBMISSION.md`, `LICENSE`, `SECURITY.md`, and clean `README.md`.
   - Remove obsolete zip/docx files after user confirmation.
