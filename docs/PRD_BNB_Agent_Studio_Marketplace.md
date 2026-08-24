# PRD: BNB Agent Studio Marketplace

**Status:** Draft v0.8
**Track:** Main Track + Partner Track (Altana) + PancakeSwap Challenge + TermiX Challenge — BNB Chain Smart Money Era Hackathon
**Versi:** 0.8 — direvisi setelah percobaan langsung BNB Agent Studio CLI 0.0.12. Agent Studio ternyata TypeScript satu proses (bukan Python dua lapis), Altana tersedia sebagai wallet backend bawaan sehingga kriteria "agents on their own Altana wallets" terpenuhi harfiah, dan hosting dipindah ke VPS karena runtime AgentCore tidur saat menganggur dan endpointnya terkunci OAuth

---

## 1. Ringkasan

Marketplace tempat pengguna menemukan, memahami, dan menyewa AI agent yang beroperasi di BNB Smart Chain. Yang membedakannya dari platform otomasi DeFi lain: **user tidak pernah menyerahkan kendali wallet-nya.** Agent bekerja lewat session key dengan izin terbatas yang diberikan user, tercatat di registry on-chain publik, dan bisa dicabut kapan saja dalam satu transaksi.

Mencakup empat kategori secara setara: Rebalancing, Grid Trading, Yield Optimisation, dan Health Factor Monitoring.

## 2. Latar Belakang & Masalah

Belum ada tempat terpusat di BSC untuk menemukan, membandingkan, dan menyewa agent DeFi otomatis. Yang lebih mendasar, mengaktifkan agent selama ini berarti memilih antara dua hal buruk: menyerahkan private key ke bot, atau menyetor dana ke platform custodial. Keduanya menuntut kepercayaan penuh yang tidak bisa diverifikasi.

Altana menyediakan jalan ketiga, dan produk ini dibangun di atasnya.

## 3. Tujuan Produk

| Tujuan | Ukuran keberhasilan |
|---|---|
| User menyelesaikan alur discover → hire tanpa dead end | Task completion tanpa bantuan eksternal |
| Data cukup untuk keputusan hire yang informed | Setiap agent punya metrik turunan, bukan sekadar hitungan mentah |
| Empat kategori terwakili setara dan bisa dibandingkan | Minimal 2 varian per kategori dengan profil risiko berbeda |
| Kendali penuh tetap di user, dan bisa dibuktikan | Admin key di tangan user, allowlist tanpa fungsi transfer, revoke satu transaksi |

## 4. Target Pengguna

- **Pengguna DeFi kasual** — punya aset di BSC, ingin otomasi tanpa memantau manual
- **Power user DeFi** — paham LP dan lending, ingin membandingkan agent secara kuantitatif
- **Judges/Partner (Altana, TermiX, PancakeSwap)** — mengevaluasi kelayakan produksi

## 5. Model Kepemilikan (Keputusan Fondasi)

Ini keputusan yang menentukan seluruh desain lain, jadi dinyatakan lebih dulu.

### 5.1 Tiga hal yang tidak boleh tertukar

| Komponen | Siapa pemegang | Fungsi |
|---|---|---|
| **Wallet Altana user** | User, lewat passkey (Face ID/Touch ID) | Satu-satunya wallet user. Tempat modal berada, tempat posisi DeFi berdiri, sekaligus identitasnya di aplikasi. |
| **Session key user** | Proses agent (di VPS) | Kunci berkewenangan terbatas atas wallet di atas. Bukan wallet. Satu per pasangan user–agent. |
| **Wallet Altana agent** | Tim, lewat keystore admin terenkripsi di mesin developer | Identitas ERC-8004 agent, terima pembayaran $U, bayar gas. Tidak pernah memegang dana user. |
| **Session key agent** | Proses agent (di VPS) | Kunci terbatas atas wallet agent sendiri. Yang berjalan di server hanya session ini, bukan keystore admin. |

**Tidak ada MetaMask di alur ini.** Wallet passkey punya alamat sendiri dan `recoverFromPasskey` menangani user yang kembali, jadi tidak ada yang perlu di-login. Menambahkan MetaMask hanya menciptakan wallet kedua yang membingungkan tanpa memberi fungsi apa pun. MetaMask paling banter muncul sebagai tombol opsional untuk mempermudah transfer dana masuk, bukan sebagai langkah dalam alur.

### 5.2 Kenapa user yang jadi admin

SDK Altana tidak menerima MetaMask sebagai signer, jadi admin harus berupa private key atau passkey. Kalau backend yang memegang admin key, backend bisa memindahkan seluruh isi wallet kapan saja — itu custodial, dan tombol revoke di UI tidak menjamin apapun secara on-chain.

Dengan passkey, admin key berada di secure hardware device user dan tidak pernah meninggalkannya. Kriteria Altana track *"grant and revoke stay with the owner"* terpenuhi secara harfiah dan bisa diverifikasi siapa pun lewat Keystore.

### 5.2a Agent juga punya wallet Altana sendiri

Percobaan langsung dengan `bag` CLI 0.0.12 menemukan bahwa Agent Studio mendukung Altana sebagai wallet backend bawaan lewat `bag init --wallet-kind altana`. Perilakunya persis pola yang produk ini anut: keystore admin terenkripsi tetap di mesin developer, dan yang dikirim ke server saat deploy hanya session berbatas.

