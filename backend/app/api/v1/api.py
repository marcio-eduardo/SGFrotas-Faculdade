from fastapi import APIRouter
from backend.app.api.v1.endpoints import veiculos, cautela, manutencoes, multas, tecnicos, valecard, auth

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação & RBAC (SGFrotas)"])
api_router.include_router(veiculos.router, prefix="/veiculos", tags=["Torre de Controle - Veículos & KPIs"])
api_router.include_router(cautela.router, prefix="/cautela", tags=["Jornada do Técnico - Cautela Ativa (PWA)"])
api_router.include_router(manutencoes.router, prefix="/manutencoes", tags=["Manutenção Preventiva & Revisões"])
api_router.include_router(multas.router, prefix="/multas", tags=["Multas & Prevenção de Multa NIC"])
api_router.include_router(tecnicos.router, prefix="/tecnicos", tags=["Colaboradores & Aptidão de Condutores"])
api_router.include_router(valecard.router, prefix="/valecard", tags=["Gestão de Combustível - Integração ValeCard & Anti-Fraude"])

