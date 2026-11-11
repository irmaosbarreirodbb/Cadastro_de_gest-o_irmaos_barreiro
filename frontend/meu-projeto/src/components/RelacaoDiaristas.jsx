import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Copy, 
  Check, 
  FileText, 
  Printer, 
  DollarSign, 
  Calendar as CalendarIcon, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  CalendarDays,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  BarChart2,
  Table as TableIcon,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  SlidersHorizontal,
  CalendarRange,
  Zap,
  X,
  CreditCard,
  Truck
} from 'lucide-react';
import RelatorioMensalModal from './RelatorioMensalModal';
import DrawerCadastrarDiarista from './diaristas/DrawerCadastrarDiarista';

export const DIARISTAS_INICIAIS = [];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_COMPLETO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function parseDataLocal(dataStr) {
  if (!dataStr) return new Date();
  const partes = dataStr.split('-');
  if (partes.length === 3) {
    return new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
  }
  return new Date(dataStr);
}

function getHojeStr() {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarDataBR(dataStr) {
  if (!dataStr) return '—';
  try {
    const partes = dataStr.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
}

function formatarDataExtenso(dataStr) {
  if (!dataStr) return '';
  try {
    const data = parseDataLocal(dataStr);
    const diaSem = DIAS_SEMANA_COMPLETO[data.getDay()];
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = MESES[data.getMonth()];
    const ano = data.getFullYear();
    return `${diaSem}, ${dia} de ${mes} de ${ano}`;
  } catch {
    return formatarDataBR(dataStr);
  }
}

function somarDias(dataStr, dias) {
  const data = parseDataLocal(dataStr);
  data.setDate(data.getDate() + dias);
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2).replace('.', ',');
}

export default function RelacaoDiaristas({ 
  diaristas = [], 
  dataSelecionada: propDataSelecionada,
  setDataSelecionada: propSetDataSelecionada,
  onNavigateCadastrar, 
  onAddDiarista,
  onEmitirRecibo, 
  onToggleStatus,
  onUpdateDiarista, 
  onDeleteDiarista, 
  onResetDiaristas, 
  onBack 
}) {
  const hoje = getHojeStr();
  const hojeDate = new Date();

  // Estados de Filtros e Visualização
  const [busca, setBusca] = useState('');
  const [abaStatus, setAbaStatus] = useState('todos'); // 'todos' | 'pendentes' | 'pagos'
  const [visualizacao, setVisualizacao] = useState('tabela'); // 'tabela' | 'cards'
  const [copiadoId, setCopiadoId] = useState(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [clonando, setClonando] = useState(false);

  // Data Padrão
  const getDataPadrao = () => {
    const datas = diaristas.map(d => d.data).filter(Boolean).sort().reverse();
    if (datas.includes(hoje)) return hoje;
    if (datas.length > 0) return datas[0];
    return hoje;
  };

  const [internalData, setInternalData] = useState(() => getDataPadrao());
  const activeData = propDataSelecionada || internalData;

  const setActiveData = (novaData) => {
    if (propSetDataSelecionada) propSetDataSelecionada(novaData);
    setInternalData(novaData);
  };

  // Ano e Mês selecionados para o calendário avançado
  const dataRefParsed = parseDataLocal(activeData);
  const [anoVigente, setAnoVigente] = useState(dataRefParsed.getFullYear());
  const [mesExpandidoIndex, setMesExpandidoIndex] = useState(dataRefParsed.getMonth());
  const [mostrarSubTabelaMeses, setMostrarSubTabelaMeses] = useState(false);

  // Modal do Relatório Mensal
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [mesSelecionadoRelatorio, setMesSelecionadoRelatorio] = useState(dataRefParsed.getMonth());
  const [anoSelecionadoRelatorio, setAnoSelecionadoRelatorio] = useState(dataRefParsed.getFullYear());
  const [autoDownloadRelatorio, setAutoDownloadRelatorio] = useState(false);

  const searchInputRef = useRef(null);

  // Atalhos de teclado (← dia anterior, → próximo dia, N nova diária, / busca)
  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        diaAnterior();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        diaSeguinte();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (onNavigateCadastrar) onNavigateCadastrar();
      } else if (e.key === '/') {
        e.preventDefault();
        if (searchInputRef.current) searchInputRef.current.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeData]);

  // Contagem por Data
  const contagemPorData = useMemo(() => {
    const mapa = {};
    diaristas.forEach((d) => {
      if (d.data) mapa[d.data] = (mapa[d.data] || 0) + 1;
    });
    return mapa;
  }, [diaristas]);

  // Total por Data
  const totalPorData = useMemo(() => {
    const mapa = {};
    diaristas.forEach((d) => {
      if (!d.data) return;
      const val = (parseFloat(d.valor) || 0) * (parseInt(d.diarias, 10) || 1);
      if (!mapa[d.data]) mapa[d.data] = { valor: 0, diarias: 0 };
      mapa[d.data].valor += val;
      mapa[d.data].diarias += parseInt(d.diarias, 10) || 1;
    });
    return mapa;
  }, [diaristas]);

  // Métricas por Mês
  const metricasPorMes = useMemo(() => {
    const mapa = {};
    diaristas.forEach((d) => {
      if (!d.data) return;
      const mesKey = d.data.substring(0, 7);
      const val = (parseFloat(d.valor) || 0) * (parseInt(d.diarias, 10) || 1);
      if (!mapa[mesKey]) mapa[mesKey] = { diaristasSet: new Set(), diarias: 0, valor: 0, totalRegistros: 0 };
      mapa[mesKey].diaristasSet.add((d.nome || '').trim().toUpperCase());
      mapa[mesKey].diarias += parseInt(d.diarias, 10) || 1;
      mapa[mesKey].valor += val;
      mapa[mesKey].totalRegistros += 1;
    });
    const resultado = {};
    Object.keys(mapa).forEach(k => {
      resultado[k] = {
        diaristasUnicos: mapa[k].diaristasSet.size,
        diarias: mapa[k].diarias,
        valor: mapa[k].valor,
        totalRegistros: mapa[k].totalRegistros,
      };
    });
    return resultado;
  }, [diaristas]);

  // Datas disponíveis
  const datasDisponiveis = useMemo(() => {
    const set = new Set();
    diaristas.forEach(d => { if (d.data) set.add(d.data); });
    return Array.from(set).sort().reverse();
  }, [diaristas]);

  // Última data com diaristas anterior à data ativa (para o Smart Clone)
  const ultimaDataComDiaristas = useMemo(() => {
    return datasDisponiveis.find(d => d < activeData) || datasDisponiveis[0] || null;
  }, [datasDisponiveis, activeData]);

  // Diaristas do dia ativo
  const diaristasDoDia = useMemo(() => {
    return diaristas.filter(item => item.data === activeData);
  }, [diaristas, activeData]);

  // Lista Filtrada por Busca e Abas (Todos / Pendentes / Pagos)
  const listaFiltrada = useMemo(() => {
    return diaristasDoDia.filter((item) => {
      // Filtro de aba
      if (abaStatus === 'pendentes' && item.pago) return false;
      if (abaStatus === 'pagos' && !item.pago) return false;

      // Filtro de busca
      const termo = busca.toLowerCase().trim();
      if (!termo) return true;
      return (
        (item.nome && item.nome.toLowerCase().includes(termo)) ||
        (item.motorista && item.motorista.toLowerCase().includes(termo)) ||
        (item.profissao && item.profissao.toLowerCase().includes(termo)) ||
        (item.pix && item.pix.toLowerCase().includes(termo))
      );
    });
  }, [diaristasDoDia, busca, abaStatus]);

  // Totais do dia ativo
  const totalDiariasQtd = diaristasDoDia.reduce((acc, curr) => acc + (parseInt(curr.diarias, 10) || 1), 0);
  const totalValorGeral = diaristasDoDia.reduce((acc, curr) => {
    const val = parseFloat(curr.valor) || 0;
    const qtd = parseInt(curr.diarias, 10) || 1;
    return acc + (val * qtd);
  }, 0);

  const totalValorPago = diaristasDoDia.reduce((acc, curr) => {
    if (!curr.pago) return acc;
    const val = parseFloat(curr.valor) || 0;
    const qtd = parseInt(curr.diarias, 10) || 1;
    return acc + (val * qtd);
  }, 0);

  const totalValorPendente = totalValorGeral - totalValorPago;
  const qtdPagos = diaristasDoDia.filter(d => d.pago).length;
  const qtdPendentes = diaristasDoDia.length - qtdPagos;

  // Fita de 7 Dias da Semana Atual
  const diasDaSemanaStrip = useMemo(() => {
    const dataRef = parseDataLocal(activeData);
    const diaSemanaIndex = dataRef.getDay(); // 0 = Domingo, 1 = Segunda ...
    
    // Calcula o início da semana (Segunda-feira como padrão operacional)
    const diffParaSegunda = diaSemanaIndex === 0 ? -6 : 1 - diaSemanaIndex;
    const dias = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(dataRef);
      d.setDate(dataRef.getDate() + diffParaSegunda + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const diaNum = String(d.getDate()).padStart(2, '0');
      const dataIso = `${y}-${m}-${diaNum}`;

      dias.push({
        dataIso,
        diaNumero: diaNum,
        diaSemanaAbrev: DIAS_SEMANA_ABREV[d.getDay()],
        isHoje: dataIso === hoje,
        isAtivo: dataIso === activeData,
        qtdDiaristas: contagemPorData[dataIso] || 0,
        temLancamento: !!contagemPorData[dataIso]
      });
    }
    return dias;
  }, [activeData, contagemPorData, hoje]);

  // Navegação
  function diaAnterior() {
    const novaData = somarDias(activeData, -1);
    setActiveData(novaData);
    const d = parseDataLocal(novaData);
    setMesExpandidoIndex(d.getMonth());
    setAnoVigente(d.getFullYear());
  }

  function diaSeguinte() {
    const novaData = somarDias(activeData, 1);
    setActiveData(novaData);
    const d = parseDataLocal(novaData);
    setMesExpandidoIndex(d.getMonth());
    setAnoVigente(d.getFullYear());
  }

  function irParaHoje() {
    setActiveData(hoje);
    const d = parseDataLocal(hoje);
    setMesExpandidoIndex(d.getMonth());
    setAnoVigente(d.getFullYear());
  }

  function handleCopiarPix(pix, id) {
    if (!pix) return;
    navigator.clipboard.writeText(pix);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  function handlePrint() {
    window.print();
  }

  function handleAbrirRelatorio(mesIdx, autoDownload = false) {
    const mesAlvo = mesIdx !== undefined && mesIdx !== null ? mesIdx : mesExpandidoIndex;
    setMesSelecionadoRelatorio(mesAlvo);
    setAnoSelecionadoRelatorio(anoVigente);
    setAutoDownloadRelatorio(autoDownload);
    setRelatorioAberto(true);
  }

  // Smart Clone: Clonar diaristas da data anterior
  async function handleClonarEquipeAnterior() {
    if (!ultimaDataComDiaristas) return;
    const diaristasParaClonar = diaristas.filter(d => d.data === ultimaDataComDiaristas);
    if (diaristasParaClonar.length === 0) return;

    if (!window.confirm(`Deseja replicar os ${diaristasParaClonar.length} diaristas de ${formatarDataBR(ultimaDataComDiaristas)} para ${formatarDataBR(activeData)}?`)) {
      return;
    }

    setClonando(true);
    try {
      for (const item of diaristasParaClonar) {
        const payload = {
          nome: item.nome,
          profissao: item.motorista || item.profissao || 'Diarista Geral',
          motorista: item.motorista || item.profissao || 'Diarista Geral',
          data: activeData,
          valor_diaria: item.valor,
          valor: item.valor,
          quantidade_diarias: item.diarias || 1,
          diarias: item.diarias || 1,
          valor_total: (parseFloat(item.valor) || 0) * (parseInt(item.diarias, 10) || 1),
          total: (parseFloat(item.valor) || 0) * (parseInt(item.diarias, 10) || 1),
          tipo_pix: item.tipoPix || 'cpf',
          tipoPix: item.tipoPix || 'cpf',
          chave_pix: item.pix || 'Não informada',
          pix: item.pix || 'Não informada',
          observacoes: item.observacoes || '',
          pago: false
        };

        if (onAddDiarista) {
          await onAddDiarista(payload);
        }
      }
    } catch (err) {
      console.error('Erro ao replicar equipe:', err);
      alert('Houve um problema ao replicar alguns registros.');
    } finally {
      setClonando(false);
    }
  }

  const isHoje = activeData === hoje;
  const totalLancamentosAno = Object.values(metricasPorMes).reduce((acc, m) => acc + (m.totalRegistros || 0), 0);

  return (
    <div className="space-y-4 w-full animate-fadeIn pb-12">

      {/* Modal do Relatório Mensal Oficial */}
      <RelatorioMensalModal
        isOpen={relatorioAberto}
        onClose={() => {
          setRelatorioAberto(false);
          setAutoDownloadRelatorio(false);
        }}
        diaristas={diaristas}
        mesInicial={mesSelecionadoRelatorio}
        anoInicial={anoSelecionadoRelatorio}
        autoDownload={autoDownloadRelatorio}
      />

      {/* Drawer Lateral para Cadastro Rápido de Nova Diária */}
      <DrawerCadastrarDiarista
        isOpen={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        dataPadrao={activeData}
        onSalvarDiarista={onAddDiarista}
        diaristasExistentes={diaristas}
      />

      {/* ================================================================= */}
      {/* 1. COCKPIT EXECUTIVO UNIFICADO (HEADER + MÉTRICAS + AÇÕES)         */}
      {/* ================================================================= */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-4 sm:p-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Lado Esquerdo: Voltar + Título Compacto */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-all shadow-2xs cursor-pointer group shrink-0"
              title="Voltar ao Painel Geral"
            >
              <ArrowLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                  Relação de Diaristas
                </h1>
                <span className="hidden sm:inline-flex text-[10px] bg-red-100 text-red-700 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Controle Diário
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                Gestão ágil de presença, pagamentos via PIX e emissão de recibos.
              </p>
            </div>
          </div>

          {/* Centro/Direita: Pílulas de Métricas Integradas no Cabeçalho */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            
            {/* Pílula 1: Diaristas no Dia */}
            <div className="flex items-center gap-2 bg-zinc-100/90 hover:bg-zinc-100 px-3.5 py-2 rounded-2xl border border-zinc-200/80 shadow-2xs transition">
              <Users className="w-4 h-4 text-blue-600" />
              <div className="text-xs">
                <span className="font-extrabold text-zinc-900">{diaristasDoDia.length}</span>
                <span className="text-zinc-500 font-medium ml-1">diarista{diaristasDoDia.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {/* Pílula 2: Diárias Computadas */}
            <div className="flex items-center gap-2 bg-zinc-100/90 hover:bg-zinc-100 px-3.5 py-2 rounded-2xl border border-zinc-200/80 shadow-2xs transition">
              <Clock className="w-4 h-4 text-amber-600" />
              <div className="text-xs">
                <span className="font-extrabold text-zinc-900">{totalDiariasQtd}</span>
                <span className="text-zinc-500 font-medium ml-1">diária{totalDiariasQtd === 1 ? '' : 's'}</span>
              </div>
            </div>

            {/* Pílula 3: Total Financeiro Consolidado */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-zinc-900 to-zinc-950 text-white px-4 py-2 rounded-2xl border border-zinc-800 shadow-md">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <span className="text-zinc-400 font-bold mr-1">Total:</span>
                <span className="font-black text-emerald-400 text-sm">
                  R$ {formatarMoeda(totalValorGeral)}
                </span>
                {diaristasDoDia.length > 0 && (
                  <span className="text-[10px] text-zinc-400 font-medium ml-1.5 hidden md:inline">
                    (R$ {formatarMoeda(totalValorPendente)} a pagar)
                  </span>
                )}
              </div>
            </div>

            {/* Ações secundárias visíveis: Relatório Mensal e Impressão da Folha do Dia */}
            <button
              onClick={() => handleAbrirRelatorio(mesExpandidoIndex, false)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200/80 shadow-2xs transition cursor-pointer whitespace-nowrap"
              title="Gerar o relatório mensal em PDF"
            >
              <BarChart2 className="w-4 h-4 text-emerald-600" />
              <span>Relatório Mensal</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200/80 shadow-2xs transition cursor-pointer whitespace-nowrap"
              title="Imprimir a folha de diaristas do dia selecionado"
            >
              <Printer className="w-4 h-4 text-zinc-600" />
              <span>Imprimir Folha do Dia</span>
            </button>

            {/* Ação Primária: + Cadastrar Diarista (Busca no banco de dados e autopreenchimento) */}
            <button
              id="btn-cadastrar-diarista"
              onClick={onNavigateCadastrar}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs sm:text-sm font-black shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
              title="Cadastrar Diarista com busca no banco de dados e seleção automática (Atalho: N)"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Cadastrar Diarista</span>
            </button>

          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. FITA TEMPORAL DINÂMICA (STRIP SEMANAL + CALENDÁRIO ÁGIL)       */}
      {/* ================================================================= */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-3.5 sm:p-4 no-print space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Navegação Rápida: Botões < Hoje > */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={diaAnterior}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition cursor-pointer"
              title="Dia anterior (Seta Esquerda ←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={irParaHoje}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                isHoje
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
              title="Ir para hoje"
            >
              Hoje
            </button>

            <button
              onClick={diaSeguinte}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition cursor-pointer"
              title="Próximo dia (Seta Direita →)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-zinc-200 mx-1 hidden sm:block" />

            {/* Data por Extenso com Seletor Direto */}
            <div className="relative flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-black text-zinc-900 tracking-tight">
                {formatarDataBR(activeData)}
              </span>
              <span className="text-[11px] text-zinc-500 font-semibold capitalize hidden sm:inline">
                • {formatarDataExtenso(activeData).split(',')[0]}
              </span>

              {/* Input Nativo Oculto para Escolher Qualquer Data */}
              <label 
                className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-600 transition cursor-pointer relative"
                title="Escolher qualquer outra data no calendário"
              >
                <CalendarDays className="w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="date"
                  value={activeData}
                  onChange={(e) => {
                    if (e.target.value) {
                      setActiveData(e.target.value);
                      const d = parseDataLocal(e.target.value);
                      setMesExpandidoIndex(d.getMonth());
                      setAnoVigente(d.getFullYear());
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          </div>

          {/* Fita de 7 Dias da Semana Atual (Interativa e fluida) */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {diasDaSemanaStrip.map((item) => (
              <button
                key={item.dataIso}
                onClick={() => {
                  setActiveData(item.dataIso);
                  const d = parseDataLocal(item.dataIso);
                  setMesExpandidoIndex(d.getMonth());
                  setAnoVigente(d.getFullYear());
                }}
                className={`relative px-3 py-1.5 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center min-w-[54px] shrink-0 ${
                  item.isAtivo
                    ? 'bg-gradient-to-b from-red-600 to-red-700 text-white border-red-600 shadow-md font-black scale-105 z-10'
                    : item.temLancamento
                    ? 'bg-red-50/70 hover:bg-red-100 text-red-950 border-red-200 font-bold'
                    : item.isHoje
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300 font-bold'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}
              >
                <span className="text-[10px] uppercase font-black tracking-tight leading-none">
                  {item.diaSemanaAbrev}
                </span>
                <span className="text-xs font-black leading-tight mt-0.5">
                  {item.diaNumero}
                </span>

                {/* Badge de Diaristas no Dia */}
                {item.temLancamento && (
                  <span className={`text-[9px] px-1.5 rounded-full font-black mt-0.5 leading-none ${
                    item.isAtivo ? 'bg-white/30 text-white' : 'bg-red-200/80 text-red-800'
                  }`}>
                    {item.qtdDiaristas}d
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Botão para Expandir / Recolher Calendário Geral dos 12 Meses */}
          <button
            onClick={() => setMostrarSubTabelaMeses(!mostrarSubTabelaMeses)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shrink-0 ${
              mostrarSubTabelaMeses
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
            }`}
            title="Abrir navegação por meses e visão anual completa"
          >
            <CalendarRange className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden sm:inline">Visão Anual</span>
            {mostrarSubTabelaMeses ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* PAINEL RECOLHÍVEL: VISÃO ANUAL (12 MESES) */}
        {mostrarSubTabelaMeses && (
          <div className="pt-3 border-t border-zinc-200/80 animate-fadeIn space-y-3">
            <div className="flex items-center justify-between bg-zinc-900 text-white p-3 rounded-2xl">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="text-xs font-black">
                  Exercício de {anoVigente} ({totalLancamentosAno} diárias registradas)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAnoVigente(a => a - 1)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-black px-2">{anoVigente}</span>
                <button
                  onClick={() => setAnoVigente(a => a + 1)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Grid dos 12 Meses */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {MESES.map((nomeMes, mesIdx) => {
                const mesStr = String(mesIdx + 1).padStart(2, '0');
                const chave = `${anoVigente}-${mesStr}`;
                const metrics = metricasPorMes[chave];
                const isSelecionado = mesExpandidoIndex === mesIdx;

                return (
                  <button
                    key={nomeMes}
                    onClick={() => {
                      setMesExpandidoIndex(mesIdx);
                      const prefixo = `${anoVigente}-${mesStr}`;
                      setActiveData(`${prefixo}-01`);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelecionado
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : metrics
                        ? 'bg-red-50/60 hover:bg-red-100/80 border-red-200 text-zinc-900'
                        : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600'
                    }`}
                  >
                    <span className="text-xs font-black block">{MESES_ABREV[mesIdx]}</span>
                    <span className="text-[10px] block font-medium opacity-80">
                      {metrics ? `${metrics.diarias} diárias` : 'Sem registros'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 3. BARRA DE CONTROLE DA LISTA (TABS + BUSCA + MODO DE VISÃO)       */}
      {/* ================================================================= */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-3.5 sm:p-4 no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Abas Inteligentes: Todos | A Pagar | Pagos */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80">
          <button
            onClick={() => setAbaStatus('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              abaStatus === 'todos'
                ? 'bg-white text-zinc-950 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Todos ({diaristasDoDia.length})
          </button>

          <button
            onClick={() => setAbaStatus('pendentes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              abaStatus === 'pendentes'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-zinc-600 hover:text-amber-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>A Pagar ({qtdPendentes})</span>
          </button>

          <button
            onClick={() => setAbaStatus('pagos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              abaStatus === 'pagos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-600 hover:text-emerald-700'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Pagos ({qtdPagos})</span>
          </button>
        </div>

        {/* Lado Direito: Busca Instantânea + Alternador de Visualização */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar diarista, caminhão, PIX..."
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-xs font-medium text-zinc-900 bg-white placeholder:text-zinc-400 transition"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Tabela / Cards */}
          <div className="flex items-center gap-0.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200/80 shrink-0">
            <button
              onClick={() => setVisualizacao('tabela')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                visualizacao === 'tabela' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="Visualização em Tabela"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setVisualizacao('cards')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                visualizacao === 'cards' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* ================================================================= */}
      {/* 4. ÁREA PRINCIPAL: LISTA / TABELA / CARDS OU EMPTY STATE          */}
      {/* ================================================================= */}
      {listaFiltrada.length === 0 ? (
        /* Empty State Inteligente */
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-zinc-200/80 space-y-4 no-print">
          <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 mx-auto flex items-center justify-center shadow-sm">
            <Users className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-black text-zinc-900">
              Nenhum diarista para {formatarDataBR(activeData)}
            </h3>
            <p className="text-xs text-zinc-500">
              {busca
                ? 'Nenhum diarista coincide com os termos pesquisados.'
                : 'Não há registros de diárias lançadas para esta data.'}
            </p>
          </div>

          {/* Ações Dinâmicas do Empty State */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              onClick={onNavigateCadastrar}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black shadow-md shadow-red-600/20 transition cursor-pointer flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Cadastrar Diarista em {formatarDataBR(activeData)}</span>
            </button>

            {/* Smart Clone: Botão inteligente para replicar equipe anterior */}
            {ultimaDataComDiaristas && diaristasDoDia.length === 0 && !busca && (
              <button
                disabled={clonando}
                onClick={handleClonarEquipeAnterior}
                className="px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                title={`Replicar todos os diaristas do dia ${formatarDataBR(ultimaDataComDiaristas)} para hoje`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>
                  {clonando ? 'Replicando equipe...' : `Repetir equipe de ${formatarDataBR(ultimaDataComDiaristas)}`}
                </span>
              </button>
            )}

            {!isHoje && (
              <button
                onClick={irParaHoje}
                className="px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200 transition cursor-pointer"
              >
                Ir para Hoje ({formatarDataBR(hoje)})
              </button>
            )}
          </div>
        </div>
      ) : visualizacao === 'tabela' ? (
        /* MODO TABELA MODERNA & ELEGANTE */
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-700 text-[11px] font-black uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Diarista & Função</th>
                  <th className="py-3.5 px-3 text-center">Data</th>
                  <th className="py-3.5 px-3 text-right">Vlr. Diária</th>
                  <th className="py-3.5 px-3 text-center">Qtd.</th>
                  <th className="py-3.5 px-4 text-right bg-red-50/60 text-red-950 font-black border-x border-red-200/50">
                    Total
                  </th>
                  <th className="py-3.5 px-4">Chave PIX</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200/70">
                {listaFiltrada.map((item) => {
                  const qtd = parseInt(item.diarias, 10) || 1;
                  const val = parseFloat(item.valor) || 0;
                  const total = val * qtd;
                  const inicial = (item.nome || 'D').charAt(0).toUpperCase();

                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-zinc-50/80 transition-colors group"
                    >
                      {/* Diarista com Avatar Moderno */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {inicial}
                          </div>
                          <div>
                            <span className="font-black text-zinc-950 block text-xs sm:text-sm uppercase tracking-tight">
                              {item.nome}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
                              <Truck className="w-3 h-3 text-zinc-400" />
                              {item.motorista || item.profissao || 'Diarista Geral'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-3 px-3 text-center text-xs font-semibold text-zinc-600 whitespace-nowrap">
                        {formatarDataBR(item.data)}
                      </td>

                      {/* Valor Unitário */}
                      <td className="py-3 px-3 text-right text-xs font-bold text-zinc-700 whitespace-nowrap">
                        R$ {formatarMoeda(val)}
                      </td>

                      {/* Quantidade de Diárias com Controles Rápidos */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-lg border border-zinc-200">
                          {onUpdateDiarista && (
                            <button
                              onClick={() => onUpdateDiarista({ ...item, diarias: Math.max(1, qtd - 1) })}
                              className="text-zinc-400 hover:text-zinc-900 font-bold transition px-1"
                              title="Diminuir diária"
                            >
                              -
                            </button>
                          )}
                          <span className="font-black text-zinc-900 text-xs px-1">{qtd}</span>
                          {onUpdateDiarista && (
                            <button
                              onClick={() => onUpdateDiarista({ ...item, diarias: qtd + 1 })}
                              className="text-zinc-400 hover:text-zinc-900 font-bold transition px-1"
                              title="Aumentar diária"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 text-right font-black text-red-950 bg-red-50/40 border-x border-red-200/40 text-xs sm:text-sm whitespace-nowrap">
                        R$ {formatarMoeda(total)}
                      </td>

                      {/* Chave PIX com Cópia Rápida */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-zinc-700 truncate max-w-[140px] sm:max-w-[180px]">
                            {item.pix || '—'}
                          </span>
                          {item.pix && item.pix !== 'Não informada' && (
                            <button
                              onClick={() => handleCopiarPix(item.pix, item.id)}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                copiadoId === item.id
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200'
                              }`}
                              title="Copiar Chave PIX"
                            >
                              {copiadoId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEmitirRecibo && onEmitirRecibo(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition cursor-pointer"
                            title="Emitir Recibo Individual"
                          >
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                            <span>Recibo</span>
                          </button>

                          {onDeleteDiarista && (
                            <button
                              onClick={() => onDeleteDiarista(item.id)}
                              className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Remover diarista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Rodapé Consolidado da Tabela */}
              <tfoot className="bg-zinc-950 text-white font-black text-xs">
                <tr>
                  <td className="py-3 px-4 uppercase tracking-wider">
                    Total ({listaFiltrada.length} diaristas)
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400 font-semibold">
                    {formatarDataBR(activeData)}
                  </td>
                  <td className="py-3 px-3 text-right text-zinc-400">—</td>
                  <td className="py-3 px-3 text-center text-amber-400 font-black text-sm">
                    {listaFiltrada.reduce((acc, c) => acc + (parseInt(c.diarias, 10) || 1), 0)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-black text-sm bg-black">
                    R$ {formatarMoeda(listaFiltrada.reduce((acc, c) => acc + ((parseFloat(c.valor) || 0) * (parseInt(c.diarias, 10) || 1)), 0))}
                  </td>
                  <td colSpan="2" className="py-3 px-4 text-right text-zinc-400 font-normal">
                    Distribuidora Irmãos Barreiro
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* MODO CARDS OPERACIONAIS (Kanban/Grid) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 no-print">
          {listaFiltrada.map((item) => {
            const qtd = parseInt(item.diarias, 10) || 1;
            const val = parseFloat(item.valor) || 0;
            const total = val * qtd;

            return (
              <div 
                key={item.id}
                className="bg-white rounded-3xl p-4 border border-zinc-200/90 shadow-md hover:shadow-xl transition-all space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-black text-zinc-950 text-sm uppercase tracking-tight">
                        {item.nome}
                      </h4>
                      <p className="text-xs text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
                        <Truck className="w-3 h-3 text-zinc-400" />
                        {item.motorista || item.profissao || 'Diarista Geral'}
                      </p>
                    </div>

                    {/* Toggle de Status no Card */}
                    <button
                      onClick={() => onToggleStatus && onToggleStatus(item.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition cursor-pointer border flex items-center gap-1 ${
                        item.pago
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.pago ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{item.pago ? 'Pago' : 'Pendente'}</span>
                    </button>
                  </div>

                  {/* Valores */}
                  <div className="mt-3 p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">Diárias</span>
                      <span className="font-extrabold text-zinc-800">{qtd}x R$ {formatarMoeda(val)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">Total</span>
                      <span className="font-black text-red-600 text-sm">R$ {formatarMoeda(total)}</span>
                    </div>
                  </div>

                  {/* PIX */}
                  {item.pix && item.pix !== 'Não informada' && (
                    <div className="mt-2.5 flex items-center justify-between text-xs bg-zinc-100/80 px-2.5 py-1.5 rounded-xl border border-zinc-200/60">
                      <span className="font-mono text-[11px] text-zinc-600 truncate max-w-[180px]">
                        {item.pix}
                      </span>
                      <button
                        onClick={() => handleCopiarPix(item.pix, item.id)}
                        className="text-zinc-500 hover:text-zinc-900 transition p-1"
                        title="Copiar PIX"
                      >
                        {copiadoId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Ações do Card */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <button
                    onClick={() => onEmitirRecibo && onEmitirRecibo(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Emitir Recibo</span>
                  </button>

                  {onDeleteDiarista && (
                    <button
                      onClick={() => onDeleteDiarista(item.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 transition"
                      title="Excluir Diarista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* 5. IMPRESSÃO OFICIAL LIMPA (PRINT NATIVO)                          */}
      {/* ================================================================= */}
      <div className="hidden print:block print-clean p-4 font-sans text-black">
        <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black uppercase">
              DISTRIBUIDORA IRMÃOS BARREIRO DE BEBIDAS LTDA
            </h2>
            <p className="text-sm font-bold">
              RELAÇÃO DIÁRIA DE DIARISTAS E CONTROLE DE PAGAMENTOS
            </p>
            <p className="text-xs text-zinc-700 font-bold">
              Data de Referência: {formatarDataBR(activeData)} ({formatarDataExtenso(activeData)})
            </p>
          </div>
          <div className="text-right text-xs">
            <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="font-bold">Total Diaristas: {listaFiltrada.length}</p>
            <p className="font-bold text-sm">Total a Pagar: R$ {formatarMoeda(totalValorGeral)}</p>
          </div>
        </div>

        <table className="w-full text-xs text-left border border-zinc-400">
          <thead>
            <tr className="bg-zinc-200 font-bold uppercase text-[10px]">
              <th className="p-2 border">Diarista</th>
              <th className="p-2 border">Função / Caminhão</th>
              <th className="p-2 border text-center">Data</th>
              <th className="p-2 border text-right">Vlr. Diária</th>
              <th className="p-2 border text-center">Diárias</th>
              <th className="p-2 border text-right">Total (R$)</th>
              <th className="p-2 border">Chave PIX</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((item) => {
              const qtd = parseInt(item.diarias, 10) || 1;
              const val = parseFloat(item.valor) || 0;
              return (
                <tr key={item.id}>
                  <td className="p-2 border font-bold uppercase">{item.nome}</td>
                  <td className="p-2 border">{item.motorista || item.profissao || '—'}</td>
                  <td className="p-2 border text-center">{formatarDataBR(item.data)}</td>
                  <td className="p-2 border text-right">R$ {formatarMoeda(val)}</td>
                  <td className="p-2 border text-center font-bold">{qtd}</td>
                  <td className="p-2 border text-right font-black">R$ {formatarMoeda(val * qtd)}</td>
                  <td className="p-2 border font-mono">{item.pix || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-zinc-100">
              <td colSpan="4" className="p-2 border uppercase">TOTAL DO DIA ({formatarDataBR(activeData)})</td>
              <td className="p-2 border text-center">{totalDiariasQtd}</td>
              <td className="p-2 border text-right font-black">R$ {formatarMoeda(totalValorGeral)}</td>
              <td className="p-2 border text-right font-semibold text-zinc-600">
                Total: {listaFiltrada.length} diaristas
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 pt-4 border-t border-zinc-300 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-t border-black w-48 mx-auto mb-1"></div>
            <p className="font-bold">Responsável Financeiro</p>
            <p>Distribuidora Irmãos Barreiro</p>
          </div>
          <div>
            <div className="border-t border-black w-48 mx-auto mb-1"></div>
            <p className="font-bold">Conferência RH</p>
            <p>Distribuidora Irmãos Barreiro</p>
          </div>
        </div>
      </div>

    </div>
  );
}
