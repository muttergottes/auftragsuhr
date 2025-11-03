# Deployment Anleitung

## 1. Server Vorbereitung

```bash
# Docker installieren
sudo apt update
sudo apt install docker.io docker-compose nginx
sudo usermod -aG docker $USER
# Neu anmelden nach usermod

# Git installieren (falls nicht vorhanden)
sudo apt install git
```

## 2. Code auf Server klonen

```bash
# Repository klonen
cd /opt
sudo git clone https://github.com/muttergottes/auftragsuhr.git
sudo chown -R $USER:$USER auftragsuhr
cd auftragsuhr
```

## 3. Production Environment konfigurieren

```bash
# Environment-Datei erstellen
cp .env.production.example .env.production
nano .env.production
```

**Wichtig:** Sichere Passwörter verwenden!

## 4. Nginx konfigurieren

```bash
# Nginx Config kopieren
sudo cp nginx/auftragsuhr.conf /etc/nginx/sites-available/auftragsuhr
sudo ln -s /etc/nginx/sites-available/auftragsuhr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Application starten

```bash
# Container bauen und starten
docker-compose -f docker-compose.prod.yml up -d

# Status prüfen
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs
```

## 6. Testen

```bash
# Health Check
curl http://localhost:3001/api/health
curl http://auftragsuhr.vendorserver.de
```

## Updates

```bash
# Update-Script ausführen
./update.sh
```

## DNS/Hosts

Für VPN-Clients in `/etc/hosts` (Linux/Mac) oder `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
DEINE_SERVER_IP    auftragsuhr.vendorserver.de
```

## Backup

```bash
# Manuelles Backup
docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u auftragsuhr_user -p auftragsuhr > backup_$(date +%Y%m%d).sql
```

## Logs

```bash
# Application Logs
docker-compose -f docker-compose.prod.yml logs -f

# Nginx Logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```
