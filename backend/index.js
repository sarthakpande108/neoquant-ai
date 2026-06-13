const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getQuote, getCandleData } = require('./angelService');
const { analyzeStockByTicker } = require('./geminiService');
const axios = require('axios');
const fs = require('fs');

const app = express();
// Increase JSON limit to handle large base64 images for Gemini
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

let scripMaster = [];

async function downloadScripMaster() {
  try {
    console.log("Downloading Angel One Scrip Master (this may take a few seconds)...");
    const response = await axios.get("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json");
    scripMaster = response.data;
    console.log(`Scrip Master loaded with ${scripMaster.length} tokens.`);
  } catch (error) {
    console.error("Failed to download Scrip Master:", error.message);
  }
}

// Download once on startup
downloadScripMaster();

// Mapping logic
function resolveSymbol(ticker) {
  if (!scripMaster || scripMaster.length === 0) return null;

  // 1. Handle MCX Commodities (e.g., GC=F -> GOLD)
  if (ticker === 'GC=F') return getNearestMCXContract('GOLD');
  if (ticker === 'SI=F') return getNearestMCXContract('SILVER');
  if (ticker === 'CL=F') return getNearestMCXContract('CRUDEOIL');
  if (ticker === 'HG=F') return getNearestMCXContract('COPPER');
  if (ticker === 'NG=F') return getNearestMCXContract('NATURALGAS');
  if (ticker === 'ALI=F') return getNearestMCXContract('ALUMINIUM');

  // 2. Handle NSE Equities (e.g., RELIANCE.NS -> RELIANCE-EQ)
  if (ticker.endsWith('.NS')) {
    const baseSymbol = ticker.replace('.NS', '') + '-EQ';
    return scripMaster.find(s => s.symbol === baseSymbol && s.exch_seg === 'NSE');
  }
  
  // 3. Handle BSE Equities
  if (ticker.endsWith('.BO')) {
    const baseSymbol = ticker.replace('.BO', '');
    return scripMaster.find(s => s.symbol === baseSymbol && s.exch_seg === 'BSE');
  }

  // 4. Handle Indices
  if (ticker.startsWith('^')) {
    const idxMap = {
      '^NSEI': 'Nifty 50',
      '^NSEBANK': 'Nifty Bank',
      '^BSESN': 'SENSEX'
    };
    const name = idxMap[ticker];
    if (name) {
      return scripMaster.find(s => s.name === name && s.exch_seg === 'NSE');
    }
  }

  // Fallback exact match
  return scripMaster.find(s => s.symbol === ticker);
}

function getNearestMCXContract(commodityName) {
  // Find all futures for this commodity
  const contracts = scripMaster.filter(s => 
    s.exch_seg === 'MCX' && 
    s.name === commodityName && 
    s.instrumenttype === 'FUTCOM'
  );

  if (contracts.length === 0) return null;

  // Sort by expiry string "DDMMMYYYY"
  // A naive sort is often sufficient since they are sequential, but parsing is better
  contracts.sort((a, b) => {
    const dateA = new Date(a.expiry);
    const dateB = new Date(b.expiry);
    return dateA - dateB;
  });

  // Return the nearest active one
  return contracts.find(c => new Date(c.expiry) >= new Date()) || contracts[0];
}


app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const angelSymbol = resolveSymbol(symbol);
    if (!angelSymbol) {
      return res.status(404).json({ error: "Symbol token mapping not found for " + symbol });
    }

    const quote = await getQuote(angelSymbol.exch_seg, angelSymbol);
    
    // Normalize to our StockQuote interface
    const normalizedQuote = {
      ticker: symbol,
      name: angelSymbol.symbol,
      exchange: angelSymbol.exch_seg,
      price: quote.ltp,
      previousClose: quote.close,
      open: quote.open,
      dayHigh: quote.high,
      dayLow: quote.low,
      volume: quote.tradeVolume || quote.volume || 0,
      avgVolume: 0,
      marketCap: 0,
      fiftyTwoWeekHigh: quote["52WeekHigh"] || 0,
      fiftyTwoWeekLow: quote["52WeekLow"] || 0,
      pe: null,
      currency: "INR",
      regularMarketTime: Date.now() / 1000,
      marketState: "REGULAR"
    };

    res.json(normalizedQuote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const angelSymbol = resolveSymbol(symbol);
    if (!angelSymbol) {
      return res.status(404).json({ error: "Symbol token mapping not found" });
    }

    const { interval, fromdate, todate } = req.query;
    // Map frontend timeframe to Angel One interval
    // Frontend uses: 1H (ONE_HOUR), 1D (ONE_DAY), 1W (not natively supported, might need to aggregate 1D)
    
    let angelInterval = "ONE_DAY";
    if (interval === '1h' || interval === '5m') angelInterval = "FIVE_MINUTE"; // fallback or map accurately
    if (interval === '1d') angelInterval = "ONE_DAY";

    const data = await getCandleData(angelSymbol.exch_seg, angelSymbol, angelInterval, fromdate, todate);
    
    // Angel One returns: [timestamp, open, high, low, close, volume]
    // Note: Timestamp is string like "2023-11-20T09:15:00+05:30"
    const candles = data.map(candle => {
      const time = new Date(candle[0]).getTime() / 1000;
      return {
        time: time,
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      };
    });

    res.json(candles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { ticker, indicatorSummary, quote, timeframe, includeWebNews, chartImageBase64 } = req.body;
    
    if (!ticker || !quote) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await analyzeStockByTicker(
      ticker,
      indicatorSummary,
      quote,
      timeframe,
      includeWebNews,
      chartImageBase64
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Angel One Backend Server running on port ${PORT}`);
});
