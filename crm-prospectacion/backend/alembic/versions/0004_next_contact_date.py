"""agrega next_contact_date (recordatorio de próximo contacto)

Revision ID: 0004_next_contact_date
Revises: 0003_crm_pipeline_fields
Create Date: 2026-08-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_next_contact_date"
down_revision: Union[str, None] = "0003_crm_pipeline_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("next_contact_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_businesses_next_contact_date", "businesses", ["next_contact_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_businesses_next_contact_date", table_name="businesses")
    op.drop_column("businesses", "next_contact_date")
