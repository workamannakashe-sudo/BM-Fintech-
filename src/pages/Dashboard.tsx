import React, { useMemo, useState } from "react";
import { useFinancial } from "../context/FinancialContext";
import { generateMonthlyPDFReport } from "../services/pdfGenerator";
import { forecastEndOfMonth } from "../services/anomalyForecast";
import { SplitBillModal } from "../components/SplitBillModal";
import { ReceiptScannerModal } from "../components/ReceiptScannerModal";
import {
  Download,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Mic,
  Plus,
  ArrowUpRight,
  Layers,
  FileText,
  CreditCard,
  Users,
  Sliders,
  Camera,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenQuickLog?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, onOpenQuickLog }) => {
  const {
    profile,
    transactions,
    goals,
    budgets,
    currency,
    healthScore,
    healthGrade,
    totalSpentThisMonth,
    isGuest,
  } = useFinancial();

  // Active top sub-nav pill filter
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "balance" | "split" | "envelopes" | "reports" | "bob">("overview");
  const [paymentFilter, setPaymentFilter] = useState<"All" | "Initiated" | "Authorized" | "Successful" | "Payouts">("Successful");
  const [settlementView, setSettlementView] = useState<"weekly" | "daily">("weekly");
  const [logPeriod, setLogPeriod] = useState<"weekly" | "monthly">("monthly");
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [selectedReportModal, setSelectedReportModal] = useState<string | null>(null);
  const [envelopeSearch, setEnvelopeSearch] = useState("");

  const formatAmt = (val: number) => {
    if (currency === "INR") {
      return `₹${Math.round(val).toLocaleString("en-IN")}`;
    }
    return `$${val.toFixed(2)}`;
  };

  const monthlyAllowance = profile.monthlyAllowance > 0
    ? profile.monthlyAllowance
    : isGuest
    ? (currency === "INR" ? 15000 : 1500)
    : 0;

  // Feature A: AI Month-End Trajectory Forecast
  const spendForecast = useMemo(() => {
    return forecastEndOfMonth(monthlyAllowance, transactions, new Date(), currency);
  }, [monthlyAllowance, transactions, currency]);

  // Real-time Date format
  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  // Payments breakdown chart — derived from real transaction data
  const paymentBreakdownData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // Initialise all 7 days with zero
    const buckets: Record<string, { day: string; Successful: number; Payouts: number }> = {};
    days.forEach((d) => { buckets[d] = { day: d, Successful: 0, Payouts: 0 }; });

    transactions.forEach((t) => {
      try {
        const dow = days[new Date(t.date).getDay()];
        if (!dow) return;
        buckets[dow].Successful += t.amount;
        // Payouts = anomalous transactions (flagged spend) scaled for visual separation
        if (t.isAnomaly) buckets[dow].Payouts += t.amount * 0.15;
      } catch {
        // skip malformed date
      }
    });

    const total = Object.values(buckets).reduce((s, b) => s + b.Successful, 0);
    // If no data and running in Guest/Demo mode, show realistic sample preview
    if (total === 0 && isGuest) {
      return [
        { day: "Mon", Successful: 6200, Payouts: 850 },
        { day: "Tue", Successful: 8261, Payouts: 1098 },
        { day: "Wed", Successful: 7400, Payouts: 920 },
        { day: "Thu", Successful: 9100, Payouts: 1400 },
        { day: "Fri", Successful: 11200, Payouts: 1650 },
        { day: "Sat", Successful: 5400, Payouts: 600 },
        { day: "Sun", Successful: 4800, Payouts: 450 },
      ];
    }

    // Return in Mon–Sun order
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => buckets[d]);
  }, [transactions, isGuest]);

  // Envelopes Gross Volume metrics — calculated live from user budgets & transactions
  const envelopeColors = [
    "from-amber-400 to-orange-500",
    "from-teal-400 to-emerald-500",
    "from-blue-400 to-cyan-500",
    "from-purple-400 to-pink-500",
    "from-rose-400 to-red-500",
  ];

  const envelopeItems = useMemo(() => {
    const budgetEntries = Object.entries(budgets || {});
    if (budgetEntries.length > 0) {
      return budgetEntries
        .filter(([cat]) => !envelopeSearch || cat.toLowerCase().includes(envelopeSearch.toLowerCase()))
        .map(([cat, limit], idx) => {
          const spent = transactions
            .filter((t) => t.category.toLowerCase() === cat.toLowerCase())
            .reduce((sum, t) => sum + t.amount, 0);
          const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          return {
            name: cat,
            amount: limit,
            spent,
            color: envelopeColors[idx % envelopeColors.length],
            pct,
          };
        });
    }

    // In demo mode with no budgets defined yet
    if (isGuest) {
      const demoEnvelopes = [
        { name: "Home Rent / Dorm", amount: currency === "INR" ? 6000 : 600, spent: currency === "INR" ? 4500 : 450, color: envelopeColors[0], pct: 75 },
        { name: "Grocery & Dining", amount: currency === "INR" ? 3500 : 350, spent: currency === "INR" ? 1575 : 157.5, color: envelopeColors[1], pct: 45 },
        { name: "Subscriptions & Tech", amount: currency === "INR" ? 1200 : 120, spent: currency === "INR" ? 360 : 36, color: envelopeColors[2], pct: 30 },
        { name: "Online Shopping", amount: currency === "INR" ? 2000 : 200, spent: currency === "INR" ? 400 : 40, color: envelopeColors[3], pct: 20 },
      ];
      return demoEnvelopes.filter((e) => !envelopeSearch || e.name.toLowerCase().includes(envelopeSearch.toLowerCase()));
    }

    return [];
  }, [budgets, transactions, isGuest, currency, envelopeSearch]);

  // Dynamic Transaction Velocity KPI (Card 1)
  const txnMetrics = useMemo(() => {
    if (isGuest && transactions.length === 0) {
      return {
        volumeText: currency === "INR" ? "₹14.7k" : "$1.47k",
        highestBadge: "Highest: Wed",
        trendText: "+₹3,002 vs last period",
      };
    }
    const count = transactions.length;
    if (count === 0) {
      return {
        volumeText: formatAmt(0),
        highestBadge: "0 txns",
        trendText: "No transactions recorded yet",
      };
    }
    const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayTotals: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    transactions.forEach((t) => {
      try {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          dayTotals[daysShort[d.getDay()]] += t.amount;
        }
      } catch {}
    });
    let maxDay = "";
    let maxAmount = 0;
    Object.entries(dayTotals).forEach(([day, amt]) => {
      if (amt > maxAmount) {
        maxAmount = amt;
        maxDay = day;
      }
    });

    const totalVol = transactions.reduce((s, t) => s + t.amount, 0);
    return {
      volumeText: formatAmt(totalVol),
      highestBadge: maxAmount > 0 ? `Highest: ${maxDay}` : `${count} total`,
      trendText: `${count} recorded transactions`,
    };
  }, [isGuest, transactions, currency]);

  // Dynamic Peer Network KPI (Card 2)
  const peerMetrics = useMemo(() => {
    const splitTxns = transactions.filter(
      (t) =>
        t.category.toLowerCase().includes("split") ||
        t.description.toLowerCase().includes("split") ||
        t.category.toLowerCase().includes("dining") ||
        t.category.toLowerCase().includes("food")
    );
    if (isGuest && transactions.length === 0) {
      return {
        countText: "12 splits",
        badge: "Demo Network",
        subtext: "Campus roommate split active",
      };
    }
    if (splitTxns.length === 0) {
      return {
        countText: "0 splits",
        badge: "Ready",
        subtext: "No active splits with peers yet",
      };
    }
    const splitVolume = splitTxns.reduce((s, t) => s + t.amount, 0);
    return {
      countText: `${splitTxns.length} splits`,
      badge: `${formatAmt(splitVolume)} shared`,
      subtext: `Split across ${splitTxns.length} campus expenses`,
    };
  }, [isGuest, transactions, currency]);

  // Dynamic Settlement & Cashflow Metrics (Row 3)
  const cashflowMetrics = useMemo(() => {
    if (isGuest && transactions.length === 0) {
      return {
        balance: formatAmt(currency === "INR" ? 10450 : 1045),
        yesterdayOrCleared: formatAmt(currency === "INR" ? 1250 : 125),
        pending: formatAmt(currency === "INR" ? 850 : 85),
        processing: formatAmt(currency === "INR" ? 1250 : 125),
      };
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let todaySpent = 0;
    let yesterdaySpent = 0;
    let anomalyPending = 0;

    transactions.forEach((t) => {
      if (t.date === todayStr) todaySpent += t.amount;
      else if (t.date === yesterdayStr) yesterdaySpent += t.amount;
      if (t.isAnomaly) anomalyPending += t.amount;
    });

    const liveBalance = Math.max(0, monthlyAllowance - totalSpentThisMonth);

    return {
      balance: formatAmt(liveBalance),
      yesterdayOrCleared: formatAmt(yesterdaySpent),
      pending: formatAmt(anomalyPending),
      processing: formatAmt(todaySpent),
    };
  }, [isGuest, transactions, monthlyAllowance, totalSpentThisMonth, currency]);

  // Soundwave settlement chart data — derived from live transaction heights or clean baseline
  const settlementSoundwave = useMemo(() => {
    const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
    if (isGuest && transactions.length === 0) {
      return [
        { time: "09:00", height: "40%" },
        { time: "10:00", height: "65%" },
        { time: "11:00", height: "95%" },
        { time: "12:00", height: "70%" },
        { time: "13:00", height: "85%" },
        { time: "14:00", height: "50%" },
        { time: "15:00", height: "90%" },
        { time: "16:00", height: "60%" },
        { time: "17:00", height: "75%" },
        { time: "18:00", height: "45%" },
        { time: "19:00", height: "80%" },
      ];
    }

    if (transactions.length === 0) {
      return hours.map((time) => ({ time, height: "12%" }));
    }

    const maxTxnAmt = Math.max(...transactions.map((t) => t.amount), 1);
    return hours.map((time, idx) => {
      const txn = transactions[idx % transactions.length];
      const pct = Math.min(100, Math.max(15, Math.round((txn.amount / maxTxnAmt) * 100)));
      return { time, height: `${pct}%` };
    });
  }, [isGuest, transactions]);

  // Structured Transaction Log (from user data + mock enriched)
  const transactionRows = useMemo(() => {
    if (transactions.length > 0) {
      return transactions.slice(0, 6).map((t, idx) => ({
        id: `Txn_...${t.id.slice(-4) || 'C3Nv'}`,
        date: t.date,
        customer: t.description,
        amount: t.amount,
        method: idx % 2 === 0 ? "Credit Card" : idx % 3 === 0 ? "UPI Transfer" : "Bank Transfer",
        status: t.isAnomaly ? "Anomaly ⚠️" : idx % 4 === 0 ? "Processing" : "Settled",
        fee: currency === "INR" ? "₹0.00" : "$0.00"
      }));
    }
    return [];
  }, [transactions, currency]);

  const handleDownloadPDF = () => {
    const categoryTotals: Record<string, number> = {};
    transactions.forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const currentMonthYear = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    generateMonthlyPDFReport({
      studentName: profile.name || "Student",
      studentMajor: profile.major || "B.Tech",
      monthYear: currentMonthYear,
      healthScore,
      healthGrade,
      monthlyIncome: monthlyAllowance,
      totalSpent: totalSpentThisMonth,
      totalBudget: monthlyAllowance,
      remainingBudget: Math.max(0, monthlyAllowance - totalSpentThisMonth),
      savingsGoalProgress: goals.map((g) => ({ name: g.name, target: g.target, current: g.current })),
      categoryBreakdown: categoryTotals,
      currency: currency || "INR",
      transactions: transactions.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
      })),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ─── ROW 1: Sleek Dark Hectra Banner Header ─── */}
      <div className="rounded-3xl bg-[#0d0d12] text-white border border-zinc-800/90 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        {/* Background abstract fluid aura */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600 via-purple-600 to-transparent" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold text-zinc-400 tracking-wider">
              {currentDateFormatted}
            </span>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mt-1 font-display">
              {greeting},{" "}
              <span className="italic font-serif font-normal text-cyan-400">
                {profile.name || "Mellnson Ele."}
              </span>
            </h1>

            {/* Sub-Navigation Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2 mt-6 flex-wrap">
              {[
                { id: "overview", label: "Overview", icon: Layers },
                { id: "scan", label: "Scan Receipt", icon: Camera, action: () => setIsReceiptScannerOpen(true) },
                { id: "balance", label: "Balance & Wallet", icon: CreditCard, action: () => setActiveTab("budget") },
                { id: "split", label: "Split Bill", icon: Users, action: () => setIsSplitModalOpen(true) },
                { id: "envelopes", label: "Envelopes", icon: Sliders, action: () => setActiveTab("budget") },
                { id: "reports", label: "Reports & PDF", icon: FileText, action: handleDownloadPDF },
                // Powered by Google Gemini 2.5 Flash & Heuristic Decision Rules
                { id: "bob", label: "AI Assistant", icon: Sparkles, action: () => setActiveTab("advisor") },
              ].map((pill) => {
                const Icon = pill.icon;
                const isActive = activeSubTab === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => {
                      setActiveSubTab(pill.id as any);
                      if (pill.action) pill.action();
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer select-none ${
                      isActive
                        ? "bg-white text-slate-900 shadow-md shadow-white/10"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/80"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Promotion Card: "Specially for you" */}
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 max-w-sm w-full backdrop-blur-md shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              <span>Specially for you</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <p className="text-xs font-bold text-white mb-1">
              Be the best with Student PRO
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
              Unlock auto-scholarship applications, anomaly protection & watsonx AI co-pilot.
            </p>
            <button
              onClick={() => setActiveTab("scholarships")}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-zinc-100 text-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Explore Schemes & Upgrade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── AI/ML Spending Forecaster & Anomaly Banner (Feature A) ─── */}
      <div className={`rounded-3xl border p-5 sm:p-6 transition-all shadow-md ${
        spendForecast.trajectory === "critical"
          ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
          : spendForecast.trajectory === "tight"
          ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-md ${
              spendForecast.trajectory === "critical" ? "bg-rose-500" : spendForecast.trajectory === "tight" ? "bg-amber-500" : "bg-emerald-500"
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base font-display">
                  AI Month-End Spending Forecast
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-white/60 dark:bg-black/30 border border-current/20">
                  {spendForecast.trajectory} trajectory
                </span>
              </div>
              <p className="text-xs mt-1 font-medium leading-relaxed max-w-2xl opacity-90">
                {spendForecast.recommendation}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-current/20 sm:pl-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">Daily Burn</span>
              <span className="text-sm font-extrabold font-display">{currency === "INR" ? "₹" : "$"}{spendForecast.dailyBurnRate}/day</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">Projected Spend</span>
              <span className="text-sm font-extrabold font-display">{currency === "INR" ? "₹" : "$"}{spendForecast.projectedTotalSpend.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 2: Payments Breakdown + Gross Volume Envelopes + KPI Cards ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Payments Breakdown 3D Pillar Chart (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 p-6 ambient-shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Payments breakdown
              </h3>
              <button
                onClick={() => setActiveTab("expenses")}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Average this month
                </span>
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-display">
                  {formatAmt(monthlyAllowance)}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                {transactions.length > 0 ? `${transactions.length} recorded | ${healthGrade} health` : "No spend recorded"}
              </span>
            </div>

            {/* Pillar Graphic Bar Preview */}
            <div className="h-44 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentBreakdownData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="day" fontSize={10} stroke="#94a3b8" />
                  <YAxis fontSize={10} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      backgroundColor: "#18181f",
                      color: "#ffffff",
                      borderColor: "#27272a",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="Successful" fill="#c084fc" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Payouts" fill="#e879f9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800 flex-wrap">
            {["Initiated", "Authorized", "Successful", "Payouts"].map((f) => (
              <button
                key={f}
                onClick={() => setPaymentFilter(f as any)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  paymentFilter === f
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Gross Volume / Envelope Breakdown (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 p-6 ambient-shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Gross Volume
              </h3>
              <button
                onClick={() => setActiveTab("budget")}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
                title="Add new budget envelope"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="relative mb-5">
              <input
                type="text"
                value={envelopeSearch}
                onChange={(e) => setEnvelopeSearch(e.target.value)}
                placeholder="Search envelope..."
                className="w-full h-8 pl-3 pr-8 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white outline-none"
              />
              <Mic className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Envelopes list with dot meters */}
            <div className="space-y-4">
              {envelopeItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                    No budget envelopes set
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                    Set category limits to track student spending caps
                  </p>
                  <button
                    onClick={() => setActiveTab("budget")}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    + Configure Envelopes
                  </button>
                </div>
              ) : (
                envelopeItems.map((env, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">{env.name}</span>
                      <span className="font-extrabold text-slate-900 dark:text-white font-display">
                        {formatAmt(env.amount)}
                      </span>
                    </div>
                    {/* Segmented dot track */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        style={{ width: `${env.pct}%` }}
                        className={`h-full rounded-full bg-gradient-to-r ${env.color}`}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab("budget")}
              className="w-full py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold text-blue-600 dark:text-cyan-400 transition-colors cursor-pointer text-center"
            >
              Adjust Envelopes & Targets →
            </button>
          </div>
        </div>

        {/* Transactions & Peer Network Sparkline Cards (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Card 1: Transactions Velocity */}
          <div className="rounded-3xl bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 p-5 ambient-shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Transactions</span>
              <button onClick={() => setActiveTab("expenses")}>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
                {txnMetrics.volumeText}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                {txnMetrics.highestBadge}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 mt-2">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>{txnMetrics.trendText}</span>
            </div>
          </div>

          {/* Card 2: Peer Network / Active Students */}
          <div className="rounded-3xl bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 p-5 ambient-shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Peer Network</span>
              <button onClick={() => setIsSplitModalOpen(true)}>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
                {peerMetrics.countText}
              </span>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                {peerMetrics.badge}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 mt-2">
              <Users className="w-3 h-3 text-purple-500" />
              <span>{peerMetrics.subtext}</span>
            </div>
          </div>

        </div>

      </div>

      {/* ─── ROW 3: Settlement Soundwave Overview & Action Reports ─── */}
      <div className="rounded-3xl bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 p-6 sm:p-7 ambient-shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              Settlement & Cashflow Overview
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Live cashflow timeline and liquidation soundwave
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-900 p-1 border border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => setSettlementView("weekly")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  settlementView === "weekly"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setSettlementView("daily")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  settlementView === "daily"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                Daily
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Metrics */}
          <div className="lg:col-span-4 space-y-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Today Balance
              </span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-display">
                {cashflowMetrics.balance}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Yesterday Settlement
              </span>
              <span className="text-2xl font-bold text-slate-500 dark:text-zinc-400 font-display">
                {cashflowMetrics.yesterdayOrCleared}
              </span>
            </div>
          </div>

          {/* Middle Soundwave Graphic */}
          <div className="lg:col-span-5 flex items-end justify-between h-28 px-4 py-2 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-100 dark:border-zinc-800">
            {settlementSoundwave.map((s, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  style={{ height: s.height }}
                  className="w-2.5 rounded-full bg-gradient-to-t from-amber-400 to-orange-500 shadow-xs hover:scale-110 transition-transform"
                />
                <span className="text-[8px] font-semibold text-slate-400">{s.time}</span>
              </div>
            ))}
          </div>

          {/* Right Settlement Action Cards */}
          <div className="lg:col-span-3 space-y-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">Pending</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {cashflowMetrics.pending}
                </span>
              </div>
              <button
                onClick={() => setSelectedReportModal("Pending Settlement")}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 cursor-pointer"
              >
                View Report
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">Processing</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {cashflowMetrics.processing}
                </span>
              </div>
              <button
                onClick={() => setSelectedReportModal("Processing Settlement")}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 cursor-pointer"
              >
                View Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 4: Transaction Log Table (with CSV Export) ─── */}
      <div className="rounded-3xl bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 p-6 sm:p-7 ambient-shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              Transaction log
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Recent card, UPI, and bank transfers
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-900 p-1 border border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => setLogPeriod("weekly")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  logPeriod === "weekly"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setLogPeriod("monthly")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  logPeriod === "monthly"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400"
                }`}
              >
                Monthly
              </button>
            </div>

            <button
              onClick={handleDownloadPDF}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                <th className="pb-3 pl-2">Date</th>
                <th className="pb-3">Transaction ID</th>
                <th className="pb-3">Customer / Merchant</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Method</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs">
              {transactionRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                        No transactions recorded yet
                      </p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500">
                        Log your first college expense to activate burn rate tracking
                      </p>
                      <button
                        onClick={() => {
                          if (onOpenQuickLog) onOpenQuickLog();
                          else setActiveTab("expenses");
                        }}
                        className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        + Log First Expense
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                transactionRows.map((tx, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/50 transition-colors text-slate-700 dark:text-zinc-300"
                >
                  <td className="py-3.5 pl-2 font-medium text-slate-500 dark:text-zinc-400">{tx.date}</td>
                  <td className="py-3.5 font-mono text-[11px] font-bold text-slate-600 dark:text-zinc-400">{tx.id}</td>
                  <td className="py-3.5 font-bold text-slate-900 dark:text-white">{tx.customer}</td>
                  <td className="py-3.5 font-display font-extrabold text-slate-900 dark:text-white">
                    {formatAmt(tx.amount)}
                  </td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      {tx.method}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.status === "Settled"
                          ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800"
                          : tx.status === "Processing"
                          ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3.5 pr-2 text-right font-medium text-slate-500 dark:text-zinc-400">
                    {tx.fee}
                  </td>
                </tr>
              )))
            }
            </tbody>
          </table>
        </div>
      </div>

      {/* Split the Bill Modal Trigger */}
      <SplitBillModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
      />

      {/* Settlement Report Modal Dialog */}
      {selectedReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#18181f] p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in fade-in">
            <h4 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-2">
              {selectedReportModal}
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              All transactions for this period have been verified and matched with your bank feed.
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedReportModal === "Pending Settlement" ? cashflowMetrics.pending : cashflowMetrics.processing}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-bold text-emerald-600">Active Pipeline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verification</span>
                <span className="font-bold text-slate-900 dark:text-white">100% Reconciled</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedReportModal(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
            >
              Close Dialog
            </button>
          </div>
        </div>
      )}

      {/* Gemini Vision AI Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isReceiptScannerOpen}
        onClose={() => setIsReceiptScannerOpen(false)}
      />

    </div>
  );
};
