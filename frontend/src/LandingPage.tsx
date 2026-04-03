import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { BarChart3, ShieldCheck, Zap, Globe, TrendingUp } from "lucide-react";
import { AuthModal } from "./AuthModal";
import { CurrencyChart } from "./CurrencyChart";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("token")) {
      setIsAuthModalOpen(true);
    }
  }, [location]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      setAuthMode('register');
      setIsAuthModalOpen(true);
    }
  };

  const handleLoginClick = () => {
    setAuthMode('login');
    setIsAuthModalOpen(true);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
              <TrendingUp size={28} />
              <span>StockProfits</span>
            </div>
            <div className="flex items-center gap-4">
              {!isAuthenticated ? (
                <>
                  <button 
                    onClick={handleLoginClick}
                    className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    Log in
                  </button>
                  <button 
                    onClick={handleGetStarted}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8 bg-gradient-to-b from-blue-50/50 to-white text-center">
        <div className="mx-auto max-w-2xl py-24 sm:py-32">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Track your investments with ease
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            A simple and powerful tool to manage your stock portfolio across multiple brokers. 
            Calculate taxes, track dividends, and monitor your performance in UAH and USD.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={handleGetStarted}
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all"
            >
              Get started for free
            </button>
            <a href="#features" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600 transition-colors">
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="py-24 bg-slate-50 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Official Market Rates</h2>
              <p className="mt-4 text-lg text-gray-600">Access historical NBU data used for UAH profit & tax calculations.</p>
            </div>
            <CurrencyChart 
              title="Global Exchange Rates"
              isDark={false}
            />
          </div>
        </div>
      </div>

      {/* Feature Section */}
      <div id="features" className="py-24 sm:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Faster Analysis</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to manage your assets
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/20 text-white">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  Multi-Broker Support
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Import data from Interactive Brokers and Freedom Finance seamlessly.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/20 text-white">
                    <Globe className="h-6 w-6" />
                  </div>
                  Tax Calculation
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Automatically calculate taxes based on NBU rates for the date of transaction.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/20 text-white">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  Secure & Private
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Your data is protected and only accessible to you.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/20 text-white">
                    <Zap className="h-6 w-6" />
                  </div>
                  Real-time Dashboard
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Get a clear overview of your portfolio performance and history.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialMode={authMode}
      />
    </div>
  );
};
