"""agrega categorías hotel y cooperativa

Revision ID: 0002_add_hotel_cooperativa
Revises: 0001_initial_schema
Create Date: 2026-08-28

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002_add_hotel_cooperativa"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL 12+ permite ALTER TYPE ... ADD VALUE dentro de una
    # transacción normal, siempre que el nuevo valor no se use en la
    # misma transacción (no es el caso aquí).
    op.execute("ALTER TYPE category_enum ADD VALUE IF NOT EXISTS 'hotel'")
    op.execute("ALTER TYPE category_enum ADD VALUE IF NOT EXISTS 'cooperativa'")


def downgrade() -> None:
    # Postgres no soporta eliminar valores de un ENUM directamente. Si se
    # necesita revertir, hay que recrear el tipo completo (fuera de alcance
    # de esta migración; no se espera degradar en producción por esto).
    pass
