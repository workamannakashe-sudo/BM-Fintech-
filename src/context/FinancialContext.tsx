// FinancialContext.tsx — BudgetMitra Financial Context (Composition Layer)
// =========================================================================
// This file is the SINGLE public API surface for all consumers via useFinancial().
// Internally it composes AuthContext + LedgerContext — all logic lives there.
// =========================================================================

import React, { createContext, useContext } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { LedgerProvider, useLedger } from "./LedgerContext";
import type { HealthBreakdown } from "../utils/health";

// ─── Public domain types ─────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  isAnomaly: boolean;
  anomalyExplanation?: string;
}

export interface StudentProfile {
  name: string;
  major: string;
  gpa: number;
  academicYear: string;
  incomeTier: string;
  firstGen: boolean;
  interests: string[];
  monthlyAllowance: number;
  course?: string;
  year?: number;
  state?: string;
  income_bracket?: "below_1L" | "1-3L" | "3-8L" | "above_8L";
  category?: "Gen" | "OBC" | "SC" | "ST" | "EWS";
  preferred_language?: "en" | "hi" | "mr";
  hasCompletedOnboarding?: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
}

export interface StudentLoan {
  id: string;
  name: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  extraPayment: number;
  type: "Subsidized" | "Unsubsidized" | "Personal" | "Home";
}

export interface UserAccount {
  email: string;
  password: string;
  name: string;
  userType: "Student" | "Professional";
  currency: "USD" | "INR";
  profile: StudentProfile;
  budgets: Record<string, number>;
  transactions: Transaction[];
  goals: SavingsGoal[];
  loans: StudentLoan[];
  dbProfileId?: string | null;
  createdAt: string;
}

// ─── Unified context type ─────────────────────────────────────────────────────

interface FinancialContextType {
  // Ledger
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
  updateProfile: (updates: Partial<StudentProfile>) => void;
  addTransaction: (description: string, amount: number, date?: string, category?: string) => Promise<Transaction>;
  addCSVTransactions: (rawList: Array<{ date: string; description: string; amount: number; category?: string }>) => Promise<number>;
  deleteTransaction: (id: string) => void;
  updateBudgetLimit: (category: string, limit: number) => void;
  addSavingsGoal: (name: string, target: number, current: number) => void;
  updateGoalSavings: (id: string, amount: number) => void;
  deleteSavingsGoal: (id: string) => void;
  updateLoanExtraPayment: (id: string, extraPayment: number) => void;
  resetDemoData: () => void;
  completeOnboarding: (data: {
    profileUpdates?: Partial<StudentProfile>;
    envelopes?: Record<string, number>;
    initialGoal?: { name: string; target: number; current?: number };
    initialLoan?: { name: string; principal: number; interestRate: number; termMonths: number; extraPayment?: number };
  }) => void;
  // Auth
  currency: "USD" | "INR";
  userType: "Student" | "Professional";
  isAuthenticated: boolean;
  isGuest: boolean;
  supabaseStatus: "connected" | "local" | "syncing" | "error";
  preferredLanguage: "en" | "hi" | "mr";
  setPreferredLanguage: (lang: "en" | "hi" | "mr") => void;
  setCurrency: (curr: "USD" | "INR") => void;
  setUserType: (type: "Student" | "Professional") => void;
  login: (email: string, password: string, userType: "Student" | "Professional", currency: "USD" | "INR", monthlyAllowance?: number) => Promise<{ success: boolean; error?: string }>;
  registerUser: (email: string, password: string, name: string, userType: "Student" | "Professional", currency: "USD" | "INR", monthlyAllowance?: number, additionalDetails?: Partial<StudentProfile>) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (userType: "Student" | "Professional", currency: "USD" | "INR", monthlyAllowance?: number) => void;
  logout: () => void;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

// ─── Inner bridge: reads both sub-contexts and merges into one value ──────────

const FinancialBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const ledger = useLedger();

  // Wrap ledger mutations with auth credentials and guest safety
  const updateProfile = (updates: Partial<StudentProfile>) =>
    ledger.updateProfile(updates, auth.dbProfileId, auth.isGuest);

  const addTransaction = (description: string, amount: number, date?: string, category?: string) =>
    ledger.addTransaction(description, amount, date, category, auth.dbProfileId, auth.isGuest);

