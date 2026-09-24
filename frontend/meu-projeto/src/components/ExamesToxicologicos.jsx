import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FlaskConical,
  Plus,
  Search,
  UploadCloud,
  Printer,
  Trash2,
  Edit3,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Save,
  FileSpreadsheet,
  Bell,
  FileText,
  FileUp,
  Eye,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  getExamesToxicologicosApi,
  createExameToxicologicoApi,
  updateExameToxicologicoApi,
  deleteExameToxicologicoApi,
  importarPlanilhaExameApi,
  exportarPdfExamesApi,
  uploadPdfExameApi,
  visualizarPdfExameApi,
  removerPdfExameApi,
} from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatarBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function badgeStatus(status, diasParaVencer) {
  if (status === 'VENCIDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-200">
        <AlertCircle className="w-3 h-3" />
        VENCIDO
      </span>
    );
  }
  if (status === 'VENCENDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3" />
        {diasParaVencer === 0 ? 'VENCE HOJE' : `${diasParaVencer}d`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" />
      EM DIA
    </span>
  );
}

const FORM_VAZIO = { nome: '', data_exame: '', data_vencimento: '' };

// ─── componente principal ────────────────────────────────────────────────────

export default function ExamesToxicologicos({ onBack }) {
  // Aba principal: 'lista' | 'importar'
  const [activeTab, setActiveTab] = useState('lista');

  // Estados de dados
  const [exames, setExames] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Mensagens globais
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  // Modal inserção / edição
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  // Importação de planilha
  const [arquivoPlanilha, setArquivoPlanilha] = useState(null);
  const [importando, setImportando] = useState(false);
  const [relatorioImport, setRelatorioImport] = useState(null);
  const fileInputRef = useRef(null);

  // PDF
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // PDF do Exame Toxicológico
  const [modalPdfExame, setModalPdfExame] = useState(null);
  const [arquivoPdfUpload, setArquivoPdfUpload] = useState(null);
  const [enviandoPdf, setEnviandoPdf] = useState(false);
  const [removendoPdf, setRemovendoPdf] = useState(false);
  const [visualizandoId, setVisualizandoId] = useState(null);
  const [modalViewerPdf, setModalViewerPdf] = useState(null);
  const pdfInputRef = useRef(null);

  // ── auto-dismiss mensagens ──
  useEffect(() => {
    if (!mensagemSucesso && !mensagemErro) return;
    const t = setTimeout(() => {
      setMensagemSucesso('');
      setMensagemErro('');
    }, 5000);
    return () => clearTimeout(t);
  }, [mensagemSucesso, mensagemErro]);

  // ── carregar exames ──
  const carregarExames = useCallback(async () => {
    try {
      setCarregando(true);
      const data = await getExamesToxicologicosApi({ busca, status: filtroStatus });
      setExames(Array.isArray(data) ? data : []);
      setMensagemErro('');
    } catch (err) {
      setMensagemErro('Erro ao carregar exames. Verifique a conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [busca, filtroStatus]);

  useEffect(() => {
    carregarExames();
  }, [carregarExames]);

  // ── stats ──
  const totalVencendo = exames.filter(e => e.status === 'VENCENDO').length;
  const totalVencidos = exames.filter(e => e.status === 'VENCIDO').length;
  const totalOk = exames.filter(e => e.status === 'OK').length;

  // ── CRUD ──
  const abrirModal = (exame = null) => {
    setEditando(exame);
    setForm(exame ? { nome: exame.nome, data_exame: exame.data_exame, data_vencimento: exame.data_vencimento } : FORM_VAZIO);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setForm(FORM_VAZIO);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.data_exame.trim() || !form.data_vencimento.trim()) {
      setMensagemErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await updateExameToxicologicoApi(editando.id, form);
        setMensagemSucesso('Exame atualizado com sucesso!');
      } else {
        await createExameToxicologicoApi(form);
        setMensagemSucesso('Motorista cadastrado com sucesso!');
      }
      fecharModal();
      carregarExames();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (exame) => {
    if (!window.confirm(`Deseja excluir o registro de "${exame.nome}"?`)) return;
    try {
      await deleteExameToxicologicoApi(exame.id);
      setMensagemSucesso('Registro excluído com sucesso.');
      carregarExames();
    } catch (err) {
      setMensagemErro('Erro ao excluir registro.');
    }
  };

  // ── Importação ──
  const handleImportar = async () => {
    if (!arquivoPlanilha) {
      setMensagemErro('Selecione um arquivo .xlsx, .xls ou .csv para importar.');
      return;
    }
    setImportando(true);
    setRelatorioImport(null);
    try {
      const res = await importarPlanilhaExameApi(arquivoPlanilha);
      setRelatorioImport(res);
      setMensagemSucesso(res.mensagem || 'Importação concluída!');
      setArquivoPlanilha(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      carregarExames();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao importar planilha.');
    } finally {
      setImportando(false);
    }
  };

  // ── PDF ──
  const handleExportarPdf = async () => {
    if (exames.length === 0) {
      setMensagemErro('Nenhum exame cadastrado para exportar.');
      return;
    }
    setGerandoPdf(true);
    try {
      const blob = await exportarPdfExamesApi();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMensagemSucesso('PDF gerado e aberto em nova aba!');
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao gerar PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // E-mail é disparado automaticamente pelo servidor às 08:00 — sem ação manual necessária.

  // ── Gestão de PDF do Exame ──
  const handleAbrirModalPdf = (exame) => {
    setModalPdfExame(exame);
    setArquivoPdfUpload(null);
  };

  const handleFecharModalPdf = () => {
    setModalPdfExame(null);
    setArquivoPdfUpload(null);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleVisualizarPdf = async (exame) => {
    try {
      setVisualizandoId(exame.id);
      const blob = await visualizarPdfExameApi(exame.id);
      const url = URL.createObjectURL(blob);
      setModalViewerPdf({
        url,
        nome: exame.pdf_nome || `exame_${exame.nome}.pdf`,
        motorista: exame.nome,
        exameId: exame.id,
      });
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao carregar PDF do laudo.');
    } finally {
      setVisualizandoId(null);
    }
  };

  const handleFecharViewerPdf = () => {
    if (modalViewerPdf?.url) {
      URL.revokeObjectURL(modalViewerPdf.url);
    }
    setModalViewerPdf(null);
  };

  const handleSalvarPdf = async (e) => {
    if (e) e.preventDefault();
    if (!arquivoPdfUpload) {
      setMensagemErro('Selecione um arquivo PDF para carregar.');
      return;
    }
    if (!arquivoPdfUpload.name.toLowerCase().endsWith('.pdf') && arquivoPdfUpload.type !== 'application/pdf') {
      setMensagemErro('Apenas arquivos no formato PDF são permitidos.');
      return;
    }
    setEnviandoPdf(true);
    try {
      const atualizado = await uploadPdfExameApi(modalPdfExame.id, arquivoPdfUpload);
      setMensagemSucesso(`Laudo PDF de "${modalPdfExame.nome}" armazenado com sucesso no banco de dados!`);
      setModalPdfExame(atualizado);
      setArquivoPdfUpload(null);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      await carregarExames();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao armazenar PDF no banco.');
    } finally {
      setEnviandoPdf(false);
    }
  };

  const handleRemoverPdf = async (exame) => {
    if (!window.confirm(`Deseja remover o arquivo PDF do exame de "${exame.nome}"?`)) return;
    setRemovendoPdf(true);
    try {
      const atualizado = await removerPdfExameApi(exame.id);
      setMensagemSucesso('Arquivo PDF removido com sucesso.');
      if (modalPdfExame && modalPdfExame.id === exame.id) {
        setModalPdfExame(atualizado);
      }
      await carregarExames();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao remover PDF.');
    } finally {
      setRemovendoPdf(false);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6 animate-fadeIn text-zinc-800 pb-16">

      {/* ===================================================================== */}
      {/* 1. CABEÇALHO PRINCIPAL (igual ao EPIs)                                */}
      {/* ===================================================================== */}
      <div className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition shadow-xs cursor-pointer shrink-0"
            title="Voltar ao Painel Principal"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-black uppercase tracking-wider mb-1">
              <FlaskConical className="w-4 h-4 text-violet-600 stroke-[2.5]" />
              Controle de Exames Toxicológicos • Motoristas
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Relação de Motoristas & Controle de Vencimentos
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-bold mt-0.5">
              Acompanhe datas de exame, vencimentos e receba alertas automáticos por e-mail.
            </p>
          </div>
        </div>

        {/* CONTADORES RÁPIDOS */}
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0 flex-wrap">
          <div className="px-4 py-2 rounded-2xl bg-slate-50 border-2 border-slate-200 text-center min-w-[90px]">
            <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Total</span>
            <span className="text-lg font-black text-slate-950">{exames.length}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-center min-w-[90px]">
            <span className="block text-[11px] font-black text-emerald-600 uppercase tracking-wider">Em Dia</span>
            <span className="text-lg font-black text-emerald-700">{totalOk}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-amber-50 border-2 border-amber-200 text-center min-w-[90px]">
            <span className="block text-[11px] font-black text-amber-600 uppercase tracking-wider">Vencendo</span>
            <span className="text-lg font-black text-amber-700">{totalVencendo}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-red-50 border-2 border-red-200 text-center min-w-[90px]">
            <span className="block text-[11px] font-black text-red-600 uppercase tracking-wider">Vencidos</span>
            <span className="text-lg font-black text-red-700">{totalVencidos}</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. BARRA DE NAVEGAÇÃO EM ABAS (igual ao EPIs)                         */}
      {/* ===================================================================== */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border-2 border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setActiveTab('lista')}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'lista'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-200 text-slate-800'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'lista' ? 'text-violet-400' : 'text-slate-600'}`} />
            <span>1. Planilha de Motoristas</span>
          </button>

          <button
            onClick={() => setActiveTab('importar')}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'importar'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-200 text-slate-800'
            }`}
          >
            <UploadCloud className={`w-4 h-4 shrink-0 ${activeTab === 'importar' ? 'text-blue-400' : 'text-slate-600'}`} />
            <span>2. Importar Planilha</span>
          </button>
        </div>
      </div>

      {/* MENSAGENS GLOBAIS */}
      {mensagemSucesso && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs sm:text-sm font-bold animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 stroke-[2.5]" />
          <span>{mensagemSucesso}</span>
        </div>
      )}
      {mensagemErro && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-950 text-xs sm:text-sm font-bold animate-fadeIn shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 stroke-[2.5]" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. ABA: PLANILHA DE MOTORISTAS                                        */}
      {/* ===================================================================== */}
      {activeTab === 'lista' && (
        <div className="space-y-4">

          {/* BARRA DE FERRAMENTAS */}
          <div className="bg-white/95 rounded-3xl p-4 sm:p-5 border-2 border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-3">

            {/* Busca */}
            <div className="relative flex-grow min-w-[200px] w-full lg:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar motorista..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-950 placeholder:text-slate-400"
              />
            </div>

            {/* Filtro status */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-950 bg-slate-50 cursor-pointer shrink-0"
            >
              <option value="">Todos os Status</option>
              <option value="OK">Em Dia</option>
              <option value="VENCENDO">Vencendo (≤ 10d)</option>
              <option value="VENCIDO">Vencidos</option>
            </select>

            {/* Botões de ação */}
            <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
              <button
                onClick={carregarExames}
                disabled={carregando}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-black shadow-xs transition cursor-pointer border border-slate-300"
                title="Atualizar dados do servidor"
              >
                <RefreshCw className={`w-4 h-4 text-slate-700 stroke-[2.5] ${carregando ? 'animate-spin' : ''}`} />
                ATUALIZAR
              </button>

              <button
                onClick={handleExportarPdf}
                disabled={gerandoPdf || exames.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-black shadow-xs transition cursor-pointer border border-slate-300 disabled:opacity-50"
                title="Imprimir PDF"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                {gerandoPdf ? 'GERANDO...' : 'IMPRIMIR PDF'}
              </button>

              <div
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-300 shrink-0"
                title="Alertas de vencimento são enviados automaticamente pelo servidor todos os dias às 08:00"
              >
                <Bell className="w-4 h-4 stroke-[2.5] text-emerald-600" />
                E-MAIL AUTOMÁTICO · 08:00
              </div>

              <button
                onClick={() => abrirModal(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-black shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                + INSERIR MOTORISTA
              </button>
            </div>
          </div>

          {/* TABELA DE MOTORISTAS */}
          <div className="bg-white/95 rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">
            {carregando ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="w-8 h-8 text-violet-500 animate-spin stroke-[2.5]" />
                <span className="text-sm font-bold text-slate-500">Carregando motoristas...</span>
              </div>
            ) : exames.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <FlaskConical className="w-12 h-12 text-slate-300 stroke-[1.5]" />
                <span className="text-sm font-bold text-slate-400">Nenhum exame cadastrado.</span>
                <span className="text-xs text-slate-400">Insira um motorista ou carregue uma planilha.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="text-left px-5 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px] w-8">#</th>
                      <th className="text-left px-5 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px]">Motorista</th>
                      <th className="text-center px-4 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px]">Exame Toxicológico</th>
                      <th className="text-center px-4 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px]">Vencimento</th>
                      <th className="text-center px-4 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px]">Situação</th>
                      <th className="text-center px-4 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px]">Laudo (PDF)</th>
                      <th className="text-center px-4 py-3.5 font-black text-slate-600 uppercase tracking-wide text-[11px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exames.map((ex, idx) => {
                      const isVencido = ex.status === 'VENCIDO';
                      const isVencendo = ex.status === 'VENCENDO';
                      const rowBg = isVencido
                        ? 'bg-red-50/60'
                        : isVencendo
                        ? 'bg-amber-50/60'
                        : idx % 2 === 0
                        ? 'bg-white'
                        : 'bg-slate-50/50';

                      return (
                        <tr
                          key={ex.id}
                          className={`${rowBg} border-b border-slate-100 hover:bg-violet-50/30 transition-colors`}
                        >
                          <td className="px-5 py-3.5 font-black text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-black text-violet-700">
                                  {ex.nome.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-bold text-slate-900">{ex.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-bold text-slate-700">{ex.data_exame}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold ${isVencido ? 'text-red-700' : isVencendo ? 'text-amber-700' : 'text-slate-700'}`}>
                              {ex.data_vencimento}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {badgeStatus(ex.status, ex.dias_para_vencer)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {ex.tem_pdf ? (
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                <button
                                  onClick={() => handleVisualizarPdf(ex)}
                                  disabled={visualizandoId === ex.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 text-[11px] font-black border border-red-200 transition cursor-pointer shadow-2xs group"
                                  title={`Visualizar laudo: ${ex.pdf_nome || 'PDF'}`}
                                >
                                  {visualizandoId === ex.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-red-600 group-hover:scale-110 transition-transform" />
                                  )}
                                  <span>Ver PDF</span>
                                </button>

                                <button
                                  onClick={() => handleAbrirModalPdf(ex)}
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                  title="Gerenciar / Substituir Laudo PDF"
                                >
                                  <UploadCloud className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAbrirModalPdf(ex)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-violet-50 text-slate-600 hover:text-violet-700 text-[11px] font-black border border-dashed border-slate-300 hover:border-violet-300 transition cursor-pointer"
                                title="Carregar PDF do exame"
                              >
                                <FileUp className="w-3.5 h-3.5 text-slate-500" />
                                <span>Carregar PDF</span>
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => abrirModal(ex)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-600 transition cursor-pointer"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button
                                onClick={() => handleExcluir(ex)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-red-100 hover:text-red-700 text-slate-600 transition cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* LEGENDA */}
          {exames.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> EM DIA — exame em dia
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" /> VENCENDO — ≤ 10 dias
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700">
                <AlertCircle className="w-3.5 h-3.5" /> VENCIDO — prazo expirado
              </span>
              <span className="ml-auto text-xs font-bold text-slate-400">{exames.length} motorista(s) cadastrado(s)</span>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. ABA: IMPORTAR PLANILHA                                             */}
      {/* ===================================================================== */}
      {activeTab === 'importar' && (
        <div className="space-y-4">
          <div className="bg-white/95 rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-5">
            {/* Título da aba */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-black uppercase tracking-wider mb-2">
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                Importação de Planilha
              </div>
              <h2 className="text-lg font-black text-slate-900">Carregar Excel / CSV</h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                A planilha deve conter colunas: <strong>Motorista</strong> (ou Nome), <strong>Exame Toxicológico</strong> (ou Data Exame) e <strong>Vencimento</strong>.
              </p>
            </div>

            {/* Área de upload */}
            <div
              className="border-2 border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 stroke-[1.5]" />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700 text-sm">
                  {arquivoPlanilha ? arquivoPlanilha.name : 'Clique para selecionar a planilha'}
                </p>
                <p className="text-xs text-slate-400 font-bold mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setArquivoPlanilha(e.target.files?.[0] || null)}
              />
            </div>

            {arquivoPlanilha && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-violet-50 border-2 border-violet-200">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-violet-600 stroke-[2.5]" />
                  <div>
                    <p className="font-black text-violet-900 text-sm">{arquivoPlanilha.name}</p>
                    <p className="text-[11px] text-violet-600 font-bold">{(arquivoPlanilha.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setArquivoPlanilha(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="p-2 rounded-xl bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 transition cursor-pointer border border-slate-200"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    onClick={handleImportar}
                    disabled={importando}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-black shadow transition cursor-pointer disabled:opacity-60"
                  >
                    {importando ? (
                      <RefreshCw className="w-4 h-4 animate-spin stroke-[2.5]" />
                    ) : (
                      <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                    )}
                    {importando ? 'IMPORTANDO...' : 'IMPORTAR AGORA'}
                  </button>
                </div>
              </div>
            )}

            {/* Relatório de importação */}
            {relatorioImport && (
              <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
                  <span className="font-black text-emerald-900 text-sm">Importação concluída!</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-white border border-emerald-200">
                    <span className="block text-2xl font-black text-emerald-700">{relatorioImport.total_importados || 0}</span>
                    <span className="text-[11px] font-black text-emerald-600 uppercase">Inseridos</span>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white border border-emerald-200">
                    <span className="block text-2xl font-black text-blue-700">{relatorioImport.total_atualizados || 0}</span>
                    <span className="text-[11px] font-black text-blue-600 uppercase">Atualizados</span>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white border border-emerald-200">
                    <span className="block text-2xl font-black text-slate-500">{relatorioImport.total_ignorados || 0}</span>
                    <span className="text-[11px] font-black text-slate-500 uppercase">Ignorados</span>
                  </div>
                </div>
                {relatorioImport.erros?.length > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-black text-red-700 mb-1">Erros:</p>
                    <ul className="text-xs text-red-600 font-bold space-y-0.5">
                      {relatorioImport.erros.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Orientações */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Orientações</p>
              <ul className="text-xs text-slate-600 font-bold space-y-1">
                <li>• A primeira linha deve conter os cabeçalhos das colunas.</li>
                <li>• Colunas aceitas: <strong>Motorista / Nome</strong>, <strong>Exame Toxicológico / Data Exame</strong>, <strong>Vencimento</strong>.</li>
                <li>• Datas aceitas nos formatos: DD/MM/AAAA, AAAA-MM-DD ou DD-MM-AAAA.</li>
                <li>• Motoristas já cadastrados serão atualizados (UPSERT por nome).</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MODAL: INSERIR / EDITAR MOTORISTA                                  */}
      {/* ===================================================================== */}
      {modalAberto && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={fecharModal} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 z-10 animate-fadeIn my-auto">

            {/* Header modal */}
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-black uppercase tracking-wider mb-1">
                  <FlaskConical className="w-3.5 h-3.5" />
                  {editando ? 'Editar Registro' : 'Novo Motorista'}
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {editando ? editando.nome : 'Cadastrar Motorista'}
                </h3>
              </div>
              <button
                onClick={fecharModal}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome do Motorista *
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-bold focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Data do Exame *
                </label>
                <input
                  type="text"
                  value={form.data_exame}
                  onChange={(e) => setForm(f => ({ ...f, data_exame: e.target.value }))}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-bold focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Data de Vencimento *
                </label>
                <input
                  type="text"
                  value={form.data_vencimento}
                  onChange={(e) => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-bold focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  required
                />
              </div>

              {editando && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">
                      {editando.tem_pdf ? 'Laudo PDF anexado' : 'Sem laudo PDF'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fecharModal();
                      handleAbrirModalPdf(editando);
                    }}
                    className="text-xs font-black text-violet-700 hover:underline cursor-pointer"
                  >
                    {editando.tem_pdf ? 'Gerenciar Laudo' : 'Anexar Laudo'}
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-sm transition cursor-pointer disabled:opacity-60"
                >
                  {salvando ? (
                    <RefreshCw className="w-4 h-4 animate-spin stroke-[2.5]" />
                  ) : (
                    <Save className="w-4 h-4 stroke-[2.5]" />
                  )}
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* ===================================================================== */}
      {/* 6. MODAL: GERENCIAR / CARREGAR PDF DO LAUDO                           */}
      {/* ===================================================================== */}
      {modalPdfExame && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleFecharModalPdf} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 z-10 animate-fadeIn border border-slate-100 my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wider mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  Laudo Toxicológico em PDF
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {modalPdfExame.nome}
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  Realização: {modalPdfExame.data_exame} • Vencimento: {modalPdfExame.data_vencimento}
                </p>
              </div>
              <button
                onClick={handleFecharModalPdf}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Se já possui PDF anexado */}
            {modalPdfExame.tem_pdf ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate" title={modalPdfExame.pdf_nome}>
                        {modalPdfExame.pdf_nome || 'laudo_toxicologico.pdf'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-bold">
                        {modalPdfExame.pdf_tamanho ? <span>{formatarBytes(modalPdfExame.pdf_tamanho)}</span> : null}
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Armazenado no Banco
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoverPdf(modalPdfExame)}
                    disabled={removendoPdf}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer shrink-0"
                    title="Excluir este laudo do banco de dados"
                  >
                    <Trash2 className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleVisualizarPdf(modalPdfExame)}
                    disabled={visualizandoId === modalPdfExame.id}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm shadow-xs transition cursor-pointer"
                  >
                    {visualizandoId === modalPdfExame.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 stroke-[2.5]" />
                    )}
                    Visualizar PDF
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        const blob = await visualizarPdfExameApi(modalPdfExame.id, true);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = modalPdfExame.pdf_nome || `exame_${modalPdfExame.nome}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch (e) {
                        setMensagemErro('Erro ao baixar arquivo PDF.');
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs sm:text-sm transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    Baixar PDF
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Deseja substituir por um novo laudo?
                  </p>
                </div>
              </div>
            ) : null}

            {/* Área de Seleção / Upload de PDF */}
            <div className="space-y-3">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
                      setMensagemErro('Selecione apenas arquivos no formato PDF.');
                      return;
                    }
                    if (file.size > 15 * 1024 * 1024) {
                      setMensagemErro('O arquivo deve ter no máximo 15 MB.');
                      return;
                    }
                    setArquivoPdfUpload(file);
                  }
                }}
              />

              {!arquivoPdfUpload ? (
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                    <UploadCloud className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-black text-slate-800">
                      Clique para selecionar o PDF do exame
                    </p>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                      Suporta formato .PDF de até 15 MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50/50 border-2 border-red-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {arquivoPdfUpload.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-bold">
                          {formatarBytes(arquivoPdfUpload.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setArquivoPdfUpload(null);
                        if (pdfInputRef.current) pdfInputRef.current.value = '';
                      }}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                      title="Remover seleção"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleSalvarPdf}
                    disabled={enviandoPdf}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-60"
                  >
                    {enviandoPdf ? (
                      <RefreshCw className="w-4 h-4 animate-spin stroke-[2.5]" />
                    ) : (
                      <Save className="w-4 h-4 stroke-[2.5]" />
                    )}
                    {enviandoPdf ? 'Armazenando no Banco...' : 'Salvar PDF no Banco de Dados'}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleFecharModalPdf}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs sm:text-sm transition cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ===================================================================== */}
      {/* 7. MODAL: VISUALIZADOR DE PDF INTEGRADO                                */}
      {/* ===================================================================== */}
      {modalViewerPdf && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-hidden flex items-center justify-center p-2 sm:p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={handleFecharViewerPdf} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col z-10 overflow-hidden animate-fadeIn border border-slate-200 my-auto">
            
            {/* Header do visualizador */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-500/40 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black truncate">
                    {modalViewerPdf.motorista}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-bold truncate">
                    {modalViewerPdf.nome}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={modalViewerPdf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition"
                  title="Abrir em nova aba do navegador"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nova Aba</span>
                </a>

                <a
                  href={modalViewerPdf.url}
                  download={modalViewerPdf.nome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition"
                  title="Baixar PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </a>

                <button
                  onClick={handleFecharViewerPdf}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer ml-1"
                  title="Fechar visualizador"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Embed do PDF */}
            <div className="flex-1 w-full h-full bg-slate-100 p-1 sm:p-2">
              <iframe
                src={modalViewerPdf.url}
                className="w-full h-full rounded-2xl border border-slate-300 bg-white"
                title="Documento PDF"
              />
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
