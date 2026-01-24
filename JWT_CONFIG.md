# JWT Token Configuration - 1 Year Expiration

## Overview

Your **Shankmul Gym Attendance Backend** is configured with JWT tokens that expire in **1 YEAR (365 days)**. This document explains the configuration, benefits, security considerations, and how to modify it if needed.

---

## Current Configuration

### Environment Variable
```env
JWT_EXPIRE=365d
```

This is set in your `.env` file and means tokens will be valid for **365 days** from the moment they are issued.

### Where It's Used

1. **Token Generation** (`src/utils/generateToken.ts`):
   ```typescript
   const generateToken = (payload: TokenPayload): string => {
     const secret = process.env.JWT_SECRET || 'default_secret_key';
     
     return jwt.sign(payload, secret, { 
       expiresIn: process.env.JWT_EXPIRE || '365d' 
     } as any);
   };
   ```

2. **User Registration** (`src/controllers/authController.ts` - register function):
   - When a user registers, they receive a token valid for 1 year

3. **User Login** (`src/controllers/authController.ts` - login function):
   - When a user logs in, they receive a token valid for 1 year

---

## Benefits of 1-Year Expiration

### ✅ User Experience
- Users don't need to log in frequently
- Perfect for gym members who use the app regularly
- Reduces friction in the user experience
- Mobile apps can stay logged in for extended periods

### ✅ Mobile App Friendly
- Ideal for mobile applications where constant re-authentication is inconvenient
- Users can use the app seamlessly for a full year
- No interruption in workout tracking or attendance logging

### ✅ Reduced Server Load
- Fewer login requests to the server
- Less database queries for authentication
- Lower bandwidth usage

---

## Security Considerations

### ⚠️ Risks

1. **Token Compromise**: If a token is stolen, it remains valid for 1 year
2. **No Remote Revocation**: Logging out only removes the token from the client
3. **Stale User Data**: User role/permission changes won't be reflected until token expires

### 🔒 Mitigation Strategies

#### 1. Keep JWT_SECRET Secure
```env
# Use a strong, random secret (minimum 32 characters)
JWT_SECRET=your_very_long_and_random_secret_key_here_at_least_32_chars
```

Generate a strong secret:
```bash
# Generate a random 64-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 2. Use HTTPS in Production
- Always serve the API over HTTPS
- Prevents token interception during transmission
- Use SSL/TLS certificates (Let's Encrypt is free)

#### 3. Implement Token Blacklisting (Optional)
Create a blacklist collection in MongoDB to track invalidated tokens:

```typescript
// models/TokenBlacklist.ts
interface ITokenBlacklist {
  token: string;
  userId: string;
  expiredAt: Date;
}

// On logout, add token to blacklist
await TokenBlacklist.create({
  token: req.headers.authorization?.split(' ')[1],
  userId: req.user.id,
  expiredAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
});

// In auth middleware, check blacklist
const isBlacklisted = await TokenBlacklist.findOne({ token });
if (isBlacklisted) {
  return res.status(401).json({ message: 'Token has been revoked' });
}
```

#### 4. Implement Refresh Tokens (Advanced)
Use short-lived access tokens (15 minutes) + long-lived refresh tokens (1 year):

```env
JWT_EXPIRE=15m           # Access token - 15 minutes
REFRESH_TOKEN_EXPIRE=365d # Refresh token - 1 year
```

---

## Alternative Expiration Options

### Short-term Options

#### 1 Hour
```env
JWT_EXPIRE=1h
```
- **Use Case:** High-security applications
- **User Impact:** Must login every hour (poor UX for gym apps)

#### 1 Day
```env
JWT_EXPIRE=24h
# or
JWT_EXPIRE=1d
```
- **Use Case:** Moderate security requirements
- **User Impact:** Daily login required

#### 1 Week
```env
JWT_EXPIRE=7d
```
- **Use Case:** Balance between security and UX
- **User Impact:** Weekly login required

### Medium-term Options

#### 1 Month
```env
JWT_EXPIRE=30d
```
- **Use Case:** Good balance for most applications
- **User Impact:** Monthly login required

#### 3 Months
```env
JWT_EXPIRE=90d
```
- **Use Case:** Seasonal apps, quarterly updates
- **User Impact:** Quarterly login required

### Long-term Options

#### 6 Months
```env
JWT_EXPIRE=180d
```
- **Use Case:** Low-security requirements, better UX
- **User Impact:** Semi-annual login required

#### 1 Year (Current Setting)
```env
JWT_EXPIRE=365d
```
- **Use Case:** Mobile apps, gym attendance, etc.
- **User Impact:** Annual login required

---

## Time Format Reference

The `JWT_EXPIRE` value uses the [ms](https://github.com/vercel/ms) format:

| Unit | Symbol | Example | Description |
|------|--------|---------|-------------|
| Milliseconds | `ms` | `60000ms` | 60,000 milliseconds |
| Seconds | `s` | `60s` | 60 seconds (1 minute) |
| Minutes | `m` | `60m` | 60 minutes (1 hour) |
| Hours | `h` | `24h` | 24 hours (1 day) |
| Days | `d` | `7d` | 7 days (1 week) |
| Weeks | `w` | `4w` | 4 weeks (28 days) |
| Years | `y` | `1y` | 1 year (365 days) |

### Examples
```env
JWT_EXPIRE=15m      # 15 minutes
JWT_EXPIRE=2h       # 2 hours
JWT_EXPIRE=7d       # 7 days
JWT_EXPIRE=30d      # 30 days
JWT_EXPIRE=365d     # 365 days (1 year)
JWT_EXPIRE=1y       # 1 year (same as 365d)
JWT_EXPIRE=3600000  # 3,600,000 milliseconds (1 hour)
```

---

## How to Change JWT Expiration

### Step 1: Stop the Server
```bash
# Press Ctrl+C if running in development mode
```

### Step 2: Edit .env File
```bash
nano .env
# or
vim .env
# or use any text editor
```

### Step 3: Change JWT_EXPIRE Value
```env
# Change from:
JWT_EXPIRE=365d

