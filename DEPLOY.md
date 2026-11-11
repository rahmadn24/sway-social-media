# Deploy Sway — sway.ryahmadn.my.id + auto-deploy dari GitHub

Sway jalan di `https://sway.ryahmadn.my.id`. Setiap push ke branch
`production` otomatis deploy ke VPS lewat GitHub Actions. Push ke `main`
tidak men-deploy apa-apa, jadi `main` tetap tempat kerja sehari-hari.

Semua data terstruktur Sway (user, API key AI yang dienkripsi, akun, post,
percakapan, notifikasi, analitik) hidup di **Postgres** — database `sway`
di dalam Postgres yang sudah jalan untuk n8n. Tidak ada lagi JSON store,
tidak ada kredensial hardcode.

## Yang sudah disiapkan di repo ini

| File | Fungsi |
| --- | --- |
| `Dockerfile` | Image production Next.js (standalone output, Node 24). Build menjalankan `npx prisma generate`; runner membawa Prisma CLI + `tsx` supaya entrypoint bisa migrasi + seed. |
| `docker-entrypoint.sh` | Dijalankan sebelum server: `prisma migrate deploy` (retry sampai 6x kalau DB belum siap) lalu `prisma db seed` (idempotent), baru `node server.js`. |
| `docker-compose.yml` | Satu service `sway`, port host `3100` → container `3000`. `.env` wajib (DATABASE_URL + 2 secret + admin seed). Upload di `./public/uploads` (volume, jadi rebuild tidak menghapus upload). |
| `Caddyfile.sway.snippet` | Blok Caddy untuk `sway.ryahmadn.my.id` → `sway:3000` (nama container di network `vps-setup_default`). |
| `.github/workflows/deploy.yml` | Workflow auto-deploy: push ke `production` → SSH ke VPS → `git pull` → `docker compose up -d --build` → cek `http://localhost:3100/`. |
| `prisma/` | Schema Postgres + `seed.ts` + riwayat migrasi. |
| `next.config.ts` | Ditambah `output: 'standalone'` (wajib buat image Docker). |

## Langkah 1 — Masukkan semua perubahan ke repo (sekali)

Semua perubahan — kode aplikasi, `prisma/`, file deploy, dan dokumen —
harus masuk ke repo, bukan cuma file deploy. Dari laptop, di folder repo:

```bash
git add -A
git status   # pastikan .env TIDAK ikut (sudah di-.gitignore)
git commit -m "Migrate Sway to Postgres + Prisma (no more JSON store)"
git push origin main
git checkout -b production
git push -u origin production
```

## Langkah 2 — DNS (sekali)

Di Cloudflare, tambah A record:

- Nama: `sway` → `43.173.51.75`, Proxy **OFF** (DNS-only, biar Caddy yang urus TLS).

## Langkah 3 — Deploy key buat GitHub Actions (sekali)

Di laptop, bikin keypair khusus deploy (tanpa passphrase):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/sway-deploy -C "sway-github-deploy" -N ""
```

Public key-nya masuk ke VPS:

```bash
cat ~/.ssh/sway-deploy.pub
# copy isinya, lalu di VPS:
# echo "<isi .pub>" >> /home/ubuntu/.ssh/authorized_keys
```

Private key-nya jadi GitHub secret (jangan pernah di-commit):

- GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

| Secret | Isi |
| --- | --- |
| `VPS_HOST` | `43.173.51.75` |
| `VPS_USER` | `ubuntu` |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | Seluruh isi `~/.ssh/sway-deploy` (termasuk baris `BEGIN/END OPENSSH PRIVATE KEY`) |

## Langkah 4 — Setup pertama di VPS (sekali)

### 4a. Buat database `sway` di Postgres yang sudah ada

Postgres n8n jalan sebagai container di `/opt/ryahmadn/vps-setup`. Sway
pakai database baru di Postgres yang sama — bukan container baru. Cari
dulu nama container + superuser-nya:

```bash
ssh ubuntu@43.173.51.75
cd /opt/ryahmadn/vps-setup
docker compose ps            # lihat nama service postgres (mis. postgres)
grep POSTGRES_USER .env       # superuser Postgres (kalau kosong, default-nya postgres)
```

Lalu buat user + database untuk Sway (ganti `postgres` dengan superuser
dari langkah di atas kalau beda, dan ganti password-nya):

```bash
docker compose exec postgres psql -U postgres -d postgres \
  -c "CREATE USER sway WITH PASSWORD 'ganti-dengan-password-kuat';"
docker compose exec postgres psql -U postgres -d postgres \
  -c "CREATE DATABASE sway OWNER sway;"
```

User `sway` cukup jadi owner database `sway` — dia **tidak** butuh
`CREATEDB` (itu cuma dibutuhkan `prisma migrate dev` di laptop, bukan
`migrate deploy` yang jalan di VPS).

### 4b. Clone repo + isi .env

```bash
cd /opt/ryahmadn
git clone https://github.com/rahmadn24/sway-social-media.git sway
cd sway
git checkout production

