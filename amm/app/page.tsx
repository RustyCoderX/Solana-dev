'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AutomatedMarketMaker,
  SwapQuote,
  LiquidityAddResult,
  Transaction,
  formatAmount,
  parseAmount,
  generateTransactionId,
} from '@/lib/amm';

// Token symbols for display
const TOKEN_A_SYMBOL = 'SOL';
const TOKEN_B_SYMBOL = 'USDC';
const DECIMALS = 6;

// Initialize AMM with some default reserves
const INITIAL_RESERVE_A = 1000000000n; // 1000 SOL
const INITIAL_RESERVE_B = 5000000000n; // 5000 USDC

export default function AMMPage() {
  // AMM instance
  const [amm, setAmm] = useState<AutomatedMarketMaker | null>(null);

  // UI State
  const [swapAmount, setSwapAmount] = useState('');
  const [liquidityA, setLiquidityA] = useState('');
  const [liquidityB, setLiquidityB] = useState('');
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity'>('swap');
  const [swapDirection, setSwapDirection] = useState<'AtoB' | 'BtoA'>('AtoB');

  // Transaction State
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Loading & Error State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Initialize AMM on mount
  useEffect(() => {
    const newAmm = new AutomatedMarketMaker(
      INITIAL_RESERVE_A,
      INITIAL_RESERVE_B
    );
    setAmm(newAmm);
  }, []);

  // Get current reserves
  const reserves = useMemo(() => {
    if (!amm) return { tokenA: 0n, tokenB: 0n };
    return amm.getReserves();
  }, [amm]);

  // Get spot prices
  const prices = useMemo(() => {
    if (!amm) return { priceA: 0, priceB: 0 };
    return {
      priceA: amm.getSpotPrice(true),
      priceB: amm.getSpotPrice(false),
    };
  }, [amm]);

  // Get current quote
  const currentQuote = useMemo((): SwapQuote | null => {
    if (!amm || !swapAmount) return null;

    try {
      const amount = parseAmount(swapAmount, DECIMALS);
      if (amount <= 0n) return null;

      return amm.getSwapQuote(amount, swapDirection === 'AtoB');
    } catch {
      return null;
    }
  }, [amm, swapAmount, swapDirection]);

  // Handle swap
  const handleSwap = useCallback(async () => {
    if (!amm || !swapAmount) return;

    setIsLoading(true);
    setError(null);

    try {
      const amount = parseAmount(swapAmount, DECIMALS);
      if (amount <= 0n) {
        throw new Error('Invalid amount');
      }

      const isTokenA = swapDirection === 'AtoB';
      const quote = amm.getSwapQuote(amount, isTokenA);

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = amm.swap(amount, isTokenA);

      // Add transaction to history
      const tx: Transaction = {
        id: generateTransactionId(),
        type: 'swap',
        inputToken: isTokenA ? TOKEN_A_SYMBOL : TOKEN_B_SYMBOL,
        outputToken: isTokenA ? TOKEN_B_SYMBOL : TOKEN_A_SYMBOL,
        inputAmount: amount,
        outputAmount: result.output,
        timestamp: new Date(),
        priceImpact: quote.priceImpact,
      };

      setTransactions((prev) => [tx, ...prev].slice(0, 10));
      setSwapAmount('');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setIsLoading(false);
    }
  }, [amm, swapAmount, swapDirection]);

  // Handle add liquidity
  const handleAddLiquidity = useCallback(async () => {
    if (!amm || !liquidityA || !liquidityB) return;

    setIsLoading(true);
    setError(null);

    try {
      const amountA = parseAmount(liquidityA, DECIMALS);
      const amountB = parseAmount(liquidityB, DECIMALS);

      if (amountA <= 0n || amountB <= 0n) {
        throw new Error('Invalid amounts');
      }

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = amm.addLiquidity(amountA, amountB);

      // Add transaction to history
      const tx: Transaction = {
        id: generateTransactionId(),
        type: 'add_liquidity',
        inputToken: TOKEN_A_SYMBOL,
        outputToken: TOKEN_B_SYMBOL,
        inputAmount: amountA,
        outputAmount: result.lpTokensMinted,
        timestamp: new Date(),
        priceImpact: 0,
      };

      setTransactions((prev) => [tx, ...prev].slice(0, 10));
      setLiquidityA('');
      setLiquidityB('');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add liquidity failed');
    } finally {
      setIsLoading(false);
    }
  }, [amm, liquidityA, liquidityB]);

  // Format helpers
  const formatDisplay = (amount: bigint) => formatAmount(amount, DECIMALS);

  if (!amm) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-100 rounded-3xl shadow-xl">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-2 flex items-center justify-center gap-3">
          <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#0ea5e9" /><path d="M8 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Solana AMM DEX
        </h1>
        <p className="text-lg text-slate-500 font-medium">
          Constant Product AMM (x × y = k)
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Main Card */}
        <section className="bg-white/90 rounded-3xl shadow-2xl border-2 border-primary-100 overflow-hidden">
          {/* Tabs */}
          <nav className="flex border-b border-slate-200 bg-gradient-to-r from-primary-50 to-green-50">
            <button
              onClick={() => setActiveTab('swap')}
              className={`flex-1 py-4 font-semibold text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                activeTab === 'swap'
                  ? 'bg-white text-primary-700 border-b-2 border-primary-600'
                  : 'text-slate-500 hover:text-primary-600'
              }`}
              aria-selected={activeTab === 'swap'}
              aria-controls="swap-panel"
            >
              <span className="inline-flex items-center gap-1">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 11l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Swap
              </span>
            </button>
            <button
              onClick={() => setActiveTab('liquidity')}
              className={`flex-1 py-4 font-semibold text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 ${
                activeTab === 'liquidity'
                  ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                  : 'text-slate-500 hover:text-green-600'
              }`}
              aria-selected={activeTab === 'liquidity'}
              aria-controls="liquidity-panel"
            >
              <span className="inline-flex items-center gap-1">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#22c55e" /><path d="M12 8v8m4-4H8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Add Liquidity
              </span>
            </button>
          </nav>

          <div className="p-8 md:p-10">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {activeTab === 'swap' ? (
              /* Swap Form */
              <form className="space-y-6" autoComplete="off" onSubmit={e => { e.preventDefault(); handleSwap(); }}>
                {/* Swap Direction Toggle */}
                <div className="flex items-center justify-center mb-4">
                  <button
                    type="button"
                    onClick={() => setSwapDirection(prev => prev === 'AtoB' ? 'BtoA' : 'AtoB')}
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    title="Swap direction"
                  >
                    <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* From Token */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <label className="block text-sm font-medium text-slate-600 mb-2" htmlFor="swap-from">
                    From
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-slate-800">
                      {swapDirection === 'AtoB' ? TOKEN_A_SYMBOL : TOKEN_B_SYMBOL}
                    </span>
                    <input
                      id="swap-from"
                      type="number"
                      value={swapAmount}
                      onChange={e => setSwapAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 text-2xl font-semibold bg-transparent outline-none placeholder:text-slate-300 text-slate-800 focus:ring-2 focus:ring-primary-200 rounded-lg px-2"
                      min="0"
                      step="any"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* To Token (Output Preview) */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    To (Estimated)
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-slate-800">
                      {swapDirection === 'AtoB' ? TOKEN_B_SYMBOL : TOKEN_A_SYMBOL}
                    </span>
                    <span className="text-2xl font-semibold text-slate-800">
                      {currentQuote ? formatDisplay(currentQuote.outputAmount) : '0.00'}
                    </span>
                  </div>
                </div>

                {/* Quote Details */}
                {currentQuote && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rate</span>
                      <span className="text-slate-700">
                        1 {swapDirection === 'AtoB' ? TOKEN_A_SYMBOL : TOKEN_B_SYMBOL} ={' '}
                        {(Number(currentQuote.outputAmount) / Number(currentQuote.inputAmount)).toFixed(4)}{' '}
                        {swapDirection === 'AtoB' ? TOKEN_B_SYMBOL : TOKEN_A_SYMBOL}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Price Impact</span>
                      <span className={currentQuote.priceImpact > 0 ? 'text-green-600' : 'text-red-600'}>
                        {(currentQuote.priceImpact * 100).toFixed(3)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fee (0.3%)</span>
                      <span className="text-slate-700">
                        {formatDisplay(currentQuote.fee)}{' '}
                        {swapDirection === 'AtoB' ? TOKEN_A_SYMBOL : TOKEN_B_SYMBOL}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Slippage Tolerance</span>
                      <span className="text-slate-700">
                        {(currentQuote.slippage * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Swap Button */}
                <button
                  type="submit"
                  disabled={!swapAmount || isLoading || !currentQuote}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Swapping...
                    </>
                  ) : (
                    'Swap'
                  )}
                </button>
              </form>
            ) : (
              /* Liquidity Form */
              <form className="space-y-6" autoComplete="off" onSubmit={e => { e.preventDefault(); handleAddLiquidity(); }}>
                {/* Token A Input */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <label className="block text-sm font-medium text-slate-600 mb-2" htmlFor="liquidity-a">
                    {TOKEN_A_SYMBOL} Amount
                  </label>
                  <input
                    id="liquidity-a"
                    type="number"
                    value={liquidityA}
                    onChange={e => setLiquidityA(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xl font-semibold bg-transparent outline-none placeholder:text-slate-300 text-slate-800 focus:ring-2 focus:ring-green-200 rounded-lg px-2"
                    min="0"
                    step="any"
                    autoComplete="off"
                  />
                </div>

                {/* Token B Input */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <label className="block text-sm font-medium text-slate-600 mb-2" htmlFor="liquidity-b">
                    {TOKEN_B_SYMBOL} Amount
                  </label>
                  <input
                    id="liquidity-b"
                    type="number"
                    value={liquidityB}
                    onChange={e => setLiquidityB(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xl font-semibold bg-transparent outline-none placeholder:text-slate-300 text-slate-800 focus:ring-2 focus:ring-green-200 rounded-lg px-2"
                    min="0"
                    step="any"
                    autoComplete="off"
                  />
                </div>

                {/* Current Pool Ratio */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pool Ratio</span>
                    <span className="text-slate-700">
                      1 {TOKEN_A_SYMBOL} ={' '}
                      {(Number(reserves.tokenB) / Number(reserves.tokenA)).toFixed(4)}{' '}
                      {TOKEN_B_SYMBOL}
                    </span>
                  </div>
                </div>

                {/* Add Liquidity Button */}
                <button
                  type="submit"
                  disabled={!liquidityA || !liquidityB || isLoading}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Adding Liquidity...
                    </>
                  ) : (
                    'Add Liquidity'
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Info Panel */}
        <aside className="space-y-8">
          {/* Pool Reserves */}
          <div className="bg-slate-50 rounded-2xl shadow-xl border-l-4 border-primary-400 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="#38bdf8" /><path d="M8 12h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
              Pool Reserves
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">{TOKEN_A_SYMBOL}</span>
                <span className="font-semibold text-slate-900 text-lg">
                  {formatDisplay(reserves.tokenA)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">{TOKEN_B_SYMBOL}</span>
                <span className="font-semibold text-slate-900 text-lg">
                  {formatDisplay(reserves.tokenB)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600 font-medium">Constant (k)</span>
                <span className="font-semibold text-slate-900 text-lg">
                  {formatDisplay(amm.getK())}
                </span>
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="bg-white rounded-2xl shadow-xl border-l-4 border-indigo-400 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#6366f1" /><path d="M8 12h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
              Current Prices
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">{TOKEN_A_SYMBOL} Price</span>
                <span className="font-semibold text-slate-900 text-lg">
                  {prices.priceA.toFixed(6)} {TOKEN_B_SYMBOL}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600 font-medium">{TOKEN_B_SYMBOL} Price</span>
                <span className="font-semibold text-slate-900 text-lg">
                  {prices.priceB.toFixed(6)} {TOKEN_A_SYMBOL}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-slate-100 rounded-2xl shadow-xl border-l-4 border-green-400 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="#22c55e" /><path d="M12 8v8m4-4H8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
              Transaction History
            </h2>
            {transactions.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg text-sm border border-slate-100"
                  >
                    <div>
                      <span
                        className={`font-medium ${
                          tx.type === 'swap' ? 'text-primary-700' : 'text-green-700'
                        }`}
                      >
                        {tx.type === 'swap' ? 'Swap' : 'Add Liquidity'}
                      </span>
                      <span className="text-slate-500 ml-2">
                        {tx.inputToken} → {tx.outputToken}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {formatDisplay(tx.inputAmount)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {tx.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last Updated */}
          <div className="text-center text-sm text-slate-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </aside>
      </div>
    </div>
  );
}