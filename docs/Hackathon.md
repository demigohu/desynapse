# The Smart Money Era: BNB Agent Studio Hackathon

## Overview

The Smart Money Era is here, where knowing the right people no longer gates access to financial opportunities. Keep up with the next generation of finance by having the right agents available on-demand to service any market 24/7.

Finding agents on BNB Chain today is harder than it should be, we want you to help us make opportunities more discoverable and accessible to all by building the marketplace for BNB Chain’s AI agents, the new home for smart money.

## Prizes & Bounties

### Main Track Prize

- 🥇 **Winner:** $30,000 equivalent, plus official adoption as the BNB Agent Studio marketplace, the canonical front door for every agent on BSC.

### Partner Bounties

Partner bounties are judged independently by each partner, on their own criteria.

#### Best Built with Altana

- 🏆 **50,000 Altana XP.** Winner takes all, awarded to one team. (Allocation mechanics to be confirmed.)
- To be considered for the prize, your submission must show live onchain transactions in the Altana explorer, on testnet or mainnet. See the Tracks tab for the full qualification criteria, and make sure to include your wallet address(es) in your submission.

#### TermiX Challenge

- 🥇 **1st Place:** $6,000
- 🥈 **2nd Place:** $3,000
- 🥉 **3rd Place:** $1,000
- _Judged independently by TermiX on its own criteria (see the Tracks tab). Submissions must include the required Agent Advantage Report to be eligible._

#### PancakeSwap Challenge

- 🏆 **1,000 CAKE** for the best submission delivering a real benefit to PancakeSwap traders or liquidity providers (see the Tracks tab for the challenge details).

---

## Tracks

### Main Track: Build the BNB Agent Studio Marketplace

Build the best agent marketplace for BNB Chain. Somewhere, users need to find agents, understand what they do, and hire them in a few clicks. Right now that place doesn't exist. So: build it.

The top submission gets officially adopted as the BNB Agent Studio marketplace, the canonical front door for every agent on BSC. This isn't a demo day. Whatever you ship here is what real users interact with next.

#### What You're Building

A front end that surfaces agent data, lets users discover and activate agents by category, and doesn't make them think too hard about it.
Four categories, all first-class:

- **Rebalancing:** Manages LP ranges, resets positions automatically
- **Grid Trading:** Places and manages automated grid orders
- **Yield Optimisation:** Routes liquidity to the highest available APR
- **Health Factor Monitoring:** Protects lending positions from liquidation

_Note: Single-category submissions score poorly. All four, equally deep, is the bar._

#### How You're Judged

Three judges, scored independently, then compared.

- **Functionality:** The full journey works end to end: land, find an agent by category, understand what it does, activate it, with minimal friction. Someone with zero Agent Studio knowledge should be able to get through it without hitting a dead end.
- **Data Quality:** Real-time, accurate data that goes beyond basic counts. A user should be able to look at what you're showing and make a genuinely informed call on which agent to hire.
- **Agent Diversity:** All four categories (rebalancing, grid trading, yield, health factor) surfaced with equal depth. A submission that treats one category as the main event and the rest as an afterthought won't score well here.

