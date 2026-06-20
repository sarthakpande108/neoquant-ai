const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage, SystemMessage, AIMessage } = require("@langchain/core/messages");
const { z } = require("zod");

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn("API_KEY environment variable not set for Gemini");
}

let llm = null;
if (API_KEY) {
  llm = new ChatGoogleGenerativeAI({
    apiKey: API_KEY,
    modelName: "gemini-2.5-flash",
    maxOutputTokens: 2048,
    temperature: 0.1,
  });
}

// Zod schemas for structured outputs
const analysisSchema = z.object({
  recommendation: z.enum(["Buy", "Sell", "Hold"]).describe("The trading recommendation"),
  confidence: z.number().describe("Confidence score from 0.0 to 1.0"),
  pattern: z.string().describe("Name of dominant candlestick or chart pattern"),
  trend: z.string().describe("Short 3-5 word description of the trend"),
  summary: z.array(z.string()).describe("Bullet points explaining trend, support/resistance, and NeoQuant's view"),
  newsSentiment: z.enum(["Positive", "Negative", "Neutral", ""]).optional(),
  newsSummary: z.array(z.string()).optional(),
  interestingFacts: z.array(z.string()).optional(),
  riskLevel: z.enum(["Low", "Moderate", "High", "Very High"]),
  riskScore: z.number().describe("Risk score from 1 to 10"),
  priceTarget: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string(),
  }),
  supportLevels: z.array(z.number()),
  resistanceLevels: z.array(z.number()),
  keyIndicators: z.array(z.object({
    name: z.string(),
    value: z.string(),
    status: z.enum(["bullish", "bearish", "neutral"])
  })),
  fnoSignal: z.object({
    openInterestSignal: z.enum(["Bullish Build-up", "Bearish Build-up", "Short Covering", "Long Unwinding", "Neutral"]),
    pcrIndication: z.string(),
    note: z.string()
  }).optional(),
  mcxPanel: z.object({
    commodity: z.string(),
    internationalRef: z.string(),
    inrUsdImpact: z.string(),
    seasonalFactor: z.string()
  }).optional()
});

const tradeSignalSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD"]),
  entryPrice: z.string().describe("Exact price or range"),
  target1: z.string().describe("Conservative target"),
  target2: z.string().describe("Aggressive target"),
  stopLoss: z.string().describe("Strict stop loss price"),
  riskReward: z.string().describe("Ratio e.g., 1:2.5"),
  catalyst: z.string().describe("A brutal, 1-sentence technical reason for this setup.")
});

const screenerSchema = z.object({
  text: z.string().describe("Your conversational response as NeoQuant."),
  matchedTickers: z.array(z.string()).describe("Ticker symbols from the provided universe that BEST match the criteria.")
});

