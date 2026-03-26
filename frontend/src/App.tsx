import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Upload, LayoutDashboard, History, DollarSign, TrendingUp, ReceiptText, Wallet } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

interface Summary {
  total_realized_profit: number;
  total_realized_profit_uah: number;
  total_dividends: number;
  total_dividends_uah: number;
  total_cost_basis: number;
  total_cost_basis_uah: number;
}

interface Holding {
  symbol: string;
  currency: string;
  average_price: number;
  quantity: number;
  total_cost: number;
  total_cost_uah: number;
  realized_profit: number;
  realized_profit_uah: number;
  total_dividends: number;
  total_dividends_uah: number;
  last_trade_date: string;
}

interface SellReport {
  broker: string;
  symbol: string;
  date: string;
  buy_date: string;
  quantity: number;
  buy_price: number;
  sell_price: number;
  commission_buy: number;
  commission_sell: number;
  commission_buy_uah: number;
  commission_sell_uah: number;
  tax: number;
  tax_uah: number;
  profit: number;
  profit_uah: number;
  currency: string;
  currency_rate_buy: number;
  currency_rate_sell: number;
  comment: string;
}

interface DividendReport {
  broker: string;
  symbol: string;
  date: string;
  gross_amount: number;
  gross_amount_uah: number;
  tax: number;
  tax_uah: number;
  net_amount: number;
  amount_uah: number;
  currency: string;
  currency_rate: number;
}

interface PortfolioData {
    holdings: Record<string, Holding>;
    sells: SellReport[];
    dividends: DividendReport[];
}

interface Transaction {
  ID: number;
  broker: string;
  symbol: string;
  type: string;
  date: string;
  quantity: number;
  price: number;
  currency: string;
  commission: number;
  total_amount: number;
  nbu_rate: number;
  amount_uah: number;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'UAH': '₴', 'GBP': '£' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatUAH = (amount: number) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
};

