# Deploy Sway — sway.ryahmadn.my.id + auto-deploy dari GitHub

Sway jalan di `https://sway.ryahmadn.my.id`. Setiap push ke branch
`production` otomatis deploy ke VPS lewat GitHub Actions. Push ke `main`
tidak men-deploy apa-apa, jadi `main` tetap tempat kerja sehari-hari.

## Yang sudah disiapkan di repo ini

| File | Fungsi |
| --- | --- |
| `Dockerfile` | Image production Next.js (standalone output, Node 24). |
| `docker-compose.yml` | Satu service `sway`, port host `3100` → container `3000`. Data workspace di `./data` dan upload di `./public/uploads` (volume, jadi rebuild tidak menghapus data). |
| `Caddyfile.sway.snippet` | Blok Caddy untuk `sway.ryahmadn.my.id` → `localhost:3100`. |
| `.github/workflows/deploy.yml` | Workflow auto-deploy: push ke `production` → SSH ke VPS → `git pull` → `docker compose up -d --build` → cek `http://localhost:3100/`. |
| `next.config.ts` | Ditambah `output: 'standalone'` (wajib buat image Docker). |

## Langkah 1 — Masukkan file ini ke repo (sekali)

Dari laptop, di folder repo:

```bash
git add Dockerfile .dockerignore docker-compose.yml Caddyfile.sway.snippet \
  .github/workflows/deploy.yml DEPLOY.md next.config.ts
git commit -m "Add Docker + auto-deploy to VPS (sway.ryahmadn.my.id)"
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

```bash
ssh ubuntu@43.173.51.75
cd /opt/ryahmadn
git clone https://github.com/rahmadn24/sway-social-media.git sway
cd sway
git checkout production

# .env opsional. Tanpa ini Sway jalan dengan demo writer berlabel.
# Buat AI beneran (DeepSeek), isi file .env:
cp .env.example .env
# lalu edit .env: AI_PROVIDER=deepseek dan DEEPSEEK_API_KEY=<key DeepSeek lo>
# .env tidak masuk git, jangan taruh key di chat atau di repo.

docker compose up -d --build
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
# harus 200
```

Caddy: tambahkan isi `Caddyfile.sway.snippet` ke Caddyfile VPS, lalu reload
Caddy (misal `cd /opt/ryahmadn/vps-setup && docker compose restart caddy`).
Cek dari luar:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sway.ryahmadn.my.id/
# harus 200
```

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

## Rollback

```bash
git checkout production
git revert <commit-yang-rusak>   # atau: git reset --hard origin/main
git push origin production
# workflow jalan lagi dan deploy versi sebelumnya
```

## Yang perlu diingat (jujur)

- **Publishing masih sandbox.** Sway memvalidasi dan mensimulasikan posting;
  tidak ada konten yang terkirim ke Instagram/TikTok/dll. Publishing beneran
  butuh adapter OAuth per platform di `lib/publishing.ts` + mode
  `SOCIAL_PUBLISHING_MODE=live` (belum dibangun).
- **Inbox & analytics masih data demo** (seed), belum sinkron dari network.
- **AI beneran butuh key.** Tanpa key, Studio dan saran balasan pakai demo
  writer dan diberi label **Demo writer**. DeepSeek sudah didukung sebagai
  provider (`AI_PROVIDER=deepseek`).
- **Satu workspace, file-backed.** Data di `data/store.json` (volume VPS).
  Ini demo produk single-user, bukan multi-tenant.
- **Build di VPS butuh ruang.** Image Node + build sekitar 1 GB. Kalau disk
  mepet, cek `df -h` dan bersihkan dengan `docker system prune -a`.
