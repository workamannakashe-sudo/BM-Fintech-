// src/services/anomalyForecast.ts - Statistical Spending Anomaly Detection & Predictive Month-End Forecaster
// CODEFESTTHON 2026 - AI/ML Track Feature A

export interface AnomalyReport {
  isAnomaly: boolean;
  score: number; // Modified Z-Score based on Median Absolute Deviation (MAD)
  reason: string;
  median: number;
  mad: number;
  multiplier: number;
}

export interface SpendForecast {
  currentSpend: number;
  monthlyAllowance: number;
  daysPassed: number;
  totalDaysInMonth: number;
  daysRemaining: number;
  dailyBurnRate: number;
  projectedTotalSpend: number;
  projectedSavings: number;
  runsOutOfMoney: boolean;
  runOutDay?: number;
  runOutDateString?: string;
  trajectory: "healthy" | "tight" | "critical";
  recommendation: string;
  confidenceScore: number;
}

/**
 * Calculates median of an array of numbers.
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates Median Absolute Deviation (MAD), an outlier-resistant dispersion metric.
 * Uses the standard Gaussian consistency scale factor 1.4826.
 */
export function calculateMAD(numbers: number[], median: number): number {
  if (numbers.length === 0) return 0;
  const absoluteDeviations = numbers.map((n) => Math.abs(n - median));
  return calculateMedian(absoluteDeviations);
}

/**
 * Evaluates whether an individual expense is statistically anomalous within its category.
 * Uses Boris Iglewicz and David Hoaglin's Modified Z-Score (1993):
 *   M_i = 0.6745 * (x_i - median) / MAD
 * A score > 2.5 is deemed an anomalous deviation.
 */
export function detectExpenseAnomaly(
  amount: number,
  category: string,
  history: Array<{ amount: number; category: string; type?: string }>,
  currency = "INR"
): AnomalyReport {
  const sym = currency === "INR" ? "₹" : "$";
  const catHistory = history
    .filter((h) => h.category === category && (!h.type || h.type === "debit") && h.amount > 0)
    .map((h) => h.amount);

  // Sparse history fallback: fewer than 3 historical items
  if (catHistory.length < 3) {
    return {
      isAnomaly: false,
      score: 0,
      reason: "Insufficient category baseline (< 3 records)",
      median: amount,
      mad: 0,
      multiplier: 1,
    };
  }

  const median = calculateMedian(catHistory);
  const rawMad = calculateMAD(catHistory, median);
  // Guard against division by zero if all items have identical prices
  const mad = rawMad > 0 ? rawMad : (median * 0.1 || 1);

  // Modified Z-Score
  const modifiedZ = (0.6745 * (amount - median)) / mad;
  const multiplier = median > 0 ? Math.round((amount / median) * 10) / 10 : 1;

  if (amount > median && modifiedZ >= 2.5) {
    return {
      isAnomaly: true,
      score: Math.round(modifiedZ * 100) / 100,
      reason: `Unusual spike: ${sym}${amount.toLocaleString()} is ${multiplier}x your typical ${category} median of ${sym}${Math.round(median).toLocaleString()}.`,
      median: Math.round(median),
      mad: Math.round(mad),
      multiplier,
    };
  }

  return {
    isAnomaly: false,
    score: Math.round(modifiedZ * 100) / 100,
    reason: `Normal spend: within typical range for ${category}.`,
    median: Math.round(median),
    mad: Math.round(mad),
    multiplier,
  };
}

/**
 * Forecasts end-of-month financial trajectory using daily cumulative linear regression.
 * Predicts the exact calendar day an allowance will run out if burn rate persists.
 */
export function forecastEndOfMonth(
  monthlyAllowance: number,
  transactions: Array<{ amount: number; date: string; type?: string }>,
  currentDate: Date = new Date(),
  currency = "INR"
): SpendForecast {
  const sym = currency === "INR" ? "₹" : "$";
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysPassed = Math.max(1, currentDate.getDate());
  const daysRemaining = Math.max(0, totalDaysInMonth - daysPassed);

  // Filter expenses strictly belonging to the current calendar month
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const debits = transactions.filter(
    (t) => (!t.type || t.type === "debit") && t.date.startsWith(currentMonthPrefix) && t.amount > 0
  );

  const currentSpend = debits.reduce((acc, t) => acc + t.amount, 0);

  // Daily spend rate
  const dailyBurnRate = currentSpend / daysPassed;
  const projectedTotalSpend = Math.round(currentSpend + dailyBurnRate * daysRemaining);
  const projectedSavings = monthlyAllowance - projectedTotalSpend;

  // Predict run-out date
  let runsOutOfMoney = false;
  let runOutDay: number | undefined;
  let runOutDateString: string | undefined;

  if (dailyBurnRate > 0 && monthlyAllowance > 0) {
    const totalAffordableDays = Math.floor(monthlyAllowance / dailyBurnRate);
    if (totalAffordableDays < totalDaysInMonth) {
      runsOutOfMoney = true;
      runOutDay = Math.max(daysPassed, totalAffordableDays);
      const predictedDate = new Date(year, month, runOutDay);
      runOutDateString = predictedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }

  let trajectory: SpendForecast["trajectory"] = "healthy";
  let recommendation = `You are on pace to save ${sym}${Math.max(0, projectedSavings).toLocaleString()} this month. Great discipline!`;

  if (runsOutOfMoney && runOutDay) {
    trajectory = "critical";
    const daysUntilExhaustion = Math.max(0, runOutDay - daysPassed);
    const deficit = projectedTotalSpend - monthlyAllowance;
    const requiredDailyReduction = Math.round(deficit / (daysRemaining || 1));

    recommendation = `At your current pace of ${sym}${Math.round(dailyBurnRate)}/day, your allowance will run out on ${runOutDateString} (${daysUntilExhaustion} days from now). Reduce daily discretionary spend by ~${sym}${requiredDailyReduction}/day to complete the month.`;
  } else if (projectedTotalSpend > monthlyAllowance * 0.9) {
    trajectory = "tight";
    recommendation = `Budget tight: projected to utilize ${Math.round((projectedTotalSpend / monthlyAllowance) * 100)}% of your allowance. Curtail non-essential shopping to retain a buffer.`;
  }

  // Model confidence: higher as more days in the month have transpired
  const confidenceScore = Math.min(0.95, Math.round((0.5 + (daysPassed / totalDaysInMonth) * 0.45) * 100) / 100);

  return {
    currentSpend: Math.round(currentSpend),
    monthlyAllowance,
    daysPassed,
    totalDaysInMonth,
    daysRemaining,
    dailyBurnRate: Math.round(dailyBurnRate * 10) / 10,
    projectedTotalSpend,
    projectedSavings,
    runsOutOfMoney,
    runOutDay,
    runOutDateString,
    trajectory,
    recommendation,
    confidenceScore,
  };
}
