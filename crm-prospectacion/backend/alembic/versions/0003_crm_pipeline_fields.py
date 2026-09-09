"""agrega campos de pipeline de ventas (CRM): etapa, café ofrecido,
cliente, consumo y última visita

Revision ID: 0003_crm_pipeline_fields
Revises: 0002_add_hotel_cooperativa
Create Date: 2026-08-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0003_crm_pipeline_fields"
down_revision: Union[str, None] = "0002_add_hotel_cooperativa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STAGE_VALUES = ["nuevo", "contactado", "visitado", "cliente", "descartado"]
PURCHASE_FREQUENCY_VALUES = ["semanal", "quincenal", "mensual"]


def upgrade() -> None:
    bind = op.get_bind()

    stage_enum = postgresql.ENUM(*STAGE_VALUES, name="stage_enum")
    stage_enum.create(bind, checkfirst=True)

    purchase_frequency_enum = postgresql.ENUM(
        *PURCHASE_FREQUENCY_VALUES, name="purchase_frequency_enum"
    )
    purchase_frequency_enum.create(bind, checkfirst=True)

    stage_col = postgresql.ENUM(*STAGE_VALUES, name="stage_enum", create_type=False)
    purchase_frequency_col = postgresql.ENUM(
        *PURCHASE_FREQUENCY_VALUES, name="purchase_frequency_enum", create_type=False
    )

    op.add_column(
        "businesses",
        sa.Column(
            "stage",
            stage_col,
            nullable=False,
            server_default="nuevo",
        ),
    )
    op.add_column("businesses", sa.Column("coffee_offered", sa.Text(), nullable=True))
    op.add_column(
        "businesses",
        sa.Column("is_client", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("businesses", sa.Column("purchase_amount", sa.Float(), nullable=True))
    op.add_column(
        "businesses",
        sa.Column("purchase_frequency", purchase_frequency_col, nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column("last_visited_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_businesses_stage", "businesses", ["stage"])


def downgrade() -> None:
    op.drop_index("ix_businesses_stage", table_name="businesses")
    op.drop_column("businesses", "last_visited_at")
    op.drop_column("businesses", "purchase_frequency")
    op.drop_column("businesses", "purchase_amount")
    op.drop_column("businesses", "is_client")
    op.drop_column("businesses", "coffee_offered")
    op.drop_column("businesses", "stage")

    bind = op.get_bind()
    postgresql.ENUM(name="purchase_frequency_enum").drop(bind, checkfirst=True)
    postgresql.ENUM(name="stage_enum").drop(bind, checkfirst=True)
