#!/bin/bash

# Backend Verification and Test Script
# Tests all API endpoints and verifies backend functionality

API_URL="http://localhost:5000"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Backend API Verification Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    local description=$5
    
    echo -e "${BLUE}Testing:${NC} $description"
    
    if [ -n "$token" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data")
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo -e "${GREEN}✓ Success${NC} (HTTP $HTTP_CODE)"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
        echo ""
        return 0
    else
        echo -e "${RED}✗ Failed${NC} (HTTP $HTTP_CODE)"
        echo "$BODY"
        echo ""
        return 1
    fi
}

# Step 1: Check if server is running
echo -e "${BLUE}Step 1: Checking Server Health...${NC}"
HEALTH=$(curl -s "$API_URL/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server is running${NC}"
    echo "$HEALTH" | jq '.'
    echo ""
else
    echo -e "${RED}✗ Server is not responding${NC}"
    echo -e "${YELLOW}Please start the backend server:${NC}"
    echo "  cd /home/socialworker/gym-app/gymAttendanceBackend"
    echo "  npm run dev"
    exit 1
fi

# Step 2: Test Registration
echo -e "${BLUE}Step 2: Testing User Registration...${NC}"
REGISTER_DATA='{
    "employeeId": "GYM-999",
    "email": "gymuser@shankmulgym.com",
    "password": "gymuser123",
    "firstName": "Gym",
    "lastName": "User",
    "role": "user",
    "department": "Operations"
}'

test_endpoint "POST" "/api/auth/register" "$REGISTER_DATA" "" "Register new user"
sleep 1

# Step 3: Test Login
echo -e "${BLUE}Step 3: Testing User Login...${NC}"
LOGIN_DATA='{
    "email": "gymuser@shankmulgym.com",
    "password": "gymuser123"
}'

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_DATA")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token' 2>/dev/null)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "Token: ${TOKEN:0:50}..."
    echo ""
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "$LOGIN_RESPONSE"
    echo ""
    TOKEN=""
fi

# Step 4: Test Get Current User
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}Step 4: Testing Get Current User...${NC}"
    test_endpoint "GET" "/api/auth/me" "" "$TOKEN" "Get authenticated user"
fi

# Step 5: Test Clock In
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}Step 5: Testing Clock In...${NC}"
    CLOCK_IN_DATA='{
        "latitude": 27.7172,
        "longitude": 85.3240,
        "address": "Kathmandu, Nepal"
    }'
    
    test_endpoint "POST" "/api/attendance/clock-in" "$CLOCK_IN_DATA" "$TOKEN" "Clock in"
    sleep 1
fi

# Step 6: Test Get Today's Attendance
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}Step 6: Testing Get Today's Attendance...${NC}"
    test_endpoint "GET" "/api/attendance/today" "" "$TOKEN" "Get today's attendance"
fi

# Step 7: Test Get Attendance History
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}Step 7: Testing Get Attendance History...${NC}"
    test_endpoint "GET" "/api/attendance/my-history" "" "$TOKEN" "Get attendance history"
fi

# Step 8: Test Get Attendance Stats
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}Step 8: Testing Get Attendance Stats...${NC}"
    test_endpoint "GET" "/api/attendance/stats" "" "$TOKEN" "Get attendance statistics"
fi

# Step 9: Test Clock Out
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}Step 9: Testing Clock Out...${NC}"
    CLOCK_OUT_DATA='{
        "latitude": 27.7172,
        "longitude": 85.3240,
        "address": "Kathmandu, Nepal"
    }'
    
    test_endpoint "PUT" "/api/attendance/clock-out" "$CLOCK_OUT_DATA" "$TOKEN" "Clock out"
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Backend Verification Complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Test User Credentials:${NC}"
echo "  Email: gymuser@shankmulgym.com"
echo "  Password: gymuser123"
echo ""

echo -e "${YELLOW}Note:${NC} You can use these credentials to test the mobile app."
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start the mobile app"
echo "  2. Login with test credentials"
echo "  3. Test clock in/out functionality"
echo "  4. Verify data persistence"
