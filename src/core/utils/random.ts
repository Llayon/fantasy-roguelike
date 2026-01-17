/**
 * Seeded Random Number Generation for the core battle engine.
 * Provides deterministic randomness for reproducible battle simulations.
 *
 * @module core/utils/random
 */

/**
 * Mulberry32 - a fast, high-quality 32-bit PRNG.
 * Produces well-distributed pseudo-random numbers from a seed.
 *
 * Use this function for single random values (e.g., dodge chance, effect chance).
 * For sequences of random values, use the SeededRandom class instead.
 *
 * @param seed - Integer seed value
 * @returns Random number between 0 and 1
 *
 * @example
 * const random = seededRandom(12345); // Returns ~0.4234
 * const random2 = seededRandom(12345); // Returns same value (deterministic)
 * const random3 = seededRandom(12346); // Returns different value
 */
export function seededRandom(seed: number): number {
  // Mulberry32 algorithm - produces excellent distribution
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Seeded random number generator class for stateful random sequences.
 * Uses Linear Congruential Generator (LCG) algorithm.
 *
 * Use this class when you need multiple random values in sequence
 * (e.g., shuffling arrays, generating bot teams, draft mechanics).
 *
 * @example
 * const rng = new SeededRandom(12345);
 * const first = rng.next();  // ~0.42
 * const second = rng.next(); // ~0.78
 *
 * // Same seed produces same sequence
 * const rng2 = new SeededRandom(12345);
 * rng2.next(); // Same as first
 * rng2.next(); // Same as second
 */
export class SeededRandom {
  private seed: number;

  /**
   * Create a new seeded random number generator.
   *
   * @param seed - Initial seed value
   */
  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate next random number between 0 and 1.
   *
   * @returns Random number in range [0, 1)
   */
  next(): number {
    // LCG parameters (same as MINSTD)
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate random integer between min and max (inclusive).
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @returns Random integer in range [min, max]
   *
   * @example
   * const rng = new SeededRandom(12345);
   * const roll = rng.nextInt(1, 6); // Dice roll: 1-6
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm with seeded randomness.
   * Does not mutate the original array.
   *
   * @param array - Array to shuffle
   * @returns New shuffled array
   *
   * @example
   * const rng = new SeededRandom(12345);
   * const deck = ['A', 'B', 'C', 'D'];
   * const shuffled = rng.shuffle(deck); // ['C', 'A', 'D', 'B']
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i];
      const swapItem = result[j];
      if (temp !== undefined && swapItem !== undefined) {
        result[i] = swapItem;
        result[j] = temp;
      }
    }
    return result;
  }

  /**
   * Pick a random element from an array.
   *
   * @param array - Array to pick from
   * @returns Random element or undefined if array is empty
   *
   * @example
   * const rng = new SeededRandom(12345);
   * const units = ['knight', 'mage', 'archer'];
   * const picked = rng.pick(units); // 'mage'
   */
  pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Generate a boolean with given probability.
   *
   * @param probability - Probability of returning true (0-1)
   * @returns True with given probability
   *
   * @example
   * const rng = new SeededRandom(12345);
   * const crit = rng.chance(0.25); // 25% chance of true
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Get current seed value (for saving/restoring state).
   *
   * @returns Current seed value
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Set seed value (for restoring state).
   *
   * @param seed - New seed value
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }
}
