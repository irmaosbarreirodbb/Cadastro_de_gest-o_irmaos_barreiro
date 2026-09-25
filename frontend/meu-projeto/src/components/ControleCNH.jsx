import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard,
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
  Truck,
  Building2,
  Layers,
  UserCheck
} from 'lucide-react';
import {
  getCNHsApi,
  createCNHApi,
  updateCNHApi,
  deleteCNHApi,
  importarPlanilhaCNHApi,
  exportarPdfCNHApi,
  verificarVencimentosCNHApi,
  uploadPdfCNHApi,
  visualizarPdfCNHApi,
  removerPdfCNHApi,
} from '../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
        Vencida {diasParaVencer < 0 ? `(${Math.abs(diasParaVencer)}d)` : ''}
      </span>
    );
  }
  if (status === 'VENCENDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        {diasParaVencer === 0 ? 'Vence hoje' : `${diasParaVencer}d restantes`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      Em dia
    </span>
  );
}

const FORM_VAZIO = {
  setor: 'FROTA',
  nome: '',
  cnh_numero: '',
  cnh_validade: '',
  observacao: ''
};

// ─── Componente Principal ────────────────────────────────────────────────────

export default function ControleCNH({ onBack }) {
  // Aba de setor: 'FROTA' | 'ADM' | 'TODOS'
  const [setorAtivo, setSetorAtivo] = useState('FROTA');

  // Estados de dados
  const [listaCNH, setListaCNH] = useState([]);
  const [contagemSetores, setContagemSetores] = useState({ frota: 0, adm: 0, total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Mensagens globais (toast)
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  // Modal inserção / edição
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  // Modal importação de planilha
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [setorImportacao, setSetorImportacao] = useState('FROTA');
  const [arquivoPlanilha, setArquivoPlanilha] = useState(null);
  const [importando, setImportando] = useState(false);
  const [relatorioImport, setRelatorioImport] = useState(null);
  const fileInputRef = useRef(null);

  // PDF Oficial
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // PDF Individual da CNH
  const [modalPdfCNH, setModalPdfCNH] = useState(null);
  const [arquivoPdfUpload, setArquivoPdfUpload] = useState(null);
  const [enviandoPdf, setEnviandoPdf] = useState(false);
  const [removendoPdf, setRemovendoPdf] = useState(false);
  const [modalViewerPdf, setModalViewerPdf] = useState(null);
  const pdfInputRef = useRef(null);

  // Disparo de E-mail
  const [enviandoAlertaEmail, setEnviandoAlertaEmail] = useState(false);

  // ── Auto-dismiss mensagens ──
  useEffect(() => {
    if (!mensagemSucesso && !mensagemErro) return;
    const t = setTimeout(() => {
      setMensagemSucesso('');
      setMensagemErro('');
    }, 5000);
    return () => clearTimeout(t);
  }, [mensagemSucesso, mensagemErro]);

  // ── Carregar CNHs da API ──
  const carregarCNHs = useCallback(async () => {
    try {
      setCarregando(true);
      const params = { busca, status: filtroStatus };
      if (setorAtivo !== 'TODOS') {
        params.setor = setorAtivo;
      }
      const [dataGeral, dataFiltrada] = await Promise.all([
        getCNHsApi({}),
        getCNHsApi(params)
      ]);

      if (Array.isArray(dataGeral)) {
        const frota = dataGeral.filter(i => (i.setor || '').toUpperCase() === 'FROTA').length;
        const adm = dataGeral.filter(i => (i.setor || '').toUpperCase() === 'ADM').length;
        setContagemSetores({ frota, adm, total: dataGeral.length });
      }

      setListaCNH(Array.isArray(dataFiltrada) ? dataFiltrada : []);
      setMensagemErro('');
    } catch (err) {
      setMensagemErro('Erro ao carregar registros de CNH. Verifique o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [busca, filtroStatus, setorAtivo]);

  useEffect(() => {
    carregarCNHs();
  }, [carregarCNHs]);

  // Estatísticas
  const totalGeral = listaCNH.length;
  const totalVencendo = listaCNH.filter(e => e.status === 'VENCENDO').length;
  const totalVencidas = listaCNH.filter(e => e.status === 'VENCIDO').length;
  const totalEmDia = listaCNH.filter(e => e.status === 'OK').length;

  // ── CRUD Condutores ──
  const abrirModalNovo = () => {
    setEditando(null);
    setForm({
      ...FORM_VAZIO,
      setor: setorAtivo === 'ADM' ? 'ADM' : 'FROTA'
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (item) => {
    setEditando(item);
    setForm({
      setor: item.setor || 'FROTA',
      nome: item.nome || '',
      cnh_numero: item.cnh_numero || '',
      cnh_validade: item.cnh_validade || '',
      observacao: item.observacao || ''
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setForm(FORM_VAZIO);
  };

  const salvarForm = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setMensagemErro('O nome do funcionário é obrigatório.');
      return;
    }
    if (!form.cnh_validade.trim()) {
      setMensagemErro('A data de validade da CNH é obrigatória.');
      return;
    }

    try {
      setSalvando(true);
      if (editando) {
        await updateCNHApi(editando.id, form);
        setMensagemSucesso(`CNH de "${form.nome}" atualizada.`);
      } else {
        await createCNHApi(form);
        setMensagemSucesso(`Condutor "${form.nome}" adicionado.`);
      }
      fecharModal();
      carregarCNHs();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao salvar dados da CNH.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirRegistro = async (item) => {
    if (!window.confirm(`Deseja excluir o registro de "${item.nome}"?`)) {
      return;
    }
    try {
      await deleteCNHApi(item.id);
      setMensagemSucesso(`Registro de "${item.nome}" removido.`);
      carregarCNHs();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao excluir CNH.');
    }
  };

  // ── Importar Planilha ──
  const abrirModalImportar = () => {
    setSetorImportacao(setorAtivo === 'ADM' ? 'ADM' : 'FROTA');
    setArquivoPlanilha(null);
    setRelatorioImport(null);
    setModalImportarAberto(true);
  };

  const fecharModalImportar = () => {
    setModalImportarAberto(false);
    setArquivoPlanilha(null);
    setRelatorioImport(null);
  };

  const handleImportarPlanilha = async () => {
    if (!arquivoPlanilha) {
      setMensagemErro('Selecione um arquivo de planilha (.xlsx ou .csv).');
      return;
    }
    try {
      setImportando(true);
      const res = await importarPlanilhaCNHApi(arquivoPlanilha, setorImportacao);
      setRelatorioImport(res);
      setMensagemSucesso(res.mensagem || 'Planilha importada com sucesso!');
      carregarCNHs();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao importar planilha.');
    } finally {
      setImportando(false);
    }
  };

  // ── Exportar PDF Oficial ──
  const handleExportarPdf = async () => {
    try {
      setGerandoPdf(true);
      const blob = await exportarPdfCNHApi(setorAtivo === 'TODOS' ? '' : setorAtivo);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setMensagemSucesso('Relatório em PDF gerado com sucesso.');
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao gerar PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // ── Enviar Alertas por E-mail ──
  const handleDispararAlertas = async () => {
    try {
      setEnviandoAlertaEmail(true);
      const res = await verificarVencimentosCNHApi();
      setMensagemSucesso(res.mensagem || 'Verificação concluída.');
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao verificar/disparar e-mails de alerta.');
    } finally {
      setEnviandoAlertaEmail(false);
    }
  };

  // ── Gerenciamento do PDF Individual da CNH ──
  const abrirModalPdf = (item) => {
    setModalPdfCNH(item);
    setArquivoPdfUpload(null);
  };

  const fecharModalPdf = () => {
    setModalPdfCNH(null);
    setArquivoPdfUpload(null);
  };

  const handleUploadPdf = async () => {
    if (!arquivoPdfUpload || !modalPdfCNH) return;
    try {
      setEnviandoPdf(true);
      await uploadPdfCNHApi(modalPdfCNH.id, arquivoPdfUpload);
      setMensagemSucesso(`PDF da CNH de "${modalPdfCNH.nome}" anexado.`);
      fecharModalPdf();
      carregarCNHs();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao enviar PDF da CNH.');
    } finally {
      setEnviandoPdf(false);
    }
  };

  const handleVisualizarPdf = async (item) => {
    try {
      const blob = await visualizarPdfCNHApi(item.id, false);
      const blobUrl = URL.createObjectURL(blob);
      setModalViewerPdf({
        nome: item.nome,
        cnh_numero: item.cnh_numero,
        pdf_nome: item.pdf_nome || 'cnh_documento.pdf',
        url: blobUrl,
      });
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao carregar documento PDF.');
    }
  };

  const handleBaixarPdf = async (item) => {
    try {
      const blob = await visualizarPdfCNHApi(item.id, true);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = item.pdf_nome || `cnh_${item.nome.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao baixar PDF.');
    }
  };

  const handleRemoverPdf = async (item) => {
    if (!window.confirm(`Deseja remover o PDF da CNH de "${item.nome}"?`)) return;
    try {
      setRemovendoPdf(true);
      await removerPdfCNHApi(item.id);
      setMensagemSucesso(`Documento PDF de "${item.nome}" removido.`);
      fecharModalPdf();
      carregarCNHs();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao remover PDF.');
    } finally {
      setRemovendoPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* ── TOPO DE NAVEGAÇÃO E TÍTULO (SUAVE, ELEGANTE E EQUILIBRADO) ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-lg border border-zinc-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Lado Esquerdo: Botão Voltar + Títulos */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer border border-zinc-200"
              title="Voltar ao Painel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold tracking-wide border border-red-100 mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Controle de CNH</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                Controle de Vencimentos CNH
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-normal">
                Gestão de CNHs dos colaboradores: <span className="font-medium text-zinc-700">Frota e Administração</span>.
              </p>
            </div>
          </div>

          {/* Lado Direito: Botões de Ação com Estilo Limpo e Proporcional */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDispararAlertas}
              disabled={enviandoAlertaEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-800 text-xs sm:text-sm font-semibold border border-amber-200 transition-colors cursor-pointer disabled:opacity-50"
              title="Disparar e-mail de alerta para a gestão"
            >
              <Bell className={`w-4 h-4 text-amber-600 ${enviandoAlertaEmail ? 'animate-bounce' : ''}`} />
              <span>{enviandoAlertaEmail ? 'Verificando...' : 'Alerta E-mail'}</span>
            </button>

            <button
              onClick={abrirModalImportar}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs sm:text-sm font-semibold border border-zinc-200 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Carregar Planilha</span>
            </button>

            <button
              onClick={handleExportarPdf}
              disabled={gerandoPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-zinc-300" />
              <span>{gerandoPdf ? 'Gerando...' : 'Imprimir Relatório (PDF)'}</span>
            </button>

            <button
              onClick={abrirModalNovo}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Inserir Condutor</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MENSAGENS TOAST SUAVES ── */}
      {mensagemSucesso && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button onClick={() => setMensagemSucesso('')} className="p-1 hover:bg-emerald-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {mensagemErro && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-medium shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{mensagemErro}</span>
          </div>
          <button onClick={() => setMensagemErro('')} className="p-1 hover:bg-red-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── CARDS DE RESUMO (CLEAN, SUAVES E MODERNOS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* TOTAL CADASTRADO */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total Cadastrado
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
            {totalGeral}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1">
            Colaboradores ativos
          </span>
        </div>

        {/* EM DIA */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Em Dia
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
            {totalEmDia}
          </div>
          <span className="text-[11px] text-emerald-600/80 mt-1">
            Regularizados
          </span>
        </div>

        {/* VENCENDO */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Vencendo (30d)
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600">
            {totalVencendo}
          </div>
          <span className="text-[11px] text-amber-600/80 mt-1">
            Requerem renovação
          </span>
        </div>

        {/* JÁ VENCIDAS */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Já Vencidas
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600">
            {totalVencidas}
          </div>
          <span className="text-[11px] text-red-600/80 mt-1">
            Ação necessária
          </span>
        </div>
      </div>

      {/* ── NAVEGAÇÃO DE SETORES & FILTROS (SUAVE E MODERNA) ── */}
      <div className="bg-white rounded-3xl p-5 shadow-lg border border-zinc-200/80 space-y-4">
        {/* ABAS EM ESTILO PÍLULA ELEGANTE */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="inline-flex p-1 rounded-2xl bg-zinc-100 border border-zinc-200/70 gap-1">
            <button
              onClick={() => setSetorAtivo('FROTA')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                setorAtivo === 'FROTA'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Frota</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                setorAtivo === 'FROTA' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {contagemSetores.frota}
              </span>
            </button>

            <button
              onClick={() => setSetorAtivo('ADM')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                setorAtivo === 'ADM'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Administração</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                setorAtivo === 'ADM' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {contagemSetores.adm}
              </span>
            </button>

            <button
              onClick={() => setSetorAtivo('TODOS')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                setorAtivo === 'TODOS'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Visão Geral</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                setorAtivo === 'TODOS' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {contagemSetores.total}
              </span>
            </button>
          </div>

          <div className="text-xs text-zinc-500 font-medium">
            Exibindo: <span className="font-semibold text-zinc-800">{setorAtivo === 'TODOS' ? 'Frota & Administração' : setorAtivo === 'FROTA' ? 'Frota' : 'Administração'}</span>
          </div>
        </div>

        {/* CAMPO DE PESQUISA E FILTROS */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome do colaborador ou nº da CNH..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-medium text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all cursor-pointer"
            >
              <option value="">Todos os status</option>
              <option value="OK">Em dia</option>
              <option value="VENCENDO">Vencendo em breve</option>
              <option value="VENCIDO">Já vencidas</option>
            </select>
          </div>

          <div className="sm:col-span-1 flex items-center justify-end">
            <button
              onClick={carregarCNHs}
              className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 border border-zinc-200 transition-colors cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── TABELA SUAVE, LIMPA E BEM ORGANIZADA ── */}
      <div className="bg-white rounded-3xl shadow-lg border border-zinc-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200 text-[11px] font-semibold uppercase text-zinc-500 tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">№</th>
                <th className="py-3.5 px-5">Funcionário</th>
                <th className="py-3.5 px-4 text-center">Setor</th>
                <th className="py-3.5 px-4 text-center">Nº CNH</th>
                <th className="py-3.5 px-4 text-center">CNH Validade</th>
                <th className="py-3.5 px-4 text-center">Situação</th>
                <th className="py-3.5 px-4 text-center">Documento PDF</th>
                <th className="py-3.5 px-5">Observação</th>
                <th className="py-3.5 px-4 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs sm:text-sm font-normal text-zinc-700">
              {carregando ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-zinc-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                    <span className="text-xs font-medium">Carregando dados...</span>
                  </td>
                </tr>
              ) : listaCNH.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-zinc-400">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 text-zinc-300 stroke-[1.5]" />
                    <p className="font-semibold text-zinc-700 text-sm">Nenhum registro de CNH encontrado</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {busca || filtroStatus
                        ? 'Tente ajustar os filtros de busca.'
                        : 'Clique em "+ Inserir Condutor" ou "Carregar Planilha" para cadastrar.'}
                    </p>
                  </td>
                </tr>
              ) : (
                listaCNH.map((item, index) => {
                  const ehFrota = (item.setor || '').toUpperCase() === 'FROTA';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/60 transition-colors"
                    >
                      {/* Nº sequencial */}
                      <td className="py-3.5 px-4 text-center font-medium text-zinc-400 text-xs">
                        {index + 1}
                      </td>

                      {/* Nome do Funcionário */}
                      <td className="py-3.5 px-5 font-semibold text-zinc-900">
                        {item.nome}
                      </td>

                      {/* Setor (Frota / Adm) */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                            ehFrota
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}
                        >
                          {ehFrota ? <Truck className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          {ehFrota ? 'Frota' : 'Adm'}
                        </span>
                      </td>

                      {/* Nº CNH */}
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-red-600 text-xs">
                        {item.cnh_numero || '—'}
                      </td>

                      {/* Validade */}
                      <td className="py-3.5 px-4 text-center font-medium text-zinc-800 text-xs">
                        {item.cnh_validade}
                      </td>

                      {/* Badge Situação */}
                      <td className="py-3.5 px-4 text-center">
                        {badgeStatus(item.status, item.dias_para_vencer)}
                      </td>

                      {/* Documento PDF da CNH */}
                      <td className="py-3.5 px-4 text-center">
                        {item.tem_pdf ? (
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <button
                              onClick={() => handleVisualizarPdf(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-medium text-xs border border-red-200 transition-colors cursor-pointer"
                              title="Visualizar documento da CNH"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver PDF</span>
                            </button>
                            <button
                              onClick={() => handleBaixarPdf(item)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                              title="Baixar arquivo PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => abrirModalPdf(item)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Substituir ou remover PDF"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => abrirModalPdf(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium text-xs transition-colors cursor-pointer"
                            title="Anexar documento PDF da CNH"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            <span>+ Anexar PDF</span>
                          </button>
                        )}
                      </td>

                      {/* Observação */}
                      <td className="py-3.5 px-5 text-xs text-zinc-500 max-w-[200px] truncate" title={item.observacao || ''}>
                        {item.observacao || '—'}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 justify-center">
                          <button
                            onClick={() => abrirModalEditar(item)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                            title="Editar dados"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => excluirRegistro(item)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE CADASTRO / EDIÇÃO ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-zinc-200 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {editando ? 'Editar Dados da CNH' : 'Novo Condutor'}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Preencha as informações do funcionário e da CNH.
                  </p>
                </div>
              </div>
              <button
                onClick={fecharModal}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarForm} className="space-y-4">
              {/* Setor: Frota ou Administração */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Setor
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      form.setor === 'FROTA'
                        ? 'border-red-500 bg-red-50/60 text-red-900 font-semibold'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="setor"
                      value="FROTA"
                      checked={form.setor === 'FROTA'}
                      onChange={() => setForm({ ...form, setor: 'FROTA' })}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <Truck className="w-4 h-4 text-red-600" />
                    <span className="text-xs">Frota</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      form.setor === 'ADM'
                        ? 'border-purple-500 bg-purple-50/60 text-purple-900 font-semibold'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="setor"
                      value="ADM"
                      checked={form.setor === 'ADM'}
                      onChange={() => setForm({ ...form, setor: 'ADM' })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span className="text-xs">Administração</span>
                  </label>
                </div>
              </div>

              {/* Nome do Funcionário */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nome do Funcionário *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ailson Sousa da Silva"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  required
                />
              </div>

              {/* Número da CNH */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Número da CNH
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1379019608"
                  value={form.cnh_numero}
                  onChange={(e) => setForm({ ...form, cnh_numero: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* Data de Validade da CNH */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  CNH Validade (DD/MM/AAAA) *
                </label>
                <input
                  type="text"
                  placeholder="Ex: 03/01/2028"
                  value={form.cnh_validade}
                  onChange={(e) => setForm({ ...form, cnh_validade: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  required
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Categoria D, etc."
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{salvando ? 'Salvando...' : 'Salvar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE IMPORTAÇÃO DE PLANILHA ── */}
      {modalImportarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-xl border border-zinc-200 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Importar Planilha de CNH
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Carregue arquivo .xlsx ou .csv com as CNHs dos colaboradores.
                  </p>
                </div>
              </div>
              <button
                onClick={fecharModalImportar}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seleção de Setor Destino */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Setor padrão da planilha
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSetorImportacao('FROTA')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      setSetorImportacao === 'FROTA'
                        ? 'border-red-500 bg-red-50/60 text-red-900'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-red-600" />
                    <span>Frota</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSetorImportacao('ADM')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      setSetorImportacao === 'ADM'
                        ? 'border-purple-500 bg-purple-50/60 text-purple-900'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>Administração</span>
                  </button>
                </div>
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Se o Excel contiver abas chamadas "Frota" e "Adm", o sistema importará ambas automaticamente.
                </span>
              </div>

              {/* Área de Seleção de Arquivo */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setArquivoPlanilha(e.target.files[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-200 hover:border-red-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-zinc-50/60 hover:bg-red-50/20"
                >
                  <UploadCloud className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                  {arquivoPlanilha ? (
                    <div>
                      <span className="font-semibold text-xs text-zinc-900 block truncate">
                        {arquivoPlanilha.name}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {formatarBytes(arquivoPlanilha.size)} &bull; Clique para trocar
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold text-xs text-zinc-700 block">
                        Clique para selecionar o arquivo
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Formatos aceitos: .xlsx, .xls, .csv
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resultado da Importação */}
              {relatorioImport && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="font-semibold text-xs text-emerald-800">
                    {relatorioImport.mensagem}
                  </div>
                  {relatorioImport.erros && relatorioImport.erros.length > 0 && (
                    <div className="text-[11px] text-amber-700 pt-1">
                      Avisos: {relatorioImport.erros.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={fecharModalImportar}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleImportarPlanilha}
                  disabled={importando || !arquivoPlanilha}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{importando ? 'Importando...' : 'Processar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE UPLOAD / GERENCIAMENTO DO PDF DA CNH ── */}
      {modalPdfCNH && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-zinc-200 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    PDF da CNH — {modalPdfCNH.nome}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Anexo da carteira de habilitação digitalizada.
                  </p>
                </div>
              </div>
              <button
                onClick={fecharModalPdf}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {modalPdfCNH.tem_pdf && (
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-xs text-zinc-900 truncate">
                        {modalPdfCNH.pdf_nome || 'cnh_documento.pdf'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {formatarBytes(modalPdfCNH.pdf_tamanho)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoverPdf(modalPdfCNH)}
                    disabled={removendoPdf}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Excluir documento PDF"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Seletor de Arquivo PDF */}
              <div>
                <input
                  type="file"
                  ref={pdfInputRef}
                  accept=".pdf"
                  onChange={(e) => setArquivoPdfUpload(e.target.files[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-200 hover:border-red-400 rounded-2xl p-5 text-center cursor-pointer transition-all bg-zinc-50/60 hover:bg-red-50/20"
                >
                  <FileUp className="w-7 h-7 mx-auto text-zinc-400 mb-1.5" />
                  {arquivoPdfUpload ? (
                    <div>
                      <span className="font-semibold text-xs text-zinc-900 block truncate">
                        {arquivoPdfUpload.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 block">
                        {formatarBytes(arquivoPdfUpload.size)} &bull; Clique para trocar
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold text-xs text-zinc-700 block">
                        {modalPdfCNH.tem_pdf ? 'Enviar novo PDF para substituir' : 'Selecionar arquivo PDF da CNH'}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 block">
                        Apenas arquivos .pdf (máx. 15 MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={fecharModalPdf}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUploadPdf}
                  disabled={enviandoPdf || !arquivoPdfUpload}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{enviandoPdf ? 'Enviando...' : 'Salvar Documento'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VISUALIZADOR INLINE DE PDF ── */}
      {modalViewerPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
            {/* Topo do Visualizador */}
            <div className="flex items-center justify-between p-3.5 px-5 border-b border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    CNH: {modalViewerPdf.nome}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Nº CNH: {modalViewerPdf.cnh_numero || '—'} &bull; {modalViewerPdf.pdf_nome}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={modalViewerPdf.url}
                  download={modalViewerPdf.pdf_nome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </a>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(modalViewerPdf.url);
                    setModalViewerPdf(null);
                  }}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quadro com o PDF embutido */}
            <div className="flex-1 bg-zinc-100 p-2">
              <iframe
                src={modalViewerPdf.url}
                title="Visualizador de CNH"
                className="w-full h-full rounded-2xl border border-zinc-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
