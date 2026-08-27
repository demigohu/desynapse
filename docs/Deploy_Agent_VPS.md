# Tutorial: deploy agent ke VPS

Jalur resmi `bag deploy` **tidak dipakai**. Runtime AgentCore tidur saat menganggur (loop tick mati) dan endpointnya terkunci OAuth. Agent dijalankan sebagai proses Node biasa di VPS, di belakang reverse proxy.

Identitas on-chain tetap Agent Studio: `bag erc8004 register --endpoint <url>`.

Contoh di bawah memakai **healthfactor**. Tiga agent lain (`rebalancing`, `gridtrading`, `yieldrouter`) mengikuti pola yang sama dengan port berbeda.

---

## 0. Yang tidak ikut ke server

Build **di VPS**. Laptop hanya menyimpan kunci admin dan mengirim session.


| Ada di laptop                               | Ke VPS?                                                       |
| ------------------------------------------- | ------------------------------------------------------------- |
| git clone source                            | **Ya**                                                        |
| `.studio/wallets/altana-session.json`       | **Ya**, di-`scp` terpisah (izin `0600`) — file ini gitignored |
| `OPENROUTER_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | **Ya**, sebagai env proses                              |
| `.studio/wallets/0x….json` (keystore admin) | **Tidak**                                                     |
| `WALLET_PASSWORD`                           | **Tidak**                                                     |


Kalau VPS dibobol, yang hilang cuma session berbatas. Cabut dengan `bag wallet session revoke` dari laptop.

---



## 1. Prasyarat laptop

- Node ≥ 22, pnpm, `bag` (`@bnbagent/studio-cli`)
- Repo sudah di-clone
- Untuk healthfactor: wallet + session sudah ada (alamat `0x886B9cFa0c36dc0fd05F45B03f89fEF56Ed17866`, session sampai ~22 Sep 2026)

Cek:

```bash
cd agents/healthfactor
(cd app/agent && bag doctor)
(cd app/agent && bag wallet balance)
```

`bag doctor` harus lulus wallet + session. `OPENROUTER_API_KEY` boleh masih kosong untuk tes lokal; **wajib di VPS** kalau LLM mau dipakai.

Satu kali tick tanpa server:

```bash
cd agents/healthfactor/app/agent
pnpm install
pnpm run tick:once
```

---



## 2. Prasyarat VPS

- Ubuntu 22.04+ (atau setara), 1 vCPU / 1 GB cukup untuk satu agent; 2 GB lebih aman untuk empat proses
- Domain + DNS A record ke IP VPS (contoh: `healthfactor.example.com`)
- Port 80/443 terbuka
- User non-root dengan sudo

Di server:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm i -g pnpm@10 pm2
node -v   # v22.x
```

`bag` **tidak wajib** di VPS. Register ERC-8004 dan `bag wallet session grant` dijalankan dari laptop (butuh keystore admin + password).

Git di server (deploy key read-only, atau HTTPS):

```bash
sudo mkdir -p /opt/desynapse
sudo chown "$USER:$USER" /opt/desynapse
git clone git@github.com:YOU/desynapse.git /opt/desynapse/repo
```

---



## 3. Build di VPS

```bash
cd /opt/desynapse/repo/agents/healthfactor
pnpm install
pnpm --filter healthfactor-agent build
```

`dist/` dihasilkan di server. Jangan salin `node_modules` dari laptop (OS/arch bisa beda).

```bash
# VPS — folder .studio tidak ada di git
mkdir -p /opt/desynapse/repo/agents/healthfactor/.studio/wallets
chmod 700 /opt/desynapse/repo/agents/healthfactor/.studio
```

```bash
# laptop
scp agents/healthfactor/.studio/wallets/altana-session.json \
  user@VPS_IP:/opt/desynapse/repo/agents/healthfactor/.studio/wallets/
```

```bash
# VPS
chmod 600 /opt/desynapse/repo/agents/healthfactor/.studio/wallets/altana-session.json
```

File env di folder agent, nama `.env` (gitignored). Salin dari example:

