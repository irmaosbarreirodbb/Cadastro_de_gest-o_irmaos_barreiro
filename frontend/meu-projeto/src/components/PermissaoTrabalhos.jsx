import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  Zap,
  Flame,
  FlaskConical,
  Mountain,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Printer,
  X,
  ArrowRight,
  ClipboardList,
  Search,
  PlusCircle,
  Eye,
  Trash2,
  CheckCheck,
  Calendar,
  Clock,
  Building,
  User,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { TIPOS_PT } from './pts/ptData';
import DocumentoPTImpressao from './pts/DocumentoPTImpressao';
import {
  getPTsApi,
  createPTApi,
  updateStatusPTApi,
  deletePTApi,
} from '../services/api';

// Mapeamento de ícones e estilos para os 5 tipos de PT
const ICONES_POR_TIPO = {
  ALTURA: Mountain,
  ESPACO_CONFINADO: ShieldAlert,
  ELETRICIDADE: Zap,
  TRABALHO_QUENTE: Flame,
  QUIMICOS: FlaskConical,
};

const ESTILOS_POR_TIPO = {
  ALTURA: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hoverBorder: 'hover:border-blue-500',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconBg: 'bg-blue-600',
    accentText: 'text-blue-700',
  },
  ESPACO_CONFINADO: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-700',
    accentText: 'text-emerald-700',
  },
  ELETRICIDADE: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hoverBorder: 'hover:border-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-600',
    accentText: 'text-amber-700',
  },
  TRABALHO_QUENTE: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    hoverBorder: 'hover:border-orange-500',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    iconBg: 'bg-orange-600',
    accentText: 'text-orange-700',
  },
  QUIMICOS: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    hoverBorder: 'hover:border-rose-500',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    iconBg: 'bg-rose-600',
    accentText: 'text-rose-700',
  },
};

