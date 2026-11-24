// src/__tests__/anomalyForecast.test.ts - Unit Tests for Statistical Anomaly & Predictive Month-End Forecaster
import { describe, it, expect } from "vitest";
import {
  calculateMedian,
  calculateMAD,
  detectExpenseAnomaly,
  forecastEndOfMonth,
} from "../services/anomalyForecast";

describe("Median & MAD Statistical Basics", () => {
  it("calculates median for odd and even arrays", () => {
    expect(calculateMedian([10, 20, 30])).toBe(20);
    expect(calculateMedian([10, 20, 30, 40])).toBe(25);
    expect(calculateMedian([])).toBe(0);
  });

  it("calculates Median Absolute Deviation accurately", () => {
    // Array: [1, 2, 3, 4, 5, 6, 7] -> median = 4
    // Deviations: [3, 2, 1, 0, 1, 2, 3] -> sorted: [0, 1, 1, 2, 2, 3, 3] -> median = 2
    expect(calculateMAD([1, 2, 3, 4, 5, 6, 7], 4)).toBe(2);
  });
});

describe("Expense Anomaly Detection (Modified Z-Score)", () => {
  const normalFoodHistory = [
    { amount: 150, category: "Food & Dining" },
    { amount: 180, category: "Food & Dining" },
    { amount: 200, category: "Food & Dining" },
    { amount: 190, category: "Food & Dining" },
    { amount: 220, category: "Food & Dining" },
    { amount: 210, category: "Food & Dining" },
  ];

  it("flags a massive spike as an anomaly with clear multiplier reason", () => {
    const result = detectExpenseAnomaly(1500, "Food & Dining", normalFoodHistory, "INR");
    expect(result.isAnomaly).toBe(true);
    expect(result.score).toBeGreaterThan(2.5);
    expect(result.reason).toContain("Unusual spike");
    expect(result.reason).toContain("₹1,500");
    expect(result.multiplier).toBeGreaterThanOrEqual(7);
  });

  it("passes normal spending within regular variance", () => {
    const result = detectExpenseAnomaly(215, "Food & Dining", normalFoodHistory, "INR");
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBeLessThan(2.5);
  });

  it("gracefully handles sparse category baseline without false positives", () => {
    const sparse = [{ amount: 500, category: "Transport" }];
    const result = detectExpenseAnomaly(2000, "Transport", sparse, "INR");
    expect(result.isAnomaly).toBe(false);
    expect(result.reason).toContain("Insufficient category baseline");
  });
});

describe("Predictive End-of-Month Spend Forecaster", () => {
  it("projects surplus when spending is disciplined", () => {
    // Simulation: Day 10 of a 30-day month. Spent 3,000 out of 15,000 allowance.
    // Burn rate = 300/day. Remaining 20 days * 300 = 6,000. Projected = 9,000 total.
    const fakeCurrentDate = new Date(2026, 3, 10); // April 10, 2026 (30-day month)
    const txs = [
      { amount: 1500, date: "2026-04-03" },
      { amount: 1500, date: "2026-04-08" },
    ];

    const forecast = forecastEndOfMonth(15000, txs, fakeCurrentDate, "INR");
    expect(forecast.currentSpend).toBe(3000);
    expect(forecast.dailyBurnRate).toBe(300);
    expect(forecast.projectedTotalSpend).toBe(9000);
    expect(forecast.projectedSavings).toBe(6000);
    expect(forecast.runsOutOfMoney).toBe(false);
    expect(forecast.trajectory).toBe("healthy");
    expect(forecast.recommendation).toContain("on pace to save");
  });

  it("predicts exact run-out day when burn rate will exhaust allowance prematurely", () => {
    // Simulation: Day 10 of a 30-day month. Spent 8,000 out of 10,000 allowance!
    // Burn rate = 800/day. 10,000 / 800 = 12.5 -> runs out around Day 12!
    const fakeCurrentDate = new Date(2026, 3, 10); // April 10, 2026
    const txs = [
      { amount: 4000, date: "2026-04-02" },
      { amount: 4000, date: "2026-04-07" },
    ];

    const forecast = forecastEndOfMonth(10000, txs, fakeCurrentDate, "INR");
    expect(forecast.currentSpend).toBe(8000);
    expect(forecast.dailyBurnRate).toBe(800);
    expect(forecast.runsOutOfMoney).toBe(true);
    expect(forecast.trajectory).toBe("critical");
    expect(forecast.runOutDay).toBe(12);
    expect(forecast.recommendation).toContain("allowance will run out");
    expect(forecast.recommendation).toContain("Apr 12");
  });

  it("handles 0 expenses and 0 allowance safely", () => {
    const fakeCurrentDate = new Date(2026, 3, 5);
    const forecast = forecastEndOfMonth(0, [], fakeCurrentDate, "INR");
    expect(forecast.currentSpend).toBe(0);
    expect(forecast.projectedTotalSpend).toBe(0);
    expect(forecast.runsOutOfMoney).toBe(false);
  });
});
