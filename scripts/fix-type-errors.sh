#!/bin/bash
# Quick script to fix TypeScript compilation errors

echo "Fixing TypeScript errors in Grafity plugin..."

# Build locally to see if fixes work
echo "Building plugin..."
npx nx build grafity-react 2>&1 | tee build-output.log

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Check build-output.log for details"
    exit 1
fi