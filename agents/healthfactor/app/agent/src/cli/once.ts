/**
 * One-shot tick without the HTTP server. Run from app/agent:
 *   pnpm exec tsx src/cli/once.ts
 */
import { ensureAltanaSessionLoaded } from "@bnbagent/studio-runtime/wallet";
import { runStrategyTick } from "../strategy/tick.js";

await ensureAltanaSessionLoaded();
const results = await runStrategyTick();
console.log(JSON.stringify(results.map((r) => r.record), null, 2));
