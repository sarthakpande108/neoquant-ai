const { SmartAPI } = require("smartapi-javascript");
const { TOTP } = require("totp-generator");
require("dotenv").config();

let smartApi = new SmartAPI({
  api_key: process.env.ANGEL_API_KEY,
});

let sessionData = null;

async function generateTotp() {
  const secret = process.env.ANGEL_TOTP_SECRET;
  if (!secret) throw new Error("ANGEL_TOTP_SECRET is missing");
  // totp-generator v3+ exports TOTP.generate() and it's asynchronous
  const { otp } = await TOTP.generate(secret);
  return otp;
}

async function login() {
  try {
    const otp = await generateTotp();
    console.log("Attempting login with TOTP:", otp);
    
    const response = await smartApi.generateSession(
      process.env.ANGEL_CLIENT_CODE,
      process.env.ANGEL_PIN, // This is your 4-digit MPIN
      otp
    );
    
    if (response.status) {
      sessionData = response.data;
      console.log("Angel One Login Successful");
    } else {
      console.error("Login Failed:", JSON.stringify(response));
      throw new Error(response.message || "Unknown login error: " + JSON.stringify(response));
    }
  } catch (ex) {
    console.error("Exception during login:", ex.message || ex);
    throw ex;
  }
}

async function getQuote(exchange, symbolToken) {
  if (!sessionData) await login();
  
  try {
    // We use marketData to get the live price
    const ltpData = await smartApi.marketData({
      mode: "FULL",
      exchangeTokens: {
        [exchange]: [symbolToken.token]
      }
    });
    
    if (ltpData.status) {
      if (ltpData.data.fetched && ltpData.data.fetched.length > 0) {
        return ltpData.data.fetched[0];
      } else {
        throw new Error("Token not fetched: " + JSON.stringify(ltpData.data));
      }
    } else {
      throw new Error(ltpData.message);
    }
  } catch (error) {
    // If token expired, we might need to relogin
    if (error.message && error.message.includes("Token is invalid")) {
      console.log("Token expired. Relogging in...");
      await login();
      return getQuote(exchange, symbolToken);
    }
    throw error;
  }
}

async function getCandleData(exchange, symbolToken, interval, fromdate, todate) {
  if (!sessionData) await login();
  
  try {
    const payload = {
      exchange: exchange,
      symboltoken: symbolToken.token,
      interval: interval, // ONE_MINUTE, FIVE_MINUTE, TEN_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, ONE_DAY
      fromdate: fromdate, // "yyyy-mm-dd hh:mm"
      todate: todate      // "yyyy-mm-dd hh:mm"
    };
    
    const histData = await smartApi.getCandleData(payload);
    if (histData.status) {
      return histData.data;
    } else {
      throw new Error(histData.message);
    }
  } catch (error) {
    if (error.message && error.message.includes("Token is invalid")) {
      await login();
      return getCandleData(exchange, symbolToken, interval, fromdate, todate);
    }
    throw error;
  }
}

// Ensure login on startup
login().catch(err => console.error("Initial login failed:", err.message));

module.exports = {
  login,
  getQuote,
  getCandleData
};
