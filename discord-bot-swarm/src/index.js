const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require("discord.js");
const { generateBotReply } = require("./brain");

const tokens = (process.env.BOT_TOKENS || "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);
const channelId = process.env.CHANNEL_ID;

if (!tokens.length) {
  throw new Error("BOT_TOKENS is required (comma-separated list of bot tokens).");
}

if (!channelId) {
  throw new Error("CHANNEL_ID is required.");
}

const TICK_MS = Number(process.env.TICK_MS || 5000);
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT || 50);
const REPLY_PROBABILITY = Number(process.env.REPLY_PROBABILITY || 0.6);
const SPEAK_PROBABILITY = Number(process.env.SPEAK_PROBABILITY || 0.3);
const MIN_SILENCE_MS = Number(process.env.MIN_SILENCE_MS || 10000);
const RECENT_REPLY_WINDOW_MS = Number(
  process.env.RECENT_REPLY_WINDOW_MS || 15000
);

const messageCache = new Map();
const seenMessageIds = new Set();

function getChannelBuffer(channelIdValue) {
  if (!messageCache.has(channelIdValue)) {
    messageCache.set(channelIdValue, []);
  }
  return messageCache.get(channelIdValue);
}

function recordMessage(message) {
  if (message.channelId !== channelId) {
    return;
  }

  if (seenMessageIds.has(message.id)) {
    return;
  }

  seenMessageIds.add(message.id);

  const buffer = getChannelBuffer(channelId);
  buffer.push({
    id: message.id,
    authorId: message.author.id,
    authorTag: message.author.username,
    content: message.content || "(no content)",
    createdAt: message.createdTimestamp,
    isBot: message.author.bot
  });

  if (buffer.length > HISTORY_LIMIT) {
    buffer.splice(0, buffer.length - HISTORY_LIMIT);
  }
}

function shouldAct(botState, buffer) {
  const now = Date.now();
  if (now - botState.lastSpokeAt < MIN_SILENCE_MS) {
    return { type: "skip", reason: "cooldown" };
  }

  const lastMessage = buffer[buffer.length - 1];
  if (!lastMessage) {
    return { type: "skip", reason: "no-history" };
  }

  const timeSinceLast = now - lastMessage.createdAt;
  const wantsReply =
    lastMessage.authorId !== botState.userId &&
    timeSinceLast < RECENT_REPLY_WINDOW_MS &&
    Math.random() < REPLY_PROBABILITY;

  if (wantsReply) {
    return { type: "reply", targetId: lastMessage.id };
  }

  if (Math.random() < SPEAK_PROBABILITY) {
    return { type: "send" };
  }

  return { type: "skip", reason: "chose-to-wait" };
}

async function fetchRecentMessages(client) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Target channel not found or not text-based.");
  }

  const messages = await channel.messages.fetch({ limit: HISTORY_LIMIT });
  messages.forEach((message) => recordMessage(message));
}

function createBot(token, index) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  const state = {
    client,
    name: `Bot-${index + 1}`,
    lastSpokeAt: 0,
    userId: null
  };

  client.on(Events.ClientReady, async () => {
    state.userId = client.user.id;
    state.name = client.user.username || state.name;
    await fetchRecentMessages(client);
    console.log(`[${state.name}] ready.`);
  });

  client.on(Events.MessageCreate, (message) => {
    recordMessage(message);
  });

  client.login(token);

  return state;
}

async function handleBotTick(botState) {
  const buffer = getChannelBuffer(channelId);
  const action = shouldAct(botState, buffer);

  if (action.type === "skip") {
    return;
  }

  const channel = await botState.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    return;
  }

  const mode = action.type === "reply" ? "reply" : "send";
  const replyText = await generateBotReply({
    botName: botState.name,
    messages: buffer,
    mode
  });

  if (!replyText) {
    return;
  }

  if (action.type === "reply" && action.targetId) {
    try {
      const targetMessage = await channel.messages.fetch(action.targetId);
      await targetMessage.reply(replyText);
    } catch (error) {
      console.warn(`[${botState.name}] reply failed, sending instead.`, error);
      await channel.send(replyText);
    }
  } else {
    await channel.send(replyText);
  }

  botState.lastSpokeAt = Date.now();
}

const bots = tokens.map((token, index) => createBot(token, index));

setInterval(() => {
  bots.forEach((botState) => {
    handleBotTick(botState).catch((error) => {
      console.error(`[${botState.name}] tick error`, error);
    });
  });
}, TICK_MS);
