#!/bin/bash
# Auto-sync script - runs every 30 minutes

cd /app/backend

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Starting sync..."
    
    python3 sync_all.py >> /var/log/sync.log 2>&1
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Sync completed. Next run in 30 minutes."
    echo "---" >> /var/log/sync.log
    
    # Wait 30 minutes
    sleep 1800
done
