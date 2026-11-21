import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL
from dotenv import load_dotenv

# Carrega .env da raiz do projeto (nunca versionado no Git)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "SGFrotas API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Configurações do Banco de Dados PostgreSQL (definidas via .env)
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "sgfrotas")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_SCHEMA: str = os.getenv("POSTGRES_SCHEMA", "public")

    @property
    def DATABASE_URL(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg2",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
            query={"sslmode": os.getenv("POSTGRES_SSLMODE", "prefer")},
        )

    # CORS para desenvolvimento local (inclui porta 5175 do sgfrotas-facul)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    # --- Configurações da API ValeCard (Integração REST via .env) ---
    VALECARD_BASE_URL: str = os.getenv("VALECARD_BASE_URL", "https://kissapi.valecard.com.br/core/services/frotaCliente")
    VALECARD_API_TOKEN: str = os.getenv("VALECARD_API_TOKEN", "")
    VALECARD_CONTRATO_CLIENTE: str = os.getenv("VALECARD_CONTRATO_CLIENTE", "")
    VALECARD_TIMEOUT_SECONDS: int = int(os.getenv("VALECARD_TIMEOUT_SECONDS", "30"))


settings = Settings()
