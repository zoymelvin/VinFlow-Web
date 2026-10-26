"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, CheckCircle, Info,
  ChevronDown, ChevronUp, Sparkles, PieChart, Zap, Receipt, CalendarCheck,
  CreditCard, BarChart2, PlusCircle, Target, PiggyBank, ArrowUpRight,
  ArrowDownRight, Minus, Shield, Search, RefreshCw, HelpCircle, MinusCircle, Database
} from "lucide-react";
import Link from "next/link";
import { Insight } from "@/lib/insights/types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
  PieChart,
  Zap,
  Receipt,
  CalendarCheck,
  CreditCard,
  BarChart2,
  PlusCircle,
  Target,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Shield,
  Search,
  RefreshCw,
  HelpCircle,
  MinusCircle,
  Database,
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Info",
  warning: "Attention",
  critical: "Critical",
};

type InsightCardProps = {
  insight: Insight;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

export default function InsightCard({ insight, isExpanded, onToggleExpand }: InsightCardProps) {
  const IconComp = (insight.icon && ICON_MAP[insight.icon]) ? ICON_MAP[insight.icon] : Info;

  const sentimentStyles = {
    positive: {
      border: "border-emerald-500/20 hover:border-emerald-500/40",
      bg: "bg-emerald-500/5",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      iconBg: "bg-emerald-500/15 text-emerald-400",
      glow: "0 0 15px rgba(16, 185, 129, 0.12)",
    },
    neutral: {
      border: "border-blue-500/20 hover:border-blue-500/40",
      bg: "bg-blue-500/5",
      badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      iconBg: "bg-blue-500/15 text-blue-400",
      glow: "0 0 15px rgba(59, 130, 246, 0.12)",
    },
    warning: {
      border: "border-amber-500/20 hover:border-amber-500/40",
      bg: "bg-amber-500/5",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      iconBg: "bg-amber-500/15 text-amber-400",
      glow: "0 0 15px rgba(245, 158, 11, 0.12)",
    },
    critical: {
      border: "border-red-500/25 hover:border-red-500/50",
      bg: "bg-red-500/5",
      badge: "bg-red-500/15 text-red-400 border-red-500/30",
      iconBg: "bg-red-500/15 text-red-400",
      glow: "0 0 18px rgba(239, 68, 68, 0.15)",
    },
  }[insight.sentiment || "neutral"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ boxShadow: sentimentStyles.glow }}
      className={cn(
        "rounded-2xl backdrop-blur-xl border p-4 transition-all duration-300 relative overflow-hidden",
        sentimentStyles.bg,
        sentimentStyles.border
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", sentimentStyles.iconBg)}>
          <IconComp className="w-4 h-4" strokeWidth={2.2} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
              {insight.title}
            </h4>
            <span
              className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0", sentimentStyles.badge)}
            >
              {SENTIMENT_LABEL[insight.sentiment] || "Info"}
            </span>
          </div>

          <p className="text-white/80 text-xs leading-relaxed">
            {insight.message}
          </p>

          <AnimatePresence>
            {isExpanded && insight.details && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="pt-2.5 mt-2.5 border-t border-white/10"
              >
                <p className="text-white/60 text-xs leading-relaxed font-normal">
                  {insight.details}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {insight.details && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              className="mt-2 text-[11px] font-medium text-white/50 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>{isExpanded ? "Hide details" : "See why & details"}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {insight.actionLabel && insight.actionHref && (
            <Link
              href={insight.actionHref}
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg",
                "bg-white/10 text-white/80 hover:bg-white/15 active:scale-95 transition-all"
              )}
            >
              {insight.actionLabel}
              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
