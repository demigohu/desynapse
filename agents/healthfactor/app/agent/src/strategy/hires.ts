import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Address } from "viem";
import { getWallet } from "@bnbagent/studio-runtime/wallet";

export type Hire = {
  id: string;
  wallet: Address;
  /** Path to a persisted Altana user session. Absent → observe only. */
  sessionFile?: string;
};

type FileShape = { hires?: Array<{ id?: string; wallet: string; sessionFile?: string }> };

export function loadHires(): Hire[] {
  const fromFile = process.env.HIRES_FILE;
  if (fromFile) {
    const path = resolve(fromFile);
    if (!existsSync(path)) {
      throw new Error(`HIRES_FILE not found: ${path}`);
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as FileShape;
    const hires = (parsed.hires ?? [])
      .filter((h) => /^0x[0-9a-fA-F]{40}$/.test(h.wallet))
      .map((h, i) => ({
        id: h.id ?? `hire-${i}`,
        wallet: h.wallet as Address,
        sessionFile: h.sessionFile,
      }));
    if (hires.length > 0) return hires;
  }

  const extra = (process.env.WATCH_ADDRESSES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s))
    .map((wallet, i) => ({
      id: `watch-${i}`,
      wallet: wallet as Address,
    }));

  const self: Hire = {
    id: "self",
    wallet: getWallet().address as Address,
  };
  return extra.length > 0 ? [...extra, self] : [self];
}
