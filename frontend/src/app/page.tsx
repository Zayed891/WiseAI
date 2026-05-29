"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Play,
  Camera,
  Eye,
  Heart,
  MessageCircle,
  Clock,
  Calendar,
  Zap,
} from "lucide-react";

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
  if (/^\d{10,}$/.test(raw)) {
    return new Date(parseInt(raw) * 1000).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }
  if (/^\d{8}$/.test(raw)) {
    return new Date(
      `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    ).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  return raw;
}

function EngagementBadge({ rate }: { rate: number }) {
  if (rate > 3)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
        🔥 {rate.toFixed(2)}% Engagement
      </span>
    );
  if (rate >= 1)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
        📊 {rate.toFixed(2)}% Engagement
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
      📉 {rate.toFixed(2)}% Engagement
    </span>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 w-full bg-white px-6 py-3 flex items-center justify-between"
      style={{ borderBottom: "1px solid #e2e8f0" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-slate-900 flex items-center gap-1">
          <Zap size={18} className="text-indigo-500" fill="#6366f1" />
          WiseAI
        </span>
        <span className="text-xs text-slate-400 font-medium hidden sm:block">
          AI Video Intelligence
        </span>
      </div>
      <Badge
        className="text-xs font-medium px-3 py-1"
        style={{ background: "#6366f1", color: "white", border: "none" }}
      >
        RAG Powered
      </Badge>
    </nav>
  );
}

// ── URL Input Screen ───────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "Extracting transcripts...",
  "Embedding chunks...",
  "Ready to chat",
];

function InputScreen({ onIngest }: { onIngest: (a: string, b: string) => void }) {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!urlA.trim() || !urlB.trim()) {
      setError("Please enter both URLs.");
      return;
    }
    setError("");
    setLoading(true);
    setStepIndex(0);

    const stepTimer = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      await onIngest(urlA.trim(), urlB.trim());
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-lg rounded-2xl border border-slate-200">
          <CardContent className="p-8 flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900">Compare Your Videos</h1>
              <p className="text-sm text-slate-500 mt-1">
                Paste a YouTube and Camera Reel URL to get AI‑powered insights
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative">
                <Play size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                <Input
                  className="pl-9 rounded-xl border-slate-200 focus-visible:ring-indigo-400"
                  placeholder="YouTube URL — Video A"
                  value={urlA}
                  onChange={(e) => setUrlA(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="relative">
                <Camera
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#a855f7" }}
                />
                <Input
                  className="pl-9 rounded-xl border-slate-200 focus-visible:ring-indigo-400"
                  placeholder="Camera Reel URL — Video B"
                  value={urlB}
                  onChange={(e) => setUrlB(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-2"
                >
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "#6366f1" }}
                      initial={{ width: "5%" }}
                      animate={{ width: `${((stepIndex + 1) / LOADING_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={stepIndex}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.3 }}
                      className="text-center text-sm text-indigo-500 font-medium"
                    >
                      {LOADING_STEPS[stepIndex]}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Button
                    className="w-full rounded-xl font-semibold text-white"
                    style={{ background: "#6366f1" }}
                    onClick={handleSubmit}
                  >
                    Analyze Videos →
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Video Card ─────────────────────────────────────────────────────────────────

function VideoCardSkeleton({ label, color }: { label: string; color: string }) {
  return (
    <Card className="rounded-2xl shadow-sm overflow-hidden border border-slate-200">
      <div className="h-2 w-full" style={{ background: color }} />
      <CardContent className="p-4 flex flex-col gap-3">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-24 rounded-full" />
      </CardContent>
    </Card>
  );
}

function VideoCard({
  label,
  meta,
  platform,
}: {
  label: string;
  meta: VideoMeta;
  platform: "youtube" | "instagram";
}) {
  const accentColor = label === "A" ? "#6366f1" : "#a855f7";
  const platformBadgeColor = platform === "youtube" ? "#ef4444" : "#ec4899";

  const thumbnailUrl =
    platform === "youtube"
      ? `https://img.youtube.com/vi/${meta.video_id}/hqdefault.jpg`
      : null;

  return (
    <Card className="rounded-2xl shadow-sm overflow-hidden border border-slate-200">
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ background: accentColor }}
      >
        <span className="text-white font-semibold text-sm">Video {label}</span>
        <span
          className="text-white text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: platformBadgeColor }}
        >
          {platform === "youtube" ? "YouTube" : "Camera"}
        </span>
      </div>

      <CardContent className="p-4 flex flex-col gap-3">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={meta.title}
            className="w-full h-36 object-cover rounded-xl bg-slate-100"
          />
        ) : (
          <div className="w-full h-36 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <Camera size={32} className="text-slate-400" />
          </div>
        )}

        <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
          {meta.title || "Untitled"}
        </p>

        <div>
          <p className="text-sm font-bold text-slate-900">{meta.creator}</p>
          <p className="text-xs text-slate-400">
            @{meta.creator.toLowerCase().replace(/\s/g, "")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
            <Eye size={11} /> {formatNumber(meta.views)}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
            <Heart size={11} />
            {meta.likes_hidden ? "Hidden" : formatNumber(meta.likes)}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
            <MessageCircle size={11} /> {formatNumber(meta.comments)}
          </span>
        </div>

        <EngagementBadge rate={meta.engagement_rate} />

        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
          <span className="flex items-center gap-1">
            <Calendar size={11} /> {formatDate(meta.upload_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} /> {formatDuration(meta.duration_seconds)}
          </span>
        </div>
      </CardContent>
    </Card>
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
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium mr-1"
      style={{
        background: isA ? "#ede9fe" : "#e0e7ff",
        color: isA ? "#7c3aed" : "#4338ca",
      }}
    >
      [Video {citation.video_id} · chunk {citation.chunk_index}]
    </span>
  );
}

