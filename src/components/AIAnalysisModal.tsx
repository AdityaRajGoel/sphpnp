import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

import { motion, AnimatePresence } from "motion/react";
import {
  X, BrainCircuit, TrendingUp, TrendingDown, Activity, AlertTriangle,
  CheckCircle2, Bot, Info, Star, Share2, BarChart2, Zap, Sparkles, MessageSquare, Send, Users,
  Database, LineChart, Scale, Cpu, FileText, Check, Newspaper, ExternalLink
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchlist } from "@/hooks/useWatchlist";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";

export interface StockForAnalysis {
  name: string;
  symbol: string;
  price: string | number;
  change_pct?: number | null;
  pe?: number | null;
  high_52?: number | null;
  low_52?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  volume?: number | null;
  market_cap?: number | null;
  sector?: string | null;
  roe?: number | null;            // New metric
  debt_equity?: number | null;    // New metric
}

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockForAnalysis | null;
}

// Loading steps mirror the ACTUAL server pipeline (1Y OHLCV -> indicators ->
// patterns -> news -> fundamentals/peers -> model(s) -> report). The model step
// differs by mode: single reasoning model vs the parallel committee.
const REPORT_STEPS: { text: string; Icon: LucideIcon }[] = [
  { text: "Fetching 1-year price history", Icon: Database },
  { text: "Computing RSI, MACD, SMA & ADX", Icon: Activity },
  { text: "Scanning candlestick patterns", Icon: LineChart },
  { text: "Reading latest news & events", Icon: Newspaper },
  { text: "Benchmarking fundamentals vs peers", Icon: Scale },
  { text: "Running the reasoning model", Icon: Cpu },
  { text: "Grounding verdict in the quant engine", Icon: FileText },
];

const COMMITTEE_STEPS: { text: string; Icon: LucideIcon }[] = [
  { text: "Fetching 1-year price history", Icon: Database },
  { text: "Computing RSI, MACD, SMA & ADX", Icon: Activity },
  { text: "Scanning candlestick patterns", Icon: LineChart },
  { text: "Reading latest news & events", Icon: Newspaper },
  { text: "Benchmarking fundamentals vs peers", Icon: Scale },
  { text: "Convening the AI committee in parallel", Icon: Cpu },
  { text: "Comparing independent verdicts", Icon: Scale },
  { text: "Grounding verdict in the quant engine", Icon: FileText },
];

