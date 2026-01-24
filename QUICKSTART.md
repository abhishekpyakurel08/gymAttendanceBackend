# 🏋️ Shankmul Gym Attendance Backend - Quick Start

## ✅ Setup Complete!

Your gym attendance backend is now fully configured with **1-year JWT token expiration**.

---

## 📁 Project Structure

```
gymAttendanceBackend/
├── src/
│   ├── config/
│   │   └── database.ts              # MongoDB connection
│   ├── controllers/
│   │   ├── authController.ts        # Registration & Login (365d JWT)
│   │   ├── attendanceController.ts  # Clock in/out, Stats
│   │   └── leaveController.ts       # Leave management
│   ├── middleware/
│   │   └── auth.ts                  # JWT protection & role check
│   ├── models/
│   │   ├── User.ts                  # User schema
│   │   ├── Attendance.ts            # Attendance records
│   │   └── Leave.ts                 # Leave requests
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── attendanceRoutes.ts
│   │   └── leaveRoutes.ts
│   ├── utils/
│   │   └── generateToken.ts         # JWT generator (365d)
│   └── server.ts                    # Main app
├── dist/                            # Compiled JavaScript (built)
├── .env                             # Environment config
├── .env.example                     # Template
├── package.json
├── tsconfig.json
├── README.md                        # Full documentation
├── JWT_CONFIG.md                    # JWT deep dive
├── API_TESTING.md                   # API testing guide
└── setup.sh                         # Setup helper script
```

---

## 🚀 Quick Commands

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Test Health
```bash
curl http://localhost:5000/health
```

---

## 🔐 JWT Token Configuration

**Current Setting:** Tokens expire in **1 YEAR (365 days)**

### Setting Location
- **File:** `.env`
- **Variable:** `JWT_EXPIRE=365d`

### To Change
1. Edit `.env` file
2. Change `JWT_EXPIRE` to desired value
3. Restart server
4. New tokens will use new expiration

### Common Values
- `15m` - 15 minutes (high security)
- `1h` - 1 hour
- `24h` or `1d` - 1 day
- `7d` - 1 week
- `30d` - 1 month
- `365d` - 1 year (current)

📖 **Full guide:** See `JWT_CONFIG.md`

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account (returns 365d token)
- `POST /api/auth/login` - Login (returns 365d token)
- `GET /api/auth/me` - Current user info 🔒

### Attendance
- `POST /api/attendance/clock-in` - Clock in 🔒
- `PUT /api/attendance/clock-out` - Clock out 🔒
- `GET /api/attendance/today` - Today's status 🔒
- `GET /api/attendance/my-history` - History 🔒
- `GET /api/attendance/stats` - Statistics 🔒

### Leave Management
- `POST /api/leaves` - Apply for leave 🔒
- `GET /api/leaves/my-leaves` - My leaves 🔒
- `GET /api/leaves` - All leaves 🔒 (Admin/Manager)
- `PUT /api/leaves/:id` - Approve/Reject 🔒 (Admin/Manager)
- `DELETE /api/leaves/:id` - Cancel leave 🔒

🔒 = Requires JWT token in `Authorization: Bearer <token>` header

📖 **Full API docs:** See `API_TESTING.md`

---

## 🧪 Quick Test

### 1. Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "email": "test@gym.com",
    "password": "test123",
    "firstName": "Test",
    "lastName": "User",
    "department": "Engineering"
  }'
```

### 2. Save the Token
Copy the `token` from response and use it:
```bash
export TOKEN="paste_token_here"
```

### 3. Clock In
```bash
curl -X POST http://localhost:5000/api/attendance/clock-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 27.7172,
    "longitude": 85.3240,
    "address": "Kathmandu"
  }'
```

---

## 📊 Database

**MongoDB:**
- Database: `shankmul_gym_attendance`
- Collections: `users`, `attendances`, `leaves`

**Connection:**
- Local: `mongodb://localhost:27017/shankmul_gym_attendance`
- Atlas: Set `MONGODB_URI` in `.env`

**Status:** ✅ MongoDB is running

---

## ⚙️ Environment Variables

### Required
- `JWT_SECRET` - Secret key for JWT (CHANGE IN PRODUCTION!)
- `MONGODB_URI` - MongoDB connection string

### Optional
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `JWT_EXPIRE` - Token expiration (default: 365d)
- `ALLOWED_ORIGINS` - CORS origins
- `DEFAULT_TIMEZONE` - Timezone (default: Asia/Kathmandu)
- `OFFICE_START_TIME` - Office start (default: 09:00)
- `OFFICE_END_TIME` - Office end (default: 18:00)
- `LATE_THRESHOLD_MINUTES` - Late threshold (default: 15)

---

## 🔒 Security Checklist

### Development (Current)
- [x] JWT tokens configured (365d)
- [x] Password hashing (bcrypt)
- [x] Protected routes
- [x] Role-based access
- [x] CORS configured

### Production (TODO)
- [ ] Change `JWT_SECRET` to strong random value
- [ ] Use HTTPS/SSL
- [ ] Set `NODE_ENV=production`
- [ ] Enable MongoDB authentication
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Implement rate limiting
- [ ] Token blacklisting (optional)

---

## 📖 Documentation Files

1. **README.md** - Complete project documentation
2. **JWT_CONFIG.md** - Deep dive into JWT token configuration
3. **API_TESTING.md** - Full API testing guide with examples
4. **This file** - Quick reference

---

## 🎯 Key Features

✅ **1-Year JWT Tokens** - Users stay logged in for 365 days  
✅ **Location Tracking** - GPS coordinates for clock in/out  
✅ **Automatic Late Detection** - Based on office start time  
✅ **Leave Management** - Apply, approve, reject leaves  
✅ **Role-Based Access** - Admin, Manager, User roles  
✅ **Statistics & History** - Track attendance patterns  
✅ **TypeScript** - Type-safe codebase  
✅ **RESTful API** - Clean, consistent endpoints  

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB if needed
sudo systemctl start mongod
```

### JWT token errors
- Verify `JWT_SECRET` in `.env`
- Check token format: `Bearer <token>`
- Ensure token hasn't expired (check at jwt.io)

### CORS errors
- Add frontend URL to `ALLOWED_ORIGINS` in `.env`
- Example: `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173`

---

## 📞 Support

- Issues: Create a GitHub issue
- Documentation: See `README.md`, `JWT_CONFIG.md`, `API_TESTING.md`
- JWT Info: https://jwt.io

---

## 🎉 You're All Set!

Start the development server:
```bash
npm run dev
```

Server will run at: **http://localhost:5000**

Test with:
```bash
curl http://localhost:5000/health
```

**Happy coding! 🏋️‍♂️**
