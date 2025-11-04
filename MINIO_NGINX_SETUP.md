# Setup MinIO dengan Nginx Reverse Proxy + SSL

Panduan ini akan membantu Anda setup MinIO agar bisa diakses melalui HTTPS menggunakan nginx reverse proxy.

## Prasyarat

- Domain/subdomain untuk MinIO (contoh: `minio.ganeshait.com`)
- DNS A record sudah pointing ke IP server: `156.67.218.217`
- Nginx sudah terinstall di server
- Certbot untuk SSL certificate

---

## Langkah 1: Setup DNS

Buat subdomain untuk MinIO di DNS provider Anda:

```
Type: A
Name: minio
Value: 156.67.218.217
TTL: Auto
```

Hasil: `minio.ganeshait.com` → `156.67.218.217`

**Verifikasi DNS sudah propagate:**
```bash
nslookup minio.ganeshait.com
# atau
dig minio.ganeshait.com
```

---

## Langkah 2: Install Nginx dan Certbot (jika belum)

```bash
# SSH ke server
ssh root@srv513883.hstgr.cloud

# Install nginx
sudo dnf install nginx -y

# Install certbot untuk Let's Encrypt
sudo dnf install certbot python3-certbot-nginx -y

# Enable dan start nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Cek status
sudo systemctl status nginx
```

---

## Langkah 3: Buat Direktori untuk Certbot Challenge

```bash
sudo mkdir -p /var/www/certbot
sudo chown -R nginx:nginx /var/www/certbot
```

---

## Langkah 4: Upload dan Konfigurasi Nginx untuk MinIO

**Option A: Buat file config secara manual**

```bash
sudo nano /etc/nginx/conf.d/minio.conf
```

Copy paste isi dari file `nginx-minio.conf` yang ada di repository ini.

**PENTING:** Ganti `minio.ganeshait.com` dengan subdomain Anda yang sebenarnya!

**Option B: Upload file dari repository**

```bash
# Di server
cd /etc/nginx/conf.d/
sudo nano minio.conf
# Paste isi file nginx-minio.conf, lalu save
```

---

## Langkah 5: Test Konfigurasi Nginx (Tanpa SSL Dulu)

Buat konfigurasi sementara tanpa SSL untuk mendapatkan certificate:

```bash
sudo nano /etc/nginx/conf.d/minio-temp.conf
```

Paste ini:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name minio.ganeshait.com;  # GANTI dengan subdomain Anda

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test dan reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Langkah 6: Buka Port 80 dan 443 di Firewalld

```bash
# Buka port HTTP dan HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Atau dengan port number
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp

# Reload firewall
sudo firewall-cmd --reload

# Verifikasi
sudo firewall-cmd --list-all
```

---

## Langkah 7: Dapatkan SSL Certificate dari Let's Encrypt

```bash
# Dapatkan certificate untuk subdomain MinIO
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d minio.ganeshait.com \
  --email hbandung@ganeshait.com \
  --agree-tos \
  --no-eff-email

# Jika berhasil, certificate akan disimpan di:
# /etc/letsencrypt/live/minio.ganeshait.com/
```

**Note:** Ganti email dengan email Anda yang valid untuk notifikasi renewal.

---

## Langkah 8: Apply Konfigurasi Nginx dengan SSL

```bash
# Hapus config sementara
sudo rm /etc/nginx/conf.d/minio-temp.conf

# Apply config yang sudah ada SSL (dari langkah 4)
# File: /etc/nginx/conf.d/minio.conf

# PASTIKAN subdomain sudah diganti di config!
sudo nano /etc/nginx/conf.d/minio.conf
# Ganti semua 'minio.ganeshait.com' dengan subdomain Anda

# Test config
sudo nginx -t

# Jika OK, reload nginx
sudo systemctl reload nginx
```

---

## Langkah 9: Update .env di Backend

Update file `.env` di server dan di GitHub Secrets:

```env
# SEBELUM (HTTP, tidak bisa di HTTPS website):
MINIO_ENDPOINT=156.67.218.217
MINIO_USE_SSL=false

# SESUDAH (HTTPS, bisa diakses dari HTTPS website):
MINIO_ENDPOINT=minio.ganeshait.com
MINIO_USE_SSL=true
```