```bash
cp /opt/desynapse/repo/agents/healthfactor/.env.example \
  /opt/desynapse/repo/agents/healthfactor/.env
nano /opt/desynapse/repo/agents/healthfactor/.env   # isi key + LLM_MODEL
chmod 600 /opt/desynapse/repo/agents/healthfactor/.env
```

`OPENROUTER_API_KEY` di sini adalah **kunci 9router**. Nama env-nya tetap `OPENROUTER_*` karena `[llm].provider = "openrouter"` di `studio.toml`.

| Env | Isi |
|---|---|
| `OPENROUTER_API_KEY` | API key 9router |
| `LLM_BASE_URL` | Host OpenAI-compatible, tanpa `/` di ujung |
| `LLM_MODEL` | Model id persis seperti 9router mengirimnya di `POST /v1/chat/completions` |

Tanpa `LLM_MODEL`, runtime pakai default di `studio.toml`: `openai/gpt-4o-mini`.

`AGENT_BIND_HOST=127.0.0.1` wajib. Default scaffold adalah `0.0.0.0` — tanpa ini agent bisa diakses langsung, melewati TLS.

---



## 4. Jebakan port (empat agent, satu VPS)

Entrypoint **selalu** mencoba juga mengikat `9000` dan `8088`. Agent pertama yang nyala merebut keduanya; yang lain mencetak:

```
secondary contract port 9000 unavailable
```

Itu **wajar**. Yang harus unik adalah `AGENT_PORT`:


| Agent        | `AGENT_PORT` | URL publik (ERC-8004)               |
| ------------ | ------------ | ----------------------------------- |
| healthfactor | 9001         | `https://healthfactor.example.com/` |
| rebalancing  | 9002         | `https://rebalancing.example.com/`  |
| gridtrading  | 9003         | `https://gridtrading.example.com/`  |
| yieldrouter  | 9004         | `https://yieldrouter.example.com/`  |


---



## 5. Proses: pm2

Dari **root repo**. `ecosystem.config.cjs` membaca `agents/<nama>/.env` dan mengabaikan agent yang belum punya file itu.

```bash
cd /opt/desynapse/repo
pm2 delete healthfactor   # kalau sempat start cara lama
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup               # ikuti perintah systemd yang dicetak
pm2 logs healthfactor
```

Setelah ubah `.env`:

```bash
cd /opt/desynapse/repo
pm2 reload ecosystem.config.cjs --update-env
```

Cwd proses adalah `app/agent` (diset di ecosystem) supaya `studio.toml` dan `../../.studio/wallets/altana-session.json` ketemu.

Scaffold `bag` hanya memanggil `main()` jika `argv[1]` adalah file entrypoint. pm2 fork mengganti `argv[1]` jadi wrapper-nya, jadi proses `online` tanpa listen. Itu sudah diperbaiki di `unifiedMain.ts` (`pm_id`). **Wajib rebuild** setelah pull:

```bash
cd /opt/desynapse/repo/agents/healthfactor
pnpm --filter healthfactor-agent build
cd /opt/desynapse/repo
pm2 restart healthfactor
pm2 logs healthfactor --lines 30
```

Log yang benar: `[seller-agent] boot ...` lalu `serving on 127.0.0.1:9001`.

Health check (tanpa `-s` dulu — `-s` menyembunyikan *connection refused*):

```bash
ss -tlnp | grep -E '9000|9001|8088'
pm2 env 0 | grep -E 'AGENT_PORT|AGENT_BIND|LLM_'
curl -v --max-time 3 http://127.0.0.1:9001/ping
curl -sS --max-time 3 http://127.0.0.1:9001/.well-known/agent-card.json
curl -sS --max-time 3 http://127.0.0.1:9001/v1/tick
```

`/ping` → `{"status":"HEALTHY"}` atau `HEALTHY_BUSY` saat tick berjalan.

---



## 7. Reverse proxy + TLS (nginx)

Ganti `healthfactor.example.com`.

