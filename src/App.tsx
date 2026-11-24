import { useState, useEffect, lazy, Suspense } from "react";
import { FinancialProvider, useFinancial } from "./context/FinancialContext";
import { GamificationProvider } from "./context/GamificationContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";
import { AskFinBuddyWidget } from "./components/AskFinBuddyWidget";
import { QuickLogFab } from "./components/QuickLogFab";
import { QuickLogModal } from "./components/QuickLogModal";
import { BadgeCelebrationModal } from "./components/BadgeCelebrationModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { Login } from "./pages/Login";
import { WifiOff } from "lucide-react";

// ── Lazily loaded sub-pages — each lands in its own JS chunk ──────────────
const Dashboard     = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Expenses      = lazy(() => import("./pages/Expenses").then((m) => ({ default: m.Expenses })));
const Affordability = lazy(() => import("./pages/Affordability").then((m) => ({ default: m.Affordability })));
const SplitBill     = lazy(() => import("./pages/SplitBill").then((m) => ({ default: m.SplitBill })));
const Loans         = lazy(() => import("./pages/Loans").then((m) => ({ default: m.Loans })));
const Scholarships  = lazy(() => import("./pages/Scholarships").then((m) => ({ default: m.Scholarships })));
const Budget        = lazy(() => import("./pages/Budget").then((m) => ({ default: m.Budget })));
const Habits        = lazy(() => import("./pages/Habits").then((m) => ({ default: m.Habits })));
const Advisor       = lazy(() => import("./pages/Advisor").then((m) => ({ default: m.Advisor })));

/** Minimal in-layout fallback shown while a lazy page chunk loads. */
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-24 opacity-40 text-sm tracking-wide">
      Loading…
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const { isAuthenticated, isGuest, logout, profile } = useFinancial();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard setActiveTab={setActiveTab} onOpenQuickLog={() => setQuickLogOpen(true)} />;
      case "expenses":
        return <Expenses />;
      case "affordability":
        return <Affordability />;
      case "split":
        return <SplitBill />;
      case "loans":
        return <Loans />;
      case "scholarships":
        return <Scholarships />;
      case "budget":
        return <Budget />;
      case "habits":
        return <Habits />;
      case "advisor":
        return <Advisor />;
      default:
        return <Dashboard setActiveTab={setActiveTab} onOpenQuickLog={() => setQuickLogOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-slate-900 dark:text-white flex transition-colors duration-300">
      {/* Offline Connectivity Notification Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-slate-950 font-semibold text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are currently offline. Changes are saved locally and will sync when connectivity resumes.</span>
        </div>
      )}
      
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickLog={() => setQuickLogOpen(true)}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 transition-all duration-300">
        {/* Persistent Demo Mode Banner */}
        {isGuest && (
          <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                Demo Mode
              </span>
              <span>Exploring with sample student data. Changes will not be saved to your account.</span>
            </div>
            <button
              onClick={() => logout()}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all cursor-pointer"
            >
              Exit Demo
            </button>
          </div>
        )}

        <main className="flex-1 w-full max-w-[1240px] mx-auto p-4 sm:p-6 lg:p-8 pb-28">
          {/* Top Universal Header */}
          <TopHeader
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            setActiveTab={setActiveTab}
          />

          {/* Active Sub-page Component — wrapped in Suspense for lazy chunks */}
          <Suspense fallback={<PageLoader />}>
            {renderActivePage()}
          </Suspense>
        </main>
      </div>

      {/* Floating Action Button (FAB) for rapid logs */}
      <QuickLogFab onClick={() => setQuickLogOpen(true)} />

      {/* Quick Log Input Panel Overlay Modal */}
      <QuickLogModal isOpen={quickLogOpen} onClose={() => setQuickLogOpen(false)} />

      {/* Persistent floating AI companion chat window */}
      <AskFinBuddyWidget setActiveTab={setActiveTab} />

      {/* Confetti celebrate achievements toast overlays */}
      <BadgeCelebrationModal />

      {/* First-time setup onboarding wizard for authenticated accounts */}
      <OnboardingModal isOpen={!isGuest && isAuthenticated && profile.hasCompletedOnboarding === false} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FinancialProvider>
          <GamificationProvider>
            <AppContent />
          </GamificationProvider>
        </FinancialProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
