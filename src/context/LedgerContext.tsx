// LedgerContext.tsx — BudgetMitra Ledger Sub-Context
// ====================================================
// Owns: transactions, goals, loans, budgets, profile, and their mutations.
// Strict data isolation: NEVER defaults to seed data for authenticated users.
// ====================================================

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { autoCategorizeExpense, explainAnomaly } from "../services/gemini";
import { supabase, isSupabaseConfigured } from "../utils/supabase/client";
import { syncTransactionsToGoogleSheets } from "../services/sheetsSync";
import { calculateHealthScore } from "../utils/health";
import type { HealthBreakdown } from "../utils/health";
import type {
  Transaction,
  StudentProfile,
  SavingsGoal,
  StudentLoan,
} from "./FinancialContext";
import {
  DEFAULT_PROFILE_EMPTY,
  DEFAULT_PROFILE_INR_STUDENT,
  DEFAULT_BUDGETS_INR_STUDENT,
  SEED_TRANSACTIONS_INR_STUDENT,
  DEFAULT_GOALS_INR_STUDENT,
  DEFAULT_LOANS_INR_STUDENT,
  DEFAULT_PROFILE_USD_STUDENT,
  DEFAULT_BUDGETS_USD_STUDENT,
  SEED_TRANSACTIONS_USD_STUDENT,
  DEFAULT_GOALS_USD_STUDENT,
  DEFAULT_LOANS_USD_STUDENT,
  DEFAULT_PROFILE_INR_PROFESSIONAL,
  DEFAULT_BUDGETS_INR_PROFESSIONAL,
  SEED_TRANSACTIONS_INR_PROFESSIONAL,
  DEFAULT_GOALS_INR_PROFESSIONAL,
  DEFAULT_LOANS_INR_PROFESSIONAL,
  DEFAULT_PROFILE_USD_PROFESSIONAL,
  DEFAULT_BUDGETS_USD_PROFESSIONAL,
  SEED_TRANSACTIONS_USD_PROFESSIONAL,
  DEFAULT_GOALS_USD_PROFESSIONAL,
  DEFAULT_LOANS_USD_PROFESSIONAL,
} from "../services/financialSeeds";
import {
  getUserScope,
  saveUserSlice,
  clearLegacyDemoStorage,
} from "../utils/userStorage";

