# Auftragsuhr - Zeiterfassungssystem

Werkstatt-Zeiterfassungssystem mit Anwesenheit, Aufträgen und Pausen.

## Features
- ✅ Mitarbeiter Ein-/Ausstempeln
- ✅ Auftragszeiterfassung
- ✅ Pausenverwaltung
- ✅ Statistiken und Reports
- ✅ Edit/Delete Funktionen
- ✅ Auto-Refresh

## Deployment

### Server Setup
```bash
git clone https://github.com/muttergottes/auftragsuhr.git
cd auftragsuhr
cp docker-compose.yml docker-compose.prod.yml
# .env.production mit sicheren Werten erstellen
docker-compose -f docker-compose.prod.yml up -d
```

### Domain
- Intern: http://auftragsuhr.vendorserver.de
- Zugang über VPN/internes Netzwerk

### Updates
```bash
./update.sh
```

## Entwicklung
```bash
docker-compose up -d
# Lokal verfügbar unter http://localhost
```
