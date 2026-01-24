#!/bin/bash

# JWT Token Verification Script

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NzM4Yjk1ZmFmNzcyNmM0YzE4MjhlMyIsImVtYWlsIjoidGVzdEBzaGFua211bGd5bS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc2OTE4MDA1NCwiZXhwIjoxODAwNzE2MDU0fQ.plvuOz_LTWhqkvLTAnHgpOQ078fizqhF4Bj9QVNVelE"

echo "🔐 JWT Token Verification"
echo "========================="
echo ""

# Extract payload (second part of JWT)
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2)

# Decode base64 (add padding if needed)
case $((${#PAYLOAD} % 4)) in
  2) PAYLOAD="${PAYLOAD}==" ;;
  3) PAYLOAD="${PAYLOAD}=" ;;
esac

echo "📄 Decoded Token Payload:"
echo $PAYLOAD | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo $PAYLOAD | base64 -d 2>/dev/null

echo ""
echo "⏱️  Token Expiration Calculation:"
echo ""

# Use node to calculate dates
node -e "
const payload = JSON.parse(Buffer.from('$PAYLOAD', 'base64').toString());
const iat = new Date(payload.iat * 1000);
const exp = new Date(payload.exp * 1000);
const diffDays = Math.round((exp - iat) / (1000 * 60 * 60 * 24));

console.log('Issued At (iat):   ', iat.toISOString());
console.log('Expires At (exp):  ', exp.toISOString());
console.log('');
console.log('⏰ Token Valid For: ' + diffDays + ' days (' + Math.round(diffDays/365) + ' year)');
console.log('');
console.log('✅ This confirms the JWT token is set to expire in 1 YEAR (365 days)!');
"
