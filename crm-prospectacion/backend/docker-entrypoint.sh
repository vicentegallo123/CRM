#!/bin/sh
# Entrypoint del contenedor del backend.
#
# 1. Espera a que Postgres acepte conexiones (útil porque `depends_on` en
#    docker-compose solo garantiza el orden de arranque del contenedor, no
#    que la base de datos ya esté lista para recibir queries).
# 2. Aplica las migraciones de Alembic (`alembic upgrade head`), de forma
#    que el esquema de la base de datos siempre quede sincronizado con los
#    modelos SQLAlchemy del código que se está desplegando.
# 3. Ejecuta el comando final (por defecto, uvicorn).
set -e

echo "Esperando a que Postgres (${POSTGRES_SERVER}:${POSTGRES_PORT}) esté disponible..."
until python3 -c "
import socket, os, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
    s.connect((os.environ.get('POSTGRES_SERVER', 'db'), int(os.environ.get('POSTGRES_PORT', '5432'))))
    s.close()
except Exception:
    sys.exit(1)
"; do
  echo "Postgres aún no responde, reintentando en 2s..."
  sleep 2
done

echo "Postgres disponible. Aplicando migraciones de Alembic..."
alembic upgrade head

echo "Migraciones aplicadas. Iniciando aplicación..."
exec "$@"
