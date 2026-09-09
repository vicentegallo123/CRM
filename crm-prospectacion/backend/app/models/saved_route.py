
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SavedRoute(Base):
    __tablename__ = "saved_routes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Lista ordenada de IDs de negocio (como strings), guardada tal cual
    # el usuario los seleccionó. Se recalcula la ruta óptima cada vez que
    # se carga, en vez de guardar un resultado congelado, para que
    # siempre refleje el punto de referencia y los datos actuales.
    business_ids: Mapped[list] = mapped_column(JSONB, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SavedRoute id={self.id} name={self.name!r}>"
