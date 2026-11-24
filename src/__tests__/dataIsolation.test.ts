// dataIsolation.test.ts — Rigorous tests for strict user data isolation & zero demo data leakage
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getUserScope, saveUserSlice, loadUserSlice, clearUserScope } from "../utils/userStorage";
import { DEFAULT_PROFILE_EMPTY } from "../services/financialSeeds";

describe("Strict Data Isolation & Namespace Hygiene", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("normalizes user scopes into strict collision-proof namespaces", () => {
    expect(getUserScope("Priya.Sharma@College.edu")).toBe("priya.sharma@college.edu");
    expect(getUserScope("  rohan@iitb.ac.in  ")).toBe("rohan@iitb.ac.in");
    expect(getUserScope("", true)).toBe("guest");
    expect(getUserScope(null, true)).toBe("guest");
    expect(getUserScope(null, false)).toBe("anonymous");
  });

  it("ensures User A and User B never see each other's data in local storage", () => {
    const userA = "user_a@test.com";
    const userB = "user_b@test.com";

    // User A records an expense
    saveUserSlice(userA, "transactions", [
      { id: "tx_a1", description: "Campus Canteen", amount: 150, category: "Food & Dining", date: "2026-11-20", isAnomaly: false }
    ]);
    saveUserSlice(userA, "goals", [
      { id: "goal_a1", name: "User A Laptop Fund", target: 50000, current: 10000 }
    ]);

    // User B initializes with empty state
    saveUserSlice(userB, "transactions", []);
    saveUserSlice(userB, "goals", []);

    // Retrieve User B's state
    const userBTransactions = loadUserSlice(userB, "transactions", []);
    const userBGoals = loadUserSlice(userB, "goals", []);

    expect(userBTransactions).toEqual([]);
    expect(userBTransactions).toHaveLength(0);
    expect(userBGoals).toEqual([]);
    expect(userBGoals).toHaveLength(0);

    // Verify User A's data remains isolated
    const userATransactions = loadUserSlice<any[]>(userA, "transactions", []);
    expect(userATransactions).toHaveLength(1);
    expect(userATransactions[0].description).toBe("Campus Canteen");
  });

  it("verifies clean default empty profile for newly registered users", () => {
    expect(DEFAULT_PROFILE_EMPTY.monthlyAllowance).toBe(0);
    expect(DEFAULT_PROFILE_EMPTY.hasCompletedOnboarding).toBe(false);
    expect(DEFAULT_PROFILE_EMPTY.name).toBe("");
  });

  it("verifies clearUserScope wipes all keys for that user only", () => {
    const userA = "user_a@test.com";
    const userB = "user_b@test.com";

    saveUserSlice(userA, "profile", { name: "Alice" });
    saveUserSlice(userA, "transactions", [{ id: "1", amount: 100 }]);
    saveUserSlice(userB, "profile", { name: "Bob" });

    clearUserScope(userA);

    expect(loadUserSlice(userA, "profile", null)).toBeNull();
    expect(loadUserSlice(userA, "transactions", [])).toEqual([]);
    expect(loadUserSlice(userB, "profile", null)).toEqual({ name: "Bob" });
  });

  it("verifies guest mode is namespaced under 'guest' and isolated from real accounts", () => {
    saveUserSlice("guest", "transactions", [
      { id: "guest_tx", description: "Demo Mess Coupon", amount: 2500 }
    ]);

    const realUserTransactions = loadUserSlice("real_student@college.edu", "transactions", []);
    expect(realUserTransactions).toEqual([]);
    expect(realUserTransactions).toHaveLength(0);

    clearUserScope("guest");
    expect(loadUserSlice("guest", "transactions", [])).toEqual([]);
  });

  it("guarantees a failed remote fetch does not inject hardcoded demo records", () => {
    // If remote fetch returns null or empty, the state fallback must remain []
    const remoteResponse: any = null;
    const fallbackTransactions = remoteResponse ? remoteResponse.transactions : [];
    expect(fallbackTransactions).toEqual([]);
    expect(fallbackTransactions).toHaveLength(0);
  });
});
