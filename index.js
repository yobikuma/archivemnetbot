require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require('discord.js');
const config = require('./config');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'processed.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, '[]');
}

function loadProcessed() {
  try {
    return new Set(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (error) {
    console.error('processed.json 読み込み失敗:', error);
    return new Set();
  }
}

const processed = loadProcessed();

function saveProcessed() {
  fs.writeFileSync(
    FILE,
    JSON.stringify([...processed], null, 2)
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(
    `✅ Achievement Bot online: ${client.user.tag}`
  );
});

client.on('messageCreate', async message => {
  try {
    if (message.channel.id !== process.env.ORDER_LOG_CHANNEL_ID) return;
    if (!message.author.bot) return;

    const prefix = 'VENDING_BRIDGE|PAID|';
    if (!message.content.startsWith(prefix)) return;

    let payload;
    try {
      payload = JSON.parse(message.content.slice(prefix.length));
    } catch (error) {
      console.error('Bridge JSON parse error:', error);
      return;
    }

    if (!payload.id) return;
    if (processed.has(payload.id)) return;

    const channel = await client.channels.fetch(
      process.env.ACHIEVEMENT_CHANNEL_ID
    );

    if (!channel?.isTextBased()) {
      throw new Error(
        'ACHIEVEMENT_CHANNEL_ID がテキストチャンネルではありません。'
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(config.title)
      .setColor(config.accentHex)
      .addFields(
        {
          name: '商品名',
          value: String(payload.product)
        },
        {
          name: '購入数',
          value: `${payload.quantity}個`
        },
        {
          name: '購入サーバー',
          value: `${payload.guildName} (${payload.guildId})`
        },
        {
          name: '購入者',
          value: `<@${payload.userId}> (${payload.userId})`
        },
        {
          name: '購入金額',
          value: `${payload.totalPrice}円`
        }
      )
      .setFooter({
        text: `${config.footerPrefix} @${payload.username}`
      })
      .setTimestamp();

    await channel.send({
      embeds: [embed]
    });

    processed.add(payload.id);
    saveProcessed();

  } catch (error) {
    console.error(
      'Bridge processing error:',
      error
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
