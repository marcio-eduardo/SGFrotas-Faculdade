from decimal import Decimal
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status as http_status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
from backend.app.core.database import sanitize_db_error
from backend.app.schemas.veiculo import (
    VeiculoKPISummary,
    VeiculoRead,
    PaginatedVeiculos,
    DashboardAnalyticsResponse,
    DonutSegment,
    RankingItem,
    RevisaoAlertaItem,
    FranquiaStats,
    CombustivelPumpItem,
    CombustivelDetalheStats,
    RegiaoMapaItem,
    AtpResumoItem,
)

class FrotaService:

    @staticmethod
    def get_kpis(db: Session) -> VeiculoKPISummary:
        """Calcula os 4 KPIs executivos da Torre de Controle exclusivamente no Supabase."""
        try:
            # 1. Totais da frota
            query_totais = text("""
                SELECT 
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status_operacional = 'EM_USO') AS em_uso,
                    COUNT(*) FILTER (WHERE status_operacional = 'DISPONIVEL') AS disponiveis,
                    COUNT(*) FILTER (WHERE status_operacional = 'MANUTENCAO') AS manutencao,
                    COUNT(*) FILTER (WHERE status_operacional = 'SINISTRADO') AS sinistrados
                FROM tb_frota_veiculos;
            """)
            r_totais = db.execute(query_totais).fetchone()
            total = r_totais.total or 0
            em_uso = r_totais.em_uso or 0
            disponiveis = r_totais.disponiveis or 0
            manutencao = r_totais.manutencao or 0
            sinistrados = r_totais.sinistrados or 0
            taxa = round((em_uso / total * 100), 1) if total > 0 else 0.0

            # 2. Revisões urgentes ou vencidas
            query_rev = text("""
                SELECT COUNT(*) 
                FROM vw_frota_alertas_manutencao 
                WHERE status_alerta_revisao IN ('REVISAO_VENCIDA', 'ALERTA_CRITICO');
            """)
            revisoes_urgentes = db.execute(query_rev).scalar() or 0

            # 3. Multas pendentes de indicação
            query_multas = text("""
                SELECT COUNT(*) 
                FROM tb_frota_multas 
                WHERE condutor_indicado = FALSE;
            """)
            multas_pendentes = db.execute(query_multas).scalar() or 0

            # 4. Alertas de auditoria: veículos sob posse de técnicos inativos
            query_inativos = text("""
                SELECT COUNT(*) 
                FROM vw_frota_alerta_condutor_inativo;
            """)
            alertas_inativos = db.execute(query_inativos).scalar() or 0

            return VeiculoKPISummary(
                total_veiculos=total,
                em_uso=em_uso,
                disponiveis=disponiveis,
                em_manutencao=manutencao,
                sinistrados=sinistrados,
                taxa_utilizacao_percent=taxa,
                revisoes_urgentes_ou_vencidas=revisoes_urgentes,
                multas_pendentes_indicacao=multas_pendentes,
                veiculos_condutor_inativo=alertas_inativos
            )
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Banco PostgreSQL (Supabase) indisponível ao consultar KPIs: {sanitize_db_error(exc)}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao calcular KPIs no Supabase: {sanitize_db_error(exc)}",
            ) from exc

    @staticmethod
    def list_veiculos(
        db: Session,
        status: Optional[str] = None,
        base_id: Optional[int] = None,
        busca: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> PaginatedVeiculos:
        """Lista veículos a partir da view consolidada vw_frota_painel_geral com filtros e fallback resiliente."""
        try:
            where_clauses = []
            params: Dict[str, Any] = {}

            if status and status.upper() != "TODOS":
                where_clauses.append("status_operacional = :status")
                params["status"] = status.upper()

            if base_id:
                where_clauses.append("id_base = :base_id")
                params["base_id"] = base_id

            if busca:
                where_clauses.append("(placa ILIKE :busca OR modelo ILIKE :busca OR condutor_atual_nome ILIKE :busca OR base_cidade ILIKE :busca OR base_nome ILIKE :busca)")
                params["busca"] = f"%{busca}%"

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            # Contagem total
            count_sql = text(f"SELECT COUNT(*) FROM vw_frota_painel_geral {where_sql};")
            total = db.execute(count_sql, params).scalar() or 0

            # Paginação
            offset = (page - 1) * page_size
            params["limit"] = page_size
            params["offset"] = offset

            data_sql = text(f"""
                SELECT 
                    id_veiculo, placa, modelo, marca, ano, status_operacional,
                    hodometro_atual, franquia_mensal_km, franquia_final_km, custo_locacao_mensal,
                    data_inicio_contrato, data_fim_contrato, dias_para_fim_contrato, status_vigencia_contrato,
                    locadora_nome, base_nome, base_cidade, base_uf, base_regiao, base_codigo_atp,
                    condutor_atual_id, condutor_atual_nome, condutor_atual_matricula, condutor_atual_ativo
                FROM vw_frota_painel_geral
                {where_sql}
                ORDER BY placa ASC
                LIMIT :limit OFFSET :offset;
            """)

            rows = db.execute(data_sql, params).fetchall()
            items = [
                VeiculoRead(
                    id_veiculo=r.id_veiculo,
                    placa=r.placa,
                    modelo=r.modelo,
                    marca=r.marca,
                    ano=r.ano,
                    status_operacional=r.status_operacional,
                    hodometro_atual=r.hodometro_atual,
                    franquia_mensal_km=r.franquia_mensal_km,
                    franquia_final_km=r.franquia_final_km,
                    custo_locacao_mensal=r.custo_locacao_mensal,
                    data_inicio_contrato=r.data_inicio_contrato,
                    data_fim_contrato=r.data_fim_contrato,
                    dias_para_fim_contrato=r.dias_para_fim_contrato,
                    status_vigencia_contrato=r.status_vigencia_contrato,
                    locadora_nome=r.locadora_nome,
                    base_nome=r.base_nome,
                    base_cidade=r.base_cidade,
                    base_uf=r.base_uf,
                    base_regiao=r.base_regiao,
                    base_codigo_atp=r.base_codigo_atp,
                    condutor_atual_id=r.condutor_atual_id,
                    condutor_atual_nome=r.condutor_atual_nome,
                    condutor_atual_matricula=r.condutor_atual_matricula,
                    condutor_atual_ativo=r.condutor_atual_ativo
                )
                for r in rows
            ]

            return PaginatedVeiculos(
                total=total,
                page=page,
                page_size=page_size,
                items=items
            )
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Banco PostgreSQL (Supabase) indisponível ao listar veículos: {sanitize_db_error(exc)}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao listar veículos no Supabase: {sanitize_db_error(exc)}",
            ) from exc

    @staticmethod
    def get_veiculo_por_placa(db: Session, placa: str) -> Optional[Dict[str, Any]]:
        """Retorna ficha completa de um veículo: dados, condutor, revisões e multas."""
        placa_clean = placa.strip().upper().replace("-", "")
        veic_sql = text("SELECT * FROM vw_frota_painel_geral WHERE placa = :placa;")
        v = db.execute(veic_sql, {"placa": placa_clean}).fetchone()
        if not v:
            return None

        # Histórico de revisões
        rev_sql = text("""
            SELECT id_manutencao, ciclo_km, odometro_momento, proxima_revisao_km, data_realizacao, status, notas
            FROM tb_frota_manutencoes
            WHERE id_veiculo = :id_veiculo
            ORDER BY created_at DESC;
        """)
        revisoes = [dict(r._mapping) for r in db.execute(rev_sql, {"id_veiculo": v.id_veiculo}).fetchall()]

        # Histórico de multas
        multas_sql = text("""
            SELECT id_multa, numero_ait, data_hora_infracao, descricao_infracao, gravidade, pontuacao, valor_original, condutor_indicado, status_pagamento
            FROM tb_frota_multas
            WHERE id_veiculo = :id_veiculo
            ORDER BY data_hora_infracao DESC;
        """)
        multas = [dict(r._mapping) for r in db.execute(multas_sql, {"id_veiculo": v.id_veiculo}).fetchall()]

        data = dict(v._mapping)
        data["historico_revisoes"] = revisoes
        data["historico_multas"] = multas
        return data

    @staticmethod
    def _format_litros_ptbr(litros: float) -> str:
        return f"{round(litros):,} L".replace(",", ".")

    @staticmethod
    def _classify_fuel_categoria(tipo: str) -> str:
        t_upper = (tipo or "").upper()
        if "ETANOL" in t_upper or "ALCOOL" in t_upper or "ÁLCOOL" in t_upper:
            return "ETANOL"
        if "GASOLINA" in t_upper:
            return "GASOLINA"
        if "DIESEL" in t_upper:
            return "DIESEL"
        return "SERVICOS"

    @staticmethod
    def _resolve_regiao_oficial(uf: Optional[str], regiao_raw: Optional[str] = None) -> str:
        uf_to_regiao_5 = {
            "AC": "NORTE", "AM": "NORTE", "AP": "NORTE", "PA": "NORTE",
            "RO": "NORTE", "RR": "NORTE", "TO": "NORTE",
            "AL": "NORDESTE", "BA": "NORDESTE", "CE": "NORDESTE", "MA": "NORDESTE",
            "PB": "NORDESTE", "PE": "NORDESTE", "PI": "NORDESTE", "RN": "NORDESTE", "SE": "NORDESTE",
            "DF": "CENTRO_OESTE", "GO": "CENTRO_OESTE", "MT": "CENTRO_OESTE", "MS": "CENTRO_OESTE",
            "ES": "SUDESTE", "MG": "SUDESTE", "RJ": "SUDESTE", "SP": "SUDESTE",
            "PR": "SUL", "RS": "SUL", "SC": "SUL",
        }
        uf_clean = (uf or "").strip().upper()
        if uf_clean in uf_to_regiao_5:
            return uf_to_regiao_5[uf_clean]
        reg_clean = (regiao_raw or "").strip().upper().replace("-", "_").replace(" ", "_")
        if reg_clean in ("NORTE", "NORDESTE", "CENTRO_OESTE", "SUDESTE", "SUL"):
            return reg_clean
        return "SUDESTE"

    @staticmethod
    def _compute_eficiencia_media_kml(db: Session) -> Optional[float]:
        try:
            cols_sql = text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tb_valecard_transacoes'
                  AND column_name IN ('consumo_medio_kml', 'consumo_kml', 'distancia_percorrida', 'km_rodado');
            """)
            avail_cols = {str(r[0]).lower() for r in db.execute(cols_sql).fetchall()}

            avg_kml = None
            if "consumo_medio_kml" in avail_cols:
                avg_kml = db.execute(text("""
                    SELECT AVG(consumo_medio_kml)
                    FROM tb_valecard_transacoes
                    WHERE consumo_medio_kml BETWEEN 3 AND 25;
                """)).scalar()
            elif "consumo_kml" in avail_cols:
                avg_kml = db.execute(text("""
                    SELECT AVG(consumo_kml)
                    FROM tb_valecard_transacoes
                    WHERE consumo_kml BETWEEN 3 AND 25;
                """)).scalar()

            if avg_kml is not None:
                val = float(avg_kml)
                if 3.0 <= val <= 25.0:
                    return round(val, 1)

            eff_row = None
            if "distancia_percorrida" in avail_cols:
                eff_row = db.execute(text("""
                    SELECT
                        COALESCE(SUM(distancia_percorrida), 0) AS total_dist,
                        COALESCE(SUM(quantidade_litros), 0) AS total_litros
                    FROM tb_valecard_transacoes
                    WHERE distancia_percorrida > 0 AND quantidade_litros > 0;
                """)).fetchone()
            elif "km_rodado" in avail_cols:
                eff_row = db.execute(text("""
                    SELECT
                        COALESCE(SUM(km_rodado), 0) AS total_dist,
                        COALESCE(SUM(quantidade_litros), 0) AS total_litros
                    FROM tb_valecard_transacoes
                    WHERE km_rodado > 0 AND quantidade_litros > 0;
                """)).fetchone()

            if eff_row and float(eff_row.total_litros or 0) > 0:
                val = float(eff_row.total_dist or 0) / float(eff_row.total_litros)
                if 3.0 <= val <= 25.0:
                    return round(val, 1)
        except Exception:
            return None
        return None

    @staticmethod
    def get_dashboard_analytics(db: Session) -> DashboardAnalyticsResponse:
        """Calcula métricas agregadas de BI (Revisões, Combustível, Regiões, Rankings e Franquia) a partir do PostgreSQL."""
        try:
            # 1. Status de Revisões Periódicas (vw_frota_alertas_manutencao)
            rev_sql = text("""
                SELECT 
                    placa, modelo, nome_atp, hodometro_atual, km_restante_revisao, status_alerta_revisao
                FROM vw_frota_alertas_manutencao
                ORDER BY km_restante_revisao ASC;
            """)
            rev_rows = db.execute(rev_sql).fetchall()

            total_rev = len(rev_rows)
            em_dia = 0
            proxima = 0
            vencida = 0
            alertas_revisao: List[RevisaoAlertaItem] = []
            revisoes_criticas_lista: List[RevisaoAlertaItem] = []
            revisoes_lista_completa: List[RevisaoAlertaItem] = []

            for i, r in enumerate(rev_rows):
                status_raw = str(r.status_alerta_revisao or 'REGULAR').upper()
                km_rest = int(r.km_restante_revisao or 0)
                if status_raw == 'REVISAO_VENCIDA' or km_rest <= 0:
                    vencida += 1
                    status_ui = 'vencida'
                elif status_raw in ('ALERTA_CRITICO', 'PROGRAMAR_REVISAO') or km_rest <= 1000:
                    proxima += 1
                    status_ui = 'critica' if km_rest <= 500 else 'atencao'
                else:
                    em_dia += 1
                    status_ui = 'regular'

                alerta_item = RevisaoAlertaItem(
                    id=i + 1,
                    placa=r.placa,
                    modelo=r.modelo or 'Renault Kwid',
                    atp=r.nome_atp or 'Central',
                    hodometro=f"{int(r.hodometro_atual or 0):,}".replace(",", "."),
                    restanteKm=max(km_rest, 0),
                    status=status_ui
                )
                revisoes_lista_completa.append(alerta_item)
                if i < 5:
                    alertas_revisao.append(alerta_item)
                if (km_rest <= 1500 or status_ui in ('vencida', 'critica', 'atencao')) and len(revisoes_criticas_lista) < 15:
                    revisoes_criticas_lista.append(alerta_item)

            if total_rev > 0:
                pct_em_dia = round((em_dia / total_rev) * 100, 1)
                pct_proxima = round((proxima / total_rev) * 100, 1)
                pct_vencida = round((vencida / total_rev) * 100, 1)
            else:
                pct_em_dia, pct_proxima, pct_vencida = 71.4, 14.3, 14.3

            donut_revisoes = [
                DonutSegment(label="Em Dia (> 1.000 Km)", value=f"{em_dia} veíc.", percentage=pct_em_dia, color="#10B981"),
                DonutSegment(label="Próxima (< 1.000 Km)", value=f"{proxima} veíc.", percentage=pct_proxima, color="#F59E0B"),
                DonutSegment(label="Revisão Vencida", value=f"{vencida} veíc.", percentage=pct_vencida, color="#F43F5E"),
            ]

            # 2. Resumo de Combustível ValeCard (tb_valecard_transacoes)
            comb_sql = text("""
                SELECT 
                    COALESCE(tipo_combustivel, 'GASOLINA COMUM') AS tipo,
                    COUNT(*) AS qtd,
                    COALESCE(SUM(quantidade_litros), 0) AS total_litros,
                    COALESCE(SUM(valor_total), 0) AS valor_total
                FROM tb_valecard_transacoes
                GROUP BY tipo_combustivel
                ORDER BY total_litros DESC;
            """)
            comb_rows = db.execute(comb_sql).fetchall()
            total_litros = sum(float(r.total_litros or 0) for r in comb_rows)

            if total_litros > 0:
                donut_combustivel: List[DonutSegment] = []
                fuel_colors = {
                    "GASOLINA": "#10B981",
                    "ETANOL": "#0284C7",
                    "DIESEL": "#F59E0B",
                    "SERVICOS": "#64748B",
                }
                real_fuel_rows = []
                service_rows = []
                for r in comb_rows:
                    cat = FrotaService._classify_fuel_categoria(str(r.tipo))
                    if cat in ("ETANOL", "GASOLINA", "DIESEL"):
                        real_fuel_rows.append((cat, r))
                    else:
                        service_rows.append((cat, r))

                ordered_rows = real_fuel_rows + service_rows
                for cat, r in ordered_rows:
                    litros_val = float(r.total_litros or 0)
                    c_pct = round((litros_val / total_litros) * 100, 1)
                    donut_combustivel.append(
                        DonutSegment(
                            label=str(r.tipo).strip().title(),
                            value=FrotaService._format_litros_ptbr(litros_val),
                            percentage=c_pct,
                            color=fuel_colors.get(cat, "#10B981"),
                        )
                    )

                etanol_litros = sum(float(r.total_litros or 0) for cat, r in real_fuel_rows if cat == "ETANOL")
                gasolina_litros = sum(float(r.total_litros or 0) for cat, r in real_fuel_rows if cat == "GASOLINA")
                total_real_comb = sum(float(r.total_litros or 0) for _, r in real_fuel_rows)
                flex_total = etanol_litros + gasolina_litros
                if flex_total > 0:
                    etanol_pct = round((etanol_litros / flex_total) * 100, 1)
                    gasolina_pct = round(100.0 - etanol_pct, 1)
                else:
                    etanol_pct = 0.0
                    gasolina_pct = 0.0

                combustiveis_items = [
                    CombustivelPumpItem(
                        categoria=cat,
                        label=str(r.tipo).strip().title(),
                        litros=round(float(r.total_litros or 0), 2),
                        litrosFormatado=FrotaService._format_litros_ptbr(float(r.total_litros or 0)),
                        percentage=round((float(r.total_litros or 0) / total_real_comb) * 100, 1) if total_real_comb > 0 else 0.0,
                        abastecimentos=int(getattr(r, "qtd", 0) or 0),
                        valorTotal=round(float(getattr(r, "valor_total", 0) or 0), 2),
                    )
                    for cat, r in real_fuel_rows
                ]

                total_serv_qtd = sum(int(getattr(r, "qtd", 0) or 0) for _, r in service_rows)
                total_serv_litros = sum(float(r.total_litros or 0) for _, r in service_rows)
                servicos_items = []
                for cat, r in service_rows:
                    qtd_val = int(getattr(r, "qtd", 0) or 0)
                    litros_val = float(r.total_litros or 0)
                    if total_serv_qtd > 0:
                        srv_pct = round((qtd_val / total_serv_qtd) * 100, 1)
                    elif total_serv_litros > 0:
                        srv_pct = round((litros_val / total_serv_litros) * 100, 1)
                    else:
                        srv_pct = 0.0
                    servicos_items.append(
                        CombustivelPumpItem(
                            categoria=cat,
                            label=str(r.tipo).strip().title(),
                            litros=round(litros_val, 2),
                            litrosFormatado=FrotaService._format_litros_ptbr(litros_val),
                            percentage=srv_pct,
                            abastecimentos=qtd_val,
                            valorTotal=round(float(getattr(r, "valor_total", 0) or 0), 2),
                        )
                    )

                eficiencia_kml = FrotaService._compute_eficiencia_media_kml(db)
                combustivel_stats = CombustivelDetalheStats(
                    etanolLitros=round(etanol_litros, 2),
                    etanolFormatado=FrotaService._format_litros_ptbr(etanol_litros),
                    etanolPct=etanol_pct,
                    gasolinaLitros=round(gasolina_litros, 2),
                    gasolinaFormatado=FrotaService._format_litros_ptbr(gasolina_litros),
                    gasolinaPct=gasolina_pct,
                    totalCombustivelLitrosFormatado=FrotaService._format_litros_ptbr(
                        total_real_comb if total_real_comb > 0 else total_litros
                    ),
                    eficienciaMediaKmL=eficiencia_kml,
                    combustiveis=combustiveis_items,
                    servicos=servicos_items,
                )
            else:
                donut_combustivel = []
                combustivel_stats = CombustivelDetalheStats(
                    etanolLitros=0.0,
                    etanolFormatado="0 L",
                    etanolPct=0.0,
                    gasolinaLitros=0.0,
                    gasolinaFormatado="0 L",
                    gasolinaPct=0.0,
                    totalCombustivelLitrosFormatado="0 L",
                    eficienciaMediaKmL=None,
                    combustiveis=[],
                    servicos=[],
                )

            # 3. Distribuição Regional & Rankings (vw_frota_painel_geral)
            reg_sql = text("""
                SELECT 
                    placa, modelo, base_nome, base_cidade, base_uf, base_regiao, hodometro_atual,
                    condutor_atual_nome, franquia_mensal_km
                FROM vw_frota_painel_geral
                ORDER BY hodometro_atual DESC;
            """)
            veic_rows = db.execute(reg_sql).fetchall()

            uf_map = {
                "SP": "SUDESTE", "RJ": "SUDESTE", "MG": "SUDESTE", "ES": "SUDESTE",
                "PR": "SUL", "SC": "SUL", "RS": "SUL",
                "BA": "NORDESTE", "PE": "NORDESTE", "CE": "NORDESTE", "MA": "NORDESTE",
                "PB": "NORDESTE", "RN": "NORDESTE", "AL": "NORDESTE", "SE": "NORDESTE", "PI": "NORDESTE",
                "AM": "NORTE_COESTE", "PA": "NORTE_COESTE", "RO": "NORTE_COESTE", "AC": "NORTE_COESTE",
                "AP": "NORTE_COESTE", "TO": "NORTE_COESTE", "RR": "NORTE_COESTE",
                "GO": "NORTE_COESTE", "DF": "NORTE_COESTE", "MT": "NORTE_COESTE", "MS": "NORTE_COESTE"
            }
            reg_counts = {"SUDESTE": 0, "SUL": 0, "NORDESTE": 0, "NORTE_COESTE": 0}
            reg_counts_5: Dict[str, int] = {
                "SUDESTE": 0,
                "SUL": 0,
                "NORDESTE": 0,
                "CENTRO_OESTE": 0,
                "NORTE": 0,
            }
            ufs_por_regiao_5: Dict[str, set] = {k: set() for k in reg_counts_5}
            atps_fallback_map: Dict[tuple, int] = {}

            total_veiculos_ativos = len(veic_rows)
            total_frota = total_veiculos_ativos or 1
            total_km = 0

            veiculos_ranking = []
            condutores_ranking = []

            for i, r in enumerate(veic_rows):
                uf = (r.base_uf or "PR").upper()
                reg = uf_map.get(uf, "SUDESTE")
                reg_counts[reg] = reg_counts.get(reg, 0) + 1

                reg_5 = FrotaService._resolve_regiao_oficial(uf, getattr(r, "base_regiao", None))
                reg_counts_5[reg_5] = reg_counts_5.get(reg_5, 0) + 1
                if uf:
                    ufs_por_regiao_5[reg_5].add(uf)

                base_cidade_val = (getattr(r, "base_cidade", None) or "Não Informada").strip()
                base_nome_val = (getattr(r, "base_nome", None) or "ATP Central").strip()
                atp_key = (base_cidade_val, uf, reg_5, base_nome_val)
                atps_fallback_map[atp_key] = atps_fallback_map.get(atp_key, 0) + 1

                km_val = int(r.hodometro_atual or 0)
                total_km += km_val

                if i < 10:
                    base_label = r.base_cidade or r.base_nome or "ATP"
                    veiculos_ranking.append(
                        RankingItem(
                            id=i + 1,
                            title=r.placa,
                            subtitle=f"{r.modelo or 'Veículo'} • {base_label}",
                            km=km_val
                        )
                    )
                    c_nome = r.condutor_atual_nome or "Pátio / Sem condutor"
                    condutores_ranking.append(
                        RankingItem(
                            id=i + 1,
                            title=c_nome,
                            subtitle=f"Técnico de Campo • {base_label}",
                            km=km_val
                        )
                    )

            donut_regioes = [
                DonutSegment(
                    label="Sudeste (SP, RJ, MG)",
                    value=f"{reg_counts['SUDESTE']} veíc.",
                    percentage=round((reg_counts['SUDESTE'] / total_frota) * 100, 1),
                    color="#0080FF"
                ),
                DonutSegment(
                    label="Sul (PR, SC, RS)",
                    value=f"{reg_counts['SUL']} veíc.",
                    percentage=round((reg_counts['SUL'] / total_frota) * 100, 1),
                    color="#0EA5E9"
                ),
                DonutSegment(
                    label="Nordeste (BA, PE, CE)",
                    value=f"{reg_counts['NORDESTE']} veíc.",
                    percentage=round((reg_counts['NORDESTE'] / total_frota) * 100, 1),
                    color="#10B981"
                ),
                DonutSegment(
                    label="Norte / C-Oeste",
                    value=f"{reg_counts['NORTE_COESTE']} veíc.",
                    percentage=round((reg_counts['NORTE_COESTE'] / total_frota) * 100, 1),
                    color="#8B5CF6"
                ),
            ]

            # 4. ATPs Ativas por Região (tb_base_atp LEFT JOIN tb_frota_veiculos)
            atp_sql = text("""
                SELECT
                    COALESCE(NULLIF(TRIM(b.cidade), ''), 'Não Informada') AS base_cidade,
                    UPPER(COALESCE(NULLIF(TRIM(b.uf), ''), 'PR')) AS base_uf,
                    UPPER(COALESCE(NULLIF(TRIM(b.regiao), ''), '')) AS base_regiao,
                    b.nome_atp AS base_nome,
                    COUNT(v.id_veiculo) AS veiculos
                FROM tb_base_atp b
                LEFT JOIN tb_frota_veiculos v ON v.id_base = b.id_base
                WHERE COALESCE(b.ativa, TRUE) = TRUE
                GROUP BY b.cidade, b.uf, b.regiao, b.nome_atp
                ORDER BY COUNT(v.id_veiculo) DESC, b.nome_atp ASC;
            """)
            atp_rows = db.execute(atp_sql).fetchall()

            atps_por_regiao_5: Dict[str, int] = {k: 0 for k in reg_counts_5}
            atps_resumo: List[AtpResumoItem] = []

            if atp_rows:
                for r in atp_rows:
                    uf_atp = str(r.base_uf or "PR").upper()
                    reg_5 = FrotaService._resolve_regiao_oficial(uf_atp, getattr(r, "base_regiao", None))
                    atps_por_regiao_5[reg_5] = atps_por_regiao_5.get(reg_5, 0) + 1
                    if uf_atp:
                        ufs_por_regiao_5[reg_5].add(uf_atp)
                    atps_resumo.append(
                        AtpResumoItem(
                            cidade=str(r.base_cidade or "Não Informada"),
                            uf=uf_atp,
                            regiao=reg_5,
                            nomeAtp=str(r.base_nome or "ATP"),
                            veiculos=int(r.veiculos or 0),
                        )
                    )
            else:
                for (c_val, u_val, reg_5, nome_val), count_v in sorted(
                    atps_fallback_map.items(), key=lambda x: x[1], reverse=True
                ):
                    atps_por_regiao_5[reg_5] = atps_por_regiao_5.get(reg_5, 0) + 1
                    atps_resumo.append(
                        AtpResumoItem(
                            cidade=c_val,
                            uf=u_val,
                            regiao=reg_5,
                            nomeAtp=nome_val,
                            veiculos=count_v,
                        )
                    )

            regioes_meta = [
                ("SUDESTE", "Sudeste", "#0080FF"),
                ("SUL", "Sul", "#0EA5E9"),
                ("NORDESTE", "Nordeste", "#10B981"),
                ("CENTRO_OESTE", "Centro-Oeste", "#F59E0B"),
                ("NORTE", "Norte", "#3CDBC0"),
            ]
            regioes_mapa = [
                RegiaoMapaItem(
                    codigo=cod,
                    label=lbl,
                    siglasUfs=sorted(ufs_por_regiao_5.get(cod, set())),
                    veiculos=reg_counts_5.get(cod, 0),
                    percentage=round((reg_counts_5.get(cod, 0) / total_frota) * 100, 1),
                    atpsAtivas=atps_por_regiao_5.get(cod, 0),
                    color=cor,
                )
                for cod, lbl, cor in regioes_meta
            ]
            regioes_mapa.sort(key=lambda item: item.veiculos, reverse=True)

            media_km_mensal = round(total_km / (total_frota * 12)) if total_frota > 0 else 1850
            franquia_stats = FranquiaStats(
                franquiaContratada="2.800",
                mediaRealizada=f"{media_km_mensal:,}".replace(",", "."),
                utilizacaoPct=str(round((media_km_mensal / 2800) * 100, 1)),
                totalKm=f"{total_km:,}".replace(",", ".")
            )

            return DashboardAnalyticsResponse(
                revisoesConformidadePct=pct_em_dia,
                donutRevisoes=donut_revisoes,
                donutCombustivel=donut_combustivel,
                donutRegioes=donut_regioes,
                veiculosRanking=veiculos_ranking,
                condutoresRanking=condutores_ranking,
                veiculosRevisaoAlertas=alertas_revisao,
                franquiaStats=franquia_stats,
                revisoesTotalAtivos=total_rev,
                revisoesCriticasLista=revisoes_criticas_lista,
                revisoesListaCompleta=revisoes_lista_completa,
                combustivelStats=combustivel_stats,
                regioesMapa=regioes_mapa,
                atpsResumo=atps_resumo,
                totalAtpsAtivas=len(atps_resumo),
                totalVeiculosAtivos=total_veiculos_ativos,
            )
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Banco PostgreSQL (Supabase) indisponível ao consultar analytics: {sanitize_db_error(exc)}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao calcular analytics no Supabase: {sanitize_db_error(exc)}",
            ) from exc
