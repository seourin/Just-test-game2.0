/**
 * Linear Congruential Generator (선형 합동법, LCG)
 * Formula: X_{n+1} = (a * X_n + c) mod m
 *
 * Implemented using BigInt to avoid 32/53-bit floating point precision loss
 * for standard 32-bit and 48-bit game PRNG implementations.
 */

export interface LcgPreset {
  id: string;
  name: string;
  koreanName: string;
  description: string;
  m: bigint;
  a: bigint;
  c: bigint;
  defaultSeed: bigint;
}

export const LCG_PRESETS: LcgPreset[] = [
  {
    id: 'ansi_c',
    name: 'ANSI C / Numerical Recipes',
    koreanName: '표준 ANSI C (Numerical Recipes)',
    description: '가장 널리 알려진 32비트 LCG. 주기가 2^31(약 21억)으로 안정적입니다.',
    m: 2147483648n, // 2^31
    a: 1664525n,
    c: 1013904223n,
    defaultSeed: 123456789n,
  },
  {
    id: 'java_random',
    name: 'Java java.util.Random',
    koreanName: '자바 48비트 LCG (java.util.Random)',
    description: 'Java의 표준 Random 클래스 공식 (m = 2^48, a = 25214903917, c = 11)',
    m: 281474976710656n, // 2^48
    a: 25214903917n,
    c: 11n,
    defaultSeed: 88412039158n,
  },
  {
    id: 'msvc',
    name: 'MSVC rand()',
    koreanName: '마이크로소프트 C++ (MSVC rand)',
    description: '고전 PC 게임과 콘솔에서 자주 사용된 공식. (X >> 16) & 0x7FFF로 추출',
    m: 4294967296n, // 2^32
    a: 214013n,
    c: 2531011n,
    defaultSeed: 42n,
  },
  {
    id: 'zx_spectrum',
    name: 'ZX Spectrum / Lehmer',
    koreanName: '레머 고전 난수 (ZX Spectrum)',
    description: '상수 c=0인 곱셈 합동법(Lehmer PRNG). m = 65537 (소수), a = 75',
    m: 65537n,
    a: 75n,
    c: 0n,
    defaultSeed: 1047n,
  },
  {
    id: 'flawed_toy',
    name: 'Flawed LCG (결함/취약 LCG)',
    koreanName: '고의적 결함 LCG (주기 파탄 체험용)',
    description: '조건을 위반하여 주기가 단 16번에 불과해 게임 패턴이 즉시 반복되는 취약점 모델',
    m: 256n,
    a: 9n,
    c: 4n,
    defaultSeed: 7n,
  },
  {
    id: 'randu',
    name: 'Infamous RANDU (악명 높은 RANDU)',
    koreanName: '악명 높은 RANDU (격자 결함 모델)',
    description: '1960년대 IBM 메인프레임의 결함 난수. 3D 공간에 단 15개의 평면 격자만 생성되는 치명적 한계',
    m: 2147483648n, // 2^31
    a: 65539n,
    c: 0n,
    defaultSeed: 1n,
  },
];

export interface LcgStepResult {
  step: number;
  prevSeed: bigint;
  nextSeed: bigint;
  normalized: number; // 0.0 <= x < 1.0
  formulaStr: string;
}

export interface HullDobellAnalysis {
  isFullPeriod: boolean;
  gcd_c_m: bigint;
  gcd_c_m_passed: boolean;
  primeDivisorsPassed: boolean;
  primeDivisorsDetail: string;
  mod4Passed: boolean;
  mod4Detail: string;
  summary: string;
}

export class LinearCongruentialGenerator {
  public m: bigint;
  public a: bigint;
  public c: bigint;
  public currentSeed: bigint;
  public initialSeed: bigint;
  public stepCount: number;

  constructor(
    m: bigint = 2147483648n,
    a: bigint = 1664525n,
    c: bigint = 1013904223n,
    initialSeed: bigint = 123456789n
  ) {
    this.m = m > 0n ? m : 2147483648n;
    this.a = a;
    this.c = c;
    this.initialSeed = initialSeed % this.m;
    this.currentSeed = this.initialSeed;
    this.stepCount = 0;
  }

