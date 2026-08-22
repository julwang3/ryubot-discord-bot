const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { addDaily, findDaily, listDailies, saveCheckpoint, deleteDaily } = require('../db');
const { formatDailyBlock } = require('../format');
const { computeLiveState } = require('../refill');

const data = new SlashCommandBuilder()
  .setName('daylily')
  .setDescription('Track your game daily currencies and refill rates')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Create a new game currency to track')
      .addStringOption((o) => o.setName('game').setDescription('Game name').setRequired(true))
      .addIntegerOption((o) => o.setName('current').setDescription('Current currency amount').setRequired(true).setMinValue(0))
      .addIntegerOption((o) => o.setName('max').setDescription('Maximum currency amount').setRequired(true).setMinValue(1))
      .addNumberOption((o) =>
        o.setName('refill_elapsed').setDescription('Minutes elapsed toward the next refill tick').setRequired(true).setMinValue(0),
      )
      .addNumberOption((o) =>
        o.setName('refill_rate').setDescription('Minutes required to refill one unit').setRequired(true).setMinValue(0.0001),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit the max amount and/or refill rate for a tracked currency')
      .addStringOption((o) => o.setName('game').setDescription('Game name').setRequired(true))
      .addIntegerOption((o) => o.setName('max').setDescription('New maximum currency amount').setRequired(false).setMinValue(1))
      .addNumberOption((o) =>
        o.setName('refill_rate').setDescription('New refill rate').setRequired(false).setMinValue(0.0001),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('update')
      .setDescription('Update the current amount and/or elapsed refill time')
      .addStringOption((o) => o.setName('game').setDescription('Game name').setRequired(true))
      .addIntegerOption((o) => o.setName('current').setDescription('New current currency amount').setRequired(false).setMinValue(0))
      .addNumberOption((o) =>
        o.setName('refill_elapsed').setDescription('New minutes elapsed toward the next refill tick').setRequired(false).setMinValue(0),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Delete a tracked game currency')
      .addStringOption((o) => o.setName('game').setDescription('Game name').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List tracked dailies with progress bars')
      .addStringOption((o) => o.setName('game').setDescription('Optional: Show only this game').setRequired(false)),
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (sub === 'add') {
    const game = interaction.options.getString('game').trim();
    const current = interaction.options.getInteger('current');
    const max = interaction.options.getInteger('max');
    const refillElapsed = interaction.options.getNumber('refill_elapsed');
    const refillRate = interaction.options.getNumber('refill_rate');

    if (current > max) {
      return interaction.reply({
        content: `⚠️ Current amount (${current}) can't be greater than max (${max}).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (findDaily(userId, game)) {
      return interaction.reply({
        content: `⚠️ You're already tracking **${game}**. Use \`/daylily update\` or \`/daylily edit\` instead.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    addDaily(userId, game, current, max, refillElapsed, refillRate);

    const live = computeLiveState(current, max, refillElapsed, refillRate, new Date());
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`✅ Now tracking ${game}`)
      .setDescription(formatDailyBlock(game, live.currentAmt, max, refillRate, live.isCapped, live.capAt));

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'edit') {
    const game = interaction.options.getString('game').trim();
    const max = interaction.options.getInteger('max');
    const refillRate = interaction.options.getNumber('refill_rate');

    if (max === null && refillRate === null) {
      return interaction.reply({
        content: '⚠️ Provide at least one of `max` or `refill_rate` to edit.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = findDaily(userId, game);
    if (!row) {
      return interaction.reply({ content: `❌ You're not tracking **${game}**.`, flags: MessageFlags.Ephemeral });
    }

    // Snapshot the live state under the OLD rate first, so no progress is lost,
    // then apply the new max/rate going forward from this moment.
    const live = computeLiveState(row.currencyAmt, row.maxCurrencyAmt, row.elapsedRefillAmt, row.refillRate, row.updatedAt);
    const newMax = max ?? row.maxCurrencyAmt;
    const newRate = refillRate ?? row.refillRate;
    const newCurrent = Math.min(live.currentAmt, newMax);

    saveCheckpoint(row.id, newCurrent, newMax, live.elapsedRefillAmt, newRate);

    const live2 = computeLiveState(newCurrent, newMax, live.elapsedRefillAmt, newRate, new Date());
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`🔧 Edited ${game}`)
      .setDescription(formatDailyBlock(game, live2.currentAmt, newMax, newRate, live2.isCapped, live2.capAt));

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'update') {
    const game = interaction.options.getString('game').trim();
    const current = interaction.options.getInteger('current');
    const refillElapsed = interaction.options.getNumber('refill_elapsed');

    if (current === null && refillElapsed === null) {
      return interaction.reply({
        content: '⚠️ Provide at least one of `current` or `refill_elapsed` to update.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = findDaily(userId, game);
    if (!row) {
      return interaction.reply({ content: `❌ You're not tracking **${game}**.`, flags: MessageFlags.Ephemeral });
    }

    const live = computeLiveState(row.currencyAmt, row.maxCurrencyAmt, row.elapsedRefillAmt, row.refillRate, row.updatedAt);

    const newCurrent = current ?? live.currentAmt;
    const newElapsed = refillElapsed ?? live.elapsedRefillAmt;

    if (newCurrent > row.maxCurrencyAmt) {
      return interaction.reply({
        content: `⚠️ Current amount (${newCurrent}) can't be greater than max (${row.maxCurrencyAmt}).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    saveCheckpoint(row.id, newCurrent, row.maxCurrencyAmt, newElapsed, row.refillRate);

    const live2 = computeLiveState(newCurrent, row.maxCurrencyAmt, newElapsed, row.refillRate, new Date());
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🔄 Updated ${game}`)
      .setDescription(formatDailyBlock(game, live2.currentAmt, row.maxCurrencyAmt, row.refillRate, live2.isCapped, live2.capAt));

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'delete') {
    const game = interaction.options.getString('game').trim();
    const row = findDaily(userId, game);
    if (!row) {
      return interaction.reply({ content: `❌ You're not tracking **${game}**.`, flags: MessageFlags.Ephemeral });
    }

    deleteDaily(row.id);
    return interaction.reply({ content: `🗑️ Stopped tracking **${game}**.` });
  }

  if (sub === 'list') {
    const game = interaction.options.getString('game');
    let rows;

    if (game) {
      const row = findDaily(userId, game.trim());
      if (!row) {
        return interaction.reply({ content: `❌ You're not tracking **${game}**.`, flags: MessageFlags.Ephemeral });
      }
      rows = [row];
    } else {
      rows = listDailies(userId);
    }

    if (rows.length === 0) {
      return interaction.reply({
        content: 'You have no tracked dailies yet. Add one with `/daylily add`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const blocks = rows.map((row) => {
      const live = computeLiveState(row.currencyAmt, row.maxCurrencyAmt, row.elapsedRefillAmt, row.refillRate, row.updatedAt);
      return formatDailyBlock(row.gameName, live.currentAmt, row.maxCurrencyAmt, row.refillRate, live.isCapped, live.capAt);
    });

    const title = game ? `📋 ${rows[0].gameName}` : `📋 ${interaction.user.username}'s Game Dailies`;
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(blocks.join('\n\n'));

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
