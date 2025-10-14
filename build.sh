#!/bin/bash

# Build script for Railway deployment
echo "🚀 Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building application..."
npm run build

echo "✅ Build completed successfully!"