Konsekuensinya penting untuk penilaian. Kriteria Altana track berbunyi *"Agents on their own Altana wallets. Sessions with real limits: call allowlist, spend cap, expiry."* Sebelumnya kriteria ini hanya bisa dipenuhi lewat tafsir bahwa agent beroperasi *di dalam* wallet Altana user. Sekarang terpenuhi **harfiah**: tiap agent punya wallet Altana miliknya sendiri, dengan session berbatas anggaran harian dan masa berlaku, terdaftar di Keystore.

Jadi Altana dipakai di dua lapisan sekaligus, untuk dua tujuan yang berbeda:

| Lapisan | Wallet | Admin | Session dipakai untuk |
|---|---|---|---|
| Kunci agent sendiri | Wallet Altana agent | Tim | Menandatangani penawaran, bayar gas, terima $U |
| Otoritas atas dana user | Wallet Altana user | User, lewat passkey | Menjalankan strategi dalam batas allowlist dan spend cap |

Keduanya tidak boleh tertukar. Session agent tidak pernah menyentuh dana user, dan session user tidak pernah dipakai untuk urusan operasional agent.

### 5.3 Satu wallet per user, beberapa session agent di atasnya

User punya **satu** wallet Altana. Setiap agent yang dia sewa mendapat session terpisah pada wallet yang sama, masing-masing dengan allowlist, spend cap, dan expiry sendiri, dan masing-masing bisa dicabut sendiri-sendiri.

Ini mengikuti pola yang sudah didokumentasikan Altana sebagai "portfolio with multiple agents". Frasa *"agents on their own Altana wallets"* tidak lagi perlu ditafsirkan longgar di sini, karena sudah dipenuhi harfiah di lapisan lain (Section 5.2a).

**Alasan memilih ini di atas satu wallet per pasangan user–agent:** dengan wallet terpisah per agent, hire kedua berarti mengulang seluruh setup — passkey baru, pendanaan baru, approve baru, posisi baru. Dengan wallet bersama, hire kedua cukup satu prompt biometrik. Dashboard-nya juga jauh lebih kuat: satu layar memperlihatkan beberapa agent berjalan berdampingan dengan scope masing-masing yang berbeda dan tombol revoke terpisah — itu memperlihatkan seluruh gagasan Altana sekaligus.

**Yang ditukar:** isolasi dana. Semua agent menarik dari kolam yang sama. Kerugian tetap terbatas per agent karena spend cap dan allowlist berlaku per session, tapi tidak ada sekat modal antar agent. Untuk user yang menginginkannya, membuat wallet kedua tetap mungkin dan tidak dilarang sistem — hanya bukan alur default.

## 6. Lingkup

### 6.1 In-scope

- Landing page dengan navigasi 4 kategori
- Listing, filter, dan **perbandingan** agent per kategori (agent sendiri + data 8004scan)
- Halaman detail agent dengan metrik turunan
- Pembuatan akun berbasis passkey dan pemulihannya saat user kembali
- Pendanaan wallet dengan deteksi otomatis dana masuk
- Alur hire lewat `grantSession` yang ditandatangani user
- Dashboard: status session, sisa spend cap, sisa waktu, riwayat transaksi, tombol revoke
- Penarikan dana lewat jalur admin
- Pelacakan P&L per agent dan tampilan fee kinerja terakumulasi
- Verifikasi penerima transaksi agent dan tampilan statusnya
- Backend/indexer: sinkron data on-chain, Keystore reads, agregasi 8004scan, data pasar mainnet
- **4 kategori × 2–3 varian agent** yang benar-benar bisa disewa
- Agent Advantage Report untuk TermiX

### 6.2 Out-of-scope (v1)

- No-code agent builder untuk user
- Jual-beli agent sebagai aset
- Multi-chain di luar BSC
- Native mobile app
- Vault contract untuk memaksa pemungutan fee (lihat Section 10.3)
- Mengelola posisi DeFi yang sudah ada di EOA user (lihat Section 9.1)

### 6.3 Bonus (jika waktu memungkinkan)

- Hire lewat ERC-8183 sebagai lapisan pembayaran tambahan
- Sell service lewat x402/b402
- Deploy ke mainnet

Catatan dari percobaan: rel ERC-8183 **sudah aktif di scaffold tanpa perlu kode tambahan**. Agent hasil `bag init` langsung bisa menerima negosiasi dan mengembalikan penawaran harga bertanda tangan, dan sudah diuji berhasil. Biaya mengambil bonus ini jauh lebih murah dari perkiraan v0.7, jadi prioritasnya naik di antara sesama bonus. Rel x402 juga lebih mudah di VPS ketimbang di AgentCore, karena tidak perlu membangun relay untuk menembus OAuth.

## 7. Strategi Agent: Varian, Bukan Sekadar Jumlah

Keputusan v0.3 "1 agent per kategori" direvisi. Alasannya: main track menuntut user bisa *"make a genuinely informed call on which agent to hire"* dan TermiX menilai *"find, compare, hire."* Dengan satu agent per kategori tidak ada yang bisa dibandingkan, dan seluruh UI perbandingan jadi dekorasi.

Solusinya bukan menambah kategori atau menambah basis kode, melainkan **varian konfigurasi dari basis kode yang sama**, dengan profil risiko yang benar-benar berbeda:

| Kategori | Varian |
|---|---|
| Rebalancing | Range lebar konservatif · Range sempit agresif |
| Grid Trading | 10 level rentang lebar · 30 level rentang sempit |
| Yield Optimisation | Pindah hanya jika selisih APR > 2% · Pindah agresif |
| Health Factor | Ambang konservatif (HF 1.8) · Ambang agresif (HF 1.3) |

