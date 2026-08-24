/**
 * Checks whether PancakeSwap testnet liquidity sits on its own mock tokens
 * rather than the Venus ones, and compares V2 against V3 depth.
 *
 * If the two protocols use different token contracts, no agent can move value
 * between Venus and PancakeSwap on testnet — that constraint has to be known
 * before any strategy is written.
 *
 * Run: node scripts/probe-pancake-native.mjs
 */

const RPC = process.env.BNB_TESTNET_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com";
const V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const V2_FACTORY = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
const FEE_TIERS = [100, 500, 2500, 10000];

const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

// Token mock milik PancakeSwap sendiri di testnet, berbeda dari milik Venus.
const PANCAKE_TOKENS = {
  BUSD: "0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee",
  USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
  CAKE: "0xFa60D973F7642B748046464e165A65B7323b0DEE",
  USDC: "0x64544969ed7EBf5f083679233325356EbE738930",
  DAI: "0x8a9424745056Eb399FD19a0EC26A14316684e274",
};

let rpcId = 0;

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
const pad = (a) => a.slice(2).toLowerCase().padStart(64, "0");
const addrOf = (hex) => `0x${hex.slice(-40)}`;
const isZero = (a) => /^0x0+$/.test(a);

function decodeString(hex) {
  const body = hex.slice(2);
  if (body.length <= 64) return null;
  const len = Number.parseInt(body.slice(64, 128), 16);
  if (!Number.isFinite(len) || len === 0 || len * 2 > body.length - 128) {
    return Buffer.from(body.slice(0, 64), "hex").toString("utf8").replace(/\0+$/, "");
  }
  return Buffer.from(body.slice(128, 128 + len * 2), "hex").toString("utf8");
}

const fmt = (raw, dec) => {
  const d = 10n ** BigInt(dec);
  return `${(raw / d).toString()}.${(raw % d).toString().padStart(dec, "0").slice(0, 2)}`;
};

const balanceOf = (token, holder) => call(token, `0x70a08231${pad(holder)}`);

async function main() {
  console.log(`RPC ${RPC}\n`);
  console.log("IDENTITAS TOKEN PANCAKESWAP TESTNET");

  const dec = { WBNB: 18 };
  const live = {};
  for (const [name, addr] of Object.entries(PANCAKE_TOKENS)) {
    const code = await rpc("eth_getCode", [addr, "latest"]);
    if (code === "0x") {
      console.log(`  ${name.padEnd(5)} ${addr} — tidak ada kontrak`);
      continue;
    }
    const sym = decodeString(await call(addr, "0x95d89b41"));
    dec[name] = Number(BigInt(await call(addr, "0x313ce567")));
    live[name] = addr;
    console.log(`  ${name.padEnd(5)} ${addr} — symbol=${sym} decimals=${dec[name]}`);
  }

  console.log("\nPOOL V3 BERISI (token PancakeSwap, dipasangkan dengan WBNB)");
  let v3Found = 0;
  for (const [name, addr] of Object.entries(live)) {
    for (const fee of FEE_TIERS) {
      const [t0, t1] = [WBNB, addr].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
      const pool = addrOf(
        await call(V3_FACTORY, `0x1698ee82${pad(t0)}${pad(t1)}${fee.toString(16).padStart(64, "0")}`)
      );
      if (isZero(pool)) continue;
      const liq = BigInt(await call(pool, "0x1a686502"));
      if (liq === 0n) continue;
      v3Found++;
      const bBnb = BigInt(await balanceOf(WBNB, pool));
      const bTok = BigInt(await balanceOf(addr, pool));
      console.log(
        `  WBNB/${name} fee=${fee} ${pool}\n      ${fmt(bBnb, 18)} WBNB + ${fmt(bTok, dec[name])} ${name}`
      );
    }
  }
  if (v3Found === 0) console.log("  (tidak ada satu pun pool V3 berisi)");

  console.log("\nPASANGAN V2 BERISI (pembanding)");
  let v2Found = 0;
  for (const [name, addr] of Object.entries(live)) {
    const pair = addrOf(await call(V2_FACTORY, `0xe6a43905${pad(WBNB)}${pad(addr)}`));
    if (isZero(pair)) continue;
    const bBnb = BigInt(await balanceOf(WBNB, pair));
    const bTok = BigInt(await balanceOf(addr, pair));
    if (bBnb === 0n && bTok === 0n) continue;
    v2Found++;
    console.log(`  WBNB/${name} ${pair}\n      ${fmt(bBnb, 18)} WBNB + ${fmt(bTok, dec[name])} ${name}`);
  }
  if (v2Found === 0) console.log("  (tidak ada satu pun pasangan V2 berisi)");
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
