#!/usr/bin/env bash

# Backup script for NEW MongoDB cluster
# Cluster: cluster0.ebr38wn.mongodb.net

# Database connection details
# MONGODB_URI=mongodb+srv://sabinshrestha292:9akqGKXBqSu39GoJ@cluster0.tbw8mxu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

DB_URI="mongodb+srv://sabinshrestha292:9akqGKXBqSu39GoJ@cluster0.tbw8mxu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_USER="sabinshrestha292"
DB_PASS="9akqGKXBqSu39GoJ"
DB_NAME="AIChatbot"  # Database name from connection string
AUTH_DB="admin"

# Backup file details
BACKUP_DIR="./new_cluster_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "🚀 Starting backup from NEW cluster..."
echo "📊 Database: $DB_NAME"
echo "🔗 Cluster: cluster0.5eykngz.mongodb.net"
echo "📁 Backup will be saved to: $DUMP_FILE"
echo ""

# Test connection by trying to list databases (using mongodump --listDatabases)
echo "🔍 Testing connection to new cluster..."
mongodump --uri="$DB_URI" --listDatabases --quiet > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Connection successful! Starting backup..."
else
    echo "⚠️  Connection test failed, but continuing with backup..."
    echo "   (This might be due to permissions - backup will fail if credentials are wrong)"
fi

# Perform the backup
mongodump \
  --uri="$DB_URI" \
  --username="$DB_USER" \
  --password="$DB_PASS" \
  --authenticationDatabase="$AUTH_DB" \
  --db="$DB_NAME" \
  --archive="$DUMP_FILE" \
  --gzip

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Backup completed successfully!"
    echo "📁 Backup file: $DUMP_FILE"
    echo "📊 File size: $(du -h "$DUMP_FILE" | cut -f1)"
    echo "🕒 Timestamp: $TIMESTAMP"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Keep only last 5 backups
echo ""
echo "🧹 Cleaning up old backups (keeping last 5)..."
cd "$BACKUP_DIR"
ls -t ${DB_NAME}_backup_*.gz | tail -n +6 | xargs -r rm -f
echo "✅ Cleanup completed!" 