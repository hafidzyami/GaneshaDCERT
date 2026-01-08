#!/bin/bash
# Script to get actual schema IDs from the database

echo "=== Fetching Schema IDs from Database ==="
echo ""
echo "Querying PostgreSQL for available schemas..."
echo ""

# Connect to database and get schema IDs
psql -h 192.168.55.114 -p 5432 -U postgres -c "SELECT id, version, name, issuer_did, \"isActive\" FROM \"VCSchema\" ORDER BY \"createdAt\" DESC LIMIT 10;"

echo ""
echo "Copy one or more schema IDs from above and update k6-tests/config/config.json"
echo ""
echo "Example:"
echo '{
  "testSchemas": [
    { "id": "your-real-schema-id-here", "version": 1 }
  ]
}'
