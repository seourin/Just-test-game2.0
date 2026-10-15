/**
 * Mersenne Twister 19937 (MT19937) Generator
 * Period: 2^19937 - 1 (Approx 4.3154 × 10^6001)
 *
 * Implements the 32-bit standard MT19937 algorithm by Makoto Matsumoto & Takuji Nishimura.
 * Equidistributed in 623 dimensions with excellent statistical properties for modern game loot & gacha.
 */

export interface Mt19937StepResult {
  step: number;
  stateIndex: number;
  rawWord: number;
  temperedWord: number;
  temperingStages: {
    stage1: number; // y ^ (y >> 11)
    stage2: number; // y ^ ((y << 7) & 0x9D2C5680)
    stage3: number; // y ^ ((y << 15) & 0xEFC60000)
    stage4: number; // y ^ (y >> 18)
  };
  normalized: number; // 0.0 <= u < 1.0
  isTwistOccurred: boolean;
}

export class MersenneTwister {
  private static readonly N = 624;
  private static readonly M = 397;
  private static readonly MATRIX_A = 0x9908b0df >>> 0;
  private static readonly UPPER_MASK = 0x80000000 >>> 0;
  private static readonly LOWER_MASK = 0x7fffffff >>> 0;

  // Tempering masks
  private static readonly TEMPERING_MASK_B = 0x9d2c5680 >>> 0;
  private static readonly TEMPERING_MASK_C = 0xefc60000 >>> 0;

  private mt: Uint32Array = new Uint32Array(MersenneTwister.N);
  private mti: number = MersenneTwister.N + 1; // Uninitialized
  public initialSeed: number;
  public stepCount: number = 0;

  constructor(seed: number = 5489) {
    this.initialSeed = seed >>> 0;
    this.init(this.initialSeed);
  }

  /**
   * Initializes state vector with a seed
   * MT[i] = (1812433253 * (MT[i-1] ^ (MT[i-1] >> 30)) + i) & 0xFFFFFFFF
   */
  public init(seed: number): void {
    this.initialSeed = seed >>> 0;
    this.stepCount = 0;
    this.mt[0] = this.initialSeed;

    for (this.mti = 1; this.mti < MersenneTwister.N; this.mti++) {
      const prev = this.mt[this.mti - 1];
      const s = prev ^ (prev >>> 30);
      // Math.imul preserves 32-bit integer multiplication
      this.mt[this.mti] =
        (Math.imul(1812433253, s) + this.mti) >>> 0;
    }
  }

  public reset(): void {
    this.init(this.initialSeed);
  }

  /**
   * Generates 624 new 32-bit untempered words from the recurrent relation
   */
  private twist(): void {
    const mag01 = [0, MersenneTwister.MATRIX_A];
    let y: number;
    let kk: number;

    for (kk = 0; kk < MersenneTwister.N - MersenneTwister.M; kk++) {
      y = (this.mt[kk] & MersenneTwister.UPPER_MASK) | (this.mt[kk + 1] & MersenneTwister.LOWER_MASK);
      this.mt[kk] = (this.mt[kk + MersenneTwister.M] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
    }

    for (; kk < MersenneTwister.N - 1; kk++) {
      y = (this.mt[kk] & MersenneTwister.UPPER_MASK) | (this.mt[kk + 1] & MersenneTwister.LOWER_MASK);
      this.mt[kk] = (this.mt[kk + (MersenneTwister.M - MersenneTwister.N)] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
    }

    y = (this.mt[MersenneTwister.N - 1] & MersenneTwister.UPPER_MASK) | (this.mt[0] & MersenneTwister.LOWER_MASK);
    this.mt[MersenneTwister.N - 1] =
      (this.mt[MersenneTwister.M - 1] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;

    this.mti = 0;
  }

  /**
   * Extracts one tempered 32-bit number
   */
  public next(): Mt19937StepResult {
    let twistOccurred = false;
    if (this.mti >= MersenneTwister.N) {
      if (this.mti === MersenneTwister.N + 1) {
        this.init(5489);
      }
      this.twist();
      twistOccurred = true;
    }

    const stateIdx = this.mti;
    const rawWord = this.mt[this.mti++];
    this.stepCount++;

    // Tempering process
    let y = rawWord;

    // Stage 1: y = y ^ (y >> 11)
    const stage1 = (y ^ (y >>> 11)) >>> 0;
    y = stage1;

    // Stage 2: y = y ^ ((y << 7) & 0x9D2C5680)
    const stage2 = (y ^ ((y << 7) & MersenneTwister.TEMPERING_MASK_B)) >>> 0;
    y = stage2;

    // Stage 3: y = y ^ ((y << 15) & 0xEFC60000)
    const stage3 = (y ^ ((y << 15) & MersenneTwister.TEMPERING_MASK_C)) >>> 0;
    y = stage3;

    // Stage 4: y = y ^ (y >> 18)
    const stage4 = (y ^ (y >>> 18)) >>> 0;
    const temperedWord = stage4;

    // Normalized float in [0.0, 1.0)
    const normalized = temperedWord / 4294967296.0;

    return {
      step: this.stepCount,
      stateIndex: stateIdx,
      rawWord,
      temperedWord,
      temperingStages: {
        stage1,
        stage2,
        stage3,
        stage4,
      },
      normalized,
      isTwistOccurred: twistOccurred,
    };
  }

  public nextFloat(): number {
    return this.next().normalized;
  }

  public nextInt(min: number, max: number): number {
    const u = this.nextFloat();
    return Math.floor(u * (max - min + 1)) + min;
  }

  /**
   * Peek next K values without altering persistent generator state
   */
  public peek(count: number): Mt19937StepResult[] {
    // Clone internal state
    const backupMt = new Uint32Array(this.mt);
    const backupMti = this.mti;
    const backupStep = this.stepCount;

    const results: Mt19937StepResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.next());
    }

    // Restore state
    this.mt.set(backupMt);
    this.mti = backupMti;
    this.stepCount = backupStep;

    return results;
  }

  public getCurrentStateInfo() {
    return {
      index: this.mti,
      remainingInCycle: MersenneTwister.N - this.mti,
      period: '2^19937 - 1 (약 4.3 × 10^6001)',
      stateSize: '624 words (19,968 bits)',
    };
  }
}
