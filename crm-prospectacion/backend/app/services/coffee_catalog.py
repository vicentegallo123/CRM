"""
Catálogo de precios de café -- usado para calcular cuánto cuesta
realmente cada muestra que se deja en una visita (gramos × precio real
del producto), en vez de solo contar gramos sin costo asociado.

Los precios vienen de la lista de precios de Nudo Verde Coffee Roasters
(Guadalajara). Si cambian los precios o los productos, este es el único
lugar que hay que actualizar en el backend -- hay una copia hermana en
el frontend (`frontend/src/data/coffeePriceCatalog.js`) que debe
mantenerse igual para que los cálculos coincidan en toda la app.

El precio real por gramo varía según el tamaño del paquete comprado
(comprar 1 kilo sale más barato por gramo que comprar 250g) -- por eso el
cálculo usa el nivel de precio que corresponde al tamaño real de la
muestra, no siempre el precio por kilo.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class CoffeeProduct:
    name: str
    category: str
    price_1kg: float
    price_500g: float
    price_250g: float


COFFEE_CATALOG: List[CoffeeProduct] = [
    # --- Café de especialidad ---
    CoffeeProduct("Geisha honey-puebla", "Especialidad", 480, 265, 165),
    CoffeeProduct("Caturra honey-puebla", "Especialidad", 400, 265, 165),
    CoffeeProduct("Bourbon honey-puebla", "Especialidad", 400, 265, 165),
    CoffeeProduct("Bourbon natural-puebla", "Especialidad", 400, 265, 165),
    CoffeeProduct("Guerrero-natural", "Especialidad", 340, 235, 150),
    # --- Café de altura ---
    CoffeeProduct("Veracruz-lavado", "Altura", 350, 255, 160),
    CoffeeProduct("Oaxaca-lavado", "Altura", 400, 255, 160),
    CoffeeProduct("Chiapas-lavado", "Altura", 340, 235, 150),
    CoffeeProduct("Bourbon lavado-puebla", "Altura", 380, 255, 160),
    CoffeeProduct("Mezcla veracruz-lavado", "Altura", 350, 255, 160),
    CoffeeProduct("Nayarit-Lavado", "Altura", 350, 255, 160),
    # --- Café HouseBlend ---
    CoffeeProduct("Tueste italiano", "HouseBlend", 350, 255, 160),
    CoffeeProduct("Cafetera-molido", "HouseBlend", 300, 200, 120),
    CoffeeProduct("Descafeinado", "HouseBlend", 330, 235, 150),
    CoffeeProduct("Espresso Roast", "HouseBlend", 380, 255, 160),
]

_CATALOG_BY_NAME = {p.name: p for p in COFFEE_CATALOG}


def get_catalog_names() -> List[str]:
    return [p.name for p in COFFEE_CATALOG]


def calculate_sample_cost(product_name: Optional[str], grams: Optional[float]) -> Optional[float]:
    """Calcula el costo real de una muestra de `grams` gramos del producto
    `product_name`, usando el precio del nivel (250g/500g/1kg) más cercano
    al tamaño real de la muestra. Devuelve `None` si el producto no está
    en el catálogo (ej. el vendedor escribió texto libre que no coincide
    con ningún nombre exacto) o si no hay gramos capturados -- nunca
    lanza una excepción, para que un dato faltante o no reconocido jamás
    rompa un reporte o el dashboard."""
    if not product_name or not grams or grams <= 0:
        return None

    product = _CATALOG_BY_NAME.get(product_name.strip())
    if product is None:
        return None

    if grams <= 250:
        price_per_gram = product.price_250g / 250
    elif grams <= 500:
        price_per_gram = product.price_500g / 500
    else:
        price_per_gram = product.price_1kg / 1000

    return round(grams * price_per_gram, 2)
