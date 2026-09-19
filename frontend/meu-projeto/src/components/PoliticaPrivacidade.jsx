import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ArrowLeft, Lock, FileText, UserCheck,
  Scale, Mail, Building2, CheckCircle2, Globe, RefreshCw, Clock,
} from 'lucide-react';
import Logo from './Logo';
import Footer from './Footer';

const Item = ({ children }) => (
  <li className="flex items-start gap-2.5">
    <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
    <span>{children}</span>
  </li>
);

const Section = ({ icon: Icon, title, children }) => (
  <section className="bg-zinc-900/60 rounded-2xl p-6 sm:p-8 border border-zinc-800/80 space-y-4">
    <div className="flex items-center gap-2.5 text-white font-bold text-lg">
      <Icon className="w-5 h-5 text-red-500" />
      <h2>{title}</h2>
    </div>
    {children}
  </section>
);

export default function PoliticaPrivacidade() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 antialiased selection:bg-red-600 selection:text-white flex flex-col justify-between">
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" aria-label="Voltar à página inicial">
            <Logo isDark={true} className="h-10 sm:h-12" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 hover:border-red-500/50 transition-all duration-200">
            <ArrowLeft className="w-4 h-4 text-red-500" />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10 flex-grow">
        <div className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/60 border border-red-800/50 text-red-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-red-500" />
            <span>Lei Geral de Proteção de Dados — Lei nº 13.709/2018</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">Política de Privacidade</h1>
          <p className="text-xs sm:text-sm font-semibold text-red-400">Versão 1.0, vigente desde 19 de setembro de 2026.</p>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
            Esta política explica como a <strong className="text-zinc-200">Distribuidora Irmãos Barreiro de Bebidas</strong> trata dados pessoais no uso deste sistema interno. Ela foi elaborada para dar transparência às operações realizadas no sistema e não substitui contratos, documentos trabalhistas ou comunicações específicas aplicáveis a cada relação.
          </p>
        </div>

        <div className="space-y-8 text-zinc-300 text-sm sm:text-base leading-relaxed">
          <Section icon={Building2} title="1. Quem é responsável pelo tratamento">
            <p>
              A <strong>Distribuidora Irmãos Barreiro de Bebidas</strong>, inscrita no CNPJ nº <strong>01.688.096/0001-95</strong>, com sede na Rua João Damasceno Fontenele, nº 5003, Distrito Industrial, Cascavel/CE, CEP 62850-000, é a controladora dos dados pessoais tratados neste sistema: isto é, quem decide as finalidades e os meios do tratamento.
            </p>
            <p>Para assuntos de privacidade e para exercer direitos previstos na LGPD, utilize o canal informado na seção 10.</p>
          </Section>

          <Section icon={FileText} title="2. Dados tratados e como são obtidos">
            <p>Tratamos dados fornecidos por usuários autorizados, colaboradores, prestadores e representantes de parceiros durante cadastros, atualizações e rotinas operacionais. Conforme o módulo utilizado, isso pode incluir:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span><strong>Identificação e contato:</strong> nome, CPF, RG, data de nascimento, e-mail, telefone e endereço.</span></li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span><strong>Dados profissionais e operacionais:</strong> cargo, função, setor, unidade, registros de atividades, entregas de EPI e permissões de trabalho.</span></li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span><strong>Dados financeiros:</strong> banco, agência, conta, tipo e chave PIX, além de informações necessárias a pagamentos e recibos.</span></li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span><strong>Documentos e dados de parceiros:</strong> arquivos enviados (como documentos de identificação, comprovantes e documentos empresariais), CNPJ e dados de contato de representantes.</span></li>
              <li className="flex items-start gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60 text-xs sm:text-sm"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span><strong>Dados de acesso e uso:</strong> usuário, endereço IP, data e hora de acesso e registros de ações realizadas no sistema (logs).</span></li>
            </ul>
            <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">Não solicite nem envie dados pessoais além do necessário para a finalidade do cadastro ou do documento. Dados pessoais sensíveis, se eventualmente constarem em documentos ou formulários, recebem tratamento restrito à finalidade legítima e à hipótese legal aplicável.</p>
          </Section>

          <Section icon={Scale} title="3. Finalidades e bases legais">
            <p>Os dados são utilizados somente para finalidades compatíveis com a operação do sistema, especialmente:</p>
            <ul className="space-y-3 pl-1">
              <Item><strong className="text-zinc-100">Cadastro, gestão da relação profissional ou comercial e pagamentos:</strong> identificação, organização de dados cadastrais, controle de atividades e viabilização de pagamentos. Base legal: execução de contrato ou de procedimentos preliminares relacionados a contrato (art. 7º, V, da LGPD).</Item>
              <Item><strong className="text-zinc-100">Obrigações legais, regulatórias, trabalhistas, previdenciárias e fiscais:</strong> manutenção de registros, recibos e documentos exigidos. Base legal: cumprimento de obrigação legal ou regulatória (art. 7º, II).</Item>
              <Item><strong className="text-zinc-100">Segurança, administração e defesa de direitos:</strong> controle de acesso ao sistema, registro de acessos (logs), prevenção a fraudes e preservação de evidências necessárias. Base legal: legítimo interesse, quando cabível (art. 7º, IX), e exercício regular de direitos (art. 7º, VI).</Item>
              <Item><strong className="text-zinc-100">Tratamentos opcionais:</strong> quando o consentimento for a base apropriada, ele será solicitado de forma específica, destacada e para finalidade determinada. A recusa ou revogação não afeta os tratamentos necessários por contrato, obrigação legal ou outra base legal aplicável.</Item>
            </ul>
          </Section>

          <Section icon={UserCheck} title="4. Acesso e compartilhamento">
            <p>O acesso é limitado a usuários autorizados e a áreas que precisam dos dados para executar suas atribuições. Não vendemos, alugamos ou utilizamos dados pessoais para publicidade comportamental.</p>
            <p>Podemos compartilhar o mínimo necessário com instituições financeiras para pagamentos; contabilidade, assessoria jurídica e prestadores contratados; autoridades públicas, quando houver dever legal ou ordem válida; e provedores de tecnologia que hospedam ou dão suporte ao sistema. Esses terceiros devem tratar os dados conforme instruções, finalidade aplicável e obrigações de segurança e confidencialidade.</p>
          </Section>

          <Section icon={Globe} title="5. Hospedagem e transferência internacional">
            <p>O sistema utiliza serviços de hospedagem e infraestrutura em nuvem. Dependendo da configuração contratada e da localização da infraestrutura dos fornecedores, dados poderão ser processados fora do Brasil.</p>
            <p>Nessas situações, a transferência internacional somente será realizada nas hipóteses permitidas pela LGPD e pela regulamentação da ANPD, com as salvaguardas aplicáveis — por exemplo, cláusulas contratuais-padrão ou outro mecanismo válido previsto no art. 33 da LGPD. A empresa revisará seus fornecedores e salvaguardas sempre que houver alteração relevante na infraestrutura.</p>
          </Section>

          <Section icon={Lock} title="6. Segurança da informação">
            <p>Adotamos medidas técnicas e administrativas proporcionais aos riscos do tratamento, incluindo autenticação de usuários, controles de acesso, proteção de sessões, validação de arquivos enviados e criptografia de documentos armazenados pelo sistema. Senhas não são mantidas em formato legível.</p>
            <p>Embora nenhuma plataforma possa garantir segurança absoluta, mantemos medidas de prevenção e resposta a incidentes. Caso ocorra incidente que possa acarretar risco ou dano relevante aos titulares, serão adotadas as medidas e comunicações exigidas pela LGPD e pela ANPD.</p>
          </Section>

          <Section icon={FileText} title="7. Cookies, sessão e armazenamento no navegador">
            <p>O sistema usa recursos estritamente necessários para autenticar usuários, manter a sessão e preservar o funcionamento da aplicação. Isso pode incluir cookie de sessão e armazenamento temporário no navegador (<em>sessionStorage</em>), que é removido ao encerrar a sessão ou fechar a aba, conforme o navegador.</p>
            <p>Este sistema não utiliza cookies de publicidade nem ferramentas de análise comportamental identificadas nesta versão. Se recursos não essenciais forem implementados, esta política e os mecanismos de escolha aplicáveis serão atualizados antes de seu uso.</p>
          </Section>

          <Section icon={Clock} title="8. Retenção e eliminação">
            <p>Mantemos os dados apenas pelo tempo necessário para cumprir as finalidades desta política, manter o vínculo profissional ou comercial, atender obrigações legais e resguardar direitos. Como referência:</p>
            <ul className="space-y-2 pl-1">
              <Item><strong className="text-zinc-100">Registros de acesso à aplicação (logs):</strong> no mínimo 6 meses, conforme o art. 15 do Marco Civil da Internet, quando aplicável.</Item>
              <Item><strong className="text-zinc-100">Documentos fiscais e contábeis:</strong> pelo prazo legal aplicável, em regra por 5 anos.</Item>
              <Item><strong className="text-zinc-100">Registros trabalhistas, previdenciários e de saúde e segurança do trabalho:</strong> pelos prazos exigidos na legislação e normas regulamentadoras aplicáveis.</Item>
              <Item><strong className="text-zinc-100">Dados cadastrais de parceiros:</strong> enquanto durar a relação comercial e pelo prazo legal posterior.</Item>
            </ul>
            <p>Ao final do prazo aplicável, os dados serão eliminados ou anonimizados de forma segura, salvo se a conservação for autorizada ou exigida pelo art. 16 da LGPD, como para cumprimento de obrigação legal, exercício regular de direitos ou transferência a terceiro permitida pela lei.</p>
          </Section>

          <Section icon={ShieldCheck} title="9. Direitos do titular">
            <p>Nos termos da LGPD, o titular pode solicitar, conforme aplicável, confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados irregularmente, portabilidade, informações sobre compartilhamentos, revogação do consentimento e revisão de decisões automatizadas, quando houver. Também pode se opor a tratamentos realizados com fundamento em hipóteses diferentes do consentimento, quando houver descumprimento da LGPD, e ser informado sobre a possibilidade de não fornecer consentimento e as consequências da negativa.</p>
            <p>As solicitações são gratuitas e serão avaliadas após confirmação razoável da identidade do solicitante, para evitar o acesso indevido a dados de terceiros. A confirmação simplificada será fornecida imediatamente ou por meio de declaração clara e completa no prazo legal de até 15 dias, nos termos do art. 19 da LGPD, ressalvadas as hipóteses legais de conservação e as regras aplicáveis.</p>
            <p>O titular também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD), sem prejuízo de buscar outros meios administrativos ou judiciais.</p>
          </Section>

          <Section icon={Mail} title="10. Canal de privacidade">
            <p>Para dúvidas, solicitações ou exercício dos direitos de titular, entre em contato pelo canal de privacidade. Ao enviar sua solicitação, informe seu nome, um meio de contato e a descrição do pedido. Podemos pedir confirmação razoável de identidade e responderemos nos prazos da seção 9.</p>
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
              <div><span className="text-xs text-zinc-400 font-semibold block">E-mail de Privacidade e LGPD</span><a href="mailto:suporte@irmaosbarreiro.com" className="text-white font-bold text-sm sm:text-base hover:text-red-400 transition">suporte@irmaosbarreiro.com</a></div>
              <div className="text-xs text-zinc-400">Cascavel/CE • Distrito Industrial</div>
            </div>
          </Section>

          <Section icon={RefreshCw} title="11. Atualizações desta política">
            <p>Esta política poderá ser atualizada para refletir mudanças nas práticas de tratamento, no sistema ou na legislação. Quando a alteração for relevante, adotaremos meios adequados para destacá-la. Recomendamos a consulta periódica desta página.</p>
            <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3"><strong className="text-zinc-300">Versão 1.0, vigente desde:</strong> 19 de setembro de 2026.</p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
