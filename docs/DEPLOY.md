# Production deploy — woworun (VPS + GitHub Actions)

Alur:

```
push ke main
   └─ GitHub Actions: verify (npm ci, prisma generate, typecheck, test, build)
        └─ SSH ke VPS (user deployer)
             └─ git fetch && git reset --hard origin/main
                  └─ docker compose -f docker-compose.yml up -d --build --remove-orphans
                       └─ tunggu port 127.0.0.1:6601
                            └─ curl http://127.0.0.1:6601/api/health
                                 └─ curl https://run.zgenit.site/api/health (warn-only)
```

| File | Fungsi |
|---|---|
| `.github/workflows/deploy.yml` | CI verify + deploy via SSH |
| `scripts/deploy.sh` | Rutin deploy di server (idempoten, bisa manual) |
| `docker-compose.yml` | Stack produksi (db + app) |
| `app/api/health/route.ts` | `GET /api/health` (Prisma `SELECT 1`) |

Target: **`/home/deployer/woworun`**, user SSH **`deployer`**, domain **`run.zgenit.site`**, host port **6601**.

> **Penting:** nama project compose diambil dari nama direktori (`woworun`).
> Jangan ganti nama folder saat pindah, kalau tidak Postgres akan memakai
> volume baru yang kosong (`woworun_walklog-db` lama tidak terpakai).

---

## 1. Setup sekali di VPS

### 1.1 User deployer + docker

```bash
sudo adduser --disabled-password --gecos "" deployer   # lewati kalau sudah ada
sudo usermod -aG docker deployer
id deployer
```

### 1.2 Pindahkan repo dari /home/ubuntu/woworun

```bash
# backup DB dulu
cd /home/ubuntu/woworun
docker compose exec -T db pg_dump -U walklog walklog > ~/woworun-backup-$(date +%F).sql

# hentikan stack lama (volume tetap ada)
docker compose down

# pindah tanpa mengubah nama folder
sudo mv /home/ubuntu/woworun /home/deployer/woworun
sudo chown -R deployer:deployer /home/deployer/woworun
sudo chmod 600 /home/deployer/woworun/.env
```

### 1.3 Kunci SSH untuk CI

```bash
# di laptop
ssh-keygen -t ed25519 -C "gha-deploy-woworun" -f ~/.ssh/gha_deploy_woworun -N ""

# di VPS
sudo install -d -m 700 -o deployer -g deployer /home/deployer/.ssh
echo 'ssh-ed25519 AAAA... gha-deploy-woworun' | \
  sudo tee -a /home/deployer/.ssh/authorized_keys
sudo chown deployer:deployer /home/deployer/.ssh/authorized_keys
sudo chmod 600 /home/deployer/.ssh/authorized_keys
```

Tes dari laptop:

```bash
ssh -i ~/.ssh/gha_deploy_woworun deployer@<IP> 'docker info >/dev/null && echo docker-ok'
```

### 1.4 Deploy key GitHub (untuk `git fetch` di server)

```bash
sudo -u deployer -H ssh-keygen -t ed25519 -C "vps-deployer-woworun" \
  -f /home/deployer/.ssh/github_deploy -N ""

sudo tee /home/deployer/.ssh/config >/dev/null <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /home/deployer/.ssh/github_deploy
  IdentitiesOnly yes
EOF

sudo chown deployer:deployer /home/deployer/.ssh/config
sudo chmod 600 /home/deployer/.ssh/config

sudo -u deployer -H ssh-keyscan github.com >> /home/deployer/.ssh/known_hosts
sudo chown deployer:deployer /home/deployer/.ssh/known_hosts
sudo chmod 600 /home/deployer/.ssh/known_hosts

sudo -u deployer -H git -C /home/deployer/woworun remote set-url origin \
  git@github.com:Mfdsix/woworun.git

sudo cat /home/deployer/.ssh/github_deploy.pub
```

Tempel public key itu di **repo → Settings → Deploy keys** (read-only).
Tes: `sudo -u deployer -H git -C /home/deployer/woworun fetch origin main`.

### 1.5 File `.env`

Sudah ikut pindah dan gitignored, jadi tidak tersentuh deploy. Pastikan:

```bash
sudo -u deployer -H chmod 600 /home/deployer/woworun/.env
grep -E '^(APP_SECRET|APP_URL|PUBLIC_APP_URL|APP_PORT|APP_BIND)=' /home/deployer/woworun/.env
```

Nilai yang benar untuk produksi:

