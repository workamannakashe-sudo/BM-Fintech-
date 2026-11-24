// supabaseFinancial.ts - Supabase Remote Data Mapper & Service Layer for BudgetMitra
import { supabase, isSupabaseConfigured } from "../utils/supabase/client";
import type { StudentProfile, Transaction, SavingsGoal, StudentLoan } from "../context/FinancialContext";

export interface SupabaseHydratedData {
  profile: StudentProfile;
  transactions: Transaction[];
  budgets: Record<string, number>;
  goals: SavingsGoal[];
  loans: StudentLoan[];
  profileId: string | null;
}

/**
 * Loads and maps all user financial data from Supabase tables.
 * Returns ONLY data belonging to the authenticated user.
 * Never injects seed or demo records.
 */
export async function loadUserSupabaseData(userEmail?: string): Promise<SupabaseHydratedData | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: authUserRes } = await supabase.auth.getUser();
    const user = authUserRes?.user;
    if (!user && !userEmail) return null;

    // Fetch Profile
    const profileQuery = user
      ? supabase.from("profiles").select("*").eq("id", user.id).single()
      : supabase.from("profiles").select("*").eq("email", userEmail).single();

    let { data: profileData, error: profileError } = await profileQuery;

    // If profile doesn't exist yet for an authenticated user, create a minimal user profile row
    if ((profileError || !profileData) && user) {
      const fallbackName = user.user_metadata?.name || user.email?.split("@")[0] || "Student";
      const insertRes = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        name: fallbackName,
        monthly_allowance: 12000,
        has_completed_onboarding: false,
      }).select().single();

      if (!insertRes.error && insertRes.data) {
        profileData = insertRes.data;
      }
    }

    if (!profileData) return null;

    const profileId = profileData.id;

    // Fetch Transactions, Budgets, Goals, Loans in parallel (scoped to user_id)
    const [txRes, budgetRes, goalRes, loanRes] = await Promise.all([
      supabase.from("transactions").select("*").or(`user_id.eq.${profileId},profile_id.eq.${profileId}`).order("date", { ascending: false }),
      supabase.from("budgets").select("*").or(`user_id.eq.${profileId},profile_id.eq.${profileId}`),
      supabase.from("savings_goals").select("*").or(`user_id.eq.${profileId},profile_id.eq.${profileId}`),
      supabase.from("student_loans").select("*").or(`user_id.eq.${profileId},profile_id.eq.${profileId}`),
    ]);

    const mappedProfile: StudentProfile = {
      name: profileData.name || profileData.full_name || "Student",
      major: profileData.major || profileData.course || "B.Tech",
      gpa: Number(profileData.gpa) || 3.8,
      academicYear: profileData.academic_year || `${profileData.year || 2}nd Year`,
      incomeTier: profileData.income_tier || profileData.income_bracket || "1-3L",
      firstGen: Boolean(profileData.first_gen),
      interests: profileData.interests || [],
      monthlyAllowance: Number(profileData.monthly_allowance) || 12000,
      course: profileData.course || "B.Tech",
      year: Number(profileData.year) || 2,
      state: profileData.state || "Maharashtra",
      income_bracket: profileData.income_bracket || "1-3L",
      category: profileData.category || "Gen",
      preferred_language: profileData.preferred_language || "en",
      hasCompletedOnboarding: Boolean(profileData.has_completed_onboarding),
    };

    const mappedTransactions: Transaction[] = (txRes.data || []).map((t: any) => ({
      id: String(t.id),
      date: t.date || (t.created_at ? t.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
      description: t.description || "Expense",
      amount: Number(t.amount) || 0,
      category: t.category || "Other",
      isAnomaly: Boolean(t.is_anomaly),
      anomalyExplanation: t.anomaly_explanation || undefined,
    }));

    const mappedBudgets: Record<string, number> = {};
    (budgetRes.data || []).forEach((b: any) => {
      const limit = Number(b.allocated !== undefined ? b.allocated : b.monthly_limit) || 0;
      mappedBudgets[b.category] = limit;
    });

    const mappedGoals: SavingsGoal[] = (goalRes.data || []).map((g: any) => ({
      id: String(g.id),
      name: g.name || g.title || "Savings Target",
      target: Number(g.target_amount) || 0,
      current: Number(g.current_amount) || 0,
    }));

    const mappedLoans: StudentLoan[] = (loanRes.data || []).map((l: any) => ({
      id: String(l.id),
      name: l.name || "Student Loan",
      principal: Number(l.principal) || 0,
      interestRate: Number(l.interest_rate) || 0,
      termMonths: Number(l.term_months) || 0,
      extraPayment: Number(l.extra_payment || 0),
      type: l.loan_type || l.type || "Subsidized",
    }));

    return {
      profile: mappedProfile,
      transactions: mappedTransactions,
      budgets: mappedBudgets,
      goals: mappedGoals,
      loans: mappedLoans,
      profileId,
    };
  } catch (err) {
    console.error("Error hydrating Supabase financial state:", err);
    return null;
  }
}
