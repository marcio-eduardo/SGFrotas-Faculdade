import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Filter,
  Clock,
  CheckCircle2,
  FileText,
  ExternalLink,
  ShieldAlert,
  Calendar,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';

const UF_TO_REGIAO = {
  SP: 'SUDESTE', RJ: 'SUDESTE', MG: 'SUDESTE', ES: 'SUDESTE',
  PR: 'SUL', SC: 'SUL', RS: 'SUL',
  BA: 'NORDESTE', PE: 'NORDESTE', CE: 'NORDESTE', MA: 'NORDESTE',
  PB: 'NORDESTE', RN: 'NORDESTE', AL: 'NORDESTE', SE: 'NORDESTE', PI: 'NORDESTE',
  GO: 'C-OESTE', MT: 'C-OESTE', MS: 'C-OESTE', DF: 'C-OESTE',
  AM: 'NORTE', PA: 'NORTE', AC: 'NORTE', RO: 'NORTE', RR: 'NORTE', AP: 'NORTE', TO: 'NORTE',
};

const mapApiMulta = (item) => ({
  idMulta: item.id_multa,
  ait: item.numero_ait,
  placa: item.veiculo_placa || 'N/D',
  condutor: item.condutor_nome || 'A identificar',
  matricula: item.condutor_matricula || null,
  uf: null,
  municipio: null,
  dataInfracao: item.data_hora_infracao
    ? new Date(item.data_hora_infracao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'N/D',
  descricao: item.descricao_infracao || 'Infração de trânsito',
  local: item.local_infracao || '',
  orgao: item.orgao_sigla || 'Órgão Autuador',
  gravidade: (item.gravidade || 'MEDIA').toUpperCase(),
  pontos: Number(item.pontuacao || 0),
  valor: Number(item.valor_original || 0),
  dataLimiteIndicacao: item.data_limite_indicacao
    ? new Date(`${item.data_limite_indicacao}T00:00:00`).toLocaleDateString('pt-BR')
    : 'N/D',
  diasRestantes: item.dias_para_vencer_indicacao,
  statusIndicacao: item.condutor_indicado ? 'INDICADO' : 'PENDENTE',
  linkDoc: item.link_documento || null,
});

export const MultasView = ({ searchTerm = '', selectedRegiao = 'TODAS' }) => {
  const [multas, setMultas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [filterGravidade, setFilterGravidade] = useState('TODAS');
  const [filterStatus, setFilterStatus] = useState('TODAS');

  const carregarMultas = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await api.getMultasPendentesIndicacao();
      setMultas(Array.isArray(res) ? res.map(mapApiMulta) : []);
    } catch (err) {
      setMultas([]);
      setApiError(err.message || 'Falha ao consultar multas pendentes no Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarMultas();
  }, [carregarMultas]);

  const multasFiltradas = useMemo(() => {
    return multas.filter((m) => {
      const term = (searchTerm || '').toLowerCase();
      const matchSearch =
        !term ||
        m.ait.toLowerCase().includes(term) ||
        m.placa.toLowerCase().includes(term) ||
        m.condutor.toLowerCase().includes(term) ||
        m.orgao.toLowerCase().includes(term) ||
        (m.municipio && m.municipio.toLowerCase().includes(term));

      const regiaoItem = m.uf ? UF_TO_REGIAO[m.uf] : null;
      const matchRegiao = selectedRegiao === 'TODAS' || !regiaoItem || regiaoItem === selectedRegiao;
      const matchGravidade = filterGravidade === 'TODAS' || m.gravidade === filterGravidade;
      const matchStatus = filterStatus === 'TODAS' || m.statusIndicacao === filterStatus;

      return matchSearch && matchRegiao && matchGravidade && matchStatus;
    });
  }, [multas, searchTerm, selectedRegiao, filterGravidade, filterStatus]);

  const resumo = useMemo(() => {
    const total = multas.length;
    const pendentes = multas.filter((m) => m.statusIndicacao === 'PENDENTE').length;
    const indicadas = multas.filter((m) => m.statusIndicacao === 'INDICADO').length;
    const valorTotal = multas.reduce((acc, m) => acc + Number(m.valor || 0), 0);
    return { total, pendentes, indicadas, valorTotal };
  }, [multas]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {apiError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <strong className="font-bold block">Supabase indisponível ao consultar multas</strong>
              <span>{apiError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={carregarMultas}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* 4 Cards de Resumo NIC & RH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-app-darkSurface p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total de Autuações</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{resumo.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {apiError ? 'Supabase indisponível' : 'Consulta direta ao Supabase'}
          </div>
        </div>

        <div className="bg-white dark:bg-app-darkSurface p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Risco Multa NIC</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{resumo.pendentes}</div>
          <div className="text-[10px] text-rose-600/80 font-bold mt-0.5">Pendentes de indicação</div>
        </div>

        <div className="bg-white dark:bg-app-darkSurface p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Condutor Indicado</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{resumo.indicadas}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Com indicação protocolada</div>
        </div>

        <div className="bg-white dark:bg-app-darkSurface p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total das Autuações</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            R$ {resumo.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Soma dos autos listados</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-app-darkSurface p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtros:</span>

          <select
            value={filterGravidade}
            onChange={(e) => setFilterGravidade(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
          >
            <option value="TODAS">Todas as Gravidades</option>
            <option value="GRAVISSIMA">Gravíssima (7 pts)</option>
            <option value="GRAVE">Grave (5 pts)</option>
            <option value="MEDIA">Média (4 pts)</option>
            <option value="LEVE">Leve (3 pts)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
          >
            <option value="TODAS">Todos os Status</option>
            <option value="PENDENTE">Pendente de Indicação (Risco NIC)</option>
            <option value="INDICADO">Condutor Indicado</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={carregarMultas}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-500' : ''}`} />
            <span>Atualizar</span>
          </button>
          <div className="text-xs font-medium text-slate-500">
            Exibindo <span className="font-bold text-slate-800 dark:text-white">{multasFiltradas.length}</span> infrações
          </div>
        </div>
      </div>

      {/* Tabela de Multas & Notificações */}
      <div className="bg-white dark:bg-app-darkSurface rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Auto (AIT)</th>
                <th className="py-3 px-4">Veículo / Local</th>
                <th className="py-3 px-4">Condutor</th>
                <th className="py-3 px-4">Data & Infração</th>
                <th className="py-3 px-4">Gravidade / Pontos</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Prazo NIC</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {multasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                    Nenhuma infração encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                multasFiltradas.map((m) => {
                  const isCritico = m.diasRestantes !== null && m.diasRestantes <= 5 && m.statusIndicacao === 'PENDENTE';

                  return (
                    <tr key={m.ait} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {m.ait}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-brand-600 dark:text-brand-400">{m.placa}</div>
                        <div className="text-[10px] text-slate-500">
                          {m.municipio && m.uf ? `${m.municipio}/${m.uf}` : m.orgao}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className={`font-semibold ${m.condutor === 'A identificar' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {m.condutor}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={m.orgao}>
                          {m.matricula ? `Matrícula: ${m.matricula}` : m.orgao}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-slate-200 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{m.dataInfracao}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[220px]" title={`${m.descricao}${m.local ? ` • ${m.local}` : ''}`}>
                          {m.descricao}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.gravidade === 'GRAVISSIMA'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                              : m.gravidade === 'GRAVE'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          }`}
                        >
                          {m.gravidade} ({m.pontos} pts)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        R$ {Number(m.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {m.statusIndicacao === 'INDICADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Indicado</span>
                          </span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCritico
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                {m.diasRestantes !== null
                                  ? m.diasRestantes < 0
                                    ? `Vencido (${Math.abs(m.diasRestantes)}d)`
                                    : `${m.diasRestantes} dias rest.`
                                  : 'Pendente'}
                              </span>
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5">Limite: {m.dataLimiteIndicacao}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {m.linkDoc ? (
                          <a
                            href={m.linkDoc}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              m.statusIndicacao === 'PENDENTE'
                                ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-xs'
                                : 'text-slate-500 hover:text-brand-600 font-medium'
                            }`}
                          >
                            <span>{m.statusIndicacao === 'PENDENTE' ? 'Indicar Online' : 'Protocolo'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sem link</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