  const deleteTransaction = (id: string) =>
    ledger.deleteTransaction(id, auth.dbProfileId, auth.isGuest);

  const updateBudgetLimit = (category: string, limit: number) =>
    ledger.updateBudgetLimit(category, limit, auth.dbProfileId, auth.isGuest);

  const addSavingsGoal = (name: string, target: number, current: number) =>
    ledger.addSavingsGoal(name, target, current, auth.dbProfileId, auth.isGuest);

  const deleteSavingsGoal = (id: string) =>
    ledger.deleteSavingsGoal(id, auth.dbProfileId, auth.isGuest);

  const resetDemoData = () =>
    ledger.resetDemoData(auth.currency, auth.userType);

  const setPreferredLanguage = (lang: "en" | "hi" | "mr") => {
    auth.setPreferredLanguage(lang);
    ledger.updateProfile({ preferred_language: lang }, auth.dbProfileId, auth.isGuest);
  };

  const completeOnboarding = (data: {
    profileUpdates?: Partial<StudentProfile>;
    envelopes?: Record<string, number>;
    initialGoal?: { name: string; target: number; current?: number };
    initialLoan?: { name: string; principal: number; interestRate: number; termMonths: number; extraPayment?: number };
  }) => {
    ledger.updateProfile(
      {
        ...data.profileUpdates,
        hasCompletedOnboarding: true,
      },
      auth.dbProfileId,
      auth.isGuest
    );

    if (data.envelopes) {
      Object.entries(data.envelopes).forEach(([cat, lim]) => {
        ledger.updateBudgetLimit(cat, lim, auth.dbProfileId, auth.isGuest);
      });
    }

    if (data.initialGoal && data.initialGoal.target > 0) {
      ledger.addSavingsGoal(
        data.initialGoal.name,
        data.initialGoal.target,
        data.initialGoal.current || 0,
        auth.dbProfileId,
        auth.isGuest
      );
    }
  };

  const logout = () => {
    auth.logout();
  };

  const value: FinancialContextType = {
    // ledger slice
    profile: ledger.profile,
    transactions: ledger.transactions,
    goals: ledger.goals,
    loans: ledger.loans,
    budgets: ledger.budgets,
    syncUrl: ledger.syncUrl,
    syncStatus: ledger.syncStatus,
    healthScore: ledger.healthScore,
    healthGrade: ledger.healthGrade,
    healthBreakdown: ledger.healthBreakdown,
    dailyBurnRate: ledger.dailyBurnRate,
    totalSpentThisMonth: ledger.totalSpentThisMonth,
    projectedBurnoutDay: ledger.projectedBurnoutDay,
    burnRateMultiplier: ledger.burnRateMultiplier,
    setBurnRateMultiplier: ledger.setBurnRateMultiplier,
    setSyncUrl: ledger.setSyncUrl,
    triggerSync: ledger.triggerSync,
    updateProfile,
    addTransaction,
    addCSVTransactions: ledger.addCSVTransactions,
    deleteTransaction,
    updateBudgetLimit,
    addSavingsGoal,
    updateGoalSavings: ledger.updateGoalSavings,
    deleteSavingsGoal,
    updateLoanExtraPayment: ledger.updateLoanExtraPayment,
    resetDemoData,
    completeOnboarding,
    // auth slice
    currency: auth.currency,
    userType: auth.userType,
    isAuthenticated: auth.isAuthenticated,
    isGuest: auth.isGuest,
    supabaseStatus: auth.supabaseStatus,
    preferredLanguage: auth.preferredLanguage,
    setPreferredLanguage,
    setCurrency: auth.setCurrency,
    setUserType: auth.setUserType,
    login: auth.login,
    registerUser: auth.registerUser,
    loginAsGuest: auth.loginAsGuest,
    logout,
  };

  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  );
};

// ─── FinancialProvider — composes sub-providers in the right order ────────────

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <LedgerProvider>
      <AuthBridge>
        {children}
      </AuthBridge>
    </LedgerProvider>
  );
};

const AuthBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { seedLedger, clearLedger } = useLedger();
  return (
    <AuthProvider onAuthSuccess={seedLedger} onLogoutClear={clearLedger}>
      <FinancialBridge>
        {children}
      </FinancialBridge>
    </AuthProvider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) throw new Error("useFinancial must be used within a FinancialProvider");
  return context;
};
