#!/bin/bash
# ColdCopy Digital Ocean Droplet Setup Script

set -e

echo "🚀 Setting up ColdCopy API on Digital Ocean..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
echo "🐍 Installing Python 3.11..."
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Install system dependencies
echo "📚 Installing system dependencies..."
sudo apt install -y git nginx postgresql-client redis-server supervisor

# Install Node.js (for any build tools)
echo "📗 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Create app directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/coldcopy-api
sudo chown $USER:$USER /var/www/coldcopy-api

# Clone repository
echo "📥 Cloning repository..."
cd /var/www
git clone https://github.com/codevanmoose/coldcopy.git coldcopy-api
cd coldcopy-api/apps/api

# Create Python virtual environment
echo "🔧 Setting up Python environment..."
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
echo "🔐 Creating .env file..."
cat > .env << 'EOL'
# Add your environment variables here
DATABASE_URL=your_database_url
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_secret_key_here
ENVIRONMENT=production
DEBUG=False
EOL

echo "⚠️  Please edit /var/www/coldcopy-api/apps/api/.env with your actual values!"

# Setup Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/coldcopy-api << 'EOL'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOL

sudo ln -sf /etc/nginx/sites-available/coldcopy-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup Supervisor for process management
echo "👷 Setting up Supervisor..."
sudo tee /etc/supervisor/conf.d/coldcopy-api.conf << 'EOL'
[program:coldcopy-api]
command=/var/www/coldcopy-api/apps/api/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
directory=/var/www/coldcopy-api/apps/api
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/coldcopy-api.log
environment=PATH="/var/www/coldcopy-api/apps/api/venv/bin",PYTHONPATH="/var/www/coldcopy-api/apps/api"
EOL

# Create systemd service (alternative to supervisor)
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/coldcopy-api.service << 'EOL'
[Unit]
Description=ColdCopy API
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/var/www/coldcopy-api/apps/api
Environment="PATH=/var/www/coldcopy-api/apps/api/venv/bin"
ExecStart=/var/www/coldcopy-api/apps/api/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOL

# Set permissions
echo "🔒 Setting permissions..."
sudo chown -R www-data:www-data /var/www/coldcopy-api
sudo chmod -R 755 /var/www/coldcopy-api

# Enable and start services
echo "🚀 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable coldcopy-api
sudo systemctl start coldcopy-api
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Setup firewall
echo "🔥 Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Create update script
echo "📝 Creating update script..."
cat > /var/www/coldcopy-api/update.sh << 'EOL'
#!/bin/bash
cd /var/www/coldcopy-api
git pull
cd apps/api
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart coldcopy-api
EOL
chmod +x /var/www/coldcopy-api/update.sh

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit /var/www/coldcopy-api/apps/api/.env with your actual environment variables"
echo "2. Run 'sudo systemctl restart coldcopy-api' after updating .env"
echo "3. Check logs with 'sudo journalctl -u coldcopy-api -f'"
echo "4. Your API should be accessible at http://YOUR_DROPLET_IP"
echo ""
echo "🔄 To update the code later, run: /var/www/coldcopy-api/update.sh"