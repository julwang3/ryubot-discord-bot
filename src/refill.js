/**
 * Core logic for turning a stored checkpoint (amount, elapsed refill progress,
 * and the time it was last saved) into the *live* current state of a currency,
 * accounting for real time that has passed since.
 *
 * elapsedRefillAmt and refillRate are both expressed in MINUTES (float).
 */

/**
 * Projects forward from a stored checkpoint to "right now".
 *
 * @param {number} currencyAmt - amount as of the last checkpoint
 * @param {number} maxCurrencyAmt - cap
 * @param {number} elapsedRefillAmt - minutes of progress toward the next unit, as of the checkpoint
 * @param {number} refillRate - minutes required to gain one unit
 * @param {Date} updatedAt - when the checkpoint was saved
 * @param {Date} [now] - defaults to the current time
 * @returns {{ currentAmt: number, elapsedRefillAmt: number, isCapped: boolean, capAt: Date|null }}
 */
function computeLiveState(currencyAmt, maxCurrencyAmt, elapsedRefillAmt, refillRate, updatedAt, now = new Date()) {
  if (currencyAmt >= maxCurrencyAmt) {
    return { currentAmt: maxCurrencyAmt, elapsedRefillAmt: 0, isCapped: true, capAt: null };
  }

  const realElapsedMinutes = Math.max(0, (now.getTime() - updatedAt.getTime()) / 60000);
  const totalProgress = elapsedRefillAmt + realElapsedMinutes;

  const ticksGained = Math.floor(totalProgress / refillRate);
  const remainingProgress = totalProgress - ticksGained * refillRate;

  const liveAmt = currencyAmt + ticksGained;

  if (liveAmt >= maxCurrencyAmt) {
    return { currentAmt: maxCurrencyAmt, elapsedRefillAmt: 0, isCapped: true, capAt: null };
  }

  const unitsNeeded = maxCurrencyAmt - liveAmt;
  const minutesUntilCap = (unitsNeeded - 1) * refillRate + (refillRate - remainingProgress);
  const capAt = new Date(now.getTime() + minutesUntilCap * 60000);

  return { currentAmt: liveAmt, elapsedRefillAmt: remainingProgress, isCapped: false, capAt };
}

module.exports = { computeLiveState };
