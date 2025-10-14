@echo off
echo 🚀 Starting build process...

echo 📦 Installing dependencies...
npm ci --only=production

echo 🔨 Building application...
npm run build

echo ✅ Build completed successfully!
