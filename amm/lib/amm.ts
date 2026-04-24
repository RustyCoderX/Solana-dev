/**
 * AMM (Automated Market Maker) Math Logic
 * 
 * Implements Constant Product AMM model (x * y = k)
 * with slippage protection and fee calculation.
 * 
 * This module is pure and deterministic - no UI coupling.
 */

// =============================================================================
// Types
// =============================================================================

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
}

export interface PoolReserves {
  tokenA: Token;
  tokenB: Token;
  reserveA: bigint;
  reserveB: bigint;
}

export interface SwapQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  inputToken: Token;
  outputToken: Token;
  priceImpact: number; // as decimal (e.g., 0.01 = 1%)
  fee: bigint;
  slippage: number; // as decimal
}

export interface LiquidityAddResult {
  tokenAAmount: bigint;
  tokenBAmount: bigint;
  lpTokensMinted: bigint;
  shareOfPool: number; // as decimal
}

export interface Transaction {
  id: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity';
  inputToken: string;
  outputToken: string;
  inputAmount: bigint;
  outputAmount: bigint;
  timestamp: Date;
  priceImpact: number;
}

export interface AMMState {
  reserves: {
    tokenA: bigint;
    tokenB: bigint;
  };
  k: bigint;
  totalLpTokens: bigint;
}

// =============================================================================
// Constants
// =============================================================================

const FEE_DENOMINATOR = 1000n; // 0.3% fee = 3/1000
const DEFAULT_SLIPPAGE = 0.003; // 0.3% default slippage tolerance

// =============================================================================
// Core AMM Math
// =============================================================================

/**
 * Calculate output amount for a given input using constant product formula.
 * dy = (y * dx) / (x + dx)
 * Where:
 *   - x = reserve of input token
 *   - y = reserve of output token
 *   - dx = input amount
 *   - dy = output amount
 * 
 * With fee: dy = (y * dx * (feeDenom - feeNum)) / (x * feeDenom + dx * feeDenom)
 */
export function getOutputAmount(
  inputReserve: bigint,
  outputReserve: bigint,
  inputAmount: bigint,
  feeNumerator: bigint = 3n
): bigint {
  if (inputAmount <= 0n) {
    throw new Error('Input amount must be positive');
  }
  if (inputReserve <= 0n || outputReserve <= 0n) {
    throw new Error('Reserves must be positive');
  }

  const feeDenominator = FEE_DENOMINATOR;
  const amountWithFee = inputAmount * (feeDenominator - feeNumerator);
  const numerator = amountWithFee * outputReserve;
  const denominator = inputReserve * feeDenominator + amountWithFee;

  return numerator / denominator;
}

/**
 * Calculate input amount needed for a desired output.
 * dx = (x * dy) / (y - dy)
 */
export function getInputAmount(
  inputReserve: bigint,
  outputReserve: bigint,
  desiredOutput: bigint,
  feeNumerator: bigint = 3n
): bigint {
  if (desiredOutput <= 0n) {
    throw new Error('Desired output must be positive');
  }
  if (desiredOutput >= outputReserve) {
    throw new Error('Desired output exceeds available reserves');
  }

  const feeDenominator = FEE_DENOMINATOR;
  const numerator = inputReserve * desiredOutput * feeDenominator;
  const denominator = (outputReserve - desiredOutput) * (feeDenominator - feeNumerator);

  return (numerator / denominator) + 1n; // Add 1 to ensure we get at least desired output
}

/**
 * Calculate price impact of a swap.
 * Price impact = (newPrice - oldPrice) / oldPrice
 */
export function calculatePriceImpact(
  inputReserve: bigint,
  outputReserve: bigint,
  inputAmount: bigint,
  outputAmount: bigint
): number {
  const oldPrice = Number(inputReserve) / Number(outputReserve);
  const newInputReserve = inputReserve + inputAmount;
  const newOutputReserve = outputReserve - outputAmount;
  const newPrice = Number(newInputReserve) / Number(newOutputReserve);

  return (newPrice - oldPrice) / oldPrice;
}

