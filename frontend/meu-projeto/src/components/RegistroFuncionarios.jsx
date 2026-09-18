import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  UserPlus, 
  Calendar, 
  ArrowLeft, 
  Search, 
  FileText, 
  Printer, 
  Download,
  Edit3, 
  Trash2, 
  X, 
  CheckCircle2, 
  Check,
  DollarSign, 
  Briefcase, 
  Clock,
  Sparkles,
  AlertCircle,
  Database
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { 
  getRegistrosFuncionariosApi, 
  createRegistroFuncionarioApi, 
  updateRegistroFuncionarioApi, 
  deleteRegistroFuncionarioApi,
  getRelatorioFuncionarioApi,
  getFuncionariosBaseApi
} from '../services/api';
import Logo from './Logo';

const FUNCOES_REGISTRO = [
  'Ajudante de Motorista',
  'Motorista',
  'Pintor',
  'Mecânico',
  'Eletricista',
  'Técnico de Ar',
  'Técnico de Refrigeração',
  'Jardineiro',
  'Pedreiro',
  'Servente',
  'Vigia',
  'Controlador de Pragas',
  'Soldador',
  'Motorista de Carteiro',
];

export default function RegistroFuncionarios({ onBack }) {
  const [funcionarios, setFuncionarios] = useState(() => {
    try {
      localStorage.removeItem('registros_funcionarios_cache'); // higienização de resíduo persistente antigo (DEV-04)
      const salvo = sessionStorage.getItem('registros_funcionarios_cache');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('registros_funcionarios_cache');
      return !salvo;
    } catch {
      return true;
    }
  });
  const [busca, setBusca] = useState('');
  
  // Modal de cadastro / edição
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formNome, setFormNome] = useState('');
  const [formProfissao, setFormProfissao] = useState('Ajudante de Motorista');
  const [formDataEntrada, setFormDataEntrada] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  // Sugestões do banco de dados para autopreenchimento no modal
  const [bancoSugestoes, setBancoSugestoes] = useState([]);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);
  const sugestoesRef = useRef(null);

  // Modal de relatório consolidado e PDF
  const [relatorioModalAberto, setRelatorioModalAberto] = useState(false);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [funcionarioRelatorio, setFuncionarioRelatorio] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState('');

  // Carregar dados principais e catálogo de colaboradores
  useEffect(() => {
    carregarLista();
    carregarCatalogoSugestoes();
  }, []);

  // Fecha o modal de relatório ao pressionar ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setRelatorioModalAberto(false);
      }
    }
    if (relatorioModalAberto) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [relatorioModalAberto]);

  // Fecha o dropdown de sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (sugestoesRef.current && !sugestoesRef.current.contains(event.target)) {
        setSugestoesAbertas(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function carregarLista() {
    setLoading(true);
    try {
      const dados = await getRegistrosFuncionariosApi();
      if (dados && Array.isArray(dados)) {
        setFuncionarios(dados);
        sessionStorage.setItem('registros_funcionarios_cache', JSON.stringify(dados));
      }
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
      const salvo = sessionStorage.getItem('registros_funcionarios_cache');
      if (salvo) {
        try {
          setFuncionarios(JSON.parse(salvo));
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  }

  async function carregarCatalogoSugestoes() {
    try {
      const dados = await getFuncionariosBaseApi();
      if (Array.isArray(dados)) {
        setBancoSugestoes(dados);
      }
    } catch (err) {
      console.warn('Catálogo de sugestões indisponível:', err);
    }
  }

  // Filtragem
  const funcionariosFiltrados = useMemo(() => {
    if (!busca.trim()) return funcionarios;
    const termo = busca.toLowerCase();
    return funcionarios.filter(f => 
      (f.nome || '').toLowerCase().includes(termo) ||
      (f.funcao || f.profissao || '').toLowerCase().includes(termo)
    );
  }, [funcionarios, busca]);

  // Sugestões do banco filtradas pelo nome digitado no formulário
  const sugestoesFiltradas = useMemo(() => {
    if (!formNome.trim()) {
      return bancoSugestoes.slice(0, 6);
    }
    const termo = formNome.toLowerCase().trim();
    return bancoSugestoes.filter(f => 
      (f.nome || '').toLowerCase().includes(termo) ||
      (f.profissao || '').toLowerCase().includes(termo)
    ).slice(0, 8);
  }, [bancoSugestoes, formNome]);

  function handleSelecionarSugestao(func) {
    setFormNome(func.nome || '');
    if (func.profissao) {
      setFormProfissao(func.profissao);
    }
    if (func.data_entrada) {
      setFormDataEntrada(func.data_entrada);
    }
    setColaboradorSelecionado(func);
    setSugestoesAbertas(false);
  }

  // Totais consolidados gerais
  const totaisGerais = useMemo(() => {
    const totalPessoas = funcionarios.length;
    const totalDiarias = funcionarios.reduce((acc, f) => acc + (f.total_diarias || 0), 0);
    const totalValor = funcionarios.reduce((acc, f) => acc + (f.total_valor || 0), 0);
    return { totalPessoas, totalDiarias, totalValor };
  }, [funcionarios]);

  function abrirModalNovo() {
    setEditandoId(null);
    setFormNome('');
    setFormProfissao('Ajudante de Motorista');
    const hoje = new Date().toISOString().split('T')[0];
    setFormDataEntrada(hoje);
    setErroForm('');
    setColaboradorSelecionado(null);
    setSugestoesAbertas(false);
    setModalAberto(true);
    carregarCatalogoSugestoes();
  }

  function abrirModalEditar(func) {
    setEditandoId(func.id);
    setFormNome(func.nome || '');
    setFormProfissao(func.funcao || func.profissao || 'Ajudante de Motorista');
    setFormDataEntrada(func.data_entrada || '');
    setErroForm('');
    setColaboradorSelecionado(null);
    setSugestoesAbertas(false);
    setModalAberto(true);
  }

  async function handleSalvar(e) {
    e.preventDefault();
    if (!formNome.trim()) {
      setErroForm('Por favor, informe o nome completo do funcionário.');
      return;
    }
    setSalvando(true);
    setErroForm('');

    try {
      const payload = {
        nome: formNome.trim(),
        funcao: formProfissao.trim(),
        profissao: formProfissao.trim(),
        data_entrada: formDataEntrada
      };

      if (editandoId) {
        await updateRegistroFuncionarioApi(editandoId, payload);
      } else {
        await createRegistroFuncionarioApi(payload);
      }
      setModalAberto(false);
      await carregarLista();
    } catch (err) {
      setErroForm(err.message || 'Erro ao salvar funcionário.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id, nome) {
    if (!window.confirm(`Tem certeza que deseja remover o registro do funcionário ${nome}?`)) {
      return;
    }
    try {
      await deleteRegistroFuncionarioApi(id);
      setFuncionarios(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      alert('Erro ao excluir funcionário: ' + err.message);
    }
  }

  async function abrirRelatorioCompleto(func) {
    setRelatorioModalAberto(true);
    setCarregandoRelatorio(true);
    setFuncionarioRelatorio(null);
    setSucessoMsg('');
    try {
      const dados = await getRelatorioFuncionarioApi(func.id);
      setFuncionarioRelatorio(dados);
    } catch (err) {
      console.error('Erro ao buscar relatório:', err);
      setFuncionarioRelatorio({
        id: func.id,
        nome: func.nome,
        profissao: func.profissao,
        data_entrada: func.data_entrada,
        total_diarias: func.total_diarias,
        total_valor: func.total_valor,
        diarias: []
      });
    } finally {
      setCarregandoRelatorio(false);
    }
  }

  // Paginação inteligente em Laudas A4 para visualização e PDF
  const laudasFuncionario = useMemo(() => {
    if (!funcionarioRelatorio) return [];
    const lista = funcionarioRelatorio.diarias || [];
    const totalItens = lista.length;

    // Se tiver até 10 diárias, cabe com folga em 1 lauda completa
    if (totalItens <= 10) {
      return [{
        numero: 1,
        diarias: lista,
        isPrimeira: true,
        isUltima: true,
        indexInicial: 0
      }];
    }

    const resultado = [];
    const ITENS_P1 = 9;
    const ITENS_OUTRAS = 14;

    resultado.push({
      numero: 1,
      diarias: lista.slice(0, ITENS_P1),
      isPrimeira: true,
      isUltima: false,
      indexInicial: 0
    });

    let cursor = ITENS_P1;
    let numLauda = 2;

    while (cursor < totalItens) {
      const restante = totalItens - cursor;
      const qtdParaPegar = Math.min(ITENS_OUTRAS, restante);
      const isUltima = (cursor + qtdParaPegar) >= totalItens;

      resultado.push({
        numero: numLauda,
        diarias: lista.slice(cursor, cursor + qtdParaPegar),
        isPrimeira: false,
        isUltima,
        indexInicial: cursor
      });

      cursor += qtdParaPegar;
      numLauda++;
    }

    return resultado;
  }, [funcionarioRelatorio]);

  // Download oficial em PDF com alta resolução A4
  async function handleBaixarPdf() {
    const laudaEls = document.querySelectorAll('.lauda-funcionario-pdf');
    if (!laudaEls || laudaEls.length === 0) return;

    setGerandoPdf(true);
    setSucessoMsg('');

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 250));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < laudaEls.length; i++) {
        if (i > 0) pdf.addPage();
        const imgData = await toJpeg(laudaEls[i], {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const nomeLimpo = (funcionarioRelatorio.nome || 'Funcionario').replace(/\s+/g, '_');
      const nomeArquivo = `Relatorio_Oficial_${nomeLimpo}_Irmaos_Barreiro.pdf`;

      pdf.save(nomeArquivo);
      setSucessoMsg(`PDF oficial baixado com sucesso! (${laudaEls.length} lauda${laudaEls.length > 1 ? 's' : ''})`);
      setTimeout(() => setSucessoMsg(''), 4000);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Houve um erro ao gerar o arquivo PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  }

  function handleImprimir() {
    window.print();
  }

  function formatarDataBR(dataStr) {
    if (!dataStr) return 'Não informada';
    if (dataStr.includes('-')) {
      const partes = dataStr.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }
    return dataStr;
  }

  function formatarMoeda(val) {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* 1. BARRA SUPERIOR E CONTROLES (NO-PRINT) */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 hover:text-red-600 bg-zinc-100 hover:bg-red-50 border border-zinc-200 hover:border-red-200 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Menu</span>
            </button>
            <span className="text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
              Módulo 5
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5 pt-1">
            <Users className="w-7 h-7 text-red-600" />
            Registro de Funcionários
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Acompanhe data de entrada, diárias realizadas e o relatório oficial de valores da Distribuidora.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={abrirModalNovo}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 hover:shadow-xl transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE KPI / TOTALIZADORES (NO-PRINT) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 no-print">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-zinc-200/80 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Funcionários Registrados
            </span>
            <span className="text-2xl font-black text-zinc-900">
              {totaisGerais.totalPessoas}
            </span>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-zinc-200/80 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Total de Diárias Feitas
            </span>
            <span className="text-2xl font-black text-zinc-900">
              {totaisGerais.totalDiarias} <span className="text-xs font-semibold text-zinc-500">diárias</span>
            </span>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-zinc-200/80 shadow-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Total Pago até Agora
            </span>
            <span className="text-2xl font-black text-emerald-600">
              {formatarMoeda(totaisGerais.totalValor)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE BUSCA (NO-PRINT) */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-zinc-200/80 shadow-md flex items-center gap-3 no-print">
        <Search className="w-5 h-5 text-zinc-400 shrink-0 ml-2" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar funcionário por nome ou função..."
          className="w-full text-xs sm:text-sm font-semibold text-zinc-800 placeholder-zinc-400 bg-transparent outline-none"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* 4. TABELA DE FUNCIONÁRIOS (NO-PRINT) */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 overflow-hidden no-print">
        {loading ? (
          <div className="py-20 text-center text-zinc-400 text-xs font-bold uppercase tracking-wider animate-pulse">
            Carregando registros de funcionários...
          </div>
        ) : funcionariosFiltrados.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Users className="w-12 h-12 text-zinc-300 mx-auto" />
            <p className="text-sm font-bold text-zinc-500">Nenhum funcionário encontrado.</p>
            <button
              onClick={abrirModalNovo}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar o primeiro funcionário</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100/80 border-b border-zinc-200 text-[11px] font-black uppercase tracking-wider text-zinc-600">
                  <th className="py-4 px-6">Funcionário</th>
                  <th className="py-4 px-4">Função</th>
                  <th className="py-4 px-4 text-center">Começo dos Pagamentos</th>
                  <th className="py-4 px-4 text-center">Total de Diárias</th>
                  <th className="py-4 px-4 text-right">Total Ganho até Agora</th>
                  <th className="py-4 px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 font-medium text-zinc-800">
                {funcionariosFiltrados.map((func) => (
                  <tr key={func.id} className="hover:bg-red-50/30 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-zinc-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs uppercase">
                          {func.nome.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-extrabold text-zinc-900 text-sm block">
                            {func.nome}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold text-[11px] border border-zinc-200">
                        <Briefcase className="w-3 h-3 text-zinc-500" />
                        {func.funcao || func.profissao || 'Não especificada'}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        {formatarDataBR(func.data_entrada)}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="font-black text-zinc-900 text-sm">
                        {func.total_diarias || 0}
                      </span>
                      <span className="text-[11px] text-zinc-400 block font-normal">
                        diárias feitas
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <span className="font-black text-emerald-600 text-sm">
                        {formatarMoeda(func.total_valor)}
                      </span>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">
                        acumulado
                      </span>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirRelatorioCompleto(func)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-xs transition cursor-pointer active:scale-95"
                          title="Puxar relatório completo com layout oficial dos PDFs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver Relatório</span>
                        </button>

                        <button
                          onClick={() => abrirModalEditar(func)}
                          className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
                          title="Editar dados"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleExcluir(func.id, func.nome)}
                          className="p-1.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Remover registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 5. MODAL DE CADASTRO / EDIÇÃO DE FUNCIONÁRIO (NO-PRINT)            */}
      {/* ================================================================= */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-lg overflow-hidden animate-scaleUp">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-white" />
                <h3 className="text-base font-black tracking-tight">
                  {editandoId ? 'Editar Funcionário' : 'Novo Registro de Funcionário'}
                </h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 space-y-4">
              {erroForm && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                  {erroForm}
                </div>
              )}

              {/* Card informativo quando os dados forem preenchidos automaticamente pelo banco */}
              {colaboradorSelecionado && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide block">
                        Preenchido pelo Banco de Dados:
                      </span>
                      <p className="text-xs font-black text-emerald-950 truncate">
                        {colaboradorSelecionado.nome} — <span className="font-semibold text-emerald-700">{colaboradorSelecionado.profissao || formProfissao}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setColaboradorSelecionado(null)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100 transition cursor-pointer shrink-0"
                  >
                    Desvincular
                  </button>
                </div>
              )}

              {/* Campo Nome Completo com busca e autocomplete inteligente */}
              <div className="space-y-1.5 relative" ref={sugestoesRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Nome Completo *
                  </label>
                  {bancoSugestoes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSugestoesAbertas(prev => !prev)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>{sugestoesAbertas ? 'Fechar sugestões' : `Buscar no Banco (${bancoSugestoes.length})`}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => {
                      setFormNome(e.target.value);
                      setSugestoesAbertas(true);
                      if (colaboradorSelecionado && e.target.value !== colaboradorSelecionado.nome) {
                        setColaboradorSelecionado(null);
                      }
                    }}
                    onFocus={() => {
                      if (bancoSugestoes.length > 0) {
                        setSugestoesAbertas(true);
                      }
                    }}
                    placeholder="Ex: JOÃO DA SILVA SANTOS"
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-zinc-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-xs sm:text-sm font-semibold text-zinc-900 uppercase"
                  />
                  {bancoSugestoes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSugestoesAbertas(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-600 transition cursor-pointer"
                      title="Abrir sugestões do banco de dados"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown com os nomes e funções encontrados no banco de dados */}
                {sugestoesAbertas && bancoSugestoes.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden max-h-64 overflow-y-auto animate-fadeIn">
                    <div className="px-3.5 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                      <span>Colaboradores no Banco ({sugestoesFiltradas.length})</span>
                      <span>Clique para preencher nome e função</span>
                    </div>

                    {sugestoesFiltradas.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-500">
                        Nenhum colaborador encontrado com &quot;<b>{formNome}</b>&quot;.
                        <p className="mt-0.5 text-[11px] text-zinc-400">Você pode continuar digitando para cadastrar um novo.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-100">
                        {sugestoesFiltradas.map((colab) => (
                          <button
                            key={colab.id || colab.nome}
                            type="button"
                            onClick={() => handleSelecionarSugestao(colab)}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-red-50/80 transition flex items-center justify-between gap-3 group cursor-pointer"
                          >
                            <div className="min-w-0">
                              <span className="font-extrabold text-xs sm:text-sm text-zinc-900 group-hover:text-red-700 block truncate">
                                {colab.nome}
                              </span>
                              {colab.profissao && (
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-zinc-100 group-hover:bg-red-100 text-zinc-700 group-hover:text-red-800 text-[10px] font-bold">
                                  {colab.profissao}
                                </span>
                              )}
                            </div>

                            <div className="shrink-0 px-2.5 py-1 rounded-lg bg-red-100 text-red-700 group-hover:bg-red-600 group-hover:text-white text-[10px] font-black transition flex items-center gap-1 shadow-xs">
                              <span>Preencher</span>
                              <Sparkles className="w-3 h-3" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Função *
                </label>
                <select
                  value={formProfissao}
                  onChange={(e) => setFormProfissao(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-xs sm:text-sm font-semibold text-zinc-900 bg-white cursor-pointer"
                >
                  <option value="">— Selecione a função —</option>
                  {FUNCOES_REGISTRO.map((cargo) => (
                    <option key={cargo} value={cargo}>{cargo}</option>
                  ))}
                  <option value="Outra Função">Outra Função (digitar)</option>
                </select>

                {(!FUNCOES_REGISTRO.includes(formProfissao) || formProfissao === 'Outra Função') && (
                  <input
                    type="text"
                    value={formProfissao === 'Outra Função' ? '' : formProfissao}
                    onChange={(e) => setFormProfissao(e.target.value)}
                    placeholder="Digite a função..."
                    autoFocus
                    className="w-full mt-2 px-4 py-2 rounded-xl border border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-xs font-semibold text-zinc-900 bg-red-50/30"
                  />
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {FUNCOES_REGISTRO.slice(0, 6).map(cargo => (
                    <button
                      key={cargo}
                      type="button"
                      onClick={() => setFormProfissao(cargo)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        formProfissao === cargo
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {cargo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Começo dos Pagamentos *
                </label>
                <input
                  type="date"
                  required
                  value={formDataEntrada}
                  onChange={(e) => setFormDataEntrada(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-xs sm:text-sm font-semibold text-zinc-900"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : editandoId ? 'Atualizar Dados' : 'Cadastrar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 6. MODAL COM O LAYOUT OFICIAL IDÊNTICO AOS OUTROS PDFS (SOLAR/RH)   */}
      {/* ================================================================= */}
      {relatorioModalAberto && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn no-print overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRelatorioModalAberto(false);
          }}
        >
          <div className="bg-white w-full max-w-5xl rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-700/50 overflow-hidden flex flex-col h-[94vh] max-h-[94vh] relative">
            
            {/* Topo do Modal (Controles Fixos) */}
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 text-white p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wider text-red-300">
                    <Sparkles className="w-3 h-3 text-red-400" />
                    <span>Emissão Oficial em PDF • {laudasFuncionario.length} lauda(s)</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase truncate">
                    {funcionarioRelatorio ? funcionarioRelatorio.nome : 'Carregando funcionário...'}
                  </h2>
                </div>
              </div>

              {/* Botões do Topo */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  onClick={handleBaixarPdf}
                  disabled={gerandoPdf || !funcionarioRelatorio}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50"
                  title="Baixar arquivo PDF com o layout oficial colorido"
                >
                  <Download className={`w-4 h-4 ${gerandoPdf ? 'animate-bounce' : ''}`} />
                  <span>{gerandoPdf ? 'GERANDO PDF...' : 'BAIXAR PDF'}</span>
                </button>

                <button
                  onClick={handleImprimir}
                  disabled={!funcionarioRelatorio}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                  title="Imprimir"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>

                {/* Botão de Fechar Bem Visível */}
                <button
                  onClick={() => setRelatorioModalAberto(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                  title="Fechar visualização (ou pressione ESC)"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                  <span>FECHAR</span>
                </button>
              </div>
            </div>

            {/* Aviso de Sucesso ou Processamento */}
            {gerandoPdf && (
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 text-xs font-black flex items-center justify-between shadow-inner animate-pulse shrink-0">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
                  <span>Gerando arquivo oficial A4 em alta resolução com o layout da Distribuidora...</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                  Processando
                </span>
              </div>
            )}

            {sucessoMsg && (
              <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between shrink-0">
                <span>{sucessoMsg}</span>
              </div>
            )}

            {/* Container Central com as Laudas Oficiais A4 em Fundo Cinza */}
            <div className="overflow-y-auto overflow-x-auto p-4 sm:p-8 bg-zinc-300/80 flex-1 flex flex-col items-center gap-8">
              {carregandoRelatorio || !funcionarioRelatorio ? (
                <div className="py-24 text-center text-zinc-600 text-xs font-bold uppercase tracking-wider animate-pulse">
                  Gerando laudas no padrão oficial...
                </div>
              ) : (
                laudasFuncionario.map((lauda) => (
                  <div
                    key={`lauda-funcionario-${lauda.numero}`}
                    className="lauda-funcionario-pdf w-[800px] min-h-[1130px] bg-white text-zinc-950 p-10 rounded-xl shadow-2xl border border-zinc-300 flex flex-col justify-between shrink-0 relative"
                    style={{
                      boxSizing: 'border-box',
                    }}
                  >
                    <div>
                      {/* 1. CABEÇALHO DA LAUDA */}
                      {lauda.isPrimeira ? (
                        <div className="border-b-4 border-red-600 pb-4 mb-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <Logo className="h-12 w-auto" />
                              <div className="border-l-2 border-zinc-200 pl-3">
                                <h1 className="text-base font-black tracking-tight text-zinc-900 leading-tight uppercase">
                                  Distribuidora Irmãos Barreiro
                                </h1>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                  De Bebidas Ltda. • CNPJ: 01.688.096/0001-95 • Cascavel/CE
                                </p>
                              </div>
                            </div>

                            <div className="text-right text-[10px] text-zinc-500">
                              <p className="font-semibold">
                                Emissão: <strong className="text-zinc-800">{new Date().toLocaleDateString('pt-BR')}</strong> às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-red-600 font-black uppercase text-[11px]">
                                Documento Oficial do Colaborador
                              </p>
                            </div>
                          </div>

                          {/* Banner do Título Oficial */}
                          <div className="mt-3 pt-3 border-t border-zinc-100 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white rounded-xl p-3.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-200 block">
                                  Ficha Histórica Individual
                                </span>
                                <h2 className="text-lg font-black uppercase tracking-tight text-white leading-tight">
                                  RELATÓRIO HISTÓRICO — {funcionarioRelatorio.nome}
                                </h2>
                              </div>
                              <div className="bg-black/30 px-3 py-1 rounded-lg border border-white/20 text-right">
                                <span className="text-[8px] uppercase font-bold text-red-100 block">Função:</span>
                                <span className="text-[11px] font-black text-white">{funcionarioRelatorio.funcao || funcionarioRelatorio.profissao || 'Ajudante Geral'}</span>
                              </div>
                            </div>
                          </div>

                          {/* CARDS ESTATÍSTICOS COM O PADRÃO OFICIAL DOS OUTROS PDFS */}
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            {/* Card 1: Data de Entrada */}
                            <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-2.5 text-center">
                              <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 block">
                                Começo dos Pagamentos
                              </span>
                              <span className="text-base font-black text-blue-950">
                                {formatarDataBR(funcionarioRelatorio.data_entrada)}
                              </span>
                            </div>

                            {/* Card 2: Total de Diárias Feitas */}
                            <div className="bg-red-50/90 border border-red-200 rounded-xl p-2.5 text-center">
                              <span className="text-[9px] font-black uppercase tracking-wider text-red-700 block">
                                Total de Diárias Realizadas
                              </span>
                              <span className="text-base font-black text-red-700">
                                {funcionarioRelatorio.total_diarias || 0} {funcionarioRelatorio.total_diarias === 1 ? 'DIÁRIA' : 'DIÁRIAS'}
                              </span>
                            </div>

                            {/* Card 3: Total Dinheiro Ganho */}
                            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5 text-center">
                              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">
                                Total Conseguido até Agora
                              </span>
                              <span className="text-base font-black text-emerald-700">
                                {formatarMoeda(funcionarioRelatorio.total_valor)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Cabeçalho de Continuação para laudas 2, 3...
                        <div className="border-b-2 border-red-600 pb-2.5 mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Logo className="h-8 w-auto" />
                            <div className="border-l border-zinc-300 pl-2.5">
                              <span className="text-xs font-black uppercase tracking-tight text-zinc-900 block">
                                Distribuidora Irmãos Barreiro
                              </span>
                              <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider">
                                Relatório Histórico — {funcionarioRelatorio.nome} (Continuação)
                              </span>
                            </div>
                          </div>

                          <div className="text-right text-[9px] text-zinc-500">
                            <p>Começo dos Pagamentos: <strong className="text-zinc-800">{formatarDataBR(funcionarioRelatorio.data_entrada)}</strong></p>
                            <p className="font-bold text-red-700">Lauda {lauda.numero} de {laudasFuncionario.length}</p>
                          </div>
                        </div>
                      )}

                      {/* 2. TABELA DE DIÁRIAS NO PADRÃO OFICIAL DOS OUTROS PDFS (SEM COLUNA DE STATUS) */}
                      <div className="overflow-hidden border border-zinc-300 rounded-lg">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-gradient-to-r from-red-700 to-red-800 text-white font-black uppercase text-[10px] tracking-wider">
                              <th className="py-2.5 px-3 border border-red-900 w-12 text-center">#</th>
                              <th className="py-2.5 px-4 border border-red-900 w-28">Data</th>
                              <th className="py-2.5 px-4 border border-red-900">Função</th>
                              <th className="py-2.5 px-3 border border-red-900 text-center w-24">Qtd. Diárias</th>
                              <th className="py-2.5 px-3 border border-red-900 text-right w-28">Valor Diária</th>
                              <th className="py-2.5 px-3 border border-red-900 text-right w-32">Valor Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lauda.diarias.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="py-12 text-center text-zinc-500 border border-zinc-200 bg-zinc-50/50">
                                  <AlertCircle className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                                  <p className="font-bold text-xs text-zinc-700">
                                    Nenhum lançamento de diária registrado para este funcionário.
                                  </p>
                                </td>
                              </tr>
                            ) : (
                              lauda.diarias.map((d, idx) => {
                                const indexGlobal = (lauda.indexInicial || 0) + idx + 1;
                                return (
                                  <tr 
                                    key={d.id || idx}
                                    className={`border-b border-zinc-200 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}`}
                                  >
                                    <td className="py-2 px-3 border-r border-zinc-200 text-center font-bold text-zinc-400">
                                      {indexGlobal}
                                    </td>
                                    <td className="py-2 px-4 border-r border-zinc-200 font-bold text-zinc-900">
                                      {formatarDataBR(d.data)}
                                    </td>
                                    <td className="py-2 px-4 border-r border-zinc-200 font-medium text-zinc-700">
                                      {d.profissao || funcionarioRelatorio.profissao || '-'}
                                    </td>
                                    <td className="py-2 px-3 border-r border-zinc-200 text-center font-extrabold text-zinc-900">
                                      {d.quantidade_diarias}
                                    </td>
                                    <td className="py-2 px-3 border-r border-zinc-200 text-right text-zinc-600 font-medium">
                                      {formatarMoeda(d.valor_diaria)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-black text-emerald-700">
                                      {formatarMoeda(d.valor_total)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 3. RODAPÉ DA LAUDA (ASSINATURAS E AUTENTICAÇÃO) */}
                    <div>
                      {lauda.isUltima && (
                        <div className="pt-8 border-t border-zinc-300 grid grid-cols-2 gap-10 text-center text-xs">
                          <div>
                            <div className="border-b border-zinc-400 h-10 mx-6"></div>
                            <span className="font-extrabold text-zinc-900 block mt-1.5 uppercase text-[11px]">
                              Distribuidora Irmãos Barreiro
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              Administração / Recursos Humanos
                            </span>
                          </div>
                          <div>
                            <div className="border-b border-zinc-400 h-10 mx-6"></div>
                            <span className="font-extrabold text-zinc-900 block mt-1.5 uppercase text-[11px]">
                              {funcionarioRelatorio.nome}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              Assinatura do Colaborador
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 pt-3 border-t border-zinc-200 flex items-center justify-between text-[9px] text-zinc-400 font-semibold">
                        <span>Distribuidora Irmãos Barreiro • Sistema Oficial de Gestão</span>
                        <span>Lauda {lauda.numero} de {laudasFuncionario.length}</span>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ================================================================= */}
      {/* 7. FOLHA EXCLUSIVA PARA IMPRESSÃO EM PAPEL COM O MESMO DESIGN     */}
      {/* ================================================================= */}
      {funcionarioRelatorio && (
        <div className="hidden print:block font-sans text-zinc-950 p-0 m-0">
          {laudasFuncionario.map((lauda) => (
            <div
              key={`print-lauda-${lauda.numero}`}
              className="w-full bg-white text-zinc-950 p-6 flex flex-col justify-between relative"
              style={{
                pageBreakAfter: lauda.isUltima ? 'auto' : 'always',
                breakAfter: lauda.isUltima ? 'auto' : 'page',
                minHeight: '270mm'
              }}
            >
              <div>
                {lauda.isPrimeira ? (
                  <div className="border-b-4 border-red-600 pb-3 mb-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Logo className="h-10 w-auto" />
                        <div className="border-l-2 border-zinc-200 pl-3">
                          <h1 className="text-sm font-black tracking-tight text-zinc-900 leading-tight uppercase">
                            Distribuidora Irmãos Barreiro
                          </h1>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                            De Bebidas Ltda. • CNPJ: 01.688.096/0001-95 • Cascavel/CE
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[9px] text-zinc-500">
                        <p className="font-semibold">
                          Emissão: <strong className="text-zinc-800">{new Date().toLocaleDateString('pt-BR')}</strong>
                        </p>
                        <p className="text-red-600 font-black uppercase text-[10px]">
                          Documento Oficial do Colaborador
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-zinc-100 bg-red-700 text-white rounded-lg p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-red-200 block">
                            Ficha Histórica Individual
                          </span>
                          <h2 className="text-base font-black uppercase tracking-tight text-white leading-tight">
                            RELATÓRIO HISTÓRICO — {funcionarioRelatorio.nome}
                          </h2>
                        </div>
                        <div className="bg-black/30 px-2.5 py-1 rounded border border-white/20 text-right">
                          <span className="text-[8px] uppercase font-bold text-red-100 block">Função:</span>
                          <span className="text-[10px] font-black text-white">{funcionarioRelatorio.profissao || 'Ajudante Geral'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                        <span className="text-[8px] font-black uppercase tracking-wider text-blue-700 block">
                          Começo dos Pagamentos
                        </span>
                        <span className="text-sm font-black text-blue-950">
                          {formatarDataBR(funcionarioRelatorio.data_entrada)}
                        </span>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                        <span className="text-[8px] font-black uppercase tracking-wider text-red-700 block">
                          Total de Diárias Realizadas
                        </span>
                        <span className="text-sm font-black text-red-700">
                          {funcionarioRelatorio.total_diarias || 0} DIÁRIAS
                        </span>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                        <span className="text-[8px] font-black uppercase tracking-wider text-emerald-800 block">
                          Total Dinheiro Ganho
                        </span>
                        <span className="text-sm font-black text-emerald-700">
                          {formatarMoeda(funcionarioRelatorio.total_valor)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-b-2 border-red-600 pb-2 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Logo className="h-7 w-auto" />
                      <span className="text-[10px] font-black uppercase tracking-tight text-zinc-900">
                        Distribuidora Irmãos Barreiro • Relatório Histórico — {funcionarioRelatorio.nome}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-red-700">Lauda {lauda.numero} de {laudasFuncionario.length}</span>
                  </div>
                )}

                <div className="overflow-hidden border border-zinc-300 rounded">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-red-800 text-white font-black uppercase text-[9px] tracking-wider">
                        <th className="py-1.5 px-2 border border-red-900 text-center w-8">#</th>
                        <th className="py-1.5 px-3 border border-red-900 w-24">Data</th>
                        <th className="py-1.5 px-3 border border-red-900">Função</th>
                        <th className="py-1.5 px-2 border border-red-900 text-center w-20">Qtd. Diárias</th>
                        <th className="py-1.5 px-2 border border-red-900 text-right w-24">Valor Diária</th>
                        <th className="py-1.5 px-2 border border-red-900 text-right w-24">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lauda.diarias.map((d, idx) => {
                        const indexGlobal = (lauda.indexInicial || 0) + idx + 1;
                        return (
                          <tr key={d.id || idx} className={`border-b border-zinc-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}`}>
                            <td className="py-1.5 px-2 border-r border-zinc-200 text-center font-bold text-zinc-400">{indexGlobal}</td>
                            <td className="py-1.5 px-3 border-r border-zinc-200 font-bold text-zinc-900">{formatarDataBR(d.data)}</td>
                            <td className="py-1.5 px-3 border-r border-zinc-200">{d.profissao || funcionarioRelatorio.profissao || '-'}</td>
                            <td className="py-1.5 px-2 border-r border-zinc-200 text-center font-bold">{d.quantidade_diarias}</td>
                            <td className="py-1.5 px-2 border-r border-zinc-200 text-right">{formatarMoeda(d.valor_diaria)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-emerald-800">{formatarMoeda(d.valor_total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>

              <div>
                {lauda.isUltima && (
                  <div className="pt-6 border-t border-zinc-300 grid grid-cols-2 gap-8 text-center text-[10px] mt-6">
                    <div>
                      <div className="border-b border-zinc-400 h-8 mx-6"></div>
                      <span className="font-bold text-zinc-900 block mt-1 uppercase">Distribuidora Irmãos Barreiro</span>
                      <span className="text-[8px] text-zinc-500 block">Administração / RH</span>
                    </div>
                    <div>
                      <div className="border-b border-zinc-400 h-8 mx-6"></div>
                      <span className="font-bold text-zinc-900 block mt-1 uppercase">{funcionarioRelatorio.nome}</span>
                      <span className="text-[8px] text-zinc-500 block">Assinatura do Colaborador</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-zinc-200 flex items-center justify-between text-[8px] text-zinc-400">
                  <span>Distribuidora Irmãos Barreiro • Documento Oficial</span>
                  <span>Lauda {lauda.numero} de {laudasFuncionario.length}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
