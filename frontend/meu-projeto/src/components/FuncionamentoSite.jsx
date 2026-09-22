import React from 'react';
import { Link } from 'react-router-dom';
import { Workflow, ShieldCheck, LogIn, ClipboardList, FileCheck, FileText, FlaskConical } from 'lucide-react';

export default function FuncionamentoSite() {
  const cards = [
    {
      num: '01',
      icon: LogIn,
      title: 'Acesso e Autenticação Segura',
      text: 'Login via e-mail e senha protegidos por criptografia, com consentimento explícito do colaborador.'
    },
    {
      num: '02',
      icon: ClipboardList,
      title: 'Preenchimento Guiado',
      text: 'Formulário em etapas: dados pessoais, endereço com CEP automático, dados bancários e profissionais.'
    },
    {
      num: '03',
      icon: FileCheck,
      title: 'Aceite de Privacidade',
      text: 'Visualização e aceite dos Termos de Privacidade antes de avançar.',
      link: true
    },
    {
      num: '04',
      icon: FileText,
      title: 'Emissão do Recibo em PDF',
      text: 'Geração automática do Comprovante Cadastral com protocolo exclusivo e carimbo digital corporativo.'
    },
    {
      num: '05',
      icon: ShieldCheck,
      title: 'Controle de EPIs (NR-6)',
      text: 'Gestão de estoque mínimo, Certificados de Aprovação, importação de planilha e ficha NR-6 em PDF.'
    },
    {
      num: '06',
      icon: FlaskConical,
      title: 'Exame Toxicológico',
      text: 'Relação de motoristas com datas de exame e vencimento, alertas automáticos por e-mail 10 dias antes e exportação em PDF.'
    }
  ];

  return (
    <section id="funcionamento" className="py-8 sm:py-10 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Cabeçalho compacto */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 mb-1.5">
              <Workflow className="w-3 h-3 text-red-600" />
              <span>Guia & Sistema Operacional</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Funcionamento do Site
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-10 h-0.5 bg-red-600 rounded-full"></div>
            <div className="w-2.5 h-0.5 bg-slate-300 rounded-full"></div>
          </div>
        </div>

        {/* Linha do tempo horizontal — 4 passos em 1 linha */}
        <div className="relative">
          {/* Linha conectora (visível em desktop) */}
          <div className="hidden lg:block absolute top-7 left-0 right-0 h-px bg-slate-200 z-0" style={{ left: '3.5rem', right: '3.5rem' }}></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, idx) => {
              const IconComponent = card.icon;
              return (
                <div
                  key={idx}
                  className="relative bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-2xs hover:shadow-sm hover:border-red-200 transition-all duration-150 group flex flex-col gap-3 z-10"
                >
                  {/* Número + Ícone */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 group-hover:border-red-200 group-hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors">
                      <IconComponent className="w-4 h-4 text-slate-400 group-hover:text-red-600 transition-colors" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 group-hover:text-red-500 transition-colors">
                      Etapa {card.num}
                    </span>
                  </div>

                  {/* Título */}
                  <h3 className="text-sm font-bold text-[#0F172A] leading-snug group-hover:text-red-600 transition-colors">
                    {card.title}
                  </h3>

                  {/* Texto (máximo 2 linhas de conteúdo) */}
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {card.text}
                  </p>

                  {/* Link LGPD (apenas etapa 03) */}
                  {card.link && (
                    <Link
                      to="/politica-de-privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 underline underline-offset-2 transition-colors"
                    >
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span>Ler a Política de Privacidade</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
