"""agrega assigned_to_id (vendedor asignado a cada prospecto)

Revision ID: 0007_assigned_to
Revises: 0006_reference_point_settings
Create Date: 2026-09-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0007_assigned_to"
down_revision: Union[str, None] = "0006_reference_point_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "assigned_to_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_businesses_assigned_to_id", "businesses", ["assigned_to_id"])

    # Rutas guardadas: un vendedor puede guardar un conjunto de negocios
    # con un nombre (ej. "Ruta lunes zona centro") para reutilizarlo
    # después sin tener que volver a seleccionar uno por uno.
    op.create_table(
        "saved_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("business_ids", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_saved_routes_created_by_id", "saved_routes", ["created_by_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_routes_created_by_id", table_name="saved_routes")
    op.drop_table("saved_routes")

    op.drop_index("ix_businesses_assigned_to_id", table_name="businesses")
    op.drop_column("businesses", "assigned_to_id")
