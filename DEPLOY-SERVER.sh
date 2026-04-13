#!/bin/bash
# ============================================================
# 99 Tech Hub ERP - Server Deployment Script
# Run this on your Ubuntu server as the 'erp' user
# Usage: bash DEPLOY-SERVER.sh
# ============================================================

set -e  # Exit on any error

echo "=========================================="
echo "  99 Tech Hub ERP - Server Deployment"
echo "=========================================="
echo ""

# --- Colors for output ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

step() { echo -e "\n${GREEN}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# --- Step 1: System Update ---
step "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# --- Step 2: Install Node.js 20 LTS ---
step "Installing Node.js 20 LTS..."
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js installed: $(node -v)"
    echo "npm installed: $(npm -v)"
fi

# --- Step 3: Install PostgreSQL ---
step "Installing PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "PostgreSQL already installed: $(psql --version)"
else
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo "PostgreSQL installed: $(psql --version)"
fi

# --- Step 4: Create Database and User ---
step "Setting up PostgreSQL database..."
DB_NAME="ninety9tech_erp"
DB_USER="erp_admin"
DB_PASS="99Tech_ERP_2026!"

# Create user and database (ignore errors if they already exist)
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || echo "User ${DB_USER} already exists"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || echo "Database ${DB_NAME} already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
# For PostgreSQL 15+ grant schema permissions
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -d ${DB_NAME} -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};" 2>/dev/null || true

echo "Database '${DB_NAME}' ready with user '${DB_USER}'"

# --- Step 5: Install Nginx ---
step "Installing Nginx..."
if command -v nginx &> /dev/null; then
    echo "Nginx already installed"
else
    sudo apt-get install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo "Nginx installed"
fi

# --- Step 6: Install PM2 (Process Manager) ---
step "Installing PM2..."
if command -v pm2 &> /dev/null; then
    echo "PM2 already installed"
else
    sudo npm install -g pm2
    echo "PM2 installed"
fi

# --- Step 7: Install Git ---
step "Installing Git..."
if command -v git &> /dev/null; then
    echo "Git already installed: $(git --version)"
else
    sudo apt-get install -y git
fi

# --- Step 8: Clone the Repository ---
step "Cloning repository..."
APP_DIR="/home/erp/99tech-erp"

if [ -d "$APP_DIR" ]; then
    warn "Directory $APP_DIR already exists. Pulling latest..."
    cd "$APP_DIR"
    git pull origin main
else
    cd /home/erp
    git clone https://github.com/Aaqib-A10/99techerphub.git 99tech-erp
    cd "$APP_DIR"
fi

# --- Step 9: Create .env file ---
step "Creating environment configuration..."
cat > "$APP_DIR/.env" << ENVEOF
# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# App
NEXTAUTH_SECRET="99tech-erp-secret-key-$(date +%s)"
NEXTAUTH_URL="http://50.190.164.37"
NEXT_PUBLIC_APP_URL="http://50.190.164.37"

# Server
NODE_ENV=production
PORT=3000
ENVEOF

# Also create .env.local for Next.js
cp "$APP_DIR/.env" "$APP_DIR/.env.local"

echo ".env file created"

# --- Step 10: Install Dependencies ---
step "Installing npm dependencies (this may take a few minutes)..."
cd "$APP_DIR"
npm install

# --- Step 11: Generate Prisma Client ---
step "Generating Prisma client..."
npx prisma generate

# --- Step 12: Run Database Migrations ---
step "Pushing database schema to PostgreSQL..."
npx prisma db push

# --- Step 13: Create the employee_companies join table (for multi-company feature) ---
step "Creating employee_companies join table..."
sudo -u postgres psql -d ${DB_NAME} -c "
CREATE TABLE IF NOT EXISTS employee_companies (
    id SERIAL PRIMARY KEY,
    \"employeeId\" INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    \"companyId\" INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    \"assignedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(\"employeeId\", \"companyId\")
);
CREATE INDEX IF NOT EXISTS idx_ec_employee ON employee_companies(\"employeeId\");
CREATE INDEX IF NOT EXISTS idx_ec_company ON employee_companies(\"companyId\");
" 2>/dev/null || warn "employee_companies table may already exist (OK)"

# --- Step 14: Seed initial data (optional) ---
step "Seeding initial data..."
npx prisma db seed 2>/dev/null || warn "Seeding skipped or already done"

# --- Step 15: Build the Next.js Application ---
step "Building the application (this takes 2-5 minutes)..."
npm run build

# --- Step 16: Start with PM2 ---
step "Starting application with PM2..."
pm2 delete 99tech-erp 2>/dev/null || true
pm2 start npm --name "99tech-erp" -- start
pm2 save

# Set PM2 to auto-start on reboot
pm2 startup systemd -u erp --hp /home/erp 2>/dev/null || warn "Run the pm2 startup command manually if needed"

# --- Step 17: Configure Nginx Reverse Proxy ---
step "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/99tech-erp > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name 50.190.164.37;

    # Increase max upload size for receipts/documents
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
NGINXEOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/99tech-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# --- Step 18: Open Firewall ---
step "Configuring firewall..."
sudo ufw allow 22/tcp 2>/dev/null || true
sudo ufw allow 80/tcp 2>/dev/null || true
sudo ufw allow 443/tcp 2>/dev/null || true
sudo ufw --force enable 2>/dev/null || warn "UFW not available, check firewall manually"

# --- Done! ---
echo ""
echo "=========================================="
echo -e "  ${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "  Your ERP is live at: http://50.190.164.37"
echo ""
echo "  Database: ${DB_NAME}"
echo "  DB User:  ${DB_USER}"
echo "  DB Pass:  ${DB_PASS}"
echo ""
echo "  PM2 Commands:"
echo "    pm2 status          - Check app status"
echo "    pm2 logs 99tech-erp - View app logs"
echo "    pm2 restart 99tech-erp - Restart the app"
echo ""
echo "  To update later:"
echo "    cd /home/erp/99tech-erp"
echo "    git pull origin main"
echo "    npm install"
echo "    npm run build"
echo "    pm2 restart 99tech-erp"
echo ""
echo -e "  ${YELLOW}IMPORTANT: Change your SSH password!${NC}"
echo "    Run: passwd"
echo "=========================================="
