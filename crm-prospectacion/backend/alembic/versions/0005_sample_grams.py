"""agrega sample_grams (gramos de café dejados como muestra)

Revision ID: 0005_sample_grams
Revises: 0004_next_contact_date
Create Date: 2026-08-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_sample_grams"
down_revision: Union[str, None] = "0004_next_contact_date"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("sample_grams", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("businesses", "sample_grams")