Hasilnya 8–12 agent yang bisa disewa dengan metrik nyata yang berbeda satu sama lain, dari empat basis kode. Ini juga bukan rekayasa untuk penilaian — marketplace strategi sungguhan memang bekerja begitu.

Data dari 8004scan dipakai untuk memperkaya katalog dengan agent lain yang terdaftar di registry ERC-8004. **Agent yang tidak bisa disewa tidak boleh masuk alur utama**, karena juri menilai *"without hitting a dead end"* — agent yang ditampilkan tapi tombol hire-nya mati justru adalah dead end.

## 8. Kategori Agent & Kebutuhan Data

| Kategori | Fungsi agent | Metrik yang wajib ditampilkan |
|---|---|---|
| Rebalancing | Kelola range LP terkonsentrasi, reset posisi | % waktu dalam range, fee terkumpul vs impermanent loss, biaya gas per rebalance, APY bersih setelah biaya, TVL dikelola |
| Grid Trading | Eksekusi swap otomatis pada level harga | Pair, jumlah level, rentang harga, win rate + jendela waktunya, profit rata-rata per siklus, drawdown maksimum |
| Yield Optimisation | Rutekan likuiditas ke APR tertinggi | Protokol yang dipantau, APR sekarang vs sebelumnya, frekuensi switch, biaya switch vs selisih APR yang didapat, TVL dikelola |
| Health Factor | Cegah likuidasi posisi lending | Ambang trigger, HF terendah yang pernah terjadi, jeda trigger→transaksi masuk, estimasi kerugian likuidasi yang dihindari, protokol didukung |

Semua kategori juga menampilkan: struktur fee, lama beroperasi, alamat wallet agent, status session, dan daftar fungsi yang diizinkan.

Catatan penting soal metrik: petunjuk juri *"goes beyond basic counts"* diartikan sebagai metrik **turunan** — bukan "berapa kali rebalance" melainkan "berapa APY bersih setelah gas dan impermanent loss".

## 9. Alur Dana

### 9.1 Keputusan: posisi berdiri di dalam wallet Altana

Agent tidak bisa mengelola LP position NFT yang dimiliki wallet lain, karena dia bukan pemiliknya. Memaksakannya berarti kembali ke pola approve tak terbatas. Karena itu posisi dibuka **baru** di dalam wallet Altana, bukan memindahkan posisi lama dari tempat lain.

Konsekuensi yang diterima: user dengan posisi Venus atau LP yang sudah ada tidak bisa langsung melindunginya. Ini dinyatakan jelas di UI, bukan disembunyikan.

### 9.2 Urutan langkah — hire pertama

1. **Buat akun** — satu prompt biometrik, wallet passkey terbentuk. Belum ada transaksi chain
2. **Danai** — user mengirim BNB dan token ke alamat wallet, dari faucet atau dari mana pun dananya berada. Sistem mendeteksi otomatis
3. **Approve** — satu prompt biometrik menandatangani `approve` ke protokol target, **lewat jalur admin**. Ini sekaligus `execute` pertama yang mengaktifkan smart account di chain
4. **Beri izin** — user meninjau scope lalu menandatangani `grantSession`
5. **Agent membuka posisi** — dilakukan agent lewat session key, bukan oleh user
6. **Agent bekerja** — loop tick agent mengeksekusi lewat session key, dalam batas yang ada
7. **Tarik** — kapan saja, lewat jalur admin, tanpa perlu revoke lebih dulu

**Kenapa pembukaan posisi diserahkan ke agent.** User tidak seharusnya perlu memahami mekanika LP range atau parameter lending hanya untuk menyewa agent — itu justru pekerjaan yang dia bayar. Ada manfaat kedua yang sama pentingnya: tindakan pertama agent lewat session key terjadi langsung saat hire, menghasilkan transaksi on-chain nyata melalui session key yang bisa diverifikasi di Altana explorer. Itu persis bukti yang dituntut Altana track. Kalau user yang membuka posisi, transaksi pertama berjalan lewat jalur admin dan tidak membuktikan apa pun soal pembatasan izin.

**Kompensasinya:** karena izin diberikan sebelum posisi ada, layar review pada langkah 4 wajib menyatakan apa yang akan agent lakukan pertama kali — pool mana, range berapa, jumlah berapa. Informed consent tetap ada, hanya berpindah dari eksekusi manual ke preview.

### 9.2a Hire berikutnya

Karena wallet dipakai bersama, hire kedua dan seterusnya melewati langkah 1 dan 2 sepenuhnya. Yang tersisa:

- Kalau protokol targetnya sudah pernah di-approve, cukup **satu prompt** untuk `grantSession`
- Kalau agent baru menyasar protokol lain, ada satu prompt tambahan untuk approve protokol itu

Wallet yang sudah ada dipulihkan otomatis lewat `recoverFromPasskey`, tanpa perlu menyimpan apa pun di sisi aplikasi dan tanpa langkah login.

### 9.3 Dua efek samping yang menguntungkan

Wallet Altana bersifat counterfactual — kontraknya baru ada di chain setelah `execute` pertama, dan pemulihan lewat passkey baru bisa bekerja setelah itu. Langkah 3 atau 4 **adalah** execute pertama tersebut, jadi masalah pemulihan wallet selesai oleh langkah yang memang dibutuhkan produk.

Menempatkan semua `approve` di langkah 3 (jalur admin, sekali) berarti **tidak ada satu pun fungsi `approve` di dalam allowlist session**. Ini memperkecil scope agent secara signifikan tanpa mengurangi kemampuannya.

