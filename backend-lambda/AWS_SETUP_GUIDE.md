# AWS Setup Guide for NexCast Lambda Backend

## Prerequisites
- AWS Account
- AWS CLI installed locally
- Node.js and npm installed (for Serverless Framework)

---

## Step 1: Configure AWS Credentials

Open a new terminal and run:

```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-east-1`
- Default output format: `json`

**Verify:**
```bash
aws sts get-caller-identity
```

---

## Step 2: Create RDS MySQL Database

### Option A: Via AWS Console (Recommended)

1. **Go to RDS Console:** https://console.aws.amazon.com/rds/
2. **Create Database:**
   - Click "Create database"
   - Engine: **MySQL 8.0**
   - Template: **Free tier** (or Dev/Test)
   - DB instance identifier: `nexcast-db`
   - Master username: `admin`
   - Master password: (set a strong password, save it)
   - DB instance class: `db.t3.micro`
   - Storage: 20 GB gp3
   - **Public access: YES** (for now, we'll secure later)
   - VPC security group: Create new → `nexcast-db-sg`
   - Initial database name: `nexcast`
3. **Click "Create database"**
4. **Wait 5-10 minutes** for status to become "Available"
5. **Copy the endpoint** (e.g., `nexcast-db.xxxxx.us-east-1.rds.amazonaws.com`)

### Option B: Via AWS CLI

```bash
aws rds create-db-instance \
  --db-instance-identifier nexcast-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password YOUR_PASSWORD_HERE \
  --allocated-storage 20 \
  --db-name nexcast \
  --publicly-accessible \
  --backup-retention-period 0 \
  --region us-east-1
```

---

## Step 3: Configure RDS Security Group

1. **Go to RDS Console** → Select your database → **Connectivity & security** tab
2. **Click on the VPC security group** (e.g., `nexcast-db-sg`)
3. **Edit inbound rules:**
   - Type: `MySQL/Aurora`
   - Port: `3306`
   - Source: `0.0.0.0/0` (Anywhere - for testing only)
   - Description: `Allow MySQL from anywhere`
4. **Save rules**

**⚠️ Production Note:** Later, restrict source to Lambda security group only.

---

## Step 4: Initialize Database Schema

Connect to your RDS instance and run the schema:

```bash
# Install MySQL client if needed
brew install mysql  # macOS
# or
sudo apt install mysql-client  # Ubuntu

# Connect to RDS
mysql -h YOUR_RDS_ENDPOINT -u admin -p nexcast

# Once connected, run:
source /path/to/backend-lambda/db/schema.sql

# Verify tables
SHOW TABLES;
EXIT;
```

**Alternative:** Use a GUI tool like MySQL Workbench or DBeaver.

---

## Step 5: Create S3 Bucket for Frames

```bash
aws s3 mb s3://nexcast-frames-YOUR_UNIQUE_SUFFIX --region us-east-1
```

**Enable CORS:**

Create `cors.json`:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

Apply CORS:
```bash
aws s3api put-bucket-cors --bucket nexcast-frames-YOUR_UNIQUE_SUFFIX --cors-configuration file://cors.json
```

---

## Step 6: Create Cognito User Pool

### Via AWS Console:

1. **Go to Cognito Console:** https://console.aws.amazon.com/cognito/
2. **Create User Pool:**
   - Sign-in options: **Email**
   - Password policy: Default
   - MFA: Optional (can skip for now)
   - User account recovery: Email only
   - Self-service sign-up: **Enabled**
   - Attribute verification: Email
   - Required attributes: Email
   - Email provider: Send email with Cognito (default)
   - User pool name: `nexcast-users`
   - App client name: `nexcast-web-client`
   - **IMPORTANT:**
     - Auth flows: Enable `ALLOW_USER_PASSWORD_AUTH`
     - Don't generate client secret
3. **Click "Create user pool"**
4. **Copy the following:**
   - User Pool ID (e.g., `us-east-1_XXXXXXXXX`)
   - App Client ID (e.g., `1a2b3c4d5e6f7g8h9i0j`)

### Via AWS CLI:

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name nexcast-users \
  --auto-verified-attributes email \
  --username-attributes email \
  --region us-east-1

# Create app client
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name nexcast-web-client \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region us-east-1
```

---

## Step 7: Configure Environment Variables

In `backend-lambda/`, create `.env` file:

```bash
cd backend-lambda
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database Configuration
DB_HOST=nexcast-db.xxxxx.us-east-1.rds.amazonaws.com
DB_NAME=nexcast
DB_USER=admin
DB_PASSWORD=your_rds_password
DB_PORT=3306

# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j

# S3 Configuration
S3_BUCKET_NAME=nexcast-frames-YOUR_UNIQUE_SUFFIX
```

---

## Step 8: Install Serverless Framework Dependencies

```bash
cd backend-lambda

# Install serverless-python-requirements plugin
npm install --save-dev serverless-python-requirements

# Verify
npm list --depth=0
```

---

## Step 9: Deploy Lambda Functions

```bash
# Deploy to AWS
serverless deploy

# Expected output:
# ✔ Service deployed to stack NexCast-dev
# endpoints:
#   GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/health
#   ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/auth/{proxy+}
#   ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/session/{proxy+}
#   ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/frame/{proxy+}
#   ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/history/{proxy+}
```

**Copy the API Gateway base URL** (e.g., `https://xxxxx.execute-api.us-east-1.amazonaws.com`)

---

## Step 10: Test Health Endpoint

```bash
curl https://YOUR_API_GATEWAY_URL/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "NexCast API"
}
```

---

## Troubleshooting

### Lambda can't connect to RDS
- **Check security group:** Ensure 0.0.0.0/0 is allowed on port 3306
- **Check RDS public access:** Must be enabled
- **Check .env variables:** Ensure DB_HOST is correct

### "Module not found" errors
- Run: `serverless deploy --force` to rebuild dependencies

### Cognito authorization fails
- Verify `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` in `.env`
- Check User Pool has `ALLOW_USER_PASSWORD_AUTH` enabled

---

## Summary Checklist

- [ ] AWS credentials configured (`aws configure`)
- [ ] RDS MySQL instance created and available
- [ ] RDS security group allows port 3306 from anywhere
- [ ] Database schema initialized (`schema.sql` executed)
- [ ] S3 bucket created with CORS enabled
- [ ] Cognito User Pool created with app client
- [ ] `.env` file created with all credentials
- [ ] `serverless-python-requirements` plugin installed
- [ ] `serverless deploy` successful
- [ ] Health endpoint returns 200 OK

---

## Next Steps

After successful deployment:
1. Test auth endpoints (register/login)
2. Create a test user in Cognito
3. Test session start/end endpoints
4. Configure Cloudflare (Phase 1, later)
5. Build and deploy frontend SPA
