/**
 * LLM proposes; this module NEVER builds calldata or signs.
 * Invalid proposals are rejected here so Altana's argument-blind
 * allowlist is not the last line of defense (PRD 11.2 / Tech Spec 7.4).
 */

import { generateText } from "ai";
import { z } from "zod";
import { buildModel } from "../model.js";
import { isKnownVToken } from "../protocol/addresses.js";
import type { AccountHealth } from "../protocol/venus.js";
import type { StrategyConfig } from "./config.js";

const ProposalSchema = z.object({
  action: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(["hold", "repay"])),
  vToken: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : v)),
  repayPortionBps: z.coerce.number().int().min(1).max(10_000).optional(),
  reason: z.string().min(1).max(2_000).transform((s) => s.slice(0, 500)),
});

export type Proposal = z.infer<typeof ProposalSchema> & {
  source: "llm" | "fallback";
};

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in LLM text");
  return JSON.parse(text.slice(start, end + 1));
}

export type Validated =
  | { ok: true; action: "hold"; reason: string }
  | {
      ok: true;
      action: "repay";
      vToken: string;
      repayPortionBps: number;
      reason: string;
    }
  | { ok: false; reason: string; proposal: Proposal };

function fallback(health: AccountHealth, cfg: StrategyConfig): Proposal {
  if (!health.hasBorrow || health.healthFactor === null) {
    return {
      action: "hold",
      reason: "No Venus borrow on this wallet; nothing to protect.",
      source: "fallback",
    };
  }
  if (health.healthFactor > cfg.threshold) {
    return {
      action: "hold",
      reason: `HF ${health.healthFactor.toFixed(3)} is above ${cfg.threshold} (${cfg.variant}).`,
      source: "fallback",
    };
  }
  const largest = [...health.markets].sort((a, b) => b.borrowUsd - a.borrowUsd)[0];
  return {
    action: "repay",
    vToken: largest.vToken,
    repayPortionBps: 2_500,
    reason: `HF ${health.healthFactor.toFixed(3)} ≤ ${cfg.threshold}; repay 25% of ${largest.symbol}.`,
    source: "fallback",
  };
}

export async function propose(
  health: AccountHealth,
  cfg: StrategyConfig,
): Promise<Proposal> {
  if (
    !process.env.OPENROUTER_API_KEY &&
    !process.env.OPENAI_API_KEY
  ) {
    const fb = fallback(health, cfg);
    fb.reason = `OPENROUTER_API_KEY missing; ${fb.reason}`;
    return fb;
  }

  try {
    const result = await generateText({
      model: buildModel(),
      system:
        "You are a Venus health-factor guardian on BSC testnet. " +
        "You PROPOSE only. You never sign, never build calldata, never pick a recipient. " +
        "If HF is above the threshold, action must be hold. " +
        "If HF is at or below the threshold and there is a borrow, you may propose repay. " +
        "repayPortionBps is basis points of THAT market's borrow (2500 = 25%). " +
        "Never exceed 5000. Pick the vToken with the largest borrowUsd. " +
        "Reply with ONLY a JSON object, no markdown, no thinking. Example: " +
        '{"action":"hold","reason":"No borrow on this wallet."}.',
      prompt: JSON.stringify({
        variant: cfg.variant,
        threshold: cfg.threshold,
        maxRepayBps: cfg.maxRepayBps,
        health,
      }),
    });
    const parsed = ProposalSchema.safeParse(extractJson(result.text));
    if (!parsed.success) {
      console.error(
        "[decide] proposal schema miss:",
        parsed.error.flatten(),
        "text=",
        result.text.slice(0, 500),
      );
      throw new Error("LLM did not return a valid proposal object");
    }
    return { ...parsed.data, source: "llm" };
  } catch (e) {
    const fb = fallback(health, cfg);
    const msg = e instanceof Error ? e.message : String(e);
    const body =
      e &&
      typeof e === "object" &&
      "responseBody" in e &&
      typeof (e as { responseBody?: unknown }).responseBody === "string"
        ? (e as { responseBody: string }).responseBody
        : "";
    if (body) {
      console.error("[decide] LLM HTTP body:", body.slice(0, 1_000));
    } else {
      console.error("[decide] LLM error:", e);
    }
    const hint = body
      ? `${msg} | body=${body.replace(/\s+/g, " ").slice(0, 180)}`
      : msg;
    fb.reason = `LLM failed (${hint.slice(0, 220)}); ${fb.reason}`;
    return fb;
  }
}

export function validate(
  health: AccountHealth,
  cfg: StrategyConfig,
  proposal: Proposal,
): Validated {
  const hf = health.healthFactor;

  if (proposal.action === "hold") {
    return { ok: true, action: "hold", reason: proposal.reason };
  }

  if (!health.hasBorrow || hf === null) {
    return {
      ok: false,
      reason: "Rejected repay: wallet has no borrow.",
      proposal,
    };
  }
  if (hf > cfg.threshold) {
    return {
      ok: false,
      reason: `Rejected repay: HF ${hf.toFixed(3)} is still above ${cfg.threshold}.`,
      proposal,
    };
  }

  const vToken = proposal.vToken ?? "";
  if (!isKnownVToken(vToken)) {
    return {
      ok: false,
      reason: `Rejected repay: unknown vToken ${vToken}.`,
      proposal,
    };
  }
  const market = health.markets.find(
    (m) => m.vToken.toLowerCase() === vToken.toLowerCase(),
  );
  if (!market || market.borrowUsd <= 0) {
    return {
      ok: false,
      reason: `Rejected repay: no borrow on ${vToken}.`,
      proposal,
    };
  }

  const bps = proposal.repayPortionBps ?? 0;
  if (bps < 1 || bps > cfg.maxRepayBps) {
    return {
      ok: false,
      reason: `Rejected repay: bps ${bps} outside 1..${cfg.maxRepayBps}.`,
      proposal,
    };
  }

  return {
    ok: true,
    action: "repay",
    vToken: market.vToken,
    repayPortionBps: bps,
    reason: proposal.reason,
  };
}
