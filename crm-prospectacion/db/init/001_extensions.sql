-- Este script lo ejecuta Docker automáticamente la PRIMERA vez que se crea
-- el volumen de datos de Postgres (ver docker-entrypoint-initdb.d en la
-- imagen oficial de postgres). Se ejecuta como el superusuario definido en
-- POSTGRES_USER del servicio "db" de docker-compose.yml, que es el único
-- rol con permisos para crear extensiones.
--
-- El usuario de la aplicación (crm_user) normalmente NO es superusuario,
-- por eso la extensión se crea aquí y no dentro de la migración de Alembic.

CREATE EXTENSION IF NOT EXISTS postgis;
