/**
 * Core logic for turning a stored checkpoint (amount, time remaining until
 * the next refill tick, and the time it was last saved) into the *live*
 * current state of a currency, accounting for real time that has passed since.
 *
 * refillInAmt and refillRate are both expressed in MINUTES (float).
 * refillInAmt is how many minutes remain until the NEXT tick (counting down),
 * as opposed to how many minutes have elapsed since the last one.
 */

/**
 * Projects forward from a stored checkpoint to "right now".
 *
 * @param {number} currencyAmt - amount as of the last checkpoint
 * @param {number} maxCurrencyAmt - cap
 * @param {number} refillInAmt - minutes remaining until the next unit, as of the checkpoint
 * @param {number} refillRate - minutes required to gain one unit
 * @param {Date} updatedAt - when the checkpoint was saved
 * @param {Date} [now] - defaults to the current time
 * @returns {{ currentAmt: number, refillInAmt: number, isCapped: boolean, capAt: Date|null }}
 */
function computeLiveState(currencyAmt, maxCurrencyAmt, refillInAmt, refillRate, updatedAt, now = new Date()) {
  if (currencyAmt >= maxCurrencyAmt) {
    return { currentAmt: maxCurrencyAmt, refillInAmt: 0, isCapped: true, capAt: null };
  }

  const realElapsedMinutes = Math.max(0, (now.getTime() - updatedAt.getTime()) / 60000);

  // Convert "time remaining until next tick" into "time elapsed since the last tick"
  // so we can add real elapsed time and figure out how many ticks have passed.
  const elapsedSinceLastTick = refillRate - refillInAmt;
  const totalProgress = elapsedSinceLastTick + realElapsedMinutes;

  const ticksGained = Math.floor(totalProgress / refillRate);
  const remainingProgress = totalProgress - ticksGained * refillRate;

  const liveAmt = currencyAmt + ticksGained;

  if (liveAmt >= maxCurrencyAmt) {
    return { currentAmt: maxCurrencyAmt, refillInAmt: 0, isCapped: true, capAt: null };
  }

  // Time remaining until the next tick, counting down from refillRate.
  const liverefillInAmt = refillRate - remainingProgress;

  const unitsNeeded = maxCurrencyAmt - liveAmt;
  const minutesUntilCap = (unitsNeeded - 1) * refillRate + liverefillInAmt;
  const capAt = new Date(now.getTime() + minutesUntilCap * 60000);

  return { currentAmt: liveAmt, refillInAmt: liverefillInAmt, isCapped: false, capAt };
}

module.exports = { computeLiveState };
