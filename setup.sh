#!/bin/bash

# Shankmul Gym Attendance Backend - Setup Script

echo "🏋️ Shankmul Gym Attendance Backend Setup"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created successfully!"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and set:"
    echo "   - JWT_SECRET to a strong, random value"
    echo "   - MONGODB_URI if using MongoDB Atlas"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Display JWT Configuration
echo "🔐 Current JWT Configuration:"
if [ -f .env ]; then
    JWT_EXPIRE=$(grep "JWT_EXPIRE=" .env | cut -d '=' -f2)
    echo "   JWT_EXPIRE = $JWT_EXPIRE (1 year = 365d)"
else
    echo "   JWT_EXPIRE = Not configured yet"
fi
echo ""

# Check if MongoDB is running
echo "🔍 Checking MongoDB status..."
if pgrep -x "mongod" > /dev/null; then
    echo "   ✅ MongoDB is running"
else
    echo "   ⚠️  MongoDB is not running. Start it with:"
    echo "      sudo systemctl start mongod"
fi
echo ""

echo "🚀 Ready to start the server!"
echo ""
echo "Available commands:"
echo "   npm run dev    - Start development server"
echo "   npm start      - Start production server"
echo "   npm run build  - Build TypeScript"
echo ""
