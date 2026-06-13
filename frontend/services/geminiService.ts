import type { AnalysisData, NewsSource, StockQuote } from "../types";

export async function analyzeStockByTicker(
  ticker: string,
  indicatorSummary: string,
  quote: StockQuote,
  timeframe: string,
  includeWebNews: boolean,
  chartImageBase64?: string
): Promise<{ analysis: AnalysisData | null; sources: NewsSource[] | null }> {
  try {
    let backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    if (!backendUrl.startsWith('http')) backendUrl = 'https://' + backendUrl;
    const response = await fetch(`${backendUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker,
        indicatorSummary,
        quote,
        timeframe,
        includeWebNews,
        chartImageBase64
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { analysis: data.analysis, sources: data.sources };
  } catch (error) {
    console.error("Error calling backend analyze API:", error);
    throw new Error("Failed to get AI analysis from backend. Ensure backend is running.");
  }
}
