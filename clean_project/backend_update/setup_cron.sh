#!/bin/bash
# Setup cron jobs for RentalHub auto-sync

echo "🔧 Setting up cron jobs for RentalHub..."

# Create log directory
mkdir -p /var/log/rentalhub

# Add cron jobs
(crontab -l 2>/dev/null || echo "") | grep -v "sync_all.py" | grep -v "sync_product_attributes.py" > /tmp/mycron

# Sync all data every 30 minutes
echo "*/30 * * * * cd /app/backend && /usr/bin/python3 sync_all.py >> /var/log/rentalhub/sync_all.log 2>&1" >> /tmp/mycron

# Sync product attributes daily at 2 AM
echo "0 2 * * * cd /app/backend && /usr/bin/python3 sync_product_attributes.py >> /var/log/rentalhub/sync_attributes.log 2>&1" >> /tmp/mycron

# Install new cron file
crontab /tmp/mycron
rm /tmp/mycron

echo "✅ Cron jobs installed:"
crontab -l | grep -E "sync_all|sync_product"

echo ""
echo "📋 Logs will be in:"
echo "  - /var/log/rentalhub/sync_all.log"
echo "  - /var/log/rentalhub/sync_attributes.log"
echo ""
echo "🔍 To check sync status:"
echo "  tail -f /var/log/rentalhub/sync_all.log"
