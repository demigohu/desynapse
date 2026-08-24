import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DecisionRecord = {
  ts: string;
  hireId: string;
  wallet: string;
  variant: string;
  threshold: number;
  healthFactor: number | null;
  borrowUsd: number;
  proposed: {
    action: "hold" | "repay";
    vToken?: string;
    repayPortionBps?: number;
    reason: string;
    source: "llm" | "fallback";
  };
  executed: {
    action: "hold" | "repay" | "rejected" | "dry_run";
    reason: string;
    txHash?: string;
  };
  blockNumber: string;
};

function logPath(): string {
  return resolve(process.env.DECISION_LOG ?? resolve(process.cwd(), "data/decisions.jsonl"));
}

export function appendDecision(record: DecisionRecord): void {
  const path = logPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: "utf8" });
}
