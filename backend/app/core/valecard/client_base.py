import logging
import asyncio
from typing import Any, Dict, Optional
import httpx
from backend.app.core.config import settings

logger = logging.getLogger("valecard.client")


class ValeCardBaseException(Exception):
    """Exceção base para erros na integração ValeCard."""
    pass


class ValeCardTimeoutError(ValeCardBaseException):
    """Lançada quando a requisição excede o tempo limite configurado."""
    pass


class ValeCardConnectionError(ValeCardBaseException):
    """Lançada quando não é possível estabelecer conexão com o webservice."""
    pass


class ValeCardAPIError(ValeCardBaseException):
    """Lançada quando a API retorna erro de negócio ou status HTTP 4xx/5xx."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class ValeCardBaseClient:
    """
    Cliente HTTP Assíncrono resiliente para comunicação com a API REST ValeCard.
    - Autenticação via Basic Token
    - Sanitização rigorosa de logs (sem expor credenciais)
    - Retry com backoff exponencial para falhas transitórias
    - Timeouts customizáveis
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout: Optional[int] = None,
        max_retries: int = 3
    ):
        self.base_url = (base_url or settings.VALECARD_BASE_URL).rstrip("/")
        self.token = token if token is not None else settings.VALECARD_API_TOKEN
        self.timeout = timeout or settings.VALECARD_TIMEOUT_SECONDS
        self.max_retries = max_retries
        self._client: Optional[httpx.AsyncClient] = None

    def _get_headers(self) -> Dict[str, str]:
        """Gera os headers oficiais requeridos pelo gateway KissAPI ValeCard."""
        return {
            "Authorization": f"Basic {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SGFrotas-ValeCard-Connector/1.0"
        }

    async def get_client(self) -> httpx.AsyncClient:
        """Inicializa ou reaproveita a sessão assíncrona do httpx com pool de conexões."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout, connect=10.0),
                headers=self._get_headers()
            )
        return self._client

    async def close(self):
        """Fecha a sessão HTTP de forma limpa."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        await self.get_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _sanitize_log_data(self, data: Any) -> Any:
        """Oculta tokens ou senhas antes de gravar nos logs."""
        if isinstance(data, dict):
            sanitized = {}
            for k, v in data.items():
                if any(sec in k.lower() for sec in ["token", "password", "senha", "secret"]):
                    sanitized[k] = "***REDACTED***"
                else:
                    sanitized[k] = self._sanitize_log_data(v)
            return sanitized
        return data

    async def request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executa requisição com política de retries para falhas transitórias de rede ou 5xx.
        """
        if not self.token:
            raise ValeCardAPIError(
                message="VALECARD_API_TOKEN não configurado nas variáveis de ambiente.",
                status_code=401
            )

        endpoint = endpoint.lstrip("/")
        url = f"{self.base_url}/{endpoint}"
        client = await self.get_client()

        retry_count = 0
        backoff_delay = 1.0

        sanitized_payload = self._sanitize_log_data(payload)
        logger.debug(f"[ValeCard] {method} -> {endpoint} | Payload: {sanitized_payload}")

        while retry_count <= self.max_retries:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    json=payload,
                    params=params
                )

                # Tratamento de respostas de sucesso (2xx)
                if 200 <= response.status_code < 300:
                    try:
                        return response.json()
                    except Exception:
                        return {"status": "ok", "raw_text": response.text}

                # Tratamento de status transitórios elegíveis para Retry (429, 502, 503, 504)
                if response.status_code in [429, 502, 503, 504] and retry_count < self.max_retries:
                    retry_count += 1
                    logger.warning(
                        f"[ValeCard] Status transitório {response.status_code} em {endpoint}. "
                        f"Tentativa {retry_count}/{self.max_retries} em {backoff_delay:.1f}s..."
                    )
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2
                    continue

                # Erros definitivos da API (400, 401, 403, 404, 500 etc.)
                try:
                    error_data = response.json()
                except Exception:
                    error_data = response.text

                logger.error(f"[ValeCard API Error] {response.status_code} em {endpoint}: {error_data}")
                raise ValeCardAPIError(
                    message=f"ValeCard API retornou erro HTTP {response.status_code}: {error_data}",
                    status_code=response.status_code,
                    response_body=error_data
                )

            except httpx.TimeoutException as e:
                retry_count += 1
                if retry_count <= self.max_retries:
                    logger.warning(
                        f"[ValeCard Timeout] em {endpoint}. "
                        f"Tentativa {retry_count}/{self.max_retries} em {backoff_delay:.1f}s..."
                    )
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2
                    continue
                logger.error(f"[ValeCard Timeout Definitivo] após {self.max_retries} tentativas em {endpoint}")
                raise ValeCardTimeoutError(f"Timeout ao comunicar com ValeCard em {endpoint}: {str(e)}")

            except httpx.NetworkError as e:
                retry_count += 1
                if retry_count <= self.max_retries:
                    logger.warning(
                        f"[ValeCard Rede] Falha de conexão em {endpoint}: {str(e)}. "
                        f"Tentativa {retry_count}/{self.max_retries} em {backoff_delay:.1f}s..."
                    )
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2
                    continue
                logger.error(f"[ValeCard Conexão Falhou] em {endpoint}: {str(e)}")
                raise ValeCardConnectionError(f"Falha de rede ao conectar à ValeCard: {str(e)}")

        raise ValeCardAPIError(f"Número máximo de tentativas ({self.max_retries}) excedido para {endpoint}")

    async def post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Atalho para POST JSON."""
        return await self.request("POST", endpoint, payload=payload)

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Atalho para GET."""
        return await self.request("GET", endpoint, params=params)
