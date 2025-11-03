#!/bin/bash

# Restore script for Auftragsuhr MySQL database
set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Available backups:"
    ls -la /backups/auftragsuhr_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE=$1
DB_HOST=${DB_HOST:-mysql}
DB_USER=${DB_USER:-auftragsuhr_user}
DB_NAME=${DB_NAME:-auftragsuhr}

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Starting database restore..."
echo "Backup file: $BACKUP_FILE"

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
until mysql -h $DB_HOST -u $DB_USER -p$MYSQL_PWD -e "SELECT 1" > /dev/null 2>&1; do
  echo "MySQL is not ready yet. Waiting..."
  sleep 5
done

echo "MySQL is ready. Restoring backup..."

# Check if file is compressed
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "Decompressing and restoring..."
    gunzip -c $BACKUP_FILE | mysql -h $DB_HOST -u $DB_USER -p$MYSQL_PWD
else
    echo "Restoring uncompressed backup..."
    mysql -h $DB_HOST -u $DB_USER -p$MYSQL_PWD < $BACKUP_FILE
fi

if [ $? -eq 0 ]; then
    echo "Database restored successfully!"
else
    echo "Restore failed!"
    exit 1
fi