const getCurrencyTotals = <T extends { currency: string }>(
  items: T[], 
  valueKeys: (keyof T)[]
): Record<string, Record<string, number>> => {
  return items.reduce((acc, item) => {
    const curr = item.currency;
    if (!acc[curr]) acc[curr] = {};
    valueKeys.forEach(key => {
        acc[curr][key as string] = (acc[curr][key as string] || 0) + (item[key] as number);
    });
    return acc;
  }, {} as Record<string, Record<string, number>>);
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'upload'>('dashboard');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [useGrossTaxBase, setUseGrossTaxBase] = useState(true);
  const [selectedBroker, setSelectedBroker] = useState<'IBKR' | 'FreedomFinance'>('IBKR');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ count: number } | null>(null);

  // Date range state
  const currentYear = new Date().getFullYear().toString();
  const [fromDate, setFromDate] = useState<string>(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState<string>(`${currentYear}-12-31`);

  useEffect(() => { fetchData().finally(() => setInitialLoading(false)); }, [fromDate, toDate]);

  const fetchData = async () => {
    try {
      const params = { from: fromDate, to: toDate };
      const [sumRes, holdRes, txRes] = await Promise.all([
        axios.get(`${API_URL}/summary`, { params }),
        axios.get(`${API_URL}/holdings`, { params }),
        axios.get(`${API_URL}/transactions`, { params }),
      ]);
      setSummary(sumRes.data);
      setData(holdRes.data);
      setTransactions(txRes.data);
    } catch (err) { console.error('Error fetching data', err); }
  };

  const handleYearChange = (year: string) => {
    if (year === 'all') {
      setFromDate('');
      setToDate('');
    } else {
      setFromDate(`${year}-01-01`);
      setToDate(`${year}-12-31`);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('broker', selectedBroker);
    try {
      const res = await axios.post(`${API_URL}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadStats(res.data);
      setShowUploadModal(true);
      fetchData();
    } catch (err) { alert('Upload failed'); } finally { setLoading(false); }
  };

  if (initialLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-400">Loading portfolio...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <nav className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="w-full max-w-[1800px] mx-auto flex justify-between items-center px-4">
          <div className="flex items-center space-x-2 font-bold text-xl text-blue-400"><TrendingUp size={24} /><span>StockProfits</span></div>
          <div className="flex items-center space-x-6">
            <div className="flex space-x-6 mr-6 border-r border-slate-700 pr-6">
              <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-1 ${activeTab === 'dashboard' ? 'text-blue-400' : 'hover:text-blue-300'}`}><LayoutDashboard size={18} /><span>{t('tabs.dashboard')}</span></button>
              <button onClick={() => setActiveTab('history')} className={`flex items-center space-x-1 ${activeTab === 'history' ? 'text-blue-400' : 'hover:text-blue-300'}`}><History size={18} /><span>{t('tabs.history')}</span></button>
              <button onClick={() => setActiveTab('upload')} className={`flex items-center space-x-1 ${activeTab === 'upload' ? 'text-blue-400' : 'hover:text-blue-300'}`}><Upload size={18} /><span>{t('tabs.upload')}</span></button>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
              <button 
                onClick={() => i18n.changeLanguage('en')} 
                className={`px-2 py-1 text-[10px] font-black rounded transition-all ${i18n.language === 'en' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-slate-300'}`}
              >EN</button>
              <button 
                onClick={() => i18n.changeLanguage('uk')} 
                className={`px-2 py-1 text-[10px] font-black rounded transition-all ${i18n.language === 'uk' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-slate-300'}`}
              >UA</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full max-w-[1800px] mx-auto p-4 md:p-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Date Range Selector */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-400 uppercase">{t('common.reporting_period')}:</span>
                <select 
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  onChange={(e) => handleYearChange(e.target.value)}
                  value={fromDate === '' ? 'all' : fromDate.substring(0, 4)}
                >
                  <option value="all">{t('common.all_time')}</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-500">to</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl bg-gradient-to-br from-slate-800 to-emerald-900/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg"><DollarSign className="text-emerald-400" size={24} /></div>
                  <span className="text-slate-400 uppercase text-[10px] font-black tracking-widest">{t('summary.realized_profit')}</span>
                </div>
                <div className="text-3xl font-mono font-bold text-emerald-400 leading-none">{formatUAH(summary?.total_realized_profit_uah || 0)}</div>
                <div className="mt-2 text-xs text-slate-500 font-medium">{t('summary.realized_profit_desc')}</div>
              </div>

              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl bg-gradient-to-br from-slate-800 to-blue-900/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg"><ReceiptText className="text-blue-400" size={24} /></div>
                  <span className="text-slate-400 uppercase text-[10px] font-black tracking-widest">{t('summary.dividends')}</span>
                </div>
                <div className="text-3xl font-mono font-bold text-blue-400 leading-none">{formatUAH(summary?.total_dividends_uah || 0)}</div>
                <div className="mt-2 text-xs text-slate-500 font-medium">{t('summary.dividends_desc')}</div>
              </div>

              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl bg-gradient-to-br from-slate-800 to-slate-700/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-slate-500/10 rounded-lg"><Wallet className="text-slate-300" size={24} /></div>
                  <span className="text-slate-400 uppercase text-[10px] font-black tracking-widest">{t('summary.holdings_cost')}</span>
                </div>
                <div className="text-3xl font-mono font-bold text-slate-100 leading-none">{formatUAH(summary?.total_cost_basis_uah || 0)}</div>
                <div className="mt-2 text-xs text-slate-500 font-medium">{t('summary.holdings_cost_desc')}</div>
              </div>
            </div>

            {/* UA Tax Estimation Section */}
            <div className="bg-slate-800 rounded-2xl border border-rose-900/30 overflow-hidden shadow-2xl bg-gradient-to-b from-slate-800 to-rose-900/5">
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center gap-2 text-rose-400">
                  <TrendingUp size={20} />
                  <span>{t('tax.title')}</span>
                </h2>
                <div className="px-3 py-1 bg-rose-500/10 rounded-full text-[10px] text-rose-400 font-bold uppercase tracking-widest border border-rose-500/20">
                  {t('tax.estimated_liabilities')}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-700/50 text-sm">
                {/* Sales Tax */}
                <div className="bg-slate-800 p-6">
                  <h3 className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-4">{t('tax.capital_gains')}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">{t('tax.tax_base')}</span>
                      <span className="font-mono font-bold text-slate-200">{formatUAH(Math.max(0, summary?.total_realized_profit_uah || 0))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">{t('tax.pit_18')}</span>
                      <span className="font-mono text-slate-200">{formatUAH(Math.max(0, summary?.total_realized_profit_uah || 0) * 0.18)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                      <span className="text-slate-500 font-medium">{t('tax.military_5')}</span>
                      <span className="font-mono text-slate-200">{formatUAH(Math.max(0, summary?.total_realized_profit_uah || 0) * 0.05)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-emerald-400 font-bold">{t('tax.total_sales')}</span>
                      <span className="font-mono font-black text-emerald-400 text-lg">{formatUAH(Math.max(0, summary?.total_realized_profit_uah || 0) * 0.23)}</span>
                    </div>
                  </div>
                </div>

                {/* Dividend Tax */}
                <div className="bg-slate-800 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-slate-400 font-bold text-xs uppercase tracking-wider">{t('tax.dividends_income')}</h3>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <span className="text-[10px] text-slate-500 font-bold group-hover:text-slate-400 transition-colors uppercase">{t('tax.use_gross')}</span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={useGrossTaxBase}
                          onChange={() => setUseGrossTaxBase(!useGrossTaxBase)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>
                  </div>
                  {(() => {
                    const totalTaxUahPaidAbroad = (data?.dividends || []).reduce((acc, d) => acc + (d.tax_uah || (d.tax * d.currency_rate)), 0);
                    const totalNetDivUah = summary?.total_dividends_uah || 0;
                    const abroadTaxesAbs = Math.abs(totalTaxUahPaidAbroad);

                    // Total Gross = Net Received + Taxes Paid Abroad
                    const totalGrossDivUah = totalNetDivUah + abroadTaxesAbs;
                    const taxBase = useGrossTaxBase ? totalGrossDivUah : totalNetDivUah;

                    const uaPitUah = taxBase * 0.09;
                    const uaMilitaryUah = taxBase * 0.05;
                    const totalUaTaxes = uaPitUah + uaMilitaryUah;

                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
                          <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">{t('tax.tax_base')} ({useGrossTaxBase ? t('tables.columns.gross') : t('tables.columns.net')})</span>
                          <span className="font-mono font-bold text-slate-200">{formatUAH(taxBase)}</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">{t('tax.pit_9')}</span>
                            <span className="font-mono text-slate-200">{formatUAH(uaPitUah)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">{t('tax.ua_military')}</span>
                            <span className="font-mono text-slate-200">{formatUAH(uaMilitaryUah)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 text-[11px]">
                            <span className="text-blue-400/80 font-bold uppercase tracking-tighter">{t('tax.total_ua_liability')}</span>
                            <span className="font-mono font-bold text-blue-400">{formatUAH(totalUaTaxes)}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 pb-2 border-t border-slate-700/50">
                          <span className="text-slate-500 font-medium italic">{t('tax.abroad_paid')}</span>
                          <span className="font-mono text-rose-400/80">{formatUAH(abroadTaxesAbs)}</span>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t-2 border-slate-700">
                          <span className="text-emerald-400 font-bold uppercase text-xs">{t('tax.net_received')}</span>
                          <span className="font-mono font-black text-emerald-400 text-xl">{formatUAH(totalGrossDivUah - abroadTaxesAbs)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="p-4 bg-slate-900/50 text-[10px] text-slate-500 flex justify-center gap-8 border-t border-slate-700">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500/50"></div> {t('tax.combined_rate_sales')}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500/50"></div> {t('tax.combined_rate_dividends')}</div>
              </div>
            </div>
            {/* Sells Table */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-400" />
                  <span>{t('tables.sells_detailed')}</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="uppercase text-slate-500 bg-slate-900/80 sticky top-0 backdrop-blur-sm">
                    <tr>
                      <th className="p-2 font-semibold border-b border-slate-700 text-center">{t('tables.columns.broker')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700">{t('tables.columns.ticker')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700">{t('tables.columns.date_buy')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.qty_buy')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-center">{t('tables.columns.curr')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.price_buy')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.comm_buy')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.rate_buy')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right bg-emerald-900/10">{t('tables.columns.total_buy_uah')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700">{t('tables.columns.date_sell')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.qty_sell')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.price_sell')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.comm_sell')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.rate_sell')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right bg-blue-900/10">{t('tables.columns.total_sell_uah')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700 text-right">{t('tables.columns.profit_uah')}</th>
                      <th className="p-2 font-semibold border-b border-slate-700">{t('tables.columns.comments')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data?.sells?.map((s, idx) => {
                      const totalBuyUah = (s.quantity * s.buy_price * s.currency_rate_buy) + s.commission_buy_uah;
                      const totalSellUah = (s.quantity * s.sell_price * s.currency_rate_sell) - s.commission_sell_uah;
                      const profitUah = totalSellUah - totalBuyUah;

                      return (
                        <tr key={idx} className="hover:bg-slate-700/30 transition-all duration-150 group">
                          <td className="p-2 text-xs">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${s.broker === 'IBKR' ? 'bg-white border-slate-200' : 'bg-emerald-500 border-emerald-600'}`}>
                              <img 
                                src={s.broker === 'IBKR' ? '/ibkr-logo.svg' : '/f24-logo.svg'} 
                                alt={s.broker} 
                                className={`h-3 w-auto ${s.broker === 'IBKR' ? '' : 'brightness-0 invert'}`} 
                              />
                            </div>
                          </td>
                          <td className="p-2 font-mono font-bold text-blue-300 bg-slate-900/20 group-hover:bg-blue-500/10">{s.symbol}</td>
                          <td className="p-2 text-slate-400 whitespace-nowrap font-mono">{new Date(s.buy_date).toLocaleDateString()}</td>
                          <td className="p-2 text-right font-mono font-medium">{s.quantity.toFixed(1)}</td>
                          <td className="p-2 text-slate-500 text-center font-bold">{s.currency}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatCurrency(s.buy_price, s.currency)}</td>
                          <td className="p-2 text-right font-mono text-rose-400/80">{formatCurrency(s.commission_buy, s.currency)}</td>
                          <td className="p-2 text-right text-slate-500 font-mono">{s.currency_rate_buy.toFixed(4)}</td>
                          <td className="p-2 text-right font-mono font-black text-slate-200 bg-emerald-900/5">{formatUAH(totalBuyUah)}</td>
                          
                          <td className="p-2 text-slate-400 whitespace-nowrap font-mono">{new Date(s.date).toLocaleDateString()}</td>
                          <td className="p-2 text-right font-mono font-medium">{s.quantity.toFixed(1)}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatCurrency(s.sell_price, s.currency)}</td>
                          <td className="p-2 text-right font-mono text-rose-400/80">{formatCurrency(s.commission_sell, s.currency)}</td>
                          <td className="p-2 text-right text-slate-500 font-mono">{s.currency_rate_sell.toFixed(4)}</td>
                          <td className="p-2 text-right font-mono font-black text-slate-200 bg-blue-900/5">{formatUAH(totalSellUah)}</td>
                          
                          <td className={`p-2 text-right font-mono font-black border-l border-slate-700/50 bg-slate-900/10 ${profitUah >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatUAH(profitUah)}
                          </td>
                          <td className="p-2 text-slate-500 italic max-w-[120px] truncate font-mono" title={s.comment}>{s.comment}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {!data?.sells?.length && (<tbody><tr><td colSpan={17} className="p-12 text-center text-slate-500 italic font-mono">{t('tables.no_data_sells')}</td></tr></tbody>)}
                </table>
              </div>
            </div>

            {/* Sells Summary Table */}
            {data?.sells?.length ? (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <LayoutDashboard size={20} className="text-emerald-400" />
                    <span>{t('tables.sells_summary')}</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead className="uppercase text-slate-500 bg-slate-900/80">
                      <tr>
                        <th className="p-4 font-semibold border-b border-slate-700">{t('tables.columns.symbol')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.total_qty')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.total_buy_uah')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.fees_buy')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.total_buy_with_fees')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.total_sell_uah')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.fees_sell')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.total_sell_with_fees')}</th>
                        <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.total_profit_uah')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {Object.values((data?.sells || []).reduce((acc, s) => {
                        const key = s.symbol;
                        if (!acc[key]) acc[key] = { symbol: s.symbol, quantity: 0, buyUah: 0, sellUah: 0, commBuyUah: 0, commSellUah: 0, taxUah: 0 };
                        acc[key].quantity += s.quantity;
                        acc[key].buyUah += (s.quantity * s.buy_price * s.currency_rate_buy);
                        acc[key].sellUah += (s.quantity * s.sell_price * s.currency_rate_sell);
                        acc[key].commBuyUah += s.commission_buy_uah;
                        acc[key].commSellUah += s.commission_sell_uah;
                        acc[key].taxUah += s.tax_uah;
                        return acc;
                      }, {} as Record<string, { symbol: string, quantity: number, buyUah: number, sellUah: number, commBuyUah: number, commSellUah: number, taxUah: number }>)).map((s, idx) => {
                        const buyTotalWithFees = s.buyUah + s.commBuyUah;
                        const sellTotalWithFees = s.sellUah - s.commSellUah - s.taxUah;
                        const profitUah = sellTotalWithFees - buyTotalWithFees;
                        return (
                          <tr key={idx} className="hover:bg-slate-700/30 transition-all duration-150 group">
                            <td className="p-4 font-mono font-bold text-blue-300 group-hover:text-blue-200">{s.symbol}</td>
                            <td className="p-4 text-right font-mono">{s.quantity.toFixed(1)}</td>
                            <td className="p-4 text-right text-slate-300 font-mono">{formatUAH(s.buyUah)}</td>
                            <td className="p-4 text-right text-rose-400/60 font-mono">{formatUAH(s.commBuyUah)}</td>
                            <td className="p-4 text-right text-slate-400 font-mono font-bold">{formatUAH(buyTotalWithFees)}</td>
                            <td className="p-4 text-right text-slate-300 font-mono">{formatUAH(s.sellUah)}</td>
                            <td className="p-4 text-right text-rose-400/60 font-mono">{formatUAH(s.commSellUah + s.taxUah)}</td>
                            <td className="p-4 text-right text-slate-400 font-mono font-bold">{formatUAH(sellTotalWithFees)}</td>
                            <td className={`p-4 text-right font-mono font-black text-base ${profitUah >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatUAH(profitUah)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-900 font-bold border-t-2 border-slate-600">
                      {(() => {
                        const sells = Object.values((data?.sells || []).reduce((acc, s) => {
                          const key = s.symbol;
                          if (!acc[key]) acc[key] = { buyUah: 0, sellUah: 0, commBuyUah: 0, commSellUah: 0, taxUah: 0 };
                          acc[key].buyUah += (s.quantity * s.buy_price * s.currency_rate_buy);
                          acc[key].sellUah += (s.quantity * s.sell_price * s.currency_rate_sell);
                          acc[key].commBuyUah += s.commission_buy_uah;
                          acc[key].commSellUah += s.commission_sell_uah;
                          acc[key].taxUah += s.tax_uah;
                          return acc;
                        }, {} as Record<string, { buyUah: number, sellUah: number, commBuyUah: number, commSellUah: number, taxUah: number }>));

                        const totalFees = sells.reduce((acc, s) => acc + (s.commBuyUah + s.commSellUah + s.taxUah), 0);
                        const totalGrossProfit = sells.reduce((acc, s) => acc + (s.sellUah - s.buyUah), 0);
                        const totalNetProfit = totalGrossProfit - totalFees;

                        return (
                          <>
                            <tr className="bg-slate-950/30">
                              <td className="p-4 text-xs uppercase text-slate-500 tracking-widest" colSpan={8}>{t('tables.footer.total_fees')}</td>
                              <td className="p-4 text-right font-mono text-rose-400/80">{formatUAH(totalFees)}</td>
                            </tr>
                            <tr className="bg-slate-950/30">
                              <td className="p-4 text-xs uppercase text-slate-500 tracking-widest" colSpan={8}>{t('tables.footer.total_without_fee')}</td>
                              <td className="p-4 text-right font-mono text-slate-300">{formatUAH(totalGrossProfit)}</td>
                            </tr>
                            <tr className="bg-slate-950/50 border-t-2 border-slate-600">
                              <td className="p-5 text-xs uppercase text-slate-400 tracking-widest" colSpan={8}>{t('tables.footer.consolidated_total')}</td>
                              <td className={`p-5 text-right font-mono text-xl ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {formatUAH(totalNetProfit)}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Dividends Table */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <ReceiptText size={20} className="text-blue-400" />
                  <span>{t('tables.dividends_received')}</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="uppercase text-slate-500 bg-slate-900/80 sticky top-0 backdrop-blur-sm">
                    <tr>
                      <th className="p-4 font-semibold border-b border-slate-700 text-center">{t('tables.columns.broker')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700">{t('tables.columns.date')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-center">{t('tables.columns.symbol')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.gross')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.tax')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.net')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.rate')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.tax_uah')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.net_uah')}</th>
                      <th className="p-4 font-semibold border-b border-slate-700 text-right">{t('tables.columns.gross_uah')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data?.dividends?.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/30 transition-all group">
                        <td className="p-4 text-xs">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border inline-flex ${d.broker === 'IBKR' ? 'bg-white border-slate-200' : 'bg-emerald-500 border-emerald-600'}`}>
                            <img 
                              src={d.broker === 'IBKR' ? '/ibkr-logo.svg' : '/f24-logo.svg'} 
                              alt={d.broker} 
                              className={`h-3 w-auto ${d.broker === 'IBKR' ? '' : 'brightness-0 invert'}`} 
                            />
                          </div>
                        </td>
                        <td className="p-4 text-slate-400 font-mono whitespace-nowrap">{new Date(d.date).toLocaleDateString()}</td>
                        <td className="p-4 font-mono font-bold text-blue-300 text-center">{d.symbol}</td>
                        <td className="p-4 text-right font-mono">{formatCurrency(d.gross_amount || d.net_amount + d.tax, d.currency)}</td>
                        <td className="p-4 text-right text-rose-400/80 font-mono">{formatCurrency(d.tax, d.currency)}</td>
                        <td className="p-4 text-right text-blue-400 font-mono font-bold">{formatCurrency(d.net_amount, d.currency)}</td>
                        <td className="p-4 text-right text-slate-500 font-mono">{d.currency_rate.toFixed(4)}</td>
                        <td className="p-4 text-right text-rose-400/80 font-mono">{formatUAH(d.tax_uah)}</td>
                        <td className="p-4 text-right text-blue-400 font-mono font-black">{formatUAH(d.amount_uah)}</td>
                        <td className="p-4 text-right text-blue-400 font-mono font-black">{formatUAH(d.gross_amount_uah)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data?.dividends?.length ? (
                    <tfoot className="bg-slate-900/80 font-bold border-t-2 border-slate-600">
                      {Object.entries(getCurrencyTotals(data.dividends, ['tax', 'net_amount'])).map(([curr, totals], idx) => (
                        <tr key={curr} className={idx > 0 ? 'border-t border-slate-700/50' : ''}>
                          <td className="p-4 text-[10px] uppercase text-slate-500 tracking-tighter font-black" colSpan={4}>{t('tables.footer.total')} {curr}</td>
                          <td className="p-4 text-right text-rose-400/80 font-mono">{formatCurrency(totals.tax, curr)}</td>
                          <td className="p-4 text-right text-blue-400 font-mono font-bold" colSpan={5}>{formatCurrency(totals.net_amount, curr)}</td>
                        </tr>
                      ))}
                      {(() => {
                        const totalTaxUah = data.dividends.reduce((acc, d) => acc + (d.tax_uah || (d.tax * d.currency_rate)), 0);
                        const totalNetUah = data.dividends.reduce((acc, d) => acc + d.amount_uah, 0);
                        const totalGrossUah = data.dividends.reduce((acc, d) => acc + (d.gross_amount_uah || (d.amount_uah - (d.tax * d.currency_rate))), 0);
                        return (
                          <>
                            <tr className="bg-slate-950/50 border-t-2 border-slate-600">
                              <td className="p-5 text-xs uppercase text-slate-400 tracking-widest" colSpan={7}>{t('tables.footer.grand_totals_uah')}</td>
                              <td className="p-5 text-right text-rose-400/80 font-mono">{formatUAH(totalTaxUah)}</td>
                              <td className="p-5 text-right text-blue-400 font-mono font-black">{formatUAH(totalNetUah)}</td>
                              <td className="p-5 text-right text-blue-400 font-mono text-xl">{formatUAH(totalGrossUah)}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tfoot>
                  ) : null}
                  {!data?.dividends?.length && (<tbody><tr><td colSpan={10} className="p-12 text-center text-slate-500 italic">{t('tables.no_data_dividends')}</td></tr></tbody>)}
                </table>
              </div>
            </div>

            {/* Current Holdings */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-700 bg-slate-800/50"><h2 className="font-bold text-lg">{t('tables.open_positions')}</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 bg-slate-900/50">
                    <tr><th className="p-4">{t('tables.columns.symbol')}</th><th className="p-4">{t('tables.columns.qty')}</th><th className="p-4">{t('tables.columns.avg_price')}</th><th className="p-4">{t('tables.columns.cost_basis')}</th><th className="p-4">{t('tables.columns.cost_basis_uah')}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {Object.values(data?.holdings || {}).filter(h => h.quantity > 0).map((h) => (
                      <tr key={h.symbol} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-300">{h.symbol}</td>
                        <td className="p-4">{h.quantity.toFixed(4)}</td>
                        <td className="p-4">{formatCurrency(h.average_price, h.currency)}</td>
                        <td className="p-4">{formatCurrency(h.total_cost, h.currency)}</td>
                        <td className="p-4 font-bold">{formatUAH(h.total_cost_uah)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {Object.keys(data?.holdings || {}).length > 0 && summary && (
                      <tfoot className="bg-slate-900/80 font-bold border-t-2 border-slate-600">
                        <tr>
                            <td className="p-4" colSpan={4}>{t('tables.footer.grand_totals_uah')}</td>
                            <td className="p-4">{formatUAH(summary.total_cost_basis_uah)}</td>
                        </tr>
                      </tfoot>
                    )}
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Date Range Selector */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-400 uppercase">Reporting Period:</span>
                <select 
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  onChange={(e) => handleYearChange(e.target.value)}
                  value={fromDate === '' ? 'all' : fromDate.substring(0, 4)}
                >
                  <option value="all">All Time</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-500">to</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center"><h2 className="font-bold text-lg">Transaction History</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500 bg-slate-900/50"><tr><th className="p-4">Date</th><th className="p-4">Broker</th><th className="p-4">Symbol</th><th className="p-4">Type</th><th className="p-4">Qty</th><th className="p-4">Price</th><th className="p-4">NBU Rate</th><th className="p-4">Total UAH</th></tr></thead><tbody className="divide-y divide-slate-700">{transactions?.map((tx) => (<tr key={tx.ID} className="hover:bg-slate-700/30 transition-colors"><td className="p-4 whitespace-nowrap text-slate-400">{new Date(tx.date).toLocaleDateString()}</td><td className="p-4 text-xs"><span className={`px-2 py-1 rounded ${tx.broker === 'IBKR' ? 'bg-indigo-900 text-indigo-200' : 'bg-orange-900 text-orange-200'}`}>{tx.broker}</span></td><td className="p-4 font-mono font-bold text-blue-300">{tx.symbol}</td><td className="p-4"><span className={`font-bold ${tx.type === 'BUY' ? 'text-blue-400' : tx.type === 'SELL' ? 'text-emerald-400' : tx.type === 'DIVIDEND' ? 'text-purple-400' : 'text-slate-400'}`}>{tx.type}</span></td><td className="p-4">{tx.quantity || '-'}</td><td className="p-4">{tx.price ? formatCurrency(tx.price, tx.currency) : '-'}</td><td className="p-4 text-slate-500">{tx.nbu_rate?.toFixed(2) || '-'}</td><td className="p-4 font-bold">{tx.amount_uah ? formatUAH(tx.amount_uah) : '-'}</td></tr>))}</tbody></table></div>
          </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="max-w-md mx-auto">
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2"><Upload className="text-blue-400" /><span>Import Data</span></h2>
              <form onSubmit={handleUpload} className="space-y-6">
                <div><label className="block text-sm font-medium text-slate-400 mb-2">Broker Provider</label><select value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"><option value="IBKR">Interactive Brokers (Activity Flex Report CSV)</option><option value="FreedomFinance">Freedom Finance (F24 Account Statement JSON)</option></select></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-2">Select Report File</label><input type="file" accept={selectedBroker === 'IBKR' ? '.csv' : '.json,.csv'} onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" /></div>
                <button type="submit" disabled={!file || loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2">{loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Upload size={20} /><span>Process Report</span></>}</button>
              </form>
              <div className="mt-12 pt-8 border-t border-slate-700"><h3 className="text-rose-400 font-bold mb-4 flex items-center space-x-2"><span>Danger Zone</span></h3><button onClick={async () => { if (confirm('Clear all imported data?')) { await axios.delete(`${API_URL}/transactions`); fetchData(); alert('Database cleared'); } }} className="w-full bg-transparent border border-rose-900 hover:bg-rose-900/20 text-rose-400 font-bold py-2 px-6 rounded-lg transition-colors">Clear All Data</button></div>
            </div>
          </div>
        )}
      </main>

      {/* Upload Success Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                <TrendingUp size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Import Complete</h3>
              <p className="text-slate-400 text-sm mb-8">
                Successfully processed <span className="text-emerald-400 font-mono font-bold text-lg">{uploadStats?.count}</span> transactions from your report.
              </p>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setActiveTab('dashboard');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
