#!/bin/bash
# Warden (Cerberus) engine launcher for macOS / Linux.
# Now with extra sparkles and safety checks! (◕‿◕)★

cd "$(dirname "$0")" || { echo "Error: Could not determine directory"; exit 1; }

echo "------------------------------------------------------------"
echo "🚀 Starting Warden Security Gateway... ヽ(>∀<☆)ノ"
echo "------------------------------------------------------------"

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed! Please install Node.js ≥ 20. ♪"
    exit 1
fi
echo "✅ Node.js found: $(node -v)"

# 2. Check for dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Dependencies missing! Running 'npm install' for you... ✨"
    npm install || { echo "❌ npm install failed!"; exit 1; }
    echo "✅ Dependencies installed!"
fi

# 3. Check for port 9000 conflict
if lsof -Pi :9000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Warning: Port 9000 is already in use!"
    echo "Attempting to use port 9001 instead... 💫"
    export CB_ENGINE_PORT=9001
else
    echo "✅ Port 9000 is clear!"
fi

PORT=${CB_ENGINE_PORT:-9000}
echo ""
echo "🌟 Engine will be available at: http://127.0.0.1:$PORT/"
echo "💡 Press Ctrl+C to stop the engine."
echo "------------------------------------------------------------"
echo ""

exec node ./bin/cerberus.mjs engine
