# 💰 BudgetMitra — AI Financial Intelligence & Co-Pilot for Students

[![CODEFESTTHON 2026](https://img.shields.io/badge/CODEFESTTHON%202026-AI%2FML%20Track-purple?style=for-the-badge)](https://suvadevelopers.com)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-ibm--fintech.vercel.app-7928CA?style=for-the-badge&logo=vercel)](https://ibm-fintech.vercel.app/)
[![Tests Passing](https://img.shields.io/badge/Tests-111%2F111%20Passing-emerald?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite Build](https://img.shields.io/badge/Vite-Production%20Ready-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

> **Submitted to CODEFESTTHON 2026** — Target Track: **AI/ML**  
> **Production App:** [https://ibm-fintech.vercel.app/](https://ibm-fintech.vercel.app/)  
> **Source Repository:** [https://github.com/workamannakashe-sudo/BM-Fintech-](https://github.com/workamannakashe-sudo/BM-Fintech-)  
> **Mandatory Transparency:** [Prior Work Disclosure (DISCLOSURE.md)](./DISCLOSURE.md)

---

## 📌 Executive Summary

Over 70% of college students run out of money mid-month due to hidden expenses, impulse buys, and a lack of velocity visibility. **BudgetMitra** is a student-first AI financial co-pilot built to anticipate and prevent allowance exhaustion.

BudgetMitra combines **Google Gemini 2.5 Flash** with **statistical machine learning** (Boris Iglewicz Modified Z-Score with Median Absolute Deviation) to detect irregular spending spikes, forecast the exact calendar date an allowance will be depleted, and provide actionable daily reduction recommendations.

---

## 🚀 Key Innovations & Features

### 1. 🤖 Statistical Spend Anomaly Detection & Predictive Burn Forecaster (AI/ML Track)
* **Outlier-Resistant Baseline:** Uses median and Median Absolute Deviation (MAD) scaled by 1.4826 rather than simple mean, preventing single spikes from skewing student categories.
* **Predictive Run-Out Calculation:** Linear regression on daily cumulative spending computes velocity (`dailyBurnRate`) and projects whether allowance will be exhausted before month-end, naming the exact date (e.g., *"Allowance will run out on April 12; reduce daily spend by ₹120/day"*).

### 2. 📷 AI Vision Receipt Scanner (Gemini 2.5 Flash)
* Photograph or upload paper receipts and cafeteria bills.
* Client-side HTML5 canvas downscaling guarantees fast uploads under 500 KB.
* Serverless vision endpoint (`/api/receipt`) extracts merchant, date, total, and itemized breakdown into an editable review modal before saving to user records.

### 3. 💬 Grounded FinBuddy Multi-Turn Assistant & Safety Guardrails
* Grounded in real student metrics (current allowance, 30-day spending, budget envelope utilization, and goals).
* Visual verification badge: *"Grounded on: last 30 days, N transactions"*.
* **Strict Student Safety Guardrails:** Refuses speculative cryptocurrency/stock investment picks with an educational disclaimer, and provides 24/7 crisis support helplines (Tele-MANAS 14416 and RBI Sachet Portal) upon detecting financial distress.
* Native multilingual reasoning support for English, conversational Hindi, and Marathi.

### 4. 👥 Zero-Loss Group Bill Splitting & Deep-Links
* Zero-loss division algorithm (`calculateExactSplit`): non-divisible cent/paisa remainders are deterministically allocated to the payer so the split sum strictly equals the bill total.
* Dynamic custom friend creation, avatar selection, and deletion with user-scoped persistence.
* 1-click NPCI-compliant UPI deep-link QR codes (`generateUpiLink`) and WhatsApp sharing (`generateWhatsAppLink`).

### 5. 🛡️ Enterprise Security & Strict Data Isolation
* **Zero Demo Data Leakage:** Authenticated accounts strictly query `auth.uid() = user_id`. Demo data never appears in a logged-in account.
* **Isolated Demo Mode:** Judges and guests can test the full feature set in-memory without database writes.
* **Serverless Key Protection:** Secret API keys are guarded inside serverless endpoints (`/api/chat` and `/api/receipt`), never shipped in browser JS bundles.
* **Database RLS:** Idempotent Supabase PostgreSQL schema with Row Level Security policies on every table.

---

## 🧪 Verified Automated Test Suite

BudgetMitra enforces automated testing across unit, integration, and security layers:

```bash
$ npm run verify

> oxlint            # 0 errors
> tsc -b            # 0 type errors
> vitest run        # 111 passed across 24 test suites
> vite build        # Production bundle built in ~2.2s
```

### Test Suite Breakdown

| Test Suite File | Coverage Scope | Tests | Status |
| :--- | :--- | :---: | :---: |
| `src/__tests__/anomalyForecast.test.ts` | MAD math, outlier spikes, predictive run-out day | 8 | ✅ Pass |
| `src/__tests__/dataIsolation.test.ts` | User namespacing, zero demo leakage, session clearing | 6 | ✅ Pass |
| `src/__tests__/splitBill.test.ts` | Zero-loss rounding, payer cent allocation, deep links | 7 | ✅ Pass |
| `src/__tests__/chatService.test.ts` | Live grounding, guardrails, fallback heuristic | 6 | ✅ Pass |
| `src/__tests__/security.test.ts` | XSS sanitization, prompt injection defenses | 8 | ✅ Pass |
| `src/__tests__/passwordHashing.test.ts` | Cryptographic hashing and key derivation | 12 | ✅ Pass |
| `src/__tests__/gemini.test.ts` | Multilingual AI reasoning (EN / HI / MR) | 9 | ✅ Pass |
| *Other Suites (17 files)* | Auth, CSV parsing, SMS regex, Health score, UI modals | 55 | ✅ Pass |
| **Total Verified** | **Full application coverage** | **111** | **✅ 100% Pass** |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (React 19 + TypeScript + Vite)"]
        UI["Responsive Dashboard & UI Tabs"]
        Storage["User-Scoped Storage (bm:userId:*)"]
        CanvasDownscale["Canvas Image Compressor (< 500KB)"]
        StatEngine["Statistical Engine (MAD + Linear Burn)"]
    end

    subgraph Backend ["Serverless API Layer (Vercel)"]
        ChatEndpoint["/api/chat (Rate Limiting & Sanitization)"]
        ReceiptEndpoint["/api/receipt (Gemini 2.5 Flash Vision)"]
    end

    subgraph Services ["Cloud Services"]
        GeminiAPI["Google Gemini 2.5 Flash"]
        Postgres["Supabase Database (RLS Enforced)"]
    end

    UI --> Storage
    UI --> CanvasDownscale
    UI --> StatEngine
    UI -->|Bearer JWT| ChatEndpoint
    CanvasDownscale -->|Base64| ReceiptEndpoint
    ChatEndpoint -->|Private Key| GeminiAPI
    ReceiptEndpoint -->|Private Key| GeminiAPI
    Storage -->|auth.uid()| Postgres
```

---

## 🛠️ Local Development & Quick Start

### Prerequisites
* Node.js 20.x or higher
* npm 10.x or higher

### Installation

```bash
# 1. Clone repository
git clone https://github.com/workamannakashe-sudo/BM-Fintech-.git
cd BM-Fintech-

# 2. Install dependencies
npm install

# 3. Environment Setup
cp .env.example .env.local
# Add your VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and GEMINI_API_KEY

# 4. Run automated verification (lint, typecheck, test, build)
npm run verify

# 5. Start local development server
npm run dev
```

---

## 📋 Prior Work Disclosure (CODEFESTTHON 2026 Policy)

This project originated as a concept entry in the *SkillUp Hackathon × IBM SkillsBuild (Student AI Track)*. For **CODEFESTTHON 2026 (AI/ML Track)**, the project underwent a comprehensive architectural rewrite:

* **Prior Work State:** Initial wireframes and prototype amortization rules.
* **CODEFESTTHON Engineering Work:** 39 files modified, 3,816 lines added, 458 lines refactored (`a448e0f..dbfc863`). Added statistical MAD anomaly detection, predictive month-end linear burn forecaster, Gemini Vision receipt scanner, zero-loss split bill algorithm, serverless API proxy, Supabase RLS migrations, and 111 passing tests.
* Full itemized details and commit ranges are documented in **[DISCLOSURE.md](./DISCLOSURE.md)**.

---

## 📄 License

BudgetMitra is open-source under the [MIT License](./LICENSE).
