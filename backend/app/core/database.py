import re

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.core.config import settings


def sanitize_db_error(exc: Exception) -> str:
    """Remove credenciais eventuais de mensagens do driver PostgreSQL antes de logar ou exibir."""
    msg = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
    msg = re.sub(r"://[^@]+@", "://***:***@", msg)
    msg = re.sub(r"password=[^\s]+", "password=***", msg, flags=re.IGNORECASE)
    return msg[:240]


# Engine otimizado exclusivamente para o Supabase (PostgreSQL gerenciado)
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,      # Evita conexões mortas no pooler
    pool_recycle=300,        # Recicla a cada 5 minutos
    pool_size=10,
    max_overflow=15,
    connect_args={"connect_timeout": 10},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependência FastAPI para injetar a sessão do banco por requisição."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
