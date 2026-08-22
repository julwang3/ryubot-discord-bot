require('dotenv').config();
const { REST, Routes } = require('discord.js');
const daylilyCommand = require('./commands/daylily');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const commands = [daylilyCommand.data.toJSON()];
const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    const target = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    console.log(`Deploying ${commands.length} command(s) ${GUILD_ID ? `to guild ${GUILD_ID}` : 'globally'}...`);
    await rest.put(target, { body: commands });
    console.log('✅ Commands deployed successfully.');
  } catch (err) {
    console.error('Failed to deploy commands:', err);
    process.exit(1);
  }
})();
