export type RiskProfile = "conservative" | "aggressive";

export type StrategyConfig = {
  variant: RiskProfile;
  /** Trigger repay when HF drops to or below this. */
  threshold: number;
  /** Never repay more than this fraction of the chosen market's borrow. */
  maxRepayBps: number;
  tickIntervalMs: number;
};

const VARIANTS: Record<RiskProfile, Pick<StrategyConfig, "threshold">> = {
  conservative: { threshold: 1.8 },
  aggressive: { threshold: 1.3 },
};

export function loadStrategyConfig(): StrategyConfig {
  const raw = (process.env.AGENT_VARIANT ?? "conservative").toLowerCase();
  const variant: RiskProfile =
    raw === "aggressive" ? "aggressive" : "conservative";
  const tick = Number(process.env.TICK_INTERVAL_MS ?? 300_000);
  return {
    variant,
    threshold: VARIANTS[variant].threshold,
    maxRepayBps: 5_000, // 50%
    tickIntervalMs: Number.isFinite(tick) && tick >= 15_000 ? tick : 300_000,
  };
}