function IndicatorCard({ label, signal, desc, icon: Icon, delay }:
  { label: string; signal: string; desc: string; icon: React.ElementType; delay: number }) {
  const signalColors: Record<string, string> = {
    "Overbought": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Oversold": "bg-secondary/10 text-secondary border-secondary/20",
    "Neutral": "bg-muted text-muted-foreground border-border",
    "Bullish": "bg-secondary/10 text-secondary border-secondary/20",
    "Bearish": "bg-destructive/10 text-destructive border-destructive/20",
    "Above Avg": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Fair Value": "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
    "Strong": "bg-secondary/10 text-secondary border-secondary/20",
    "Weak": "bg-destructive/10 text-destructive border-destructive/20",
    "High Risk": "bg-destructive/10 text-destructive border-destructive/20"
  };
  return (
    <motion.div className="bg-muted/40 border border-border/40 rounded-xl p-3 flex flex-col gap-1.5"
      initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18, delay }}>
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold">
        <Icon className="w-3 h-3" />{label}
      </div>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border self-start ${signalColors[signal] || "bg-muted text-muted-foreground border-border"}`}>
        {signal}
      </span>
      <div className="text-[10px] text-muted-foreground leading-snug">{desc}</div>
    </motion.div>
  );
}

function computeAnalysis(stock: StockForAnalysis) {
  const priceNum = typeof stock.price === "string" ? parseFloat(stock.price.replace(/,/g, "")) : (stock.price ?? 0);
  const high52 = stock.high_52 ?? priceNum * 1.15;
  const low52 = stock.low_52 ?? priceNum * 0.85;
  const changePct = stock.change_pct ?? 0;
  
  const isFinancial = stock.sector === "Financial Services" || stock.symbol.includes("BANK");
  const roe = stock.roe ?? (isFinancial ? 14.5 : stock.pe && stock.pe > 0 ? 100 / stock.pe * 1.5 : 12.0);
  const debtEquity = stock.debt_equity ?? (isFinancial ? 3.5 : 0.4);

  const roeSignal = roe > 15 ? "Strong" : roe > 8 ? "Neutral" : "Weak";
  const roeDesc = `Return on Equity: ${roe.toFixed(1)}%. ${roe > 15 ? "Excellent capital efficiency." : "Average efficiency."}`;

  const deSignal = debtEquity > (isFinancial ? 5 : 1) ? "High Risk" : "Strong";
  const deDesc = `D/E Ratio: ${debtEquity.toFixed(2)}. ${deSignal === "Strong" ? "Healthy balance sheet." : "Highly leveraged."}`;

  const isBullish = changePct >= 0;
  const patterns: string[] = []; // Pattern detection is now done server-side with real data
  const score = Math.min(98, Math.max(10, 50 + changePct * 10 + (roe > 15 ? 10 : 0) - (debtEquity > 1 && !isFinancial ? 10 : 0)));

  return { 
    priceNum, high52, low52, changePct, score, isBullish,
    roeSignal, roeDesc, deSignal, deDesc, patterns,
  };
}

// Thematic loader: the AI "scanning" a live candlestick chart.
// Deterministic candle heights (no random-on-render), compositor-friendly motion.
const CANDLES = [28, 44, 22, 56, 38, 64, 30, 50, 72, 46, 60, 36];

const AnalysisScanner = () => {
  return (
    <div className="relative w-60 h-40 mb-7">
      <svg viewBox="0 0 240 120" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="scanGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand-orange))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(var(--brand-orange))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--brand-orange))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="scanTrail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand-orange))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--brand-orange))" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {[24, 56, 88].map((y) => (
          <line key={y} x1="0" y1={y} x2="240" y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5" />
        ))}

        {/* candlesticks */}
        {CANDLES.map((h, i) => {
          const x = 14 + i * 19;
          const up = i % 3 !== 1;
          const color = up ? "hsl(var(--secondary))" : "hsl(var(--destructive))";
          const bodyTop = 104 - h;
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: EASE_OUT }}
              style={{ transformOrigin: `${x}px 104px` }}
            >
              <line x1={x} y1={bodyTop - 7} x2={x} y2={110} stroke={color} strokeWidth="1.2" opacity="0.65" />
              <motion.rect
                x={x - 4} y={bodyTop} width="8" height={h} rx="1.5" fill={color}
                animate={{ opacity: [0.55, 0.95, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.12 }}
              />
            </motion.g>
          );
        })}

        {/* sweeping scan beam */}
        <motion.g
          initial={{ x: -24 }}
          animate={{ x: 240 }}
          transition={{ duration: 1.9, repeat: Infinity, ease: EASE_IN_OUT }}
        >
          <rect x="-24" y="0" width="24" height="112" fill="url(#scanTrail)" />
          <rect x="-1.5" y="0" width="3" height="112" fill="url(#scanGlow)" />
        </motion.g>
      </svg>

      {/* pulsing AI core badge */}
      <motion.div
        className="absolute -top-3 right-0 w-9 h-9 rounded-full bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center backdrop-blur-sm"
        animate={{ boxShadow: [
          "0 0 0px hsl(var(--brand-orange) / 0.35)",
          "0 0 14px hsl(var(--brand-orange) / 0.55)",
          "0 0 0px hsl(var(--brand-orange) / 0.35)",
        ] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <BrainCircuit className="w-4 h-4 text-brand-orange" />
      </motion.div>
    </div>
  );
};

export const AIAnalysisModal = ({ isOpen, onClose, stock }: AIAnalysisModalProps) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [aiResponseReady, setAiResponseReady] = useState(false);
  const [geminiVerdict, setGeminiVerdict] = useState<{ 
    analysis: string, 
    model: string,
    structured?: {
      sentiment_score: number;
      technical_signals: string[];
      bullish_signals: string[];
      bearish_signals: string[];
      action_verdict: string;
      insights: { quality: number; valuation: number; growth: number };
      key_indicators?: Record<string, string>;
      sector_comparison?: {
        pe_avg: number;
        roe_avg: number;
        valuation_status: string;
      };
      price_targets?: {
        support: number;
        resistance: number;
        target_1m: number;
        target_3m: number;
      };
      momentum_score?: number;
      volume_signal?: string;
      confidence?: number;
      rating_label?: string;
      score_breakdown?: { technical: number; fundamental: number | null; analyst: number | null };
      analyst_consensus?: {
        rating: string | null;
        mean: number | null;
        count: number | null;
        target_mean: number | null;
        target_high: number | null;
        target_low: number | null;
      };
      data_source?: string;
      detected_patterns?: string[];
      news_headlines?: { title: string; publisher: string; ageDays: number | null; link: string }[];
      committee?: {
        members: { model: string; verdict: string | null; conviction: number | null }[];
        quant_verdict: string;
        agreement: string;
      };
    }
  } | null>(null);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'chat'>('report');
  const [useWebSearch, setUseWebSearch] = useState(false);
  // Opt-in "Deep" mode: two open models answer in parallel and their
  // independent verdicts are compared against the quant engine.
  const [useCommittee, setUseCommittee] = useState(false);
  const analysisSteps = useCommittee ? COMMITTEE_STEPS : REPORT_STEPS;
  const [copied, setCopied] = useState(false);
  
  const sampleQuestions = [
    "What's the price target for 3 months?",
    "What are the key support & resistance levels?",
    "Is volume unusually high or low today?",
    "Is this a good time to buy?",
    "What are the top 3 risks I should know?",
    "How does the P/E compare to sector peers?",
    "Technical outlook for next month?",
    "Explain the detected chart pattern.",
  ];
  
  const endOfChatRef = useRef<HTMLDivElement>(null);
  
  // Ref to track the current request - prevents stale responses from overwriting
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (activeTab === 'chat') endOfChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, activeTab]);

  // Full state reset when modal opens or stock changes
  useEffect(() => {
    if (isOpen && stock) {
      // Invalidate any in-flight request immediately
      requestIdRef.current++;
      setIsAnalyzing(true); setLoadingStep(0); setGeminiVerdict(null);
      setChatHistory([]); setActiveTab('report');
      setMinTimeElapsed(false); setAiResponseReady(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on symbol/mount by design; object identities change every render
  }, [isOpen, stock?.symbol]);

  // Step animation - purely visual progress; does NOT gate dismissal
  useEffect(() => {
    if (!isOpen || !isAnalyzing) return;
    const interval = setInterval(() => {
      setLoadingStep(p => (p >= analysisSteps.length - 1 ? p : p + 1));
    }, 550);
    return () => clearInterval(interval);
  }, [isOpen, isAnalyzing, analysisSteps]);

  // Short minimum on-screen time so the loader doesn't flash if the AI is instant
  useEffect(() => {
    if (!isOpen || !isAnalyzing) return;
    const t = setTimeout(() => setMinTimeElapsed(true), 1200);
    return () => clearTimeout(t);
  }, [isOpen, isAnalyzing, stock?.symbol]);

  // Dismiss as soon as the real AI response is ready (past the brief minimum) -
  // no longer waits out the full decorative animation sequence.
  useEffect(() => {
    if (aiResponseReady && minTimeElapsed) setIsAnalyzing(false);
  }, [aiResponseReady, minTimeElapsed]);

  const analysis = stock ? computeAnalysis(stock) : null;

  // Fetch real sparkline data for the header chart
  const [sparklineData, setSparklineData] = useState<{day: number, price: number}[]>([]);
  useEffect(() => {
    if (!isOpen || !stock) { setSparklineData([]); return; }
    supabase.functions.invoke('fetch-stock-chart', {
      body: { symbol: stock.symbol, range: '1mo' }
    }).then(({ data }) => {
      if (data?.success && data.dataPoints?.length > 0) {
        setSparklineData(data.dataPoints.map((dp: { c: number }, i: number) => ({ day: i, price: dp.c })));
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on symbol/mount by design; object identities change every render
  }, [isOpen, stock?.symbol]);

  // Fetch Deep AI Report - fires when modal opens with a stock
  // Uses a requestId to discard stale responses when user switches stocks quickly
  useEffect(() => {
    if (!isOpen || !stock || !analysis) return;

    // Capture request ID AFTER the reset effect has incremented it
    const thisRequestId = requestIdRef.current;
    
    // Small delay to ensure state reset has propagated
    const fetchTimer = setTimeout(() => {
      const priceNum = analysis.priceNum;
      const isFinancial = stock.sector === "Financial Services" || stock.symbol.includes("BANK");
      const roeValue = stock.roe ?? (isFinancial ? 14.5 : stock.pe && stock.pe > 0 ? 100 / stock.pe * 1.5 : 12.0);
      const deValue = stock.debt_equity ?? (isFinancial ? 3.5 : 0.4);

      supabase.functions.invoke('ai-stock-analysis', {
        body: {
          symbol: stock.symbol, 
          name: stock.name, 
          price: priceNum,
          change_pct: analysis.changePct, 
          pe: stock.pe, 
          high_52: analysis.high52, 
          low_52: analysis.low52,
          market_cap: stock.market_cap, 
          volume: stock.volume, 
          sector: stock.sector,
          day_high: stock.day_high, 
          day_low: stock.day_low,
          roe: roeValue,
          debt_equity: deValue,
          patterns: analysis.patterns,
          score: analysis.score,
          isBullish: analysis.isBullish,
          deep_report: true,
          committee: useCommittee
        }
      })
        .then(({ data, error }) => {
          // CRITICAL: Discard if this response belongs to a stale request
          if (thisRequestId !== requestIdRef.current) {
            return;
          }

          if (error) {
            console.error("AI Analysis Error:", error);
            setGeminiVerdict({ 
              analysis: "⚠️ AI analysis is temporarily unavailable. Please try again in a moment.", 
              model: "error" 
            });
            setAiResponseReady(true);
            return;
          }
          if (data?.verdict) {
            let verdict = data.verdict;
            // Safety & Robustness: Handle truncated or malformed JSON responses
            if (typeof verdict === 'string') {
              try {
                // Attempt 1: Regular valid JSON cleanup and parse
                const cleaned = verdict.replace(/```json/g, "").replace(/```/g, "").trim();
                verdict = JSON.parse(cleaned);
              } catch (e) {
                console.warn("Standard JSON parse failed, attempting regex extraction...");
                
                // Attempt 2: Regex extraction for markdown_report even if truncated
                const mdMatch = verdict.match(/"markdown_report":\s*"([\s\S]*?)(?=",\s*"structured_data"|",\s*"|"}|$)/);
                const structuredMatch = verdict.match(/"structured_data":\s*({[\s\S]*?)(?=\s*,\s*"|}$|$)/);
                
                let extractedMd = mdMatch ? mdMatch[1] : null;
                if (extractedMd) {
                  extractedMd = extractedMd
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '')
                    .replace(/\\"/g, '"')
                    .replace(/\\t/g, '  ')
                    .trim();
                }
                
                let extractedStructured = null;
                if (structuredMatch) {
                  try {
                    let structStr = structuredMatch[1].trim();
                    if (!structStr.endsWith('}')) {
                      const openBraces = (structStr.match(/{/g) || []).length;
                      const closeBraces = (structStr.match(/}/g) || []).length;
                      structStr += '}'.repeat(Math.max(0, openBraces - closeBraces));
                    }
                    extractedStructured = JSON.parse(structStr);
                  } catch (err) {
                    console.warn("Regex-based structured data parse failed");
                  }
                }

                if (extractedMd) {
                  verdict = {
                    markdown_report: extractedMd,
                    structured_data: extractedStructured?.structured_data || extractedStructured
                  };
                }
              }
            }

            if (typeof verdict === 'object' && verdict !== null) {
              let finalMd = verdict.markdown_report || "Report content missing.";
              if (finalMd.startsWith('"') && finalMd.endsWith('"')) {
                finalMd = finalMd.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
              }

              setGeminiVerdict({ 
                analysis: finalMd, 
                model: data.model || 'AI Analysis',
                structured: verdict.structured_data || null
              });
              setAiResponseReady(true);
            } else {
              setGeminiVerdict({ 
                analysis: typeof verdict === 'string' ? verdict.replace(/\\n/g, '\n') : "Unable to parse AI response.", 
                model: data.model || 'AI Analysis' 
              });
              setAiResponseReady(true);
            }
          } else {
            setGeminiVerdict({ 
              analysis: "⚠️ The AI returned an empty response. Please try again.", 
              model: "error" 
            });
            setAiResponseReady(true);
          }
        }).catch(err => {
          // CRITICAL: Discard if this response belongs to a stale request
          if (thisRequestId !== requestIdRef.current) return;
          
          console.error("AI Analysis Fetch Error:", err);
          setGeminiVerdict({ 
            analysis: "⚠️ Could not connect to the AI engine. Please check your connection and try again.", 
            model: "error" 
          });
          setAiResponseReady(true);
        });
    }, 50); // Small delay to let state reset propagate

    return () => clearTimeout(fetchTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on symbol/mount by design; object identities change every render
  }, [isOpen, stock?.symbol, retryNonce]);

  // Shared context builder for chat - avoids duplicated code
  const buildChatContext = () => [
    `Stock: ${stock?.name} (${stock?.symbol})`,
    `Sector: ${stock?.sector || 'N/A'}`,
    `CMP: ₹${stock?.price}`,
    `Change: ${analysis?.changePct?.toFixed(2)}%`,
    `Day Range: ₹${stock?.day_low} – ₹${stock?.day_high}`,
    `52W High: ₹${analysis?.high52} | 52W Low: ₹${analysis?.low52}`,
    `P/E: ${stock?.pe || 'N/A'}`,
    `Market Cap: ₹${stock?.market_cap} Cr`,
    `Volume: ${stock?.volume}`,
    `Patterns: ${analysis?.patterns?.join(', ')}`,
    `Score: ${analysis?.score}/100`,
    `Momentum: ${analysis?.isBullish ? 'Bullish' : 'Bearish'}`,
  ].join(' | ');

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !stock || isChatting) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      const richContext = buildChatContext();

      const { data, error } = await supabase.functions.invoke('ai-stock-analysis', {
        body: {
          symbol: stock.symbol, is_chat: true, chat_message: userMsg,
          chat_history: chatHistory.slice(-10), 
          context: richContext,
          ai_report_summary: geminiVerdict?.analysis?.slice(0, 1500) || '',
          use_web_search: useWebSearch
        }
      });
      
      if (error) throw error;
      setChatHistory(prev => [...prev, { role: 'ai', text: data.verdict || "I encountered an error." }]);
    } catch (err) {
      console.error("Chat Error:", err);
      setChatHistory(prev => [...prev, { role: 'ai', text: "Failed to connect to the AI brain." }]);
    } finally { setIsChatting(false); }
  };

  const handleSampleQuestion = async (q: string) => {
    if (isChatting) return;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: q }]);
    setIsChatting(true);
    try {
      const richContext = buildChatContext();
      const { data, error } = await supabase.functions.invoke('ai-stock-analysis', {
        body: {
          symbol: stock.symbol, is_chat: true, chat_message: q,
          chat_history: chatHistory.slice(-10),
          context: richContext,
          ai_report_summary: geminiVerdict?.analysis?.slice(0, 1500) || '',
          use_web_search: useWebSearch
        }
      });
      if (error) throw error;
      setChatHistory(prev => [...prev, { role: 'ai', text: data.verdict || "I encountered an error." }]);
    } catch (err) {
      console.error("Chat Error:", err);
      setChatHistory(prev => [...prev, { role: 'ai', text: "Failed to connect to the AI brain. Please try again." }]);
    } finally { setIsChatting(false); }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  if (!stock || !analysis) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border border-brand-orange/30 bg-background max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 bg-muted/40 backdrop-blur-md flex items-center justify-between z-10">
          <div>
            <DialogTitle className="flex items-center gap-2 font-heading text-xl">
              <Bot className="w-5 h-5 text-brand-orange" /> Parasram Intelligence
              <span className="text-[10px] uppercase font-bold bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full border border-brand-orange/20">Beta</span>
            </DialogTitle>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {stock.symbol} {stock.sector ? `· ${stock.sector}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Share buttons - only show after analysis is complete */}
            {!isAnalyzing && geminiVerdict && (
              <>
                <button
                  onClick={() => {
                    const verdict = geminiVerdict?.structured?.action_verdict || (analysis.isBullish ? "BULLISH" : "BEARISH");
                    const score = geminiVerdict?.structured?.sentiment_score ?? analysis.score;
                    const oneLiner = geminiVerdict?.structured?.bullish_signals?.[0] || "";
                    const text = `📊 *${stock.symbol} AI Analysis* by Parasram Intelligence\n\n` +
                      `💰 Price: ₹${analysis.priceNum.toLocaleString("en-IN")}\n` +
                      `📈 Signal: ${verdict}\n` +
                      `🎯 AI Score: ${score}/100\n\n` +
                      (oneLiner ? `${oneLiner}\n\n` : "") +
                      `🔗 Analyse more stocks at sphpnp.com/screener`;
                    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(waUrl, "_blank");
                  }}
                  aria-label="Share on WhatsApp"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-green-500/10 text-muted-foreground hover:text-green-500 transition-colors"
                  title="Share on WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const verdict = geminiVerdict?.structured?.action_verdict || (analysis.isBullish ? "BULLISH" : "BEARISH");
                    const score = geminiVerdict?.structured?.sentiment_score ?? analysis.score;
                    const oneLiner = geminiVerdict?.structured?.bullish_signals?.[0] || "";
                    const text = `${stock.symbol} AI Analysis by Parasram Intelligence\n\n` +
                      `Price: ₹${analysis.priceNum.toLocaleString("en-IN")}\n` +
                      `Signal: ${verdict}\n` +
                      `AI Score: ${score}/100\n\n` +
                      (oneLiner ? `${oneLiner}\n\n` : "") +
                      `Analyse more stocks at https://sphpnp.com/screener`;
                    navigator.clipboard.writeText(text);
                    // Brief visual feedback via React state (no direct DOM mutation)
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  aria-label="Copy analysis"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <Share2 className="w-4 h-4" />}
                </button>
              </>
            )}
            <button onClick={onClose} aria-label="Close analysis" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted/80 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto w-full relative">
          <AnimatePresence mode="wait">
            {isAnalyzing ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 md:py-14 p-6">
                <AnalysisScanner />
                {useCommittee && (
                  <span className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full bg-brand-orange/10 border border-brand-orange/30 text-brand-orange text-[10px] font-bold uppercase tracking-wider">
                    <Cpu className="w-3 h-3" /> Committee Mode · models in parallel
                  </span>
                )}
                <div className="w-64 flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Analyzing</span>
                  <span className="text-[11px] font-bold text-brand-orange tabular-nums">
                    {Math.round(((loadingStep + 1) / analysisSteps.length) * 100)}%
                  </span>
                </div>
                <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mb-8 shadow-inner">
                  <motion.div className="h-full bg-gradient-to-r from-brand-orange via-secondary to-brand-orange bg-[length:200%_100%]"
                    initial={{ width: "0%", backgroundPosition: "100% 0" }}
                    animate={{ width: `${((loadingStep + 1) / analysisSteps.length) * 100}%`, backgroundPosition: "0% 0" }}
                    transition={{
                      width: { duration: 0.6 },
                      backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" }
                    }} />
                </div>
                <div className="space-y-2.5 w-full max-w-[280px]">
                  {analysisSteps.map((step, idx) => {
                    const done = idx < loadingStep;
                    const active = idx === loadingStep;
                    const StepIcon = step.Icon;
                    return (
                      <motion.div
                        key={idx}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: done || active ? 1 : 0.45, x: 0 }}
                        transition={{ delay: idx * 0.07 }}
                      >
                        <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors duration-base ${
                          done ? "bg-secondary/10 border-secondary/30"
                          : active ? "bg-brand-orange/10 border-brand-orange/40"
                          : "bg-muted/40 border-border/50"
                        }`}>
                          {done
                            ? <Check className="w-4 h-4 text-secondary" strokeWidth={2.5} />
                            : <StepIcon className={`w-4 h-4 ${active ? "text-brand-orange" : "text-muted-foreground/60"}`} />}
                          {active && <span className="absolute inset-0 rounded-lg border border-brand-orange/50 animate-ping" />}
                        </div>
                        <span className={`text-sm transition-colors duration-base ${
                          active ? "text-foreground font-semibold"
                          : done ? "text-foreground/70"
                          : "text-muted-foreground/50"
                        }`}>
                          {step.text}
                        </span>
                        {active && (
                          <div className="ml-auto w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
                {/* Tabs */}
                <div className="px-5 border-b border-border/50 flex items-center gap-6 bg-muted/20">
                  <button onClick={() => setActiveTab('report')} aria-label="View deep analysis report" className={`py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'report' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-muted-foreground'}`}>Deep Analysis</button>
                  <button onClick={() => setActiveTab('chat')} aria-label="Ask AI questions" className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'chat' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-muted-foreground'}`}><MessageSquare className="w-4 h-4" /> Ask AI Q&A</button>
                  <button
                    onClick={() => {
                      const next = !useCommittee;
                      setUseCommittee(next);
                      // Re-run the analysis in the requested mode
                      requestIdRef.current++;
                      setGeminiVerdict(null);
                      setIsAnalyzing(true);
                      setLoadingStep(0);
                      setMinTimeElapsed(false);
                      setAiResponseReady(false);
                      setRetryNonce(n => n + 1);
                    }}
                    title="Deep committee mode: two AI models analyse in parallel and their independent verdicts are compared"
                    aria-pressed={useCommittee}
                    className={`ml-auto my-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${useCommittee ? "bg-brand-orange text-white border-brand-orange" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-brand-orange/40"}`}
                  >
                    <Cpu className="w-3 h-3" /> Committee
                  </button>
                </div>

                {/* Tab: Report */}
                {activeTab === 'report' && (
                  <div className="p-5 space-y-5">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 flex gap-2 items-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <div className="text-[10px] text-orange-700 dark:text-orange-400 font-medium leading-none">
                        AI may provide inaccurate data. Please verify with financial experts.
                      </div>
                    </div>
                    
                    {/* Header Widget */}
                    <div className="flex justify-between items-center bg-card border rounded-xl p-4 shadow-sm">
                      <div>
                        <div className="text-2xl font-bold flex items-center gap-2">
                          ₹{analysis.priceNum.toLocaleString("en-IN")}
                          <span className={`text-sm px-2 py-0.5 rounded-full ${analysis.changePct >= 0 ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                            {analysis.changePct >= 0 ? "+" : ""}{analysis.changePct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(geminiVerdict?.structured?.detected_patterns || []).map(p => (
                            <span key={p} className="text-[10px] bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded border border-brand-gold/30 flex items-center gap-1"><Sparkles className="w-3 h-3"/> {p}</span>
                          ))}
                        </div>
                      </div>
                      <div className="w-32 h-16 pointer-events-none">
                        {sparklineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={sparklineData}>
                            <defs>
                              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={analysis.isBullish ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={analysis.isBullish ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="price" stroke={analysis.isBullish ? "#10b981" : "#ef4444"} fill="url(#colorPrice)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <Activity className="w-6 h-6 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fundamentals Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <IndicatorCard label="Return on Equity" signal={analysis.roeSignal} desc={analysis.roeDesc} icon={TrendingUp} delay={0.1} />
                      <IndicatorCard label="Debt to Equity" signal={analysis.deSignal} desc={analysis.deDesc} icon={AlertTriangle} delay={0.2} />
                    </div>

                    {/* Price Targets Card - shown when AI has returned structured data */}
                    {geminiVerdict?.structured?.price_targets && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-brand-orange/5 via-transparent to-secondary/5 border border-brand-orange/20 rounded-xl p-4"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <Zap className="w-3.5 h-3.5 text-brand-orange" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Price Targets</span>
                          {geminiVerdict.structured.volume_signal && (
                            <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              geminiVerdict.structured.volume_signal === 'High' ? 'bg-orange-500/10 text-orange-500 border-orange-500/30' :
                              geminiVerdict.structured.volume_signal === 'Low' ? 'bg-muted text-muted-foreground border-border' :
                              'bg-secondary/10 text-secondary border-secondary/30'
                            }`}>
                              Vol: {geminiVerdict.structured.volume_signal}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {[
                            { label: "Support", value: geminiVerdict.structured.price_targets.support, color: "text-secondary", bg: "bg-secondary/10" },
                            { label: "Resistance", value: geminiVerdict.structured.price_targets.resistance, color: "text-destructive", bg: "bg-destructive/10" },
                            { label: "Target 1M", value: geminiVerdict.structured.price_targets.target_1m, color: "text-brand-orange", bg: "bg-brand-orange/10" },
                            { label: "Target 3M", value: geminiVerdict.structured.price_targets.target_3m, color: "text-brand-gold", bg: "bg-brand-gold/10" },
                          ].map(({ label, value, color, bg }) => (
                            <div key={label} className={`${bg} rounded-lg p-3 text-center`}>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">{label}</p>
                              <p className={`text-sm font-black font-mono ${color}`}>
                                {value > 0 ? `₹${value.toLocaleString("en-IN")}` : "-"}
                              </p>
                              {value > 0 && analysis.priceNum > 0 && (
                                <p className={`text-[8px] font-medium mt-0.5 ${value >= analysis.priceNum ? "text-secondary" : "text-destructive"}`}>
                                  {value >= analysis.priceNum ? "+" : ""}{(((value - analysis.priceNum) / analysis.priceNum) * 100).toFixed(1)}%
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Price range bar: support → current → resistance */}
                        {geminiVerdict.structured.price_targets.support > 0 && geminiVerdict.structured.price_targets.resistance > 0 && (
                          <div>
                            <div className="flex justify-between text-[8px] text-muted-foreground mb-1">
                              <span>Support ₹{geminiVerdict.structured.price_targets.support.toLocaleString("en-IN")}</span>
                              <span>Resistance ₹{geminiVerdict.structured.price_targets.resistance.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full relative overflow-hidden">
                              <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-secondary via-brand-orange to-destructive rounded-full" style={{ width: "100%", opacity: 0.3 }} />
                              <motion.div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-brand-orange rounded-full z-10 shadow"
                                initial={{ left: "50%" }}
                                animate={{
                                  left: `${Math.min(95, Math.max(5,
                                    ((analysis.priceNum - geminiVerdict.structured.price_targets.support) /
                                    (geminiVerdict.structured.price_targets.resistance - geminiVerdict.structured.price_targets.support)) * 100
                                  ))}%`
                                }}
                                transition={{ duration: 0.8, ease: EASE_OUT }}
                                style={{ transform: "translate(-50%, -50%)" }}
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* New Infographics Section */}
                    {geminiVerdict?.structured && (
                      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Sentiment Meter */}
                          <div className="bg-card border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase mb-2">AI Sentiment</span>
                            <div className="relative w-20 h-20 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/30" />
                                <motion.circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" 
                                  strokeDasharray={2 * Math.PI * 36}
                                  initial={{ strokeDashoffset: 2 * Math.PI * 36 }}
                                  animate={{ strokeDashoffset: 2 * Math.PI * 36 * (1 - geminiVerdict.structured.sentiment_score / 100) }}
                                  transition={{ duration: 1.5, ease: EASE_OUT }}
                                  className={geminiVerdict.structured.sentiment_score > 60 ? "text-secondary" : geminiVerdict.structured.sentiment_score > 40 ? "text-brand-gold" : "text-destructive"} 
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl font-bold">{geminiVerdict.structured.sentiment_score}</span>
                                <span className="text-[8px] font-medium text-muted-foreground">SCORE</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Verdict and Insight Badges */}
                          <div className="bg-card border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Verdict & Insights</span>
                            <div className={`text-2xl font-black px-4 py-2 rounded-lg border-2 mb-3 ${
                              geminiVerdict.structured.action_verdict === 'BUY' ? 'bg-secondary/10 text-secondary border-secondary/50' :
                              geminiVerdict.structured.action_verdict === 'SELL' ? 'bg-destructive/10 text-destructive border-destructive/50' :
                              'bg-brand-gold/10 text-brand-gold border-brand-gold/50'
                            }`}>
                              {geminiVerdict.structured.action_verdict}
                            </div>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {(geminiVerdict.structured.technical_signals || []).slice(0, 2).map((tag, i) => (
                                <span key={i} className="text-[8px] font-bold bg-muted px-1.5 py-0.5 rounded border border-border/50 uppercase tracking-tighter">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Tech IQ Radar Chart */}
                          {geminiVerdict.structured.insights && (
                            <div className="bg-card border rounded-xl p-4 flex flex-col items-center">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Tech IQ Radar</span>
                              <div className="w-full h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="55%" outerRadius="80%" data={[
                                    { subject: 'Quality', A: geminiVerdict.structured.insights.quality || 0, fullMark: 100 },
                                    { subject: 'Valuation', A: geminiVerdict.structured.insights.valuation || 0, fullMark: 100 },
                                    { subject: 'Growth', A: geminiVerdict.structured.insights.growth || 0, fullMark: 100 },
                                  ]}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fontWeight: 700 }} />
                                    <Radar name="Stock" dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.5} />
                                  </RadarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Analyst Consensus - real Wall Street data from Yahoo */}
                        {geminiVerdict.structured.analyst_consensus && geminiVerdict.structured.analyst_consensus.count ? (
                          <div className="bg-gradient-to-r from-secondary/5 to-brand-orange/5 border border-secondary/20 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <Users className="w-3 h-3" /> Analyst Consensus
                                <span className="text-[9px] font-normal normal-case">({geminiVerdict.structured.analyst_consensus.count} analysts)</span>
                              </div>
                              {geminiVerdict.structured.analyst_consensus.rating && (
                                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                                  {geminiVerdict.structured.analyst_consensus.rating.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              {[
                                { label: "Low", value: geminiVerdict.structured.analyst_consensus.target_low, color: "text-destructive" },
                                { label: "Mean Target", value: geminiVerdict.structured.analyst_consensus.target_mean, color: "text-brand-orange" },
                                { label: "High", value: geminiVerdict.structured.analyst_consensus.target_high, color: "text-secondary" },
                              ].map(({ label, value, color }) => (
                                <div key={label} className="bg-card/60 rounded-lg p-2">
                                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">{label}</p>
                                  <p className={`text-sm font-black font-mono ${color}`}>{value ? `₹${value.toLocaleString("en-IN")}` : "-"}</p>
                                  {value && analysis.priceNum > 0 && label === "Mean Target" && (
                                    <p className={`text-[8px] font-medium mt-0.5 ${value >= analysis.priceNum ? "text-secondary" : "text-destructive"}`}>
                                      {value >= analysis.priceNum ? "+" : ""}{(((value - analysis.priceNum) / analysis.priceNum) * 100).toFixed(1)}% upside
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Recent News - headlines fed into the verdict (Yahoo Finance) */}
                        {geminiVerdict.structured.news_headlines && geminiVerdict.structured.news_headlines.length > 0 && (
                          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 mb-3">
                              <Newspaper className="w-3 h-3" /> Recent News
                              <span className="text-[9px] font-normal normal-case">factored into this verdict</span>
                            </div>
                            <ul className="space-y-2">
                              {geminiVerdict.structured.news_headlines.slice(0, 5).map((n, i) => {
                                const href = n.link && /^https?:\/\//.test(n.link) ? n.link : undefined;
                                const Row = href ? "a" : "div";
                                return (
                                  <li key={i}>
                                    <Row
                                      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
                                      className={`flex items-start gap-2 text-xs leading-snug ${href ? "group hover:text-secondary transition-colors" : ""}`}
                                    >
                                      <span className="text-[9px] font-semibold text-muted-foreground/70 mt-0.5 shrink-0 tabular-nums">
                                        {n.ageDays != null ? `${n.ageDays}d` : "•"}
                                      </span>
                                      <span className="flex-1 text-foreground">
                                        {n.title}
                                        {n.publisher && <span className="text-muted-foreground/60 font-normal"> · {n.publisher}</span>}
                                      </span>
                                      {href && <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-secondary shrink-0 mt-0.5" />}
                                    </Row>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* AI Committee - independent model verdicts vs the quant engine */}
                        {geminiVerdict.structured.committee && geminiVerdict.structured.committee.members.length > 0 && (
                          <div className="bg-gradient-to-r from-brand-orange/5 to-secondary/5 border border-brand-orange/20 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <Cpu className="w-3 h-3" /> AI Committee
                                <span className="text-[9px] font-normal normal-case">independent second opinions</span>
                              </div>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${geminiVerdict.structured.committee.agreement === "Unanimous" ? "bg-secondary/15 text-secondary border-secondary/30" : geminiVerdict.structured.committee.agreement === "Split" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-brand-gold/15 text-brand-gold border-brand-gold/30"}`}>
                                {geminiVerdict.structured.committee.agreement}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {geminiVerdict.structured.committee.members.map((m, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground truncate flex-1" title={m.model}>{m.model.replace(/ \(OpenRouter\)$/, "").replace(/:free$/, "")}</span>
                                  <span className={`font-black ${m.verdict === "BUY" ? "text-secondary" : m.verdict === "SELL" ? "text-destructive" : "text-foreground"}`}>
                                    {m.verdict ?? "-"}
                                  </span>
                                  {m.conviction != null && <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{m.conviction}%</span>}
                                </div>
                              ))}
                              <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-border/40">
                                <span className="text-muted-foreground font-semibold">Quant engine (authoritative)</span>
                                <span className={`font-black ${geminiVerdict.structured.committee.quant_verdict === "BUY" ? "text-secondary" : geminiVerdict.structured.committee.quant_verdict === "SELL" ? "text-destructive" : "text-foreground"}`}>
                                  {geminiVerdict.structured.committee.quant_verdict}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quant Score Breakdown - shows how the composite rating was built */}
                        {geminiVerdict.structured.score_breakdown && (
                          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <BarChart2 className="w-3 h-3" /> Quant Score Breakdown
                              </div>
                              {geminiVerdict.structured.confidence != null && (
                                <span className="text-[9px] font-bold text-muted-foreground">Confidence {geminiVerdict.structured.confidence}%</span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {[
                                { label: "Technical", value: geminiVerdict.structured.score_breakdown.technical, color: "bg-brand-orange" },
                                { label: "Fundamental", value: geminiVerdict.structured.score_breakdown.fundamental, color: "bg-secondary" },
                                { label: "Analyst", value: geminiVerdict.structured.score_breakdown.analyst, color: "bg-brand-gold" },
                              ].map(({ label, value, color }) => (
                                <div key={label} className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
                                  {value != null ? (
                                    <>
                                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <motion.div className={`h-full ${color} rounded-full`} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.7 }} />
                                      </div>
                                      <span className="text-[10px] font-bold font-mono w-8 text-right">{value}</span>
                                    </>
                                  ) : (
                                    <span className="flex-1 text-[9px] text-muted-foreground/60 italic">not available</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sector Comparison Widget */}
                        {geminiVerdict.structured.sector_comparison && typeof geminiVerdict.structured.sector_comparison.pe_avg === 'number' && (
                          <div className="bg-gradient-to-r from-brand-orange/5 to-secondary/5 border border-brand-orange/10 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                <BarChart2 className="w-3 h-3" /> Sector Peer Benchmark
                              </div>
                              {geminiVerdict.structured.sector_comparison.valuation_status && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  geminiVerdict.structured.sector_comparison.valuation_status.includes('Discount') ? 'bg-secondary/20 text-secondary' : 'bg-orange-500/20 text-orange-500'
                                }`}>
                                  {geminiVerdict.structured.sector_comparison.valuation_status}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground">P/E vs Sector Avg</div>
                                <div className="flex items-end gap-2 text-sm font-bold">
                                  {stock.pe || 'N/A'} <span className="text-[10px] font-normal text-muted-foreground">vs</span> {geminiVerdict.structured.sector_comparison.pe_avg}
                                </div>
                                <div className="h-1 w-full bg-muted rounded-full overflow-hidden flex">
                                  <div className="h-full bg-brand-orange" style={{ width: `${Math.min(100, (stock.pe || 0) / (Math.max(1, geminiVerdict.structured.sector_comparison.pe_avg) * 2) * 100)}%` }} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground">ROE vs Sector Avg</div>
                                <div className="flex items-end gap-2 text-sm font-bold">
                                  {stock.roe || 'N/A'}% <span className="text-[10px] font-normal text-muted-foreground">vs</span> {geminiVerdict.structured.sector_comparison.roe_avg || 0}%
                                </div>
                                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (stock.roe || 0) / (Math.max(1, geminiVerdict.structured.sector_comparison.roe_avg || 15) * 2) * 100)}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Improved Signals Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-secondary font-bold text-xs uppercase">
                              <TrendingUp className="w-4 h-4" /> Strong Positives
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(geminiVerdict.structured.bullish_signals || []).map((s, i) => (
                                <span key={i} className="bg-secondary/10 text-secondary text-[10px] px-2 py-1 rounded-md border border-secondary/20 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> {s}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-destructive font-bold text-xs uppercase">
                              <TrendingDown className="w-4 h-4" /> Risk Factors
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(geminiVerdict.structured.bearish_signals || []).map((s, i) => (
                                <span key={i} className="bg-destructive/10 text-destructive text-[10px] px-2 py-1 rounded-md border border-destructive/20 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Technical Indicators Sub-grid */}
                        {geminiVerdict.structured.key_indicators && (
                          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                              <Activity className="w-3 h-3" /> Core Technical Indicators
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(geminiVerdict.structured.key_indicators).map(([key, val]) => (
                                <div key={key} className="flex flex-col gap-0.5">
                                  <span className="text-[10px] text-muted-foreground font-medium">{key}</span>
                                  <span className="text-xs font-bold">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Markdown Report & AI Warning */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <BarChart2 className="w-4 h-4 text-brand-orange" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Detailed Intelligence Report</h3>
                      </div>
                      <div className="bg-muted/30 border border-border/50 rounded-xl p-5 prose prose-sm dark:prose-invert max-w-none shadow-inner prose-headings:text-brand-orange prose-h1:text-xl prose-h2:text-lg prose-table:border prose-table:border-border/50 prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2">
                        {geminiVerdict ? (
                          <>
                            <Markdown remarkPlugins={[remarkGfm]}>{geminiVerdict.analysis}</Markdown>
                            {geminiVerdict.model !== 'error' && (
                              <div className="flex justify-end mt-4 not-prose">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(geminiVerdict.analysis);
                                  }}
                                  aria-label="Copy report to clipboard"
                                  className="text-[10px] font-medium text-muted-foreground hover:text-brand-orange transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50"
                                >
                                  <Share2 className="w-3 h-3" /> Copy Report
                                </button>
                              </div>
                            )}
                            {geminiVerdict.model === 'error' && (
                              <div className="flex justify-center mt-4 not-prose">
                                <button
                                  onClick={() => {
                                    requestIdRef.current++;
                                    setGeminiVerdict(null);
                                    setIsAnalyzing(true);
                                    setLoadingStep(0);
                                    setMinTimeElapsed(false);
                                    setAiResponseReady(false);
                                    setRetryNonce(n => n + 1);
                                  }}
                                  className="text-xs font-semibold text-brand-orange hover:text-brand-orange/80 transition-colors flex items-center gap-1.5 px-4 py-2 rounded-lg border border-brand-orange/30 hover:bg-brand-orange/5"
                                >
                                  <Zap className="w-3.5 h-3.5" /> Retry Analysis
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground animate-pulse py-8 justify-center">
                            <Bot className="w-5 h-5" /> Generating deep markdown report...
                          </div>
                        )}
                      </div>

                      <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 flex gap-3 items-start">
                        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-muted-foreground leading-relaxed">
                          <span className="font-bold text-orange-500 uppercase mr-1">AI Disclaimer:</span>
                          This analysis is generated by Artificial Intelligence for informational purposes only. Investment in stocks involves high risk. Please consult with a certified financial advisor before making any investment decisions. Parasram India is not responsible for any financial losses.
                        </div>
                      </div>
                      {geminiVerdict && (
                        <div className="flex items-center justify-center gap-2 py-2 text-[9px] text-muted-foreground/60">
                          <BrainCircuit className="w-3 h-3" />
                          <span>Powered by <b className="text-muted-foreground/80">{geminiVerdict.model}</b></span>
                          <span className="px-1.5 py-0.5 bg-brand-orange/10 text-brand-orange rounded-full font-bold">AI</span>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* Tab: Chat */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col h-[450px]">
                    <div className="px-5 py-2 bg-orange-500/5 border-b border-orange-500/10 flex gap-2 items-center">
                      <Info className="w-3 h-3 text-orange-500 shrink-0" />
                      <div className="text-[9px] text-muted-foreground uppercase tracking-tight font-bold">
                        AI Chat Advice: Non-Financial Advice. Use for Research only.
                      </div>
                    </div>
                    <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-muted/10">
                      
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-3">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-brand-orange/20 flex items-center justify-center"><Bot className="w-4 h-4 text-brand-orange"/></div>
                          <div className="bg-card border rounded-2xl rounded-tl-none p-3 text-sm text-foreground shadow-sm">
                            I am your Parasram AI associate. I've analyzed {stock.symbol}'s charts and fundamentals. What specific questions do you have before making an investment decision?
                          </div>
                        </div>
                        {chatHistory.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearChat} className="text-[10px] h-7 px-2 text-muted-foreground hover:text-destructive">
                            Clear Chat
                          </Button>
                        )}
                      </div>

                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-secondary' : 'bg-brand-orange/20'}`}>
                            {msg.role === 'user' ? <div className="text-xs font-bold text-background">YOU</div> : <Bot className="w-4 h-4 text-brand-orange"/>}
                          </div>
                          <div className={`border rounded-2xl p-3 text-sm shadow-sm max-w-[85%] backdrop-blur-md ${msg.role === 'user' ? 'bg-secondary/90 text-background border-secondary rounded-tr-none' : 'bg-card/70 text-foreground border-border/50 rounded-tl-none prose prose-sm dark:prose-invert shadow-[0_4px_12px_rgba(0,0,0,0.05)]'}`}>
                            {msg.role === 'ai' ? <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown> : msg.text}
                            {msg.role === 'ai' && <div className="text-[8px] opacity-30 mt-2 flex items-center gap-1"><BrainCircuit className="w-2 h-2"/> Analysis by Parasram Intelligence</div>}
                          </div>
                        </div>
                      ))}

                      {isChatting && (
                        <div className="flex gap-3">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-brand-orange/20 flex items-center justify-center"><Bot className="w-4 h-4 text-brand-orange"/></div>
                          <div className="bg-card border rounded-2xl rounded-tl-none p-4 text-sm flex gap-1 shadow-sm items-center">
                            <motion.div animate={{y:[0,-4,0]}} transition={{repeat:Infinity, delay:0}} className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                            <motion.div animate={{y:[0,-4,0]}} transition={{repeat:Infinity, delay:0.2}} className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                            <motion.div animate={{y:[0,-4,0]}} transition={{repeat:Infinity, delay:0.4}} className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                          </div>
                        </div>
                      )}
                      <div ref={endOfChatRef} />
                    </div>

                    {/* Chat Input & Samples */}
                    <div className="p-4 border-t border-border/50 bg-background space-y-3">
                      {/* Sample Questions Chips */}
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar -mx-1 px-1">
                        {sampleQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleSampleQuestion(q)}
                            disabled={isChatting}
                            className="shrink-0 text-[10px] font-medium bg-muted/50 hover:bg-brand-orange/10 hover:text-brand-orange border border-border/50 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
                          >
                            {q}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleChatSubmit} className="flex flex-col gap-2 shrink-0">
                        <div className="flex items-center gap-2 px-2">
                          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors">
                            <input 
                              type="checkbox" 
                              checked={useWebSearch} 
                              onChange={(e) => setUseWebSearch(e.target.checked)}
                              className="accent-brand-orange w-3.5 h-3.5"
                            />
                            Enable AI Live Web Search (News & Events)
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={`Ask AI about ${stock.symbol}...`} className="bg-muted/40 rounded-full h-10 px-4" />
                          <Button type="submit" disabled={isChatting || !chatInput.trim()} size="icon" className="h-10 w-10 shrink-0 rounded-full bg-brand-orange hover:bg-brand-orange/90">
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalysisModal;
