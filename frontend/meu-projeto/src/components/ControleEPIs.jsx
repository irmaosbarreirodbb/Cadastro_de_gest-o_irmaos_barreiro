import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  FileText,
  Plus,
  Search,
  UploadCloud,
  CheckCircle2,
  Download,
  Trash2,
  Edit3,
  ArrowLeft,
  RefreshCw,
  Layers,
  Check,
  AlertCircle,
  User,
  Users,
  HardHat,
  Eye,
  Calendar,
  Sparkles,
  ExternalLink,
  Printer,
  Save,
  X,
  UserPlus,
  History
} from 'lucide-react';
import {
  getEpisApi,
  createEpiApi,
  updateEpiApi,
  deleteEpiApi,
  previewPlanilhaEpiApi,
  importarPlanilhaEpiApi,
  importarXmlEpiApi,
  registrarEntregaEpiApi,
  getEntregasEpiApi,
  deleteEntregaEpiApi,
  updateEntregaEpiApi,
  getEpiEntregaPdfUrl,
  getColaboradorFichaPdfUrl,
  baixarColaboradorFichaPdfApi,
  carregarPadraoImagem1Api,
  getFuncionariosEpiApi,
  criarFuncionarioEpiApi
} from '../services/api';

// Categorias das Abas da Planilha (Imagem 1)
const CATEGORIAS_EPI = [
  { id: 'TODOS', label: 'Todas as Categorias', icon: Layers },
  { id: 'CABECA_AUDITIVO', label: 'Cabeça & Auditivo', icon: HardHat },
  { id: 'OCULAR_RESPIRATORIO', label: 'Ocular & Facial', icon: Eye },
  { id: 'LUVAS', label: 'Luvas & Proteção Manual', icon: Package },
  { id: 'CALCADOS', label: 'Calçados & Botas', icon: Package },
  { id: 'ERGONOMIA_VESTIMENTAS', label: 'Ergonomia & Vestimentas', icon: ShieldCheck },
];

// Tabela de Consulta do Código de EPIs (Imagem 2)
const CODIGOS_CONSULTA_EPI = [
  { cod: '1', desc: 'Capacete de Segurança' },
  { cod: '2', desc: 'Suspensão para capacete' },
  { cod: '3', desc: 'Óculos de Seg. lente escura' },
  { cod: '4', desc: 'Óculos de Seg. lente incolor' },
  { cod: '5', desc: 'Máscara de Solda' },
  { cod: '6', desc: 'Protetor Auditivo Tipo Plug' },
  { cod: '7', desc: 'Protetor Auditivo Tipo Concha' },
  { cod: '8', desc: 'Luva tric Preta' },
  { cod: '9', desc: 'Luva tric Maxgrip Verde' },
  { cod: '10', desc: 'Cinta ergonômica -Protetor Lombar' },
  { cod: '11', desc: 'Bota couro c/ biqueira kadesh' },
  { cod: '12', desc: 'Bota couro c/ biqueira kadesh cano curto / Escritório' },
  { cod: '13', desc: 'Bota de borracha 7 léguas' },
  { cod: '14', desc: 'Corta Pipas' },
  { cod: '15', desc: 'Joelheira (Motoqueiro)' },
  { cod: '16', desc: 'Cotoveleira (Motoqueiro)' },
  { cod: '17', desc: 'Mascara NR-95' },
  { cod: '18', desc: 'Capa de Chuva' },
  { cod: '19', desc: 'Luva Motoqueiro' },
  { cod: '20', desc: 'Avental de PVC / Outros' },
];

const MOTIVOS_EPI = [
  { cod: 'A', label: 'A - Admissão' },
  { cod: 'P', label: 'P - Perda' },
  { cod: 'TR', label: 'TR - Necessidade de Troca' },
  { cod: 'D', label: 'D - Demissão' },
  { cod: 'F', label: 'F - Furto' },
  { cod: 'DP', label: 'DP - Danos Provocados' },
  { cod: 'MU', label: 'MU - Mudança de função' },
];