```nginx
# /etc/nginx/sites-available/healthfactor
server {
    listen 80;
    server_name healthfactor.example.com;
    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/healthfactor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d healthfactor.example.com
```

Lalu:

```bash
curl -s https://healthfactor.example.com/ping
curl -s https://healthfactor.example.com/.well-known/agent-card.json
```

---



## 8. Daftarkan ERC-8004 (dari laptop)

Dijalankan di mesin yang masih punya keystore admin + `WALLET_PASSWORD`. Butuh tBNB untuk gas.

```bash
cd agents/healthfactor/app/agent
bag erc8004 register \
  --endpoint https://healthfactor.example.com/ \
  --name "Health Factor Guardian" \
  --description "Venus Core Pool health-factor agent on BSC testnet" \
  --protocol A2A \
  --network bsc-testnet

bag erc8004 show
```

`--endpoint` harus URL **publik** yang sama dengan reverse proxy, termasuk trailing slash sesuai yang dilayani agent card.

---



## 9. Smoke test publik

Inspect (read-only, tidak gerak dana):

```bash
curl -s -X POST https://healthfactor.example.com/ \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"kind":"message","role":"user","messageId":"inspect-1","parts":[{"kind":"data","data":{"skill":"inspect","address":"0x886B9cFa0c36dc0fd05F45B03f89fEF56Ed17866"}}]}}}'
```

Ganti body yang rusak quoting-nya: lebih aman simpan JSON ke file seperti `agents/healthfactor/smoke-negotiate.json`, lalu `--data @file`.

Tick menulis log ke `app/agent/data/decisions.jsonl` di server.

---



## 10. Tiga agent sisanya

Masing-masing proyek di `agents/<nama>/`:

1. `bag wallet new` (satu kali per proyek — **jangan diulang**)
2. Danai alamat yang tercetak (~0.05 tBNB + ≥1 U)
3. `bag wallet session grant --budget-u 10 --expiry-days 30 --yes`
4. Ulangi langkah 3–8 dengan `AGENT_PORT` dan subdomain di tabel atas

Mereka belum punya loop strategi. Deploy sekarang hanya berguna untuk kartu A2A + identitas 8004. Untuk rekam jejak, healthfactor dulu.

---



## 11. Operasi harian


| Kejadian               | Perintah                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restart (kode saja)    | `pm2 restart healthfactor` |
| Restart + env baru     | `cd /opt/desynapse/repo && pm2 reload ecosystem.config.cjs --update-env` |
| Log                    | `pm2 logs healthfactor`                                                                                                                                          |
| Session hampir expired | Di laptop: `bag wallet session grant --force --budget-u 10 --expiry-days 30 --yes`, lalu salin `altana-session.json` baru ke VPS (`chmod 600`) dan `pm2 restart` |
| Cabut session bocor    | Di laptop: `bag wallet session revoke --yes` — execute berikutnya revert on-chain                                                                                |
| `bag wallet new` lagi  | **Jangan.** Memutus jangkar `[wallet].address` vs session                                                                                                        |


Cek sisa masa berlaku session (laptop):

```bash
cd agents/healthfactor && bag doctor
```

---



## 12. Checklist sebelum demo juri

- [ ] `https://healthfactor.example.com/ping` → HEALTHY
- [ ] Agent card terbuka tanpa login
- [ ] `bag erc8004 show` menampilkan endpoint HTTPS yang sama
- [ ] `pm2 startup` sudah aktif (reboot VPS tidak mematikan agent)
- [ ] Session Altana masih > 7 hari
- [ ] tBNB di wallet agent cukup untuk gas (`bag wallet balance`)
- [ ] `OPENROUTER_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` terisi di env VPS
- [ ] Keystore admin **tidak** ada di `/opt/desynapse`

---



## 13. Yang sengaja tidak ada di tutorial ini

- `bag deploy --provider bnb|aws|azure` — trial 48 jam / OAuth / scale-to-zero
- IPFS — alur sewa v1 tidak menghasilkan deliverable ERC-8183
- Session key **user** (passkey hire) — itu database marketplace, bukan file `.studio/`

