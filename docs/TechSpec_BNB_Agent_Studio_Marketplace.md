# Tech Spec: BNB Agent Studio Marketplace

**Status:** Draft v0.6
**Turunan dari:** PRD v0.8
**Referensi terverifikasi:** docs.altana.network, github.com/altananetwork/altana-sdk, dan **percobaan langsung `bag` CLI 0.0.12** — scaffold, keystore, grant session on-chain, `bag dev`, dan negosiasi A2A bertanda tangan semuanya diuji berhasil pada 23 Agustus 2026

> **Peringatan sumber.** Halaman `docs.bnbchain.org/developer-kit/bnbchain-studio/deployment` menjelaskan arsitektur v0.0.1 (Python, dua lapis, `app/service`, port 8080/8003). Itu **usang** terhadap CLI 0.0.12 yang dipakai proyek ini. Acuan yang benar adalah panduan terbundel di dalam paket npm `@bnbagent/studio-cli` pada `skills/references/`, ditambah keluaran `bag <cmd> --help`.

**Perubahan dari v0.1:** smart contract custom dihapus (Agent Studio tidak menghasilkannya), agent jadi proyek Python terpisah, admin key pindah ke passkey user, contoh kode Altana dikoreksi terhadap API sebenarnya, ditambah pipeline data tiga lapis.

**Perubahan dari v0.2:** satu wallet Altana menampung beberapa session agent, `AltanaWallet` dipisah dari `UserSession` di data model, dan alur hire berikutnya dipetakan.

**Perubahan dari v0.3:** MetaMask dan wagmi dihapus sepenuhnya — passkey adalah satu-satunya wallet sekaligus identitas user. Pembukaan posisi awal pindah dari jalur admin ke agent lewat session key.

**Perubahan dari v0.4:** pemungutan fee turun jadi bonus (pelacakan P&L tetap wajib), `AgentExecution` ditambahkan dengan verifikasi penerima, dan P&L diatribusikan per session agar bisa dipisah per agent pada wallet bersama.

**Perubahan dari v0.5 — hasil percobaan langsung, banyak yang membatalkan asumsi sebelumnya:**

- Agent Studio menghasilkan **TypeScript satu proses**, bukan Python dua lapis. `app/service` dan Layer B tidak ada. Pemisahan worker/agent dihapus dan digabung.
- **Altana adalah wallet backend bawaan** (`--wallet-kind altana`), lengkap dengan `bag wallet session grant/status/revoke`. Sebagian integrasi yang direncanakan manual ternyata sudah tersedia sebagai perintah CLI.
- **Hosting pindah ke VPS.** AgentCore scale-to-zero dan endpointnya terkunci OAuth2 Cognito, keduanya tidak cocok untuk agent yang harus berjaga dan bisa dipanggil publik.
- **AWS tidak lagi wajib** sama sekali; `bag deploy` mendukung `bnb`, `aws`, dan `azure`.
- Ditambah desain **loop tick** dan **penyimpanan session key user**, dua hal yang tidak ada di scaffold dan harus dibangun sendiri.

---

