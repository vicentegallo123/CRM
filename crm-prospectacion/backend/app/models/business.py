
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ZoneEnum(str, enum.Enum):
    ZAPOPAN = "Zapopan"
    GUADALAJARA = "Guadalajara"


class CategoryEnum(str, enum.Enum):
    CAFETERIA = "cafeteria"
    FUNERARIA = "funeraria"
    ESCUELA = "escuela"
    RESTAURANTE = "restaurante"
    FARMACIA = "farmacia"
    GIMNASIO = "gimnasio"
    FERRETERIA = "ferreteria"
    CONSULTORIO_MEDICO = "consultorio_medico"
    DESPACHO_CONTABLE = "despacho_contable"
    HOTEL = "hotel"
    COOPERATIVA = "cooperativa"
    OTRO = "otro"


class StageEnum(str, enum.Enum):
    """Etapa del prospecto dentro del embudo de ventas (columnas del
    tablero Kanban)."""
    NUEVO = "nuevo"
    CONTACTADO = "contactado"
    VISITADO = "visitado"
    CLIENTE = "cliente"
    DESCARTADO = "descartado"


class PurchaseFrequencyEnum(str, enum.Enum):
    """Con qué frecuencia compra un cliente ya convertido."""
    SEMANAL = "semanal"
    QUINCENAL = "quincenal"
    MENSUAL = "mensual"


class Business(Base):
    __tablename__ = "businesses"
    __table_args__ = (
        Index("ix_businesses_zone_category", "zone", "category"),
        Index("ix_businesses_lat_lng", "lat", "lng"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[CategoryEnum] = mapped_column(
        Enum(
            CategoryEnum,
            name="category_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    zone: Mapped[ZoneEnum] = mapped_column(
        Enum(
            ZoneEnum,
            name="zone_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    website: Mapped[str] = mapped_column(String(500), nullable=True)
    products_services: Mapped[str] = mapped_column(Text, nullable=True)
    rating: Mapped[float] = mapped_column(Float, nullable=True)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    visited: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # --- Pipeline de ventas (CRM) ---
    stage: Mapped[StageEnum] = mapped_column(
        Enum(
            StageEnum,
            name="stage_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=StageEnum.NUEVO,
        server_default=StageEnum.NUEVO.value,
        index=True,
    )
    coffee_offered: Mapped[str] = mapped_column(Text, nullable=True)
    # Cantidad exacta (en gramos) de café que se dejó como muestra en la
    # visita. Campo numérico separado de `coffee_offered` (que es texto
    # libre describiendo el tipo/variedad) para poder sumarlo y reportarlo
    # en métricas (ej. "total de café regalado en muestras este mes").
    sample_grams: Mapped[float] = mapped_column(Float, nullable=True)
    is_client: Mapped[bool] = mapped_column(default=False, server_default="false")
    purchase_amount: Mapped[float] = mapped_column(Float, nullable=True)
    purchase_frequency: Mapped[PurchaseFrequencyEnum] = mapped_column(
        Enum(
            PurchaseFrequencyEnum,
            name="purchase_frequency_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=True,
    )
    last_visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # Fecha en la que el vendedor planea volver a contactar a este
    # prospecto/cliente (recordatorio de seguimiento). Se muestra en el
    # tablero Kanban y alimenta la lista de "recordatorios" del dashboard.
    next_contact_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Vendedor "dueño" de este prospecto. Se asigna automáticamente al
    # usuario que lo creó (manualmente o vía scraper). Por defecto, cada
    # vendedor solo ve en su lista los negocios asignados a él mismo más
    # los que todavía no tiene nadie (para poder "reclamarlos"); los
    # administradores ven todo. Esto evita que dos vendedores dupliquen
    # esfuerzo visitando al mismo prospecto sin saberlo.
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Business id={self.id} name={self.name!r} zone={self.zone}>"
