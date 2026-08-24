/**
 * Verifies BSC Testnet contract addresses against the chain itself.
 *
 * Docs go stale; this reads code size and identifying getters straight from
 * the RPC so an address only lands in the Tech Spec after the chain confirms
 * what it is. Run: node scripts/verify-testnet-addresses.mjs
 */

const RPC = process.env.BNB_TESTNET_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com";

const SELECTOR = {
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  underlying: "0x6f307dc3",
  comptroller: "0x5fe3b567",
  factory: "0xc45a0155",
  liquidity: "0x1a686502",
  slot0: "0x3850c7bd",
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

async function hasCode(address) {
  const code = await rpc("eth_getCode", [address, "latest"]);
  return code !== "0x" && code.length > 2;
}

/** Decode an ABI-encoded dynamic string, falling back to a bytes32 string. */
function decodeString(hex) {
  const body = hex.slice(2);
  if (body.length <= 64) return null;
  const length = Number.parseInt(body.slice(64, 128), 16);
  if (!Number.isFinite(length) || length === 0 || length * 2 > body.length - 128) {
    // Some old tokens return a padded bytes32 instead of a dynamic string.
    return Buffer.from(body.slice(0, 64), "hex").toString("utf8").replace(/\0+$/, "");
  }
  return Buffer.from(body.slice(128, 128 + length * 2), "hex").toString("utf8");
}

const decodeAddress = (hex) => `0x${hex.slice(-40)}`;
const decodeUint = (hex) => BigInt(hex);

const eq = (a, b) => a.toLowerCase() === b.toLowerCase();

let failures = 0;
const line = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? "  OK  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
};

const VENUS = {
  comptroller: "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D",
  vUSDT: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A",
  USDT: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c",
  vUSDC: "0xD5C4C2e2facBEB59D0216D0595d63FcDc6F9A1a7",
  USDC: "0x16227D60f7a0e586C66B005219dfc887D13C9531",
  vBNB: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c",
};

const PANCAKE = {
  positionManager: "0x427bF5b37357632377eCbEC9de3626C71A5396c1",
  swapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
};

const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

async function verifyVToken(name, address, expectedUnderlying) {
  if (!(await hasCode(address))) {
    line(false, `${name} code`, "tidak ada kode di alamat ini");
    return;
  }
  const symbol = decodeString(await call(address, SELECTOR.symbol));
  line(symbol === name, `${name} symbol()`, symbol ?? "gagal decode");

  const comptroller = decodeAddress(await call(address, SELECTOR.comptroller));
  line(eq(comptroller, VENUS.comptroller), `${name} comptroller()`, comptroller);

  if (expectedUnderlying) {
    const underlying = decodeAddress(await call(address, SELECTOR.underlying));
    line(eq(underlying, expectedUnderlying), `${name} underlying()`, underlying);
  }
}

async function main() {
  const chainId = decodeUint(await rpc("eth_chainId"));
  const block = decodeUint(await rpc("eth_blockNumber"));
  console.log(`RPC ${RPC}\nchainId ${chainId} · block ${block}\n`);

  console.log("VENUS CORE POOL");
  line(await hasCode(VENUS.comptroller), "Comptroller code", VENUS.comptroller);
  await verifyVToken("vUSDT", VENUS.vUSDT, VENUS.USDT);
  await verifyVToken("vUSDC", VENUS.vUSDC, VENUS.USDC);
  await verifyVToken("vBNB", VENUS.vBNB, null); // native, tidak punya underlying()

  console.log("\nPANCAKESWAP V3");
  const nfpmHasCode = await hasCode(PANCAKE.positionManager);
  line(nfpmHasCode, "NonfungiblePositionManager code", PANCAKE.positionManager);
  line(await hasCode(PANCAKE.swapRouter), "SwapRouter code", PANCAKE.swapRouter);

  if (!nfpmHasCode) return;

  // Factory dibaca DARI position manager, bukan dari dokumentasi — ini yang
  // membuktikan keduanya berasal dari deployment yang sama.
  const factory = decodeAddress(await call(PANCAKE.positionManager, SELECTOR.factory));
  line(await hasCode(factory), "Factory (dibaca dari NFPM)", factory);

  const routerFactory = decodeAddress(await call(PANCAKE.swapRouter, SELECTOR.factory));
  line(eq(routerFactory, factory), "SwapRouter factory() cocok dengan NFPM", routerFactory);

  console.log("\nLIKUIDITAS POOL V3 (WBNB/USDT)");
  const [t0, t1] = [WBNB, VENUS.USDT].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  for (const fee of [100, 500, 2500, 10000]) {
    const getPool = `0x1698ee82${t0.slice(2).padStart(64, "0")}${t1
      .slice(2)
      .padStart(64, "0")}${fee.toString(16).padStart(64, "0")}`;
    const pool = decodeAddress(await call(factory, getPool));
    if (/^0x0+$/.test(pool)) {
      console.log(`  --   fee ${fee}: pool belum dibuat`);
      continue;
    }
    const liq = decodeUint(await call(pool, SELECTOR.liquidity));
    console.log(`  ${liq > 0n ? "OK  " : "KOSONG"} fee ${fee}: ${pool} · liquidity=${liq}`);
  }

  console.log(`\n${failures === 0 ? "Semua pemeriksaan lolos." : `${failures} pemeriksaan GAGAL.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