_(We'll also assess more criterias in the second phase, stay tuned to find out!)_

#### Timeline

- **Build:** NOW!
- **Shortlist:** Submissions close and the top 3 are shortlisted publicly.
- **Phase 2:** [REDACTED]
- **Winner announced**

#### Tooling

Describe it, and Cursor scaffolds it against the BNB Agent Studio CLI. No blockchain experience required to get from idea to deployed agent. Agent Studio runs on AWS underneath; that's just how it works, not a separate track to build for.

#### Eligibility

- Open globally, to individuals or teams.
- One entry per team.
- Your submission must be functional and publicly accessible during judging.
- Agents surfaced on your marketplace must be live on BSC.

### Partner Track: Best Built with Altana

Altana is self-custodial infrastructure for sovereign agents. An agent holds its own wallet and its own key: no custodian, no shared treasury, no human signing every transaction. The owner grants a scoped session (which calls the agent may make, how much it may spend, when the permission expires), and grant and revoke stay with the owner. Every session key is registered in a public onchain registry, so any app or agent can check which keys hold authority on a wallet and when that authority expires. Revocation is one transaction and takes effect immediately.

The track: build an agent marketplace on BNB Chain where the agents transact for themselves, inside limits their users set.

#### What Separates a Winner from a Participant

To be considered for the prize, your submission must show live onchain transactions in the Altana explorer (testnet or mainnet).

- Agents on their own Altana wallets.
- Sessions with real limits: call allowlist, spend cap, expiry.
- Sessions registered in Keystore, so integration is read onchain rather than from the pitch.
- Real onchain transactions through a session key. Testnet counts, mainnet is stronger.
- User-facing control: a user can see what their agent may do, and revoke it, inside the product.

**Bonus:**

- Hire BNB Agent Studio agents through ERC-8183 using the Altana ERC-8183 SDK. Altana ships both the buyer side and the seller side.
- Implement sell over x402/B402 using the x402 server SDK.

#### Ideas to Build

| Build                        | The agent does                                                        | Altana piece                                           |
| :--------------------------- | :-------------------------------------------------------------------- | :----------------------------------------------------- |
| **Agent hiring marketplace** | Hires and pays other agents, escrow handled                           | ERC-8183 buyer side, hireErc8183Agent                  |
| **Agent-to-agent commerce**  | Buys inference or data per call, neither side holds the other's keys  | b402 payments, `@altananetwork/x402-server`            |
| **Autonomous DeFi**          | Rebalances, lends, stakes, copy-trades inside a cap it cannot exceed  | Spend caps plus Aave, Venus, PancakeSwap, Lista skills |
| **Micro-payment streaming**  | Pays per call, per second, per unit, with no human approving each one | Session key with expiry, b402                          |
| **Treasury or payroll**      | Runs recurring payments and subscriptions on a schedule               | Multiple agents on one wallet, different scopes        |

### Partner Track: TermiX Challenge

What TermiX is judging, in one line: does hiring an agent on this marketplace actually beat doing the job yourself, and can you prove it with numbers?
You are not asked to integrate anything with TermiX. The submission is the marketplace itself, judged on whether the agents on it are genuinely worth paying for. TermiX will hire from your marketplace themselves and see what comes back.

#### How You're Judged

TermiX scores independently of the main track rubric.

- **Value of the services (30%):** Real working agents at a price and speed that beat the alternative. TermiX will hire from your marketplace and evaluate the results.
- **Proven agent advantage (30%):** Measured, not asserted, backed by the required Agent Advantage Report.
- **High-stakes categories & track record (20%):** Trading, stock/equities and security agents weighted above general-purpose. Trading agents need a real record: win rate, the window, and the risk taken to get there.
- **Marketplace quality (20%):** Find, compare, hire, without instructions.

#### Required: Agent Advantage Report

Your submission must include an Agent Advantage Report:

1. At least 3 real tasks run both ways: with an agent hired through your marketplace vs. without.
2. For each task, report time, cost and output quality, with the actual outputs attached.
3. At least one task must come from trading, stock or security.

_The "Proven agent advantage" criterion (30%) is scored against this report, so plan for it from day one._

### Partner Challenge: PancakeSwap

Your agent must deliver a real benefit to PancakeSwap traders or liquidity providers. For example: smarter liquidity management, finding better yields, researching market movements to find demand where creating PancakeSwap pools could improve liquidity efficiency, or executing safe automated swaps using PancakeSwap products without ever putting user funds at risk.

---

## Resources

### BNB Chain & Agent Studio

- **BNB Agent Studio:** ship an AI agent that runs itself. Describe it, and Cursor scaffolds it against the BNB Agent Studio CLI. No blockchain experience required to get from idea to deployed agent.
- **BNB Agent Studio launch overview:** how Agent Studio works and what you can build with it.
- **BSC Testnet Faucet:** get testnet BNB for development and testing.

### Altana

- **Quickstart:** build an agent marketplace on BNB with Altana.
- **Live workshop:** hands-on session during the build period (date TBC).
- **Office hours:** available throughout the build period.
- **Ten production skills to compose, at skills.altana.network:** Aave V3 Lending, Copy Trade, Four.meme Trading, Lista Liquid Staking, PancakeSwap Liquidity, PancakeSwap Trading, Token Radar, Venus Lending, Wallet Tracker, x402 API Payments.
- **Links:** Altana docs, SDK and MCP server, Sessions, ERC-8183 SDK, x402 server SDK, Testnet faucet.

### 8004scan (by AltLayer)

8004scan is the home for ERC-8004 agents and a discovery and trust layer for the onchain agent economy. It helps builders discover agents, verify their identities, evaluate reputation signals, and track activity across multiple blockchain networks. BNB Chain is the largest ERC-8004 ecosystem tracked by 8004scan, with more than 200,000 registered agents.

Through the 8004scan developer API, you can access structured agent identity, capability, ownership, reputation, feedback, and network data to build agent marketplaces, discovery and recommendation tools, reputation systems, analytics dashboards, and agent-to-agent applications.

**Free Pro-tier access for hackathon participants:** eligible participants receive complimentary access to the 8004scan Pro API tier for the duration of the hackathon.

- Up to 500 API requests per minute
- Up to 100,000 requests per day
- To apply, create an API key through the 8004scan Developer Hub and submit your details through the Pro-Tier Upgrade Form.
- **Links:** 8004scan, 8004scan Developer Hub and API, Pro-Tier Upgrade Form, 8004scan Ecosystem Report, Explore BNB Chain agents.

### TermiX

- **TermiX:** the marketplace where AI agents hire agents.
- **BSC MCP server:** TermiX's open-source MCP server for interacting with BNB Chain.

### PancakeSwap

- PancakeSwap Developer Portal
- PancakeSwap Documentation
