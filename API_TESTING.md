# API Testing Guide - Shankmul Gym Attendance Backend

## Base URL
```
http://localhost:5000
```

## Important Note on JWT Expiration
**All JWT tokens are valid for 1 YEAR (365 days)** after login/registration.

---

## 1. Authentication Endpoints

### 1.1 Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "email": "john.doe@shankmulgym.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering",
    "role": "user"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "employeeId": "EMP-001",
      "email": "john.doe@shankmulgym.com",
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Valid for 365 days
  }
}
```

### 1.2 Login User
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@shankmulgym.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "employeeId": "EMP-001",
      "email": "john.doe@shankmulgym.com",
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Valid for 365 days
  }
}
```

### 1.3 Get Current User (Protected)
```bash
export TOKEN="your_jwt_token_here"

curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 2. Attendance Endpoints

### 2.1 Clock In
```bash
curl -X POST http://localhost:5000/api/attendance/clock-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Kathmandu, Nepal"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "...",
    "date": "2026-01-23T00:00:00.000Z",
    "clockIn": "2026-01-23T08:45:00.000Z",
    "status": "on-time",
    "location": {
      "latitude": 27.7172,
      "longitude": 85.3240,
      "address": "Kathmandu, Nepal"
    }
  }
}
```

### 2.2 Clock Out
```bash
curl -X PUT http://localhost:5000/api/attendance/clock-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Kathmandu, Nepal"
  }'
```

### 2.3 Get Today's Status
```bash
curl -X GET http://localhost:5000/api/attendance/today \
  -H "Authorization: Bearer $TOKEN"
```

### 2.4 Get Attendance History
```bash
# Get all history
curl -X GET "http://localhost:5000/api/attendance/my-history" \
  -H "Authorization: Bearer $TOKEN"

# With pagination
curl -X GET "http://localhost:5000/api/attendance/my-history?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# With date range
curl -X GET "http://localhost:5000/api/attendance/my-history?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

### 2.5 Get Attendance Statistics
```bash
# Get all-time stats
curl -X GET "http://localhost:5000/api/attendance/stats" \
  -H "Authorization: Bearer $TOKEN"

# With date range
curl -X GET "http://localhost:5000/api/attendance/stats?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "on-time": 15,
    "late": 3,
    "absent": 0,
    "half-day": 1,
    "total": 19
  }
}
```

---

## 3. Leave Management Endpoints

### 3.1 Apply for Leave
```bash
curl -X POST http://localhost:5000/api/leaves \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "leaveType": "casual",
    "startDate": "2026-01-25",
    "endDate": "2026-01-27",
    "reason": "Personal work"
  }'
```

**Leave Types:** `sick`, `casual`, `annual`, `emergency`

### 3.2 Get My Leaves
```bash
# Get all my leaves
curl -X GET "http://localhost:5000/api/leaves/my-leaves" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "http://localhost:5000/api/leaves/my-leaves?status=pending" \
  -H "Authorization: Bearer $TOKEN"

# With pagination
curl -X GET "http://localhost:5000/api/leaves/my-leaves?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Status Values:** `pending`, `approved`, `rejected`

### 3.3 Get All Leaves (Admin/Manager Only)
```bash
curl -X GET "http://localhost:5000/api/leaves" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3.4 Approve/Reject Leave (Admin/Manager Only)
```bash
# Approve leave
curl -X PUT http://localhost:5000/api/leaves/{leave_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "status": "approved"
  }'

# Reject leave
curl -X PUT http://localhost:5000/api/leaves/{leave_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "status": "rejected",
    "rejectionReason": "Insufficient leave balance"
  }'
```

### 3.5 Cancel Leave
```bash
curl -X DELETE http://localhost:5000/api/leaves/{leave_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Complete Testing Flow

### Step 1: Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-TEST-001",
    "email": "test@shankmulgym.com",
    "password": "test123",
    "firstName": "Test",
    "lastName": "User",
    "department": "Engineering"
  }' | jq '.'
```

### Step 2: Save the Token
```bash
# Extract and save token from the response
export TOKEN="paste_your_token_here"
```

### Step 3: Test Clock In
```bash
curl -X POST http://localhost:5000/api/attendance/clock-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Shankmul Gym, Kathmandu"
  }' | jq '.'
```

### Step 4: Check Today's Status
```bash
curl -X GET http://localhost:5000/api/attendance/today \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Step 5: Clock Out
```bash
curl -X PUT http://localhost:5000/api/attendance/clock-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Shankmul Gym, Kathmandu"
  }' | jq '.'
```

### Step 6: Apply for Leave
```bash
curl -X POST http://localhost:5000/api/leaves \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "leaveType": "casual",
    "startDate": "2026-02-01",
    "endDate": "2026-02-03",
    "reason": "Family function"
  }' | jq '.'
```

### Step 7: View Statistics
```bash
curl -X GET "http://localhost:5000/api/attendance/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## 5. Testing with Different Roles

### Create Admin User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-ADMIN-001",
    "email": "admin@shankmulgym.com",
    "password": "admin123",
    "firstName": "Admin",
    "lastName": "User",
    "department": "Management",
    "role": "admin"
  }' | jq '.'
```

### Create Manager User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-MGR-001",
    "email": "manager@shankmulgym.com",
    "password": "manager123",
    "firstName": "Manager",
    "lastName": "User",
    "department": "Operations",
    "role": "manager"
  }' | jq '.'
```

---

## 6. Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "You have already clocked in today"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "User role 'user' is not authorized to access this route"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Route not found"
}
```

---

## 7. JWT Token Information

- **Expiration:** 365 days (1 year)
- **Format:** `Bearer <token>`
- **Header:** `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Token Contents (Payload):
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "role": "user",
  "iat": 1706025600,
  "exp": 1737561600  // 365 days later
}
```

---

## 8. Health Check

```bash
curl http://localhost:5000/health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-01-23T14:30:00.000Z"
}
```

---

## Notes

1. **All timestamps are in UTC**
2. **Timezone is configurable via `DEFAULT_TIMEZONE` in .env** (default: Asia/Kathmandu)
3. **Office hours are configurable** via `OFFICE_START_TIME` and `OFFICE_END_TIME`
4. **Late threshold is configurable** via `LATE_THRESHOLD_MINUTES` (default: 15 minutes)
5. **JWT tokens are valid for 1 YEAR** - consider implementing token refresh for production

---

## Troubleshooting

### "Token is invalid or expired"
- Check if the token is properly formatted
- Verify the token hasn't been tampered with
- Ensure `JWT_SECRET` matches between token generation and verification

### "Not authorized to access this route"
- Verify the `Authorization` header is present
- Check the token format: `Bearer <token>`
- Ensure the user role has permission for the endpoint

### "Location coordinates are required"
- Ensure `latitude` and `longitude` are included in the request body
- Values should be numbers, not strings
