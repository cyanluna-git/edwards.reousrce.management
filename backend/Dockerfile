# Build stage
FROM python:3.12-slim AS builder

# Accept architecture as build argument (defaults to auto-detect)
# Supported values: amd64, arm64, auto
ARG TARGETARCH=auto

WORKDIR /app

# Install system dependencies for pyodbc
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg2 \
    unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && if [ "$TARGETARCH" = "auto" ]; then ARCH=$(dpkg --print-architecture); else ARCH=$TARGETARCH; fi \
    && echo "deb [arch=${ARCH} signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.12-slim

# Accept architecture as build argument (defaults to auto-detect)
ARG TARGETARCH=auto

WORKDIR /app

# Install ODBC driver in runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg2 \
    unixodbc \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && if [ "$TARGETARCH" = "auto" ]; then ARCH=$(dpkg --print-architecture); else ARCH=$TARGETARCH; fi \
    && echo "deb [arch=${ARCH} signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Custom Certificates (Zscaler) if present
COPY certs/zscaler.crt /usr/local/share/ca-certificates/zscaler.crt
RUN if [ -f /usr/local/share/ca-certificates/zscaler.crt ]; then \
        update-ca-certificates; \
    fi

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Expose port
EXPOSE 8004

# Set Python to run in unbuffered mode for real-time logging
ENV PYTHONUNBUFFERED=1

# Run the application (production-friendly defaults)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004", "--log-level", "info", "--access-log"]