## 10. Model Fee

### 10.1 Keputusan: dilacak dan ditampilkan, pemungutan ditunda

Model fee-nya adalah **fee kinerja** — persentase dari keuntungan di atas nilai setoran, bukan biaya tetap. Di v1, fee ini **dihitung dan ditampilkan secara live** di dashboard, tapi pemungutan aktualnya ditunda ke akhir dan dikerjakan hanya kalau waktu cukup.

### 10.2 Kenapa pemungutan bukan prioritas

Main track dinilai atas Functionality, Data Quality, dan Agent Diversity. Fee tidak masuk satu pun, jadi memungutnya tidak menambah nilai.

Yang menambah nilai justru **infrastruktur di baliknya**. Menghitung fee kinerja menuntut pelacakan nilai setoran, nilai posisi berjalan, fee yang terkumpul, dan gas yang terpakai — dan itu persis angka yang dibutuhkan untuk metrik seperti "APY bersih setelah biaya" di Section 8. Pelacakannya wajib dibangun; pemungutannya tidak.

Alasan tambahan: ini testnet. Memungut fee dari token mainan tidak membuktikan apa pun.

### 10.3 Kalau nanti dipungut, caranya lewat jalur admin

Pemungutan dilakukan saat penarikan, dengan menyisipkan satu panggilan tambahan ke dalam batch yang **ditandatangani user lewat jalur admin** — bukan oleh agent lewat session.

Alasannya prinsipil. Permission `calls` di Altana membatasi kontrak dan fungsi, **bukan argumennya** (lihat Section 11.2). Menaruh fungsi transfer di allowlist agar agent bisa memotong fee berarti agent bisa mengirim ke alamat mana pun. Itu meruntuhkan properti keamanan terkuat produk ini, yang justru bisa diverifikasi juri langsung dari Keystore.

Karena pelacakan P&L sudah ada, penambahan panggilan ini murah — itulah kenapa ia layak ditunda daripada dipaksakan sekarang.

### 10.4 Komplikasi: atribusi P&L pada wallet bersama

Keputusan satu wallet untuk beberapa agent (Section 5.3) membuat perhitungan "keuntungan siapa" jadi tidak sepele. Posisi LP masih terlacak karena punya token ID sendiri, tapi agent grid trading beroperasi langsung di saldo token bersama.

Solusinya: atribusi per transaksi. Setiap eksekusi berjalan lewat session key yang unik per agent, jadi indexer sudah tahu agent mana melakukan apa. P&L per agent dihitung dari himpunan transaksinya sendiri.

### 10.5 Batasan yang diakui terbuka

Karena user adalah admin, secara teknis dia bisa menarik dana lewat transaksi mentah di luar aplikasi dan melewati fee. Menutup celah ini butuh vault contract yang memegang dana, dan itu mengembalikan unsur kustodi yang justru ingin dihindari. Trade-off ini dipilih secara sadar dan dinyatakan di dokumen, bukan diabaikan.

## 11. Izin Session: Granularitas dan Batasnya

### 11.1 Allowlist function-level

Allowlist didefinisikan di level fungsi spesifik pada kontrak spesifik. SDK mendukung ini lewat kombinasi `to` dan `signature` dengan semantik AND.

| Kategori | Fungsi di allowlist | Kontrak target |
|---|---|---|
| Rebalancing | `decreaseLiquidity`, `increaseLiquidity`, `collect`, `mint`, `burn` | PancakeSwap V3 NonfungiblePositionManager |
| Grid Trading | fungsi swap pada router | PancakeSwap Router |
| Yield Optimisation | `mint`, `redeem`, `redeemUnderlying` | vToken Venus terkait |
| Health Factor | `repayBorrow`, `mint` | vToken Venus terkait |

**Koreksi dari v0.3:** allowlist grid trading sebelumnya berisi `placeOrder` dan `cancelOrder`. PancakeSwap tidak memiliki limit order on-chain; grid trading di DEX berarti agent mengeksekusi swap saat harga menyentuh level. Allowlist yang benar adalah fungsi swap pada router.

Tidak ada fungsi `approve` maupun `transfer` di allowlist mana pun. Semua approve dilakukan sekali di setup lewat jalur admin.

### 11.2 Batasan yang diketahui: argumen tidak bisa dibatasi

Izin Altana bisa menyatakan "boleh panggil fungsi X di kontrak Y". Dia **tidak bisa** menyatakan "boleh panggil fungsi X di kontrak Y dengan argumen Z".

Contohnya di fungsi swap PancakeSwap, yang bentuknya kira-kira `swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)`. Parameter `to` menentukan ke mana hasil swap dikirim. Allowlist mengizinkan pemanggilan fungsi itu, tapi tidak bisa memaksa `to` selalu berisi alamat wallet user. Kalau proses agent dibajak, penyerang bisa memanggil fungsi yang **sah menurut allowlist** namun mengarahkan hasilnya ke alamatnya sendiri.

Hal serupa berlaku pada `amountOutMin`: agent bisa menerima slippage seburuk apa pun, yang efeknya menyerahkan nilai ke bot MEV.

Ini bukan khusus grid trading. Fungsi `collect` di PancakeSwap Position Manager juga punya parameter penerima, jadi agent rebalancing terkena hal yang sama.

**Apa yang sebenarnya membatasi.** Allowlist mencegah agent menyentuh protokol dan fungsi lain. Spend cap membatasi berapa banyak yang bisa bergerak per periode. Expiry membatasi berapa lama. Kombinasi ketiganya membuat kerugian maksimal diketahui di muka — jauh lebih baik daripada approve tak terbatas, tanpa perlu melebih-lebihkan.