cp .env.example .env
# lalu edit .env (nano .env) dan isi:
#   DATABASE_URL=postgresql://sway:<password-4a>@postgres:5432/sway
#     (host-nya `postgres` — nama service di network vps-setup_default,
#      BUKAN localhost, karena Sway jalan di container lain)
#   SWAY_SESSION_SECRET=<openssl rand -hex 32>
#   SWAY_ENCRYPTION_KEY=<openssl rand -hex 32>   (64 karakter hex)
#   SWAY_ADMIN_EMAIL=admin@sway.local
#   SWAY_ADMIN_PASSWORD=<password admin lo>
#   AI_PROVIDER=deepseek + DEEPSEEK_API_KEY=<key DeepSeek lo> (opsional;
#     key AI juga bisa diisi lewat UI Connections, tersimpan terenkripsi)
# .env tidak masuk git, jangan taruh key di chat atau di repo.
# SWAY_ENCRYPTION_KEY jangan sampai hilang — kalau hilang, semua AI key
# yang tersimpan jadi tidak bisa dibaca lagi.
```

### 4c. Jalankan + verifikasi

```bash
docker compose up -d --build
```

Boot pertama lebih lama dari biasanya: entrypoint menjalankan migrasi
lalu seed (demo user + admin + workspace demo), baru server nyala —
tunggu sekitar **30 detik**, jangan cek di detik ke-5:

```bash
sleep 30
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
# harus 200
curl -s http://localhost:3100/login | head -c 200
# harus HTML halaman login
```

Caddy: tambahkan isi `Caddyfile.sway.snippet` ke Caddyfile VPS, lalu reload
Caddy (misal `cd /opt/ryahmadn/vps-setup && docker compose restart caddy`).
Cek dari luar:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sway.ryahmadn.my.id/
# harus 200
```

Buka `https://sway.ryahmadn.my.id/login`, klik **"Try the demo"** untuk
masuk sebagai demo, atau login dengan admin dari `.env`.

## Cara pakai sehari-hari

```bash
# kerja seperti biasa di main
git checkout main
# ... edit, commit ...
git push origin main

# kalau sudah siap rilis:
git checkout production
git merge main
git push origin production
# -> GitHub Actions jalan, 1-2 menit kemudian live di sway.ryahmadn.my.id
```

Pantau di GitHub repo → tab **Actions** → **Deploy Sway to VPS**. Kalau
workflow merah, buka log-nya — biasanya `git pull` gagal (konflik di VPS,
jangan edit file di VPS langsung) atau build gagal (cek log Docker).

## ⚠️ Known issue: health check deploy (`sleep 5` tidak cukup)

Workflow `.github/workflows/deploy.yml` sekarang masih melakukan:

```bash
docker compose up -d --build
sleep 5
curl -fsS -o /dev/null http://localhost:3100/
```

Sejak migrasi Postgres, container butuh waktu lebih lama sebelum
mendengarkan port 3000: entrypoint menjalankan `prisma migrate deploy`
(~1–2 detik kalau tidak ada migrasi baru) + `prisma db seed` via `tsx`
(~3–6 detik) + start server Next.js (~2–3 detik). Total sekitar
**8–15 detik** — jadi `curl` di detik ke-5 hampir pasti gagal dan
workflow jadi merah **padahal deploy-nya sebenarnya berhasil** beberapa
detik kemudian.

Perbaikan yang disarankan (file workflow TIDAK diubah di PR ini, perlu
di-apply terpisah): ganti `sleep 5` + satu `curl` dengan retry loop:

```bash
for i in $(seq 1 12); do
  curl -fsS -o /dev/null http://localhost:3100/ && break || sleep 5
done
curl -fsS -o /dev/null http://localhost:3100/ && echo "Sway is up on :3100"
```

Sampai itu di-apply, kalau workflow merah di langkah curl tapi container
`sway` sebenarnya jalan (`docker compose ps` + `curl localhost:3100`
dari VPS mengembalikan 200), deploy-nya aman — itu cuma health check
yang terlalu cepat.

## Rollback

```bash
git checkout production
git revert <commit-yang-rusak>   # atau: git reset --hard origin/main
git push origin production
# workflow jalan lagi dan deploy versi sebelumnya
```

Catatan: rollback kode tidak me-rollback migrasi database. Kalau commit
yang di-revert membawa migrasi baru, migrasi itu tetap ter-apply di
Postgres — schema baru biasanya backward-compatible (kolom/tabel baru
yang tidak dipakai kode lama). Kalau migrasi-nya destruktif, pulihkan
dari backup Postgres (`pg_dump` — lihat catatan di bawah).

## Yang perlu diingat (jujur)

- **Publishing masih sandbox.** Sway memvalidasi dan mensimulasikan posting;
  tidak ada konten yang terkirim ke Instagram/TikTok/dll. Publishing beneran
  butuh adapter OAuth per platform di `lib/publishing.ts` + mode
  `SOCIAL_PUBLISHING_MODE=live` (belum dibangun).
- **Inbox & analytics masih data demo** (seed), belum sinkron dari network.
- **AI beneran butuh key.** Tanpa key, Studio dan saran balasan pakai demo
  writer dan diberi label **Demo writer**. DeepSeek sudah didukung sebagai
  provider (`AI_PROVIDER=deepseek`). Key yang diisi lewat UI tersimpan
  **terenkripsi per user** di Postgres, tidak pernah dikembalikan ke browser.
- **Data di Postgres, bukan file.** Reset workspace demo lewat tombol reset
  di aplikasi (POST /api/auth/reset) — user + AI setting tidak ikut
  terhapus. Jangan hapus database `sway` untuk reset; itu juga menghapus
  user admin.
- **Backup Postgres** sebelum deploy besar: dari VPS,
  `docker compose exec postgres pg_dump -U postgres -d sway > sway-backup.sql`
  (jalankan dari `/opt/ryahmadn/vps-setup`), simpan file-nya di luar VPS.
- **Build di VPS butuh ruang.** Image Node + build sekitar 1 GB. Kalau disk
  mepet, cek `df -h` dan bersihkan dengan `docker system prune -a`.