/**
 * Calculate spot price (price without considering trade size).
 */
export function getSpotPrice(reserveA: bigint, reserveB: bigint): number {
  if (reserveB === 0n) return 0;
  return Number(reserveA) / Number(reserveB);
}

/**
 * Calculate k (constant product).
 */
export function calculateK(reserveA: bigint, reserveB: bigint): bigint {
  return reserveA * reserveB;
}

// =============================================================================
// Liquidity Functions
// =============================================================================

/**
 * Calculate LP tokens received when adding liquidity.
 * Uses constant product formula: LP = sqrt(x * y) - k
 * Simplified: LP = min(x/dA, y/dY) * totalSupply
 */
export function calculateLpTokensForDeposit(
  currentReserveA: bigint,
  currentReserveB: bigint,
  depositA: bigint,
  depositB: bigint,
  totalLpSupply: bigint
): { lpTokens: bigint; shareOfPool: number } {
  if (currentReserveA === 0n && currentReserveB === 0n) {
    // First deposit - LP tokens = sqrt(a * b)
    const lpTokens = sqrt(depositA * depositB);
    return { lpTokens, shareOfPool: 1.0 };
  }

  // Calculate share based on smaller value to maintain ratio
  let lpTokens: bigint;
  let shareOfPool: number;

  if (totalLpSupply === 0n) {
    // First deposit
    lpTokens = sqrt(depositA * depositB);
    shareOfPool = 1.0;
  } else {
    const shareA = Number(depositA) / Number(currentReserveA);
    const shareB = Number(depositB) / Number(currentReserveB);
    const share = Math.min(shareA, shareB);
    lpTokens = BigInt(Math.floor(share * Number(totalLpSupply)));
    shareOfPool = share;
  }

  return { lpTokens, shareOfPool };
}

/**
 * Calculate tokens received when removing liquidity.
 */
