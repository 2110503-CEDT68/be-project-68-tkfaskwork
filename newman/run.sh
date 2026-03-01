#!/bin/bash
# CoWork Space API - Newman Test Runner
BASE_URL=${BASE_URL:-"http://localhost:5000/api/v1"}

# Try to clean via mongosh if available
mongosh coworkspace --quiet --eval "
  db.users.deleteMany({ email: { \$regex: /@newman-test\.com/ } });
  db.coworkingspaces.deleteMany({ name: 'Test Space Newman' });
" 2>/dev/null

echo "Seeding users..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Newman User","tel":"0811111111","email":"user@newman-test.com","password":"password123"}' > /dev/null

curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","tel":"0822222222","email":"admin@newman-test.com","password":"admin123","role":"admin"}' > /dev/null

echo "Running Newman..."
echo "================="

npx newman run newman/collection.json \
  --env-var "baseUrl=$BASE_URL" \
  --reporters cli \
  --delay-request 200

EXIT_CODE=$?
echo ""
[ $EXIT_CODE -eq 0 ] && echo "✓ All tests passed!" || echo "✗ Tests failed (exit $EXIT_CODE)"
exit $EXIT_CODE
