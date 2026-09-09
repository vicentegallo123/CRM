
from __future__ import annotations

import asyncio
import re
import sys
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from urllib.parse import quote

from bs4 import BeautifulSoup
from playwright.sync_api import Browser, Page, sync_playwright

from app.core.config import settings

COORD_PATTERN = re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)")


@dataclass
class ScrapedBusiness:
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    products_services: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_url: Optional[str] = None
    raw_category_text: Optional[str] = None
    extra: dict = field(default_factory=dict)


class _GoogleMapsScraperSync:
    """Encapsula una sesión SÍNCRONA de Playwright para extraer negocios de
    Google Maps. Toda esta clase corre dentro de un hilo dedicado (ver
    `run_scraper` más abajo), nunca directamente sobre el event loop de
    FastAPI."""

    RESULTS_FEED_SELECTOR = 'div[role="feed"]'
    RESULT_CARD_SELECTOR = 'div[role="feed"] > div > div[jsaction]'
    NAME_SELECTOR = "h1.DUwDvf, h1.fontHeadlineLarge"
    ADDRESS_BUTTON_SELECTOR = 'button[data-item-id="address"]'
    PHONE_BUTTON_SELECTOR = 'button[data-item-id^="phone:tel:"]'
    WEBSITE_LINK_SELECTOR = 'a[data-item-id="authority"]'
    RATING_SELECTOR = 'div.F7nice span[aria-hidden="true"]'
    CATEGORY_SELECTOR = "button.DkEaL"

    def __init__(self, headless: bool = None, timeout_ms: int = None):
        self.headless = settings.SCRAPER_HEADLESS if headless is None else headless
        self.timeout_ms = settings.SCRAPER_TIMEOUT_MS if timeout_ms is None else timeout_ms
        self._playwright_cm = None
        self._playwright = None
        self._browser: Optional[Browser] = None

    def __enter__(self) -> "_GoogleMapsScraperSync":
        self._playwright_cm = sync_playwright()
        self._playwright = self._playwright_cm.__enter__()
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._browser:
            self._browser.close()
        if self._playwright_cm:
            self._playwright_cm.__exit__(exc_type, exc, tb)

    def search(
        self,
        category: str,
        zone: str,
        max_results: Optional[int] = None,
        near_reference_point: bool = False,
        ref_lat: Optional[float] = None,
        ref_lng: Optional[float] = None,
        ref_label: Optional[str] = None,
    ) -> List[ScrapedBusiness]:
       
        if self._browser is None:
            raise RuntimeError("El scraper debe usarse dentro de un contexto with")

        max_results = max_results or settings.SCRAPER_MAX_RESULTS
        ref_lat = ref_lat if ref_lat is not None else settings.REFERENCE_POINT_LAT
        ref_lng = ref_lng if ref_lng is not None else settings.REFERENCE_POINT_LNG
        ref_label = ref_label or settings.REFERENCE_POINT_LABEL

        if near_reference_point:
           
            query = category
            zoom = 14  # vista más cercana: favorece negocios a poca distancia
        else:
            query = f"{category} en {zone}, Jalisco, México"
            zoom = 12

        url = (
            f"https://www.google.com/maps/search/{quote(query)}"
            f"/@{ref_lat},{ref_lng},{zoom}z?hl=es&gl=MX"
        )

        context = self._browser.new_context(
            locale="es-MX",
            viewport={"width": 1366, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        # Oculta la marca `navigator.webdriver` que delata a un navegador
        # automatizado; algunos sitios (incluido Google) sirven una versión
        # degradada de la página cuando la detectan.
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        page = context.new_page()
        page.set_default_timeout(self.timeout_ms)

        results: List[ScrapedBusiness] = []
        seen_keys = set()

        try:
           
            page.goto("https://www.google.com/maps?hl=es&gl=MX", wait_until="domcontentloaded")
            self._dismiss_consent_dialog(page)

           
            page.goto(url, wait_until="domcontentloaded")
            self._dismiss_consent_dialog(page)

            if "/maps/place/" in page.url:
                try:
                    page.wait_for_selector(self.NAME_SELECTOR, timeout=self.timeout_ms)
                except Exception as exc:
                    raise RuntimeError(
                        f"Google redirigió a una ficha individual pero no cargó su "
                        f"detalle a tiempo. Título: {page.title()!r}. URL: {page.url!r}. "
                        f"Error original: {exc}"
                    ) from exc

                business = self._extract_business_detail(page, category)
                if business is not None:
                    results.append(business)

                return results

            try:
                page.wait_for_selector(self.RESULTS_FEED_SELECTOR, timeout=self.timeout_ms)
            except Exception as exc:
                # Diagnóstico enriquecido: si de todas formas truena,
                # incluir título/URL reales ayuda muchísimo a saber qué
                # pantalla sirvió Google realmente (consentimiento,
                # CAPTCHA, error regional, etc.) sin tener que reproducirlo
                # manualmente en modo visible.
                raise RuntimeError(
                    f"No se encontró el panel de resultados de Google Maps. "
                    f"Título de la página: {page.title()!r}. URL final: {page.url!r}. "
                    f"Error original: {exc}"
                ) from exc

            card_count = self._scroll_results_feed(page, max_results)

            # BUG CORREGIDO: antes se hacía `card.click()` sobre la propia
            # página de la lista para abrir el detalle de cada negocio.
            # Google Maps reemplaza el panel de lista (`div[role="feed"]`)
            # por el panel de detalle al hacer eso, así que en la siguiente
            # vuelta del loop `RESULT_CARD_SELECTOR` ya no encontraba nada
            # y el scraper se detenía después de 1-2 negocios. Ahora cada
            # ficha de detalle se abre en una PESTAÑA APARTE (mismo
            # contexto/cookies), dejando la página de la lista intacta.
            detail_page = context.new_page()
            detail_page.set_default_timeout(self.timeout_ms)
            try:
                for index in range(min(card_count, max_results)):
                    cards = page.query_selector_all(self.RESULT_CARD_SELECTOR)
                    if index >= len(cards):
                        break
                    card = cards[index]
                    name_preview = card.inner_text().split("\n")[0].strip()
                    if not name_preview:
                        continue

                    link_el = card.query_selector("a")
                    href = link_el.get_attribute("href") if link_el else None

                    business = None
                    if href:
                        try:
                            detail_page.goto(href, wait_until="domcontentloaded")
                            detail_page.wait_for_selector(
                                self.NAME_SELECTOR, timeout=self.timeout_ms
                            )
                            detail_page.wait_for_timeout(400)
                            business = self._extract_business_detail(detail_page, category)
                        except Exception:
                            business = None
                    else:
                        # Respaldo poco frecuente: la tarjeta no traía un
                        # link directo. Se abre en la misma página de la
                        # lista (destruye el feed) y se recarga la
                        # búsqueda original después para poder seguir.
                        try:
                            card.click()
                            page.wait_for_selector(self.NAME_SELECTOR, timeout=self.timeout_ms)
                            page.wait_for_timeout(600)
                            business = self._extract_business_detail(page, category)
                        except Exception:
                            business = None
                        finally:
                            page.goto(url, wait_until="domcontentloaded")
                            self._dismiss_consent_dialog(page)
                            try:
                                page.wait_for_selector(
                                    self.RESULTS_FEED_SELECTOR, timeout=self.timeout_ms
                                )
                                self._scroll_results_feed(page, index + 1)
                            except Exception:
                                pass

                    if business is None:
                        continue

                    key = (
                        business.name.lower().strip(),
                        (business.address or "").lower().strip(),
                    )
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    results.append(business)
            finally:
                detail_page.close()
        finally:
            context.close()

        return results

    def _dismiss_consent_dialog(self, page: Page) -> None:
        """Cierra el diálogo/pantalla de consentimiento de cookies de Google
        si aparece. Cubre tanto el modal pequeño como la pantalla completa
        de consentimiento que Google sirve a navegadores "en frío" (sin
        cookies previas), como es siempre el caso de un navegador recién
        lanzado por Playwright."""
        consent_texts = [
            "Rechazar todo",
            "Aceptar todo",
            "Acepto",
            "Aceptar",
            "Reject all",
            "Accept all",
            "I agree",
        ]
        # Dos intentos con una breve espera entre ellos: la pantalla de
        # consentimiento completa a veces tarda un poco más en renderizar
        # que un simple modal.
        for attempt in range(2):
            for text in consent_texts:
                try:
                    button = page.get_by_role("button", name=text, exact=False)
                    if button.is_visible(timeout=2000):
                        button.click()
                        page.wait_for_timeout(500)
                        return
                except Exception:
                    continue
            page.wait_for_timeout(1000)

    def _scroll_results_feed(self, page: Page, max_results: int) -> int:
        """Hace scroll dentro del panel de resultados hasta acumular
        suficientes tarjetas o hasta que deje de crecer la lista."""
        feed = page.query_selector(self.RESULTS_FEED_SELECTOR)
        if feed is None:
            return 0

        previous_count = 0
        stable_rounds = 0
        max_rounds = 25

        for _ in range(max_rounds):
            cards = page.query_selector_all(self.RESULT_CARD_SELECTOR)
            current_count = len(cards)

            if current_count >= max_results:
                return current_count

            if current_count == previous_count:
                stable_rounds += 1
                if stable_rounds >= 3:
                    break
            else:
                stable_rounds = 0

            previous_count = current_count
            feed.evaluate("(el) => el.scrollBy(0, el.scrollHeight)")
            page.wait_for_timeout(1200)

        cards = page.query_selector_all(self.RESULT_CARD_SELECTOR)
        return len(cards)

    def _extract_business_detail(
        self, page: Page, category_query: str
    ) -> Optional[ScrapedBusiness]:
        try:
            name_el = page.query_selector(self.NAME_SELECTOR)
            name = name_el.inner_text().strip() if name_el else None
            if not name:
                return None

            address = self._safe_text_from_selector(page, self.ADDRESS_BUTTON_SELECTOR)
            phone = self._safe_text_from_selector(page, self.PHONE_BUTTON_SELECTOR)
            website = self._safe_attr_from_selector(page, self.WEBSITE_LINK_SELECTOR, "href")
            rating_text = self._safe_text_from_selector(page, self.RATING_SELECTOR)
            rating = None
            if rating_text:
                rating_text = rating_text.replace(",", ".")
                match = re.search(r"\d+(\.\d+)?", rating_text)
                if match:
                    rating = float(match.group())

            category_el = page.query_selector(self.CATEGORY_SELECTOR)
            raw_category_text = category_el.inner_text().strip() if category_el else None

            current_url = page.url
            lat, lng = self._parse_coordinates(current_url)

            return ScrapedBusiness(
                name=name,
                address=address,
                phone=phone,
                website=website,
                rating=rating,
                products_services=raw_category_text or category_query,
                lat=lat,
                lng=lng,
                source_url=current_url,
                raw_category_text=raw_category_text,
            )
        except Exception:
            return None

    @staticmethod
    def _parse_coordinates(url: str) -> Tuple[Optional[float], Optional[float]]:
        match = COORD_PATTERN.search(url)
        if match:
            return float(match.group(1)), float(match.group(2))

        # Fallback: patrón @lat,lng,zoom en la URL
        alt_match = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+),", url)
        if alt_match:
            return float(alt_match.group(1)), float(alt_match.group(2))

        return None, None

    @staticmethod
    def _safe_text_from_selector(page: Page, selector: str) -> Optional[str]:
        try:
            el = page.query_selector(selector)
            if el is None:
                return None
            text = el.inner_text().strip()
            return text or None
        except Exception:
            return None

    @staticmethod
    def _safe_attr_from_selector(page: Page, selector: str, attr: str) -> Optional[str]:
        try:
            el = page.query_selector(selector)
            if el is None:
                return None
            value = el.get_attribute(attr)
            return value.strip() if value else None
        except Exception:
            return None


def parse_html_fallback(html: str) -> BeautifulSoup:
    """Utilidad auxiliar: parsea HTML crudo con BeautifulSoup, disponible por
    si se desea complementar la extracción de Playwright con contenido
    estático adicional (por ejemplo, páginas web propias de cada negocio)."""
    return BeautifulSoup(html, "html.parser")


def _run_scraper_sync(
    category: str,
    zone: str,
    max_results: Optional[int] = None,
    near_reference_point: bool = False,
    ref_lat: Optional[float] = None,
    ref_lng: Optional[float] = None,
    ref_label: Optional[str] = None,
) -> List[ScrapedBusiness]:
    """Función síncrona que hace todo el trabajo de Playwright. Se ejecuta
    dentro de un hilo dedicado vía `asyncio.to_thread` (ver `run_scraper`),
    nunca directamente en el event loop de FastAPI.

    NOTA CRÍTICA (Windows): mover Playwright a un hilo aparte no basta por
    sí solo. Internamente, la API síncrona de Playwright crea su PROPIO
    event loop dentro de este hilo -- y ese loop nuevo hereda la política
    global de asyncio del proceso, que uvicorn puede haber configurado (en
    Windows) como una que NO soporta lanzar subprocesos. Como la política
    es una configuración global del proceso, no por hilo, forzamos aquí
    explícitamente la política correcta (Proactor, la única que en Windows
    soporta subprocesos) justo antes de que Playwright cree su loop
    interno. Esto no afecta al loop principal de FastAPI, que ya está
    corriendo con lo que sea que uvicorn haya elegido -- solo garantiza que
    cualquier loop NUEVO creado a partir de este punto (como el interno de
    Playwright en este hilo) use la política correcta."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    with _GoogleMapsScraperSync() as scraper:
        return scraper.search(
            category=category,
            zone=zone,
            max_results=max_results,
            near_reference_point=near_reference_point,
            ref_lat=ref_lat,
            ref_lng=ref_lng,
            ref_label=ref_label,
        )


async def run_scraper(
    category: str,
    zone: str,
    max_results: Optional[int] = None,
    near_reference_point: bool = False,
    ref_lat: Optional[float] = None,
    ref_lng: Optional[float] = None,
    ref_label: Optional[str] = None,
) -> List[ScrapedBusiness]:
    """Punto de entrada async de alto nivel usado por el endpoint de la API.

    `ref_lat`/`ref_lng`/`ref_label` son el punto de referencia configurado
    por el usuario (leído desde la base de datos en el endpoint, ver
    app/services/reference_point_service.py); si se omiten, el scraper cae
    en los valores por defecto de `settings`.

    Delega el trabajo real (síncrono, con Playwright) a un hilo aparte con
    `asyncio.to_thread`, para no bloquear el event loop de FastAPI mientras
    Chromium navega, y para evitar el problema de subprocesos en Windows
    descrito en el docstring del módulo."""
    return await asyncio.to_thread(
        _run_scraper_sync,
        category,
        zone,
        max_results,
        near_reference_point,
        ref_lat,
        ref_lng,
        ref_label,
    )


if __name__ == "__main__":  # pragma: no cover
    def _demo() -> None:
        found = _run_scraper_sync("cafeterias", "Zapopan", max_results=10)
        for b in found:
            print(b)

    _demo()