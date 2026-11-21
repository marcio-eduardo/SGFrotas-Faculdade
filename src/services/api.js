/**
 * SGFrotas API Client
 * Integração Frontend Vite <-> FastAPI Backend (PostgreSQL Central)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      let msg = errorBody.detail || `HTTP Error ${res.status}: ${res.statusText}`;
      if (Array.isArray(msg)) {
        msg = msg.map((m) => (typeof m === 'object' ? m.msg || m.message || JSON.stringify(m) : String(m))).join('; ');
      } else if (typeof msg === 'object') {
        msg = JSON.stringify(msg);
      }
      throw new Error(msg);
    }

    return await res.json();
  } catch (error) {
    // Propaga erro real da API/Supabase para tratamento explícito na interface
    throw error;
  }
}

export const api = {
  // 0. Autenticação e Diagnóstico (100% Supabase tb_usuarios)
  async login({ login, password }) {
    return fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
  },

  async getMe(token) {
    return fetchJson('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async logout(token) {
    return fetchJson('/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  async getHealth() {
    const rootBase = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${rootBase}/health`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  },

  // 1. KPIs da Torre de Controle
  async getKPIs() {
    return fetchJson('/veiculos/kpis');
  },

  // 1.1 Analytics do Dashboard Executivo (Revisões, Combustível, Regiões, Rankings e Franquia)
  async getDashboardAnalytics() {
    return fetchJson('/veiculos/dashboard-analytics');
  },

  // 2. Listagem Paginada de Veículos
  async getVeiculos({ status = '', baseId = null, busca = '', page = 1, pageSize = 250 } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'TODOS') params.append('status', status);
    if (baseId) params.append('base_id', baseId);
    if (busca) params.append('busca', busca);
    params.append('page', page);
    params.append('page_size', pageSize);

    return fetchJson(`/veiculos?${params.toString()}`);
  },

  // 3. Ficha Completa do Veículo por Placa
  async getVeiculoPorPlaca(placa) {
    return fetchJson(`/veiculos/${encodeURIComponent(placa)}`);
  },

  // 4. Manutenções Preventivas e Alertas Periódicos (10.000 km)
  async getAlertasManutencao(statusAlerta = null) {
    const param = statusAlerta ? `?status_alerta=${statusAlerta}` : '';
    return fetchJson(`/manutencoes/alertas-preventivos${param}`);
  },

  // 5. Multas Pendentes de Indicação (Controle NIC)
  async getMultasPendentesIndicacao() {
    return fetchJson('/multas/pendentes-indicacao');
  },

  // 6. Indicação de Condutor
  async indicarCondutor(idMulta, payload) {
    return fetchJson(`/multas/${idMulta}/indicar-condutor`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 6.1 Motor Anti-NIC: Identificação Temporal de Condutor por Placa e Data/Hora
  async identificarCondutorPorInfracao(placa, dataHora) {
    const params = new URLSearchParams({ placa, data_hora: dataHora });
    return fetchJson(`/multas/identificar-condutor?${params.toString()}`);
  },

  // 7. Lista de Técnicos Aptos (Filtra inativos e CNHs irregulares)
  async getTecnicosAptos(apenasAptos = true) {
    return fetchJson(`/tecnicos/aptos-cautela?apenas_aptos=${apenasAptos}`);
  },

  // 8. PWA do Técnico: Consulta de Veículo Cautelado
  async getMeuVeiculo({ idTecnico = null, matricula = null } = {}) {
    const params = new URLSearchParams();
    if (idTecnico) params.append('id_tecnico', idTecnico);
    if (matricula) params.append('matricula', matricula);
    return fetchJson(`/cautela/meu-veiculo?${params.toString()}`);
  },

  // 9. Cautela: Alocar Veículo
  async alocarVeiculo(payload) {
    return fetchJson('/cautela/alocar', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 10. Cautela: Devolver Veículo
  async devolverVeiculo(payload) {
    return fetchJson('/cautela/devolver', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // =========================================================================
  // VALECARD REST INTEGRATION SUITE (OFICIAL)
  // =========================================================================

  // 11. KPIs de Combustível e Consumo da Frota
  async getValeCardKPIs() {
    return fetchJson('/valecard/transacoes/kpis/resumo');
  },

  // 12. Listagem Paginada de Transações de Abastecimento
  async getValeCardTransacoes({ limit = 50, offset = 0, placa = '', statusAuditoria = '' } = {}) {
    const params = new URLSearchParams();
    params.append('limit', limit);
    params.append('skip', offset);
    if (placa) params.append('placa', placa);
    if (statusAuditoria && statusAuditoria !== 'TODOS') params.append('status_auditoria', statusAuditoria);
    return fetchJson(`/valecard/transacoes?${params.toString()}`);
  },

  // 13. Sincronização Sob Demanda de Transações (Webservice 02)
  async syncValeCardTransacoes(payload = {}) {
    const hoje = new Date();
    const dataFim = hoje.toISOString().split('T')[0];
    const dataIni = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const body = {
      data_inicial: payload.data_inicial || dataIni,
      data_final: payload.data_final || dataFim,
      tipo_transacao: payload.tipo_transacao || 'TODAS',
      placa: payload.placa || null,
    };

    return fetchJson('/valecard/transacoes/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // 14. Consulta de Alertas Anti-Fraude
  async getValeCardAlertas({ statusAlerta = 'PENDENTE', limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (statusAlerta && statusAlerta !== 'TODOS') params.append('status_resolucao', statusAlerta);
    params.append('skip', offset);
    params.append('limit', limit);
    return fetchJson(`/valecard/alertas?${params.toString()}`);
  },

  // 15. Resolução Auditada de Alerta de Fraude
  async resolverAlertaValeCard(
    idAlerta,
    { status_resolucao, justificativa_gestor, resolvido_por = null, acao, observacao, resolvidoPor = null }
  ) {
    return fetchJson(`/valecard/alertas/${idAlerta}/resolver`, {
      method: 'POST',
      body: JSON.stringify({
        status_resolucao: status_resolucao || (acao === 'CONFIRMADO' ? 'CONFIRMADO_FRAUDE' : acao),
        justificativa_gestor: justificativa_gestor || observacao,
        resolvido_por: resolvido_por ?? resolvidoPor,
      }),
    });
  },

  // 16. Consulta de Cartões da Frota
  async getValeCardCartoes({ limit = 50, offset = 0, placa = '', status = '' } = {}) {
    const params = new URLSearchParams();
    params.append('limit', limit);
    params.append('skip', offset);
    if (placa) params.append('placa', placa);
    if (status && status !== 'TODOS') params.append('status_cartao', status);
    return fetchJson(`/valecard/cartoes?${params.toString()}`);
  },

  // 17. Sincronização de Cartões (Webservice 05)
  async syncValeCardCartoes() {
    return fetchJson('/valecard/cartoes/sync', {
      method: 'POST',
    });
  },

  // 18. Solicitação de 2ª Via de Cartão (Webservice 08)
  async solicitar2ViaValeCard({ numeroCartao, placa, motivo, solicitadoPor = 1 }) {
    return fetchJson('/valecard/cartoes/solicitar-2via', {
      method: 'POST',
      body: JSON.stringify({
        numero_cartao: numeroCartao,
        placa,
        motivo,
        solicitado_por: solicitadoPor,
      }),
    });
  },

  // 19. Histórico de Solicitações de 2ª Via
  async getValeCardSolicitacoes2Via({ limit = 50 } = {}) {
    return fetchJson(`/valecard/cartoes/solicitacoes?limit=${limit}`);
  },

  // 20. Alteração de Limite na Bomba (Webservice 01)
  async alterarLimiteValeCard({
    placa,
    numeroCartao = null,
    tipoOperacao,
    valor,
    valor_alteracao,
    motivo,
    periodo = 'atual',
    modulo = 'abastecimento',
    solicitadoPor = null,
  }) {
    return fetchJson('/valecard/limites/alterar', {
      method: 'POST',
      body: JSON.stringify({
        placa,
        numero_cartao: numeroCartao,
        tipo_operacao: tipoOperacao,
        valor_alteracao: Number(valor_alteracao ?? valor),
        motivo,
        periodo,
        modulo,
        solicitado_por: solicitadoPor,
      }),
    });
  },

  // 21. Histórico de Alterações de Limite
  async getValeCardHistoricoLimites({ placa = '', limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (placa) params.append('placa', placa);
    params.append('limit', limit);
    return fetchJson(`/valecard/limites/historico?${params.toString()}`);
  },

  // 22. Veículos Cadastrados na ValeCard
  async getValeCardVeiculos({ limit = 50, offset = 0 } = {}) {
    return fetchJson(`/valecard/veiculos?limit=${limit}&skip=${offset}`);
  },

  // 23. Bloqueio Preventivo na Bomba (Oficina / Sinistro - Código 10)
  async bloquearBombaValeCard({ placa, bloquear, motivo }) {
    return fetchJson('/valecard/veiculos/bloqueio-bomba', {
      method: 'POST',
      body: JSON.stringify({
        placa,
        bloquear,
        motivo,
      }),
    });
  },

  // 24. Conciliação Fiscal de Nota Fiscal (Webservice 09)
  async conciliarFaturamentoValeCard({ dataInicio, dataFim, numeroTitulo = '' }) {
    return fetchJson('/valecard/faturamento/conciliar', {
      method: 'POST',
      body: JSON.stringify({
        data_inicio: dataInicio,
        data_fim: dataFim,
        numero_titulo: numeroTitulo,
      }),
    });
  },

  // 25. Histórico de Faturamentos Conciliados
  async getValeCardFaturamentos({ limit = 50 } = {}) {
    return fetchJson(`/valecard/faturamento?limit=${limit}`);
  },

  // 26. Estornos de Abastecimento (Webservice 10)
  async getValeCardEstornos({ limit = 50 } = {}) {
    return fetchJson(`/valecard/estornos?limit=${limit}`);
  },

  // 27. Diagnóstico de Conectividade (Supabase + KissAPI ValeCard)
  async getValeCardStatusConexao() {
    return fetchJson('/valecard/status-conexao');
  },
};
