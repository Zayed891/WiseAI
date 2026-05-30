"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Eye, Heart, MessageCircle, Clock, Calendar, Zap, Loader2, Check, Download, FileText, Layers, Sparkles,
} from "lucide-react";
import { FaYoutube, FaInstagram } from "react-icons/fa";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VideoMeta {
  video_id: string;
  url: string;
  title: string;
  creator: string;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  upload_date: string;
  duration_seconds: number;
  engagement_rate: number;
  engagement_note: string;
  likes_hidden: boolean;
  thumbnail_url?: string;
}

interface Citation {
  video_id: string;
  chunk_index: number;
  score: number;
  creator: string;
  url: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatDate(raw: string): string {
  if (!raw) return "Unknown";
  if (/^\d{10,}$/.test(raw))
    return new Date(parseInt(raw) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  if (/^\d{8}$/.test(raw))
    return new Date(`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  if (raw.includes("T")) return new Date(raw).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return raw;
}

function EngagementBadge({ rate }: { rate: number }) {
  if (rate > 3) return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">🔥 {rate.toFixed(2)}% Engagement</span>;
  if (rate >= 1) return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">📊 {rate.toFixed(2)}% Engagement</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">📉 {rate.toFixed(2)}% Engagement</span>;
}

// ── Navbar ─────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <Link href="/" className="flex items-center gap-2.5">
        <Zap size={18} fill="#0f172a" className="text-slate-900" />
        <span className="text-base font-bold text-slate-900" style={{ fontFamily: "var(--font-syne)" }}>WiseAI</span>
        <span className="text-xs text-slate-400 font-medium hidden sm:block">· AI Video Intelligence</span>
      </Link>
      <Badge className="text-xs font-semibold px-3 py-1" style={{ background: "#0f172a", color: "white", border: "none" }}>
        RAG Powered
      </Badge>
    </nav>
  );
}

// ── URL Input Screen ───────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { icon: Download, label: "Fetching video data" },
  { icon: FileText, label: "Extracting transcripts" },
  { icon: Layers, label: "Embedding & indexing chunks" },
  { icon: Sparkles, label: "Preparing your AI chat" },
];

function InputScreen({ onIngest }: { onIngest: (a: string, b: string) => void }) {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!urlA.trim() || !urlB.trim()) { setError("Please enter both URLs."); return; }
    setError("");
    setLoading(true);
    setStepIndex(0);
    const stepTimer = setInterval(() => setStepIndex((p) => Math.min(p + 1, LOADING_STEPS.length - 1)), 4000);
    try { await onIngest(urlA.trim(), urlB.trim()); }
    finally { clearInterval(stepTimer); setLoading(false); }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16 bg-gradient-to-b from-slate-50 to-white">
      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }} className="w-full max-w-lg">
        {/* Floating icons above card */}
        <div className="flex justify-center gap-4 mb-5">
          {[{Icon: FaYoutube, color:"#ef4444", bg:"#fef2f2"}, {Icon: FaInstagram, color:"#a855f7", bg:"#faf5ff"}].map(({Icon, color, bg}, i) => (
            <motion.div key={i} initial={{ y: 0 }} animate={{ y: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-white"
              style={{ background: bg }}>
              <Icon size={20} style={{ color }} />
            </motion.div>
          ))}
        </div>

        <Card className="shadow-2xl rounded-2xl border border-slate-200 overflow-hidden">
          {/* Top gradient bar */}

          <CardContent className="p-8 flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: "var(--font-syne)" }}>Compare Your Videos</h1>
              <p className="text-sm text-slate-500">Paste a YouTube and Instagram Reel URL to get AI‑powered insights</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#fef2f2" }}>
                  <FaYoutube size={12} className="text-red-500" />
                </div>
                <Input className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus-visible:ring-indigo-400 transition-colors"
                  placeholder="YouTube URL — Video A" value={urlA} onChange={(e) => setUrlA(e.target.value)} disabled={loading} />
              </div>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#faf5ff" }}>
                  <FaInstagram size={12} style={{ color: "#a855f7" }} />
                </div>
                <Input className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus-visible:ring-indigo-400 transition-colors"
                  placeholder="Instagram Reel URL — Video B" value={urlB} onChange={(e) => setUrlB(e.target.value)} disabled={loading} />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 text-center bg-red-50 py-2 rounded-lg">{error}</p>}

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-slate-900"
                      initial={{ width: "8%" }} animate={{ width: `${((stepIndex + 1) / LOADING_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeInOut" }} />
                  </div>

                  {/* Step checklist */}
                  <div className="flex flex-col gap-2.5 mt-1">
                    {LOADING_STEPS.map((step, i) => {
                      const StepIcon = step.icon;
                      const done = i < stepIndex;
                      const active = i === stepIndex;
                      return (
                        <motion.div
                          key={step.label}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: done || active ? 1 : 0.4, x: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            done ? "bg-green-100" : active ? "bg-slate-900" : "bg-slate-100"
                          }`}>
                            {done ? (
                              <Check size={14} className="text-green-600" />
                            ) : active ? (
                              <Loader2 size={14} className="text-white animate-spin" />
                            ) : (
                              <StepIcon size={13} className="text-slate-400" />
                            )}
                          </div>
                          <span className={`text-sm transition-colors ${
                            done ? "text-slate-400 line-through" : active ? "text-slate-900 font-semibold" : "text-slate-400"
                          }`}>
                            {step.label}
                          </span>
                          {active && (
                            <motion.span
                              className="ml-auto flex gap-0.5"
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            >
                              {[0, 1, 2].map((d) => (
                                <motion.span key={d} className="w-1 h-1 rounded-full bg-slate-400"
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
                              ))}
                            </motion.span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Button className="w-full h-11 rounded-xl font-semibold text-white text-sm hover:opacity-90 transition-all hover:scale-[1.02]"
                    style={{ background: "#0f172a" }} onClick={handleSubmit}>
                    Analyze Videos →
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!loading && <p className="text-center text-xs text-slate-400">No signup required · Free to try</p>}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Video Card ─────────────────────────────────────────────────────────────────

function VideoCardSkeleton({ label, color, direction }: { label: string; color: string; direction: "left" | "right" }) {
  return (
    <motion.div initial={{ opacity: 0, x: direction === "left" ? -60 : 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }}>
      <Card className="rounded-2xl shadow-sm overflow-hidden border border-slate-200 pt-0">
        <div className="px-4 py-2.5 flex items-center justify-between bg-slate-900">
          <span className="text-white font-bold text-sm">Video {label}</span>
        </div>
        <CardContent className="p-4 flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function VideoCard({ label, meta, platform, direction }: { label: string; meta: VideoMeta; platform: "youtube" | "instagram"; direction: "left" | "right" }) {
  const platformBadgeColor = platform === "youtube" ? "#ef4444" : "#ec4899";
  const [thumbError, setThumbError] = useState(false);
  const thumbnailUrl = platform === "youtube"
    ? `https://img.youtube.com/vi/${meta.video_id}/hqdefault.jpg`
    : meta.thumbnail_url || null;

  return (
    <motion.div initial={{ opacity: 0, x: direction === "left" ? -60 : 60 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: [0.22,1,0.36,1] }}>
      <Card className="rounded-2xl shadow-md overflow-hidden border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 pt-0">
        <div className="px-4 py-2.5 flex items-center justify-between bg-slate-900">
          <span className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-syne)" }}>Video {label}</span>
          <span className="text-white text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: platformBadgeColor }}>
            {platform === "youtube" ? "YouTube" : "Instagram"}
          </span>
        </div>

        <CardContent className="p-4 flex flex-col gap-3">
          {thumbnailUrl && !thumbError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              className="w-full h-36 object-cover rounded-xl bg-slate-100"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div className="w-full h-36 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-2">
              {platform === "instagram"
                ? <><FaInstagram size={28} style={{ color: "#a855f7" }} /><span className="text-xs text-slate-400">Instagram Reel</span></>
                : <><FaYoutube size={28} className="text-red-400" /><span className="text-xs text-slate-400">YouTube</span></>
              }
            </div>
          )}

          <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{meta.title || "Untitled"}</p>

          <div>
            <p className="text-sm font-bold text-slate-900">{meta.creator}</p>
            <p className="text-xs text-slate-400">@{meta.creator.toLowerCase().replace(/\s/g, "")}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { icon: <Eye size={11}/>, val: formatNumber(meta.views), label: "views" },
              { icon: <Heart size={11}/>, val: meta.likes_hidden ? "Hidden" : formatNumber(meta.likes), label: "likes" },
              { icon: <MessageCircle size={11}/>, val: formatNumber(meta.comments), label: "comments" },
            ].map(({icon, val}) => (
              <span key={val} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-slate-600 text-xs font-medium">
                {icon} {val}
              </span>
            ))}
          </div>

          <EngagementBadge rate={meta.engagement_rate} />

          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 border-t border-slate-50">
            <span className="flex items-center gap-1"><Calendar size={10}/> {formatDate(meta.upload_date)}</span>
            <span className="flex items-center gap-1"><Clock size={10}/> {formatDuration(meta.duration_seconds)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Why did Video A get more engagement?",
  "Compare the hooks in the first 5 seconds",
  "Suggest improvements for Video B",
  "What's the engagement rate of each?",
];

function CitationBadge({ citation }: { citation: Citation }) {
  const isA = citation.video_id === "A";
  return (
    <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-semibold mr-1"
      style={{ background: isA ? "#f1f5f9" : "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}>
      Video {citation.video_id} · chunk {citation.chunk_index}
    </span>
  );
}

function ChatPanel({ messages, onSend, streaming }: { messages: Message[]; onSend: (msg: string) => void; streaming: boolean }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");
    onSend(msg);
  }, [input, streaming, onSend]);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22,1,0.36,1] }}>
      <Card className="rounded-2xl shadow-md border border-slate-200 overflow-hidden pt-0">
        {/* Header */}
        <CardHeader className="px-5 py-3.5 border-b border-slate-100 flex flex-row items-center gap-3 bg-white">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm bg-slate-100">
            <Bot size={16} className="text-slate-700" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm" style={{ fontFamily: "var(--font-syne)" }}>Ask WiseAI</span>
            <p className="text-xs text-slate-400">Powered by LangGraph + RAG</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400">Online</span>
          </div>
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="h-[320px] sm:h-[420px] bg-slate-50/50">
          <div className="p-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100">
                  <Bot size={26} className="text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Ask WiseAI anything</p>
                  <p className="text-xs text-slate-400 mt-0.5">About engagement, content, hooks, and more</p>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5 max-w-[85%]">
                    {msg.citations.map((c, i) => <CitationBadge key={i} citation={c} />)}
                  </div>
                )}
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-700 shadow-sm"
                }`} style={msg.role === "user" ? { background: "#0f172a", borderRadius: "18px 18px 4px 18px" } : { borderRadius: "4px 18px 18px 18px" }}>
                  {msg.content}
                  {msg.streaming && <span className="inline-block w-0.5 h-4 bg-slate-400 ml-1 animate-pulse" />}
                </div>
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <Separator />

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="px-3 sm:px-4 pt-3 pb-1 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => handleSend(s)} disabled={streaming}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-40 shadow-sm">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-3 sm:px-4 py-3 flex items-center gap-2 bg-white">
          <Input
            className="rounded-full border-slate-200 bg-slate-50 focus:bg-white focus-visible:ring-indigo-400 text-sm h-10 transition-colors"
            placeholder={streaming ? "WiseAI is thinking..." : "Ask about hooks, engagement, improvements..."}
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()} disabled={streaming}
          />
          <Button size="icon" className="w-10 h-10 rounded-full shrink-0 text-white disabled:opacity-40 shadow-md"
            style={{ background: "#0f172a" }}
            onClick={() => handleSend()} disabled={streaming || !input.trim()}>
            <Send size={15} />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function AppPage() {
  const [sessionId] = useState<string>(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)
  );
  const [phase, setPhase] = useState<"input" | "app">("input");
  const [videoMeta, setVideoMeta] = useState<{ A: VideoMeta | null; B: VideoMeta | null }>({ A: null, B: null });
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);

  const handleIngest = async (urlA: string, urlB: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ingest`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_a_url: urlA, video_b_url: urlB }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Ingest failed"); }
    const data = await res.json();
    setVideoMeta({ A: data.video_A, B: data.video_B });
    setPhase("app");
  };

  const handleSend = async (text: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", citations: [], streaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const metaPayload: Record<string, object> = {};
    if (videoMeta.A) metaPayload["A"] = videoMeta.A;
    if (videoMeta.B) metaPayload["B"] = videoMeta.B;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text, video_metadata: metaPayload }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.replace("event:", "").trim();
          const rawData = dataLine.replace("data:", "").trim();

          if (event === "citations") {
            const citations: Citation[] = JSON.parse(rawData);
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, citations } : m));
          } else if (event === "token") {
            const token: string = JSON.parse(rawData);
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + token } : m));
          } else if (event === "done") {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m));
            setStreaming(false);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Something went wrong. Please try again.", streaming: false } : m));
      setStreaming(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <Navbar />

      {phase === "input" && <InputScreen onIngest={handleIngest} />}

      {phase === "app" && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-8 flex flex-col gap-4 sm:gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videoMeta.A
              ? <VideoCard label="A" meta={videoMeta.A} platform="youtube" direction="left" />
              : <VideoCardSkeleton label="A" color="#6366f1" direction="left" />}
            {videoMeta.B
              ? <VideoCard label="B" meta={videoMeta.B} platform="instagram" direction="right" />
              : <VideoCardSkeleton label="B" color="#a855f7" direction="right" />}
          </div>
          <ChatPanel messages={messages} onSend={handleSend} streaming={streaming} />
        </main>
      )}
    </div>
  );
}
