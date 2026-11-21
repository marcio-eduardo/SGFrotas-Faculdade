import os
import sys
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from backend.app.api.v1.endpoints.auth import (
    LoginRequest,
    SESSION_EXPIRATION_SECONDS,
    auth_health,
    get_current_user,
    hash_password_pbkdf2,
    login,
    logout,
)


def _mock_user_row(
    *,
    email: str,
    matricula: str,
    name: str,
    role: str,
    role_label: str,
    department: str = "Operações VeloceTech",
    base_atp: str = "BOP-01 (Curitiba)",
    ativo: bool = True,
    password: str = "veloce@2026",
):
    return SimpleNamespace(
        id_usuario=uuid.uuid5(uuid.NAMESPACE_DNS, email),
        nome_completo=name,
        email=email,
        matricula=matricula,
        password_hash=hash_password_pbkdf2(password),
        departamento=department,
        ativo=ativo,
        role=role,
        role_label=role_label,
        base_atp=base_atp,
    )


def _make_auth_db(row):
    db = MagicMock()
    exec_result = MagicMock()
    exec_result.fetchone.return_value = row
    db.execute.return_value = exec_result
    return db


def test_auth_health():
    res = auth_health()
    assert res["status"] == "healthy"
    assert res["inactivity_timeout_seconds"] == 900
    assert res["auth_source"] == "supabase_tb_usuarios"
    assert "VeloceTech" in res["standard"]


def test_login_success_ti_admin():
    row = _mock_user_row(
        email="ti.admin@velocetech.com.br",
        matricula="VLC-90812",
        name="Ana Beatriz Souza",
        role="TI_ADMIN",
        role_label="TI - Administrador",
    )
    res = login(LoginRequest(login="ti.admin@velocetech.com.br", password="veloce@2026"), db=_make_auth_db(row))
    assert res.access_token.startswith("jwt_rs256_TI_ADMIN_")
    assert res.expires_in == SESSION_EXPIRATION_SECONDS
    assert res.user.role == "TI_ADMIN"
    assert res.user.matricula == "VLC-90812"


def test_login_success_supervisor():
    row = _mock_user_row(
        email="supervisor.frota@velocetech.com.br",
        matricula="VLC-44105",
        name="Marcos Vinícius Lima",
        role="GESTOR_SUPERVISOR",
        role_label="Supervisor de Frota",
    )
    res = login(LoginRequest(login="supervisor.frota@velocetech.com.br", password="veloce@2026"), db=_make_auth_db(row))
    assert res.user.role == "GESTOR_SUPERVISOR"
    assert "Marcos" in res.user.name


def test_login_success_tecnico_matricula():
    row = _mock_user_row(
        email="rafael.costa@velocetech.com.br",
        matricula="VLC-10492",
        name="Rafael Costa",
        role="TECNICO_OPERACIONAL",
        role_label="Técnico de Campo",
    )
    res = login(LoginRequest(login="vlc-10492", password="veloce@2026"), db=_make_auth_db(row))
    assert res.user.role == "TECNICO_OPERACIONAL"
    assert res.user.name == "Rafael Costa"


def test_login_invalid_credentials_generic_message():
    with pytest.raises(HTTPException) as exc_info:
        login(LoginRequest(login="usuario.inexistente@velocetech.com.br", password="errada"), db=_make_auth_db(None))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Credenciais inválidas. Verifique seu e-mail/matrícula e senha."


def test_login_rejects_inactive_user_and_returns_503_when_supabase_offline():
    inactive = _mock_user_row(
        email="inativo@velocetech.com.br",
        matricula="VLC-00001",
        name="Inativo",
        role="TECNICO_OPERACIONAL",
        role_label="Técnico de Campo",
        ativo=False,
    )
    with pytest.raises(HTTPException) as exc_401:
        login(LoginRequest(login="inativo@velocetech.com.br", password="veloce@2026"), db=_make_auth_db(inactive))
    assert exc_401.value.status_code == 401

    broken_db = MagicMock()
    broken_db.execute.side_effect = OperationalError("SELECT", {}, Exception("connection refused"))
    with pytest.raises(HTTPException) as exc_503:
        login(LoginRequest(login="ti.admin@velocetech.com.br", password="veloce@2026"), db=broken_db)
    assert exc_503.value.status_code == 503
    assert "Supabase" in exc_503.value.detail


def test_get_current_user_me():
    row = _mock_user_row(
        email="ti.admin@velocetech.com.br",
        matricula="VLC-90812",
        name="Ana Beatriz Souza",
        role="TI_ADMIN",
        role_label="TI - Administrador",
    )
    res = get_current_user(authorization=f"Bearer jwt_rs256_TI_ADMIN_{row.id_usuario}_abc123", db=_make_auth_db(row))
    assert res.role == "TI_ADMIN"
    assert res.name == "Ana Beatriz Souza"


def test_get_current_user_unauthorized():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=None, db=_make_auth_db(None))
    assert exc_info.value.status_code == 401


def test_logout():
    res = logout()
    assert "sucesso" in res["message"]