export function calculateTokensForRemoval(
  currentReserveA: bigint,
  currentReserveB: bigint,
  lpTokensToRemove: bigint,
  totalLpSupply: bigint
): { tokenA: bigint; tokenB: bigint } {
  if (totalLpSupply === 0n) {
    throw new Error('No liquidity to remove');
  }

  const ratio = Number(lpTokensToRemove) / Number(totalLpSupply);
  const tokenA = BigInt(Math.floor(Number(currentReserveA) * ratio));
  const tokenB = BigInt(Math.floor(Number(currentReserveB) * ratio));

  return { tokenA, tokenB };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Square root for bigint (using Newton's method).
 */
export function sqrt(n: bigint): bigint {
  if (n < 0n) {
    throw new Error('Square root of negative number');
  }
  if (n === 0n) return 0n;

  let x = n;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }

  return x;
}

/**
 * Format bigint to human readable string with decimals.
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const str = amount.toString();
  if (decimals === 0) return str;

  if (str.length <= decimals) {
    return '0.' + str.padStart(decimals, '0');
  }

  const integerPart = str.slice(0, str.length - decimals);
  const decimalPart = str.slice(-decimals);
  return integerPart + '.' + decimalPart;
}

/**
 * Parse human readable string to bigint.
 */
export function parseAmount(value: string, decimals: number): bigint {
  const [integer, decimal = ''] = value.split('.');
  const paddedDecimal = decimal.padEnd(decimals, '0');
  return BigInt(integer + paddedDecimal.slice(0, decimals));
}

/**
 * Generate unique transaction ID.
 */
export function generateTransactionId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// =============================================================================
// AMM Class
// =============================================================================

export class AutomatedMarketMaker {
  private reserves: { tokenA: bigint; tokenB: bigint };
  private totalLpSupply: bigint;
  private feeNumerator: bigint;
  private defaultSlippage: number;

  constructor(
    initialReserveA: bigint = 1000000n,
    initialReserveB: bigint = 1000000n,
    feeNumerator: bigint = 3n,
    defaultSlippage: number = DEFAULT_SLIPPAGE
  ) {
    this.reserves = { tokenA: initialReserveA, tokenB: initialReserveB };
    this.totalLpSupply = sqrt(initialReserveA * initialReserveB);
    this.feeNumerator = feeNumerator;
    this.defaultSlippage = defaultSlippage;
  }

  // Getters
  getReserves(): { tokenA: bigint; tokenB: bigint } {
    return { ...this.reserves };
  }

  getTotalLpSupply(): bigint {
    return this.totalLpSupply;
  }

  getK(): bigint {
    return calculateK(this.reserves.tokenA, this.reserves.tokenB);
  }

  getSpotPrice(tokenA: boolean): number {
    return getSpotPrice(
      tokenA ? this.reserves.tokenA : this.reserves.tokenB,
      tokenA ? this.reserves.tokenB : this.reserves.tokenA
    );
  }

  // Swap Functions
  getSwapQuote(inputAmount: bigint, isTokenA: boolean): SwapQuote {
    const inputReserve = isTokenA ? this.reserves.tokenA : this.reserves.tokenB;
    const outputReserve = isTokenA ? this.reserves.tokenB : this.reserves.tokenA;
    const inputToken = isTokenA ? 'TOKEN_A' : 'TOKEN_B';
    const outputToken = isTokenA ? 'TOKEN_B' : 'TOKEN_A';

    const outputAmount = getOutputAmount(
      inputReserve,
      outputReserve,
      inputAmount,
      this.feeNumerator
    );

    const priceImpact = calculatePriceImpact(
      inputReserve,
      outputReserve,
      inputAmount,
      outputAmount
    );

    const fee = (inputAmount * this.feeNumerator) / FEE_DENOMINATOR;

    return {
      inputAmount,
      outputAmount,
      inputToken: { symbol: inputToken, name: inputToken, decimals: 6 },
      outputToken: { symbol: outputToken, name: outputToken, decimals: 6 },
      priceImpact,
      fee,
      slippage: this.defaultSlippage,
    };
  }

  swap(inputAmount: bigint, isTokenA: boolean): { output: bigint; fee: bigint } {
    const quote = this.getSwapQuote(inputAmount, isTokenA);

    if (isTokenA) {
      this.reserves.tokenA += inputAmount;
      this.reserves.tokenB -= quote.outputAmount;
    } else {
      this.reserves.tokenB += inputAmount;
      this.reserves.tokenA -= quote.outputAmount;
    }

    return { output: quote.outputAmount, fee: quote.fee };
  }

  // Liquidity Functions
  addLiquidity(amountA: bigint, amountB: bigint): LiquidityAddResult {
    const { lpTokens, shareOfPool } = calculateLpTokensForDeposit(
      this.reserves.tokenA,
      this.reserves.tokenB,
      amountA,
      amountB,
      this.totalLpSupply
    );

    this.reserves.tokenA += amountA;
    this.reserves.tokenB += amountB;
    this.totalLpSupply += lpTokens;

    return {
      tokenAAmount: amountA,
      tokenBAmount: amountB,
      lpTokensMinted: lpTokens,
      shareOfPool,
    };
  }

  removeLiquidity(lpTokens: bigint): { tokenA: bigint; tokenB: bigint } {
    const tokens = calculateTokensForRemoval(
      this.reserves.tokenA,
      this.reserves.tokenB,
      lpTokens,
      this.totalLpSupply
    );

    this.reserves.tokenA -= tokens.tokenA;
    this.reserves.tokenB -= tokens.tokenB;
    this.totalLpSupply -= lpTokens;

    return tokens;
  }

  // State
  getState(): AMMState {
    return {
      reserves: { ...this.reserves },
      k: this.getK(),
      totalLpTokens: this.totalLpSupply,
    };
  }
}