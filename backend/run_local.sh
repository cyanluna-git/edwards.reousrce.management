#!/bin/bash

# backend 디렉토리로 이동 (스크립트 위치 기준)
cd "$(dirname "$0")"

# 가상환경이 있으면 활성화
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# .env 파일 존재 확인 및 export
if [ -f ".env" ]; then
    echo "Loading environment variables from .env..."
    # 주석 제외하고 변수들을 export
    export $(grep -v '^#' .env | xargs)
else
    echo "Warning: .env file not found. Using default settings."
fi

# 포트 설정 (환경 변수 PORT가 있으면 사용, 없으면 8000)
PORT=${PORT:-8000}

# 해당 포트가 사용 중인지 확인
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
    echo "Error: Port $PORT is already in use by process $PID."
    echo "You can kill it using: kill -9 $PID"
    echo "Or run with a different port: PORT=8001 ./run_local.sh"
    exit 1
fi

echo "Starting Edwards Backend on http://localhost:$PORT..."
# uvicorn 실행
uvicorn app.main:app --reload --port $PORT