Karena itu klaim produk yang dipakai bukan "agent tidak bisa mencuri", melainkan pernyataan yang akurat soal batas kerugian yang bisa dihitung sebelum user menandatangani.

### 11.2a Mitigasi: verifikasi penerima di dashboard

Karena indexer melihat setiap transaksi agent, sistem memeriksa penerima pada setiap eksekusi dan memverifikasi bahwa hasilnya memang masuk ke wallet user. Hasil pemeriksaan ini ditampilkan di dashboard sebagai status terverifikasi, dengan tautan ke transaksinya.

Ini menaikkan cerita produk dari "agent hanya **diizinkan** melakukan ini" menjadi "dan ini bukti bahwa dia memang **hanya** melakukan itu" — mengubah batasan di Section 11.2 dari kelemahan yang harus diakui menjadi transparansi yang bisa ditunjukkan.

### 11.3 Spend cap adalah batas per periode

`spend.limit` adalah batas bergulir per periode (`hour`/`day`), bukan batas total sekali pakai, dan dinyatakan dalam satuan terkecil token. Stablecoin di BNB Chain memakai 18 desimal, berbeda dari Ethereum. UI wajib menuliskan "maksimal X token per hari", bukan "maksimal X token".

## 12. Arsitektur Agent (Ringkas)

**Koreksi dari v0.7.** Versi sebelumnya menyatakan Agent Studio menghasilkan agent Python dua lapis dengan Layer A di AWS dan Layer B di VPS. Itu benar untuk versi 0.0.1 yang dijelaskan dokumentasi online, tapi **tidak berlaku untuk CLI 0.0.12** yang dipakai proyek ini. Percobaan langsung membuktikan yang dihasilkan adalah **satu proyek TypeScript satu proses**, dengan `@altananetwork/sdk` sudah menjadi dependency bawaan.

Akibatnya masalah dua bahasa hilang sepenuhnya. Strategi, eksekusi Altana, dan permukaan agent hidup dalam satu basis kode dan satu proses.

### 12.1 Satu proses, dua tugas

Tiap agent adalah satu proses Node yang mengerjakan dua hal berbarengan:

- **Melayani HTTP** pada sebuah port, memakai protokol A2A. Ini yang membuat agent bisa dipanggil dari dashboard, dari juri, dan dari pihak luar. Identitas ERC-8004 agent menunjuk ke alamat ini.
- **Menjalankan loop berkala** di dalam dirinya sendiri. Tiap beberapa menit ia membaca kondisi posisi para penyewa, memutuskan perlu bertindak atau tidak, dan mengeksekusi lewat session key user bila perlu.

Tidak ada smart contract yang perlu ditulis; agent memanggil kontrak PancakeSwap dan Venus yang sudah ada.

### 12.2 Hosting: VPS, bukan AgentCore

Runtime AgentCore yang dituju `bag deploy` bersifat **scale-to-zero** — ia dimatikan saat tidak ada yang memanggil, dengan batas hidup maksimal delapan jam bahkan saat sibuk. Loop lima menitan tidak akan bertahan di sana. Dokumentasi Agent Studio sendiri menyarankan poller eksternal sebagai jalan keluar.

Ada alasan kedua yang sama kuatnya. Panduan resminya menyatakan endpoint AgentCore **tidak pernah anonim** — deploy otomatis memasang OAuth2 Cognito, sehingga setiap pemanggil butuh client id, secret, dan token. Untuk marketplace yang intinya agent bisa ditemukan dan dicoba siapa saja, itu penghalang nyata. Panduan yang sama menyarankan menjalankan front HTTP sendiri bila butuh akses publik.

Karena itu agent dijalankan sebagai proses biasa di VPS di bawah pm2 atau systemd. Yang dilepas hanya kemudahan `bag deploy`; seluruh kemampuan on-chain tetap utuh, dan identitas ERC-8004 didaftarkan lewat `bag erc8004 register --endpoint <url>` yang memang tersedia sebagai jalur manual.

Aturan hackathon mendukung ini secara eksplisit: *"Agent Studio runs on AWS underneath; that's just how it works, not a separate track to build for."* Syarat kelayakannya hanya submission berfungsi dan bisa diakses publik selama penjurian, serta agent hidup di BSC — semuanya terpenuhi.

### 12.3 Penyimpanan session key user

Karena agent memegang session key milik banyak user, penyimpanannya jadi keputusan desain tersendiri. Kunci-kunci itu **tidak boleh** ditaruh di `.studio/wallets/`, yang oleh Agent Studio sengaja ditempatkan di luar jalur paket deploy dan dinyatakan sebagai invarian keras.

Session key user disimpan terenkripsi di database pada infrastruktur yang tim kendalikan, dan hanya didekripsi di memori saat akan dipakai. Ini juga alasan tambahan menghindari runtime terkelola: pada trial platform BNB, proses berjalan di akun AWS milik operator pihak ketiga, dan mengirim otoritas atas dana user ke sana bertentangan dengan seluruh premis produk.

## 13. User Flow

### 13.1 Per layar

**Landing.** Empat kartu kategori, masing-masing menampilkan konteks pasar live dari mainnet — APR Venus saat ini, TVL dan fee pool PancakeSwap, jumlah agent terdaftar di BSC. Belum ada wallet yang perlu disambungkan; user bisa menjelajah sepenuhnya tanpa connect.