async function analyzeStockByTicker(
  ticker,
  indicatorSummary,
  quote,
  timeframe,
  includeWebNews,
  chartImageBase64
) {
  if (!llm) throw new Error("Gemini API key not configured on the backend.");

  const isIndex = ticker.startsWith('^');
  const isMCX = quote.exchange === 'MCX';
  const isFnoEligible = quote.exchange === 'NSE' && !isIndex && quote.marketCap > 50000000000;

  const currencySymbol = quote.currency === 'INR' ? '₹' : '$';
  const priceChange = quote.price - quote.previousClose;
  const priceChangePct = ((priceChange / quote.previousClose) * 100).toFixed(2);

  const systemMsg = new SystemMessage(`You are NeoQuant AI, an elite, professional Indian stock market analyst specializing in deep technical analysis and market research for NSE, BSE, and MCX markets.`);

  const promptText = `**Stock/Instrument**: ${ticker}
**Name**: ${quote.name}
**Exchange**: ${quote.exchange}
**Chart Timeframe**: ${timeframe} (Analyse the chart and indicators in the context of this timeframe)
**Current Price**: ${currencySymbol}${quote.price.toFixed(2)}
**Day Change**: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChangePct}%)

**Technical Indicators & Market Data**:
${indicatorSummary}

**Task**: Perform a comprehensive, institutional-grade technical and fundamental analysis for professional Indian traders. Combine the chart visual analysis with the technical indicators to provide precise, expert insights like a professional stock analyst.

CRITICAL RULES:
1. Provide a precise, expert-level technical analysis combining the provided chart visual analysis with the technical indicators.
2. Use professional stock market terminology and provide actionable, institutional-grade insights.
3. State your analysis as "NeoQuant AI's view".
4. If you mention ANY percentage gain or surge, you MUST explicitly state the exact timeframe it occurred in.
`;

  const content = [];
  content.push({ type: "text", text: promptText });
  if (chartImageBase64) {
    // chartImageBase64 is typically "data:image/png;base64,..."
    content.push({
      type: "image_url",
      image_url: chartImageBase64
    });
  }

  const messages = [systemMsg, new HumanMessage({ content })];

  try {
    const structuredLlm = llm.withStructuredOutput(analysisSchema, { name: "analysis" });
    const analysis = await structuredLlm.invoke(messages);
    return { analysis, sources: [] }; // Grounding sources omitted for structured output
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error.message && error.message.includes("API key not valid")) {
      throw new Error("Invalid API Key. Please check your GEMINI_API_KEY configuration.");
    }
    throw new Error("Failed to get AI analysis. Please try again.");
  }
}

async function generateTradeSignal(ticker, indicatorSummary, quote, timeframe, chartImageBase64) {
  if (!llm) throw new Error("Gemini API key not configured on the backend.");

  const currencySymbol = quote.currency === 'INR' ? '₹' : '$';
  
  const systemPrompt = "You are a ruthless, highly accurate algorithmic trader. Your job is to output a STRICT, actionable trade setup based on the provided technicals and chart. Do not give generic advice.";
  
  const promptText = `**Stock**: ${ticker} | ${quote.name}
**Price**: ${currencySymbol}${quote.price.toFixed(2)}
**Timeframe**: ${timeframe}

**Technicals**:
${indicatorSummary}

Task: Generate a high-probability trade signal (Buy, Sell, or Hold). Provide precise levels.`;

  const content = [{ type: "text", text: promptText }];
  if (chartImageBase64) {
    content.push({ type: "image_url", image_url: chartImageBase64 });
  }

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage({ content })
  ];

  try {
    const structuredLlm = llm.withStructuredOutput(tradeSignalSchema, { name: "tradeSignal" });
    const signal = await structuredLlm.invoke(messages);
    return signal;
  } catch (error) {
    console.error("Error generating trade signal:", error);
    throw new Error("Failed to generate trade signal.");
  }
}

async function screenStocksChat(query, chatHistory, allTickersString) {
  if (!llm) throw new Error("Gemini API key not configured on the backend.");

  const systemPrompt = `You are NeoQuant, an elite AI Stock Screener chatbot.
The user is asking you to find stocks based on natural language criteria.

You have access to the following universe of tickers:
${allTickersString}

Task:
1. Analyze the user's query and the chat history.
2. Formulate a short, brutalist, and professional text response as NeoQuant.
3. Identify 1 to 5 ticker symbols from the provided universe that BEST match the user's criteria.`;

  const messages = [new SystemMessage(systemPrompt)];
  
  for (const msg of chatHistory) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else {
      messages.push(new AIMessage(msg.content));
    }
  }
  
  messages.push(new HumanMessage(`New Query: ${query}`));

  try {
    const structuredLlm = llm.withStructuredOutput(screenerSchema, { name: "screener" });
    const result = await structuredLlm.invoke(messages);
    return result;
  } catch (error) {
    console.error("Error in screener chat:", error);
    throw new Error("Failed to screen stocks.");
  }
}

module.exports = {
  analyzeStockByTicker,
  generateTradeSignal,
  screenStocksChat
};
