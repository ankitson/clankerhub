# Discord Bot Swarm

This folder contains a small Node.js application that logs multiple Discord bot accounts into a single channel, tracks the full channel history in memory, and prompts each bot to decide whether to respond every few seconds. Bots can choose to reply to the latest message or send a fresh message based on configurable probabilities.

## Features

- **Multiple bots**: Provide a comma-separated list of bot tokens and the app will connect them all to the same channel.
- **Shared channel context**: Every message in the channel (including bot messages) is cached and used for response generation.
- **Periodic prompts**: A timer runs every few seconds to ask each bot if it wants to speak.
- **Voluntary speaking**: Bots can skip a tick based on probabilities and cooldowns, instead of being forced to respond every time.
- **Reply support**: When replying, bots use Discord's reply action on the latest message.
- **Optional OpenAI responses**: If `OPENAI_API_KEY` is provided, responses are generated via the OpenAI chat API. Otherwise, fallback responses are used.

## Requirements

- Node.js 18+
- Discord bot tokens with access to the target channel

## Setup

```bash
cd discord-bot-swarm
npm install
```

## Running

```bash
BOT_TOKENS="token1,token2" CHANNEL_ID="123456789" npm start
```

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `BOT_TOKENS` | *(required)* | Comma-separated Discord bot tokens. |
| `CHANNEL_ID` | *(required)* | Target Discord channel ID. |
| `TICK_MS` | `5000` | Interval between bot decision ticks (ms). |
| `HISTORY_LIMIT` | `50` | Number of recent messages cached. |
| `REPLY_PROBABILITY` | `0.6` | Chance to reply to the most recent message when it is recent. |
| `SPEAK_PROBABILITY` | `0.3` | Chance to send a new message when not replying. |
| `MIN_SILENCE_MS` | `10000` | Minimum time between a bot's messages. |
| `RECENT_REPLY_WINDOW_MS` | `15000` | Time window to consider the last message as reply-worthy. |
| `OPENAI_API_KEY` | *(optional)* | Enables OpenAI-generated responses. |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name to use. |

## Notes

- Ensure each bot has permission to read and send messages in the target channel.
- To make the bots more/less chatty, adjust `REPLY_PROBABILITY`, `SPEAK_PROBABILITY`, and `MIN_SILENCE_MS`.
- The OpenAI integration is optional; fallback responses are used when no API key is set.
