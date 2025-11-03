#!/bin/bash

# Backup script for Auftragsuhr MySQL database
set -e

DB_HOST=${DB_HOST:-mysql}
DB_USER=${DB_USER:-auftragsuhr_user}
DB_NAME=${DB_NAME:-auftragsuhr}
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/auftragsuhr_backup_$TIMESTAMP.sql"

echo "Starting database backup..."
echo "Timestamp: $TIMESTAMP"

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
until mysql -h $DB_HOST -u $DB_USER -p$MYSQL_PWD -e "SELECT 1" > /dev/null 2>&1; do
  echo "MySQL is not ready yet. Waiting..."
  sleep 5
done

echo "MySQL is ready. Creating backup..."

# Create backup
mysqldump -h $DB_HOST -u $DB_USER -p$MYSQL_PWD \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --add-drop-database \
  --databases $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    
    # Compress backup
    gzip $BACKUP_FILE
    echo "Backup compressed: $BACKUP_FILE.gz"
    
    # Clean old backups (keep last 30 days)
    find $BACKUP_DIR -name "auftragsuhr_backup_*.sql.gz" -mtime +30 -delete
    echo "Old backups cleaned up"
    
    echo "Backup completed successfully!"
else
    echo "Backup failed!"
    exit 1
fi1