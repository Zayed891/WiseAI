"use client";

import Link from "next/link";
import { motion, type Variants, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  Zap, BarChart2, MessageSquare, Bot, Search, TrendingUp,
} from "lucide-react";
import { FaYoutube, FaInstagram } from "react-icons/fa";

// ── Animation helpers ──────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Orbit icons data ───────────────────────────────────────────────────────────

const ORBIT_ICONS = [
  { Icon: FaYoutube,    color: "#ef4444", bg: "#fef2f2", angle: 0,   label: "YouTube"    },
  { Icon: FaInstagram,  color: "#a855f7", bg: "#faf5ff", angle: 45,  label: "Instagram"  },
  { Icon: BarChart2,    color: "#6366f1", bg: "#eef2ff", angle: 90,  label: "Analytics"  },
  { Icon: MessageSquare,color: "#0ea5e9", bg: "#f0f9ff", angle: 135, label: "Chat"       },
  { Icon: Bot,          color: "#10b981", bg: "#f0fdf4", angle: 180, label: "AI"         },
  { Icon: Search,       color: "#f59e0b", bg: "#fffbeb", angle: 225, label: "Search"     },
  { Icon: TrendingUp,   color: "#ec4899", bg: "#fdf2f8", angle: 270, label: "Growth"     },
  { Icon: Zap,          color: "#8b5cf6", bg: "#f5f3ff", angle: 315, label: "Speed"      },
];

