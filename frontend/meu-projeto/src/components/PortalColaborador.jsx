import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import FormularioColaborador from './FormularioColaborador';
import RelacaoDiaristas from './RelacaoDiaristas';
import CadastrarDiarista from './CadastrarDiarista';
import ReciboIndividual from './ReciboIndividual';
import RelatorioSolar from './RelatorioSolar';
import RegistroFuncionarios from './RegistroFuncionarios';
import PermissaoTrabalhos from './PermissaoTrabalhos';
import ControleEPIs from './ControleEPIs';
import Footer from './Footer';
import { 
  getDiaristasApi, 
  createDiaristaApi, 
  toggleStatusPagoApi, 
  deleteDiaristaApi, 
  resetDiaristasApi 
} from '../services/api';
import { 
  LogOut, 
  UserCheck, 
  FileText, 
  Users, 
  Receipt, 
  ArrowRight, 
  LayoutGrid,
  Sun,
  Briefcase,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export default function PortalColaborador({ user, onLogout }) {
  const navigate = useNavigate();
  // Preserva o módulo que o usuário estava visualizando na sessão ativa (DEV-04)
  const [activeModule, setActiveModule] = useState(() => {
    try {
      localStorage.removeItem('portal_active_module');
      return sessionStorage.getItem('portal_active_module') || 'hub';
    } catch {
      return 'hub';
    }
  });
  const [selectedDiaristaForRecibo, setSelectedDiaristaForRecibo] = useState(null);

  // Sincroniza o módulo ativo em sessionStorage
  useEffect(() => {
    try {
      if (activeModule) {
        sessionStorage.setItem('portal_active_module', activeModule);
      }
    } catch (e) {}
  }, [activeModule]);

  // Lista de diaristas com cache temporário em sessionStorage (evita expor PIX e pagamentos em localStorage persistente)
  const [diaristas, setDiaristas] = useState(() => {
    try {
      localStorage.removeItem('diaristas_cache'); // limpa resíduo legado se houver
      const salvo = sessionStorage.getItem('diaristas_cache');
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });

  // Salva no cache da sessão sempre que diaristas mudar
  useEffect(() => {
    try {
      if (diaristas && diaristas.length > 0) {
        sessionStorage.setItem('diaristas_cache', JSON.stringify(diaristas));
      }
    } catch (e) {}
  }, [diaristas]);

  // Data selecionada ativa para a relação diária
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    try {
      localStorage.removeItem('data_selecionada_diaristas');
      return sessionStorage.getItem('data_selecionada_diaristas') || new Date().toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  });

  useEffect(() => {
    try {
      if (dataSelecionada) {
        sessionStorage.setItem('data_selecionada_diaristas', dataSelecionada);
      }
    } catch (e) {}
  }, [dataSelecionada]);

  // Carrega diárias do PostgreSQL apenas quando o módulo de relação estiver ativo
  useEffect(() => {
    const modulosQueUsaDiaristas = ['relacao', 'solar', 'recibo'];
    if (!modulosQueUsaDiaristas.includes(activeModule)) return;
    async function carregarDiaristas() {
      try {
        const dados = await getDiaristasApi();
        if (dados && Array.isArray(dados)) {
          // Mapeia os campos do backend para o formato esperado pelo frontend
          const formatados = dados.map(d => ({
            id: d.id,
            nome: d.nome,
            valor: d.valor_diaria,
            diarias: d.quantidade_diarias,
            total: d.valor_total,
            pix: d.chave_pix,
            tipoPix: d.tipo_pix,
            motorista: d.profissao,
            profissao: d.profissao,
            data: d.data,
            observacoes: d.observacoes,
            pago: d.pago,
            createdAt: d.created_at
          }));
          setDiaristas(formatados);
          sessionStorage.setItem('diaristas_cache', JSON.stringify(formatados));
        }
      } catch (err) {
        console.warn("Backend operando offline ou conectando...", err);
      }
    }
    carregarDiaristas();
  }, [activeModule]);

  function handleUpdateDiarista(updatedDiarista) {
    setDiaristas((prev) =>
      prev.map((d) => (d.id === updatedDiarista.id ? { ...d, ...updatedDiarista } : d))
    );
  }

  function handleExit() {
    if (onLogout) onLogout();
    navigate('/');
  }

  async function handleAddDiarista(novoDiarista) {
    try {
      const payloadBackend = {
        funcionario_id: novoDiarista.funcionario_id || null,
        nome: novoDiarista.nome,
        profissao: novoDiarista.motorista || novoDiarista.profissao || '',
        data: novoDiarista.data,
        valor_diaria: parseFloat(novoDiarista.valor) || 0,
        quantidade_diarias: parseInt(novoDiarista.diarias, 10) || 1,
        tipo_pix: novoDiarista.tipoPix || 'cpf',
        chave_pix: novoDiarista.pix || novoDiarista.chavePix || '',
        observacoes: novoDiarista.observacoes || '',
        pago: !!novoDiarista.pago
      };
      
      const salvo = await createDiaristaApi(payloadBackend);
      const itemFormatado = {
        id: salvo.id,
        nome: salvo.nome,
        valor: salvo.valor_diaria,
        diarias: salvo.quantidade_diarias,
        total: salvo.valor_total,
        pix: salvo.chave_pix,
        tipoPix: salvo.tipo_pix,
        motorista: salvo.profissao,
        profissao: salvo.profissao,
        data: salvo.data,
        observacoes: salvo.observacoes,
        pago: salvo.pago,
        createdAt: salvo.created_at
      };

      setDiaristas((prev) => [itemFormatado, ...prev]);
      if (salvo.data) {
        setDataSelecionada(salvo.data);
      }
    } catch (err) {
      console.error("Erro ao salvar diária no backend:", err);
      setDiaristas((prev) => [novoDiarista, ...prev]);
      if (novoDiarista.data) setDataSelecionada(novoDiarista.data);
    }
    setActiveModule('relacao');
  }

  async function handleToggleStatus(id) {
    setDiaristas((prev) =>
      prev.map((d) => (d.id === id ? { ...d, pago: !d.pago } : d))
    );
    try {
      await toggleStatusPagoApi(id);
    } catch (err) {
      console.warn("Erro ao sincronizar status com backend:", err);
    }
  }

  async function handleDeleteDiarista(id) {
    if (window.confirm('Deseja realmente remover este diarista da relação?')) {
      setDiaristas((prev) => prev.filter((d) => d.id !== id));
      try {
        await deleteDiaristaApi(id);
      } catch (err) {
        console.warn("Erro ao remover no backend:", err);
      }
    }
  }

  function handleEmitirReciboDireto(diarista) {
    setSelectedDiaristaForRecibo(diarista);
    setActiveModule('recibo');
  }

  async function handleResetDiaristas() {
    if (window.confirm('Deseja limpar toda a relação de diaristas?')) {
      setDiaristas([]);
      const hoje = new Date().toISOString().split('T')[0];
      setDataSelecionada(hoje);
      try {
        await resetDiaristasApi();
      } catch (err) {
        console.warn("Erro ao resetar no backend:", err);
      }
    }
  }

  return (
    <div className="min-h-screen text-zinc-800 flex flex-col antialiased selection:bg-red-600 selection:text-white bg-zinc-900 relative">
      {/* Imagem de Fundo Corporativa Fixa com Overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 no-print"
        style={{
          backgroundImage: 'url(/images/fundo_distribuidora_barreiro_corrigido3.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          filter: 'brightness(0.65) contrast(1.12) saturate(1.05)',
        }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-b from-zinc-950/75 via-zinc-900/60 to-zinc-950/85 pointer-events-none z-0 backdrop-blur-[2px] no-print"
      />

      {/* Header do Portal */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 shadow-sm py-3.5 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveModule('hub')}
              className="hover:opacity-90 transition cursor-pointer"
              title="Menu Principal"
            >
              <Logo className="h-10 sm:h-12" />
            </button>
          </div>

          {/* Usuário & Ações */}
          <div className="flex items-center gap-3">
            {activeModule !== 'hub' && (
              <button
                onClick={() => setActiveModule('hub')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-700 hover:text-red-600 bg-zinc-100 hover:bg-red-50 border border-zinc-200 hover:border-red-200 shadow-xs transition cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Menu Principal</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
              <UserCheck className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="max-w-[140px] sm:max-w-none truncate">
                {user?.email || 'colaborador@irmaosbarreiro.com.br'}
              </span>
            </div>

            <button
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-700 hover:text-red-600 bg-zinc-100 hover:bg-red-50 border border-zinc-200 hover:border-red-200 shadow-xs transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-grow relative z-10 py-8 sm:py-12 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* ========================================================= */}
          {/* 1. SEGUNDA TELA - MENU DE BOTÕES COM BANNER VERMELHO     */}
          {/* ========================================================= */}
          {activeModule === 'hub' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Telinha Vermelha do Topo com Explicação das Etapas */}
              <div className="bg-gradient-to-r from-red-600 via-red-700 to-zinc-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-red-500/30 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-2 backdrop-blur-sm">
                      <span>Portal do Colaborador</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      Distribuidora Irmãos Barreiro
                    </h1>
                    <p className="text-sm text-red-100 mt-1">
                      Selecione uma opção abaixo para continuar:
                    </p>
                  </div>

                  {/* Resumo Breve das Etapas / Módulos */}
                  <div className="pt-4 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 text-xs">
                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-red-200" />
                        1. Relatório Individual
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Formulário de cadastro do colaborador e emissão de ficha oficial em PDF.
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-red-200" />
                        2. Relação de Diaristas
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Tabela de diárias, chaves PIX e cadastro de novos diaristas.
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-red-200" />
                        3. Recibos
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Emissão de recibo diário, semanal ou mensal com quitação legal.
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-300" />
                        4. Solar
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Emissão oficial de relatórios em PDF do mês e do dia com total de diárias.
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-300" />
                        5. Registro de Funcionários
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Data de entrada, diárias realizadas e relatório com total em dinheiro ganho.
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-orange-300" />
                        6. PTs
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Permissões de Trabalho: Altura, Espaço Confinado, Eletricidade, Quente e Químicos.
                      </p>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/10 space-y-1">
                      <span className="font-extrabold text-white uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                        7. Controle de EPIs
                      </span>
                      <p className="text-red-100/90 text-[11px] leading-relaxed">
                        Estoque mínimo, CAs, importação de planilhas/NF-e e ficha NR-6 em PDF.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* GRID DOS BOTÕES PRINCIPAIS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 sm:gap-4">
                
                {/* BOTÃO 1: RELATÓRIO COM DADOS INDIVIDUAIS */}
                <button
                  id="btn-relatorio-individual"
                  onClick={() => setActiveModule('formulario')}
                  className="group bg-white hover:bg-red-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-red-500/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-red-50 group-hover:bg-red-600 text-red-600 group-hover:text-white flex items-center justify-center transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-red-600 transition-colors leading-snug">
                      Relatório com dados individuais
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Preenchimento de dados cadastrais e geração de ficha em PDF.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <span>Acessar formulário</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* BOTÃO 2: RELAÇÃO DE DIARISTAS */}
                <button
                  id="btn-relacao-diaristas"
                  onClick={() => setActiveModule('relacao')}
                  className="group bg-white hover:bg-red-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-red-500/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-100 group-hover:bg-zinc-900 text-zinc-800 group-hover:text-white flex items-center justify-center transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-red-600 transition-colors leading-snug">
                      Relação de diaristas
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Controle de diárias, cópia de PIX e cadastro de diaristas.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <span>Ver relação</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* BOTÃO 3: RECIBO INDIVIDUAL */}
                <button
                  id="btn-recibo-individual"
                  onClick={() => {
                    setSelectedDiaristaForRecibo(null);
                    setActiveModule('recibo');
                  }}
                  className="group bg-white hover:bg-red-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-red-500/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 group-hover:bg-red-600 text-zinc-800 group-hover:text-white flex items-center justify-center transition-colors">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-red-600 transition-colors leading-snug">
                      Recibos
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Geração de recibo diário, semanal ou mensal com quitação legal.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <span>Emitir recibo</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* BOTÃO 4: SOLAR */}
                <button
                  id="btn-solar"
                  onClick={() => setActiveModule('solar')}
                  className="group bg-white hover:bg-amber-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-amber-500/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 group-hover:bg-amber-500 text-amber-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                      <Sun className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-amber-600 transition-colors leading-snug">
                      Solar
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Relatórios oficiais em PDF do mês e do dia com controle de diárias e função.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-amber-600">
                    <span>Acessar Solar</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* BOTÃO 5: REGISTRO DE FUNCIONÁRIOS */}
                <button
                  id="btn-registro-funcionarios"
                  onClick={() => setActiveModule('registro_funcionarios')}
                  className="group bg-white hover:bg-red-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-red-500/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-100 group-hover:bg-red-600 text-zinc-800 group-hover:text-white flex items-center justify-center transition-colors">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-red-600 transition-colors leading-snug">
                      Registro de funcionários
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Começo dos pagamentos, diárias realizadas e relatório completo com total ganho.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <span>Acessar registros</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* BOTÃO 6: PTs — PERMISSÃO DE TRABALHOS */}
                <button
                  id="btn-permissao-trabalhos"
                  onClick={() => setActiveModule('pts')}
                  className="group bg-white hover:bg-orange-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-orange-400/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 group-hover:bg-orange-500 text-orange-600 group-hover:text-white flex items-center justify-center transition-colors">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-orange-600 transition-colors leading-snug">
                      PTs
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Permissões de Trabalho: Altura, Espaço Confinado, Eletricidade, Trabalho a Quente e Químicos.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-orange-600">
                    <span>Emitir PT</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* BOTÃO 7: CONTROLE DE EPIS */}
                <button
                  id="btn-controle-epis"
                  onClick={() => setActiveModule('epis')}
                  className="group bg-white hover:bg-emerald-50/50 rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xl hover:shadow-2xl hover:border-emerald-500/50 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer min-h-[210px]"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 group-hover:text-emerald-600 transition-colors leading-snug">
                      Controle de EPIs
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      Estoque mínimo, CAs válidos, importação de planilhas/NF-e e ficha NR-6 em PDF.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span>Acessar EPIs</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. FORMULÁRIO COM DADOS INDIVIDUAIS                       */}
          {/* ========================================================= */}
          {activeModule === 'formulario' && (
            <FormularioColaborador
              userEmail={user?.email}
              onLogout={handleExit}
              onBack={() => setActiveModule('hub')}
            />
          )}

          {/* ========================================================= */}
          {/* 3. RELAÇÃO DE DIARISTAS                                   */}
          {/* ========================================================= */}
          {activeModule === 'relacao' && (
            <RelacaoDiaristas
              diaristas={diaristas}
              dataSelecionada={dataSelecionada}
              setDataSelecionada={setDataSelecionada}
              onNavigateCadastrar={() => setActiveModule('cadastrar_diarista')}
              onEmitirRecibo={handleEmitirReciboDireto}
              onToggleStatus={handleToggleStatus}
              onUpdateDiarista={handleUpdateDiarista}
              onDeleteDiarista={handleDeleteDiarista}
              onResetDiaristas={handleResetDiaristas}
              onBack={() => setActiveModule('hub')}
            />
          )}

          {/* ========================================================= */}
          {/* 4. CADASTRAR DIARISTA                                     */}
          {/* ========================================================= */}
          {activeModule === 'cadastrar_diarista' && (
            <CadastrarDiarista
              dataInicial={dataSelecionada}
              diaristasExistentes={diaristas}
              onBack={() => setActiveModule('relacao')}
              onSave={handleAddDiarista}
            />
          )}

          {/* ========================================================= */}
          {/* 5. RECIBO INDIVIDUAL                                      */}
          {/* ========================================================= */}
          {activeModule === 'recibo' && (
            <ReciboIndividual
              diaristaInicial={selectedDiaristaForRecibo}
              diaristas={diaristas}
              onUpdateDiarista={handleUpdateDiarista}
              onBack={() => setActiveModule('hub')}
            />
          )}

          {/* ========================================================= */}
          {/* 6. MÓDULO SOLAR                                           */}
          {/* ========================================================= */}
          {activeModule === 'solar' && (
            <RelatorioSolar
              diaristas={diaristas}
              onBack={() => setActiveModule('hub')}
            />
          )}

          {/* ========================================================= */}
          {/* 7. MÓDULO REGISTRO DE FUNCIONÁRIOS                        */}
          {/* ========================================================= */}
          {activeModule === 'registro_funcionarios' && (
            <RegistroFuncionarios
              onBack={() => setActiveModule('hub')}
            />
          )}

          {/* ========================================================= */}
          {/* 8. MÓDULO PTs — PERMISSÃO DE TRABALHOS                    */}
          {/* ========================================================= */}
          {activeModule === 'pts' && (
            <PermissaoTrabalhos
              onBack={() => setActiveModule('hub')}
            />
          )}

          {/* ========================================================= */}
          {/* 9. MÓDULO CONTROLE DE EPIS (NR-6)                          */}
          {/* ========================================================= */}
          {activeModule === 'epis' && (
            <ControleEPIs
              onBack={() => setActiveModule('hub')}
            />
          )}

        </div>
      </main>

      {/* Rodapé Corporativo Padronizado */}
      <Footer />
    </div>
  );
}
