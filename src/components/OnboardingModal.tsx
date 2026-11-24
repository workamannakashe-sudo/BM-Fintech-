// OnboardingModal.tsx — First-Time Student Setup Wizard
import React, { useState } from "react";
import { useFinancial } from "../context/FinancialContext";
import {
  GraduationCap,
  Wallet,
  PieChart,
  Target,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Chandigarh", "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
];

const COURSES = [
  "B.Tech", "B.E", "B.Sc", "B.Com", "B.A", "BBA", "BCA", "MBBS", "B.Pharm", "B.Arch",
  "MBA", "M.Tech", "M.Sc", "MCA", "Polytechnic/Diploma", "Other",
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen }) => {
  const { profile, currency, setCurrency, setPreferredLanguage, completeOnboarding } = useFinancial();

  const [step, setStep] = useState(1);

  // Step 1: Profile
  const [course, setCourse] = useState(profile.course || "B.Tech");
  const [year, setYear] = useState<number>(profile.year || 2);
  const [state, setState] = useState(profile.state || "Maharashtra");
  const [category, setCategory] = useState<"Gen" | "OBC" | "SC" | "ST" | "EWS">(
    profile.category || "Gen"
  );
  const [incomeBracket, setIncomeBracket] = useState<"below_1L" | "1-3L" | "3-8L" | "above_8L">(
    profile.income_bracket || "1-3L"
  );

  // Step 2: Allowance & Currency
  const [allowance, setAllowance] = useState<number>(profile.monthlyAllowance || (currency === "INR" ? 12000 : 500));
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "INR">(currency || "INR");
  const [selectedLang, setSelectedLang] = useState<"en" | "hi" | "mr">(profile.preferred_language || "en");

  // Step 3: Envelopes
  const foodPct = 35;
  const housingPct = 30;
  const booksPct = 15;
  const travelPct = 10;
  const entertainmentPct = 10;

  // Step 4: Optional Goal
  const [goalName, setGoalName] = useState("Emergency Reserve");
  const [goalTarget, setGoalTarget] = useState<number>(currency === "INR" ? 5000 : 200);

  if (!isOpen) return null;

  const handleFinish = () => {
    setCurrency(selectedCurrency);
    setPreferredLanguage(selectedLang);

    const calculatedBudgets: Record<string, number> = {
      "Food & Dining": Math.round((allowance * foodPct) / 100),
      "Housing & Rent": Math.round((allowance * housingPct) / 100),
      "Textbooks & Tuition": Math.round((allowance * booksPct) / 100),
      "Transportation": Math.round((allowance * travelPct) / 100),
      "Entertainment & Subscriptions": Math.round((allowance * entertainmentPct) / 100),
    };

    completeOnboarding({
      profileUpdates: {
        course,
        year,
        state,
        category,
        income_bracket: incomeBracket,
        monthlyAllowance: allowance,
        academicYear: `${year}nd Year`,
        major: `${course} Student`,
        preferred_language: selectedLang,
      },
      envelopes: calculatedBudgets,
      initialGoal: goalTarget > 0 ? { name: goalName, target: goalTarget, current: 0 } : undefined,
    });
  };

  const symbol = selectedCurrency === "INR" ? "₹" : "$";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#15151b] border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" /> Welcome, {profile.name || "Student"}!
            </span>
            <span>Step {step} of 4</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Academic & Demographic Profile */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Academic Profile
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Used by FinBuddy to match eligible state & central scholarships.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Degree / Course
                </label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  {COURSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Year of Study
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  <option value={1}>1st Year (Freshman)</option>
                  <option value={2}>2nd Year (Sophomore)</option>
                  <option value={3}>3rd Year (Junior)</option>
                  <option value={4}>4th Year+ (Senior)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Domicile State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Social Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  <option value="Gen">General (Unreserved)</option>
                  <option value="OBC">OBC (Other Backward Class)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="EWS">EWS (Economically Weaker)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Family Income Bracket
                </label>
                <select
                  value={incomeBracket}
                  onChange={(e) => setIncomeBracket(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  <option value="below_1L">Below ₹1 Lakh</option>
                  <option value="1-3L">₹1–3 Lakh</option>
                  <option value="3-8L">₹3–8 Lakh</option>
                  <option value="above_8L">Above ₹8 Lakh</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Allowance & Currency */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Monthly Allowance & Currency
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Total cash inflow from family, stipend, or pocket money.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Monthly Allowance ({selectedCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    value={allowance}
                    onChange={(e) => setAllowance(Math.max(0, Number(e.target.value)))}
                    className="w-full h-11 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-base font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                    Currency
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCurrency("INR")}
                      className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedCurrency === "INR"
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      INR (₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCurrency("USD")}
                      className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedCurrency === "USD"
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      USD ($)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                    FinBuddy Language
                  </label>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="mr">मराठी (Marathi)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Initial Budget Envelopes */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Budget Envelopes
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Automated spending ceilings for peace of mind.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Food & Dining ({foodPct}%)</span>
                <span className="font-bold text-slate-900 dark:text-white">{symbol}{Math.round((allowance * foodPct) / 100)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Housing & Rent ({housingPct}%)</span>
                <span className="font-bold text-slate-900 dark:text-white">{symbol}{Math.round((allowance * housingPct) / 100)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Textbooks & Tuition ({booksPct}%)</span>
                <span className="font-bold text-slate-900 dark:text-white">{symbol}{Math.round((allowance * booksPct) / 100)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Transit & Personal ({travelPct + entertainmentPct}%)</span>
                <span className="font-bold text-slate-900 dark:text-white">{symbol}{Math.round((allowance * (travelPct + entertainmentPct)) / 100)}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: First Savings Goal */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  First Milestone Target
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Set your first student goal to unlock the &quot;Budget Rookie&quot; badge.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  placeholder="e.g. Emergency Fund or New Laptop"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Target Amount ({selectedCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(Math.max(0, Number(e.target.value)))}
                    className="w-full h-10 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Finish Setup & Launch
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
