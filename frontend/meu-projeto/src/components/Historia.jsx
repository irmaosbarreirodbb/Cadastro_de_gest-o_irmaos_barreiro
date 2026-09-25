import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const modules = [
  {
    num: '01',
    title: 'Cadastro do colaborador',
    desc: 'Admissão com dados pessoais, endereço, documentos e chave PIX, gerando a ficha oficial em PDF.',
    action: 'Emitir ficha cadastral',
  },
  {
    num: '02',
    title: 'Lançamento da diária',
    desc: 'Conferência diária de presença e pagamento, com cálculo automático por diária trabalhada.',
    action: 'Gerenciar diárias',
  },
  {
    num: '03',
    title: 'Emissão do recibo',
    desc: 'Recibo com validade jurídica gerado automaticamente após a confirmação do pagamento.',
    action: 'Emitir recibos',
  },
  {
    num: '04',
    title: 'Relatório consolidado',
    desc: 'Fechamento Solar mensal com histórico acumulado de diárias e valores da operação.',
    action: 'Gerar relatórios',
  },
  {
    num: '05',
    title: 'Registro de funcionários',
    desc: 'Histórico contínuo, data de entrada, diárias prestadas e valor total acumulado.',
    action: 'Consultar histórico',
  },
  {
    num: '06',
    title: 'Permissões de trabalho (PTs)',
    desc: 'Emissão e gestão de PTs obrigatórias de segurança antes do início de operações de risco em campo.',
    action: 'Emitir PTs de segurança',
  },
  {
    num: '07',
    title: 'Controle de EPIs',
    desc: 'Controle de estoque, entregas, certificados de aprovacao e validade dos equipamentos de protecao.',
    action: 'Acessar controle de EPIs',
  },
  {
    num: '08',
    title: 'Exame toxicologico',
    desc: 'Relacao de motoristas, acompanhamento dos vencimentos, alertas automaticos e exportacao em PDF.',
    action: 'Acessar exames',
  },
  {
    num: '09',
    title: 'Controle de CNH',
    desc: 'Frota e Adm: acompanhamento de validades, PDFs criptografados, e-mails de alerta e relatório oficial.',
    action: 'Acessar CNHs',
  },
];

export default function Historia({ isLoggedIn, onOpenLogin }) {
  const navigate = useNavigate();
  const goToPortal = () => isLoggedIn ? navigate('/portal') : onOpenLogin();

  return (
    <section
      className="relative overflow-hidden text-zinc-900"
      style={{
        backgroundImage: "url('/images/fundo_distribuidora_barreiro_corrigido3.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Gradiente escuro sutil no topo para legibilidade */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.30)' }} />

      {/* Hero */}
      <div className="relative">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 pt-14 sm:pt-20 pb-14 sm:pb-20">
          <div className="inline-flex items-center gap-2 border border-white/30 bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-mono tracking-widest text-white uppercase mb-5 shadow-sm rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Plataforma Interna de Gestão & Operação
          </div>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight drop-shadow-lg">
            SISTEMA DE GESTÃO DE <span className="text-white/50 font-light"></span> <span className="whitespace-nowrap text-white font-extrabold">CADASTRO DE TERCEIROS</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-white/90 drop-shadow">
            Uma plataforma integrada para organizar e acompanhar as rotinas administrativas e operacionais da Distribuidora Irmãos Barreiro. O sistema reúne, em um só ambiente, o cadastro de colaboradores, controle de diaristas e pagamentos, emissão de recibos, relatórios, controle de EPI´s e segurança do trabalho, oferecendo mais segurança, agilidade e clareza para a equipe.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={goToPortal}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow transition-colors"
            >
              Acessar o sistema
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#modulos"
              className="inline-flex items-center gap-2 border border-white/50 bg-white/20 backdrop-blur-sm hover:bg-white/40 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              Ver módulos
            </a>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="relative border-t border-zinc-200/80" />

      {/* Grid de módulos */}
      <div id="modulos" className="relative scroll-mt-8 mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
        <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl drop-shadow">COMO FUNCIONA</h2>
            <p className="mt-1 text-sm text-white/80">Do cadastro do colaborador ao fechamento financeiro, o sistema acompanha cada etapa da operação.</p>
          </div>
          <span className="font-mono text-[10px] font-semibold text-white/60 uppercase tracking-wider">FLUXO OPERACIONAL</span>
        </div>

        {/* Grid de módulos (3x3 perfeitamente balanceado para os 9 módulos) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(item => (
            <button
              key={item.num}
              onClick={goToPortal}
              className="group flex min-h-[190px] flex-col justify-between border border-white/40 bg-white/70 backdrop-blur-md p-5 text-left shadow-sm transition hover:border-white/60 hover:bg-white/85 hover:shadow-md rounded-xl"
            >
              <div>
                <span className="font-mono text-2xl font-bold text-red-600">{item.num}</span>
                <h3 className="mt-3 text-base font-bold text-zinc-900 group-hover:text-red-600 transition-colors">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-700">{item.desc}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 group-hover:text-red-600 transition-colors">
                <i className="h-px w-4 bg-red-500 shrink-0" />
                {item.action}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>

        {/* Seção Como protegemos os dados */}
        <div className="mt-12 border border-white/40 bg-white/70 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-red-600" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 pb-6 border-b border-zinc-100 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-red-600">
                  SEGURANÇA DA INFORMAÇÃO
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 sm:text-2xl">
                  COMO PROTEGEMOS OS DADOS
                </h3>
                <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-zinc-500">
                  Os dados cadastrais, chaves PIX e documentos dos colaboradores temporários são processados em estrita observância à Lei Geral de Proteção de Dados.
                </p>
              </div>
              <Link
                to="/politica-de-privacidade"
                className="inline-flex items-center justify-center shrink-0 border border-zinc-200 bg-zinc-50 hover:bg-red-50 hover:border-red-200 hover:text-red-600 px-4 py-2.5 text-xs font-semibold text-zinc-700 transition rounded-xl"
              >
                Ver política de privacidade
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-3">
              <div>
                <span className="font-mono text-xs font-bold text-red-600">01</span>
                <h4 className="mt-1.5 text-sm font-bold text-zinc-900">Chaves PIX protegidas</h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Informações financeiras armazenadas com acesso restrito à equipe autorizada.
                </p>
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-red-600">02</span>
                <h4 className="mt-1.5 text-sm font-bold text-zinc-900">Documentos com acesso restrito</h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Fichas cadastrais e comprovantes disponíveis apenas para RH e administração.
                </p>
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-red-600">03</span>
                <h4 className="mt-1.5 text-sm font-bold text-zinc-900">Conformidade legal</h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Processos alinhados à Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
