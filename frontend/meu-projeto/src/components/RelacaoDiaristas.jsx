import React, { useState, useMemo } from 'react';
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
  RefreshCw,
  BarChart2,
  Table,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  SlidersHorizontal,
  CalendarRange
} from 'lucide-react';
import RelatorioMensalModal from './RelatorioMensalModal';

export const DIARISTAS_INICIAIS = [];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSem = diasSemana[data.getDay()];
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
  onEmitirRecibo, 
  onUpdateDiarista, 
  onDeleteDiarista, 
  onResetDiaristas, 
  onBack 
}) {
  const hoje = getHojeStr();
  const hojeDate = new Date();

  const [busca, setBusca] = useState('');
  const [copiadoId, setCopiadoId] = useState(null);

  // =========================================================================
  // ESTADO DO ANO/MÊS/DIA VIGENTE
  // =========================================================================
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

  // Ano vigente selecionado
  const dataRefParsed = parseDataLocal(activeData);
  const [anoVigente, setAnoVigente] = useState(dataRefParsed.getFullYear());

  // Mês selecionado no painel de meses (0-11)
  const [mesExpandidoIndex, setMesExpandidoIndex] = useState(dataRefParsed.getMonth());

  // Painel anual/mensal começa RECOLHIDO por padrão para deixar a tela limpa e focada
  const [mostrarSubTabelaMeses, setMostrarSubTabelaMeses] = useState(false);

  // Modal do Relatório Mensal Oficial
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [mesSelecionadoRelatorio, setMesSelecionadoRelatorio] = useState(dataRefParsed.getMonth());
  const [anoSelecionadoRelatorio, setAnoSelecionadoRelatorio] = useState(dataRefParsed.getFullYear());
  const [autoDownloadRelatorio, setAutoDownloadRelatorio] = useState(false);

  // =========================================================================
  // MAPAS DE CONTAGEM E TOTAIS POR DATA/MÊS
  // =========================================================================
  const contagemPorData = useMemo(() => {
    const mapa = {};
    diaristas.forEach((d) => {
      if (d.data) mapa[d.data] = (mapa[d.data] || 0) + 1;
    });
    return mapa;
  }, [diaristas]);

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

  // Métricas por Mês: "YYYY-MM" -> { diaristas, diarias, valor }
  const metricasPorMes = useMemo(() => {
    const mapa = {};
    diaristas.forEach((d) => {
      if (!d.data) return;
      const mesKey = d.data.substring(0, 7); // YYYY-MM
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

  // Datas disponíveis (com lançamentos)
  const datasDisponiveis = useMemo(() => {
    const set = new Set();
    diaristas.forEach(d => { if (d.data) set.add(d.data); });
    return Array.from(set).sort().reverse();
  }, [diaristas]);

  // Anos disponíveis
  const anosDisponiveis = useMemo(() => {
    const anos = new Set([hojeDate.getFullYear(), anoVigente]);
    diaristas.forEach(d => {
      if (d.data) anos.add(parseInt(d.data.split('-')[0], 10));
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [diaristas, anoVigente]);

  // Dias do mês expandido que têm lançamentos
  const diasDoMesExpandido = useMemo(() => {
    const mesStr = String(mesExpandidoIndex + 1).padStart(2, '0');
    const prefixo = `${anoVigente}-${mesStr}`;
    const dias = [];
    const totalDias = new Date(anoVigente, mesExpandidoIndex + 1, 0).getDate();
    for (let d = 1; d <= totalDias; d++) {
      const diaStr = String(d).padStart(2, '0');
      const dataStr = `${prefixo}-${diaStr}`;
      dias.push({
        dia: d,
        dataStr,
        temLancamento: !!contagemPorData[dataStr],
        qtd: contagemPorData[dataStr] || 0,
        valor: totalPorData[dataStr]?.valor || 0,
        diarias: totalPorData[dataStr]?.diarias || 0,
        primeiroDiaSemana: new Date(anoVigente, mesExpandidoIndex, 1).getDay(),
      });
    }
    return dias;
  }, [anoVigente, mesExpandidoIndex, contagemPorData, totalPorData]);

  // Diaristas do dia ativo
  const diaristasDoDia = useMemo(() => {
    return diaristas.filter(item => item.data === activeData);
  }, [diaristas, activeData]);

  // Lista filtrada dentro do dia ativo
  const listaFiltrada = useMemo(() => {
    return diaristasDoDia.filter((item) => {
      const termo = busca.toLowerCase().trim();
      if (!termo) return true;
      return (
        (item.nome && item.nome.toLowerCase().includes(termo)) ||
        (item.motorista && item.motorista.toLowerCase().includes(termo)) ||
        (item.profissao && item.profissao.toLowerCase().includes(termo)) ||
        (item.pix && item.pix.toLowerCase().includes(termo))
      );
    });
  }, [diaristasDoDia, busca]);

  const totalDiariasQtd = listaFiltrada.reduce((acc, curr) => acc + (parseInt(curr.diarias, 10) || 1), 0);
  const totalValorGeral = listaFiltrada.reduce((acc, curr) => acc + ((parseFloat(curr.valor) || 0) * (parseInt(curr.diarias, 10) || 1)), 0);

  // =========================================================================
  // HANDLERS
  // =========================================================================
  function handleCopiarPix(pix, id) {
    if (!pix) return;
    navigator.clipboard.writeText(pix);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  function handlePrint() {
    window.print();
  }

  function handleMudarDiarias(item, delta) {
    if (!onUpdateDiarista) return;
    const atual = parseInt(item.diarias, 10) || 1;
    const novaQtd = Math.max(1, atual + delta);
    onUpdateDiarista({ ...item, diarias: novaQtd });
  }

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

  function handleSelecionarDiaDoMes(dataStr) {
    setActiveData(dataStr);
    const d = parseDataLocal(dataStr);
    setMesExpandidoIndex(d.getMonth());
    setAnoVigente(d.getFullYear());
  }

  function handleSelecionarMes(mesIdx) {
    setMesExpandidoIndex(mesIdx);
    const d = parseDataLocal(activeData);
    const mesStr = String(mesIdx + 1).padStart(2, '0');
    const prefixo = `${anoVigente}-${mesStr}`;
    const diaAtual = d.getFullYear() === anoVigente && d.getMonth() === mesIdx ? activeData : `${prefixo}-01`;
    setActiveData(diaAtual);
  }

  function handleAbrirRelatorio(mesIdx, autoDownload = false) {
    const mesAlvo = mesIdx !== undefined && mesIdx !== null ? mesIdx : mesExpandidoIndex;
    setMesSelecionadoRelatorio(mesAlvo);
    setAnoSelecionadoRelatorio(anoVigente);
    setAutoDownloadRelatorio(autoDownload);
    setRelatorioAberto(true);
  }

  const isHoje = activeData === hoje;
  const totalLancamentosAno = Object.values(metricasPorMes).reduce((acc, m) => acc + (m.totalRegistros || 0), 0);

  return (
    <div className="space-y-6 w-full animate-fadeIn">

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

      {/* ================================================================= */}
      {/* 1. CABEÇALHO PRINCIPAL UNIFICADO & ELEGANTE                       */}
      {/* ================================================================= */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-all shadow-xs cursor-pointer group shrink-0"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-red-700 text-xs font-black uppercase tracking-wider mb-1.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>Controle Diário de Pagamentos</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              Relação de Diaristas
            </h1>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Gestão de diárias, fechamento de pagamentos e emissão de recibos oficiais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Botão Relatório Mensal (PDF) */}
          <button
            id="btn-gerar-relatorio-mensal"
            onClick={() => handleAbrirRelatorio(mesExpandidoIndex, false)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-800 text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border border-zinc-200 hover:border-zinc-300"
            title={`Visualizar Relatório Mensal em PDF`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <span>Relatório Mensal</span>
          </button>

          {/* Botão Imprimir Dia */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-800 text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border border-zinc-200 hover:border-zinc-300"
            title="Imprimir Relação do Dia Atual"
          >
            <Printer className="w-4 h-4 text-zinc-600" />
            <span>Imprimir</span>
          </button>

          {/* Botão CADASTRAR DIARISTA */}
          <button
            id="btn-cadastrar-diarista"
            onClick={onNavigateCadastrar}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs sm:text-sm font-black shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Diarista</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. BARRA DE CONTROLE TEMPORAL (DATA, NAVEGAÇÃO & ATALHOS)        */}
      {/* ================================================================= */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-5 sm:p-6 space-y-4 no-print">
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          
          {/* Lado Esquerdo: Controles Rápidos de Dia (<, Hoje, >) + Data Ativa */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80 shadow-2xs">
              <button
                onClick={diaAnterior}
                className="p-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition cursor-pointer shadow-2xs"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={irParaHoje}
                className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  isHoje
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white hover:bg-zinc-200 text-zinc-700'
                }`}
                title="Ir para o dia de hoje"
              >
                Hoje
              </button>

              <button
                onClick={diaSeguinte}
                className="p-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition cursor-pointer shadow-2xs"
                title="Próximo Dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Destaque Visual do Dia Selecionado */}
            <div className="relative flex items-center gap-3 bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-2xl shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CalendarIcon className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-zinc-900 tracking-tight">
                    {formatarDataBR(activeData)}
                  </span>
                  {isHoje && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-full uppercase">
                      Hoje
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 font-semibold capitalize">
                  {formatarDataExtenso(activeData).split(',')[0]}
                </div>
              </div>

              {/* Input Nativo de Data Oculto sobre o botão */}
              <label
                className="ml-2 p-2 rounded-xl bg-white hover:bg-red-50 text-zinc-600 hover:text-red-600 border border-zinc-200 transition cursor-pointer relative shadow-2xs"
                title="Escolher data específica no calendário"
              >
                <CalendarDays className="w-4 h-4" />
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

          {/* Lado Direito: Botão para Expandir / Recolher Calendário Geral */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMostrarSubTabelaMeses(!mostrarSubTabelaMeses)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer border shadow-2xs ${
                mostrarSubTabelaMeses
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-200'
              }`}
              title="Abrir visão geral de todos os meses e calendário"
            >
              <CalendarRange className="w-4 h-4 text-red-500" />
              <span>Visão Anual & Calendário</span>
              {mostrarSubTabelaMeses ? (
                <ChevronUp className="w-4 h-4 ml-1" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Linha de Atalhos Rápidos para Dias com Lançamentos */}
        {datasDisponiveis.length > 0 && (
          <div className="pt-3 border-t border-zinc-100 flex items-center gap-2.5 overflow-x-auto pb-1 text-xs">
            <span className="font-bold text-zinc-400 uppercase tracking-wider text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Dias com Lançamentos:</span>
            </span>

            <div className="flex items-center gap-1.5 flex-nowrap">
              {datasDisponiveis.map((data) => {
                const count = contagemPorData[data] || 0;
                const isSelected = activeData === data;
                return (
                  <button
                    key={data}
                    onClick={() => {
                      setActiveData(data);
                      const d = parseDataLocal(data);
                      setMesExpandidoIndex(d.getMonth());
                      setAnoVigente(d.getFullYear());
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer border text-xs ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-zinc-50 hover:bg-red-50 text-zinc-700 hover:text-red-700 border-zinc-200'
                    }`}
                  >
                    <span>{formatarDataBR(data)}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* PAINEL EXPANSÍVEL: VISÃO ANUAL (12 MESES) & GRADE MENSAL       */}
        {/* ============================================================= */}
        {mostrarSubTabelaMeses && (
          <div className="mt-4 pt-4 border-t border-zinc-200/80 space-y-4 animate-fadeIn">
            <div className="bg-zinc-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    Navegação Anual
                  </span>
                  <span className="text-sm font-black">
                    Exercício de {anoVigente} ({totalLancamentosAno} lançamentos registrados)
                  </span>
                </div>
              </div>

              {/* Seletor de Ano */}
              <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700 self-start sm:self-auto">
                <button
                  onClick={() => setAnoVigente(a => a - 1)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                  title="Ano anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <select
                  value={anoVigente}
                  onChange={(e) => setAnoVigente(parseInt(e.target.value, 10))}
                  className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer min-w-[56px] text-center"
                >
                  {anosDisponiveis.map(a => (
                    <option key={a} value={a} className="bg-zinc-900">{a}</option>
                  ))}
                </select>
                <button
                  onClick={() => setAnoVigente(a => a + 1)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                  title="Próximo ano"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Grid dos 12 Meses */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {MESES.map((nomeMes, mesIdx) => {
                const mesStr = String(mesIdx + 1).padStart(2, '0');
                const chave = `${anoVigente}-${mesStr}`;
                const metrics = metricasPorMes[chave];
                const isSelecionado = mesExpandidoIndex === mesIdx;
                const isMesHoje = hojeDate.getFullYear() === anoVigente && hojeDate.getMonth() === mesIdx;

                return (
                  <button
                    key={nomeMes}
                    onClick={() => handleSelecionarMes(mesIdx)}
                    className={`relative rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                      isSelecionado
                        ? 'bg-red-600 border-red-600 text-white shadow-md'
                        : metrics
                        ? 'bg-white border-red-200 hover:border-red-400 hover:bg-red-50/40 text-zinc-900 shadow-2xs'
                        : isMesHoje
                        ? 'bg-zinc-100 border-zinc-300 text-zinc-700'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-white'
                    }`}
                  >
                    {isMesHoje && !isSelecionado && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 block" />
                    )}

                    <div className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${isSelecionado ? 'text-red-100' : 'text-zinc-400'}`}>
                      {MESES_ABREV[mesIdx]}
                    </div>
                    <div className={`text-xs font-black ${isSelecionado ? 'text-white' : 'text-zinc-800'}`}>
                      {nomeMes}
                    </div>

                    {metrics ? (
                      <div className="mt-1.5 space-y-0.5 text-[10px]">
                        <div className={`font-bold ${isSelecionado ? 'text-red-100' : 'text-red-700'}`}>
                          R$ {formatarMoeda(metrics.valor)}
                        </div>
                        <div className={isSelecionado ? 'text-red-200' : 'text-zinc-500'}>
                          {metrics.totalRegistros} reg. ({metrics.diarias} diárias)
                        </div>
                      </div>
                    ) : (
                      <div className={`mt-1.5 text-[10px] ${isSelecionado ? 'text-red-200' : 'text-zinc-400'} italic`}>
                        Sem registros
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sub-tabela do Mês Selecionado (Grade de Dias) */}
            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
              <div className="bg-zinc-100 text-zinc-800 px-4 py-2.5 flex items-center justify-between border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-black">
                    Dias de {MESES[mesExpandidoIndex]} de {anoVigente}
                  </span>
                </div>
                <button
                  onClick={() => handleAbrirRelatorio(mesExpandidoIndex, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-300 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  <span>Gerar PDF do Mês</span>
                </button>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-black text-zinc-400 uppercase">
                  {DIAS_SEMANA.map(ds => (
                    <div key={ds} className="py-0.5">{ds}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: diasDoMesExpandido[0]?.primeiroDiaSemana || 0 }).map((_, i) => (
                    <div key={`espaco-${i}`} className="h-10 sm:h-12 rounded-xl" />
                  ))}

                  {diasDoMesExpandido.map((item) => {
                    const isSelecionado = activeData === item.dataStr;
                    const isItemHoje = item.dataStr === hoje;

                    return (
                      <button
                        key={item.dataStr}
                        onClick={() => handleSelecionarDiaDoMes(item.dataStr)}
                        className={`h-10 sm:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border text-xs ${
                          isSelecionado
                            ? 'bg-red-600 text-white border-red-600 shadow-xs font-black'
                            : item.temLancamento
                            ? 'bg-red-50 hover:bg-red-100 text-red-950 border-red-200 font-black shadow-2xs'
                            : isItemHoje
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-400 font-black'
                            : 'bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200'
                        }`}
                        title={item.temLancamento ? `${item.qtd} diarista(s) — R$ ${formatarMoeda(item.valor)}` : formatarDataBR(item.dataStr)}
                      >
                        <span className="font-black text-xs leading-none">{item.dia}</span>
                        {item.temLancamento && (
                          <span className={`text-[9px] font-bold leading-none mt-1 ${isSelecionado ? 'text-red-100' : 'text-red-600'}`}>
                            {item.qtd} d.
                          </span>
                        )}
                        {isItemHoje && !isSelecionado && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 3. TOTALIZADORES EXECUTIVOS DO DIA ATIVO                         */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        {/* Diaristas no Dia */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-zinc-200/80 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Diaristas no Dia
            </span>
            <div className="text-2xl font-black text-zinc-900">
              {diaristasDoDia.length}
              {busca && listaFiltrada.length !== diaristasDoDia.length && (
                <span className="text-xs font-semibold text-zinc-400 ml-1.5">
                  ({listaFiltrada.length} filtrado{listaFiltrada.length === 1 ? '' : 's'})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total de Diárias */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-zinc-200/80 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Diárias Computadas
            </span>
            <div className="text-2xl font-black text-zinc-900">
              {totalDiariasQtd}{' '}
              <span className="text-xs font-semibold text-zinc-400">diária(s)</span>
            </div>
          </div>
        </div>

        {/* Total a Pagar no Dia */}
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 text-white rounded-3xl p-5 border border-zinc-800 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Total a Pagar no Dia
            </span>
            <div className="text-2xl font-black text-emerald-400">
              R$ {formatarMoeda(totalValorGeral)}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. TABELA PRINCIPAL DA RELAÇÃO DE DIARISTAS DO DIA               */}
      {/* ================================================================= */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 overflow-hidden w-full no-print">
        
        {/* Barra Superior da Tabela: Título do Dia + Busca Integrada */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-zinc-50 to-zinc-100/80 border-b border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-2xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-zinc-900 tracking-tight">
                Lançamentos de {formatarDataBR(activeData)}
              </h2>
              <span className="text-xs text-zinc-500 font-medium">
                {formatarDataExtenso(activeData)}
              </span>
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, função ou PIX..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-xs sm:text-sm font-medium text-zinc-900 placeholder:text-zinc-400 bg-white shadow-2xs"
            />
          </div>
        </div>

        {/* Tabela de Diaristas */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm table-auto">
            <thead className="bg-zinc-100/90 border-b border-zinc-200 text-zinc-700 text-xs font-black uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Diarista</th>
                <th className="py-3.5 px-3 text-center">Data</th>
                <th className="py-3.5 px-3 text-right">Vlr. Diária</th>
                <th className="py-3.5 px-3 text-center">Qtd. Diárias</th>
                <th className="py-3.5 px-4 text-right bg-red-50/70 text-red-950 font-black border-x border-red-200/70">
                  Total do Diarista
                </th>
                <th className="py-3.5 px-4">Chave PIX</th>
                <th className="py-3.5 px-4 text-center no-print">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200/80">
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-14 text-center text-zinc-500">
                    <div className="max-w-md mx-auto space-y-4 px-4">
                      <div className="w-14 h-14 rounded-3xl bg-red-50 text-red-600 mx-auto flex items-center justify-center shadow-xs">
                        <AlertCircle className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-zinc-900">
                          Nenhum diarista para {formatarDataBR(activeData)}
                        </h4>
                        <p className="text-xs text-zinc-500 mt-1">
                          {busca
                            ? 'Nenhum diarista encontrado com os termos da pesquisa nesta data.'
                            : `Não há diaristas cadastrados no dia ${formatarDataBR(activeData)}.`}
                        </p>
                      </div>

                      {/* Botões de Ação Rápida */}
                      <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                        <button
                          onClick={onNavigateCadastrar}
                          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md transition cursor-pointer"
                        >
                          + Cadastrar Diarista neste Dia
                        </button>

                        {!isHoje && (
                          <button
                            onClick={irParaHoje}
                            className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200 transition cursor-pointer"
                          >
                            Ir para Hoje ({formatarDataBR(hoje)})
                          </button>
                        )}
                      </div>

                      {/* Sugestão de dias disponíveis */}
                      {datasDisponiveis.length > 0 && (
                        <div className="pt-3 border-t border-zinc-100">
                          <span className="text-[11px] font-bold text-zinc-400 block mb-2">
                            Ou navegue para um dia com lançamentos existentes:
                          </span>
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {datasDisponiveis.slice(0, 5).map((data) => (
                              <button
                                key={data}
                                onClick={() => {
                                  setActiveData(data);
                                  const d = parseDataLocal(data);
                                  setMesExpandidoIndex(d.getMonth());
                                  setAnoVigente(d.getFullYear());
                                }}
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-700 border border-zinc-200 text-[11px] font-bold transition cursor-pointer"
                              >
                                {formatarDataBR(data)} ({contagemPorData[data]})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((item) => {
                  const qtdDiarias = parseInt(item.diarias, 10) || 1;
                  const valorUnitario = parseFloat(item.valor) || 0;
                  const valorTotalDiarista = valorUnitario * qtdDiarias;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/90 transition-colors group">
                      
                      {/* Diarista (Nome + Função) */}
                      <td className="py-3.5 px-4 font-black text-zinc-900 uppercase whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{item.nome}</span>
                        </div>
                        {(item.motorista || item.profissao) && (
                          <div className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase tracking-wider">
                            {item.motorista || item.profissao}
                          </div>
                        )}
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-3 text-center text-xs font-semibold text-zinc-600 whitespace-nowrap">
                        {formatarDataBR(item.data)}
                      </td>

                      {/* Valor Unitário */}
                      <td className="py-3.5 px-3 text-right font-semibold text-zinc-700 whitespace-nowrap">
                        R$ {formatarMoeda(valorUnitario)}
                      </td>

                      {/* Qtd Diárias (Controle - e +) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-zinc-100/90 px-2 py-1 rounded-xl border border-zinc-200 shadow-2xs">
                          {onUpdateDiarista && (
                            <button
                              type="button"
                              onClick={() => handleMudarDiarias(item, -1)}
                              disabled={qtdDiarias <= 1}
                              className="p-1 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition no-print"
                              title="Diminuir quantidade de diárias"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                          <span className="font-black text-zinc-900 text-xs px-1.5 min-w-[20px] text-center">
                            {qtdDiarias}
                          </span>
                          {onUpdateDiarista && (
                            <button
                              type="button"
                              onClick={() => handleMudarDiarias(item, 1)}
                              className="p-1 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-white cursor-pointer transition no-print"
                              title="Aumentar quantidade de diárias"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Total do Diarista */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap bg-red-50/40 border-x border-red-200/60">
                        <div className="font-black text-red-700 text-base tracking-tight">
                          R$ {formatarMoeda(valorTotalDiarista)}
                        </div>
                        {qtdDiarias > 1 && (
                          <span className="text-[10px] text-zinc-400 block font-semibold">
                            ({qtdDiarias}x R$ {formatarMoeda(valorUnitario)})
                          </span>
                        )}
                      </td>

                      {/* Chave PIX com botão copiar */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-mono font-semibold text-zinc-800 transition shadow-2xs">
                          <span>{item.pix || 'Não informado'}</span>
                          {item.pix && (
                            <button
                              onClick={() => handleCopiarPix(item.pix, item.id)}
                              className="p-1 text-zinc-400 hover:text-red-600 transition cursor-pointer no-print"
                              title="Copiar Chave PIX"
                            >
                              {copiadoId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap no-print">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEmitirRecibo && onEmitirRecibo(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                            title="Emitir Recibo Individual deste Diarista"
                          >
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                            <span>Recibo</span>
                          </button>

                          {onDeleteDiarista && (
                            <button
                              onClick={() => onDeleteDiarista(item.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                              title="Remover Diarista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Rodapé Consolidado */}
            <tfoot className="bg-zinc-900 text-white font-black text-sm">
              <tr>
                <td className="py-3.5 px-4 uppercase tracking-wider text-xs">
                  TOTAL DO DIA ({formatarDataBR(activeData)})
                </td>
                <td className="py-3.5 px-3 text-center text-xs font-semibold text-zinc-400">
                  {listaFiltrada.length} diarista(s)
                </td>
                <td className="py-3.5 px-3 text-right text-xs text-zinc-400">—</td>
                <td className="py-3.5 px-3 text-center text-amber-400 text-base font-black">
                  {totalDiariasQtd}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-400 text-base font-black bg-zinc-950/90">
                  R$ {formatarMoeda(totalValorGeral)}
                </td>
                <td colSpan="2" className="py-3.5 px-4 text-right text-xs font-normal text-zinc-400">
                  Distribuidora Irmãos Barreiro de Bebidas Ltda.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 5. VERSÃO EXCLUSIVA DE IMPRESSÃO LIMPA DO DIA (PRINT)            */}
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
            <p>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="font-bold">Total de Diaristas no Dia: {listaFiltrada.length}</p>
            <p className="font-bold text-sm text-black">Total a Pagar: R$ {formatarMoeda(totalValorGeral)}</p>
          </div>
        </div>

        <table className="w-full text-xs text-left border border-zinc-400">
          <thead>
            <tr className="bg-zinc-200 font-bold uppercase text-[10px]">
              <th className="p-2 border">Diarista</th>
              <th className="p-2 border">Função</th>
              <th className="p-2 border text-center">Data</th>
              <th className="p-2 border text-right">Vlr. Diária</th>
              <th className="p-2 border text-center">Diárias</th>
              <th className="p-2 border text-right">Total (R$)</th>
              <th className="p-2 border">Chave PIX</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-4 text-center text-zinc-500 italic">
                  Nenhum diarista cadastrado para esta data.
                </td>
              </tr>
            ) : (
              listaFiltrada.map((item) => {
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
              })
            )}
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
            <p className="font-bold">Conferido por</p>
            <p>RH</p>
          </div>
        </div>
      </div>

    </div>
  );
}