**Halaman kategori.** Varian ditampilkan berdampingan dalam bentuk yang bisa dibandingkan langsung, dengan kolom yang benar-benar membedakan profil risikonya (misalnya % waktu dalam range, APY bersih setelah biaya, drawdown maksimum). Agent dari 8004scan berada di bagian terpisah yang jelas terlabeli belum bisa disewa.

**Detail agent.** Metrik lengkap, rekam jejak testnet, dan backtest berlabel simulasi. Satu blok wajib: **preview izin dalam bahasa manusia** — fungsi apa saja yang boleh dipanggil agent, batas harian, dan masa berlaku — ditampilkan sebelum user memutuskan, bukan setelah.

**Buat akun.** Satu prompt biometrik dan user punya akun. Tidak ada extension yang perlu dipasang, tidak ada seed phrase, tidak ada connect wallet. Copy menghindari kata "wallet" maupun "smart account" — framing yang dipakai adalah membuat akun, hal yang user kenal dari aplikasi mana pun.

**Danai.** Alamat ditampilkan dengan salin-satu-klik dan QR, disertai tautan faucet karena ini testnet. Sistem mendeteksi dana masuk secara otomatis dan melanjutkan sendiri. Tombol opsional untuk mengirim lewat MetaMask boleh ada di sini sebagai kenyamanan, bukan sebagai langkah wajib.

**Approve.** Satu prompt biometrik. Ini sekaligus `execute` pertama yang mengaktifkan smart account di chain dan mendaftarkan admin key di Keystore, sehingga pemulihan lewat passkey mulai bisa bekerja.

**Beri izin.** Scope ditampilkan ulang secara eksplisit, **beserta tindakan pertama yang akan agent lakukan**. User menandatangani, session terdaftar di Keystore, dan agent langsung membuka posisi lewat session key.

**Dashboard.** Satu wallet dengan seluruh agent aktif berdampingan. Per agent: sisa spend cap hari ini, sisa waktu sebelum expiry, daftar fungsi yang diizinkan, riwayat transaksi dengan tautan ke Altana explorer dan BscScan, dan tombol revoke sendiri. Status dibaca dari Keystore, bukan dari database internal.

**Revoke.** Satu prompt biometrik, satu transaksi, langsung berlaku. Percobaan berikutnya dari agent revert di chain.

**Exit.** Penarikan tersedia kapan saja tanpa perlu revoke lebih dulu. UI menampilkan rincian P&L dan fee kinerja yang terakumulasi sebelum tanda tangan. Panggilan pemungutan fee disisipkan ke batch yang sama hanya bila fitur itu sudah aktif (Section 10.1).

### 13.2 Anggaran friksi

Hire pertama: **tiga prompt biometrik** (buat akun, approve, beri izin) plus satu langkah pendanaan. Hire berikutnya: **satu prompt biometrik**.

Bandingkan dengan marketplace DeFi konvensional, yang menuntut user sudah memasang extension, sudah menyimpan seed phrase, lalu menghadapi popup approve tak terbatas yang tidak menyebutkan batas apa pun. Alur ini lebih ringan, bukan lebih berat — dan itu justru karena Altana, bukan meskipun Altana.

Titik paling rawan bukan jumlah tanda tangan, melainkan **langkah pendanaan**, karena itu satu-satunya momen user harus keluar dari aplikasi, menunggu, lalu kembali. Deteksi otomatis dana masuk dan tautan faucet bukan sekadar kenyamanan di sini, melainkan mitigasi titik keluar utama.

## 14. Functional Requirements

| ID | Requirement | Prioritas |
|---|---|---|
| FR-1 | Listing agent terkelompok per 4 kategori, minimal 2 varian per kategori | Wajib |
| FR-2 | Detail agent menampilkan metrik turunan sesuai Section 8 | Wajib |
| FR-3 | User dapat menjelajah seluruh katalog tanpa membuat akun | Wajib |
| FR-4 | User dapat membuat akun berbasis passkey tanpa extension maupun seed phrase, dan dipulihkan otomatis saat kembali | Wajib |
| FR-5 | User dapat mendanai wallet, dengan deteksi otomatis dana masuk | Wajib |
| FR-5c | Posisi awal dibuka oleh agent lewat session key, bukan oleh user | Wajib |
| FR-5a | Satu wallet dapat menampung beberapa session agent sekaligus, masing-masing dengan scope dan tombol revoke terpisah | Wajib |
| FR-5b | Hire berikutnya melewati pembuatan wallet dan pendanaan bila sudah tersedia | Wajib |
| FR-6 | User meninjau scope lengkap **beserta tindakan pertama agent** sebelum menandatangani session | Wajib |
| FR-7 | Session ditandatangani user dan terdaftar di Keystore | Wajib |
| FR-8 | Agent bertransaksi lewat session key, bukan jalur admin | Wajib |
| FR-9 | Dashboard menampilkan status, sisa cap, sisa waktu, allowlist, riwayat | Wajib |
| FR-10 | User dapat revoke kapan saja, efek langsung dalam 1 transaksi | Wajib |
| FR-11 | User dapat menarik dana kapan saja tanpa perlu revoke lebih dulu | Wajib |
| FR-12 | Sistem melacak P&L per agent (setoran, nilai berjalan, fee terkumpul, gas) dan menampilkan fee kinerja yang terakumulasi secara live | Wajib |
| FR-12a | Sistem memverifikasi penerima setiap transaksi agent dan menampilkan statusnya di dashboard | Wajib |
| FR-12b | Fee kinerja dipungut saat penarikan lewat jalur admin | Bonus |
| FR-13 | Data agent diperbarui near real-time | Wajib |
| FR-14 | Sistem menampilkan agent tambahan dari 8004scan, terpisah jelas dari yang bisa disewa | Wajib |
| FR-15 | Transaksi agent dapat diverifikasi lewat Altana explorer | Wajib |
| FR-16 | Halaman Agent Advantage Report untuk TermiX | Wajib |
| FR-17 | Hire via ERC-8183 sebagai lapisan pembayaran | Bonus |
| FR-18 | Sell service via x402/b402 | Bonus |

