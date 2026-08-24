/**
 * BSC Testnet addresses verified on-chain 24 Aug 2026
 * (repo scripts/verify-testnet-addresses.mjs).
 */

export const BSC_TESTNET_RPC =
  process.env.BNB_TESTNET_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com";

export const COMPTROLLER =
  "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D" as const;

export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;

export const VTOKENS = {
  vUSDT: {
    symbol: "vUSDT",
    address: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A",
    underlying: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c",
    underlyingSymbol: "USDT",
    underlyingDecimals: 18,
  },
  vUSDC: {
    symbol: "vUSDC",
    address: "0xD5C4C2e2facBEB59D0216D0595d63FcDc6F9A1a7",
    underlying: "0x16227D60f7a0e586C66B005219dfc887D13C9531",
    underlyingSymbol: "USDC",
    underlyingDecimals: 18,
  },
  vBNB: {
    symbol: "vBNB",
    address: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c",
    underlying: WBNB,
    underlyingSymbol: "BNB",
    underlyingDecimals: 18,
  },
} as const;

export type VTokenName = keyof typeof VTOKENS;

export const VTOKEN_BY_ADDRESS: Record<string, (typeof VTOKENS)[VTokenName]> =
  Object.fromEntries(
    Object.values(VTOKENS).map((m) => [m.address.toLowerCase(), m]),
  );

export function isKnownVToken(address: string): boolean {
  return address.toLowerCase() in VTOKEN_BY_ADDRESS;
}
