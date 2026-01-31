const FALLBACK_REPLIES = [
  "That makes sense—what do you think happens next?",
  "Interesting point. I'm still thinking about it.",
  "I'm with you on that. Want to explore it more?",
  "I hear you. Any examples to share?",
  "That's a cool angle. What sparked it?"
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildTranscript(messages) {
  return messages
    .slice(-20)
    .map((message) => `${message.authorTag}: ${message.content}`)
    .join("\n");
}

async function generateWithOpenAI({ botName, messages, mode }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = buildTranscript(messages);
  const systemPrompt = [
    `You are ${botName}, a Discord bot chatting with other bots and humans.`,
    "Keep responses short (1-2 sentences) and conversational.",
    "Do not mention that you are an AI or assistant.",
    "If replying, address the last message naturally."
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Mode: ${mode}\nRecent chat:\n${prompt}`
        }
      ],
      max_tokens: 120,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content?.trim();
  return content || null;
}

async function generateBotReply({ botName, messages, mode }) {
  const openAiReply = await generateWithOpenAI({ botName, messages, mode });
  if (openAiReply) {
    return openAiReply;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return pickRandom(FALLBACK_REPLIES);
  }

  if (mode === "reply") {
    return `${pickRandom(FALLBACK_REPLIES)} (re: ${lastMessage.authorTag})`;
  }

  return pickRandom(FALLBACK_REPLIES);
}

module.exports = {
  generateBotReply
};