  public setSeed(newSeed: bigint) {
    this.initialSeed = ((newSeed % this.m) + this.m) % this.m;
    this.currentSeed = this.initialSeed;
    this.stepCount = 0;
  }

  public reset() {
    this.currentSeed = this.initialSeed;
    this.stepCount = 0;
  }

  public setParameters(m: bigint, a: bigint, c: bigint, seed?: bigint) {
    this.m = m > 0n ? m : 2147483648n;
    this.a = a;
    this.c = c;
    if (seed !== undefined) {
      this.setSeed(seed);
    } else {
      this.currentSeed = this.currentSeed % this.m;
    }
  }

  /**
   * Advance one step: X_{n+1} = (a * X_n + c) mod m
   */
  public next(): LcgStepResult {
    const prev = this.currentSeed;
    const nextSeed = ((this.a * prev + this.c) % this.m + this.m) % this.m;
    this.currentSeed = nextSeed;
    this.stepCount++;

    const normalized = Number(nextSeed) / Number(this.m);

    const formulaStr = `(${this.a} × ${prev} + ${this.c}) mod ${this.m} = ${nextSeed}`;

    return {
      step: this.stepCount,
      prevSeed: prev,
      nextSeed,
      normalized,
      formulaStr,
    };
  }

  /**
   * Generates a random float in range [0, 1)
   */
  public nextFloat(): number {
    return this.next().normalized;
  }

  /**
   * Generates an integer in range [min, max] inclusive
   */
  public nextInt(min: number, max: number): number {
    const u = this.nextFloat();
    return Math.floor(u * (max - min + 1)) + min;
  }

  /**
   * Peek next K values without changing internal state
   * (Essential for RNG manipulation simulation)
   */
  public peek(count: number): LcgStepResult[] {
    const results: LcgStepResult[] = [];
    let tempSeed = this.currentSeed;

    for (let i = 1; i <= count; i++) {
      const nextSeed = ((this.a * tempSeed + this.c) % this.m + this.m) % this.m;
      const normalized = Number(nextSeed) / Number(this.m);
      const formulaStr = `(${this.a} × ${tempSeed} + ${this.c}) mod ${this.m} = ${nextSeed}`;
      results.push({
        step: this.stepCount + i,
        prevSeed: tempSeed,
        nextSeed,
        normalized,
        formulaStr,
      });
      tempSeed = nextSeed;
    }

    return results;
  }