export interface LedgerContextType {
  profile: StudentProfile;
  transactions: Transaction[];
  goals: SavingsGoal[];
  loans: StudentLoan[];
  budgets: Record<string, number>;
  syncUrl: string;
  syncStatus: "synced" | "pending" | "offline" | "unconfigured";
  healthScore: number;
  healthGrade: string;
  healthBreakdown: HealthBreakdown;
  dailyBurnRate: number;
  totalSpentThisMonth: number;
  projectedBurnoutDay: string;
  burnRateMultiplier: number;
  setBurnRateMultiplier: (val: number) => void;
  setSyncUrl: (url: string) => void;
  triggerSync: () => Promise<boolean>;
  updateProfile: (updates: Partial<StudentProfile>, dbProfileId?: string | null, isGuest?: boolean) => void;
  addTransaction: (description: string, amount: number, date?: string, category?: string, dbProfileId?: string | null, isGuest?: boolean) => Promise<Transaction>;
  addCSVTransactions: (rawList: Array<{ date: string; description: string; amount: number; category?: string }>) => Promise<number>;
  deleteTransaction: (id: string, dbProfileId?: string | null, isGuest?: boolean) => void;
  updateBudgetLimit: (category: string, limit: number, dbProfileId?: string | null, isGuest?: boolean) => void;
  addSavingsGoal: (name: string, target: number, current: number, dbProfileId?: string | null, isGuest?: boolean) => void;
  updateGoalSavings: (id: string, amount: number) => void;
  deleteSavingsGoal: (id: string, dbProfileId?: string | null, isGuest?: boolean) => void;
  updateLoanExtraPayment: (id: string, extraPayment: number) => void;
  resetDemoData: (currency: "USD" | "INR", userType: "Student" | "Professional") => void;
  seedLedger: (seed: { profile: StudentProfile; budgets: Record<string, number>; transactions: Transaction[]; goals: SavingsGoal[]; loans: StudentLoan[] }) => void;
  clearLedger: () => void;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Clear obsolete un-namespaced keys on initialization
  useEffect(() => {
    clearLegacyDemoStorage();
  }, []);

  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_PROFILE_EMPTY);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loans, setLoans] = useState<StudentLoan[]>([]);

  const [burnRateMultiplier, setBurnRateMultiplier] = useState<number>(1.0);
  const [syncUrl, setSyncUrlState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bm_sync_url") || "";
    }
    return "";
  });
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "offline" | "unconfigured">(
    syncUrl ? "synced" : "unconfigured"
  );

  // ── Scoped persistence: namespaced strictly by active user scope ─────────────
  const persistSlice = <T,>(key: string, value: T) => {
    if (typeof window === "undefined") return;
    const currentEmail = localStorage.getItem("bm_current_user_email");
    const isGuest = localStorage.getItem("bm_is_guest") === "true";
    const scope = getUserScope(currentEmail, isGuest);
    if (scope === "anonymous") return;
    saveUserSlice(scope, key, value);

    // Also update local accounts registry if offline account exists
    if (!isGuest && currentEmail) {
      try {
        const raw = localStorage.getItem("bm_user_accounts");
        if (!raw) return;
        const all = JSON.parse(raw);
        if (all[currentEmail]) {
          all[currentEmail][key] = value;
          localStorage.setItem("bm_user_accounts", JSON.stringify(all));
        }
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => { persistSlice("profile", profile); }, [profile]);
  useEffect(() => { persistSlice("budgets", budgets); }, [budgets]);
  useEffect(() => { persistSlice("transactions", transactions); }, [transactions]);
  useEffect(() => { persistSlice("goals", goals); }, [goals]);
  useEffect(() => { persistSlice("loans", loans); }, [loans]);

  // ── Seed ledger (called by AuthContext after login/register/guest) ──────────
  const seedLedger: LedgerContextType["seedLedger"] = ({ profile, budgets, transactions, goals, loans }) => {
    setProfile(profile);
    setBudgets(budgets || {});
    setTransactions(transactions || []);
    setGoals(goals || []);
    setLoans(loans || []);
  };

  // ── Clear ledger (called on logout or user switch) ─────────────────────────
  const clearLedger = () => {
    setProfile(DEFAULT_PROFILE_EMPTY);
    setBudgets({});
    setTransactions([]);
    setGoals([]);
    setLoans([]);
  };

  // ── Computed values ─────────────────────────────────────────────────────────
  const totalSpentThisMonth = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const dailyBurnRate = useMemo(() => {
    const day = Math.max(1, new Date().getDate());
    return (totalSpentThisMonth / day) * burnRateMultiplier;
  }, [totalSpentThisMonth, burnRateMultiplier]);

  const projectedBurnoutDay = useMemo(() => {
    const totalBudget =
      profile.monthlyAllowance > 0
        ? profile.monthlyAllowance
        : Object.values(budgets).reduce((a, b) => a + b, 0);
    const remaining = Math.max(0, totalBudget - totalSpentThisMonth);
    if (dailyBurnRate <= 0) return "End of Month";

    const daysLeft = Math.floor(remaining / dailyBurnRate);
    const burnoutDate = new Date();
    burnoutDate.setDate(burnoutDate.getDate() + daysLeft);
    const lastDayOfMonth = new Date(burnoutDate.getFullYear(), burnoutDate.getMonth() + 1, 0).getDate();

    if (burnoutDate.getDate() > lastDayOfMonth) return "Safe - Budget Lasts Full Month";
    return `Day ${Math.min(lastDayOfMonth, burnoutDate.getDate())} of this Month`;
  }, [profile.monthlyAllowance, budgets, totalSpentThisMonth, dailyBurnRate]);

  // ── Health Score Breakdown ──────────────────────────────────────────────────
  const healthBreakdown: HealthBreakdown = useMemo(() => {
    const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
    const savingsTarget = goals.reduce((a, b) => a + b.target, 0);
    const actualSavings = goals.reduce((a, b) => a + b.current, 0);
    const anomalies = transactions.filter((t) => t.isAnomaly).length;
    const catSpent: Record<string, number> = {};
    transactions.forEach((t) => {
      catSpent[t.category] = (catSpent[t.category] || 0) + t.amount;
    });
    const overBudget = Object.entries(catSpent).filter(
      ([cat, spent]) => budgets[cat] && spent > budgets[cat]
    ).length;
    const activeDays = new Set(transactions.map((t) => t.date)).size;
    const elapsedDays = Math.max(1, new Date().getDate());

    return calculateHealthScore({
      monthlyIncome: profile.monthlyAllowance,
      totalExpenses: totalSpentThisMonth,
      totalBudget,
      savingsGoalTarget: savingsTarget,
      actualSavings,
      anomalyCount: anomalies,
      categoriesOverBudgetCount: overBudget,
      activeLoggingDays: activeDays,
      elapsedDaysInMonth: elapsedDays,
    });
  }, [profile.monthlyAllowance, totalSpentThisMonth, budgets, transactions, goals]);

  const healthScore = healthBreakdown.score;
  const healthGrade = healthBreakdown.grade;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const setSyncUrl = (url: string) => {
    setSyncUrlState(url);
    if (typeof window !== "undefined") {
      localStorage.setItem("bm_sync_url", url);
    }
    setSyncStatus(url ? "synced" : "unconfigured");
  };

  const triggerSync = async (): Promise<boolean> => {
    if (!syncUrl) return false;
    setSyncStatus("pending");
    try {
      const ok = await syncTransactionsToGoogleSheets(syncUrl, transactions);
      setSyncStatus(ok ? "synced" : "offline");
      return ok;
    } catch {
      setSyncStatus("offline");
      return false;
    }
  };

  const updateProfile = (updates: Partial<StudentProfile>, dbProfileId?: string | null, isGuest?: boolean) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    if (isSupabaseConfigured() && dbProfileId && !isGuest) {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.monthlyAllowance !== undefined) dbUpdates.monthly_allowance = updates.monthlyAllowance;
      if (updates.course !== undefined) dbUpdates.course = updates.course;
      if (updates.academicYear !== undefined) dbUpdates.academic_year = updates.academicYear;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.income_bracket !== undefined) dbUpdates.income_bracket = updates.income_bracket;
      if (updates.preferred_language !== undefined) dbUpdates.preferred_language = updates.preferred_language;
      if (updates.hasCompletedOnboarding !== undefined) dbUpdates.has_completed_onboarding = updates.hasCompletedOnboarding;
      if (Object.keys(dbUpdates).length > 0) {
        supabase.from("profiles").update(dbUpdates).eq("id", dbProfileId).then();
      }
    }
  };

  const addTransaction = async (
    description: string,
    amount: number,
    date?: string,
    category?: string,
    dbProfileId?: string | null,
    isGuest?: boolean
  ): Promise<Transaction> => {
    const txDate = date || new Date().toISOString().split("T")[0];
    const parsedCategory = category || (await autoCategorizeExpense(description));
    const categoryTx = transactions.filter((t) => t.category === parsedCategory);
    const avgCategorySpend =
      categoryTx.length > 0
        ? categoryTx.reduce((s, t) => s + t.amount, 0) / categoryTx.length
        : 20;
    const isAnomaly = categoryTx.length >= 2 && amount > avgCategorySpend * 2.0 && amount > 25;
    let anomalyExplanation: string | undefined;
    if (isAnomaly) {
      anomalyExplanation = await explainAnomaly(parsedCategory, amount, avgCategorySpend);
    }
    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: txDate,
      description,
      amount,
      category: parsedCategory,
      isAnomaly,
      anomalyExplanation,
    };
    setTransactions((prev) => [newTx, ...prev]);

    // NEVER call Supabase write methods for demo/guest mode
    if (isSupabaseConfigured() && dbProfileId && !isGuest) {
      supabase
        .from("transactions")
        .insert({
          user_id: dbProfileId,
          date: newTx.date,
          description: newTx.description,
          amount: newTx.amount,
          category: newTx.category,
          is_anomaly: newTx.isAnomaly,
          anomaly_explanation: newTx.anomalyExplanation,
        })
        .then();
    }
    return newTx;
  };

  const addCSVTransactions = async (
    rawList: Array<{ date: string; description: string; amount: number; category?: string }>
  ): Promise<number> => {
    const processed: Transaction[] = [];
    for (const item of rawList) {
      const cat = item.category || (await autoCategorizeExpense(item.description));
      processed.push({
        id: `csv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: cat,
        isAnomaly: false,
      });
    }
    setTransactions((prev) => [...processed, ...prev]);
    return processed.length;
  };

  const deleteTransaction = (id: string, dbProfileId?: string | null, isGuest?: boolean) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (isSupabaseConfigured() && dbProfileId && !isGuest) {
      supabase.from("transactions").delete().eq("id", id).eq("user_id", dbProfileId).then();
    }
  };

  const updateBudgetLimit = (category: string, limit: number, dbProfileId?: string | null, isGuest?: boolean) => {
    const safeLimit = Math.max(0, limit);
    setBudgets((prev) => ({ ...prev, [category]: safeLimit }));
    if (isSupabaseConfigured() && dbProfileId && !isGuest) {
      supabase
        .from("budgets")
        .upsert(
          {
            user_id: dbProfileId,
            category,
            allocated: safeLimit,
          },
          { onConflict: "user_id,category" }
        )
        .then();
    }
  };

  const addSavingsGoal = (
    name: string,
    target: number,
    current: number,
    dbProfileId?: string | null,
    isGuest?: boolean
  ) => {
    const newGoal: SavingsGoal = {
      id: `goal_${Date.now()}`,
      name,
      target: Math.max(1, target),
      current: Math.max(0, current),
    };
    setGoals((prev) => [...prev, newGoal]);
    if (isSupabaseConfigured() && dbProfileId && !isGuest) {
      supabase
        .from("savings_goals")
        .insert({
          user_id: dbProfileId,
          title: newGoal.name,
          target_amount: newGoal.target,
          current_amount: newGoal.current,
        })
        .then();
    }
  };

  const updateGoalSavings = (id: string, amount: number) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, current: Math.max(0, g.current + amount) } : g))
    );
  };

  const deleteSavingsGoal = (id: string, dbProfileId?: string | null, isGuest?: boolean) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (isSupabaseConfigured() && dbProfileId && !isGuest) {
      supabase.from("savings_goals").delete().eq("id", id).eq("user_id", dbProfileId).then();
    }
  };

  const updateLoanExtraPayment = (id: string, extraPayment: number) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, extraPayment: Math.max(0, extraPayment) } : l))
    );
  };

  const resetDemoData = (currency: "USD" | "INR", userType: "Student" | "Professional") => {
    if (currency === "INR") {
      setProfile(userType === "Student" ? DEFAULT_PROFILE_INR_STUDENT : DEFAULT_PROFILE_INR_PROFESSIONAL);
      setBudgets(userType === "Student" ? DEFAULT_BUDGETS_INR_STUDENT : DEFAULT_BUDGETS_INR_PROFESSIONAL);
      setTransactions(userType === "Student" ? SEED_TRANSACTIONS_INR_STUDENT : SEED_TRANSACTIONS_INR_PROFESSIONAL);
      setGoals(userType === "Student" ? DEFAULT_GOALS_INR_STUDENT : DEFAULT_GOALS_INR_PROFESSIONAL);
      setLoans(userType === "Student" ? DEFAULT_LOANS_INR_STUDENT : DEFAULT_LOANS_INR_PROFESSIONAL);
    } else {
      setProfile(userType === "Student" ? DEFAULT_PROFILE_USD_STUDENT : DEFAULT_PROFILE_USD_PROFESSIONAL);
      setBudgets(userType === "Student" ? DEFAULT_BUDGETS_USD_STUDENT : DEFAULT_BUDGETS_USD_PROFESSIONAL);
      setTransactions(userType === "Student" ? SEED_TRANSACTIONS_USD_STUDENT : SEED_TRANSACTIONS_USD_PROFESSIONAL);
      setGoals(userType === "Student" ? DEFAULT_GOALS_USD_STUDENT : DEFAULT_GOALS_USD_PROFESSIONAL);
      setLoans(userType === "Student" ? DEFAULT_LOANS_USD_STUDENT : DEFAULT_LOANS_USD_PROFESSIONAL);
    }
  };

  return (
    <LedgerContext.Provider
      value={{
        profile,
        transactions,
        goals,
        loans,
        budgets,
        syncUrl,
        syncStatus,
        healthScore,
        healthGrade,
        healthBreakdown,
        dailyBurnRate,
        totalSpentThisMonth,
        projectedBurnoutDay,
        burnRateMultiplier,
        setBurnRateMultiplier,
        setSyncUrl,
        triggerSync,
        updateProfile,
        addTransaction,
        addCSVTransactions,
        deleteTransaction,
        updateBudgetLimit,
        addSavingsGoal,
        updateGoalSavings,
        deleteSavingsGoal,
        updateLoanExtraPayment,
        resetDemoData,
        seedLedger,
        clearLedger,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
};
