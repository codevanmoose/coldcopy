#!/bin/bash

# Generate Secrets Script for ColdCopy
# This script generates secure random secrets for environment variables

echo "🔐 ColdCopy Secret Generation Script"
echo "===================================="
echo ""
echo "This script will generate secure random secrets for your environment variables."
echo "Copy these values to your Vercel dashboard or .env file."
echo ""

# Function to generate a random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate a hex string
generate_hex() {
    openssl rand -hex 32
}

echo "🔑 Authentication Secrets:"
echo "-------------------------"
echo "NEXTAUTH_SECRET=$(generate_secret)"
echo "JWT_SECRET=$(generate_secret)"
echo "ENCRYPTION_KEY=$(generate_hex)"
echo ""

echo "🔑 Webhook Secrets:"
echo "------------------"
echo "WEBHOOK_SECRET=$(generate_secret)"
echo "SES_WEBHOOK_SECRET=$(generate_secret)"
echo "CRON_SECRET=$(generate_secret)"
echo ""

echo "📝 Notes:"
echo "---------"
echo "1. Copy these values to your Vercel Environment Variables"
echo "2. For Stripe webhook secret, get it from: https://dashboard.stripe.com/webhooks"
echo "3. For API keys (OpenAI, Anthropic, etc.), get them from their respective dashboards"
echo "4. Never commit these secrets to Git!"
echo ""

echo "🔒 Security Reminders:"
echo "--------------------"
echo "- Rotate these secrets every 90 days"
echo "- Use different secrets for staging and production"
echo "- Store a secure backup in a password manager"
echo "- Enable 2FA on all service accounts"