// ============================================================================
// COMPONENTE DO FORMULÁRIO DINÂMICO
// ============================================================================
function FormularioPT({ tipoKey, onVoltar, onConcluir }) {
  const config = TIPOS_PT[tipoKey];
  const estilo = ESTILOS_POR_TIPO[tipoKey] || ESTILOS_POR_TIPO.ALTURA;
  const Icone = ICONES_POR_TIPO[tipoKey] || ShieldAlert;

  const hoje = new Date().toISOString().split('T')[0];
  const agoraHora = new Date().toTimeString().slice(0, 5);

  // Estado do formulário
  const [dados, setDados] = useState({
    area: 'Centro de Distribuição - Operacional',
    solicitante: '',
    local_trabalho: '',
    descricao_trabalho: '',
    data_emissao: hoje,
    data_termino: hoje,
    hora_inicio: agoraHora,
    hora_termino: '17:00',
    numero_ptr: '',
    numero_apr: '',
    numero_os: '',
    responsavel_emissao: '',
    responsavel_servico: '',
    seguranca_trabalho: 'SESMT - Distribuidora Irmãos Barreiro',
    medidas_adicionais: '',
    // Seleção de EPIs e EPCs (iniciam todos marcados por padrão de segurança)
    epis_selecionados: [...(config.epis || [])],
    epcs_selecionados: [...(config.epcs || [])],
    outros_epis: '',
    // Checklist S / N / NA indexado por número
    checklist: (config.itensMedidasControle || []).reduce((acc, _, i) => {
      acc[i] = 'S';
      return acc;
    }, {}),
    // Campos específicos para Trabalho a Quente
    natureza: 'Solda',
    tipo_executante: 'Próprio',
    empresa_terceira: '',
    precisa_observador: 'Sim',
    nome_observador: '',
    // Campos específicos para Eletricidade
    etiqueta_bloqueio: 'EB-' + Math.floor(100 + Math.random() * 900),
    etiqueta_identificacao: 'EI-' + Math.floor(100 + Math.random() * 900),
    numero_cadeado: 'CAD-' + Math.floor(10 + Math.random() * 90),
    tensao_nivel: 'BAIXA',
    estado_rede: 'DESENERGIZADA',
    // Campos específicos para Espaço Confinado
    medicao_o2: '20.9 %',
    medicao_lie: '0.0 %',
    medicao_co: '0 ppm',
    medicao_h2s: '0 ppm',
    medidor_modelo: 'Multigás Certificado INMETRO',
    vigia: '',
    supervisor_entrada: '',
  });

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Manipulador genérico de input
  const handleChange = (campo, valor) => {
    setDados(prev => ({ ...prev, [campo]: valor }));
  };

  // Toggle de EPI
  const handleToggleEpi = (item) => {
    setDados(prev => {
      const jaExiste = prev.epis_selecionados.includes(item);
      return {
        ...prev,
        epis_selecionados: jaExiste
          ? prev.epis_selecionados.filter(i => i !== item)
          : [...prev.epis_selecionados, item],
      };
    });
  };

  // Toggle de EPC
  const handleToggleEpc = (item) => {
    setDados(prev => {
      const jaExiste = prev.epcs_selecionados.includes(item);
      return {
        ...prev,
        epcs_selecionados: jaExiste
          ? prev.epcs_selecionados.filter(i => i !== item)
          : [...prev.epcs_selecionados, item],
      };
    });
  };

  // Resposta do checklist (S, N, NA)
  const handleChecklist = (indice, resposta) => {
    setDados(prev => ({
      ...prev,
      checklist: { ...prev.checklist, [indice]: resposta },
    }));
  };

  // Ação rápida: marcar todos os itens de medidas de controle como "S" (Conforme)
  const handleMarcarTodosSim = () => {
    const todosSim = (config.itensMedidasControle || []).reduce((acc, _, i) => {
      acc[i] = 'S';
      return acc;
    }, {});
    setDados(prev => ({ ...prev, checklist: todosSim }));
  };

  // Enviar e salvar no backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dados.solicitante.trim()) {
      setErro('Informe o Solicitante do Serviço.');
      return;
    }
    if (!dados.local_trabalho.trim()) {
      setErro('Informe o Local ou Setor do Trabalho.');
      return;
    }
    if (!dados.descricao_trabalho.trim()) {
      setErro('Descreva o trabalho que será realizado.');
      return;
    }

    setErro(null);
    setSalvando(true);

    try {
      const payload = {
        tipo: tipoKey,
        dados: dados,
        responsavel: dados.solicitante,
        local_trabalho: dados.local_trabalho,
        data_inicio: dados.data_emissao,
        status: 'EMITIDA',
      };

      const ptCriada = await createPTApi(payload);
      onConcluir(ptCriada);
    } catch (err) {
      setErro(err.message || 'Erro ao emitir Permissão de Trabalho');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Botão de Retorno */}
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-2 text-xs font-bold text-white/80 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Painel de PTs
      </button>

      {/* Cartão do Formulário */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden">
        {/* Topo do Formulário com Tema do Tipo de PT */}
        <div className={`${estilo.iconBg} p-6 sm:p-8 text-white flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Icone className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="inline-block px-3 py-0.5 rounded-full bg-black/20 text-white text-[10px] font-black uppercase tracking-wider mb-1">
                Formulário Oficial de Emissão
              </span>
              <h2 className="text-xl sm:text-2xl font-black">{config.label}</h2>
              <p className="text-xs text-white/80 mt-0.5">{config.subtitulo}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          {erro && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* 1. DADOS BÁSICOS DA OPERAÇÃO */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide flex items-center gap-2 pb-2 border-b border-zinc-200">
              <Building className="w-4 h-4 text-red-600" />
              1. Identificação Geral da Atividade
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Área / Unidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dados.area}
                  onChange={e => handleChange('area', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  placeholder="Ex: CD Barreiro - Pavimento Térreo"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Solicitante do Serviço <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dados.solicitante}
                  onChange={e => handleChange('solicitante', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  placeholder="Nome do responsável ou encarregado solicitante"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Local Específico do Serviço <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dados.local_trabalho}
                  onChange={e => handleChange('local_trabalho', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  placeholder="Ex: Telhado do Galpão 3 / Painel Geral QGBT 02 / Silo 01"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Descrição Detalhada do Trabalho <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={dados.descricao_trabalho}
                  onChange={e => handleChange('descricao_trabalho', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                  placeholder="Descreva minuciosamente a atividade, os equipamentos que serão utilizados e as etapas de execução..."
                  required
                />
              </div>
            </div>

            {/* Datas e Horários */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Data de Emissão</label>
                <input
                  type="date"
                  value={dados.data_emissao}
                  onChange={e => handleChange('data_emissao', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Data Término</label>
                <input
                  type="date"
                  value={dados.data_termino}
                  onChange={e => handleChange('data_termino', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Hora Início</label>
                <input
                  type="time"
                  value={dados.hora_inicio}
                  onChange={e => handleChange('hora_inicio', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Hora Término</label>
                <input
                  type="time"
                  value={dados.hora_termino}
                  onChange={e => handleChange('hora_termino', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. CAMPOS ESPECÍFICOS DO TIPO */}
          {tipoKey === 'TRABALHO_QUENTE' && (
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-4">
              <h4 className="text-xs font-black text-orange-950 uppercase tracking-wide">
                Configurações de Trabalho a Quente
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Natureza da Operação</label>
                  <select
                    value={dados.natureza}
                    onChange={e => handleChange('natureza', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                  >
                    <option value="Solda">Solda</option>
                    <option value="Maçarico">Maçarico</option>
                    <option value="Lixamento">Lixamento</option>
                    <option value="Aquecimento">Aquecimento</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Executante</label>
                  <select
                    value={dados.tipo_executante}
                    onChange={e => handleChange('tipo_executante', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                  >
                    <option value="Próprio">Próprio (Distribuidora Irmãos Barreiro)</option>
                    <option value="Terceiro">Terceirizado</option>
                  </select>
                </div>
                {dados.tipo_executante === 'Terceiro' && (
                  <div>
                    <label className="font-bold text-zinc-700 block mb-1">Nome da Empresa Terceirizada</label>
                    <input
                      type="text"
                      value={dados.empresa_terceira}
                      onChange={e => handleChange('empresa_terceira', e.target.value)}
                      placeholder="Razão social da contratada"
                      className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                    />
                  </div>
                )}
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Observador de Incêndio</label>
                  <input
                    type="text"
                    value={dados.nome_observador}
                    onChange={e => handleChange('nome_observador', e.target.value)}
                    placeholder="Nome do brigadista/vigia de fogo"
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {tipoKey === 'ELETRICIDADE' && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
              <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                Bloqueio Elétrico e Tensão
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Nº Etiqueta de Bloqueio</label>
                  <input
                    type="text"
                    value={dados.etiqueta_bloqueio}
                    onChange={e => handleChange('etiqueta_bloqueio', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Nº Cadeado de Segurança</label>
                  <input
                    type="text"
                    value={dados.numero_cadeado}
                    onChange={e => handleChange('numero_cadeado', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Nível de Tensão</label>
                  <select
                    value={dados.tensao_nivel}
                    onChange={e => handleChange('tensao_nivel', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                  >
                    <option value="BAIXA">Baixa Tensão (&lt; 1000V)</option>
                    <option value="ALTA">Alta Tensão (&gt; 1000V)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {tipoKey === 'ESPACO_CONFINADO' && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Medições Iniciais da Atmosfera (Antes da Entrada)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Oxigênio (O₂)</label>
                  <input
                    type="text"
                    value={dados.medicao_o2}
                    onChange={e => handleChange('medicao_o2', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Inflamáveis (% LIE)</label>
                  <input
                    type="text"
                    value={dados.medicao_lie}
                    onChange={e => handleChange('medicao_lie', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Monóxido de Carbono (CO)</label>
                  <input
                    type="text"
                    value={dados.medicao_co}
                    onChange={e => handleChange('medicao_co', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Gás Sulfídrico (H₂S)</label>
                  <input
                    type="text"
                    value={dados.medicao_h2s}
                    onChange={e => handleChange('medicao_h2s', e.target.value)}
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Vigia Designado</label>
                  <input
                    type="text"
                    value={dados.vigia}
                    onChange={e => handleChange('vigia', e.target.value)}
                    placeholder="Nome do vigia permanente"
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Supervisor de Entrada</label>
                  <input
                    type="text"
                    value={dados.supervisor_entrada}
                    onChange={e => handleChange('supervisor_entrada', e.target.value)}
                    placeholder="Nome do supervisor autorizado"
                    className="w-full p-2 rounded-xl border border-zinc-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPI) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                2. Equipamentos de Proteção Individual (EPI)
              </h3>
              <span className="text-[11px] text-zinc-500">Selecione os EPIs aplicáveis para esta PT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {config.epis.map((epi, idx) => {
                const ativo = dados.epis_selecionados.includes(epi);
                return (
                  <label
                    key={idx}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                      ativo
                        ? 'bg-red-50/50 border-red-300 text-zinc-900 font-bold'
                        : 'bg-zinc-50/50 border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={() => handleToggleEpi(epi)}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                    />
                    <span>{epi}</span>
                  </label>
                );
              })}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-zinc-700 mb-1">Outros EPIs Necessários</label>
              <input
                type="text"
                value={dados.outros_epis}
                onChange={e => handleChange('outros_epis', e.target.value)}
                placeholder="Especifique outros equipamentos de proteção se houver..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4. EQUIPAMENTOS DE PROTEÇÃO COLETIVA (EPC) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                3. Equipamentos de Proteção Coletiva (EPC)
              </h3>
              <span className="text-[11px] text-zinc-500">Selecione os EPCs instalados no local</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {config.epcs.map((epc, idx) => {
                const ativo = dados.epcs_selecionados.includes(epc);
                return (
                  <label
                    key={idx}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                      ativo
                        ? 'bg-red-50/50 border-red-300 text-zinc-900 font-bold'
                        : 'bg-zinc-50/50 border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={() => handleToggleEpc(epc)}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                    />
                    <span>{epc}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 5. MEDIDAS DE CONTROLE NECESSÁRIAS (CHECKLIST S / N / NA) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                  4. Medidas de Controle Necessárias (Checklist Oficial)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Avalie item por item: <b>S</b> = Sim / Conforme | <b>N</b> = Não | <b>NA</b> = Não Aplicável
                </p>
              </div>

              <button
                type="button"
                onClick={handleMarcarTodosSim}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                Marcar Todos como CONFORME (S)
              </button>
            </div>

            <div className="space-y-2.5">
              {config.itensMedidasControle.map((item, idx) => {
                const resp = dados.checklist[idx] || 'S';
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <span className="text-xs text-zinc-800 leading-snug sm:max-w-[70%]">
                      {item}
                    </span>

                    {/* Botões de alternância rápida S / N / NA */}
                    <div className="inline-flex rounded-xl bg-zinc-100 p-1 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleChecklist(idx, 'S')}
                        className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                          resp === 'S'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        SIM (S)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChecklist(idx, 'N')}
                        className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                          resp === 'N'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        NÃO (N)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChecklist(idx, 'NA')}
                        className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                          resp === 'NA'
                            ? 'bg-zinc-700 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        NA
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. RESPONSÁVEIS PELA VALIDAÇÃO */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide pb-2 border-b border-zinc-200">
              5. Validação e Assinaturas dos Responsáveis
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Resp. Emissão da PTE
                </label>
                <input
                  type="text"
                  value={dados.responsavel_emissao}
                  onChange={e => handleChange('responsavel_emissao', e.target.value)}
                  placeholder="Nome do encarregado de manutenção"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Resp. pela Execução do Serviço
                </label>
                <input
                  type="text"
                  value={dados.responsavel_servico}
                  onChange={e => handleChange('responsavel_servico', e.target.value)}
                  placeholder="Nome do executor / técnico líder"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Segurança do Trabalho (SESMT)
                </label>
                <input
                  type="text"
                  value={dados.seguranca_trabalho}
                  onChange={e => handleChange('seguranca_trabalho', e.target.value)}
                  placeholder="Nome do técnico ou engenheiro de segurança"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Medidas Preventivas Adicionais / Observações
              </label>
              <textarea
                rows={2}
                value={dados.medidas_adicionais}
                onChange={e => handleChange('medidas_adicionais', e.target.value)}
                placeholder="Observações complementares específicas para esta intervenção..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-4 border-t border-zinc-200 flex flex-wrap gap-4 items-center justify-between">
            <button
              type="button"
              onClick={onVoltar}
              className="px-6 py-3 rounded-2xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-sm font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="px-8 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-black transition cursor-pointer flex items-center gap-2 shadow-xl shadow-red-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando no Sistema...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Concluir e Emitir PT (Gerar PDF)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL DO MÓDULO PTs
// ============================================================================
export default function PermissaoTrabalhos({ onBack }) {
  // Telas possíveis: 'hub' | 'formulario' | 'documento'
  const [telaAtiva, setTelaAtiva] = useState('hub');
  const [tipoSelecionado, setTipoSelecionado] = useState(null);
  const [ptVisualizada, setPtVisualizada] = useState(null);

  // Lista de PTs com cache na sessão (sessionStorage DEV-04)
  const [listaPts, setListaPts] = useState(() => {
    try {
      localStorage.removeItem('lista_pts_cache'); // higienização de cache antigo
      const salvo = sessionStorage.getItem('lista_pts_cache');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });
  const [carregando, setCarregando] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('lista_pts_cache');
      return !salvo;
    } catch {
      return true;
    }
  });

  // Filtros e busca
  const [filtroStatus, setFiltroStatus] = useState('TODAS'); // 'TODAS' | 'EMITIDA' | 'APROVADA' | 'ENCERRADA'
  const [busca, setBusca] = useState('');

  // Carrega as PTs do backend
  const carregarPTs = async () => {
    setCarregando(true);
    try {
      const resultado = await getPTsApi();
      if (Array.isArray(resultado)) {
        setListaPts(resultado);
        sessionStorage.setItem('lista_pts_cache', JSON.stringify(resultado));
      }
    } catch {
      const salvo = sessionStorage.getItem('lista_pts_cache');
      if (salvo) {
        try {
          setListaPts(JSON.parse(salvo));
        } catch (e) {}
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPTs();
  }, []);

  // Abre formulário para um tipo de PT
  const handleIniciarEmissao = (tipoKey) => {
    setTipoSelecionado(tipoKey);
    setTelaAtiva('formulario');
  };

  // Quando o formulário conclui a emissão com sucesso
  const handlePtConcluida = (novaPt) => {
    setPtVisualizada(novaPt);
    setTelaAtiva('documento');
    carregarPTs();
  };

  // Abre visualização/impressão direta de uma PT salva
  const handleVisualizarPt = (pt) => {
    setTipoSelecionado(pt.tipo);
    setPtVisualizada(pt);
    setTelaAtiva('documento');
  };

  // Alteração de status
  const handleAlterarStatus = async (ptId, novoStatus) => {
    try {
      await updateStatusPTApi(ptId, novoStatus);
      carregarPTs();
    } catch (err) {
      alert(err.message || 'Erro ao atualizar status');
    }
  };

  // Exclusão de PT
  const handleExcluirPt = async (ptId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta Permissão de Trabalho?')) return;
    try {
      await deletePTApi(ptId);
      carregarPTs();
    } catch (err) {
      alert(err.message || 'Erro ao remover PT');
    }
  };

  // Filtragem da tabela
  const ptsFiltradas = useMemo(() => {
    return listaPts.filter(pt => {
      const matchStatus = filtroStatus === 'TODAS' || pt.status === filtroStatus;
      const termo = busca.toLowerCase();
      const matchBusca =
        !termo ||
        (pt.numero_pt && pt.numero_pt.toLowerCase().includes(termo)) ||
        (pt.tipo && pt.tipo.toLowerCase().includes(termo)) ||
        (pt.responsavel && pt.responsavel.toLowerCase().includes(termo)) ||
        (pt.local_trabalho && pt.local_trabalho.toLowerCase().includes(termo));
      return matchStatus && matchBusca;
    });
  }, [listaPts, filtroStatus, busca]);

  // RENDERIZAÇÃO DO FORMULÁRIO DE PREENCHIMENTO
  if (telaAtiva === 'formulario' && tipoSelecionado) {
    return (
      <FormularioPT
        tipoKey={tipoSelecionado}
        onVoltar={() => setTelaAtiva('hub')}
        onConcluir={handlePtConcluida}
      />
    );
  }

  // RENDERIZAÇÃO DO DOCUMENTO PDF OFICIAL
  if (telaAtiva === 'documento' && ptVisualizada) {
    const config = TIPOS_PT[ptVisualizada.tipo] || TIPOS_PT.ALTURA;
    return (
      <DocumentoPTImpressao
        pt={ptVisualizada}
        config={config}
        onVoltar={() => setTelaAtiva('hub')}
        onImprimir={() => window.print()}
      />
    );
  }

  // RENDERIZAÇÃO DO HUB PRINCIPAL (MENU DE CAIXINHAS E HISTÓRICO)
  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* BANNER SUPERIOR OFICIAL NO PADRÃO DISTRIBUIDORA IRMÃOS BARREIRO */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-zinc-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-red-500/30 relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Menu Principal
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider mb-2 backdrop-blur-sm">
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Gestão de Permissões de Trabalho</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                PTs — Permissão de Trabalhos
              </h1>
              <p className="text-sm text-red-100 max-w-2xl mt-1">
                Selecione uma das 5 opções de autorização para abrir os campos automáticos, emitir com segurança e gerar o documento oficial em PDF.
              </p>
            </div>

            {/* Contador Rápido por Status */}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10 text-center min-w-[90px]">
                <span className="block text-xl font-black text-white">{listaPts.length}</span>
                <span className="text-[10px] text-red-100 uppercase tracking-wider font-bold">Total PTs</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10 text-center min-w-[90px]">
                <span className="block text-xl font-black text-amber-300">
                  {listaPts.filter(p => p.status === 'EMITIDA').length}
                </span>
                <span className="text-[10px] text-red-100 uppercase tracking-wider font-bold">Emitidas</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10 text-center min-w-[90px]">
                <span className="block text-xl font-black text-emerald-300">
                  {listaPts.filter(p => p.status === 'APROVADA').length}
                </span>
                <span className="text-[10px] text-red-100 uppercase tracking-wider font-bold">Aprovadas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AS 5 OPÇÕES EXATAS DE CAIXINHAS CONFORME SOLICITADO */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Selecione uma Permissão para Emitir (5 Tipos Oficiais)
          </h2>
          <span className="text-xs text-white/60">Clique em qualquer caixinha para iniciar</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Object.entries(TIPOS_PT).map(([key, config]) => {
            const estilo = ESTILOS_POR_TIPO[key] || ESTILOS_POR_TIPO.ALTURA;
            const Icone = ICONES_POR_TIPO[key] || ShieldAlert;
            const count = listaPts.filter(p => p.tipo === key).length;

            return (
              <button
                key={key}
                id={`btn-pt-${key.toLowerCase()}`}
                onClick={() => handleIniciarEmissao(key)}
                className={`group bg-white ${estilo.hoverBorder} rounded-3xl p-5 border-2 ${estilo.border} shadow-xl hover:shadow-2xl transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[220px]`}
              >
                <div className="space-y-3">
                  <div className={`w-12 h-12 rounded-2xl ${estilo.iconBg} text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow-md`}>
                    <Icone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400">
                      Permissão Específica
                    </span>
                    <h3 className="text-sm font-black text-zinc-900 group-hover:text-red-600 transition-colors leading-tight mt-0.5">
                      {config.label}
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {config.subtitulo}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-bold">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] ${estilo.badge}`}>
                    {count} emitida{count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-red-600 group-hover:translate-x-1 transition-transform">
                    Emitir <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PAINEL DE CONTROLE / HISTÓRICO DE PTs NO BANCO DE DADOS */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
        {/* Barra de Filtros e Busca (Estilo do Sistema Gestão de Contratadas) */}
        <div className="p-5 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/70">
          {/* Abas de Status */}
          <div className="inline-flex rounded-2xl bg-zinc-200/80 p-1">
            {[
              { id: 'TODAS', label: 'Todas as PTs' },
              { id: 'EMITIDA', label: 'PTs Ativas / Emitidas' },
              { id: 'APROVADA', label: 'PTs Aprovadas' },
              { id: 'ENCERRADA', label: 'PTs Encerradas' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFiltroStatus(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filtroStatus === tab.id
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Campo de Busca */}
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nº PT, local, responsável..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tabela de PTs Registradas */}
        {carregando ? (
          <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            <span className="text-xs font-semibold">Carregando permissões de trabalho...</span>
          </div>
        ) : ptsFiltradas.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-2">
            <ClipboardList className="w-10 h-10 mx-auto text-zinc-300" />
            <p className="text-sm font-bold text-zinc-700">Nenhuma Permissão de Trabalho encontrada</p>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              {busca || filtroStatus !== 'TODAS'
                ? 'Nenhum resultado corresponde aos filtros selecionados.'
                : 'Selecione uma das 5 opções acima para emitir a primeira PT.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100/70 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Nº da PT</th>
                  <th className="py-3 px-4">Tipo de Permissão</th>
                  <th className="py-3 px-4">Local / Setor</th>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Data / Horário</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {ptsFiltradas.map(pt => {
                  const config = TIPOS_PT[pt.tipo] || TIPOS_PT.ALTURA;
                  const estilo = ESTILOS_POR_TIPO[pt.tipo] || ESTILOS_POR_TIPO.ALTURA;

                  return (
                    <tr key={pt.id} className="hover:bg-zinc-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                        {pt.numero_pt}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${estilo.badge}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-900">
                        {pt.local_trabalho || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600">
                        {pt.responsavel || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 font-mono">
                        {pt.data_inicio || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <select
                          value={pt.status}
                          onChange={e => handleAlterarStatus(pt.id, e.target.value)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                            pt.status === 'APROVADA'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : pt.status === 'EMITIDA'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : pt.status === 'ENCERRADA'
                              ? 'bg-zinc-100 text-zinc-700 border-zinc-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}
                        >
                          <option value="EMITIDA">EMITIDA</option>
                          <option value="APROVADA">APROVADA</option>
                          <option value="ENCERRADA">ENCERRADA</option>
                          <option value="CANCELADA">CANCELADA</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleVisualizarPt(pt)}
                            title="Visualizar e Imprimir PDF"
                            className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => handleExcluirPt(pt.id)}
                            title="Remover PT"
                            className="p-1.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
}
