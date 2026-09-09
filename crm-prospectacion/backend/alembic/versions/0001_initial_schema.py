"""schema inicial: businesses y users

Crea la extensión PostGIS (si está disponible en el servidor), los tipos
ENUM de Postgres y las tablas `businesses` y `users`, replicando de forma
exacta lo definido en `app/models/business.py` y `app/models/user.py`.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enums tal cual se definen en los modelos (usando el .value de cada
# miembro de Python, no el .name -- ver `values_callable` en los modelos).
CATEGORY_VALUES = [
    "cafeteria",
    "funeraria",
    "escuela",
    "restaurante",
    "farmacia",
    "gimnasio",
    "ferreteria",
    "consultorio_medico",
    "despacho_contable",
    "otro",
]
ZONE_VALUES = ["Zapopan", "Guadalajara"]
ROLE_VALUES = ["admin", "vendedor"]


def upgrade() -> None:
    # Extensión geoespacial (opcional): el modelo actual usa columnas Float
    # para lat/lng, así que PostGIS no es un requisito duro. Se intenta
    # crear por conveniencia (para quien luego quiera columnas `geometry`),
    # pero si el rol de la aplicación no es superusuario -algo común en
    # proveedores gestionados de Postgres- simplemente se omite con un
    # aviso, en vez de romper el despliegue. En Docker Compose, la
    # extensión ya se crea como superusuario vía `db/init/001_extensions.sql`.
    bind = op.get_bind()
    try:
        with bind.begin_nested():
            bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis;"))
    except Exception as exc:  # noqa: BLE001
        print(
            "[migración] Aviso: no se pudo crear la extensión postgis "
            f"({exc.__class__.__name__}). Continuando sin ella; "
            "créala manualmente como superusuario si la necesitas."
        )
    category_enum = postgresql.ENUM(*CATEGORY_VALUES, name="category_enum")
    zone_enum = postgresql.ENUM(*ZONE_VALUES, name="zone_enum")
    role_enum = postgresql.ENUM(*ROLE_VALUES, name="role_enum")

    category_enum.create(bind, checkfirst=True)
    zone_enum.create(bind, checkfirst=True)
    role_enum.create(bind, checkfirst=True)

    # Los tipos ya fueron creados arriba explícitamente; se marca
    # create_type=False para que `create_table` no intente re-crearlos.
    category_enum_col = postgresql.ENUM(*CATEGORY_VALUES, name="category_enum", create_type=False)
    zone_enum_col = postgresql.ENUM(*ZONE_VALUES, name="zone_enum", create_type=False)
    role_enum_col = postgresql.ENUM(*ROLE_VALUES, name="role_enum", create_type=False)

    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", category_enum_col, nullable=False),
        sa.Column("zone", zone_enum_col, nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("products_services", sa.Text(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("visited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_businesses_category", "businesses", ["category"])
    op.create_index("ix_businesses_zone", "businesses", ["zone"])
    op.create_index("ix_businesses_zone_category", "businesses", ["zone", "category"])
    op.create_index("ix_businesses_lat_lng", "businesses", ["lat", "lng"])

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", role_enum_col, nullable=False, server_default="vendedor"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_businesses_lat_lng", table_name="businesses")
    op.drop_index("ix_businesses_zone_category", table_name="businesses")
    op.drop_index("ix_businesses_zone", table_name="businesses")
    op.drop_index("ix_businesses_category", table_name="businesses")
    op.drop_table("businesses")

    bind = op.get_bind()
    postgresql.ENUM(name="role_enum").drop(bind, checkfirst=True)
    postgresql.ENUM(name="zone_enum").drop(bind, checkfirst=True)
    postgresql.ENUM(name="category_enum").drop(bind, checkfirst=True)

    # No se elimina la extensión postgis: puede estar en uso por otros
    # esquemas/objetos del servidor.