```dotenv
APP_SECRET=<32+ karakter acak>
PUBLIC_APP_URL=https://run.zgenit.site
APP_URL=https://run.zgenit.site
APP_BIND=127.0.0.1     # opsional: hanya bisa diakses lewat nginx
APP_PORT=6601
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
```

Jangan lupa update **Authorization Callback Domain** di aplikasi Strava menjadi
`run.zgenit.site`.

### 1.6 nginx + TLS untuk run.zgenit.site

`docker compose` tidak mengatur nginx. Contoh server block:

```nginx
server {
    listen 80;
    server_name run.zgenit.site;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name run.zgenit.site;

    ssl_certificate     /etc/letsencrypt/live/run.zgenit.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/run.zgenit.site/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:6601;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

`sudo certbot certonly --nginx -d run.zgenit.site`, lalu `sudo nginx -t &&
sudo systemctl reload nginx`.

---

## 2. Secrets GitHub (repo woworun)

| Secret | Nilai |
|---|---|
| `SSH_HOST` | IP/hostname VPS |
| `SSH_USER` | `deployer` |
| `SSH_KEY` | isi private `~/.ssh/gha_deploy_woworun` |
| `APP_DIR` | `/home/deployer/woworun` |
| `SSH_PORT` | `22` (opsional) |

Opsional: aktifkan Environment `production` + required reviewer.

---

## 3. Branch dan deploy

Workflow berjalan pada push ke **`main`**. Saat dokumen ini dibuat, pekerjaan
terbaru masih di `ux/tab-first`; merge dulu ke `main` sebelum mengharapkan
deploy otomatis.

Deploy manual:

```bash
sudo -u deployer -H bash -lc 'cd /home/deployer/woworun && bash scripts/deploy.sh'

# variasi
bash scripts/deploy.sh --no-build
bash scripts/deploy.sh --no-pull
STRICT_EXTERNAL=1 bash scripts/deploy.sh
DEPLOY_BRANCH=ux/tab-first bash scripts/deploy.sh   # deploy branch lain
```

Override environment: `COMPOSE_FILE`, `APP_PORT`, `HEALTH_URL`,
`EXTERNAL_HEALTH_URL`, `PORT_TIMEOUT`, `HEALTH_TIMEOUT`.

Yang dicek `deploy.sh`:

1. `docker` tersedia (fallback `sudo docker`), compose file + `.env` ada.
2. Sinkron ke `origin/main` (`checkout -f -B` + `reset --hard`).
3. `docker compose up -d --build --remove-orphans`.
4. Port `127.0.0.1:6601` menerima koneksi TCP (maks 90s).
5. `GET /api/health` = 200 dengan `SELECT 1` ke Postgres (maks 90s).
6. Health eksternal `https://run.zgenit.site/api/health` (warning saja).
7. Jika gagal: `compose ps` + 100 baris log `app`/`db` otomatis dicetak.

Respons sehat:

```json
{ "status": "ok", "commit": "d101279", "uptime": 12 }
```

---

## 4. Rollback

```bash
cd /home/deployer/woworun
git fetch origin main
git checkout -f -B main <sha-target>
bash scripts/deploy.sh --no-pull
```

Setelah pulih, deploy normal lagi (atau revert commit di GitHub).

---

## 5. Troubleshooting

| Gejala | Penyebab | Aksi |
|---|---|---|
| `port 6601 never opened` | app crash / port dipakai proses lain | `docker compose ps`, `docker compose logs --tail=100 app`, `ss -ltnp \| grep 6601` |
| health 503 `db_down` | Postgres belum siap / password beda | `docker compose logs db`, cek `POSTGRES_*` di `.env` |
| `Invalid environment: APP_SECRET` | `.env` kurang/terlalu pendek | isi ulang, `chmod 600` |
| `502` dari domain | nginx hidup, upstream mati | `curl -v http://127.0.0.1:6601/api/health` |
| `git fetch` ditolak | deploy key/config salah | `ssh -T git@github.com` sebagai deployer; cek `~/.ssh/config` |
| DB kosong setelah pindah folder | folder tidak bernama `woworun` | kembali ke nama folder yang sama, atau restore dump |
| `caddy`/container lain hilang | `--remove-orphans` | normal jika memang tidak dipakai; jangan jalankan dua project dengan nama sama |

Perintah cek cepat:

```bash
cd /home/deployer/woworun
docker compose ps
docker compose logs --tail=100 app
curl -sS http://127.0.0.1:6601/api/health
curl -sS https://run.zgenit.site/api/health
```
