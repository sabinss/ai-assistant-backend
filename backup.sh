#!/usr/bin/env bash
# Define variables
SRC_URI="mongodb+srv://sushilb:NUnf0wssOJsYHkwl@cowrkrprod.2bpix.mongodb.net"
SRC_USER="sushilb"
SRC_PASS="NUnf0wssOJsYHkwl"
SRC_DB="whodl"
DUMP_FILE="/tmp/${SRC_DB}_backup.gz"

# Dump command
mongodump \
  --uri="$SRC_URI" \
  --username="$SRC_USER" \
  --password="$SRC_PASS" \
  --authenticationDatabase admin \
  --db="$SRC_DB" \
  --archive="$DUMP_FILE" \
  --gzip


