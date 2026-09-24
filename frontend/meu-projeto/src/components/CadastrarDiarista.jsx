import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getDiaristasApi } from '../services/api';
import { 
  UserPlus, 
  ArrowLeft, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  User, 
  Briefcase, 
  AlertCircle, 
  Search, 
  Database, 
  Sparkles, 
  X, 
  Check, 
  UserCheck,
  Building2
} from 'lucide-react';

// Banco de dados padrão de colaboradores e diaristas da Distribuidora Irmãos Barreiro
export const BANCO_FUNCIONARIOS_PADRAO = [];

const PROFISSOES_PADRAO = [
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
  'Outra Função'
];

export default function CadastrarDiarista({ onBack, onSave, dataInicial, diaristasExistentes = [] }) {
  const [formData, setFormData] = useState({
    tipoPessoa: 'fisica', // 'fisica' | 'juridica'
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    nome: '',
    valorDiaria: '0.00',
    quantidadeDiarias: '1',
    tipoPix: 'cpf',
    chavePix: '',
    profissao: '',
    data: dataInicial || new Date().toISOString().split('T')[0],
    observacoes: '',
    pago: false,
  });

  const [outraFuncao, setOutraFuncao] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  // Estados da Busca no Banco de Dados Backend
  const [termoBusca, setTermoBusca] = useState('');
  const [funcionariosDb, setFuncionariosDb] = useState([]);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
  const [mostrarTodosModal, setMostrarTodosModal] = useState(false);
  const searchBoxRef = useRef(null);

  // Carrega catálogo base do backend PostgreSQL
  useEffect(() => {
    async function carregarCatalogo() {
      try {
        const dados = await getDiaristasApi();
        if (dados && Array.isArray(dados)) {
          const porNome = new Map();
          dados.forEach((diarista) => {
            const chave = diarista.nome?.trim().toLowerCase();
            if (chave && !porNome.has(chave)) {
              porNome.set(chave, {
                id: diarista.id,
                nome: diarista.nome,
                profissao: diarista.profissao,
                tipoPix: diarista.tipo_pix || 'cpf',
                chavePix: diarista.chave_pix || '',
              });
            }
          });
          setFuncionariosDb([...porNome.values()]);
        }
      } catch (err) {
        console.warn("Backend operando offline...", err);
      }
    }
    carregarCatalogo();
  }, []);

  // Catálogo de funcionários cadastrados no banco de dados backend
  const bancoCompleto = useMemo(() => {
    return (funcionariosDb || [])
      .filter((f) => f && f.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcionariosDb]);

  // Lista filtrada pelo termo de busca
  const funcionariosFiltrados = useMemo(() => {
    if (!termoBusca.trim()) {
      return bancoCompleto.slice(0, 8); // Top 8 sugestões iniciais
    }
    const termo = termoBusca.toLowerCase().trim();
    return bancoCompleto.filter((f) =>
      f.nome.toLowerCase().includes(termo) ||
      (f.chavePix && f.chavePix.toLowerCase().includes(termo)) ||
      (f.profissao && f.profissao.toLowerCase().includes(termo))
    );
  }, [bancoCompleto, termoBusca]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preenche apenas NOME, PROFISSÃO e CHAVE PIX (o valor da diária permanece o que o usuário definir)
  function handleSelecionarFuncionario(func) {
    if (!func) return;

    const isProfissaoConhecida = PROFISSOES_PADRAO.includes(func.profissao);
    const profValor = isProfissaoConhecida ? func.profissao : (func.profissao ? 'Outra Função' : '');

    setFormData((prev) => ({
      ...prev,
      nome: func.nome.toUpperCase().trim(),
      chavePix: func.chavePix || '',
      tipoPix: func.tipoPix || 'cpf',
      profissao: profValor,
      // Não altera o valor da diária para não sobrescrever o valor do dia
    }));

    if (!isProfissaoConhecida && func.profissao) {
      setOutraFuncao(func.profissao);
    } else {
      setOutraFuncao('');
    }

    setFuncionarioSelecionado(func);
    setTermoBusca('');
    setDropdownAberto(false);
    setMostrarTodosModal(false);
    setErro('');
  }

  function handleLimparSelecao() {
    setFuncionarioSelecionado(null);
    setFormData((prev) => ({
      ...prev,
      nome: '',
      chavePix: '',
      tipoPix: 'cpf',
      profissao: '',
    }));
    setOutraFuncao('');
  }

  function formatCNPJMask(val) {
    const v = val.replace(/\D/g, '').slice(0, 14);
    if (v.length <= 2) return v;
    if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
    if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
    if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    let formatted = value;
    if (name === 'cnpj' || (name === 'chavePix' && formData.tipoPix === 'cnpj')) {
      formatted = formatCNPJMask(value);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : formatted,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (formData.tipoPessoa === 'juridica') {
      if (!formData.razaoSocial.trim()) {
        setErro('Por favor, informe a Razão Social da empresa.');
        return;
      }
    } else {
      if (!formData.nome.trim()) {
        setErro('Por favor, informe o nome do diarista.');
        return;
      }
    }

    if (!formData.chavePix.trim()) {
      setErro('Por favor, informe a chave PIX.');
      return;
    }

    const profissaoFinal = formData.profissao === 'Outra Função' ? outraFuncao.trim() : formData.profissao.trim();
    const nomeFinal = formData.tipoPessoa === 'juridica'
      ? (formData.razaoSocial || formData.nomeFantasia || 'EMPRESA').toUpperCase().trim()
      : formData.nome.toUpperCase().trim();

    // Cria um registro com identificador único independente (não sobrescreve outros dias)
    const novoDiarista = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      tipoPessoa: formData.tipoPessoa,
      razaoSocial: formData.razaoSocial.trim(),
      nomeFantasia: formData.nomeFantasia.trim(),
      cnpj: formData.cnpj.trim(),
      nome: nomeFinal,
      valor: parseFloat(formData.valorDiaria) || 0.0,
      diarias: parseInt(formData.quantidadeDiarias, 10) || 1,
      pix: formData.chavePix.trim(),
      tipoPix: formData.tipoPix,
      motorista: profissaoFinal,
      profissao: profissaoFinal,
      data: formData.data,
      observacoes: formData.observacoes.trim(),
      pago: formData.pago,
      createdAt: new Date().toISOString(),
    };

    if (onSave) {
      onSave(novoDiarista);
    }

    setSucesso(true);
    setTimeout(() => {
      if (onBack) onBack();
    }, 1200);
  }

  const totalCalculado = (parseFloat(formData.valorDiaria) || 0) * (parseInt(formData.quantidadeDiarias, 10) || 1);

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-zinc-200/80 overflow-hidden">
      {/* Topo do Formulário */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-zinc-900 text-white p-6 sm:p-8 relative">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition cursor-pointer backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Relação</span>
          </button>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
            <span>Distribuidora Irmãos Barreiro</span>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Cadastrar Novo Diarista
            </h2>
            <p className="text-sm text-red-100 mt-1 max-w-xl">
              Busque um funcionário no banco de dados para preenchimento de dados cadastrais ou preencha manualmente.
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo / Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
        {erro && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
        )}

        {sucesso && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>Diarista cadastrado com sucesso! Redirecionando...</span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* BLOCO ESPECIAL: BUSCAR FUNCIONÁRIO NO BANCO DE DADOS               */}
        {/* ==================================================================== */}
        <div className="bg-gradient-to-br from-red-50/80 via-white to-zinc-50 p-5 sm:p-6 rounded-2xl border-2 border-red-500/30 shadow-sm relative space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                  Buscar Funcionário no Banco de Dados
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                    Auto-preenchimento
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Preenche automaticamente: <b>Nome</b>, <b>Função</b> e <b>Chave PIX</b>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMostrarTodosModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-red-300 hover:text-red-600 text-zinc-700 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-red-600" />
              <span>Ver todos ({bancoCompleto.length})</span>
            </button>
          </div>

          {/* Campo de Busca Inteligente com Autocomplete */}
          <div ref={searchBoxRef} className="relative">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => {
                  setTermoBusca(e.target.value);
                  setDropdownAberto(true);
                }}
                onFocus={() => setDropdownAberto(true)}
                placeholder="Buscar colaborador no banco de dados por nome, PIX ou função..."
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-medium text-zinc-900 bg-white shadow-inner"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => {
                    setTermoBusca('');
                    setDropdownAberto(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown com resultados da busca */}
            {dropdownAberto && (
              <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-fadeIn">
                <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <span>Funcionários encontrados ({funcionariosFiltrados.length})</span>
                  <span>Clique para preencher</span>
                </div>

                {funcionariosFiltrados.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-xs">
                    {termoBusca.trim() ? (
                      <>Nenhum colaborador encontrado com &quot;<b>{termoBusca}</b>&quot;.</>
                    ) : (
                      <>Nenhum colaborador cadastrado no banco de dados.</>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-400">Preencha os campos abaixo para cadastrar uma nova diária.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {funcionariosFiltrados.map((func) => (
                      <button
                        key={func.id || func.nome}
                        type="button"
                        onClick={() => handleSelecionarFuncionario(func)}
                        className="w-full p-3.5 text-left hover:bg-red-50/70 transition flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-zinc-900 group-hover:text-red-700 truncate">
                              {func.nome}
                            </span>
                            {func.profissao && (
                              <span className="shrink-0 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-semibold">
                                {func.profissao}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                            <span>PIX ({func.tipoPix?.toUpperCase() || 'CPF'}): <b>{func.chavePix || '—'}</b></span>
                          </div>
                        </div>

                        <div className="shrink-0 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white text-xs font-bold transition flex items-center gap-1">
                          <span>Selecionar</span>
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card de Funcionário Selecionado */}
          {funcionarioSelecionado && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase">Preenchido pelo Banco de Dados:</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900 text-[10px] font-extrabold">Ativo</span>
                  </div>
                  <p className="text-sm font-black text-emerald-950 truncate">
                    {funcionarioSelecionado.nome} — <span className="font-normal text-emerald-800">{formData.profissao === 'Outra Função' ? outraFuncao : formData.profissao}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLimparSelecao}
                className="px-2.5 py-1.5 rounded-lg bg-white text-zinc-600 hover:text-red-600 hover:bg-red-50 border border-zinc-200 text-xs font-bold transition shrink-0 cursor-pointer"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        {/* Bloco 1: Identificação */}
        <div className="bg-zinc-50/70 p-5 sm:p-6 rounded-2xl border border-zinc-200/70 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/70 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
              <User className="w-4 h-4 text-red-600" />
              Identificação do Diarista / Prestador
            </h3>

            {/* SELETOR RÁPIDO PF / PJ */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    tipoPessoa: 'fisica',
                    tipoPix: prev.tipoPix === 'cnpj' ? 'cpf' : prev.tipoPix
                  }));
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  formData.tipoPessoa === 'fisica'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Pessoa Física</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    tipoPessoa: 'juridica',
                    tipoPix: 'cnpj'
                  }));
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  formData.tipoPessoa === 'juridica'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Pessoa Jurídica (PJ)</span>
              </button>
            </div>
          </div>

          {formData.tipoPessoa === 'juridica' ? (
            /* CAMPOS PESSOA JURÍDICA */
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/80">
                <label className="block text-xs font-black uppercase text-red-900 mb-1.5 flex items-center justify-between">
                  <span>Razão Social da Empresa <span className="text-red-600 font-black">*</span></span>
                  <span className="text-[10px] uppercase font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">Obrigatório</span>
                </label>
                <input
                  type="text"
                  name="razaoSocial"
                  value={formData.razaoSocial}
                  onChange={handleChange}
                  placeholder="Ex: EQUILIBRIUM SERVICOS DE DEDETIZACAO LTDA"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm uppercase font-bold text-zinc-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    name="nomeFantasia"
                    value={formData.nomeFantasia}
                    onChange={handleChange}
                    placeholder="Ex: EQUILIBRIUM SOLUCOES AMBIENTAIS"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm text-zinc-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleChange}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-mono font-medium text-zinc-900 bg-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* CAMPOS PESSOA FÍSICA */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                  Nome Completo / Apelido do Diarista <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    placeholder="Ex: FRANCISCO DIONE ou DESCARREGO TEND TUDO"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm uppercase font-semibold text-zinc-900 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                Função
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <select
                  name="profissao"
                  value={formData.profissao}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm text-zinc-900 bg-white appearance-none cursor-pointer"
                >
                  <option value="">— Selecione a função —</option>
                  {PROFISSOES_PADRAO.map(prof => (
                    <option key={prof} value={prof}>{prof}</option>
                  ))}
                </select>
              </div>

              {/* Campo livre quando "Outra Função" for selecionada */}
              {formData.profissao === 'Outra Função' && (
                <div className="mt-2 relative">
                  <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400" />
                  <input
                    type="text"
                    value={outraFuncao}
                    onChange={(e) => setOutraFuncao(e.target.value)}
                    placeholder="Digite a função..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-sm text-zinc-900 bg-red-50/40 placeholder:text-zinc-400"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                Data do Trabalho / Referência <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm text-zinc-900 bg-white"
                />
              </div>
              {/* Banner de confirmação de dia/mês/ano */}
              {formData.data && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200/80">
                  <Calendar className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="text-xs text-red-800 font-bold">
                    Este diarista será registrado em:{' '}
                    <span className="font-black text-red-900">
                      {(() => {
                        const partes = formData.data.split('-');
                        const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                        return partes.length === 3
                          ? `${partes[2]} de ${MESES_NOMES[parseInt(partes[1], 10) - 1]} de ${partes[0]}`
                          : formData.data;
                      })()}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

        {/* Bloco 2: Valores e Diárias */}
        <div className="bg-zinc-50/70 p-5 sm:p-6 rounded-2xl border border-zinc-200/70 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-red-600" />
            Valores e Diárias
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                Valor da Diária (R$) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-500 text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="valorDiaria"
                  value={formData.valorDiaria}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-bold text-zinc-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                Quantidade de Diárias
              </label>
              <input
                type="number"
                min="1"
                max="31"
                name="quantidadeDiarias"
                value={formData.quantidadeDiarias}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-semibold text-zinc-900 bg-white"
              />
            </div>
          </div>

          {/* Resumo do Total do Diarista */}
          <div className="bg-red-50/60 p-4 rounded-xl border border-red-100 flex items-center justify-between">
            <span className="text-xs font-bold text-red-900 uppercase">Total a pagar a este diarista:</span>
            <span className="text-lg font-black text-red-700">
              R$ {totalCalculado.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* Bloco 3: Dados de Pagamento (PIX) */}
        <div className="bg-zinc-50/70 p-5 sm:p-6 rounded-2xl border border-zinc-200/70 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-red-600" />
            Dados de Pagamento (PIX)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                Tipo de Chave PIX
              </label>
              <select
                name="tipoPix"
                value={formData.tipoPix}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-semibold text-zinc-900 bg-white"
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="telefone">Telefone (Celular)</option>
                <option value="email">E-mail</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                Chave PIX <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="chavePix"
                value={formData.chavePix}
                onChange={handleChange}
                placeholder={
                  formData.tipoPix === 'cnpj'
                    ? '00.000.000/0000-00'
                    : formData.tipoPix === 'cpf'
                    ? '000.000.000-00'
                    : formData.tipoPix === 'telefone'
                    ? '85 9 9999-9999'
                    : formData.tipoPix === 'email'
                    ? 'email@exemplo.com'
                    : 'Chave aleatória'
                }
                required
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm font-mono font-medium text-zinc-900 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-zinc-300 text-zinc-700 font-bold text-sm hover:bg-zinc-100 transition cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/30 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Salvar e Cadastrar Diarista</span>
          </button>
        </div>
      </form>

      {/* MODAL / LISTAGEM COMPLETA DE TODOS OS FUNCIONÁRIOS DO BANCO DE DADOS */}
      {mostrarTodosModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMostrarTodosModal(false)} />
          <div className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-zinc-200 animate-fadeIn z-10 my-auto">
            {/* Header do Modal */}
            <div className="p-6 bg-gradient-to-r from-red-600 to-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    Banco de Dados de Funcionários
                  </h3>
                  <p className="text-xs text-red-100">
                    Selecione um funcionário cadastrado para preencher os dados cadastrais (Nome, Função e PIX)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMostrarTodosModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista dos Funcionários */}
            <div className="p-4 overflow-y-auto divide-y divide-zinc-100 flex-grow">
              {bancoCompleto.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Nenhum colaborador cadastrado no banco de dados.
                  <p className="mt-1 text-[11px] text-zinc-400">Quando houver colaboradores registrados, eles aparecerão aqui para seleção rápida.</p>
                </div>
              ) : (
                bancoCompleto.map((func) => (
                <div
                  key={func.id || func.nome}
                  className="py-3 px-3 rounded-xl hover:bg-red-50/70 transition flex items-center justify-between gap-4 group"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-zinc-900 group-hover:text-red-700">
                        {func.nome}
                      </span>
                      {func.profissao && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-semibold">
                          {func.profissao}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                      <span>PIX ({func.tipoPix?.toUpperCase() || 'CPF'}): <b>{func.chavePix || '—'}</b></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelecionarFuncionario(func)}
                    className="shrink-0 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Preencher</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              )))}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setMostrarTodosModal(false)}
                className="px-5 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
