# =====================================================================
# SGFrotas Backend - Dockerfile (FastAPI Python 3.12)
# =====================================================================
FROM python:3.12-slim

# Evita geração de arquivos .pyc e buffer de saída
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

# Instala dependências de compilação essenciais para psycopg2 e rede
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala requirements primeiro (camada de cache otimizada)
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copia código do backend (variáveis de ambiente injetadas via docker-compose / .env)
COPY backend /app/backend

# Porta do FastAPI
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Comando padrão
CMD ["python", "backend/run.py"]