**Di server:**

```bash
cd /www/ganeshadcert
nano .env
# Update MINIO_ENDPOINT dan MINIO_USE_SSL
```

**Di GitHub Secrets:**

Update secret `ENTIRE_ENV_FILE_STAGING` dengan nilai yang sama.

---

## Langkah 10: Update MinIO Container Configuration

Update `docker-compose.yml` untuk MINIO_PUBLIC_URL (opsional tapi disarankan):

```yaml
minio:
  image: minio/minio:RELEASE.2025-04-22T22-12-26Z-cpuv1
  container_name: minio
  hostname: minio
  restart: unless-stopped
  ports:
    - "127.0.0.1:9000:9000"  # Kembali ke localhost saja (nginx yang handle public)
    - "127.0.0.1:9001:9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    MINIO_SERVER_URL: https://minio.ganeshait.com  # URL publik
  volumes:
    - minio-data:/data
  command: server /data --console-address ":9001"
```

---

## Langkah 11: Restart Containers

```bash
cd /www/ganeshadcert

# Restart semua containers dengan config baru
docker compose down
docker compose up -d

# Cek logs
docker compose logs -f ganeshadcert-api
```

---

## Langkah 12: Test Akses MinIO

**Test dari browser:**

```
https://minio.ganeshait.com/minio/health/live
```

Seharusnya return response dari MinIO.

**Test upload image di aplikasi:**

Buat VC Schema baru dengan image, seharusnya sekarang bisa upload tanpa error CORS atau mixed content.

---

## Langkah 13: Setup Auto-Renewal Certificate (Penting!)

Let's Encrypt certificate expire setiap 90 hari. Setup auto-renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Jika sukses, certbot sudah otomatis setup cronjob/timer
# Verifikasi timer:
sudo systemctl list-timers | grep certbot
```

---

## Troubleshooting

### 1. Certificate Error

```bash
# Cek certificate details
sudo certbot certificates

# Force renew jika ada masalah
sudo certbot renew --force-renewal
```

### 2. Nginx Error 502 Bad Gateway

```bash
# Cek MinIO container running
docker ps | grep minio

# Cek MinIO logs
docker logs minio

# Cek nginx error log
sudo tail -f /var/log/nginx/minio-error.log
```

### 3. Connection Refused

```bash
# Cek MinIO port listening
sudo netstat -tulpn | grep 9000

# Cek firewall
sudo firewall-cmd --list-all

# Cek SELinux (jika enabled)
sudo getsebool httpd_can_network_connect
# Jika off, enable:
sudo setsebool -P httpd_can_network_connect on
```

### 4. CORS Error

Tambahkan di nginx config (di dalam block `location /`):

```nginx
# CORS headers (jika diperlukan)
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, x-amz-content-sha256, x-amz-date' always;

if ($request_method = 'OPTIONS') {
    return 204;
}
```

---

## Security Checklist

- [x] MinIO port 9000 hanya listen di localhost (nginx yang expose ke public)
- [x] SSL/TLS enabled dengan Let's Encrypt
- [x] Firewall hanya buka port 80, 443 (tutup 9000 ke public)
- [x] Auto-renewal certificate enabled
- [x] HSTS header (uncomment setelah testing)

---

## Summary

Setelah setup ini, arsitektur Anda:

```
Browser/Frontend (HTTPS)
    ↓
nginx (443) + SSL/TLS
    ↓
MinIO Container (9000, localhost only)
    ↓
Backend Container (via Docker network)
```

**Keuntungan:**
- ✅ MinIO bisa diakses dari HTTPS website (no mixed content error)
- ✅ SSL certificate gratis dari Let's Encrypt
- ✅ MinIO tidak expose langsung ke internet (lebih aman)
- ✅ Data MinIO tidak hilang saat deployment
- ✅ Semua akses terenkripsi

---

**Need Help?** Check logs:
```bash
# Nginx logs
sudo tail -f /var/log/nginx/minio-error.log

# MinIO logs
docker logs -f minio

# Backend logs
docker logs -f ganeshadcert-api
```
