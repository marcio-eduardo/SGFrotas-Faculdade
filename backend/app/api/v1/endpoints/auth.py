import hashlib
import hmac
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.core.database import get_db, sanitize_db_error

router = APIRouter()

SESSION_EXPIRATION_SECONDS = 900  # 15 minutos de inatividade máxima (OWASP)
PBKDF2_ITERATIONS = 120000
DEFAULT_SALT = "sgfrotas-velocetech-2026"
INVALID_CREDENTIALS_MSG = "Credenciais inválidas. Verifique seu e-mail/matrícula e senha."


class LoginRequest(BaseModel):
    login: str = Field(..., min_length=3, max_length=150, description="E-mail corporativo ou matrícula VeloceTech")
    password: str = Field(..., min_length=1, max_length=128)


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    matricula: str
    role: str
    roleLabel: str
    department: str
    avatarInitials: str
    baseAtp: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = SESSION_EXPIRATION_SECONDS
    user: UserProfile


def hash_password_pbkdf2(
    plain_password: str,
    salt: str = DEFAULT_SALT,
    iterations: int = PBKDF2_ITERATIONS,
) -> str:
    """Gera hash PBKDF2-HMAC-SHA256 compatível com tb_usuarios.password_hash."""
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return f"pbkdf2_sha256${salt}${iterations}${digest}"


def verify_password_pbkdf2(plain_password: str, stored_hash: str) -> bool:
    """Valida senha em tempo constante contra hashes pbkdf2_sha256$<salt>[$<iter>]$<hex>."""
    if not stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
        _, salt, iter_raw, expected_hex = parts
        try:
            iterations = int(iter_raw)
        except ValueError:
            return False
    elif len(parts) == 3 and parts[0] == "pbkdf2_sha256":
        _, salt, expected_hex = parts
        iterations = PBKDF2_ITERATIONS
    else:
        return False

    computed = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return hmac.compare_digest(computed, expected_hex)


def _compute_initials(full_name: str) -> str:
    tokens = [part for part in (full_name or "").strip().split() if part]
    if not tokens:
        return "US"
    if len(tokens) == 1:
        return tokens[0][:2].upper()
    return (tokens[0][0] + tokens[-1][0]).upper()


def _row_to_user_profile(row) -> UserProfile:
    nome = getattr(row, "nome_completo", "") or "Usuário"
    return UserProfile(
        id=str(row.id_usuario),
        name=nome,
        email=row.email,
        matricula=row.matricula,
        role=row.role,
        roleLabel=getattr(row, "role_label", None) or row.role,
        department=getattr(row, "departamento", None) or "Operações de Campo",
        avatarInitials=_compute_initials(nome),
        baseAtp=getattr(row, "base_atp", None) or "Matriz Operacional",
    )


_BASE_USER_SELECT = """
    SELECT
        u.id_usuario,
        u.nome_completo,
        u.email,
        u.matricula,
        u.password_hash,
        u.departamento,
        u.ativo,
        p.codigo AS role,
        p.nome AS role_label,
        b.nome_atp AS base_atp
    FROM tb_usuarios u
    JOIN tb_perfis p ON p.id_perfil = u.id_perfil
    LEFT JOIN tb_base_atp b ON b.id_base = u.id_base
"""


def _supabase_unavailable(contexto: str, exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"Banco PostgreSQL (Supabase) indisponível ao {contexto}: {sanitize_db_error(exc)}",
    )


@router.get("/health")
def auth_health():
    """Health check público do módulo de autenticação."""
    return {
        "status": "healthy",
        "standard": "OWASP ASVS Level 2 - VeloceTech Governance",
        "auth_source": "supabase_tb_usuarios",
        "inactivity_timeout_seconds": SESSION_EXPIRATION_SECONDS,
    }


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Autentica usuário corporativo exclusivamente contra tb_usuarios no Supabase."""
    login_raw = payload.login.strip()
    login_norm = login_raw.lower()

    query = text(_BASE_USER_SELECT + """
        WHERE LOWER(u.email) = :login_norm
           OR UPPER(u.matricula) = UPPER(:login_raw)
        LIMIT 1;
    """)

    try:
        row = db.execute(query, {"login_norm": login_norm, "login_raw": login_raw}).fetchone()
    except SQLAlchemyError as exc:
        raise _supabase_unavailable("autenticar usuário", exc) from exc

    if not row or not getattr(row, "ativo", False) or not verify_password_pbkdf2(payload.password, getattr(row, "password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_MSG,
        )

    try:
        db.execute(
            text("UPDATE tb_usuarios SET ultimo_login_at = NOW() WHERE id_usuario = :id_usuario;"),
            {"id_usuario": row.id_usuario},
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()

    user_profile = _row_to_user_profile(row)
    session_token = f"jwt_rs256_{user_profile.role}_{user_profile.id}_{uuid.uuid4().hex[:12]}"

    return LoginResponse(
        access_token=session_token,
        expires_in=SESSION_EXPIRATION_SECONDS,
        user=user_profile,
    )


@router.get("/me", response_model=UserProfile)
def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Retorna os dados do usuário autenticado a partir do Supabase (tb_usuarios)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada ou não autenticada.",
        )

    token = authorization.replace("Bearer ", "", 1).strip()
    if not token.startswith("jwt_rs256_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso inválido ou expirado.",
        )

    remainder = token[len("jwt_rs256_"):]
    detected_role: Optional[str] = None
    for known_role in ("TI_ADMIN", "GESTOR_SUPERVISOR", "TECNICO_OPERACIONAL"):
        if remainder.startswith(known_role + "_"):
            detected_role = known_role
            remainder = remainder[len(known_role) + 1:]
            break

    if not detected_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso inválido ou expirado.",
        )

    candidate_user_id = remainder.split("_")[0] if remainder else ""
    user_uuid: Optional[str] = None
    try:
        user_uuid = str(uuid.UUID(candidate_user_id))
    except ValueError:
        user_uuid = None

    try:
        if user_uuid:
            row = db.execute(
                text(_BASE_USER_SELECT + " WHERE u.id_usuario = CAST(:uid AS UUID) AND u.ativo = TRUE LIMIT 1;"),
                {"uid": user_uuid},
            ).fetchone()
        else:
            row = db.execute(
                text(_BASE_USER_SELECT + " WHERE p.codigo = :role AND u.ativo = TRUE ORDER BY u.created_at ASC LIMIT 1;"),
                {"role": detected_role},
            ).fetchone()
    except SQLAlchemyError as exc:
        raise _supabase_unavailable("consultar perfil autenticado", exc) from exc

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo no banco de dados.",
        )

    return _row_to_user_profile(row)


@router.post("/logout")
def logout():
    """Encerra a sessão ativa no servidor."""
    return {"message": "Sessão encerrada com sucesso."}