// ── Navbar ─────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm px-6 lg:px-16 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <Link href="/" className="flex items-center gap-2">
        <Zap size={18} fill="#0f172a" className="text-slate-900" />
        <span className="text-lg font-bold text-slate-900" style={{ fontFamily: "var(--font-syne)" }}>WiseAI</span>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        {["Features", "How it Works", "Pricing"].map((item) => (
          <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
            {item}
          </a>
        ))}
      </div>

      <Link href="/app"
        className="text-sm font-semibold text-white px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
        style={{ background: "#0f172a" }}>
        Get Started →
      </Link>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function OrbitRing() {
  const RADIUS = 220;

  return (
    <div className="flex items-center justify-center mx-auto">
    <div className="relative w-[520px] h-[520px] flex items-center justify-center scale-[0.55] sm:scale-[0.75] lg:scale-100 origin-center">
      {/* Orbit ring */}
      <div className="absolute inset-0 rounded-full border border-dashed border-slate-200" />
      <div className="absolute" style={{ inset: "60px", borderRadius: "50%", border: "1px dashed #e2e8f0" }} />

      {/* Rotating container */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {ORBIT_ICONS.map(({ Icon, color, bg, angle, label }) => {
          const rad = (angle * Math.PI) / 180;
          const x = 260 + RADIUS * Math.cos(rad) - 22;
          const y = 260 + RADIUS * Math.sin(rad) - 22;
          return (
            <motion.div
              key={label}
              className="absolute w-11 h-11 rounded-full flex items-center justify-center shadow-md border border-white/80"
              style={{ left: x, top: y, background: bg }}
              animate={{ rotate: -360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              title={label}
            >
              <Icon size={18} style={{ color }} />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
          style={{ background: "#0f172a" }}>
          <Zap size={28} fill="white" className="text-white" />
        </div>
        <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full mb-2">RAG-Powered</div>
        <div className="text-sm font-bold text-slate-800" style={{ fontFamily: "var(--font-syne)" }}>WiseAI</div>
        <div className="text-xs text-slate-400 mt-0.5">Video Intelligence</div>
      </div>
    </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 lg:px-16 min-h-[calc(100vh-64px)] flex flex-col justify-center py-12">
      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(to right, #e2e8f018 1px, transparent 1px), linear-gradient(to bottom, #e2e8f018 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, #0f172208 0%, transparent 70%)" }} />

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: Text */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="flex flex-col gap-6">
          {/* Trust badges */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="text-yellow-400">★★★★★</span> 4.9 Product Hunt
            </span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="text-blue-400">◆</span> Featured on PH
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.08] tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}>
            AI-Powered<br />
            Video <span className="text-slate-500">Intelligence.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg text-slate-500 leading-relaxed max-w-md">
            Paste a YouTube or Instagram Reel URL. WiseAI extracts transcripts, computes engagement,
            and lets you chat with your video content using AI.
          </motion.p>

          <motion.div variants={fadeUp} className="flex items-center gap-3 flex-wrap">
            <Link href="/app"
              className="px-7 py-3.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-all hover:scale-105 shadow-lg"
              style={{ background: "#0f172a", boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}>
              Analyze Your First Video →
            </Link>
            <a href="#how-it-works"
              className="px-7 py-3.5 rounded-full text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-400 transition-colors">
              See How It Works
            </a>
          </motion.div>

          <motion.p variants={fadeUp} className="text-xs text-slate-400">
            No signup required · Free to try
          </motion.p>

          {/* Mini stats */}
          <motion.div variants={fadeUp} className="flex items-center gap-6 pt-2">
            {[["107", "chunks/video"], ["< 30s", "analysis time"], ["6.3%", "avg engagement"]].map(([val, label]) => (
              <div key={label}>
                <div className="text-xl font-bold text-slate-900" style={{ fontFamily: "var(--font-syne)" }}>{val}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right: Orbit — hide on small screens to avoid overflow */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center">
          <OrbitRing />
        </motion.div>
      </div>

      {/* App mockup below */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-3xl mx-auto mt-12 hidden sm:block">
        <div className="rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f0f1ff 0%, #fafafa 60%)" }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-200 bg-white/80">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-300"/><div className="w-3 h-3 rounded-full bg-yellow-300"/><div className="w-3 h-3 rounded-full bg-green-300"/></div>
            <div className="flex-1 h-5 rounded bg-slate-100 flex items-center px-3"><span className="text-xs text-slate-400">localhost:3001/app</span></div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[{label:"A",tag:"YouTube",tc:"#ef4444"},{label:"B",tag:"Instagram",tc:"#ec4899"}].map(v=>(
                <div key={v.label} className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="px-3 py-1.5 flex items-center justify-between" style={{background:"#0f172a"}}>
                    <span className="text-white text-xs font-semibold">Video {v.label}</span>
                    <span className="text-white text-xs px-2 py-0.5 rounded-full" style={{background:v.tc}}>{v.tag}</span>
                  </div>
                  <div className="p-3">
                    <div className="h-16 rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                      <FaYoutube size={16} className="text-slate-400"/>
                    </div>
                    <div className="h-2 bg-slate-200 rounded w-3/4 mb-1"/><div className="h-1.5 bg-slate-100 rounded w-1/2 mb-2"/>
                    <div className="flex gap-1">
                      {["👁 22K","❤️ 1.4K","💬 52"].map(s=><span key={s} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{s}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex justify-end mb-2">
                <div className="px-3 py-1.5 rounded-xl text-xs text-white" style={{background:"#0f172a"}}>Which video has better engagement?</div>
              </div>
              <div className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Video B has <span className="font-semibold text-green-600">8.81%</span> engagement vs Video A&apos;s <span className="font-semibold text-yellow-600">6.30%</span> <span className="text-slate-500 font-medium">[Video B, metadata]</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ── Trusted By ─────────────────────────────────────────────────────────────────

function TrustedBy() {
  const base = ["YouTube", "Instagram", "Qdrant", "Cohere", "Groq", "LangGraph", "Apify", "Whisper"];
  // Triplicate so there's always content visible during the loop
  const brands = [...base, ...base, ...base];
  return (
    <section className="py-10 border-t border-slate-100 overflow-hidden">
      <p className="text-center text-xs text-slate-400 font-medium tracking-widest uppercase mb-6">Powered by</p>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, white, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, white, transparent)" }} />

        <motion.div
          className="flex items-center gap-16 whitespace-nowrap w-max"
          animate={{ x: ["-33.33%", "0%"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear", repeatType: "loop" }}
        >
          {brands.map((b, i) => (
            <span key={i} className="text-slate-400 font-semibold text-sm shrink-0">{b}</span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "📊", title: "Engagement Intelligence", desc: "Compare engagement rates across platforms. Understand what drives views, likes, and comments." },
  { icon: "🎯", title: "RAG-Powered Chat", desc: "Ask questions about your video content. Get answers grounded in the actual transcript using retrieval-augmented generation." },
  { icon: "⚡", title: "Multi-Platform Support", desc: "Works with YouTube videos and Instagram Reels. Automatic transcript extraction and Whisper-powered audio transcription." },
  { icon: "🔍", title: "Semantic Search", desc: "Find the exact moment or topic in any video using vector similarity search powered by Qdrant." },
  { icon: "📈", title: "Side-by-Side Comparison", desc: "Compare two videos head-to-head. See which performed better and why, with AI-generated insights." },
  { icon: "🤖", title: "Streaming AI Responses", desc: "Get real-time answers as the AI generates them. Inline citations show exactly which part of the video each insight came from." },
];

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <div style={{ perspective: 800 }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className={className}>
        {children}
      </motion.div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="px-6 lg:px-16 py-20">
      <FadeIn className="text-center mb-14">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: "var(--font-syne)" }}>
          Everything you need to analyze<br className="hidden sm:block" /> video performance
        </h2>
        <p className="text-slate-500">Built for creators who care about data.</p>
      </FadeIn>

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} variants={stagger}
        className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            variants={{
              hidden: { opacity: 0, scale: 0.85, y: 20 },
              visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 } },
            }}
          >
            <TiltCard className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-xl hover:border-slate-300 cursor-default h-full transition-shadow duration-300">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2" style={{ fontFamily: "var(--font-syne)" }}>{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

// ── How It Works ───────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Paste URLs", desc: "Drop a YouTube and Instagram URL into WiseAI" },
  { n: "02", title: "AI Analysis", desc: "Transcripts extracted, chunks embedded, engagement computed" },
  { n: "03", title: "Chat & Insights", desc: "Ask anything. Get answers with citations from the actual content" },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 lg:px-16 py-20 bg-slate-50" style={{ borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
      <FadeIn className="text-center mb-14">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900" style={{ fontFamily: "var(--font-syne)" }}>
          Three steps to video intelligence
        </h2>
      </FadeIn>

      <div className="max-w-4xl mx-auto relative">
        <div className="absolute top-7 left-[16.66%] right-[16.66%] h-px hidden md:block"
          style={{ background: "linear-gradient(to right, transparent, #334155, transparent)" }} />

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {STEPS.map((step) => (
            <motion.div key={step.n} variants={fadeUp} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-sm font-bold mb-5 shadow-lg relative z-10"
                style={{ background: "#0f172a", fontFamily: "var(--font-syne)" }}>
                {step.n}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily: "var(--font-syne)" }}>{step.title}</h3>
              <p className="text-sm text-slate-500 max-w-[200px]">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <FadeIn>
      <section className="px-6 lg:px-16 py-24" style={{ background: "linear-gradient(to bottom, #eef2ff, #ffffff)" }}>
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900" style={{ fontFamily: "var(--font-syne)" }}>
            Ready to understand your videos?
          </h2>
          <p className="text-slate-500">Start analyzing in seconds. No account needed.</p>
          <Link href="/app"
            className="px-8 py-3.5 rounded-full text-sm font-semibold text-white hover:scale-105 transition-transform shadow-xl"
            style={{ background: "#0f172a", boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}>
            Analyze Videos Now →
          </Link>
        </div>
      </section>
    </FadeIn>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="px-6 lg:px-16 py-6 flex items-center justify-center" style={{ borderTop: "1px solid #e2e8f0" }}>
      <p className="text-sm text-slate-400">© 2026 WiseAI · Built with RAG + LangGraph</p>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <Hero />
      <TrustedBy />
      <Features />
      <HowItWorks />
      <CTASection />
      <Footer />
    </div>
  );
}