## 15. Non-Functional Requirements

- **Usability:** pengguna tanpa pengetahuan Agent Studio atau Altana menyelesaikan flow tanpa dead end; istilah teknis dijelaskan dalam bahasa sederhana
- **Availability:** publicly accessible selama masa judging
- **Performance:** loading listing < 3 detik
- **Kejujuran data:** angka simulasi diberi label simulasi; tidak ada metrik karangan (lihat Section 16)
- **Security:** scope session ditampilkan lengkap sebelum tanda tangan; batasan yang diketahui dinyatakan, tidak disembunyikan
- **Transparansi:** setiap transaksi agent dapat ditelusuri dari dashboard maupun Altana explorer

## 16. Strategi Data

Agent baru di testnet tidak punya rekam jejak, sementara Data Quality adalah sepertiga penilaian main track. Tiga lapis data dipakai, semuanya jujur:

1. **Konteks pasar live dari mainnet** — APR Venus, TVL dan volume pool PancakeSwap, volatilitas pair. Real-time dan akurat, dan inilah yang paling menentukan keputusan hire.
2. **Rekam jejak nyata agent di testnet** — apa adanya, termasuk kalau baru beberapa hari.
3. **Backtest atas data historis mainnet** — diberi label simulasi secara eksplisit.

Aturan yang tidak dilanggar: tidak ada angka karangan. Satu metrik yang ketahuan dibuat-buat membatalkan kredibilitas seluruh angka lain.

**Implikasi jadwal:** agent harus mulai berjalan sedini mungkin, bahkan sebelum frontend siap. Rekam jejak adalah satu-satunya data yang tidak bisa dikejar di akhir.

## 17. Metrik Keberhasilan (Judging Alignment)

| Kriteria | Fokus produk |
|---|---|
| Functionality (Main) | Flow end-to-end tanpa dead end, termasuk setup wallet, hire, revoke, dan exit |
| Data Quality (Main) | Metrik turunan, data pasar live, pelabelan jujur untuk simulasi |
| Agent Diversity (Main) | 4 kategori × 2–3 varian, kedalaman merata, bisa dibandingkan |
| Altana | Admin di user, session dengan batas nyata, terdaftar di Keystore, eksekusi lewat session key, revoke di UI |
| TermiX | Agent Advantage Report, kualitas perbandingan, rekam jejak agent trading |
| PancakeSwap | Rebalancing dan grid trading memberi manfaat langsung ke LP dan trader PancakeSwap |

## 18. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Data 8004scan tidak punya kategori yang cocok, atau mayoritas agent terdaftar kosong | Verifikasi field API di hari-hari pertama; agent sendiri jadi tulang punggung katalog |
| Agent belum punya rekam jejak saat judging | Jalankan agent sedini mungkin; lengkapi dengan data pasar live dan backtest berlabel |
| Proses agent di VPS mati dan posisi user tidak terpantau | pm2/systemd dengan restart otomatis, health check eksternal, alert. Ini konsekuensi memilih VPS dan harus ditangani serius karena tidak ada runtime terkelola yang menanggungnya |
| Juri menilai tidak memakai jalur deploy resmi sebagai kekurangan | Dugaan, bukan aturan. Mitigasi murah: deploy satu agent lewat `bag deploy --provider bnb` menjelang penjurian sebagai demonstrasi, empat agent produksi tetap di VPS |
| Session key user bocor dari database | Terenkripsi at-rest, didekripsi hanya di memori, tidak pernah masuk paket deploy. Kerugian tetap terbatas allowlist dan spend cap, dan user bisa revoke sepihak |
| Session Altana agent kedaluwarsa di tengah masa penjurian | Grant dengan masa berlaku yang melewati penjurian; pantau lewat `bag doctor`; re-grant pakai `--force` bila perlu |
| User bingung dengan konsep session | Copy sederhana, preview scope sebelum tanda tangan, glossary singkat |
| Demo bergantung pada device ber-WebAuthn, tanpa jalur cadangan | Diterima. WebAuthn punya mode lintas device, jadi user desktop tanpa sensor biometrik tetap bisa memakai HP lewat QR. Verifikasi di Chrome, Safari, dan Firefox lebih awal |
| Fee kinerja bisa dilewati user | Diterima dan dinyatakan terbuka (Section 10.5) |
| Atribusi P&L antar agent pada wallet bersama tidak sepele | Atribusi per transaksi lewat session key yang unik per agent (Section 10.4) |
| Agent memanggil fungsi yang diizinkan tapi dengan argumen berbahaya | Spend cap ketat, expiry pendek, dan verifikasi penerima yang ditampilkan di dashboard (Section 11.2a) |
| Tidak ada sekat modal antar agent pada wallet bersama | Spend cap dan allowlist berlaku per session sehingga kerugian tetap terbatas per agent; user yang ingin isolasi penuh dapat membuat wallet kedua |
| User menghilang di langkah pendanaan | Deteksi otomatis dana masuk, salin-satu-klik, QR, tautan faucet (Section 13.2) |

