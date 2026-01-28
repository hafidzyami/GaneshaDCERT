# K6 Cloud Setup Guide

Ada beberapa cara untuk mengirim hasil testing K6 ke cloud untuk visualisasi dan analysis.

## Option 1: K6 Cloud (Grafana Cloud k6) - Recommended

### Step 1: Create Account

1. Visit: https://app.k6.io/account/register
2. Sign up dengan email atau GitHub
3. Free tier: 50 cloud test runs/month

### Step 2: Get API Token

1. Login ke https://app.k6.io
2. Go to: Settings → API Token
3. Click "Generate New Token"
4. Copy token (simpan dengan aman!)

### Step 3: Login K6 CLI

```bash
# Login dengan token
k6 login cloud --token YOUR_API_TOKEN

# Atau interactive login
k6 login cloud
```

### Step 4: Run Test dengan Cloud Output

Ada 2 cara mengirim hasil ke cloud:

#### A. Cloud Execution (Test berjalan di cloud - NOT for localhost)
```bash
# ❌ TIDAK bisa untuk localhost testing
k6 cloud quick-comparison.js
```

#### B. Local Execution + Cloud Results (RECOMMENDED)
```bash
# ✅ Test berjalan local, hasil dikirim ke cloud
k6 run --out cloud quick-comparison.js
```

### Step 5: View Results

Setelah test selesai, K6 akan memberikan URL:
```
output: cloud (https://app.k6.io/runs/1234567)
```

Open URL tersebut untuk melihat:
- Real-time metrics
- Performance graphs
- Detailed analysis
- Comparison dengan test sebelumnya

---

## Option 2: InfluxDB + Grafana (Self-Hosted)

Untuk full control dan privacy, setup InfluxDB + Grafana:

### Step 1: Install InfluxDB

```bash
# Windows (Chocolatey)
choco install influxdb

# Docker
docker run -d -p 8086:8086 influxdb:2.0
```

### Step 2: Create Database

```bash
# Create database
influx setup
# Follow prompts to create:
# - Organization: your-org
# - Bucket: k6
# - Token: (save this!)
```

### Step 3: Install Grafana

```bash
# Windows (Chocolatey)
choco install grafana

# Docker
docker run -d -p 3000:3000 grafana/grafana
```

### Step 4: Configure K6 Output

```bash
# Run test with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 quick-comparison.js
```

### Step 5: Setup Grafana Dashboard

1. Open Grafana: http://localhost:3000 (admin/admin)
2. Add InfluxDB as data source
3. Import K6 dashboard: https://grafana.com/grafana/dashboards/2587

---

## Option 3: JSON Output + Custom Visualization

Untuk simple visualization tanpa setup server:

### Step 1: Generate JSON

```bash
k6 run --out json=results/metrics.json quick-comparison.js
```

### Step 2: Use k6-reporter (Already Configured)

HTML report sudah otomatis di-generate di:
- `results/quick-comparison.html`
- `results/summary.html`

### Step 3: Upload to File Sharing (Optional)

```bash
# Upload HTML report ke:
# - GitHub Pages
# - Netlify
# - Vercel
# - AWS S3
```

---

## Recommended Setup for Your Use Case

Karena Anda ingin compare database vs blockchain, saya recommend:

### Setup: K6 Cloud (Local Execution + Cloud Results)

```bash
# 1. Login K6 Cloud
k6 login cloud --token YOUR_TOKEN

# 2. Run test local dengan output ke cloud
cd k6-tests
k6 run --out cloud quick-comparison.js

# 3. View results di browser
# K6 akan print URL: https://app.k6.io/runs/xxxxx
```

**Benefits:**
- ✅ Test runs locally (bisa access localhost)
- ✅ Results uploaded to cloud (visualization)
- ✅ Historical comparison
- ✅ Share results dengan team
- ✅ Free tier available

---

## Environment Variables

Untuk CI/CD atau automation:

```bash
# Set K6 cloud token
export K6_CLOUD_TOKEN="your_token_here"

# Run test
k6 run --out cloud quick-comparison.js
```

### Windows (PowerShell)
```powershell
$env:K6_CLOUD_TOKEN="your_token_here"
k6 run --out cloud quick-comparison.js
```

### Windows (CMD)
```cmd
set K6_CLOUD_TOKEN=your_token_here
k6 run --out cloud quick-comparison.js
```

---

## Updated Batch Scripts

Saya akan update `run-test.bat` untuk support cloud output.
