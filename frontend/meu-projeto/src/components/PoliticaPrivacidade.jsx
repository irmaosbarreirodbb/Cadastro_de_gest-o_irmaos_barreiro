import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ArrowLeft, Lock, FileText, UserCheck,
  Scale, Mail, Building2, CheckCircle2, Globe, RefreshCw, Clock
} from 'lucide-react';
import Logo from './Logo';
import Footer from './Footer';

export default function PoliticaPrivacidade() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 antialiased selection:bg-red-600 selection:text-white flex flex-col justify-between">
      {/* Header superior */}
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Logo isDark={true} className="h-10 sm:h-12" />
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 hover:border-red-500/50 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4 text-red-500" />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </header>

      {/* Conteúdo da Política */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10 flex-grow">
        {/* Cabeçalho */}
        <div className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/60 border border-red-800/50 text-red-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-red-500" />
            <span>Conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Política de Privacidade &amp; Proteção de Dados
          </h1>

          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
            A <strong className="text-zinc-200">Distribuidora Irmãos Barreiro de Bebidas</strong> preza pela transparência, privacidade e proteção dos dados pessoais de colaboradores, parceiros e usuários. Este documento descreve de forma clara como coletamos, utilizamos, armazenamos e protegemos suas informações, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais – LGPD).
          </p>
        </div>

        {/* Seções da Política */}
        <div className="space-y-8 text-zinc-300 text-sm sm:text-base leading-relaxed">

          {/* 1. Controlador */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Building2 className="w-5 h-5 text-red-500" />
              <h2>1. Controlador dos Dados</h2>
            </div>
            <p>
              O controlador responsável pelo tratamento dos seus dados pessoais é a <strong>Distribuidora Irmãos Barreiro de Bebidas</strong>, com sede na Rua João Damasceno Fontenele, nº 5003, Distrito Industrial, Cascavel - CE, CEP 62850-000.
            </p>
          </section>

          {/* 2. Dados Coletados */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <FileText className="w-5 h-5 text-red-500" />
              <h2>2. Quais Dados Pessoais São Coletados</h2>
            </div>
            <p>
              Para a finalidade exclusiva de cadastro, identificação, validação e gestão operacional e de pagamentos, coletamos os seguintes dados:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Identificação Pessoal:</strong> Nome completo, CPF, e-mail e senha (armazenada por meio de função de hash criptográfico, sem possibilidade de reversão).</span>
              </li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Endereço Residencial:</strong> Logradouro, número, bairro, CEP e cidade.</span>
              </li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Dados Bancários / PIX:</strong> Chave PIX, banco, agência e conta para pagamentos.</span>
              </li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Informações Profissionais:</strong> Cargo, setor e unidade de atuação regional.</span>
              </li>
            </ul>
          </section>

          {/* 3. Finalidade e Base Legal */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Scale className="w-5 h-5 text-red-500" />
              <h2>3. Finalidade e Base Legal do Tratamento</h2>
            </div>
            <p>
              Cada dado pessoal é tratado com base na hipótese legal especificamente aplicável à sua finalidade, nos termos do art. 7º da LGPD, evitando a sobreposição de bases legais para uma mesma operação de tratamento:
            </p>
            <ul className="space-y-3 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Execução de Contrato ou Procedimentos Preliminares (Art. 7º, V):</strong> dados de identificação, endereço e dados bancários/PIX utilizados para formalização do cadastro de colaboradores e prestadores e viabilização de pagamentos.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Cumprimento de Obrigação Legal e Regulatória (Art. 7º, II):</strong> dados utilizados para emissão de recibos oficiais em PDF e registros fiscais, contábeis e trabalhistas exigidos pela legislação aplicável.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Consentimento do Titular (Art. 7º, I):</strong> utilizado exclusivamente para tratamentos que não decorram de obrigação contratual ou legal, tais como comunicações institucionais não essenciais, pesquisas de satisfação ou uso de imagem, quando aplicável. O consentimento é coletado de forma livre, informada e inequívoca, podendo ser revogado a qualquer momento (ver Seção 8).</span>
              </li>
            </ul>
            <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">
              Observação: dados tratados com base em execução de contrato ou obrigação legal não dependem de consentimento do titular para esse fim específico.
            </p>
          </section>

          {/* 4. Compartilhamento */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <UserCheck className="w-5 h-5 text-red-500" />
              <h2>4. Quem Tem Acesso aos Dados (Compartilhamento)</h2>
            </div>
            <p>
              O acesso aos dados pessoais é estritamente restrito aos setores internos autorizados (Recursos Humanos, Departamento Financeiro e Jurídico) da Distribuidora Irmãos Barreiro, sob controle de privilégios de acesso. <strong>Não comercializamos, alugamos nem repassamos dados a terceiros não autorizados.</strong> O compartilhamento ocorre unicamente com:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Instituições bancárias e processadoras de pagamento:</strong> dados bancários/PIX, exclusivamente para liquidação e processamento de pagamentos.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Órgãos públicos e autoridades reguladoras</strong> (ex.: Receita Federal, eSocial, Justiça do Trabalho, ANPD): dados fiscais e trabalhistas, exclusivamente quando exigido por lei ou determinação legal.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Prestadores de serviços de tecnologia</strong> contratados para hospedagem e processamento de dados, sob obrigações contratuais de confidencialidade e segurança da informação.</span>
              </li>
            </ul>
          </section>

          {/* 5. Transferência Internacional */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Globe className="w-5 h-5 text-red-500" />
              <h2>5. Transferência Internacional de Dados</h2>
            </div>
            <p>
              Os dados pessoais coletados são armazenados e processados por meio da plataforma Railway, que utiliza infraestrutura de nuvem da Amazon Web Services (AWS) localizada nos Estados Unidos da América. Essa transferência internacional de dados é realizada com amparo em uma das hipóteses do art. 33 da LGPD, mediante a adoção de salvaguardas contratuais reconhecidas — como Cláusulas Contratuais Padrão (Standard Contractual Clauses) e demais garantias de proteção previstas nos respectivos Acordos de Processamento de Dados (Data Processing Addendum) firmados com a Railway e, indiretamente, com a AWS — de modo a assegurar às informações pessoais transferidas nível de proteção compatível com o exigido pela legislação brasileira.
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Operadora contratada (processamento e hospedagem):</strong> Railway.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Subprocessadora de infraestrutura (utilizada pela Railway):</strong> Amazon Web Services (AWS), com servidores localizados nos Estados Unidos.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Base legal para a transferência internacional:</strong> art. 33, II, da LGPD (garantias contratuais de proteção de dados), observadas as cláusulas contratuais e certificações de conformidade oferecidas pela Railway e pela AWS.</span>
              </li>
            </ul>

          </section>

          {/* 6. Segurança */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Lock className="w-5 h-5 text-red-500" />
              <h2>6. Segurança e Proteção das Informações</h2>
            </div>
            <p>
              Adotamos medidas técnicas e organizacionais de segurança da informação, incluindo armazenamento de senhas por meio de função de hash criptográfico, conexões seguras SSL/HTTPS (256-bit), controle rígido de privilégios de acesso e validação instantânea de integridade cadastral. Nossa infraestrutura de hospedagem e processamento de dados é fornecida pela plataforma Railway, que opera sobre servidores da Amazon Web Services (AWS) nos Estados Unidos, provedora que mantém certificações internacionais de segurança da informação (como <strong className="text-zinc-100">ISO 27001 e SOC 2</strong>) e controles físicos e lógicos de proteção de dados em seus data centers.
            </p>
          </section>

          {/* 7. Prazo de Armazenamento */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Clock className="w-5 h-5 text-red-500" />
              <h2>7. Prazo de Armazenamento dos Dados</h2>
            </div>
            <p>
              Os dados pessoais serão conservados durante todo o período em que o cadastro e o vínculo profissional/comercial estiverem ativos. Após o encerramento do vínculo, os dados serão conservados pelos seguintes prazos legais mínimos, conforme a finalidade:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Dados trabalhistas e previdenciários:</strong> pelo prazo aplicável à guarda de documentos trabalhistas e ao recolhimento de FGTS, conforme legislação vigente.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Documentos fiscais e contábeis:</strong> até 5 (cinco) anos, conforme prazo decadencial/prescricional do Código Tributário Nacional.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-100">Dados tratados com base em consentimento:</strong> até a revogação do consentimento pelo titular, ressalvada a manutenção de registros exigidos por obrigação legal.</span>
              </li>
            </ul>
            <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">
              Encerrados os prazos legais aplicáveis, os dados serão eliminados ou anonimizados, salvo quando a conservação for necessária para o cumprimento de obrigação legal ou regulatória, para estudo por órgão de pesquisa, ou para exercício regular de direitos em processo judicial, administrativo ou arbitral (art. 16 da LGPD).
            </p>
          </section>

          {/* 8. Direitos do Titular */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <ShieldCheck className="w-5 h-5 text-red-500" />
              <h2>8. Direitos do Titular (Você)</h2>
            </div>
            <p>
              Conforme o artigo 18 da LGPD, você possui o direito de, a qualquer momento e mediante requisição ao nosso Encarregado (DPO):
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Confirmar a existência de tratamento de dados e acessar seus dados pessoais;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Solicitar a correção de dados incompletos, inexatos ou desatualizados;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Requerer a anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Solicitar a portabilidade dos seus dados a outro fornecedor de produto ou serviço, mediante requisição expressa;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Solicitar a eliminação dos dados pessoais tratados com base no seu consentimento, ressalvadas as hipóteses de conservação previstas em lei;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Obter informação sobre as entidades públicas e privadas com as quais compartilhamos seus dados;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Ser informado sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>Revogar o consentimento previamente fornecido, a qualquer momento, mediante manifestação expressa.</span>
              </li>
            </ul>
            <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">
              Responderemos às solicitações relacionadas ao exercício desses direitos em até <strong className="text-zinc-400">15 (quinze) dias úteis</strong>, contados do recebimento da requisição, podendo esse prazo ser prorrogado mediante justificativa expressa, observados os limites da LGPD.
            </p>
          </section>

          {/* 9. Canal de Contato DPO */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <Mail className="w-5 h-5 text-red-500" />
              <h2>9. Canal de Contato do Encarregado (DPO)</h2>
            </div>
            <p>
              Para exercer qualquer um dos seus direitos de titular ou tirar dúvidas sobre o tratamento de seus dados pessoais, entre em contato diretamente com o nosso Encarregado pelo tratamento de dados pessoais (DPO):
            </p>
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
              <div>
                <span className="text-xs text-zinc-400 font-semibold block">E-mail para Privacidade &amp; LGPD:</span>
                <span className="text-white font-bold text-sm sm:text-base">suporte@irmaosbarreiro.com</span>
              </div>
              <div className="text-xs text-zinc-400">
                Sede: Cascavel - CE • Distrito Industrial
              </div>
            </div>
          </section>

          {/* 10. Alterações à Política */}
          <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-bold text-lg">
              <RefreshCw className="w-5 h-5 text-red-500" />
              <h2>10. Alterações a Esta Política</h2>
            </div>
            <p>
              Esta Política de Privacidade poderá ser atualizada periodicamente para refletir mudanças em nossas práticas de tratamento de dados ou na legislação aplicável. Recomendamos a consulta periódica deste documento. A data da última atualização consta ao final deste documento.
            </p>
          </section>

        </div>


      </main>

      {/* Rodapé Corporativo */}
      <Footer />
    </div>
  );
}
