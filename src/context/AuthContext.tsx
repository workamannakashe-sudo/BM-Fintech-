// AuthContext.tsx — BudgetMitra Authentication Sub-Context
// ==========================================================
// Owns: isAuthenticated, isGuest, userType, currency, preferredLanguage,
//       supabaseStatus, dbProfileId, login, registerUser, loginAsGuest, logout.
// Strict data isolation: authenticated accounts never load seed/demo records.
// ==========================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../utils/supabase/client";
import { hashPassword, isPlaintextPassword } from "../utils/security";
import type { StudentProfile, SavingsGoal, StudentLoan, Transaction } from "./FinancialContext";
import {
  DEFAULT_BUDGETS_INR_STUDENT,
  DEFAULT_BUDGETS_USD_STUDENT,
  SEED_TRANSACTIONS_INR_STUDENT,
  SEED_TRANSACTIONS_USD_STUDENT,
  DEFAULT_GOALS_INR_STUDENT,
  DEFAULT_GOALS_USD_STUDENT,
  DEFAULT_LOANS_INR_STUDENT,
  DEFAULT_LOANS_USD_STUDENT,
  GUEST_GAMIFICATION_SEED,
} from "../services/financialSeeds";
import { loadUserSupabaseData } from "../services/supabaseFinancial";
import { saveUserSlice, clearUserScope } from "../utils/userStorage";

// ─── UserAccount registry helpers (offline local accounts) ───────────────────

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

const ACCOUNTS_KEY = "bm_user_accounts";

const getStoredUserAccounts = (): Record<string, UserAccount> => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
};

