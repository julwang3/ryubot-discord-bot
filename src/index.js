require('dotenv').config();
const { Client, Collection, GatewayIntentBits, MessageFlags } = require('discord.js');
const daylilyCommand = require('./commands/daylily');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
client.commands.set(daylilyCommand.data.name, daylilyCommand);

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const payload = { content: 'Something went wrong running that command.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
