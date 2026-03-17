import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, LayoutDashboard, History, DollarSign, TrendingUp, ReceiptText, Wallet } from 'lucide-react';

const API_URL = 'http://localhost:8080/api';

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
  symbol: string;
  date: string;
  quantity: number;
  buy_price: number;
  sell_price: number;
  commission: number;
  profit: number;
  profit_uah: number;
  currency: string;
  currency_rate_buy: number;
  currency_rate_sell: number;
}

interface DividendReport {
  symbol: string;
  date: string;
  gross_amount: number;
  tax: number;
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
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₴`;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'upload'>('dashboard');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<'IBKR' | 'FreedomFinance'>('IBKR');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

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
      await axios.post(`${API_URL}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('Upload successful!');
      fetchData();
      setActiveTab('dashboard');
    } catch (err) { alert('Upload failed'); } finally { setLoading(false); }
  };

  if (initialLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-400">Loading portfolio...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <nav className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2 font-bold text-xl text-blue-400"><TrendingUp size={24} /><span>StockProfits</span></div>
          <div className="flex space-x-6">
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-1 ${activeTab === 'dashboard' ? 'text-blue-400' : 'hover:text-blue-300'}`}><LayoutDashboard size={18} /><span>Dashboard</span></button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center space-x-1 ${activeTab === 'history' ? 'text-blue-400' : 'hover:text-blue-300'}`}><History size={18} /><span>History</span></button>
            <button onClick={() => setActiveTab('upload')} className={`flex items-center space-x-1 ${activeTab === 'upload' ? 'text-blue-400' : 'hover:text-blue-300'}`}><Upload size={18} /><span>Upload</span></button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex items-center justify-between mb-2"><span className="text-slate-400 uppercase text-xs font-bold tracking-wider">Total Realized Profit</span><DollarSign className="text-emerald-400" size={20} /></div>
                <div className="text-2xl font-bold text-emerald-400">{formatUAH(summary?.total_realized_profit_uah || 0)}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex items-center justify-between mb-2"><span className="text-slate-400 uppercase text-xs font-bold tracking-wider">Total Dividends</span><ReceiptText className="text-blue-400" size={20} /></div>
                <div className="text-2xl font-bold text-blue-400">{formatUAH(summary?.total_dividends_uah || 0)}</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex items-center justify-between mb-2"><span className="text-slate-400 uppercase text-xs font-bold tracking-wider">Current Holdings Cost</span><Wallet className="text-slate-300" size={20} /></div>
                <div className="text-2xl font-bold text-slate-100">{formatUAH(summary?.total_cost_basis_uah || 0)}</div>
              </div>
            </div>

            {/* Sells Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-700 bg-emerald-900/20"><h2 className="font-bold text-lg text-emerald-400">Realized Profit (Sales)</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 bg-slate-900/50">
                    <tr><th className="p-4">Date</th><th className="p-4">Symbol</th><th className="p-4">Qty</th><th className="p-4">Buy Price</th><th className="p-4">Rate Buy</th><th className="p-4">Sell Price</th><th className="p-4">Rate Sell</th><th className="p-4">Comm.</th><th className="p-4">Profit</th><th className="p-4">Profit UAH</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {data?.sells?.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 text-slate-400">{new Date(s.date).toLocaleDateString()}</td>
                        <td className="p-4 font-mono font-bold text-blue-300">{s.symbol}</td>
                        <td className="p-4">{s.quantity.toFixed(4)}</td>
                        <td className="p-4">{formatCurrency(s.buy_price, s.currency)}</td>
                        <td className="p-4 text-slate-500">{s.currency_rate_buy.toFixed(4)}</td>
                        <td className="p-4">{formatCurrency(s.sell_price, s.currency)}</td>
                        <td className="p-4 text-slate-500">{s.currency_rate_sell.toFixed(4)}</td>
                        <td className="p-4 text-rose-400">{formatCurrency(s.commission, s.currency)}</td>
                        <td className={`p-4 font-bold ${s.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(s.profit, s.currency)}</td>
                        <td className={`p-4 font-bold ${s.profit_uah >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatUAH(s.profit_uah)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data?.sells?.length ? (
                    <tfoot className="bg-slate-900/80 font-bold border-t-2 border-slate-600">
                      {Object.entries(getCurrencyTotals(data.sells, ['commission', 'profit'])).map(([curr, totals], idx) => (
                        <tr key={curr} className={idx > 0 ? 'border-t border-slate-700/50' : ''}>
                          <td className="p-4 text-xs uppercase text-slate-500" colSpan={7}>Total {curr}</td>
                          <td className="p-4 text-rose-400">{formatCurrency(totals.commission, curr)}</td>
                          <td className={`p-4 ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totals.profit, curr)}</td>
                          <td className="p-4"></td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900 border-t-2 border-slate-600">
                        <td className="p-4 text-xs uppercase text-slate-400" colSpan={9}>Grand Total (UAH)</td>
                        <td className={`p-4 ${summary?.total_realized_profit_uah && summary.total_realized_profit_uah >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatUAH(summary?.total_realized_profit_uah || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                  {!data?.sells?.length && (<tbody><tr><td colSpan={10} className="p-8 text-center text-slate-500">No sales recorded.</td></tr></tbody>)}
                </table>
              </div>
            </div>

            {/* Dividends Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-700 bg-blue-900/20"><h2 className="font-bold text-lg text-blue-400">Dividends Received</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 bg-slate-900/50">
                    <tr><th className="p-4">Date</th><th className="p-4">Symbol</th><th className="p-4">Gross</th><th className="p-4">Withholding Tax</th><th className="p-4">Net</th><th className="p-4">Rate</th><th className="p-4">Net UAH</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {data?.dividends?.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 text-slate-400">{new Date(d.date).toLocaleDateString()}</td>
                        <td className="p-4 font-mono font-bold text-blue-300">{d.symbol}</td>
                        <td className="p-4">{formatCurrency(d.gross_amount || d.net_amount + d.tax, d.currency)}</td>
                        <td className="p-4 text-rose-400">{formatCurrency(d.tax, d.currency)}</td>
                        <td className="p-4 text-blue-400 font-bold">{formatCurrency(d.net_amount, d.currency)}</td>
                        <td className="p-4 text-slate-500">{d.currency_rate.toFixed(4)}</td>
                        <td className="p-4 text-blue-400 font-bold">{formatUAH(d.amount_uah)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data?.dividends?.length ? (
                    <tfoot className="bg-slate-900/80 font-bold border-t-2 border-slate-600">
                      {Object.entries(getCurrencyTotals(data.dividends, ['tax', 'net_amount'])).map(([curr, totals], idx) => (
                        <tr key={curr} className={idx > 0 ? 'border-t border-slate-700/50' : ''}>
                          <td className="p-4 text-xs uppercase text-slate-500" colSpan={3}>Total {curr}</td>
                          <td className="p-4 text-rose-400">{formatCurrency(totals.tax, curr)}</td>
                          <td className="p-4 text-blue-400 font-bold" colSpan={3}>{formatCurrency(totals.net_amount, curr)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900 border-t-2 border-slate-600">
                        <td className="p-4 text-xs uppercase text-slate-400" colSpan={6}>Grand Total (UAH)</td>
                        <td className="p-4 text-blue-400 font-bold">{formatUAH(summary?.total_dividends_uah || 0)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                  {!data?.dividends?.length && (<tbody><tr><td colSpan={7} className="p-8 text-center text-slate-500">No dividends recorded.</td></tr></tbody>)}
                </table>
              </div>
            </div>

            {/* Current Holdings */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-700 bg-slate-800/50"><h2 className="font-bold text-lg">Current Open Positions</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 bg-slate-900/50">
                    <tr><th className="p-4">Symbol</th><th className="p-4">Quantity</th><th className="p-4">Avg. Price</th><th className="p-4">Cost Basis</th><th className="p-4">Cost Basis UAH</th></tr>
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
                            <td className="p-4" colSpan={4}>TOTAL (UAH)</td>
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
    </div>
  );
};

export default App;