  /**
   * Validates Hull-Dobell Theorem:
   * An LCG has a full period of length m for all seeds if and only if:
   * 1. gcd(c, m) = 1 (c and m are coprime)
   * 2. Every prime factor of m divides (a - 1)
   * 3. If m is divisible by 4, then (a - 1) is divisible by 4.
   */
  public checkHullDobell(): HullDobellAnalysis {
    const gcd = (x: bigint, y: bigint): bigint => {
      let a = x < 0n ? -x : x;
      let b = y < 0n ? -y : y;
      while (b > 0n) {
        const t = b;
        b = a % b;
        a = t;
      }
      return a;
    };

    // 1. Condition: gcd(c, m) === 1
    const gcd_c_m = gcd(this.c, this.m);
    const gcd_c_m_passed = gcd_c_m === 1n;

    // 2. Condition: Every prime factor of m divides (a - 1)
    const aMinus1 = this.a - 1n;
    const primeFactors = getPrimeFactors(this.m);
    let primeDivisorsPassed = true;
    const failedPrimes: bigint[] = [];

    for (const p of primeFactors) {
      if (aMinus1 % p !== 0n) {
        primeDivisorsPassed = false;
        failedPrimes.push(p);
      }
    }

    const primeDivisorsDetail =
      primeFactors.length === 0
        ? 'm의 소인수를 계산할 수 없음'
        : primeDivisorsPassed
        ? `모든 소인수 [${primeFactors.join(', ')}]가 (a - 1)인 ${aMinus1}을 나누어 떨어뜨림`
        : `소인수 [${failedPrimes.join(', ')}]가 (a - 1)=${aMinus1}을 나누어 떨어뜨리지 못함`;

    // 3. Condition: If 4 divides m, then 4 divides (a - 1)
    let mod4Passed = true;
    let mod4Detail = 'm이 4의 배수가 아니므로 조건 자동 충족';
    if (this.m % 4n === 0n) {
      if (aMinus1 % 4n === 0n) {
        mod4Passed = true;
        mod4Detail = `m과 (a - 1)=${aMinus1} 모두 4의 배수임`;
      } else {
        mod4Passed = false;
        mod4Detail = `m은 4의 배수이나, (a - 1)=${aMinus1}은 4의 배수가 아님`;
      }
    }

    const isFullPeriod = gcd_c_m_passed && primeDivisorsPassed && mod4Passed;

    let summary = '';
    if (isFullPeriod) {
      summary = `훌-도벨 정리(Hull-Dobell Theorem) 만족: 이 LCG는 모든 시드에 대해 최대 주기(${this.m.toString()})를 가집니다.`;
    } else {
      const reasons: string[] = [];
      if (!gcd_c_m_passed) reasons.push('gcd(c, m) ≠ 1');
      if (!primeDivisorsPassed) reasons.push('m의 소인수가 (a-1)을 나누지 못함');
      if (!mod4Passed) reasons.push('m이 4의 배수이나 (a-1)이 4의 배수가 아님');
      summary = `훌-도벨 정리 불만족 (${reasons.join(', ')}): 주기가 m보다 훨씬 짧아 주기 파탄 또는 루프 발생 위험이 있습니다.`;
    }

    return {
      isFullPeriod,
      gcd_c_m,
      gcd_c_m_passed,
      primeDivisorsPassed,
      primeDivisorsDetail,
      mod4Passed,
      mod4Detail,
      summary,
    };
  }

  /**
   * Measures empirical period up to a safe search limit
   */
  public findEmpiricalPeriod(maxLimit: number = 200000): { period: number; full: boolean } {
    let tortoise = ((this.a * this.initialSeed + this.c) % this.m + this.m) % this.m;
    let hare = ((this.a * ((this.a * this.initialSeed + this.c) % this.m) + this.c) % this.m + this.m) % this.m;

    let steps = 0;
    while (tortoise !== hare && steps < maxLimit) {
      tortoise = ((this.a * tortoise + this.c) % this.m + this.m) % this.m;
      const h1 = ((this.a * hare + this.c) % this.m + this.m) % this.m;
      hare = ((this.a * h1 + this.c) % this.m + this.m) % this.m;
      steps++;
    }

    if (tortoise !== hare) {
      return { period: maxLimit, full: false };
    }

    // Measure cycle length
    let period = 1;
    let ptr = ((this.a * tortoise + this.c) % this.m + this.m) % this.m;
    while (ptr !== tortoise && period < maxLimit) {
      ptr = ((this.a * ptr + this.c) % this.m + this.m) % this.m;
      period++;
    }

    const full = BigInt(period) >= this.m;
    return { period, full };
  }
}

/**
 * Prime factor extraction helper for small to moderate BigInts
 */
function getPrimeFactors(val: bigint): bigint[] {
  const factors: Set<bigint> = new Set();
  let n = val < 0n ? -val : val;

  if (n <= 1n) return [];

  // Check 2
  if (n % 2n === 0n) {
    factors.add(2n);
    while (n % 2n === 0n) n /= 2n;
  }

  // Check odd factors up to min(sqrt(n), 100000n)
  let d = 3n;
  const limit = 100000n;
  while (d * d <= n && d <= limit) {
    if (n % d === 0n) {
      factors.add(d);
      while (n % d === 0n) n /= d;
    }
    d += 2n;
  }

  if (n > 1n) {
    factors.add(n);
  }

  return Array.from(factors);
}
