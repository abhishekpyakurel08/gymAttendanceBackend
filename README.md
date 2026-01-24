# Shankmul Gym Attendance System - Backend

A comprehensive attendance management system backend built with TypeScript, Express, MongoDB, and Node.js.

## Features

- ✅ User Authentication (JWT with **1-year token expiration**)
- ✅ Clock In/Out with Location Tracking
- ✅ Attendance History & Statistics
- ✅ Role-based Access Control (Admin, Manager, User)
- ✅ Automatic Late Detection
- ✅ RESTful API Design

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens) - **365 days expiration**
- **Password Hashing:** bcryptjs

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## Installation

1. **Clone the repository**
```bash
cd /home/socialworker/gym-app/gymAttendanceBackend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Then edit the `.env` file:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/shankmul_gym_attendance
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/shankmul_gym_attendance

# JWT Configuration - 1 YEAR EXPIRATION
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRE=365d

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

DEFAULT_TIMEZONE=Asia/Kathmandu
OFFICE_START_TIME=09:00
OFFICE_END_TIME=18:00
LATE_THRESHOLD_MINUTES=15
```

**Important:** The `JWT_EXPIRE` is set to `365d` for **1 year token expiration**.

4. **Build TypeScript**
```bash
npm run build
```

5. **Run Development Server**
```bash
npm run dev
```

6. **Run Production Server**
```bash
npm start
```

## JWT Token Configuration

### Understanding JWT_EXPIRE

The JWT token expiration is controlled by the `JWT_EXPIRE` environment variable:

- **Current Setting:** `365d` (1 year)
- **Format:** Uses time format from the `jsonwebtoken` library
  - `s` = seconds
  - `m` = minutes
  - `h` = hours
  - `d` = days

### Available Options

```env
# 1 hour
JWT_EXPIRE=1h

# 24 hours (1 day)
JWT_EXPIRE=24h

# 7 days (1 week)
JWT_EXPIRE=7d

# 30 days (1 month)
JWT_EXPIRE=30d

# 365 days (1 year) - CURRENT SETTING
JWT_EXPIRE=365d
```

### Security Considerations

**1 Year Token Expiration:**
- ✅ **Pros:** Better user experience - users don't need to login frequently
- ⚠️ **Cons:** If a token is compromised, it remains valid for 1 year
- 💡 **Recommendation:** Implement token refresh mechanism or use shorter expiration with refresh tokens

**Best Practices:**
- Keep `JWT_SECRET` secure and complex
- Use HTTPS in production
- Implement token blacklisting for logout
- Consider implementing refresh tokens for better security

## Project Structure

```
src/
├── config/
│   └── database.ts          # MongoDB connection
├── controllers/
│   ├── authController.ts    # Authentication logic (1-year JWT)
│   └── attendanceController.ts  # Attendance operations
├── middleware/
│   └── auth.ts              # JWT authentication middleware
├── models/
│   ├── User.ts              # User schema
│   └── Attendance.ts        # Attendance schema
├── routes/
│   ├── authRoutes.ts        # Auth endpoints
│   └── attendanceRoutes.ts  # Attendance endpoints
├── utils/
│   └── generateToken.ts     # JWT token generator (365d expiration)
└── server.ts                # Main application file
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (returns 1-year token)
- `POST /api/auth/login` - Login user (returns 1-year token)
- `GET /api/auth/me` - Get current user (Protected)

### Attendance
- `POST /api/attendance/clock-in` - Clock in (Protected)
- `PUT /api/attendance/clock-out` - Clock out (Protected)
- `GET /api/attendance/my-history` - Get attendance history (Protected)
- `GET /api/attendance/today` - Get today's status (Protected)
- `GET /api/attendance/stats` - Get attendance statistics (Protected)



## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "email": "user@shankmulgym.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering"
  }'
```

**Response:** Returns a JWT token valid for 1 year.

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@shankmulgym.com",
    "password": "password123"
  }'
```

**Response:** Returns a JWT token valid for 1 year.

### Clock In
```bash
curl -X POST http://localhost:5000/api/attendance/clock-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Kathmandu, Nepal"
  }'
```

### Clock Out
```bash
curl -X PUT http://localhost:5000/api/attendance/clock-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Kathmandu, Nepal"
  }'
```



## Database Models

### User
- employeeId (unique)
- email (unique)
- password (hashed)
- firstName, lastName
- department
- role (admin, manager, user)
- isActive

### Attendance
- userId (reference to User)
- date
- clockIn, clockOut
- status (on-time, late, absent, half-day)
- location (latitude, longitude, address)
- totalHours



## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT-based authentication with **1-year expiration**
- Role-based access control
- Protected routes with middleware
- Input validation
- CORS protection

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (setup required)

### MongoDB Connection

**Local MongoDB:**
```
mongodb://localhost:27017/shankmul_gym_attendance
```

**MongoDB Atlas:**
```
mongodb+srv://username:password@cluster.mongodb.net/shankmul_gym_attendance
```

## Deployment

1. Set environment variables in production
2. **IMPORTANT:** Change `JWT_SECRET` to a strong, random value
3. Build the TypeScript code: `npm run build`
4. Start the server: `npm start`
5. Configure reverse proxy (nginx/Apache) if needed
6. Set up SSL certificate for HTTPS
7. Enable MongoDB authentication
8. Set up monitoring and logging

## Testing

Test the server is running:
```bash
curl http://localhost:5000/health
```

Test root endpoint:
```bash
curl http://localhost:5000/
```

## Troubleshooting

**MongoDB Connection Issues:**
- Check if MongoDB is running: `sudo systemctl status mongod`
- Verify connection string in .env
- Check network/firewall settings for Atlas

**JWT Token Errors:**
- Ensure JWT_SECRET is set in .env
- Check token expiration (currently 365 days)
- Verify Authorization header format: `Bearer <token>`

**CORS Errors:**
- Add frontend URL to ALLOWED_ORIGINS in .env
- Check CORS middleware configuration

## License

MIT

## Support

For issues and questions, please create an issue in the repository.

---

**Note:** The JWT tokens are configured to expire in **1 year (365 days)**. Consider implementing a token refresh mechanism for production use.
