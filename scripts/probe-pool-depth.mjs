/**
 * Probes real depth of PancakeSwap V3 pools on BSC Testnet.
 *
 * Raw `liquidity()` is not interpretable on its own, so this also reads the
 * pool's actual token balances — that is what decides whether a rebalancing
 * agent can open a position without moving the price.
 *
 * Run: node scripts/probe-pool-depth.mjs
 */

const RPC = process.env.BNB_TESTNET_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com";
const FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const FEE_TIERS = [100, 500, 2500, 10000];

const TOKENS = {
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  "USDT(Venus)": "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c",
  "USDC(Venus)": "0x16227D60f7a0e586C66B005219dfc887D13C9531",
  BTCB: "0xA808e341e8e723DC6BA0Bb5204Bafc2330d7B8e4",
  CAKE: "0xe8bd7cCC165FAEb9b81569B05424771B9A20cbEF",
};

// Dua kandidat alamat $U yang saling bertentangan antar sumber.
const U_CANDIDATES = {
  "studio.toml": "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  "docs Venus": "0x180Bc1a9843A65D4116e44886FD3558515a56A49",
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
const pad = (addr) => addr.slice(2).toLowerCase().padStart(64, "0");

function decodeString(hex) {
  const body = hex.slice(2);
  if (body.length <= 64) return null;
  const len = Number.parseInt(body.slice(64, 128), 16);
  if (!Number.isFinite(len) || len === 0 || len * 2 > body.length - 128) {
    return Buffer.from(body.slice(0, 64), "hex").toString("utf8").replace(/\0+$/, "");
  }
  return Buffer.from(body.slice(128, 128 + len * 2), "hex").toString("utf8");
}

const format = (raw, decimals) => {
  const d = 10n ** BigInt(decimals);
  return `${raw / d}.${(raw % d).toString().padStart(decimals, "0").slice(0, 3)}`;
};

const balanceOf = (token, holder) => call(token, `0x70a08231${pad(holder)}`);
const getPool = (a, b, fee) =>
  call(FACTORY, `0x1698ee82${pad(a)}${pad(b)}${fee.toString(16).padStart(64, "0")}`);

async function main() {
  console.log(`RPC ${RPC}\n`);

  const decimals = {};
  for (const [name, addr] of Object.entries(TOKENS)) {
    decimals[name] = Number(BigInt(await call(addr, "0x313ce567")));
  }

  console.log("KEDALAMAN POOL PANCAKESWAP V3");
  const names = Object.keys(TOKENS);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [an, bn] = [names[i], names[j]];
      for (const fee of FEE_TIERS) {
        const pool = `0x${(await getPool(TOKENS[an], TOKENS[bn], fee)).slice(-40)}`;
        if (/^0x0+$/.test(pool)) continue;

        const liq = BigInt(await call(pool, "0x1a686502"));
        if (liq === 0n) continue;

        const balA = BigInt(await balanceOf(TOKENS[an], pool));
        const balB = BigInt(await balanceOf(TOKENS[bn], pool));
        console.log(
          `  ${an}/${bn} fee=${fee}  ${pool}\n` +
            `      ${format(balA, decimals[an])} ${an} + ${format(balB, decimals[bn])} ${bn}`
        );
      }
    }
  }

  console.log("\nIDENTITAS TOKEN $U");
  for (const [source, addr] of Object.entries(U_CANDIDATES)) {
    const code = await rpc("eth_getCode", [addr, "latest"]);
    if (code === "0x") {
      console.log(`  ${source.padEnd(12)} ${addr} — tidak ada kontrak`);
      continue;
    }
    const symbol = decodeString(await call(addr, "0x95d89b41"));
    const dec = Number(BigInt(await call(addr, "0x313ce567")));
    console.log(`  ${source.padEnd(12)} ${addr} — symbol=${symbol} decimals=${dec}`);
  }
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
