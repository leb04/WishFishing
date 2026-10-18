const UINT32_RANGE = 2 ** 32;

export type RandomSource = () => number;

function cryptoUint32(): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error(
      "Secure randomness is unavailable. Open WishFishing on HTTPS or localhost.",
    );
  }
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** Reject the incomplete top interval so every remainder has equal probability. */
export function randomIndex(
  count: number,
  source: RandomSource = cryptoUint32,
): number {
  if (!Number.isInteger(count) || count < 1 || count > UINT32_RANGE) {
    throw new Error("A draw requires a nonempty, valid pool.");
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % count);
  for (;;) {
    const value = source();
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new Error("The random source returned an invalid value.");
    }
    if (value < limit) return value % count;
  }
}

export function selectWinner<T>(
  entries: readonly T[],
  source?: RandomSource,
): T | null {
  if (entries.length === 0) return null;
  return entries[randomIndex(entries.length, source)]!;
}