## 1. Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | SSR untuk listing, client-side untuk passkey dan wallet |
| Wallet & identitas user | `@altananetwork/sdk` (passkey) + `viem` | Satu-satunya wallet user. Tidak ada wagmi, tidak ada connect MetaMask, tidak ada login |
| Self-custodial layer | `@altananetwork/sdk` + `viem` | Wallet passkey, session, execute, Keystore reads |
| Styling | Tailwind | Cepat untuk UI marketplace |
| Backend/API | Next.js API routes | Satu bahasa dengan frontend |
| Agent | BNB Agent Studio (`bag` CLI 0.0.12) — Node ≥ 22 + TypeScript | Satu proses: melayani A2A, menjalankan loop strategi, memegang session key user, memanggil `client.execute`. Identitas ERC-8004 sesuai requirement hackathon |
| Database | PostgreSQL | Data terindeks, session, metrik |
| Indexer | [Ponder](https://ponder.sh) | Indexing EVM type-safe berbasis TypeScript |
| RPC | Alchemy BSC Testnet + `https://bsc-testnet-rpc.publicnode.com` sebagai fallback | Hindari rate limit saat judging |
| Deployment — frontend | Vercel | Native Next.js |
| Deployment — indexer, DB | VPS via Docker Compose | Proses long-running, tidak cocok serverless |
| Deployment — agent | VPS, pm2 atau systemd | AgentCore scale-to-zero sehingga loop tick tidak bertahan, dan endpointnya terkunci OAuth sehingga tidak bisa diakses publik (Section 6.4) |
| Package manager agent | pnpm | Dipakai `bag init`; tiap proyek agent punya `pnpm-workspace.yaml` sendiri sehingga tidak bentrok dengan npm di root repo |
| Monorepo | npm workspaces + Turborepo | Sesuai scaffold yang sudah ada di repo |
| Chain | BSC Testnet (chain id 97) | Keputusan PRD |

### 1.1 Alamat dan endpoint testnet (terverifikasi)

| Item | Nilai |
|---|---|
| Chain id | 97 |
| Public RPC | `https://bsc-testnet-rpc.publicnode.com` |
| Block explorer | `https://testnet.bscscan.com` |
| Altana explorer | `https://testnet.altana.network` |
| Altana relay | `https://testnet-relay.altana.network` |
| KeyStore | `0x6b8361C29d05D498b1a12B54A37310f94171E94A` |
| KeyStoreController | `0xb530D1971f5453F3359518343F05D0AedFfF7e12` |
| Token $U (ERC-8183, 18 desimal) | `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` |
| Faucet tBNB | Telegram `https://t.me/bnbchain_official_bot`, atau `https://docs.bnbchain.org/bnb-smart-chain/developers/faucet/` |
| Faucet $U | `https://united-coin-u.github.io/u-faucet/` |
| Venus Comptroller | `0x94d1820b2D1c7c7452A163983Dc888CEC546b77D` |
| Venus vUSDT / USDT | `0xb7526572FFE56AB9D7489838Bf2E18e3323b441A` / `0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c` |
| Venus vUSDC / USDC | `0xD5C4C2e2facBEB59D0216D0595d63FcDc6F9A1a7` / `0x16227D60f7a0e586C66B005219dfc887D13C9531` |
| Venus vBNB | `0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c` |
| WBNB | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` |
| Pancake V3 NFPM | `0x427bF5b37357632377eCbEC9de3626C71A5396c1` |
| Pancake V3 SwapRouter | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` |
| Pancake V3 Factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| Pool demo rebalancing | WBNB/USDT(Venus) fee 100 · `0xced0844e421f856d2de472f9e7037f873987887c` (~0.29 WBNB + 3.001 USDT, terukur 24 Agu 2026) |

Diverifikasi on-chain 24 Agustus 2026 (`scripts/verify-testnet-addresses.mjs`, `scripts/probe-pool-depth.mjs`, `scripts/probe-pancake-native.mjs`). **Jangan pakai USDT/USDC mock PancakeSwap** (`0x337610d2…`, `0x64544969…`) untuk agent Venus — symbol-nya sama, kontraknya beda. Ada token `$U` kedua di `0x180Bc1a9843A65D4116e44886FD3558515a56A49`; yang dipakai rel ERC-8183 tetap alamat di `studio.toml`.

### 1.2 Topologi deployment

```
Browser (passkey wallet — admin key user, tidak pernah keluar device)
   |
   |  createPasskeyWallet · execute (jalur admin) · grantSession · revokeSession
   v
BSC Testnet (chain 97) <---- Altana relay ----+
   ^                                          |
   |  execute (jalur session user)            |
   |                                          |
VPS                                           |
   ├─ 4 proses agent (Node/TS, pm2/systemd) --+
   │     tiap proses:
   │       · melayani A2A di port sendiri (publik lewat reverse proxy)
   │       · loop tick berkala menjalankan strategi
   │       · memegang session key user (didekripsi di memori)
   │       · memegang session Altana miliknya sendiri (ALTANA_SESSION)
   ├─ Ponder (indexer + API)      ] Docker Compose
   └─ PostgreSQL                  ]

Vercel (Next.js) --HTTPS--> API Ponder + endpoint A2A tiap agent di VPS

Mesin developer (TIDAK di server)
   └─ .studio/wallets/ — keystore admin Altana tiap agent, terenkripsi
```

Prasyarat agar Vercel bisa memanggil VPS: reverse proxy dengan HTTPS (Caddy/Nginx + Let's Encrypt), CORS diizinkan untuk domain Vercel, dan `NEXT_PUBLIC_INDEXER_URL` diarahkan ke domain VPS. Endpoint A2A tiap agent juga dipublikasikan lewat reverse proxy yang sama, karena alamat inilah yang didaftarkan sebagai endpoint ERC-8004 dan yang akan dipanggil juri maupun TermiX.

**Pemisahan yang tidak boleh kabur.** Keystore admin Altana tiap agent hanya ada di mesin developer. Yang berjalan di VPS cuma session berbatas hasil `bag wallet session grant`. Kalau VPS dibobol, yang didapat penyerang adalah session dengan plafon harian dan tanggal kedaluwarsa yang bisa dicabut on-chain — bukan kunci admin.

## 2. Struktur Repo

```
/apps
  /web                -> Next.js: marketplace UI, passkey wallet, grant/revoke, dashboard
  /indexer            -> Ponder: event handler, Keystore reads, sinkron 8004scan, data pasar
/packages
  /altana-client      -> wrapper tipis di atas @altananetwork/sdk, dipakai web
  /shared-types       -> Agent, AgentMetrics, UserSession, dipakai lintas app
/agents               -> DI LUAR workspace npm (tiap agent punya pnpm workspace sendiri)
  /rebalancing
  /gridtrading
  /yieldrouter
  /healthfactor
```

Isi tiap proyek agent, sesuai hasil `bag init` yang sudah diverifikasi:

```
agents/healthfactor/
  AGENTS.md               -> invarian keamanan; dibaca IDE sebagai rule
  package.json            -> root pnpm workspace proyek agent
  pnpm-workspace.yaml
  .studio/
    .env.local            -> WALLET_PASSWORD, OPENROUTER_API_KEY (mode 0600, digitignore)
    wallets/              -> keystore admin + altana-session.json — TIDAK PERNAH ikut deploy
  agentcore/              -> deskriptor deploy; tidak dipakai karena hosting di VPS
  app/agent/
    studio.toml           -> konfigurasi: network, wallet, llm, harga 8183, storage
    package.json          -> deps: @bnbagent/studio-runtime, @bnbagent/sdk,
                             @altananetwork/sdk, @a2a-js/sdk, ai, express, viem
    src/
      unifiedMain.ts      -> entrypoint: express, port 9000 + 8088. TEMPAT LOOP TICK DITAMBAHKAN
      executor.ts         -> dispatch skill A2A; tempat menambah skill baru
      sellerCore.ts       -> logika negotiate / notifyFunded
      signing.ts          -> SEMUA penandatanganan on-chain; tidak boleh jadi tool LLM
      tools.ts            -> tool chain read-only untuk LLM
      agentCard.ts        -> deskripsi agent yang disajikan di /.well-known/agent-card.json
      model.ts            -> pemilihan provider LLM
```

`/agents` sengaja di luar npm workspaces karena tiap proyek agent memakai pnpm dengan `pnpm-workspace.yaml` sendiri. Ini sudah terbukti bekerja: menjalankan `pnpm install` dari dalam `agents/<nama>/` berhasil, sementara dari root repo ditolak karena root dikonfigurasi untuk npm.

**Jebakan penamaan.** `bag init <nama>` menolak nama yang mengandung `-`, `_`, atau `.`, harus diawali huruf, dan maksimal 23 karakter. Jadi `health-factor` **ditolak** dan harus ditulis `healthfactor`. Nama ini juga jadi nama runtime, sehingga tidak mudah diubah belakangan.

## 3. Data Model

```ts
// packages/shared-types
type Category = "rebalancing" | "grid_trading" | "yield_optimisation" | "health_factor";
type RiskProfile = "conservative" | "aggressive";

type Agent = {
  id: string;
  category: Category;
  variant: RiskProfile;
  name: string;
  erc8004Id?: string;                    // identitas on-chain dari Agent Studio
  identityWalletAddress: `0x${string}`;  // wallet identitas agent, bukan tempat dana user
  description: string;
  performanceFeeBps: number;             // dipungut saat penarikan, bukan lewat session
  liveSince: string;
  source: "self_deployed" | "8004scan";
  hireable: boolean;                     // agent 8004scan eksternal: false
  metrics: AgentMetrics;
};

type AltanaWallet = {
  address: `0x${string}`;                // smart account, admin = passkey user.
                                         // Sekaligus identitas user; tidak ada EOA terpisah
  activatedAt: string | null;            // null selama masih counterfactual
  approvedProtocols: `0x${string}`[];    // sudah di-approve lewat jalur admin, tidak perlu diulang
};

type UserSession = {
  id: string;
  altanaWalletAddress: `0x${string}`;    // beberapa session berbagi wallet yang sama
  agentId: string;
  sessionPublicKey: `0x${string}`;
  permissions: {
    calls: { to?: `0x${string}`; signature?: string }[];
    spend: { token?: `0x${string}`; limit: string; period: "hour" | "day" }[];
  };
  expiry: number;                        // unix epoch seconds
  status: "active" | "expired" | "revoked";
  createdAt: string;
};

type PositionSnapshot = {
  sessionId: string;                     // per session, bukan per wallet — atribusi P&L per agent
  takenAt: string;
  depositedValueUsd: string;             // basis untuk fee kinerja
  currentValueUsd: string;
  realizedFeesUsd: string;
  gasSpentUsd: string;
  accruedPerformanceFeeUsd: string;      // ditampilkan live; pemungutan ditunda (PRD 10.1)
};

type AgentExecution = {
  id: string;
  sessionId: string;
  transactionHash: `0x${string}`;
  status: "confirmed" | "failed";
  target: `0x${string}`;                 // kontrak yang dipanggil
  functionSignature: string;
  recipients: `0x${string}`[];           // penerima yang terdeteksi dari call & transfer log
  recipientsVerified: boolean;           // true bila semua penerima == altanaWalletAddress
  timestamp: string;
};
```

`PositionSnapshot` adalah fondasi dua hal sekaligus: perhitungan fee kinerja (PRD Section 10) dan metrik turunan seperti APY bersih (PRD Section 8).

Relasinya satu-ke-banyak: satu `AltanaWallet` menampung beberapa `UserSession`, satu per agent yang disewa. `approvedProtocols` dipakai frontend untuk menentukan apakah hire berikutnya butuh prompt approve tambahan atau cukup satu prompt `grantSession` (PRD Section 9.2a).

Karena wallet dipakai bersama beberapa agent, `PositionSnapshot` dan `AgentExecution` sengaja dikunci ke `sessionId`, bukan ke alamat wallet. Ini yang membuat P&L bisa diatribusikan per agent meskipun dananya satu kolam (PRD Section 10.4).

## 4. Integrasi Altana — Implementasi

Seluruh contoh di bawah dicocokkan dengan API aktual `@altananetwork/sdk`.

### 4.1 Membuat wallet user (browser)

```ts
import { createClient, BNB_TESTNET } from "@altananetwork/sdk";

const client = createClient({ chains: [BNB_TESTNET] });

const wallet = await client.createPasskeyWallet({
  name: "Desynapse",
  rpId: "desynapse.example",   // domain aplikasi
});
// wallet.address -> UserSession.altanaWalletAddress
```

Wallet ini **counterfactual**: alamatnya deterministik tapi kontraknya belum ada di chain sampai `execute` pertama. Danai `wallet.address` dengan test BNB sebelum transaksi pertama, atau execute akan gagal.

Untuk user yang kembali:

```ts
const wallet = await client.recoverFromPasskey({ rpId: "desynapse.example" });
```

`recoverFromPasskey` membutuhkan minimal satu key aktif di Keystore, artinya wallet harus pernah melakukan `execute`. Wallet yang dibuat tapi tidak pernah dipakai tidak bisa dipulihkan — inilah sebabnya langkah setup di PRD Section 9.2 harus memicu execute pertama.

### 4.2 Approve — jalur admin

Hanya `approve` yang berjalan lewat jalur admin, ditandatangani user dengan biometrik. Pembukaan posisi awal **tidak** ada di sini — itu dikerjakan agent lewat session key (Section 4.4), sesuai PRD Section 9.2.

`execute` menerima array, jadi beberapa approve ke protokol berbeda bisa dibatch dalam satu prompt.

```ts
const result = await client.execute({
  wallet,
  signer: wallet.signer,        // passkey user
  calls: [
    { to: tokenAddress, data: approveCalldata, value: 0n },
  ],
});
```

Ini adalah `execute` pertama pada wallet baru, yang mengaktifkan smart account di chain dan mendaftarkan admin key di Keystore. Setelah ini `recoverFromPasskey` mulai bisa bekerja. Alamat protokol yang berhasil di-approve dicatat ke `AltanaWallet.approvedProtocols` agar hire berikutnya bisa melewati langkah ini.

### 4.3 Grant session — saat user klik Hire

Session key dibangkitkan sendiri, tidak dibiarkan SDK yang membuat. Alasannya: tipe `Signer` hanya mengekspos alamat, public key, dan kemampuan menandatangani — dia tidak bisa mengembalikan private key, sehingga key yang dibuat SDK tidak bisa dipersistensi oleh proses agent.

```ts
import { generatePrivateKey } from "viem/accounts";
import { signerFromPrivateKey } from "@altananetwork/sdk";

const sessionKey = generatePrivateKey();
const sessionSigner = signerFromPrivateKey(sessionKey);

const session = await client.grantSession({
  wallet,
  signer: wallet.signer,        // passkey USER yang menandatangani, bukan backend
  sessionSigner,
  permissions: {
    calls: [
      { to: positionManager, signature: "decreaseLiquidity(...)" },
      { to: positionManager, signature: "increaseLiquidity(...)" },
      { to: positionManager, signature: "collect(...)" },
    ],
    spend: [
      { token: usdtTestnet, limit: 50n * 10n ** 18n, period: "day" },
    ],
  },
  expiry: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  register: true,               // default; wajib agar terverifikasi publik di Keystore
});
```

Empat hal yang wajib diperhatikan:

**`permissions.calls` yang dikosongkan berarti tidak terbatas.** Session tanpa scope justru menggugurkan kriteria Altana track, bukan sekadar kurang rapi. Selalu isi `calls` dan `spend`.

**Signature harus kanonik lengkap.** Format `"transfer(address,uint256)"`, bukan `"transfer(...)"`. Untuk fungsi PancakeSwap V3 yang menerima struct, bentuk kanoniknya adalah tuple yang diperluas, dan harus diverifikasi terhadap selector-nya sebelum dipakai. Placeholder `(...)` di contoh di atas **harus diganti** sebelum implementasi.

**Desimal.** Stablecoin di BNB Chain memakai 18 desimal, bukan 6. Ini kesalahan paling umum menurut dokumentasi Altana, dan gejalanya membingungkan: pembayaran kecil ditolak oleh limit yang terlihat besar.

**`grantSession` melempar exception saat gagal**, berbeda dari `execute` yang mengembalikan status.

Setelah grant, browser mengirim `sessionKey` beserta `permissions` dan `expiry` ke backend lewat HTTPS untuk disimpan terenkripsi. Ini memang private key yang menyeberang jaringan — tapi key yang dibatasi allowlist, dibatasi spend cap, punya expiry, dan bisa dicabut sepihak oleh user. Keputusan ini diambil sadar, bukan kelalaian.

### 4.4 Eksekusi strategi — loop tick agent, jalur session

```ts
const result = await client.execute({
  session,                       // Session object byte-exact
  calls: [{ to: positionManager, data: encodedCall, value: 0n }],
});

if (result.status !== "CONFIRMED") {
  // tangani di sini — tidak ada exception yang dilempar
}
```

**Gunakan jalur session, bukan jalur admin.** Ini yang membuktikan pembatasan izin bekerja secara on-chain. Proses agent tidak punya admin key sama sekali, jadi jalur admin memang tidak tersedia untuknya.

**Persistensi `Session` harus byte-exact.** Validator on-chain mencocokkan `permissions` dan `expiry` byte-per-byte terhadap yang di-commit saat grant. Penyebab paling umum kerusakan adalah JSON round-trip yang mengubah bigint jadi number. Simpan dengan serializer yang mempertahankan bigint.

**`ExecuteResult` punya tiga status:**

| Status | Arti | Penanganan |
|---|---|---|
| `CONFIRMED` | Sukses, `transactionHash` terisi | Catat ke riwayat |
| `FAILED` | Relay melaporkan gagal. Tanpa alasan, tanpa receipt | Alert; diagnosis lewat BscScan pakai alamat wallet |
| `PENDING` | `noWait: true`, atau SDK poll 240 detik tanpa kepastian | **Perlakukan sebagai tidak diketahui, bukan gagal.** Poll `callsId` sebelum retry, atau berisiko mengirim intent yang sama dua kali |

### 4.5 Revoke — ditandatangani user

```ts
await client.revokeSession({ wallet, signer: wallet.signer, session });
```

Ditandatangani passkey user di browser, bukan oleh backend. Setelah konfirmasi, `UserSession.status` diperbarui jadi `revoked`, dan percobaan `execute` berikutnya oleh agent akan revert di level validasi on-chain — bukan sekadar diblokir aplikasi.

`revokeSession` mengembalikan `ExecuteResult`, jadi berlaku aturan status yang sama seperti Section 4.4.

### 4.6 Verifikasi status — Keystore reads

Read gratis dan tak terbatas dari RPC mana pun, cocok untuk polling indexer.

```ts
import { createPublicClient, http, keccak256 } from "viem";
import { BNB_TESTNET } from "@altananetwork/sdk";

const pub = createPublicClient({
  chain: BNB_TESTNET.chain,
  transport: http(BNB_TESTNET.publicRpcUrl),
});

const keyId = keccak256(session.publicKey);

const authorized = await pub.readContract({
  address: BNB_TESTNET.keyStore,
  abi: [{
    name: "isValidKey", type: "function", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }, { name: "keyId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  }] as const,
  functionName: "isValidKey",
  args: [session.walletAddress, keyId],
});
```

**Jebakan:** `getKeys(walletAddress)` menghapus key yang di-revoke seketika, tapi **tidak** menghapus key yang expired. Key bisa tetap terdaftar lama setelah tidak berlaku. Status di dashboard harus selalu hasil kombinasi `getKeys` dan `isValidKey`, bukan salah satu saja.

## 5. Mapping Alur ke Kode

| Langkah UX (PRD Section 13) | Pemanggilan teknis | Di mana |
|---|---|---|
| Buat akun | `createPasskeyWallet({ name, rpId })` | Browser |
| User kembali | `recoverFromPasskey({ rpId })` — tanpa langkah login | Browser |
| Danai | Transfer ke `wallet.address`; polling saldo untuk deteksi otomatis | Browser |
| Approve | `execute({ wallet, signer: wallet.signer, calls: [...] })` | Browser |
| Hire — review scope | Render `permissions` **plus rencana tindakan pertama agent** | Browser |
| Hire — tanda tangan | `grantSession` ditandatangani passkey user | Browser |
| Hire — serah session key | POST terenkripsi ke backend | Browser → VPS |
| Hire berikutnya | `grantSession` lagi pada wallet yang sama; approve dilewati jika protokolnya sudah ada di `approvedProtocols` | Browser |
| Agent buka posisi | `execute({ session, calls })` — transaksi pertama lewat session key | Agent, tick pertama |
| Agent bekerja | `execute({ session, calls })` | Agent, loop tick |
| Monitor | Keystore reads + riwayat dari indexer | Indexer → Web |
| Revoke | `revokeSession` ditandatangani passkey user, per session | Browser |
| Exit | `execute` jalur admin: tarik posisi. Panggilan fee kinerja disisipkan ke batch yang sama bila fitur pemungutan sudah aktif | Browser |

Backend tidak pernah memegang admin key atas dana user. Yang dipegang backend hanya session key, yang kewenangannya sudah dibatasi on-chain.

## 6. Agent Studio

### 6.1 Yang dihasilkan

`bag init` menghasilkan **satu proyek TypeScript satu proses**, bukan smart contract dan bukan dua lapis. Entrypoint-nya `src/unifiedMain.ts`, sebuah aplikasi Express yang mengikat dua port sekaligus — 9000 untuk kontrak A2A dan 8088 untuk kontrak Azure Foundry — sehingga image yang sama bisa dijalankan di mana pun.

Bentuk bawaannya adalah **penjual berbasis job ERC-8183** dengan dua skill: `negotiate` yang mengembalikan penawaran harga bertanda tangan, dan `notify_funded` yang mengirim hasil kerja setelah pembayaran diverifikasi on-chain. Tidak ada penjadwal apa pun di dalamnya.

Batas keamanan yang ditegakkan scaffold dan tidak boleh dilanggar:

- Seluruh penandatanganan on-chain berada di `signing.ts` sebagai kode tetap, tidak pernah menjadi tool yang bisa dipanggil LLM
- Jalur penentuan harga deterministik — harga dibaca dari `studio.toml`, dijepit ke rentang min/max, lalu ditandatangani. LLM tidak pernah menentukan harga
- Tool chain untuk LLM read-only saja
- `.studio/wallets/` berada di root workspace, di luar `app/agent/`, sehingga tidak ada jalur pemaketan yang bisa menyertakannya

### 6.2 Prasyarat

- Node ≥ 22 dan pnpm. **Tidak butuh Python.**
- `bag` CLI: paket npm `@bnbagent/studio-cli`
- `WALLET_PASSWORD` di `.studio/.env.local` dengan izin 0600, diisi sebelum membuat keystore
- `OPENROUTER_API_KEY` — lihat batasan LLM di Section 6.5
- Untuk `bag deploy` saja: Bun 1.3+ karena delegasinya lewat `bunx`. Tidak diperlukan bila hosting di VPS.

### 6.3 Urutan perintah yang sudah diverifikasi

Urutan berikut sudah dijalankan sampai berhasil pada agent `healthfactor`:

```bash
bag init healthfactor --wallet-kind altana --rails 8183 --ide cursor --no-onboard --no-install
cd healthfactor && pnpm install
# isi WALLET_PASSWORD di .studio/.env.local, lalu:
(cd app/agent && bag wallet new)              # cetak alamat admin
# danai alamat itu: >= 0.02 tBNB dan >= 1 U
(cd app/agent && bag wallet session grant --budget-u 10 --expiry-days 30 --yes)
(cd app/agent && bag doctor)                  # semua FAIL harus bersih
(cd app/agent && bag dev)                     # melayani di :9000
```

Biaya gas `session grant` terukur sekitar **0.0018 tBNB**, jadi 0.05 tBNB per agent sudah sangat cukup.

Verifikasi cepat bahwa agent hidup dan session key benar-benar bisa menandatangani:

```bash
curl -s http://localhost:9000/.well-known/agent-card.json
# lalu kirim skill negotiate sebagai DataPart JSON-RPC ke http://127.0.0.1:9000/
```

Respons `negotiate` yang sehat memuat `provider_sig` sepanjang 98 byte — tanda tangan ECDSA biasa ditambah 33 byte penanda, yang menunjukkan penandatangannya adalah smart account bersession, bukan EOA polos.

### 6.4 Kenapa tidak memakai `bag deploy`

`bag deploy` mendukung tiga penyedia: `bnb` (runtime terkelola di akun AWS operator BNB Chain, trial 48 jam), `aws` (akun sendiri), dan `azure`. Semuanya bermuara ke runtime terkelola, dan itu bermasalah untuk produk ini karena empat hal:

| Hambatan | Akibatnya untuk kita |
|---|---|
| AgentCore **scale-to-zero**, batas hidup ≤ 8 jam | Loop tick lima menitan tidak bertahan. Posisi user bisa jatuh saat runtime tidur |
| Endpoint **tidak pernah anonim** — OAuth2 Cognito dipasang otomatis | Juri dan TermiX harus mengurus client id, secret, dan token sebelum bisa mencoba agent |
| Trial `bnb` **hidup 48 jam**, dihitung dari deploy pertama dan tidak bisa di-reset | Agent yang seharusnya berjaga terus malah punya tanggal mati |
| Kuota AWS `L-F4575653` **bisa nol di akun baru** | Empat agent butuh empat runtime; kalau permintaan kenaikan ditolak, terkunci total |

Karena itu agent dijalankan di VPS sebagai proses biasa: `pnpm build` lalu `node dist/unifiedMain.js` di bawah pm2 atau systemd, dengan reverse proxy untuk TLS dan akses publik.

Yang hilang hanya kemudahan operasional. Identitas ERC-8004 tetap didaftarkan lewat perintah tingkat atas yang berdiri sendiri:

```bash
bag erc8004 register --endpoint https://healthfactor.desynapse.example/
bag erc8004 show
```

Aturan hackathon mendukung pilihan ini: *"Agent Studio runs on AWS underneath; that's just how it works, not a separate track to build for."*

### 6.5 Batasan yang perlu diantisipasi

**Altana mematikan LLM gratis.** Saat `--wallet-kind altana` dipilih, CLI memberi tahu bahwa Altana tidak mendukung SIWE message signing yang dibutuhkan aktivasi Pieverse, sehingga provider jatuh ke OpenRouter yang berbayar. Perlu API key dan perlu anggaran. Pertanyaan yang belum terjawab: apakah loop strategi memang butuh LLM, atau cukup aturan deterministik dengan LLM dipakai hanya untuk menghasilkan penjelasan yang dibaca manusia.

**Jangan jalankan `bag wallet new` dua kali pada proyek Altana.** Keystore admin baru memutus jangkar `[wallet].address` yang diacu session, dan kesiapan deploy langsung gagal. Untuk mempersempit scope, gunakan `bag wallet session grant --force --budget-u <kecil> --expiry-days <pendek>`.

**Storage.** `bag deploy` menolak `storage.kind = "local"` karena tidak tahan deploy. Di VPS disk lokal justru persisten dan bisa dilayani sendiri, jadi kemungkinan besar IPFS tidak diperlukan — tapi ini masih perlu dipastikan (Section 13).

**Evaluator sengketa disuntikkan otomatis.** Respons `negotiate` memuat `evaluation_required: true` dengan `evaluator_type: "uma_oov3"` tanpa diminta. Kalau rel ERC-8183 diaktifkan, dampaknya ke jendela sengketa perlu dipahami lebih dulu.

### 6.6 Menjalankan empat agent di satu VPS

Keputusan: empat proses terpisah pada satu VPS, masing-masing di port sendiri, di belakang satu reverse proxy.

**Jebakan port yang harus diketahui di muka.** Entrypoint scaffold **selalu** mencoba mengikat 9000 dan 8088 selain port dari `AGENT_PORT`. Port pertama dalam daftar bersifat fatal bila gagal; sisanya best-effort dan hanya mencetak peringatan:

```ts
const override = Number(process.env.AGENT_PORT || process.env.PORT || "");
const ports = [...new Set([...(override > 0 ? [override] : []), 9000, 8088])];
```

Akibatnya di satu VPS: agent pertama yang menyala berhasil mengikat 9000 dan 8088, sementara tiga agent lainnya gagal mengikat keduanya dan mencetak `secondary contract port ... unavailable`. **Peringatan itu wajar dan tidak berbahaya** selama tiap agent punya `AGENT_PORT` unik, karena port utamanya tetap terikat. Jangan salah baca sebagai kegagalan deploy.

**Setel `AGENT_BIND_HOST=127.0.0.1`.** Saat dijalankan langsung dengan `node`, default-nya `0.0.0.0`, artinya agent terekspos langsung ke internet dan reverse proxy bisa dilewati. Di belakang proxy, ikat ke loopback saja.

Alokasi yang disarankan:

| Agent | `AGENT_PORT` | Endpoint publik (didaftarkan ke ERC-8004) |
|---|---|---|
| healthfactor | 9001 | `https://healthfactor.<domain>/` |
| rebalancing | 9002 | `https://rebalancing.<domain>/` |
| gridtrading | 9003 | `https://gridtrading.<domain>/` |
| yieldrouter | 9004 | `https://yieldrouter.<domain>/` |

Tiap agent punya wallet Altana, session, dan identitas ERC-8004 sendiri, jadi tidak ada state yang dibagi antar proses selain database. Isolasinya penuh: satu agent crash tidak menjatuhkan yang lain, dan pm2 me-restart-nya sendiri.

Ongkosnya empat runtime Node yang berjalan bersamaan. Untuk agent yang sebagian besar waktunya menunggu timer, ini ringan.

## 7. Loop Tick di Dalam Agent

Worker terpisah dari v0.5 **dihapus**. Karena agent sudah TypeScript, loop strategi hidup di proses yang sama, di samping server A2A.

### 7.1 Penyambungan

Scaffold tidak menyediakan penjadwal apa pun. Loop ditambahkan di `main()` pada `unifiedMain.ts`, setelah `app.listen`, dan dimatikan rapi saat `SIGTERM`:

```ts
// unifiedMain.ts — setelah servers = ports.map(...)
const tick = setInterval(() => {
  runStrategyTick().catch((e) => console.error("[tick] gagal:", e));
}, TICK_INTERVAL_MS);

process.once("SIGTERM", () => {
  clearInterval(tick);
  // ...penutupan server yang sudah ada
});
```

`runStrategyTick` ditulis sebagai modul baru di `src/`, terpisah dari file bawaan scaffold agar pembaruan `bag` tidak menimpanya.

### 7.2 Isi satu tick

1. Ambil session user aktif untuk agent ini dari database; dekripsi di memori, tidak pernah ditulis ke disk polos
2. Untuk session yang **baru pertama kali** dipakai, buka posisi awal sesuai varian agent. Ini transaksi pertama lewat session key dan menjadi bukti kualifikasi Altana track (PRD Section 9.2)
3. Sebelum apa pun, cek `isValidKey` — hemat gas dan menghindari percobaan sia-sia pada session yang sudah dicabut atau kedaluwarsa
4. Baca kondisi posisi dan pasar, lalu putuskan perlu bertindak atau tidak
5. Kalau perlu, susun calldata dan panggil `client.execute({ session, calls })`
6. Tangani `ExecuteResult` sesuai tabel di Section 4.4 — tidak ada exception yang dilempar, jadi sukses tidak boleh diasumsikan
7. Catat hasilnya ke database untuk riwayat transaksi di dashboard

### 7.3 Aturan yang harus dipegang

**Tick tidak boleh tumpang tindih.** Kalau satu tick masih berjalan saat timer berikutnya berbunyi, tick baru dilewati. Tanpa penjaga ini, dua tick bisa mengirim intent yang sama dua kali — terutama berbahaya saat `ExecuteResult` berstatus `PENDING`.

**Kegagalan satu user tidak boleh menjatuhkan tick.** Bungkus per session, catat error, lanjutkan ke session berikutnya.

**Dua session tidak boleh tertukar.** Session Altana milik agent sendiri dimuat oleh runtime lewat `ensureAltanaSessionLoaded()` dan dipakai `getWallet()` untuk urusan agent. Session user datang dari database dan hanya dipakai untuk `client.execute` atas wallet user. Keduanya tidak boleh saling menggantikan.

**Proses tidak memegang admin key apa pun** — tidak atas dana user, dan tidak atas wallet agent sendiri. Kalau session user dicabut, kemampuan atas wallet itu hilang seketika tanpa tindakan tambahan.

### 7.4 Peran LLM di dalam tick

Keputusan: **LLM tetap dipakai.** Ini agent otonom, dan penalarannya bagian dari nilai produk — bukan tempelan yang bisa diganti `if` sederhana.

Tapi batas yang ditegakkan scaffold pada jalur ERC-8183 diberlakukan sama ketatnya di sini, dengan satu tambahan yang khusus untuk kasus kita.

**LLM menalar, kode tetap yang mengeksekusi.** LLM boleh membaca kondisi posisi lewat tool read-only, menimbang, dan mengusulkan tindakan. Ia tidak pernah menyusun calldata, tidak pernah memanggil `client.execute`, dan tidak pernah menyentuh kunci apa pun. Penandatanganan tetap kode tetap, persis seperti aturan di `signing.ts`.

**Usulan LLM wajib divalidasi terhadap batas keras sebelum dieksekusi.** Ini bukan formalitas. PRD Section 11.2 mencatat bahwa izin Altana membatasi fungsi dan kontrak, **bukan argumennya** — jadi allowlist tidak akan menahan jumlah yang keliru. Karena itu setiap usulan LLM dijepit ke rentang yang ditetapkan varian agent, dan usulan di luar rentang ditolak lalu dicatat, bukan dieksekusi lalu disesalkan.

Urutannya: LLM mengusulkan → kode memvalidasi terhadap batas varian → kode menyusun calldata → kode menandatangani lewat session. Kalau validasi gagal, tick berakhir tanpa transaksi.

**Setiap keputusan dicatat, termasuk keputusan untuk tidak bertindak.** Alasan LLM disimpan bersama snapshot kondisi yang dibacanya, lalu ditampilkan di dashboard. Ini bukan sekadar log: penilaian Data Quality menuntut user bisa mengambil keputusan sewa yang terinformasi, dan riwayat *"kenapa agent bertindak atau diam"* jauh lebih meyakinkan daripada sekadar deretan hash transaksi.

## 8. Indexer (Ponder)

`apps/indexer` menunjuk ke BSC Testnet dan bertanggung jawab atas:

1. **Keystore reads berkala** untuk semua session aktif — `getKeys(walletAddress)` mengembalikan seluruh key pada satu wallet, jadi beberapa session agent terbaca sekaligus; tiap key lalu dicek `isValidKey` untuk memperbarui status dan sisa waktu
2. **Riwayat eksekusi** per session ke `AgentExecution`, termasuk **verifikasi penerima**: parse call dan transfer log tiap transaksi, bandingkan setiap penerima terhadap `altanaWalletAddress`, set `recipientsVerified`. Ini mitigasi untuk batasan argumen di PRD Section 11.2 dan ditampilkan sebagai status di dashboard
3. **Snapshot posisi** per session untuk `PositionSnapshot` — nilai posisi, fee terkumpul, gas terpakai, fee kinerja terakumulasi; ini yang memberi makan metrik APY bersih dan tampilan fee live
4. **Sinkron 8004scan** berkala untuk memperkaya katalog: nama, kapabilitas, reputasi, feedback, alamat
5. **Data pasar mainnet** (Section 9)
6. Mengekspos API untuk dikonsumsi `apps/web`

## 9. Pipeline Data Tiga Lapis

Sesuai PRD Section 16, dengan pemisahan sumber yang tegas:

| Lapis | Sumber | Dipakai untuk | Label di UI |
|---|---|---|---|
| Konteks pasar | **Mainnet** BSC: APR Venus, TVL/volume/fee pool PancakeSwap, volatilitas pair | Membantu user memilih; angka ini real-time dan akurat | Live |
| Rekam jejak agent | **Testnet**: hasil eksekusi agent sendiri | Membuktikan agent benar-benar bekerja | Live (testnet) |
| Proyeksi | Backtest atas data historis mainnet | Mengisi metrik yang belum punya sampel cukup | **Simulasi** |

Pelabelan bukan sekadar kosmetik. Menampilkan hasil backtest sebagai rekam jejak nyata adalah cara tercepat kehilangan kepercayaan juri yang paham DeFi.

## 10. Environment Variables

**Vercel (frontend):**
```
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_INDEXER_URL=
NEXT_PUBLIC_PASSKEY_RP_ID=
```

**VPS (indexer, DB) — Docker Compose `.env`:**
```
BNB_TESTNET_RPC_URL=
ALCHEMY_API_KEY=
DATABASE_URL=
SCAN_8004_API_KEY=
BNB_MAINNET_RPC_URL=            # untuk data pasar, read-only
```

**Tiap proyek agent — `.studio/.env.local`, izin 0600, tidak masuk repo:**
```
WALLET_PASSWORD=                # HANYA di mesin developer; TIDAK di VPS
OPENROUTER_API_KEY=             # wajib: Altana mematikan opsi Pieverse gratis
```

**Tiap proses agent di VPS — env runtime:**
```
ALTANA_SESSION_FILE=            # menunjuk ke altana-session.json yang disalin ke server
DATABASE_URL=
SESSION_KEY_ENCRYPTION_KEY=     # enkripsi at-rest untuk session key user
TICK_INTERVAL_MS=
AGENT_PORT=                     # port unik per agent, di belakang reverse proxy
OPENROUTER_API_KEY=
```

Dua hal yang **tidak** ada di daftar mana pun. Pertama, admin key atas dana user — tidak pernah dipegang sistem. Kedua, `WALLET_PASSWORD` di VPS — server hanya menerima session Altana yang sudah ter-grant, bukan keystore admin maupun kuncinya.

## 11. Secret Management

| Komponen | Lokasi | Solusi |
|---|---|---|
| Frontend | Vercel Environment Variables | Terenkripsi bawaan |
| Session key user | PostgreSQL di VPS | Terenkripsi at-rest dengan `SESSION_KEY_ENCRYPTION_KEY`; didekripsi hanya di memori proses agent |
| Keystore admin agent | `.studio/wallets/` di mesin developer | **Tidak pernah disalin ke VPS.** Dilindungi `WALLET_PASSWORD` yang juga tidak pernah meninggalkan mesin developer |
| Session Altana agent | `altana-session.json`, disalin ke VPS dengan izin 0600 | Ini satu-satunya material penandatangan yang ada di server. Berbatas anggaran harian, punya kedaluwarsa, dan bisa dicabut on-chain lewat `bag wallet session revoke` |
| Admin key user | Secure hardware device user | Tidak pernah menyentuh infrastruktur kita |
| Rotasi jika bocor | — | Session user: user revoke, lalu grant ulang. Session agent: `bag wallet session revoke` lalu `grant --force`, tanpa perlu mengganti identitas ERC-8004 karena alamat wallet tidak berubah |

Perhatikan bahwa kompromi terburuk di VPS pun tidak menghasilkan kunci admin. Yang bisa diambil penyerang adalah session user yang dibatasi allowlist dan spend cap, serta session agent yang dibatasi anggaran harian — semuanya bisa dicabut sepihak dan terlihat di Keystore.

## 12. Build Order

0. ~~**Scaffold Agent Studio pertama**~~ — **selesai.** `agents/healthfactor` sudah berdiri dengan wallet Altana, session ter-grant on-chain sampai 22 September 2026, `bag doctor` bersih, dan negosiasi A2A bertanda tangan sudah diuji
1. ~~**Verifikasi asumsi yang belum terbukti**~~ — **selesai 24 Agu 2026.** Venus Core Pool hidup. Pancake V3 hidup, likuiditas tipis. Token Venus ≠ token mock PancakeSwap (Section 1.1, PRD 20.1)
2. **Spike Altana sisi user** — `createPasskeyWallet` → fund → `execute` jalur admin → `grantSession` sempit → `execute` jalur session → coba panggilan di luar allowlist sampai revert → `revokeSession`. Ini bagian yang **belum** disentuh; yang sudah terbukti baru sisi wallet agent
3. **Tambahkan loop tick** ke `agents/healthfactor` (Section 7) dan **mulai jalankan agent pertama** secepat mungkin, bahkan tanpa UI. Rekam jejak tidak bisa dikejar belakangan
4. **Siapkan VPS** — pm2 atau systemd, reverse proxy dengan TLS, lalu `bag erc8004 register --endpoint <url>` agar identitas on-chain menunjuk ke alamat publik yang benar
5. Replikasi pola ke 3 kategori lain, lalu tambahkan varian konfigurasi
6. Indexer: Keystore reads, riwayat eksekusi + verifikasi penerima, snapshot posisi dan P&L per session
7. Frontend: listing → perbandingan → detail → setup wallet → hire → dashboard → exit
8. Integrasi 8004scan untuk memperkaya katalog
9. Data pasar mainnet dan backtest berlabel
10. Polish copy: jelaskan session, allowlist, spend cap, expiry dalam bahasa sederhana
11. Agent Advantage Report untuk TermiX, disusun dari data yang sudah terkumpul
12. Bonus, hanya jika semua di atas sudah stabil: pemungutan fee kinerja saat penarikan, lalu ERC-8183 dan x402

## 13. Open Items

- Bentuk signature kanonik untuk fungsi PancakeSwap V3 yang menerima struct harus dipastikan terhadap selector sebelum dipakai di allowlist
- Apakah `grantSession` benar-benar menerima `sessionSigner` yang dibangkitkan di browser tanpa perlu menandatangani apa pun saat grant — perlu dibuktikan di spike
- Perilaku passkey lintas browser (Chrome, Safari, Firefox) perlu diuji lebih awal, karena demo bergantung padanya
- Domain VPS + HTTPS harus aktif sebelum demo publik; Vercel akan memblokir mixed content
- Alchemy free tier (30M CU/bulan) diperkirakan cukup; cek dashboard sehari sebelum judging
- Interval tick yang tepat per kategori. Health factor kemungkinan butuh lebih rapat daripada yield routing, dan tiap tick memakan panggilan RPC untuk semua penyewa. Ditentukan lewat pengukuran setelah agent berjalan, bukan ditebak sekarang
- Dampak `evaluator_type: "uma_oov3"` yang disuntikkan otomatis ke terms negosiasi, bila rel ERC-8183 jadi diaktifkan
- Anggaran OpenRouter yang realistis. LLM diputuskan tetap dipakai (Section 7.4), jadi yang perlu diukur adalah biaya per tick dikali empat agent dikali jumlah penyewa

### 13.1 Yang sudah diputuskan dan tidak lagi terbuka

| Pertanyaan | Keputusan |
|---|---|
| Storage `local` atau IPFS | **Tidak relevan untuk v1.** Ini hanya menyangkut cara pembeli mengambil hasil kerja job ERC-8183, dan alur sewa lewat session Altana tidak menghasilkan deliverable. Baru perlu dijawab kalau rel 8183 diaktifkan sebagai bonus — dan yang dibutuhkan saat itu adalah URL yang bisa dijangkau publik, bukan kapasitas disk |
| LLM dipakai atau diganti aturan deterministik | **Tetap pakai LLM.** Ini agent otonom; penalarannya bagian dari produk, bukan hiasan |
| Satu proses atau empat | **Empat proses di satu VPS**, port berbeda, di belakang satu reverse proxy (Section 6.6) |
| Masa berlaku session Altana agent | **30 hari**, diperpanjang dengan `bag wallet session grant --force` bila penjurian mundur |
| Venus testnet lengkap? | **Ya.** Comptroller + vUSDT/vUSDC/vBNB hidup dan terhubung (Section 1.1) |
| Pancake V3 + likuiditas rebalancing? | **Kontrak ada, pool tipis.** Pakai WBNB/USDT(Venus) fee 100; seed sendiri jika perlu |
| Token Venus = token Pancake? | **Tidak.** Yield v1 hanya di dalam Venus. Jangan campur USDT mock Pancake dengan USDT Venus |
