const { GoogleGenAI } = require("@google/genai");

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn("API_KEY environment variable not set for Gemini");
}

let ai = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

async function analyzeStockByTicker(
  ticker,
  indicatorSummary,
  quote,
  timeframe,
  includeWebNews,
  chartImageBase64
) {
  if (!ai) {
    throw new Error("Gemini API key not configured on the backend.");
  }

  const isIndex = ticker.startsWith('^');
  const isMCX = quote.exchange === 'MCX';
  const isFnoEligible = quote.exchange === 'NSE' && !isIndex && quote.marketCap > 50000000000;

  const currencySymbol = quote.currency === 'INR' ? '₹' : '$';
  const priceChange = quote.price - quote.previousClose;
  const priceChangePct = ((priceChange / quote.previousClose) * 100).toFixed(2);

  const prompt = `You are NeoQuant AI, an elite, professional Indian stock market analyst specializing in deep technical analysis and market research for NSE, BSE, and MCX markets.

**Stock/Instrument**: ${ticker}
**Name**: ${quote.name}
**Exchange**: ${quote.exchange}
**Chart Timeframe**: ${timeframe} (Analyse the chart and indicators in the context of this timeframe)
**Current Price**: ${currencySymbol}${quote.price.toFixed(2)}
**Day Change**: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChangePct}%)

**Technical Indicators & Market Data**:
${indicatorSummary}

${chartImageBase64 ? `**Chart Image Attached**: You have been provided with an image of the stock's candlestick chart. LOOK at the image carefully to determine support, resistance, trend lines, and patterns.` : ''}

**Task**: Perform a comprehensive, institutional-grade technical and fundamental analysis for professional Indian traders. Combine the chart visual analysis with the technical indicators to provide precise, expert insights like a professional stock analyst.

${includeWebNews ? `Use your Google Search tool to find TODAY's latest news about "${quote.name}" or "${ticker}" in the Indian market context. Look specifically for:
1. Brokerage firm target prices and outlooks.
2. Top news articles and recent developments.
3. Interesting facts about the company's business model, history, or market position.` : `DO NOT search the web. Rely entirely on the chart image and technical indicators provided. Leave newsSentiment, newsSummary, and interestingFacts blank or use default safe values (e.g. Neutral, []).`}

CRITICAL RULES FOR SUMMARIES:
1. Provide a precise, expert-level technical analysis combining the provided chart visual analysis with the technical indicators.
2. Use professional stock market terminology and provide actionable, institutional-grade insights.
3. State your analysis as "NeoQuant AI's view".
4. If you mention ANY percentage gain or surge, you MUST explicitly state the exact timeframe it occurred in. Do not state vague historical gains.
5. The 'summary' field MUST be an array of strings. Each string should be a concise bullet point.

Return your complete analysis as a **raw JSON object only** (no markdown, no code fences, no extra text). Follow this exact structure:

{
  "recommendation": "Buy" | "Sell" | "Hold",
  "confidence": 0.0 to 1.0,
  "pattern": "name of dominant candlestick or chart pattern based ONLY on the provided data/image",
  "trend": "Short 3-5 word description of the trend (e.g., 'Strong Bullish Momentum')",
  "summary": [
    "A simple, non-technical bullet point explaining the trend.",
    "Another point explaining support, resistance, or NeoQuant AI's view."
  ],
  "newsSentiment": "Positive" | "Negative" | "Neutral",
  "newsSummary": ["bullet point 1 (e.g. Brokerage XYZ gave a Buy rating with target ₹200)", "bullet point 2 (recent news)"],
  "interestingFacts": ["fact 1 about the company/commodity", "fact 2", "fact 3"],
  "riskLevel": "Low" | "Moderate" | "High" | "Very High",
  "riskScore": 1 to 10,
  "priceTarget": {
    "low": number (realistic 1-week lower target in ${quote.currency}),
    "high": number (realistic 1-week upper target in ${quote.currency}),
    "currency": "${quote.currency}"
  },
  "supportLevels": [lower_support_price, higher_support_price],
  "resistanceLevels": [lower_resistance_price, higher_resistance_price],
  "keyIndicators": [
    { "name": "RSI(14)", "value": "value and signal description", "status": "bullish" | "bearish" | "neutral" },
    { "name": "MACD", "value": "description", "status": "bullish" | "bearish" | "neutral" },
    { "name": "Moving Averages", "value": "price vs MA description", "status": "bullish" | "bearish" | "neutral" },
    { "name": "Volume", "value": "volume trend description", "status": "bullish" | "bearish" | "neutral" },
    { "name": "Trend", "value": "overall trend description", "status": "bullish" | "bearish" | "neutral" }
  ]${isFnoEligible ? `,
  "fnoSignal": {
    "openInterestSignal": "Bullish Build-up" | "Bearish Build-up" | "Short Covering" | "Long Unwinding" | "Neutral",
    "pcrIndication": "brief PCR analysis for this stock",
    "note": "brief F&O strategy note for traders"
  }` : ''}${isMCX ? `,
  "mcxPanel": {
    "commodity": "${quote.name}",
    "internationalRef": "COMEX/international reference price and exchange if known",
    "inrUsdImpact": "how INR/USD movement is affecting this commodity price today",
    "seasonalFactor": "relevant seasonal or cyclical factor for this commodity"
  }` : ''}
}`;

  try {
    const parts = [{ text: prompt }];
    if (chartImageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: chartImageBase64.replace(/^data:image\/\w+;base64,/, ''),
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        tools: includeWebNews ? [{ googleSearch: {} }] : [],
      },
    });

    let analysisJson = response.text.trim();
    // Strip markdown code fences if present
    const match = analysisJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      analysisJson = match[1];
    }
    // Remove any leading/trailing non-JSON characters
    const jsonStart = analysisJson.indexOf('{');
    const jsonEnd = analysisJson.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      analysisJson = analysisJson.slice(jsonStart, jsonEnd + 1);
    }

    const analysis = JSON.parse(analysisJson);

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let sources = [];
    if (groundingMetadata && groundingMetadata.groundingChunks) {
      sources = groundingMetadata.groundingChunks
        .filter((chunk) => chunk.web && chunk.web.uri && chunk.web.title)
        .map((chunk) => ({
          uri: chunk.web.uri,
          title: chunk.web.title,
        }));
    }

    return { analysis, sources };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error.message && error.message.includes("API key not valid")) {
      throw new Error("Invalid API Key. Please check your GEMINI_API_KEY configuration.");
    }
    throw new Error("Failed to get AI analysis. Please try again.");
  }
}

async function generateTradeSignal(ticker, indicatorSummary, quote, timeframe, chartImageBase64) {
  if (!ai) throw new Error("Gemini API key not configured on the backend.");

  const currencySymbol = quote.currency === 'INR' ? '₹' : '$';
  
  const prompt = `You are a ruthless, highly accurate algorithmic trader. Your job is to output a STRICT, actionable trade setup based on the provided technicals and chart. Do not give generic advice.

**Stock**: ${ticker} | ${quote.name}
**Price**: ${currencySymbol}${quote.price.toFixed(2)}
**Timeframe**: ${timeframe}

**Technicals**:
${indicatorSummary}

Task: Generate a high-probability trade signal (Buy, Sell, or Hold). Provide precise levels.
Return ONLY raw JSON in this exact format:
{
  "action": "BUY" | "SELL" | "HOLD",
  "entryPrice": "Exact price or range",
  "target1": "Conservative target",
  "target2": "Aggressive target",
  "stopLoss": "Strict stop loss price",
  "riskReward": "Ratio e.g., 1:2.5",
  "catalyst": "A brutal, 1-sentence technical reason for this setup."
}`;

  try {
    const parts = [{ text: prompt }];
    if (chartImageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: chartImageBase64.replace(/^data:image\/\w+;base64,/, ''),
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts }
    });

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) jsonStr = match[1];
    
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating trade signal:", error);
    throw new Error("Failed to generate trade signal.");
  }
}

async function screenStocksChat(query, chatHistory, allTickersString) {
  if (!ai) throw new Error("Gemini API key not configured on the backend.");

  const prompt = `You are NeoQuant, an elite AI Stock Screener chatbot.
The user is asking you to find stocks based on natural language criteria.

You have access to the following universe of tickers:
${allTickersString}

**Chat History**:
${chatHistory.map(msg => `${msg.role === 'user' ? 'User' : 'NeoQuant'}: ${msg.content}`).join('\n')}

**New Query**: ${query}

Task:
1. Analyze the user's query and the chat history.
2. Formulate a short, brutalist, and professional text response as NeoQuant.
3. Identify 1 to 5 ticker symbols from the provided universe that BEST match the user's criteria.

Return ONLY raw JSON in this exact format:
{
  "text": "Your conversational response as NeoQuant.",
  "matchedTickers": ["RELIANCE.NS", "TCS.NS"] 
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) jsonStr = match[1];
    
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(jsonStr);
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