const saveUserAccountToRegistry = (account: UserAccount) => {
  try {
    const all = getStoredUserAccounts();
    all[account.email.toLowerCase()] = account;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
};

const findUserAccountInRegistry = (email: string): UserAccount | undefined => {
  return getStoredUserAccounts()[email.toLowerCase()];
};

const DEMO_PASSWORD_HASH = "0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d";

// ─── Context shape ────────────────────────────────────────────────────────────

export interface AuthLedgerSeed {
  profile: StudentProfile;
  budgets: Record<string, number>;
  transactions: Transaction[];
  goals: SavingsGoal[];
  loans: StudentLoan[];
  dbProfileId?: string | null;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  userType: "Student" | "Professional";
  currency: "USD" | "INR";
  preferredLanguage: "en" | "hi" | "mr";
  supabaseStatus: "connected" | "local" | "syncing" | "error";
  dbProfileId: string | null;
  setCurrency: (curr: "USD" | "INR") => void;
  setUserType: (type: "Student" | "Professional") => void;
  setPreferredLanguage: (lang: "en" | "hi" | "mr") => void;
  onAuthSuccess: (seed: AuthLedgerSeed) => void;
  login: (
    email: string,
    password: string,
    userType: "Student" | "Professional",
    currency: "USD" | "INR",
    monthlyAllowance?: number
  ) => Promise<{ success: boolean; error?: string }>;
  registerUser: (
    email: string,
    password: string,
    name: string,
    userType: "Student" | "Professional",
    currency: "USD" | "INR",
    monthlyAllowance?: number,
    additionalDetails?: Partial<StudentProfile>
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (
    userType: "Student" | "Professional",
    currency: "USD" | "INR",
    monthlyAllowance?: number
  ) => void;
  logout: (onBeforeClear?: () => void) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onAuthSuccess: (seed: AuthLedgerSeed) => void;
  onLogoutClear?: () => void;
}> = ({ children, onAuthSuccess, onLogoutClear }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem("bm_authenticated") === "true"
  );
  const [isGuest, setIsGuest] = useState<boolean>(
    () => localStorage.getItem("bm_is_guest") === "true"
  );
  const [userType, setUserTypeState] = useState<"Student" | "Professional">(
    () => (localStorage.getItem("bm_user_type") as "Student" | "Professional") || "Student"
  );
  const [currency, setCurrencyState] = useState<"USD" | "INR">(
    () => (localStorage.getItem("bm_currency") as "USD" | "INR") || "INR"
  );
  const [preferredLanguage, setPreferredLanguageState] = useState<"en" | "hi" | "mr">(
    () => (localStorage.getItem("bm_language") as "en" | "hi" | "mr") || "en"
  );
  const [dbProfileId, setDbProfileId] = useState<string | null>(null);

  const supabaseStatus: "connected" | "local" | "syncing" | "error" = isSupabaseConfigured()
    ? "connected"
    : "local";

  useEffect(() => {
    localStorage.setItem("bm_currency", currency);
  }, [currency]);
  useEffect(() => {
    localStorage.setItem("bm_user_type", userType);
  }, [userType]);
  useEffect(() => {
    localStorage.setItem("bm_language", preferredLanguage);
  }, [preferredLanguage]);
  useEffect(() => {
    localStorage.setItem("bm_authenticated", String(isAuthenticated));
    localStorage.setItem("bm_is_guest", String(isGuest));
  }, [isAuthenticated, isGuest]);

  // Hydrate Supabase session on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
      const session = data?.session;
      if (session?.user) {
        setIsAuthenticated(true);
        setIsGuest(false);
        localStorage.setItem("bm_current_user_email", session.user.email || "");
        loadUserSupabaseData(session.user.email).then((d) => {
          if (d) {
            setDbProfileId(d.profileId);
            onAuthSuccess({
              profile: d.profile,
              budgets: d.budgets,
              transactions: d.transactions,
              goals: d.goals,
              loans: d.loans,
              dbProfileId: d.profileId,
            });
          }
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setIsGuest(false);
        localStorage.setItem("bm_current_user_email", session.user.email || "");
        loadUserSupabaseData(session.user.email).then((d) => {
          if (d) {
            setDbProfileId(d.profileId);
            onAuthSuccess({
              profile: d.profile,
              budgets: d.budgets,
              transactions: d.transactions,
              goals: d.goals,
              loans: d.loans,
              dbProfileId: d.profileId,
            });
          }
        });
      } else if (!isGuest) {
        setIsAuthenticated(false);
        setDbProfileId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  const setCurrency = (curr: "USD" | "INR") => setCurrencyState(curr);
  const setUserType = (type: "Student" | "Professional") => setUserTypeState(type);
  const setPreferredLanguage = (lang: "en" | "hi" | "mr") => setPreferredLanguageState(lang);

  const login = async (
    email: string,
    password: string,
    selectedUserType: "Student" | "Professional",
    selectedCurrency: "USD" | "INR",
    monthlyAllowance?: number
  ): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const inputHash = await hashPassword(trimmedPassword);

    setUserTypeState(selectedUserType);
    setCurrencyState(selectedCurrency);

    // Explicit demo account credentials route to guest mode
    if (normalizedEmail === "rahul@budgetmitra.in" && inputHash === DEMO_PASSWORD_HASH) {
      loginAsGuest("Student", "INR", 15000);
      return { success: true };
    }

    if (isSupabaseConfigured()) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: trimmedPassword,
        });

        if (authData?.user && !authError) {
          setIsAuthenticated(true);
          setIsGuest(false);
          localStorage.setItem("bm_current_user_email", normalizedEmail);

          const remoteData = await loadUserSupabaseData(normalizedEmail);
          if (remoteData) {
            setDbProfileId(remoteData.profileId);
            onAuthSuccess({
              profile: remoteData.profile,
              budgets: remoteData.budgets,
              transactions: remoteData.transactions,
              goals: remoteData.goals,
              loans: remoteData.loans,
              dbProfileId: remoteData.profileId,
            });
            saveUserAccountToRegistry({
              email: normalizedEmail,
              password: inputHash,
              name: remoteData.profile.name,
              userType: selectedUserType,
              currency: selectedCurrency,
              profile: remoteData.profile,
              budgets: remoteData.budgets,
              transactions: remoteData.transactions,
              goals: remoteData.goals,
              loans: remoteData.loans,
              dbProfileId: remoteData.profileId,
              createdAt: new Date().toISOString(),
            });
          }
          return { success: true };
        }
        console.warn("[Auth] Supabase auth did not succeed, checking offline cache:", authError?.message);
      } catch (networkErr) {
        console.warn("[Auth] Supabase network error, checking offline cache:", networkErr);
      }
    }

    // Offline / Local accounts fallback
    const existingAccount = findUserAccountInRegistry(normalizedEmail);
    if (existingAccount) {
      if (isPlaintextPassword(existingAccount.password)) {
        const legacyHash = await hashPassword(existingAccount.password);
        if (legacyHash === inputHash) {
          existingAccount.password = inputHash;
          saveUserAccountToRegistry(existingAccount);
        } else {
          return { success: false, error: "Incorrect password. Please verify your password and try again." };
        }
      }

      if (existingAccount.password === inputHash) {
        setIsAuthenticated(true);
        setIsGuest(false);
        localStorage.setItem("bm_current_user_email", normalizedEmail);
        if (existingAccount.dbProfileId) setDbProfileId(existingAccount.dbProfileId);

        const loadedProfile: StudentProfile = {
          ...existingAccount.profile,
          monthlyAllowance:
            monthlyAllowance || existingAccount.profile.monthlyAllowance || (selectedCurrency === "INR" ? 12000 : 500),
          hasCompletedOnboarding:
            existingAccount.profile.hasCompletedOnboarding !== undefined
              ? existingAccount.profile.hasCompletedOnboarding
              : true,
        };

        // Strictly load this user's data; NEVER fall back to seed data
        onAuthSuccess({
          profile: loadedProfile,
          budgets: existingAccount.budgets || {},
          transactions: existingAccount.transactions || [],
          goals: existingAccount.goals || [],
          loans: existingAccount.loans || [],
          dbProfileId: existingAccount.dbProfileId,
        });

        if (existingAccount.currency) setCurrencyState(existingAccount.currency);
        if (existingAccount.userType) setUserTypeState(existingAccount.userType);
        return { success: true };
      } else {
        return { success: false, error: "Incorrect password. Please verify your password and try again." };
      }
    }

    return {
      success: false,
      error: "No account found with this email. Please check your email or Sign Up first.",
    };
  };

  const registerUser = async (
    email: string,
    password: string,
    name: string,
    selectedUserType: "Student" | "Professional",
    selectedCurrency: "USD" | "INR",
    monthlyAllowance?: number,
    additionalDetails?: Partial<StudentProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const cleanName = name.trim();

    setUserTypeState(selectedUserType);
    setCurrencyState(selectedCurrency);

    const allowanceValue = monthlyAllowance || (selectedCurrency === "INR" ? 12000 : 500);

    // Initial user profile: fresh account starts with 0 transactions and onboarding flag
    const newProfile: StudentProfile = {
      name: cleanName,
      major: additionalDetails?.major || additionalDetails?.course || "B.Tech Computer Science",
      gpa: 8.5,
      academicYear: `${additionalDetails?.year || 1}st Year`,
      incomeTier: additionalDetails?.income_bracket || "1-3L",
      firstGen: false,
      interests: ["Smart Budgeting", "Academics", "Student Life"],
      monthlyAllowance: allowanceValue,
      course: additionalDetails?.course || "B.Tech",
      year: additionalDetails?.year || 1,
      state: additionalDetails?.state || "Maharashtra",
      income_bracket: additionalDetails?.income_bracket || "1-3L",
      category: additionalDetails?.category || "Gen",
      preferred_language: (additionalDetails?.preferred_language as "en" | "hi" | "mr") || preferredLanguage || "en",
      hasCompletedOnboarding: false, // Triggers interactive onboarding
    };

    // Brand new user: ZERO fake transactions, ZERO fake goals, ZERO fake loans
    const initialBudgets: Record<string, number> = {};
    const initialTransactions: Transaction[] = [];
    const initialGoals: SavingsGoal[] = [];
    const initialLoans: StudentLoan[] = [];

    let registeredProfileId: string | null = null;

    if (isSupabaseConfigured()) {
      try {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: trimmedPassword,
          options: {
            data: {
              name: cleanName,
              userType: selectedUserType,
            },
          },
        });

        if (!error && signUpData?.user) {
          registeredProfileId = signUpData.user.id;
          setDbProfileId(registeredProfileId);

          // Insert clean profile row into Supabase
          await supabase.from("profiles").upsert({
            id: registeredProfileId,
            email: normalizedEmail,
            name: cleanName,
            monthly_allowance: allowanceValue,
            course: newProfile.course,
            year: newProfile.year,
            state: newProfile.state,
            category: newProfile.category,
            income_bracket: newProfile.income_bracket,
            has_completed_onboarding: false,
          });
        }
      } catch (err: any) {
        console.warn("Supabase registration warning:", err);
      }
    }

    const passwordHash = await hashPassword(trimmedPassword);
    const userAccount: UserAccount = {
      email: normalizedEmail,
      password: passwordHash,
      name: cleanName,
      userType: selectedUserType,
      currency: selectedCurrency,
      profile: newProfile,
      budgets: initialBudgets,
      transactions: initialTransactions,
      goals: initialGoals,
      loans: initialLoans,
      dbProfileId: registeredProfileId,
      createdAt: new Date().toISOString(),
    };

    saveUserAccountToRegistry(userAccount);
    localStorage.setItem("bm_current_user_email", normalizedEmail);
    setIsAuthenticated(true);
    setIsGuest(false);

    onAuthSuccess({
      profile: newProfile,
      budgets: initialBudgets,
      transactions: initialTransactions,
      goals: initialGoals,
      loans: initialLoans,
      dbProfileId: registeredProfileId,
    });

    return { success: true };
  };

  const loginAsGuest = (
    selectedUserType: "Student" | "Professional",
    selectedCurrency: "USD" | "INR",
    monthlyAllowance?: number
  ) => {
    setUserTypeState(selectedUserType);
    setCurrencyState(selectedCurrency);
    setIsAuthenticated(true);
    setIsGuest(true);
    localStorage.setItem("bm_current_user_email", "guest@budgetmitra.demo");

    const allowance = monthlyAllowance || (selectedCurrency === "INR" ? 15000 : 650);

    const guestProfile: StudentProfile = {
      name: "Demo Student (Rahul)",
      major: "B.Tech Computer Science",
      gpa: 8.8,
      academicYear: "3rd Year",
      incomeTier: "1-3L",
      firstGen: true,
      interests: ["Campus Life", "Smart Budgeting"],
      monthlyAllowance: allowance,
      course: "B.Tech",
      year: 3,
      state: "Maharashtra",
      income_bracket: "1-3L",
      category: "OBC",
      preferred_language: "en",
      hasCompletedOnboarding: true,
    };

    const guestBudgets: Record<string, number> =
      selectedCurrency === "INR"
        ? { ...DEFAULT_BUDGETS_INR_STUDENT }
        : { ...DEFAULT_BUDGETS_USD_STUDENT };

    const guestGoals =
      selectedCurrency === "INR"
        ? [...DEFAULT_GOALS_INR_STUDENT]
        : [...DEFAULT_GOALS_USD_STUDENT];

    const guestLoans =
      selectedCurrency === "INR"
        ? [...DEFAULT_LOANS_INR_STUDENT]
        : [...DEFAULT_LOANS_USD_STUDENT];

    const guestTransactions =
      selectedCurrency === "INR"
        ? [...SEED_TRANSACTIONS_INR_STUDENT]
        : [...SEED_TRANSACTIONS_USD_STUDENT];

    // Seed guest gamification
    saveUserSlice("guest", "xp", GUEST_GAMIFICATION_SEED.xp);
    saveUserSlice("guest", "level", GUEST_GAMIFICATION_SEED.level);
    saveUserSlice("guest", "streak", GUEST_GAMIFICATION_SEED.streak);
    saveUserSlice("guest", "badges", GUEST_GAMIFICATION_SEED.badges);

    onAuthSuccess({
      profile: guestProfile,
      budgets: guestBudgets,
      transactions: guestTransactions,
      goals: guestGoals,
      loans: guestLoans,
      dbProfileId: null, // Guests never write to Supabase
    });
  };

  const logout = async () => {
    // If guest, clear guest storage scope completely
    if (isGuest) {
      clearUserScope("guest");
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }

    setIsAuthenticated(false);
    setIsGuest(false);
    setDbProfileId(null);

    localStorage.removeItem("bm_authenticated");
    localStorage.removeItem("bm_is_guest");
    localStorage.removeItem("bm_current_user_email");

    if (onLogoutClear) {
      onLogoutClear();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isGuest,
        userType,
        currency,
        preferredLanguage,
        supabaseStatus,
        dbProfileId,
        setCurrency,
        setUserType,
        setPreferredLanguage,
        onAuthSuccess,
        login,
        registerUser,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
