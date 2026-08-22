/** Builds a block-character progress bar. */
function buildBar(current, max, length = 12) {
  const pct = max > 0 ? current / max : 0;
  const filled = Math.max(0, Math.min(length, Math.round(pct * length)));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/** Formats a minutes value (float) as e.g. "1h 30m 30s", "8m", "30s". */
function formatMinutes(totalMinutes) {
  const totalSeconds = Math.max(0, Math.round(totalMinutes * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/** Builds the "Caps <relative> (<absolute>)" line using Discord's native timestamp markdown,
 * which auto-adjusts to each viewer's timezone. */
function formatCapLine(isCapped, capAt) {
  if (isCapped) return '✅ Capped';
  const unixTs = Math.floor(capAt.getTime() / 1000);
  return `⏳ Caps <t:${unixTs}:R> (<t:${unixTs}:f>)`;
}

function formatDailyBlock(gameName, liveCurrent, maxAmt, refillRate, isCapped, capAt) {
  const pct = maxAmt > 0 ? Math.round((liveCurrent / maxAmt) * 100) : 0;
  const bar = buildBar(liveCurrent, maxAmt);
  return (
    `**${gameName}**\n` +
    `${bar} ${liveCurrent}/${maxAmt} (${pct}%)\n` +
    `Refill rate: ${formatMinutes(refillRate)} per unit\n` +
    `${formatCapLine(isCapped, capAt)}`
  );
}

module.exports = { buildBar, formatMinutes, formatCapLine, formatDailyBlock };
