"""agrega tabla reference_point_settings (punto de partida configurable
desde la app, en vez de fijo en variables de entorno)

Revision ID: 0006_reference_point_settings
Revises: 0005_sample_grams
Create Date: 2026-08-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_reference_point_settings"
down_revision: Union[str, None] = "0005_sample_grams"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reference_point_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("label", sa.String(length=500), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("reference_point_settings")
