import { getAddress, type Address } from "viem";
import { readAccountHealth, type AccountHealth } from "../protocol/venus.js";
import { loadStrategyConfig, type StrategyConfig } from "./config.js";
import { propose, validate, type Proposal } from "./decide.js";
import { loadHires, type Hire } from "./hires.js";
import { appendDecision, type DecisionRecord } from "./log.js";

export type TickResult = {
  hireId: string;
  health: AccountHealth;
  proposal: Proposal;
  record: DecisionRecord;
};

let inflight = false;
let lastTick: { at: string; results: TickResult[] } | null = null;

export function lastTickSummary() {
  return lastTick;
}

export function isTickBusy(): boolean {
  return inflight;
}

function executePlan(
  hire: Hire,
  validated: ReturnType<typeof validate>,
): DecisionRecord["executed"] {
  if (!validated.ok) {
    return { action: "rejected", reason: validated.reason };
  }
  if (validated.action === "hold") {
    return { action: "hold", reason: validated.reason };
  }
  if (!hire.sessionFile) {
    return {
      action: "dry_run",
      reason:
        "Repay allowed by policy but no user Altana session is attached yet; not signed.",
    };
  }
  return {
    action: "dry_run",
    reason:
      "User-session execute path not wired in this build; repay remains dry-run.",
  };
}

export async function runOneHire(
  hire: Hire,
  cfg: StrategyConfig,
): Promise<TickResult> {
  const wallet = getAddress(hire.wallet) as Address;
  const health = await readAccountHealth(wallet);
  let proposal = await propose(health, cfg);
  if (
    health.liquidatable &&
    proposal.action === "hold" &&
    health.hasBorrow
  ) {
    proposal = {
      action: "repay",
      vToken: [...health.markets].sort((a, b) => b.borrowUsd - a.borrowUsd)[0]
        ?.vToken,
      repayPortionBps: cfg.maxRepayBps,
      reason: `Override: account is in shortfall (liquidatable); ignore hold.`,
      source: "fallback",
    };
  }
  const validated = validate(health, cfg, proposal);
  const executed = executePlan(hire, validated);

  const record: DecisionRecord = {
    ts: new Date().toISOString(),
    hireId: hire.id,
    wallet,
    variant: cfg.variant,
    threshold: cfg.threshold,
    healthFactor: health.healthFactor,
    borrowUsd: health.borrowUsd,
    proposed: {
      action: proposal.action,
      vToken: proposal.vToken,
      repayPortionBps: proposal.repayPortionBps,
      reason: proposal.reason,
      source: proposal.source,
    },
    executed,
    blockNumber: health.blockNumber,
  };
  appendDecision(record);
  return { hireId: hire.id, health, proposal, record };
}

export async function runStrategyTick(): Promise<TickResult[]> {
  if (inflight) {
    console.warn("[tick] skipped — previous tick still running");
    return lastTick?.results ?? [];
  }
  inflight = true;
  const cfg = loadStrategyConfig();
  const results: TickResult[] = [];
  try {
    const hires = loadHires();
    for (const hire of hires) {
      try {
        results.push(await runOneHire(hire, cfg));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[tick] hire ${hire.id} failed:`, msg);
      }
    }
    lastTick = { at: new Date().toISOString(), results };
    for (const r of results) {
      const hf =
        r.health.healthFactor === null
          ? "n/a"
          : r.health.healthFactor.toFixed(3);
      console.log(
        `[tick] ${r.hireId} HF=${hf} borrowUsd=${r.health.borrowUsd.toFixed(2)} → ${r.record.executed.action} (${r.proposal.source})`,
      );
    }
    return results;
  } finally {
    inflight = false;
  }
}

export function startTickLoop(): { stop: () => void } {
  const cfg = loadStrategyConfig();
  const delay = cfg.tickIntervalMs;
  console.log(
    `[tick] ${cfg.variant} threshold=${cfg.threshold} every ${delay}ms`,
  );
  const first = setTimeout(() => {
    runStrategyTick().catch((e) => console.error("[tick] first run failed:", e));
  }, 5_000);
  const timer = setInterval(() => {
    runStrategyTick().catch((e) => console.error("[tick] failed:", e));
  }, delay);
  return {
    stop: () => {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}