function ChatPanel({
  messages,
  onSend,
  streaming,
}: {
  messages: Message[];
  onSend: (msg: string) => void;
  streaming: boolean;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || streaming) return;
      setInput("");
      onSend(msg);
    },
    [input, streaming, onSend]
  );

  const handleSuggestion = (s: string) => {
    onSend(s);
  };

  return (
    <Card className="rounded-2xl shadow-sm border border-slate-200">
      <CardHeader className="px-5 py-3 border-b border-slate-100 flex flex-row items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "#ede9fe" }}
        >
          <Bot size={14} style={{ color: "#7c3aed" }} />
        </div>
        <span className="font-semibold text-slate-800 text-sm">Ask WiseAI</span>
      </CardHeader>

      <ScrollArea className="h-[400px] px-4 py-3">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Bot size={32} className="text-slate-300" />
              <p className="text-sm text-slate-400">Ask anything about the two videos</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1 max-w-[85%]">
                  {msg.citations.map((c, i) => (
                    <CitationBadge key={i} citation={c} />
                  ))}
                </div>
              )}
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                }`}
                style={msg.role === "user" ? { background: "#6366f1" } : undefined}
              >
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Separator />

      {messages.length === 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={streaming}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-3 flex items-center gap-2">
        <Input
          className="rounded-full border-slate-200 focus-visible:ring-indigo-400 text-sm"
          placeholder={streaming ? "Waiting for response..." : "Ask about the videos..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={streaming}
        />
        <Button
          size="icon"
          className="rounded-full shrink-0 text-white disabled:opacity-40"
          style={{ background: "#6366f1" }}
          onClick={() => handleSend()}
          disabled={streaming || !input.trim()}
        >
          <Send size={15} />
        </Button>
      </div>
    </Card>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [sessionId] = useState<string>(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)
  );

  const [phase, setPhase] = useState<"input" | "app">("input");
  const [videoMeta, setVideoMeta] = useState<{ A: VideoMeta | null; B: VideoMeta | null }>({
    A: null,
    B: null,
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);

  const handleIngest = async (urlA: string, urlB: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_a_url: urlA, video_b_url: urlB }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Ingest failed");
    }

    const data = await res.json();
    setVideoMeta({ A: data.video_A, B: data.video_B });
    setPhase("app");
  };

  const handleSend = async (text: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId, role: "assistant", content: "", citations: [], streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const metaPayload: Record<string, object> = {};
    if (videoMeta.A) metaPayload["A"] = videoMeta.A;
    if (videoMeta.B) metaPayload["B"] = videoMeta.B;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, citations } : m))
            );
          } else if (event === "token") {
            const token: string = JSON.parse(rawData);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m
              )
            );
          } else if (event === "done") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
            );
            setStreaming(false);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again.", streaming: false }
            : m
        )
      );
      setStreaming(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {phase === "input" && <InputScreen onIngest={handleIngest} />}

      {phase === "app" && (
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex flex-col gap-5"
        >
          <div className="grid grid-cols-2 gap-4">
            {videoMeta.A ? (
              <VideoCard label="A" meta={videoMeta.A} platform="youtube" />
            ) : (
              <VideoCardSkeleton label="A" color="#6366f1" />
            )}
            {videoMeta.B ? (
              <VideoCard label="B" meta={videoMeta.B} platform="instagram" />
            ) : (
              <VideoCardSkeleton label="B" color="#a855f7" />
            )}
          </div>

          <ChatPanel messages={messages} onSend={handleSend} streaming={streaming} />
        </motion.main>
      )}
    </div>
  );
}
