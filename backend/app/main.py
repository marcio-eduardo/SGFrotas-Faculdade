from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
    ## 🚀 SGFrotas API - Sistema Integrado de Gestão de Frotas & Operações de Campo
    
    API REST oficial conectada ao **PostgreSQL Exclusivo (SGFrotas)** para gestão operacional da frota, manutenções, multas e abastecimento ValeCard.
    
    ### Principais Recursos Disponibilizados:
    * 🚗 **Torre de Controle:** 4 KPIs em tempo real, listagem filtrada por ATP, máquina de estados da frota e fichas completas.
    * 📱 **Jornada do Técnico (PWA Mobile):** Consulta de veículo cautelado, termo de alocação com trava anti-inativo e devolução com registro de odômetro.
    * ⏱️ **Prazos & Contratos Arval:** Monitoramento de vigência e desmobilização de ativos.
    * 🔧 **Manutenção Preventiva:** Acompanhamento de revisões periódicas a cada 10.000 km e quilometragem restante.
    * 🛡️ **Prevenção de Multa NIC:** Gestão de prazos de indicação de condutor e contagem regressiva para expirar o prazo no DETRAN/órgãos.
    """,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuração de CORS com suporte a qualquer porta de desenvolvimento local
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Data-Source"],
)

# Handler Global para garantir headers CORS mesmo em caso de erro 500 não tratado
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno no servidor SGFrotas.", "error": str(exc)},
        headers=headers
    )

# Registra as rotas da versão 1
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Healthcheck & Status"])
def root():
    """Endpoint raiz para verificação de status da API."""
    return {
        "status": "online",
        "projeto": settings.PROJECT_NAME,
        "versao": settings.VERSION,
        "banco": "PostgreSQL Central (Produção)",
        "documentacao_swagger": "/docs",
        "documentacao_redoc": "/redoc"
    }

@app.get("/health", tags=["Healthcheck & Status"])
def healthcheck():
    """Healthcheck para monitoramento e orquestradores."""
    return {"status": "healthy"}
