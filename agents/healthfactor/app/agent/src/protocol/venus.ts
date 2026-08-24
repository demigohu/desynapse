/**
 * Read-only Venus Core Pool (BSC testnet). Never signs.
 *
 * Health factor here is risk-adjusted collateral / borrows, using each
 * market's collateral factor and the Comptroller oracle. HF < 1 is the
 * on-chain liquidation line; the agent triggers earlier (see strategy/config).
 */

import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
  type PublicClient,
} from "viem";
import { bscTestnet } from "viem/chains";
import {
  BSC_TESTNET_RPC,
  COMPTROLLER,
  VTOKEN_BY_ADDRESS,
  VTOKENS,
} from "./addresses.js";

const comptrollerAbi = [
  {
    type: "function",
    name: "getAccountLiquidity",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "error", type: "uint256" },
      { name: "liquidity", type: "uint256" },
      { name: "shortfall", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "oracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "markets",
    stateMutability: "view",
    inputs: [{ name: "vToken", type: "address" }],
    outputs: [
      { name: "isListed", type: "bool" },
      { name: "collateralFactorMantissa", type: "uint256" },
      { name: "isVenus", type: "bool" },
    ],
  },
] as const;

const vTokenAbi = [
  {
    type: "function",
    name: "getAccountSnapshot",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "error", type: "uint256" },
      { name: "vTokenBalance", type: "uint256" },
      { name: "borrowBalance", type: "uint256" },
      { name: "exchangeRateMantissa", type: "uint256" },
    ],
  },
] as const;

const oracleAbi = [
  {
    type: "function",
    name: "getUnderlyingPrice",
    stateMutability: "view",
    inputs: [{ name: "vToken", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

let cached: PublicClient | undefined;

export function publicClient(): PublicClient {
  cached ??= createPublicClient({
    chain: bscTestnet,
    transport: http(BSC_TESTNET_RPC),
  });
  return cached;
}

export type MarketPosition = {
  symbol: string;
  vToken: Address;
  supplyUnderlying: string;
  borrowUnderlying: string;
  supplyUsd: number;
  borrowUsd: number;
  collateralFactor: number;
};

export type AccountHealth = {
  address: Address;
  healthFactor: number | null;
  liquidityUsd: number;
  shortfallUsd: number;
  supplyUsd: number;
  borrowUsd: number;
  liquidatable: boolean;
  hasBorrow: boolean;
  markets: MarketPosition[];
  blockNumber: string;
};

const MANTISSA = 10n ** 18n;

function usdFromUnderlying(amount: bigint, price: bigint): number {
  // Venus/Compound oracle: USD with 36 - underlyingDecimals (18 here → 1e18).
  const usdWad = (amount * price) / MANTISSA;
  return Number(formatUnits(usdWad, 18));
}

export async function readAccountHealth(
  account: Address,
): Promise<AccountHealth> {
  const client = publicClient();
  const [liquidityRaw, oracle, blockNumber] = await Promise.all([
    client.readContract({
      address: COMPTROLLER,
      abi: comptrollerAbi,
      functionName: "getAccountLiquidity",
      args: [account],
    }),
    client.readContract({
      address: COMPTROLLER,
      abi: comptrollerAbi,
      functionName: "oracle",
    }),
    client.getBlockNumber(),
  ]);

  const [, liquidityWad, shortfallWad] = liquidityRaw;
  const markets: MarketPosition[] = [];

  for (const market of Object.values(VTOKENS)) {
    const vToken = market.address as Address;
    const [snapshot, listed, price] = await Promise.all([
      client.readContract({
        address: vToken,
        abi: vTokenAbi,
        functionName: "getAccountSnapshot",
        args: [account],
      }),
      client.readContract({
        address: COMPTROLLER,
        abi: comptrollerAbi,
        functionName: "markets",
        args: [vToken],
      }),
      client.readContract({
        address: oracle,
        abi: oracleAbi,
        functionName: "getUnderlyingPrice",
        args: [vToken],
      }),
    ]);

    const [, vTokenBal, borrowBal, exchangeRate] = snapshot;
    const [, cfMantissa] = listed;
    const supplyUnderlying = (vTokenBal * exchangeRate) / MANTISSA;
    const supplyUsd = usdFromUnderlying(supplyUnderlying, price);
    const borrowUsd = usdFromUnderlying(borrowBal, price);

    if (vTokenBal === 0n && borrowBal === 0n) continue;

    markets.push({
      symbol: market.symbol,
      vToken,
      supplyUnderlying: formatUnits(supplyUnderlying, market.underlyingDecimals),
      borrowUnderlying: formatUnits(borrowBal, market.underlyingDecimals),
      supplyUsd,
      borrowUsd,
      collateralFactor: Number(cfMantissa) / 1e18,
    });
  }

  const supplyUsd = markets.reduce((s, m) => s + m.supplyUsd, 0);
  const borrowUsd = markets.reduce((s, m) => s + m.borrowUsd, 0);
  const riskAdjusted = markets.reduce(
    (s, m) => s + m.supplyUsd * m.collateralFactor,
    0,
  );
  const healthFactor =
    borrowUsd > 0 ? riskAdjusted / borrowUsd : null;

  return {
    address: account,
    healthFactor,
    liquidityUsd: Number(formatUnits(liquidityWad, 18)),
    shortfallUsd: Number(formatUnits(shortfallWad, 18)),
    supplyUsd,
    borrowUsd,
    liquidatable: shortfallWad > 0n,
    hasBorrow: borrowUsd > 0,
    markets,
    blockNumber: blockNumber.toString(),
  };
}

export function vTokenMeta(address: string) {
  return VTOKEN_BY_ADDRESS[address.toLowerCase()];
}
