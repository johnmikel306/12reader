FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000

WORKDIR /app

COPY requirements.txt ./
COPY apps/web/requirements.txt ./apps/web/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY apps ./apps

EXPOSE 10000

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 120"]