# To (example - 30 days):
JWT_EXPIRE=30d
```

### Step 4: Restart the Server
```bash
# Development
npm run dev

# Production
npm start
```

### Step 5: Test
```bash
# Login to get a new token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@shankmulgym.com",
    "password": "test123"
  }'
```

**Important:** Existing tokens will still have their original expiration time. Only newly issued tokens will use the new expiration setting.

---

## Token Verification

You can verify your token and check its expiration at [jwt.io](https://jwt.io)

### Token Structure
```
Header.Payload.Signature
```

### Decoded Payload (Example)
```json
{
  "id": "65b8f7a9c123456789abcdef",
  "email": "user@shankmulgym.com",
  "role": "user",
  "iat": 1706025600,    // Issued at: Jan 23, 2026
  "exp": 1737561600     // Expires: Jan 23, 2027 (1 year later)
}
```

---

## Production Checklist

Before deploying to production with 1-year token expiration:

- [ ] Set a **strong JWT_SECRET** (minimum 32 random characters)
- [ ] Use **HTTPS** for all API requests
- [ ] Implement **rate limiting** to prevent brute force attacks
- [ ] Add **token blacklisting** for logout functionality
- [ ] Monitor **failed login attempts**
- [ ] Implement **IP whitelisting** if possible
- [ ] Set up **logging and monitoring**
- [ ] Regular **security audits**
- [ ] Consider **refresh token pattern** for additional security
- [ ] Document **token handling** in client applications

---

## Recommendations

### For Shankmul Gym Attendance App

Given your use case (gym attendance tracking), **1-year expiration is acceptable** if:

1. ✅ Users are trusted (gym members)
2. ✅ Data is low-risk (attendance records)
3. ✅ Mobile app convenience is priority
4. ✅ Strong JWT_SECRET is used
5. ✅ HTTPS is enforced
6. ✅ User devices are reasonably secure

### Consider Shorter Expiration If:

1. ❌ Handling sensitive financial data
2. ❌ Compliance requirements (HIPAA, PCI-DSS, etc.)
3. ❌ Public-facing application with unknown users
4. ❌ High-value targets (banking, healthcare, etc.)
5. ❌ Regulatory requirements mandate it

---

## Questions & Answers

### Q: What happens when a token expires?
**A:** The user will receive a `401 Unauthorized` error and must login again to get a new token.

### Q: Can I invalidate a token before it expires?
**A:** Not by default. You need to implement token blacklisting (see security section).

### Q: Do old tokens stop working when I change JWT_EXPIRE?
**A:** No, existing tokens keep their original expiration. Only new tokens use the new setting.

### Q: Can I have different expiration times for different users?
**A:** Yes, modify `generateToken()` to accept an optional `expiresIn` parameter:
```typescript
const generateToken = (payload: TokenPayload, customExpiry?: string): string => {
  const expiresIn = customExpiry || process.env.JWT_EXPIRE || '365d';
  // ...
};
```

### Q: Is 1 year too long for security?
**A:** It depends on your threat model. For a gym attendance app with proper HTTPS and a strong secret, it's reasonable. For banking apps, it's too long.

---

## Support

If you have questions about JWT configuration, please refer to:
- [JWT Documentation](https://jwt.io/)
- [jsonwebtoken npm package](https://www.npmjs.com/package/jsonwebtoken)
- This README file

---

**Last Updated:** January 23, 2026
