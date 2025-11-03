#!/bin/bash
set -e

echo "🚀 Updating Auftragsuhr..."

# Backup vor Update erstellen
echo "📁 Creating backup..."
if docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u auftragsuhr_user -p${DB_PASSWORD} auftragsuhr > ./backups/pre_update_$(date +%Y%m%d_%H%M%S).sql; then
    echo "✅ Backup created successfully"
else
    echo "⚠️  Backup failed, continuing anyway..."
fi

# Code aktualisieren
echo "📦 Pulling latest code..."
git pull origin main

# Container neu starten
echo "🔄 Restarting containers..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Status prüfen
echo "🔍 Checking status..."
sleep 5
docker-compose -f docker-compose.prod.yml ps

echo "✅ Update completed!"
echo "🌐 App available at: http://auftragsuhr.vendorserver.de"
echo "📊 Health check: curl http://localhost:3001/api/health"
