#!/bin/bash

# =============================================================================
# MongoDB Snapshot → Azure Cosmos DB Migration Script
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SNAPSHOT_DIR="./mongodb-prod-snapshot/restore-69484d1a1c7ba51e53d007ac"
DUMP_OUTPUT_DIR="./cosmos_migration_dump"
LOCAL_MONGO_PORT=27099
LOCAL_MONGO_PID=""

# Load environment variables from .env (handles special characters properly)
if [ -f .env ]; then
    # Read .env file line by line, handling spaces and special chars
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines and comments
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        # Only process lines with = sign
        if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$ ]]; then
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            # Remove surrounding quotes if present
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            export "$key=$value"
        fi
    done < .env
    echo -e "${GREEN}✓ Loaded .env file${NC}"
else
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

# Check for Cosmos DB connection string - check multiple possible variable names
# Common names: COSMOS_DB_URI, COSMOS_CONNECTION_STRING, COSMOSDB_URI, COMDB_URL, COSMOS_URL
COSMOS_URI="${COSMOS_DB_URI:-${COSMOS_CONNECTION_STRING:-${COSMOSDB_URI:-${COMDB_URL:-${COSMOS_URL:-${COSMOSDB_CONNECTION_STRING:-}}}}}}"

if [ -z "$COSMOS_URI" ]; then
    echo -e "${RED}✗ Cosmos DB connection string not found in .env${NC}"
    echo ""
    echo "Available options:"
    echo "1. Add one of these variables to your .env:"
    echo "   COSMOS_DB_URI=your-connection-string"
    echo ""
    echo "2. Or run with the connection string directly:"
    echo "   COSMOS_DB_URI='mongodb://...' ./migrate-to-cosmos.sh"
    echo ""
    echo "Your .env variables that look like connection strings:"
    grep -E "(COSMOS|MONGO|DB_URL|URI)" .env 2>/dev/null | sed 's/=.*/=***/' || echo "   (none found)"
    exit 1
fi

echo -e "${GREEN}✓ Found Cosmos DB connection string${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    if [ ! -z "$LOCAL_MONGO_PID" ] && kill -0 "$LOCAL_MONGO_PID" 2>/dev/null; then
        echo "Stopping local MongoDB instance (PID: $LOCAL_MONGO_PID)..."
        kill "$LOCAL_MONGO_PID" 2>/dev/null || true
        wait "$LOCAL_MONGO_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}Cleanup complete${NC}"
}

trap cleanup EXIT

# =============================================================================
# STEP 1: Start local MongoDB with snapshot data
# =============================================================================
echo ""
echo "=============================================="
echo "STEP 1: Starting local MongoDB with snapshot data"
echo "=============================================="

# Check if snapshot directory exists
if [ ! -d "$SNAPSHOT_DIR" ]; then
    echo -e "${RED}✗ Snapshot directory not found: $SNAPSHOT_DIR${NC}"
    exit 1
fi

# Check if something is already running on the port
if lsof -i :$LOCAL_MONGO_PORT > /dev/null 2>&1; then
    echo -e "${RED}✗ Port $LOCAL_MONGO_PORT is already in use${NC}"
    echo "Please stop any service using this port or change LOCAL_MONGO_PORT"
    exit 1
fi

echo "Starting MongoDB on port $LOCAL_MONGO_PORT..."
echo "Using data directory: $SNAPSHOT_DIR"

# Start mongod with the snapshot data
mongod --dbpath "$SNAPSHOT_DIR" --port $LOCAL_MONGO_PORT --bind_ip 127.0.0.1 --logpath ./mongodb_migration.log &
LOCAL_MONGO_PID=$!

echo "Waiting for MongoDB to start (PID: $LOCAL_MONGO_PID)..."
sleep 5

# Verify MongoDB is running
if ! mongosh --port $LOCAL_MONGO_PORT --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to start MongoDB. Check mongodb_migration.log${NC}"
    cat ./mongodb_migration.log | tail -20
    exit 1
fi

echo -e "${GREEN}✓ Local MongoDB is running${NC}"

# List databases
echo ""
echo "Databases found in snapshot:"
mongosh --port $LOCAL_MONGO_PORT --eval "db.adminCommand('listDatabases').databases.forEach(d => print('  - ' + d.name))" --quiet

# =============================================================================
# STEP 2: Create mongodump from local MongoDB
# =============================================================================
echo ""
echo "=============================================="
echo "STEP 2: Creating mongodump from snapshot data"
echo "=============================================="

# Remove old dump if exists
rm -rf "$DUMP_OUTPUT_DIR"
mkdir -p "$DUMP_OUTPUT_DIR"

echo "Running mongodump..."
mongodump \
    --host 127.0.0.1 \
    --port $LOCAL_MONGO_PORT \
    --out "$DUMP_OUTPUT_DIR" \
    --gzip

echo -e "${GREEN}✓ Mongodump complete${NC}"
echo "Dump location: $DUMP_OUTPUT_DIR"

# Show what was dumped
echo ""
echo "Dumped databases:"
ls -la "$DUMP_OUTPUT_DIR"

# =============================================================================
# STEP 3: Restore to Cosmos DB
# =============================================================================
echo ""
echo "=============================================="
echo "STEP 3: Restoring to Azure Cosmos DB"
echo "=============================================="

echo -e "${YELLOW}⚠ Important Cosmos DB considerations:${NC}"
echo "  - Max document size: 2MB"
echo "  - Some aggregation stages may not be supported"
echo "  - TTL indexes behave differently"
echo "  - Ensure RU/s are scaled up for import"
echo ""

read -p "Continue with restore to Cosmos DB? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled. Dump is available at: $DUMP_OUTPUT_DIR"
    exit 0
fi

echo "Running mongorestore to Cosmos DB..."
echo "(This may take a while depending on data size)"

# Mongorestore to Cosmos DB
# Note: We exclude admin, local, and config databases
mongorestore \
    --uri "$COSMOS_URI" \
    --gzip \
    --nsExclude "admin.*" \
    --nsExclude "local.*" \
    --nsExclude "config.*" \
    --numInsertionWorkersPerCollection=4 \
    "$DUMP_OUTPUT_DIR"

echo ""
echo -e "${GREEN}✓ Migration complete!${NC}"

# =============================================================================
# STEP 4: Validation hints
# =============================================================================
echo ""
echo "=============================================="
echo "STEP 4: Post-migration validation"
echo "=============================================="
echo ""
echo "Please verify the following manually:"
echo ""
echo "1. Document counts - run this against Cosmos DB:"
echo "   db.collection.countDocuments()"
echo ""
echo "2. Check for index compatibility - Cosmos indexes may need recreation"
echo ""
echo "3. Test your application with the new Cosmos DB connection"
echo ""
echo "4. Check for large documents (>2MB may have failed)"
echo ""
echo -e "${GREEN}Migration script completed successfully!${NC}"