## 19. Keputusan Terkunci (v0.8)

- **Network:** BSC Testnet (chain 97) untuk v1; mainnet menyusul
- **Agent Studio:** CLI `bag` 0.0.12, TypeScript satu proses. Dokumentasi online yang menjelaskan Python dua lapis sudah usang dan tidak dipakai sebagai acuan
- **Hosting agent:** VPS dengan pm2/systemd, bukan AgentCore. Alasannya scale-to-zero dan endpoint terkunci OAuth (Section 12.2)
- **Topologi:** keempat agent di satu VPS sebagai empat proses terpisah, port berbeda, di belakang satu reverse proxy. Tiap agent punya wallet, session, dan identitas ERC-8004 sendiri
- **LLM:** tetap dipakai di loop keputusan, karena ini agent otonom. Usulan LLM wajib divalidasi terhadap batas keras varian sebelum dieksekusi, dan setiap keputusan dicatat termasuk keputusan untuk diam
- **Wallet agent:** `--wallet-kind altana`. Keystore admin tetap di mesin developer, hanya session berbatas yang berjalan di server
- **Session key user:** disimpan terenkripsi di database milik tim, tidak pernah di `.studio/wallets/` dan tidak pernah dikirim ke runtime pihak ketiga
- **Admin key:** user, lewat passkey wallet. Backend tidak pernah memegang admin key atas dana user
- **MetaMask:** dihapus dari alur. Passkey adalah satu-satunya wallet user, sekaligus identitasnya. Tidak ada langkah connect dan tidak ada login
- **Posisi awal:** dibuka agent lewat session key, bukan oleh user. Layar review wajib menampilkan tindakan pertama agent
- **Jalur cadangan passkey:** tidak disediakan; mode lintas device WebAuthn dianggap cukup
- **Wallet:** satu wallet Altana per user, beberapa session agent di atasnya; wallet kedua tetap mungkin tapi bukan default
- **Posisi DeFi:** berdiri di dalam wallet Altana, bukan di EOA user
- **Approve:** dilakukan sekali di setup lewat jalur admin; tidak pernah masuk allowlist session
- **Fee:** fee kinerja, dilacak dan ditampilkan live di v1; pemungutan ditunda jadi bonus. Kalau dipungut, lewat jalur admin saat penarikan, tidak pernah lewat session
- **Allowlist:** function-level, tanpa fungsi `approve` maupun `transfer`
- **Model hire:** session Altana saja. ERC-8183 turun jadi bonus
- **Agent:** 4 kategori × 2–3 varian, dari 4 basis kode
- **Smart contract custom:** tidak ada. Agent memanggil PancakeSwap dan Venus yang sudah ada
- **Yield v1:** hanya di dalam Venus (ganti vToken menurut APR). Tidak merutekan ke PancakeSwap di testnet, karena token mock-nya berbeda kontrak (Section 20.1)
- **Rebalancing v1:** pool WBNB/USDT(Venus) fee 100. Seed likuiditas sendiri jika kedalaman 0.29 WBNB terlalu kecil untuk demo
- **TermiX:** masuk scope v1, dikerjakan sebagai dokumentasi dari data agent yang berjalan

## 20. Open Questions

- Field apa saja yang benar-benar tersedia dari 8004scan API, dan berapa banyak agent terdaftar yang punya metadata layak tampil?

### 20.1 Yang sudah dijawab dari chain (24 Agustus 2026)

| Pertanyaan | Jawaban |
|---|---|
| Venus testnet lengkap untuk lending / health factor? | **Ya.** Core Pool hidup: Comptroller `0x94d1820b2D1c7c7452A163983Dc888CEC546b77D`, plus `vUSDT`, `vUSDC`, `vBNB` yang `comptroller()`-nya cocok. Health Factor dan Yield di Venus bisa ditulis. |
| PancakeSwap V3 di testnet, likuiditas cukup untuk rebalancing? | **Kontrak ada, kedalaman tipis.** NFPM, SwapRouter, dan Factory satu deployment. Pool yang bisa dipakai: WBNB/USDT(Venus) fee 100 berisi **0.29 WBNB + 3.001 USDT**. Cukup untuk posisi demo kecil; untuk demo yang kelihatan, seed likuiditas sendiri ke pool itu. |
| Token Venus = token PancakeSwap? | **Tidak.** USDT Venus `0xA11c8D9D…782c` ≠ USDT mock Pancake `0x337610d2…4dDd` (USDC juga beda). Agent yield **tidak bisa** memindahkan nilai Venus ↔ PancakeSwap di testnet. Yield v1 hanya merutekan di dalam Venus. Rebalancing/grid memakai pool Pancake V3, dengan pasangan Venus-USDT sebagai jembatan tampilan ke lending — bukan sebagai jalur dana yang sama. |
- Memilih wallet Altana mematikan opsi LLM gratis Pieverse, karena Altana tidak mendukung SIWE signing yang dibutuhkan aktivasinya. Provider jatuh ke OpenRouter yang berbayar. LLM tetap dipakai (Section 19), jadi yang tersisa adalah mengukur anggaran nyata untuk empat agent yang tick berkala.
- Scaffold menyisipkan `evaluator_type: "uma_oov3"` (UMA Optimistic Oracle V3) ke dalam terms negosiasi tanpa diminta. Kalau rel ERC-8183 diaktifkan, perlu dipahami dampaknya ke jendela sengketa dan waktu pencairan.