export default function ControleEPIs({ onBack }) {
  // Aba Principal: 'estoque' | 'distribuicao' | 'planilha' | 'xml'
  const [activeMainTab, setActiveMainTab] = useState('estoque');

  // Sub-aba da Planilha de Estoque (Filtro de Categoria)
  const [activeCategoriaTab, setActiveCategoriaTab] = useState('TODOS');

  // Estados de Estoque com cache na sessão (sessionStorage evita persistência em disco DEV-04)
  const [epis, setEpis] = useState(() => {
    try {
      localStorage.removeItem('epis_estoque_cache'); // higienização de cache persistente antigo
      const salvo = sessionStorage.getItem('epis_estoque_cache');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });
  const [loadingEpis, setLoadingEpis] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('epis_estoque_cache');
      return !salvo;
    } catch {
      return true;
    }
  });
  const [buscaEstoque, setBuscaEstoque] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState(''); // '' | 'COMPRAR' | 'OK'
  const [modalEpiAberto, setModalEpiAberto] = useState(false);
  const [epiEditando, setEpiEditando] = useState(null);

  // Estados de Funcionários e Distribuição com cache em sessionStorage
  const [funcionarios, setFuncionarios] = useState(() => {
    try {
      localStorage.removeItem('epis_funcionarios_cache'); // higienização de cache persistente antigo
      const salvo = sessionStorage.getItem('epis_funcionarios_cache');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(false);
  const [buscaFuncionario, setBuscaFuncionario] = useState('');
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
  const [entregasDoFuncionario, setEntregasDoFuncionario] = useState([]);
  const [loadingEntregasFunc, setLoadingEntregasFunc] = useState(false);

  // Modal de cadastro de novo funcionário
  const [modalFuncionarioAberto, setModalFuncionarioAberto] = useState(false);
  const [formFuncionario, setFormFuncionario] = useState({ nome: '', funcao: 'Ajudante de Motorista', setor: 'Distribuição', local: 'Cascavel', data_entrada: '' });
  const [salvandoFuncionario, setSalvandoFuncionario] = useState(false);

  // Edição inline de entrega
  const [entregaEditandoId, setEntregaEditandoId] = useState(null);
  const [formEntregaEdit, setFormEntregaEdit] = useState({});
  const [salvandoEdicaoEntrega, setSalvandoEdicaoEntrega] = useState(false);

  // Form de Nova Linha na Planilha do Funcionário
  const [novaLinhaEntrega, setNovaLinhaEntrega] = useState({
    epi_id: '',
    cod_epi: '1',
    tamanho: '',
    motivo: 'A',
    quantidade: 1,
    data_entrega: new Date().toISOString().split('T')[0],
  });
  const [salvandoLinha, setSalvandoLinha] = useState(false);

  // Form novo/edição de EPI no Estoque
  const [formDataEpi, setFormDataEpi] = useState({
    descricao: '',
    fabricante: '',
    data_fabricacao: '',
    validade_epi: '',
    numero_ca: '',
    validade_ca: '',
    estoque_real: 0,
    estoque_minimo: 5,
    unidade: 'UN',
    categoria: 'CABECA_AUDITIVO',
    observacao: ''
  });

  // Estados de Importação Planilha (.xlsx, .csv)
  const [arquivoPlanilha, setArquivoPlanilha] = useState(null);
  const [previewPlanilha, setPreviewPlanilha] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImportacao, setLoadingImportacao] = useState(false);
  const [relatorioImportacao, setRelatorioImportacao] = useState(null);
  const fileInputRef = useRef(null);

  // Estados de Importação XML
  const [arquivoXml, setArquivoXml] = useState(null);
  const [loadingXml, setLoadingXml] = useState(false);
  const [relatorioXml, setRelatorioXml] = useState(null);
  const xmlInputRef = useRef(null);

  // Mensagens globais de feedback
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  // 1. CARREGAR EPIS
  const carregarEpis = async () => {
    try {
      setLoadingEpis(true);
      const data = await getEpisApi({ busca: buscaEstoque, situacao: filtroSituacao });
      if (data && Array.isArray(data)) {
        setEpis(data);
        if (!buscaEstoque && !filtroSituacao) {
          sessionStorage.setItem('epis_estoque_cache', JSON.stringify(data));
        }
      }
      setMensagemErro('');
    } catch (err) {
      console.error(err);
      const cached = sessionStorage.getItem('epis_estoque_cache');
      if (cached) {
        try {
          setEpis(JSON.parse(cached));
        } catch (e) {}
      }
    } finally {
      setLoadingEpis(false);
    }
  };

  // 2. CARREGAR FUNCIONÁRIOS (usa endpoint unificado do módulo EPI)
  const carregarFuncionarios = async () => {
    try {
      setLoadingFuncionarios(true);
      const data = await getFuncionariosEpiApi().catch(() => []);
      if (data && Array.isArray(data)) {
        setFuncionarios(data);
        sessionStorage.setItem('epis_funcionarios_cache', JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
      const cached = sessionStorage.getItem('epis_funcionarios_cache');
      if (cached) {
        try {
          setFuncionarios(JSON.parse(cached));
        } catch (e) {}
      }
    } finally {
      setLoadingFuncionarios(false);
    }
  };

  // 3. CARREGAR ENTREGAS DO FUNCIONÁRIO SELECIONADO
  const carregarEntregasFuncionario = async (nome) => {
    if (!nome) return;
    try {
      setLoadingEntregasFunc(true);
      const data = await getEntregasEpiApi({ colaborador: nome });
      setEntregasDoFuncionario(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEntregasFunc(false);
    }
  };

  useEffect(() => {
    carregarEpis();
  }, [buscaEstoque, filtroSituacao]);

  useEffect(() => {
    if (activeMainTab === 'distribuicao') {
      carregarFuncionarios();
    }
  }, [activeMainTab]);

  useEffect(() => {
    if (funcionarioSelecionado) {
      carregarEntregasFuncionario(funcionarioSelecionado.nome);
    }
  }, [funcionarioSelecionado]);

  useEffect(() => {
    if (mensagemSucesso || mensagemErro) {
      const t = setTimeout(() => {
        setMensagemSucesso('');
        setMensagemErro('');
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [mensagemSucesso, mensagemErro]);

  // CARREGAR TABELA DE EPI
  const handleCarregarTabelaPadrao = async () => {
    if (!window.confirm('Deseja carregar no estoque a tabela oficial de EPIs?')) return;
    try {
      setLoadingEpis(true);
      const res = await carregarPadraoImagem1Api();
      setMensagemSucesso(res.mensagem || 'Tabela de EPIs carregada com sucesso!');
      await carregarEpis();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao carregar tabela de EPIs.');
    } finally {
      setLoadingEpis(false);
    }
  };

  // SALVAR NOVO / EDITAR EPI
  const handleSalvarEpi = async (e) => {
    e.preventDefault();
    try {
      if (epiEditando) {
        await updateEpiApi(epiEditando.id, formDataEpi);
        setMensagemSucesso('EPI atualizado com sucesso!');
      } else {
        await createEpiApi(formDataEpi);
        setMensagemSucesso('Novo EPI adicionado ao estoque!');
      }
      setModalEpiAberto(false);
      setEpiEditando(null);
      carregarEpis();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao salvar EPI.');
    }
  };

  // EXCLUIR EPI
  const handleExcluirEpi = async (id, desc) => {
    if (!window.confirm(`Deseja realmente excluir o item "${desc}"?`)) return;
    try {
      await deleteEpiApi(id);
      setMensagemSucesso('Item excluído com sucesso.');
      carregarEpis();
    } catch (err) {
      setMensagemErro('Erro ao excluir EPI.');
    }
  };

  // SALVAR LINHA NA PLANILHA DO FUNCIONÁRIO
  const handleAdicionarLinhaEntrega = async (e) => {
    e.preventDefault();
    if (!funcionarioSelecionado) return;
    if (!novaLinhaEntrega.epi_id) {
      setMensagemErro('Selecione o EPI correspondente.');
      return;
    }

    setSalvandoLinha(true);
    try {
      await registrarEntregaEpiApi({
        epi_id: parseInt(novaLinhaEntrega.epi_id),
        colaborador_nome: funcionarioSelecionado.nome,
        colaborador_registro: funcionarioSelecionado.id ? String(funcionarioSelecionado.id).slice(0, 6) : '373',
        funcao: funcionarioSelecionado.funcao || 'Ajudante de Motorista',
        setor: 'Distribuição',
        local: 'Cascavel',
        cod_epi: novaLinhaEntrega.cod_epi,
        tamanho: novaLinhaEntrega.tamanho || '',
        motivo: novaLinhaEntrega.motivo || 'A',
        quantidade: parseFloat(novaLinhaEntrega.quantidade) || 1,
        data_entrega: novaLinhaEntrega.data_entrega,
      });

      setMensagemSucesso('Item registrado na ficha do colaborador com baixa no estoque!');
      setNovaLinhaEntrega({
        ...novaLinhaEntrega,
        tamanho: '',
        quantidade: 1,
      });
      carregarEntregasFuncionario(funcionarioSelecionado.nome);
      carregarEpis();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao adicionar linha.');
    } finally {
      setSalvandoLinha(false);
    }
  };

  // EXCLUIR LINHA DA PLANILHA DO FUNCIONÁRIO
  const handleExcluirLinhaEntrega = async (entregaId) => {
    if (!window.confirm('Deseja remover este lançamento e estornar o saldo para o estoque?')) return;
    try {
      await deleteEntregaEpiApi(entregaId);
      setMensagemSucesso('Lançamento removido e saldo estornado.');
      carregarEntregasFuncionario(funcionarioSelecionado.nome);
      carregarEpis();
    } catch (err) {
      setMensagemErro('Erro ao remover lançamento.');
    }
  };

  // INICIAR EDIÇÃO DE LINHA DE ENTREGA
  const handleIniciarEdicaoEntrega = (ent) => {
    setEntregaEditandoId(ent.id);
    setFormEntregaEdit({
      epi_id: ent.epi_id,
      cod_epi: ent.cod_epi || '',
      tamanho: ent.tamanho || '',
      motivo: ent.motivo || 'A',
      quantidade: ent.quantidade || 1,
      data_entrega: ent.data_entrega || '',
    });
  };

  // CANCELAR EDIÇÃO
  const handleCancelarEdicaoEntrega = () => {
    setEntregaEditandoId(null);
    setFormEntregaEdit({});
  };

  // SALVAR EDIÇÃO DE ENTREGA
  const handleSalvarEdicaoEntrega = async (entregaId) => {
    setSalvandoEdicaoEntrega(true);
    try {
      await updateEntregaEpiApi(entregaId, formEntregaEdit);
      setMensagemSucesso('Lançamento atualizado e saldo ajustado no estoque!');
      setEntregaEditandoId(null);
      setFormEntregaEdit({});
      carregarEntregasFuncionario(funcionarioSelecionado.nome);
      carregarEpis();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao atualizar lançamento.');
    } finally {
      setSalvandoEdicaoEntrega(false);
    }
  };

  // CADASTRAR NOVO FUNCIONÁRIO
  const handleCriarFuncionario = async (e) => {
    e.preventDefault();
    if (!formFuncionario.nome.trim()) return;
    setSalvandoFuncionario(true);
    try {
      await criarFuncionarioEpiApi(formFuncionario);
      setMensagemSucesso(`Funcionário "${formFuncionario.nome}" cadastrado com sucesso!`);
      setModalFuncionarioAberto(false);
      setFormFuncionario({ nome: '', funcao: 'Ajudante de Motorista', setor: 'Distribuição', local: 'Cascavel', data_entrada: '' });
      carregarFuncionarios();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao cadastrar funcionário.');
    } finally {
      setSalvandoFuncionario(false);
    }
  };


  // IMPORTAR PLANILHA
  const handleSelecionarPlanilha = async (file) => {
    if (!file) return;
    setArquivoPlanilha(file);
    setRelatorioImportacao(null);
    setLoadingPreview(true);
    try {
      const preview = await previewPlanilhaEpiApi(file);
      setPreviewPlanilha(preview);
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao ler arquivo da planilha.');
      setArquivoPlanilha(null);
      setPreviewPlanilha(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProcessarPlanilha = async () => {
    if (!arquivoPlanilha) return;
    setLoadingImportacao(true);
    try {
      const res = await importarPlanilhaEpiApi(arquivoPlanilha);
      setRelatorioImportacao(res);
      setMensagemSucesso(res.mensagem);
      carregarEpis();
      carregarFuncionarios();
    } catch (err) {
      setMensagemErro(err.message || 'Falha na importação.');
    } finally {
      setLoadingImportacao(false);
    }
  };

  // IMPORTAR XML NF-e
  const handleProcessarXml = async (file) => {
    if (!file) return;
    setArquivoXml(file);
    setLoadingXml(true);
    try {
      const res = await importarXmlEpiApi(file);
      setRelatorioXml(res);
      setMensagemSucesso(res.mensagem);
      carregarEpis();
    } catch (err) {
      setMensagemErro(err.message || 'Erro ao processar nota fiscal XML.');
    } finally {
      setLoadingXml(false);
    }
  };

  // Filtro de EPIs por Categoria na Aba de Estoque
  const episFiltrados = useMemo(() => {
    if (activeCategoriaTab === 'TODOS') return epis;
    return epis.filter(e => {
      if (activeCategoriaTab === 'CABECA_AUDITIVO') {
        return e.categoria === 'CABECA_AUDITIVO' || /capacete|abafador|plug|auditivo/i.test(e.descricao);
      }
      if (activeCategoriaTab === 'OCULAR_RESPIRATORIO') {
        return e.categoria === 'OCULAR_RESPIRATORIO' || /oculos|óculos|respirador|cartucho|facial/i.test(e.descricao);
      }
      if (activeCategoriaTab === 'LUVAS') {
        return e.categoria === 'LUVAS' || /luva/i.test(e.descricao);
      }
      if (activeCategoriaTab === 'CALCADOS') {
        return e.categoria === 'CALCADOS' || /bota|calcado|calçado/i.test(e.descricao);
      }
      if (activeCategoriaTab === 'ERGONOMIA_VESTIMENTAS') {
        return e.categoria === 'ERGONOMIA_VESTIMENTAS' || /cinta|avental|capa|uniforme/i.test(e.descricao);
      }
      return true;
    });
  }, [epis, activeCategoriaTab]);

  // Filtro de Funcionários
  const funcionariosFiltrados = useMemo(() => {
    if (!buscaFuncionario.trim()) return funcionarios;
    const t = buscaFuncionario.toLowerCase();
    return funcionarios.filter(f =>
      (f.nome && f.nome.toLowerCase().includes(t)) ||
      (f.funcao && f.funcao.toLowerCase().includes(t))
    );
  }, [funcionarios, buscaFuncionario]);

  return (
    <div className="w-full space-y-6 animate-fadeIn text-zinc-800 pb-16">

      {/* ========================================================================================= */}
      {/* 1. CABEÇALHO PRINCIPAL E STATS                                                            */}
      {/* ========================================================================================= */}
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-red-600 stroke-[2.5]" />
              Controle Oficial de EPIs &bull; NR-6 / Art. 482 CLT
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Gestão de Estoque &amp; Fichas de Distribuição
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-bold mt-0.5">
              Visualizador de planilha com abas por categoria e fichas individuais assinadas por colaborador.
            </p>
          </div>
        </div>

        {/* CONTADORES RÁPIDOS NO CABEÇALHO */}
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <div className="px-4 py-2 rounded-2xl bg-slate-50 border-2 border-slate-200 text-center min-w-[110px]">
            <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Itens Catálogo</span>
            <span className="text-lg font-black text-slate-950">{epis.length}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-slate-50 border-2 border-slate-200 text-center min-w-[110px]">
            <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Colaboradores</span>
            <span className="text-lg font-black text-slate-950">{funcionarios.length}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* 2. BARRA DE NAVEGAÇÃO PRINCIPAL (SEGMENTED CONTROL FULL-WIDTH 100% ORGANIZADO)             */}
      {/* ========================================================================================= */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border-2 border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
          <button
            onClick={() => {
              setActiveMainTab('estoque');
              setFuncionarioSelecionado(null);
            }}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeMainTab === 'estoque'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-200 text-slate-800'
              }`}
          >
            <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeMainTab === 'estoque' ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>1. Planilha de Estoque</span>
          </button>

          <button
            onClick={() => setActiveMainTab('distribuicao')}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeMainTab === 'distribuicao'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white hover:bg-slate-200 text-slate-800'
              }`}
          >
            <Users className={`w-4 h-4 shrink-0 ${activeMainTab === 'distribuicao' ? 'text-white' : 'text-slate-600'}`} />
            <span>2. Distribuição por Funcionário</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('planilha');
              setFuncionarioSelecionado(null);
            }}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeMainTab === 'planilha'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-200 text-slate-800'
              }`}
          >
            <UploadCloud className={`w-4 h-4 shrink-0 ${activeMainTab === 'planilha' ? 'text-blue-400' : 'text-slate-600'}`} />
            <span>3. Importar Planilha</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('xml');
              setFuncionarioSelecionado(null);
            }}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeMainTab === 'xml'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-200 text-slate-800'
              }`}
          >
            <FileCode className={`w-4 h-4 shrink-0 ${activeMainTab === 'xml' ? 'text-amber-400' : 'text-slate-600'}`} />
            <span>4. Entrada por NF-e XML</span>
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

      {/* ========================================================================================= */}
      {/* 3. VISUALIZADOR DE PLANILHA DE ESTOQUE COMPLETO COM ABAS POR CATEGORIA                     */}
      {/* ========================================================================================= */}
      {activeMainTab === 'estoque' && (
        <div className="space-y-4">

          {/* BARRA DE FERRAMENTAS E BUSCA DO ESTOQUE */}
          <div className="bg-white/95 rounded-3xl p-4 sm:p-5 border-2 border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-grow">
              <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-950 font-black text-xs border border-emerald-300 flex items-center gap-1.5 shrink-0">
                <span className="text-emerald-700 font-black">fx</span>
                ESTOQUE MÍNIMO DE EPI
              </div>

              <div className="relative flex-grow min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
                <input
                  type="text"
                  value={buscaEstoque}
                  onChange={(e) => setBuscaEstoque(e.target.value)}
                  placeholder="Localizar descrição, CA ou fabricante..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-950 placeholder:text-slate-400"
                />
              </div>

              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-950 bg-slate-50 cursor-pointer"
              >
                <option value="">Todas as Situações</option>
                <option value="COMPRAR">Apenas Situação COMPRAR</option>
                <option value="OK">Apenas Situação OK</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                onClick={handleCarregarTabelaPadrao}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black shadow-xs transition cursor-pointer"
                title="Carregar tabela oficial de EPIs no estoque"
              >
                <Sparkles className="w-4 h-4 text-amber-300 stroke-[2.5]" />
                CARREGAR TABELA DE EPI
              </button>

              <button
                onClick={() => {
                  setEpiEditando(null);
                  setFormDataEpi({
                    descricao: '',
                    fabricante: '',
                    data_fabricacao: '',
                    validade_epi: '',
                    numero_ca: '',
                    validade_ca: '',
                    estoque_real: 0,
                    estoque_minimo: 5,
                    unidade: 'UN',
                    categoria: activeCategoriaTab !== 'TODOS' ? activeCategoriaTab : 'CABECA_AUDITIVO',
                    observacao: ''
                  });
                  setModalEpiAberto(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-black shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                INSERIR EPI
              </button>
            </div>
          </div>

          {/* ABAS COLORIDAS PARA CADA TIPO DE EPI */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIAS_EPI.map((cat) => {
              const Icone = cat.icon;
              const ativa = activeCategoriaTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoriaTab(cat.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-2xl font-black text-xs border-t-2 transition-all whitespace-nowrap cursor-pointer ${ativa
                      ? 'bg-white text-slate-950 border-emerald-600 shadow-sm'
                      : 'bg-slate-200/90 hover:bg-slate-300 text-slate-800 border-transparent'
                    }`}
                >
                  <Icone className={`w-4 h-4 stroke-[2.5] ${ativa ? 'text-emerald-600' : 'text-slate-600'}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* TABELA VISUALIZADOR DE PLANILHA */}
          <div className="bg-white rounded-b-3xl rounded-tr-3xl border-2 border-slate-300 shadow-md overflow-hidden">
            <div className="overflow-x-auto max-h-[620px] border-b border-slate-200">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider select-none">
                    <th className="py-3 px-2 text-center w-12 border-r border-slate-700">#</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-center w-16">ITEM</th>
                    <th className="py-3 px-4 border-r border-slate-700 min-w-[280px]">DESCRIÇÃO DO EPI</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-center">DATA FABRICAÇÃO</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-center">VALIDADE EPI</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-center w-24">N° CA</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-center">VALIDADE CA</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-right w-28">ESTOQUE REAL</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-right w-28">ESTOQUE MÍN.</th>
                    <th className="py-3 px-3 border-r border-slate-700 text-center w-28">SITUAÇÃO</th>
                    <th className="py-3 px-3 text-center w-20">AÇÃO</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {loadingEpis ? (
                    <tr>
                      <td colSpan="11" className="py-16 text-center text-slate-800 font-bold">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Carregando planilha de estoque...
                      </td>
                    </tr>
                  ) : episFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-16 text-center text-slate-800 space-y-2">
                        <p className="font-black text-sm">Nenhum EPI encontrado nesta categoria.</p>
                        <p className="text-xs text-slate-600 font-bold">
                          Clique no botão <b>"CARREGAR TABELA DE EPI"</b> acima para popular os itens automaticamente.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    episFiltrados.map((item, index) => {
                      const precisaComprar = item.situacao === 'COMPRAR';
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-100 transition-colors ${index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'
                            } ${precisaComprar ? 'hover:bg-red-50/40' : ''}`}
                        >
                          {/* Linha Sequencial */}
                          <td className="py-2.5 px-2 text-center font-mono font-black text-xs text-slate-600 bg-slate-100 border-r border-slate-200 select-none">
                            {index + 1}
                          </td>

                          {/* Item (ID) */}
                          <td className="py-2.5 px-3 font-mono font-black text-slate-900 border-r border-slate-200 text-center">
                            {item.id}
                          </td>

                          {/* Descrição */}
                          <td className="py-2.5 px-4 font-black text-slate-950 text-xs sm:text-sm border-r border-slate-200">
                            {item.descricao}
                          </td>

                          {/* Data Fabricação */}
                          <td className="py-2.5 px-3 text-center text-slate-800 border-r border-slate-200 font-bold text-xs">
                            {item.data_fabricacao || 'N/A'}
                          </td>

                          {/* Validade EPI */}
                          <td className="py-2.5 px-3 text-center text-slate-800 border-r border-slate-200 font-bold text-xs">
                            {item.validade_epi || 'N/A'}
                          </td>

                          {/* Nº CA */}
                          <td className="py-2.5 px-3 text-center border-r border-slate-200">
                            {item.numero_ca && item.numero_ca !== 'N/A' ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 font-black text-slate-950 text-xs">
                                {item.numero_ca}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold text-xs">N/A</span>
                            )}
                          </td>

                          {/* Validade CA */}
                          <td className="py-2.5 px-3 text-center text-slate-800 border-r border-slate-200 font-bold text-xs">
                            {item.validade_ca || 'N/A'}
                          </td>

                          {/* Estoque Real */}
                          <td className="py-2.5 px-3 text-right border-r border-slate-200">
                            <span className="font-black text-slate-950 text-sm">{item.estoque_real}</span>{' '}
                            <span className="text-[11px] text-slate-600 font-bold">{item.unidade}</span>
                          </td>

                          {/* Estoque Mínimo */}
                          <td className="py-2.5 px-3 text-right border-r border-slate-200">
                            <span className="font-bold text-slate-800 text-xs">{item.estoque_minimo}</span>{' '}
                            <span className="text-[11px] text-slate-600 font-bold">{item.unidade}</span>
                          </td>

                          {/* Situação (Badge Comprar / OK) */}
                          <td className="py-2.5 px-3 text-center border-r border-slate-200">
                            {precisaComprar ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white uppercase tracking-wider shadow-xs animate-pulse">
                                COMPRAR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white uppercase tracking-wider shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                                OK
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEpiEditando(item);
                                  setFormDataEpi({
                                    descricao: item.descricao,
                                    fabricante: item.fabricante || '',
                                    data_fabricacao: item.data_fabricacao || '',
                                    validade_epi: item.validade_epi || '',
                                    numero_ca: item.numero_ca || '',
                                    validade_ca: item.validade_ca || '',
                                    estoque_real: item.estoque_real,
                                    estoque_minimo: item.estoque_minimo,
                                    unidade: item.unidade || 'UN',
                                    categoria: item.categoria || 'CABECA_AUDITIVO',
                                    observacao: item.observacao || ''
                                  });
                                  setModalEpiAberto(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                                title="Editar linha"
                              >
                                <Edit3 className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button
                                onClick={() => handleExcluirEpi(item.id, item.descricao)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 transition"
                                title="Excluir item"
                              >
                                <Trash2 className="w-4 h-4 stroke-[2.5]" />
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

            {/* Rodapé da Planilha com Legenda */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs font-black text-slate-800 gap-2">
              <div>
                Total de itens exibidos: <span className="text-slate-950 font-black">{episFiltrados.length}</span> de <span className="text-slate-950 font-black">{epis.length}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> OK: Estoque Regular
                </span>
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Comprar: Estoque Real &le; Mínimo
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* 4. DISTRIBUIÇÃO POR FUNCIONÁRIO (LISTA DE COLABORADORES)                                  */}
      {/* ========================================================================================= */}
      {activeMainTab === 'distribuicao' && !funcionarioSelecionado && (
        <div className="bg-white/95 rounded-3xl p-5 sm:p-7 border-2 border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wider mb-1">
                Ficha Oficial de EPI &bull; Imagem 2
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Distribuição de EPIs por Funcionário
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-bold mt-0.5">
                Selecione o colaborador abaixo e clique em <b>"Abrir Planilha de EPIs"</b> para lançar entregas e emitir a Ficha Oficial em PDF assinada.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                onClick={() => setModalFuncionarioAberto(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md transition cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                + Cadastrar Funcionário
              </button>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
                <input
                  type="text"
                  value={buscaFuncionario}
                  onChange={(e) => setBuscaFuncionario(e.target.value)}
                  placeholder="Buscar por nome ou função..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-300 text-xs sm:text-sm bg-slate-50/70 font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* TABELA DE FUNCIONÁRIOS CADASTRADOS */}
          <div className="overflow-x-auto border-2 border-slate-300 rounded-2xl shadow-xs">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4">Nome do Colaborador</th>
                  <th className="py-3.5 px-4">Função / Cargo</th>
                  <th className="py-3.5 px-4">Data Entrada</th>
                  <th className="py-3.5 px-4 text-center">EPIs Entregues</th>
                  <th className="py-3.5 px-4 text-center">Ficha PDF</th>
                  <th className="py-3.5 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loadingFuncionarios ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-800 font-bold">
                      Carregando catálogo de funcionários de EPI...
                    </td>
                  </tr>
                ) : funcionariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-700">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-10 h-10 text-slate-400 stroke-[2]" />
                        <span className="font-bold text-sm">Nenhum colaborador encontrado.</span>
                        <button
                          onClick={() => setModalFuncionarioAberto(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition"
                        >
                          <UserPlus className="w-4 h-4 stroke-[2.5]" />
                          Cadastrar Primeiro Funcionário
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  funcionariosFiltrados.map((func) => (
                    <tr key={func.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-950">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                            {(func.nome || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-black text-slate-950 block">{func.nome}</span>
                            <span className="text-[11px] font-bold text-slate-500 block">Cascavel / Distribuição</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 font-bold text-xs text-slate-900">
                          {func.funcao || 'Ajudante de Motorista'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-xs">
                        {func.data_entrada || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {func.total_epis > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 font-black text-xs border border-blue-200">
                            <History className="w-3.5 h-3.5 stroke-[2.5]" />
                            {func.total_epis} EPI{func.total_epis !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-xs">
                            Sem EPIs
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={async () => {
                            try {
                              const blob = await baixarColaboradorFichaPdfApi(func.nome);
                              const blobUrl = URL.createObjectURL(blob);
                              window.open(blobUrl, '_blank', 'noopener,noreferrer');
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                            } catch (err) {
                              alert(err?.message || 'Erro ao abrir o PDF da Ficha de EPI.');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white font-black text-xs border border-red-200 transition cursor-pointer"
                          title="Baixar PDF da Ficha de EPI deste funcionário"
                        >
                          <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                          PDF
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setFuncionarioSelecionado(func)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                          Abrir Planilha de EPIs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* 2.1 PÁGINA DO VISUALIZADOR DE PLANILHA DO FUNCIONÁRIO SELECIONADO (EXATAMENTE IMAGEM 2)   */}
      {/* ========================================================================================= */}
      {activeMainTab === 'distribuicao' && funcionarioSelecionado && (
        <div className="bg-white/95 rounded-3xl p-5 sm:p-7 border border-zinc-200 shadow-md space-y-6 animate-fadeIn">

          {/* TOPO DA FICHA COM BOTÃO VOLTAR E BOTÃO GERAR PDF DA IMAGEM 2 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFuncionarioSelecionado(null)}
                className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition"
                title="Voltar à lista de colaboradores"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                  Planilha de Distribuição de EPIs &bull; {funcionarioSelecionado.nome}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-700 font-medium mt-0.5">
                  Função: <strong className="text-zinc-950 font-black">{funcionarioSelecionado.funcao || 'Ajudante de Motorista'}</strong> &bull; Setor: <strong className="text-zinc-950 font-black">{funcionarioSelecionado.setor || 'Distribuição'}</strong> &bull; Local: <strong className="text-zinc-950 font-black">{funcionarioSelecionado.local || 'Cascavel'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* PAINEL DE CONSULTA DOS CÓDIGOS DE EPI (ALTO CONTRASTE E FONTE NÍTIDA) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border-2 border-slate-300 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                📋 CÓDIGO DOS EPI'S (TABELA DE CONSULTA DA IMAGEM 2)
              </span>
              <span className="text-xs font-black text-red-700 bg-red-100/90 px-3 py-1 rounded-lg border border-red-300">
                LEGENDA: A- Admissão &bull; P- Perda &bull; TR- Troca &bull; D- Demissão &bull; F- Furto &bull; DP- Danos &bull; MU- Mudança
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {CODIGOS_CONSULTA_EPI.map((c) => (
                <div
                  key={c.cod}
                  className="bg-white p-2 rounded-xl border-2 border-slate-200 hover:border-slate-500 flex items-center gap-2 shadow-xs transition hover:bg-slate-50"
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {c.cod}
                  </span>
                  <span className="text-xs font-bold text-slate-950 truncate leading-snug" title={c.desc}>
                    {c.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* FORMULÁRIO DE NOVA LINHA NA PLANILHA DO FUNCIONÁRIO */}
          <form onSubmit={handleAdicionarLinhaEntrega} className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wider">
              <Plus className="w-4 h-4 text-emerald-700 stroke-[3]" />
              + INSERIR LANÇAMENTO NA PLANILHA DO COLABORADOR
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs sm:text-sm">
              <div className="lg:col-span-2">
                <label className="block font-black text-slate-900 mb-1 text-xs">EPI do Estoque *</label>
                <select
                  required
                  value={novaLinhaEntrega.epi_id}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const epiObj = epis.find(item => String(item.id) === String(selId));
                    setNovaLinhaEntrega({
                      ...novaLinhaEntrega,
                      epi_id: selId,
                      cod_epi: epiObj ? String(epiObj.id) : novaLinhaEntrega.cod_epi
                    });
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-slate-400 bg-white font-bold text-slate-950 shadow-xs"
                >
                  <option value="">Selecione o EPI...</option>
                  {epis.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id} - {e.descricao} (Saldo: {e.estoque_real})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-slate-900 mb-1 text-xs">Cód. EPI (1 a 20)</label>
                <input
                  type="text"
                  value={novaLinhaEntrega.cod_epi}
                  onChange={(e) => setNovaLinhaEntrega({ ...novaLinhaEntrega, cod_epi: e.target.value })}
                  placeholder="Ex: 10, 11..."
                  className="w-full py-2 px-3 rounded-xl border border-slate-400 bg-white font-bold text-slate-950 shadow-xs"
                />
              </div>

              <div>
                <label className="block font-black text-slate-900 mb-1 text-xs">Tamanho / Nº</label>
                <input
                  type="text"
                  value={novaLinhaEntrega.tamanho}
                  onChange={(e) => setNovaLinhaEntrega({ ...novaLinhaEntrega, tamanho: e.target.value })}
                  placeholder="Ex: M, G, 41..."
                  className="w-full py-2 px-3 rounded-xl border border-slate-400 bg-white font-bold text-slate-950 shadow-xs"
                />
              </div>

              <div>
                <label className="block font-black text-slate-900 mb-1 text-xs">Motivo</label>
                <select
                  value={novaLinhaEntrega.motivo}
                  onChange={(e) => setNovaLinhaEntrega({ ...novaLinhaEntrega, motivo: e.target.value })}
                  className="w-full py-2 px-2 rounded-xl border border-slate-400 bg-white font-bold text-slate-950 text-xs shadow-xs"
                >
                  {MOTIVOS_EPI.map((m) => (
                    <option key={m.cod} value={m.cod}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-slate-900 mb-1 text-xs">Qtde.</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={novaLinhaEntrega.quantidade}
                  onChange={(e) => setNovaLinhaEntrega({ ...novaLinhaEntrega, quantidade: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-400 bg-white font-black text-slate-950 shadow-xs text-center"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={salvandoLinha}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {salvandoLinha ? 'Salvando...' : 'Lançar Linha'}
                </button>
              </div>
            </div>
          </form>

          {/* TABELA VISUALIZADOR DE PLANILHA DA FICHA DO COLABORADOR */}
          <div className="border-2 border-slate-300 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-[#1e3a8a] text-white p-3 font-black text-xs sm:text-sm text-center uppercase tracking-wider">
              CONTROLE DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL - EPI
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0f2d6b] text-white font-bold text-xs uppercase">
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-16">Qtde.</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-28">Cód. EPI</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-24">Tamanho/Nº</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-20">Motivo</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 min-w-[180px]">Descrição do EPI</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-24">CA</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-28">Data Receb.</th>
                    <th className="py-2.5 px-3 text-center border-r border-blue-400/40 w-32">Assinatura</th>
                    <th className="py-2.5 px-3 text-center w-20">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white font-medium">
                  {loadingEntregasFunc ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-zinc-800 font-bold">
                        Carregando planilha do colaborador...
                      </td>
                    </tr>
                  ) : entregasDoFuncionario.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-zinc-600 font-bold">
                        Nenhum EPI registrado nesta ficha ainda. Utilize o formulário acima para lançar o primeiro item.
                      </td>
                    </tr>

                  ) : (
                    entregasDoFuncionario.map((ent, idx) => {
                      const isEditing = entregaEditandoId === ent.id;
                      return (
                        <tr key={ent.id} className={`${isEditing ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset' : idx % 2 === 1 ? 'bg-zinc-50' : 'bg-white'} transition-colors`}>
                          {isEditing ? (
                            <>
                              {/* LINHA EM MODO EDIÇÃO */}
                              <td className="py-1.5 px-2 border-r border-zinc-200">
                                <input
                                  type="number" min="1" step="1"
                                  value={formEntregaEdit.quantidade}
                                  onChange={(e) => setFormEntregaEdit({ ...formEntregaEdit, quantidade: e.target.value })}
                                  className="w-full py-1 px-2 rounded-lg border border-amber-300 bg-white font-mono text-xs text-center"
                                />
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200">
                                <input
                                  type="text"
                                  value={formEntregaEdit.cod_epi}
                                  onChange={(e) => setFormEntregaEdit({ ...formEntregaEdit, cod_epi: e.target.value })}
                                  className="w-full py-1 px-2 rounded-lg border border-amber-300 bg-white font-mono text-xs text-center"
                                  placeholder="Cód."
                                />
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200">
                                <input
                                  type="text"
                                  value={formEntregaEdit.tamanho}
                                  onChange={(e) => setFormEntregaEdit({ ...formEntregaEdit, tamanho: e.target.value })}
                                  className="w-full py-1 px-2 rounded-lg border border-amber-300 bg-white font-mono text-xs text-center"
                                  placeholder="Tam."
                                />
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200">
                                <select
                                  value={formEntregaEdit.motivo}
                                  onChange={(e) => setFormEntregaEdit({ ...formEntregaEdit, motivo: e.target.value })}
                                  className="w-full py-1 px-1 rounded-lg border border-amber-300 bg-white text-xs"
                                >
                                  {MOTIVOS_EPI.map((m) => (
                                    <option key={m.cod} value={m.cod}>{m.cod}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200 text-slate-950 font-bold text-xs">
                                {ent.epi ? ent.epi.descricao : 'EPI'}
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200 text-center font-mono font-bold text-slate-900 text-xs">
                                {ent.epi?.numero_ca || 'S/CA'}
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200">
                                <input
                                  type="date"
                                  value={formEntregaEdit.data_entrega}
                                  onChange={(e) => setFormEntregaEdit({ ...formEntregaEdit, data_entrega: e.target.value })}
                                  className="w-full py-1 px-1 rounded-lg border border-amber-300 bg-white text-xs font-bold text-slate-900"
                                />
                              </td>
                              <td className="py-1.5 px-2 border-r border-zinc-200 text-center font-mono text-zinc-300 select-none text-xs">
                                ________________
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={handleSalvarEdicaoEntrega}
                                    disabled={salvandoLinha}
                                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow"
                                    title="Salvar alterações"
                                  >
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={handleCancelarEdicaoEntrega}
                                    className="p-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-700 transition"
                                    title="Cancelar edição"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* LINHA EM MODO VISUALIZAÇÃO */}
                              <td className="py-2.5 px-3 text-center font-mono font-black text-slate-950 text-sm border-r border-zinc-200">
                                {ent.quantidade}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-blue-900 text-sm border-r border-zinc-200">
                                {ent.cod_epi || ent.epi_id}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 border-r border-zinc-200">
                                {ent.tamanho || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-zinc-200">
                                <span className="px-2.5 py-1 rounded-md bg-slate-200 border border-slate-300 font-black text-slate-950 text-xs">
                                  {ent.motivo}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-950 text-xs sm:text-sm border-r border-zinc-200">
                                {ent.epi ? ent.epi.descricao : 'EPI'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 border-r border-zinc-200">
                                {ent.epi?.numero_ca || 'S/CA'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 border-r border-zinc-200">
                                {ent.data_entrega}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-r border-zinc-200 select-none">
                                ________________
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleIniciarEdicaoEntrega(ent)}
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white transition"
                                    title="Editar este lançamento"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleExcluirLinhaEntrega(ent.id)}
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-500 text-red-400 hover:text-white transition"
                                    title="Remover linha e estornar saldo"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================================= */}
      {/* 3. IMPORTAÇÃO DE PLANILHA (.XLSX / .CSV) COM PRÉ-VISUALIZAÇÃO                             */}
      {/* ========================================================================================= */}
      {activeMainTab === 'planilha' && (
        <div className="bg-white/95 rounded-3xl p-5 sm:p-7 border border-zinc-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900">
                Carga &amp; Migração de Planilha (.xlsx / .csv)
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Envie sua planilha de EPIs com estoque e colaboradores. O sistema mapeia as colunas e atualiza automaticamente o estoque e as entregas dos funcionários.
              </p>
            </div>
            <a
              href="/Planilha_EPIs_e_Funcionarios.xlsx"
              download="Planilha_EPIs_e_Funcionarios.xlsx"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition shrink-0"
              title="Baixar planilha preenchida pronta com EPIs e Funcionários"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Baixar Modelo Preenchido (.xlsx)
            </a>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleSelecionarPlanilha(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelecionarPlanilha(e.target.files[0]);
                }
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white mx-auto flex items-center justify-center transition-colors shadow-xs mb-3">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">
              {arquivoPlanilha ? arquivoPlanilha.name : 'Arraste a planilha de EPIs ou clique aqui'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Suporta planilhas do Excel (.xlsx, .xls) ou Valores Separados por Vírgula (.csv)
            </p>
          </div>

          {loadingPreview && (
            <div className="py-6 text-center text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Lendo colunas da planilha e gerando pré-visualização...
            </div>
          )}

          {previewPlanilha && !relatorioImportacao && (
            <div className="space-y-4 border border-zinc-200 rounded-2xl p-4 sm:p-5 bg-zinc-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Pré-visualização da Planilha ({previewPlanilha.total_linhas} linhas detectadas)
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Confira a amostra dos dados lidos antes de confirmar a gravação definitiva no banco.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setArquivoPlanilha(null);
                      setPreviewPlanilha(null);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleProcessarPlanilha}
                    disabled={loadingImportacao}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {loadingImportacao ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Gravando no Banco...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Processar e Salvar no Banco
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold sticky top-0">
                    <tr>
                      {previewPlanilha.colunas.map((col, idx) => (
                        <th key={idx} className="py-2 px-3 border-b border-zinc-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono text-[11px]">
                    {previewPlanilha.linhas.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-zinc-50">
                        {previewPlanilha.colunas.map((col, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-zinc-700">
                            {row[col] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {relatorioImportacao && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-3xl p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-emerald-900">
                    Migração Concluída com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-700">{relatorioImportacao.mensagem}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Linhas</span>
                  <p className="text-lg font-black text-zinc-800">{relatorioImportacao.total_linhas}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold">Novos Cadastrados</span>
                  <p className="text-lg font-black text-emerald-600">{relatorioImportacao.inseridos}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-blue-600 uppercase font-semibold">Atualizados (Upsert)</span>
                  <p className="text-lg font-black text-blue-600">{relatorioImportacao.atualizados}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-red-500 uppercase font-semibold">Linhas com Falhas</span>
                  <p className="text-lg font-black text-red-500">{relatorioImportacao.falhas}</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setArquivoPlanilha(null);
                    setPreviewPlanilha(null);
                    setRelatorioImportacao(null);
                    setActiveMainTab('estoque');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow transition"
                >
                  Abrir Visualizador de Planilha de Estoque
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================================= */}
      {/* 4. ENTRADA VIA NOTA FISCAL (DANFE XML)                                                    */}
      {/* ========================================================================================= */}
      {activeMainTab === 'xml' && (
        <div className="bg-white/95 rounded-3xl p-5 sm:p-7 border border-zinc-200 shadow-md space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900">
              Entrada de Estoque por Nota Fiscal (DANFE XML)
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Envie o arquivo <b>.xml</b> da NF-e para alimentar automaticamente o estoque real com os itens adquiridos da distribuidora/fornecedor.
            </p>
          </div>

          <div
            onClick={() => xmlInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 hover:border-amber-500 hover:bg-amber-50/20 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group"
          >
            <input
              ref={xmlInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessarXml(e.target.files[0]);
                }
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-amber-50 group-hover:bg-amber-500 text-amber-600 group-hover:text-white mx-auto flex items-center justify-center transition-colors shadow-xs mb-3">
              <FileCode className="w-8 h-8" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">
              {arquivoXml ? arquivoXml.name : 'Selecione o arquivo XML da NF-e'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              O sistema identifica o fornecedor, número da nota e itens com suas quantidades.
            </p>
          </div>

          {loadingXml && (
            <div className="py-6 text-center text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
              Lendo XML da NF-e e atualizando saldo de estoque no banco...
            </div>
          )}

          {relatorioXml && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-3xl p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-emerald-900">
                    NF-e Processada com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Fornecedor: <b>{relatorioXml.fornecedor || 'N/A'}</b> &bull; NF-e Nº: <b>{relatorioXml.numero_nota || 'S/N'}</b>
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {relatorioXml.total_itens_processados} itens na nota
                </span>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Item / Descrição</th>
                      <th className="py-2.5 px-3 text-right">Qtd Adicionada</th>
                      <th className="py-2.5 px-3 text-right">Novo Saldo</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {relatorioXml.detalhes?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-zinc-800">{item.descricao}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">+{item.quantidade_entrada}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">{item.saldo_novo}</td>
                        <td className="py-2 px-3 text-xs text-zinc-500">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO MANUAL DE EPI                                                    */}
      {/* ========================================================================================= */}
      {modalEpiAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full border border-zinc-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                {epiEditando ? 'Editar Item da Planilha' : 'Novo EPI na Planilha'}
              </h3>
              <button
                onClick={() => setModalEpiAberto(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSalvarEpi} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Descrição do EPI (Coluna DESCRIÇÃO) *
                </label>
                <input
                  type="text"
                  required
                  value={formDataEpi.descricao}
                  onChange={(e) => setFormDataEpi({ ...formDataEpi, descricao: e.target.value })}
                  placeholder="Ex: ABAFADOR TIPO CONCHA FLUX, BOTA DE SEGURANÇA Nº38..."
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm font-medium bg-zinc-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Aba / Categoria</label>
                  <select
                    value={formDataEpi.categoria}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, categoria: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs bg-zinc-50 font-medium"
                  >
                    <option value="CABECA_AUDITIVO">Cabeça &amp; Auditivo</option>
                    <option value="OCULAR_RESPIRATORIO">Ocular &amp; Facial</option>
                    <option value="LUVAS">Luvas &amp; Manual</option>
                    <option value="CALCADOS">Calçados &amp; Botas</option>
                    <option value="ERGONOMIA_VESTIMENTAS">Ergonomia &amp; Vestimentas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Data de Fabricação</label>
                  <input
                    type="text"
                    value={formDataEpi.data_fabricacao}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, data_fabricacao: e.target.value })}
                    placeholder="Ex: mar/22 ou N/A"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm bg-zinc-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">N° do CA</label>
                  <input
                    type="text"
                    value={formDataEpi.numero_ca}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, numero_ca: e.target.value })}
                    placeholder="Ex: 29706"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm font-mono bg-zinc-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Validade do CA</label>
                  <input
                    type="text"
                    value={formDataEpi.validade_ca}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, validade_ca: e.target.value })}
                    placeholder="Ex: 28/10/2025"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm font-mono bg-zinc-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Validade EPI</label>
                  <input
                    type="text"
                    value={formDataEpi.validade_epi}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, validade_epi: e.target.value })}
                    placeholder="Ex: 5 anos ou N/A"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm bg-zinc-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Estoque Real *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formDataEpi.estoque_real}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, estoque_real: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm font-mono font-bold bg-zinc-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Estoque Mínimo *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formDataEpi.estoque_minimo}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, estoque_minimo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm font-mono bg-zinc-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Unidade</label>
                  <input
                    type="text"
                    value={formDataEpi.unidade}
                    onChange={(e) => setFormDataEpi({ ...formDataEpi, unidade: e.target.value })}
                    placeholder="UN, PAR, KIT..."
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm bg-zinc-50/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEpiAberto(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition cursor-pointer"
                >
                  Salvar na Planilha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL: CADASTRAR NOVO FUNCIONÁRIO NO MÓDULO DE EPIs                                       */}
      {/* ========================================================================================= */}
      {modalFuncionarioAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => { if (e.target === e.currentTarget) setModalFuncionarioAberto(false); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-lg p-6 sm:p-8 space-y-5">
            {/* Header do Modal */}
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  Novo Funcionário
                </div>
                <h2 className="text-xl font-black text-zinc-900">Cadastrar Funcionário</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  O funcionário aparecerá imediatamente na lista de distribuição de EPIs.
                </p>
              </div>
              <button
                onClick={() => setModalFuncionarioAberto(false)}
                className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleCriarFuncionario} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formFuncionario.nome}
                  onChange={(e) => setFormFuncionario({ ...formFuncionario, nome: e.target.value })}
                  placeholder="Ex: JOÃO DA SILVA OLIVEIRA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-zinc-50/50 focus:ring-2 focus:ring-emerald-400 focus:outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    value={formFuncionario.funcao}
                    onChange={(e) => setFormFuncionario({ ...formFuncionario, funcao: e.target.value })}
                    placeholder="Ex: Ajudante de Motorista"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-zinc-50/50 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Setor</label>
                  <input
                    type="text"
                    value={formFuncionario.setor}
                    onChange={(e) => setFormFuncionario({ ...formFuncionario, setor: e.target.value })}
                    placeholder="Ex: Distribuição"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-zinc-50/50 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Local / Filial</label>
                  <input
                    type="text"
                    value={formFuncionario.local}
                    onChange={(e) => setFormFuncionario({ ...formFuncionario, local: e.target.value })}
                    placeholder="Ex: Cascavel"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-zinc-50/50 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Data de Entrada</label>
                  <input
                    type="date"
                    value={formFuncionario.data_entrada}
                    onChange={(e) => setFormFuncionario({ ...formFuncionario, data_entrada: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-zinc-50/50 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalFuncionarioAberto(false)}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoFuncionario || !formFuncionario.nome.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow transition cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {salvandoFuncionario ? 'Cadastrando...' : 'Cadastrar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
