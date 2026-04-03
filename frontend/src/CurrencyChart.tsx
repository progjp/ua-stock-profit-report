import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Loader2, TrendingUp, Calendar, Filter, CheckSquare, Square, ChevronDown, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

interface Rate {
  currency: string;
  date: string;
  rate: number;
}

interface ChartData {
  date: string;
  displayDate: string;
  [key: string]: string | number | undefined;
}

interface CurrencyChartProps {
  initialFromDate?: string;
  initialToDate?: string;
  title?: string;
  isDark?: boolean;
}

const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', color: '#3b82f6' },
  { code: 'EUR', name: 'Euro', color: '#10b981' },
  { code: 'GBP', name: 'British Pound', color: '#f59e0b' },
  { code: 'PLN', name: 'Polish Zloty', color: '#ec4899' },
  { code: 'CHF', name: 'Swiss Franc', color: '#8b5cf6' },
  { code: 'CAD', name: 'Canadian Dollar', color: '#06b6d4' },
  { code: 'AUD', name: 'Australian Dollar', color: '#84cc16' },
  { code: 'JPY', name: 'Japanese Yen', color: '#ef4444' },
];

export const CurrencyChart: React.FC<CurrencyChartProps> = ({ 
  initialFromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
  initialToDate = new Date().toISOString().split('T')[0], 
  title = "Market Trends",
  isDark = true
}) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['USD', 'EUR']);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const pickerRef = useRef<HTMLDivElement>(null);
  const idPrefix = useMemo(() => Math.random().toString(36).substr(2, 9), []);

  useEffect(() => {
    if (initialFromDate) setFromDate(initialFromDate);
    if (initialToDate) setToDate(initialToDate);
  }, [initialFromDate, initialToDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchRates = async () => {
      if (selectedCurrencies.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/rates`, {
          params: { from: fromDate, to: toDate, currency: selectedCurrencies }
        });
        
        if (!isMounted) return;

        const rates: Rate[] = res.data;
        const grouped = rates.reduce((acc, curr) => {
          const dateKey = curr.date.split('T')[0];
          if (!acc[dateKey]) {
            acc[dateKey] = { 
              date: dateKey, 
              displayDate: new Date(curr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
            };
          }
          acc[dateKey][curr.currency] = curr.rate;
          return acc;
        }, {} as Record<string, ChartData>);

        const sortedData = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
        setData(sortedData);
      } catch (err) {
        console.error('Error fetching rates', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRates();
    return () => { isMounted = false; };
  }, [fromDate, toDate, selectedCurrencies]);

  const toggleCurrency = (code: string) => {
    setSelectedCurrencies(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const filteredCurrencies = SUPPORTED_CURRENCIES.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const inputBg = isDark ? "bg-slate-900" : "bg-slate-50";
  const inputBorder = isDark ? "border-slate-700" : "border-slate-200";

  return (
    <div className={`p-6 rounded-2xl border shadow-2xl transition-all duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <TrendingUp className="text-blue-400" size={20} />
            {title}
          </h3>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Currency Picker Toggle */}
            <div className="relative" ref={pickerRef}>
              <button 
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${inputBorder} ${inputBg} hover:border-blue-500/50 transition-all shadow-sm`}
              >
                <Filter size={14} className="text-blue-400" />
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {selectedCurrencies.length} Currencies
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPickerOpen && (
                <div className={`absolute top-full right-0 mt-2 w-64 z-[110] rounded-2xl shadow-2xl border ${tooltipBorder} ${tooltipBg} animate-in fade-in zoom-in-95 duration-200`}>
                  <div className="p-4 border-b border-black/5 dark:border-white/5">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="text"
                        placeholder="Search currencies..."
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border ${inputBorder} ${inputBg} outline-none focus:ring-2 focus:ring-blue-500`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {filteredCurrencies.map(c => (
                      <button
                        key={c.code}
                        onClick={() => toggleCurrency(c.code)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${selectedCurrencies.includes(c.code) ? 'bg-blue-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></div>
                          <div className="text-left">
                            <p className={`text-xs font-black tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{c.code}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{c.name}</p>
                          </div>
                        </div>
                        {selectedCurrencies.includes(c.code) ? 
                          <CheckSquare size={18} className="text-blue-500" /> : 
                          <Square size={18} className="text-slate-300 dark:text-slate-600" />
                        }
                      </button>
                    ))}
                  </div>
                  {selectedCurrencies.length > 0 && (
                    <div className="p-2 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 rounded-b-2xl">
                      <button 
                        onClick={() => setSelectedCurrencies([])}
                        className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date Inputs */}
            <div className={`flex items-center gap-2 ${inputBg} ${inputBorder} border rounded-xl p-1.5`}>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar size={14} className="text-slate-500" />
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`bg-transparent outline-none text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'} cursor-pointer`}
                />
              </div>
              <div className="w-px h-4 bg-slate-700/50"></div>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={`bg-transparent outline-none text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'} px-2 cursor-pointer`}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[300px] gap-3">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Synchronizing...</span>
        </div>
      ) : data.length === 0 ? (
        <div className={`flex flex-col items-center justify-center h-[300px] rounded-xl border border-dashed ${isDark ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
          <Filter size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Select Currencies</p>
          <p className="text-xs mt-2 opacity-60">Pick one or more currencies to see trends.</p>
        </div>
      ) : (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {SUPPORTED_CURRENCIES.map(c => (
                  <linearGradient key={c.code} id={`${c.code}-${idPrefix}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c.color} stopOpacity={isDark ? 0.4 : 0.2}/>
                    <stop offset="95%" stopColor={c.color} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} strokeOpacity={0.5} />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: textColor, fontSize: 10, fontWeight: 700 }}
                minTickGap={40}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: textColor, fontSize: 10, fontWeight: 700 }}
                orientation="right"
                tickFormatter={(val) => val.toFixed(2)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: tooltipBg,
                  borderRadius: '16px', 
                  border: `1px solid ${tooltipBorder}`, 
                  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                  padding: '16px',
                  backdropFilter: 'blur(8px)'
                }}
                itemStyle={{ fontSize: '12px', fontWeight: '900', padding: '2px 0' }}
                labelStyle={{ 
                  marginBottom: '12px', 
                  borderBottom: `1px solid ${tooltipBorder}`, 
                  paddingBottom: '8px', 
                  fontSize: '10px', 
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: isDark ? '#64748b' : '#94a3b8'
                }}
                formatter={(value: any) => [value ? `${Number(value).toFixed(4)} ₴` : 'N/A', ""]}
              />
              {SUPPORTED_CURRENCIES.map(c => selectedCurrencies.includes(c.code) && (
                <Area 
                  key={c.code}
                  type="monotone" 
                  dataKey={c.code} 
                  stroke={c.color} 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill={`url(#${c.code}-${idPrefix})`} 
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: c.color }}
                  animationDuration={1000}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
