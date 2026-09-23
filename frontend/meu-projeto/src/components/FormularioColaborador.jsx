import React, { useEffect, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { baixarDocumentoColaboradorApi, baixarDocumentoPessoaJuridicaApi, createColaboradorApi, createPessoaJuridicaApi, getDocumentosColaboradorApi, getDocumentosPessoaJuridicaApi } from '../services/api';
import DocumentosPessoaFisica from './DocumentosPessoaFisica';
import DocumentosPessoaJuridica from './DocumentosPessoaJuridica';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import {
  User,
  MapPin,
  CreditCard,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Printer,
  RotateCcw,
  ShieldCheck,
  Building2,
  AlertCircle,
  Clock,
  QrCode,
  FileCheck,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

// Funções de validação
function isValidCPF(cpf) {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

function isValidCNPJ(cnpj) {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let length = clean.length - 2;
  let numbers = clean.substring(0, length);
  const digits = clean.substring(length);
  let sum = 0;
  let pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  length = length + 1;
  numbers = clean.substring(0, length);
  sum = 0;
  pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
}

export default function FormularioColaborador({ userEmail = '', onLogout, onBack }) {
  const chaveRascunho = `barreiros:cadastro-colaborador:${userEmail.trim().toLowerCase() || 'visitante'}`;
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [colaboradorId, setColaboradorId] = useState('');
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);
  const pdfRef = useRef(null);
  const logoPdfRef = useRef(null);

  // Form State com suporte a Pessoa Física e Pessoa Jurídica (Corporativo)
  const [formData, setFormData] = useState({
    tipoPessoa: 'fisica', // 'fisica' | 'juridica'

    // Etapa 1: Dados Pessoais (Pessoa Física)
    nome: '',
    cpf: '',
    email: userEmail || '',
    telefone: '',
    dataNascimento: '',
    rg: '',

    // Etapa 1: Dados Empresariais (Pessoa Jurídica / Alvará de Funcionamento)
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    enderecoPJ: '',
    inscricaoMunicipal: '',
    inscricaoImobiliaria: '',
    inscricaoEstadual: '',
    porte: 'Microempresa (ME EPP)',
    horarioFuncionamento: '07:00 - 17:00',
    socioAdministrador: '',
    categoriaAtuacao: 'Prestação de Serviços',
    regimeTributacao: 'ISENÇÃO',
    tipoAlvara: 'RENOVAÇÃO',
    numeroAlvara: '330/2025',
    validadeAlvara: 'Sexta-feira, 11 de Setembro de 2026',
    dataEmissaoAlvara: 'Quinta-feira, 11 de Setembro de 2025',
    codigoValidacao: 'FA6A094467',
    atividadePrincipal: '',
    atividadeSecundaria: '',
    areaInstalacoes: '12m²',

    // Etapa 2: Endereço
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: 'Cascavel',
    estado: 'CE',

    // Etapa 3: Dados Bancários
    banco: 'Caixa Econômica Federal',
    outroBanco: '',
    tipoConta: 'Conta Corrente',
    agencia: '',
    conta: '',
    tipoPix: 'CPF',
    chavePix: '',

    // Etapa 4: Dados Profissionais
    cargo: 'Motorista Entregador',
    outroCargo: '',
    unidade: 'Distrito Industrial de Cascavel - CE',
    turno: 'Diurno (Comercial / Rota)',
    sede: 'Rua João Damasceno Fontenele, nº 5003 - Cascavel/CE',
    aceitouTermos: true
  });

  // Erros e campos tocados
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [protocolo, setProtocolo] = useState(() => {
    const ano = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `IB-${ano}-${rand}`;
  });

  const [dataEmissao, setDataEmissao] = useState(() => {
    const now = new Date();
    return now.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  });

  // Geração do PDF em formato oficial A4 com html2canvas + jsPDF
  // Mantém o rascunho apenas nesta sessão do navegador. Assim, atualizar a
  // página não apaga o preenchimento e dados pessoais não ficam persistidos
  // indefinidamente no dispositivo.
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(chaveRascunho);
      if (salvo) {
        const rascunho = JSON.parse(salvo);
        if (rascunho.formData && typeof rascunho.formData === 'object') {
          setFormData((atual) => ({ ...atual, ...rascunho.formData }));
        }
        setCurrentStep(Number.isInteger(rascunho.currentStep) ? rascunho.currentStep : 1);
        setMaxStepReached(Number.isInteger(rascunho.maxStepReached) ? rascunho.maxStepReached : 1);
        setIsCompleted(Boolean(rascunho.isCompleted));
        setColaboradorId(rascunho.colaboradorId || '');
        if (rascunho.protocolo) setProtocolo(rascunho.protocolo);
        if (rascunho.dataEmissao) setDataEmissao(rascunho.dataEmissao);
      }
    } catch (erro) {
      console.warn('Não foi possível restaurar o rascunho do cadastro:', erro);
    } finally {
      setRascunhoCarregado(true);
    }
  }, [chaveRascunho]);

  useEffect(() => {
    if (!rascunhoCarregado) return;
    try {
      sessionStorage.setItem(chaveRascunho, JSON.stringify({
        formData,
        currentStep,
        maxStepReached,
        isCompleted,
        colaboradorId,
        protocolo,
        dataEmissao,
      }));
    } catch (erro) {
      console.warn('Não foi possível salvar o rascunho do cadastro:', erro);
    }
  }, [chaveRascunho, rascunhoCarregado, formData, currentStep, maxStepReached, isCompleted, colaboradorId, protocolo, dataEmissao]);

  async function obterLogoPdf() {
    if (logoPdfRef.current) return logoPdfRef.current;

    logoPdfRef.current = await new Promise((resolve, reject) => {
      const logo = new Image();
      logo.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 860;
        canvas.height = 380;
        const contexto = canvas.getContext('2d');
        contexto.drawImage(logo, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      logo.onerror = () => reject(new Error('Não foi possível carregar o logotipo corporativo.'));
      logo.src = '/brand/logo-irmaos-barreiro.png';
    });
    return logoPdfRef.current;
  }

  async function adicionarImagemComoLauda(pdf, imagem, larguraImagem, alturaImagem, formato = 'JPEG', anexo = {}) {
    const paginaAtual = anexo.paginaAtual || 1;
    const totalPaginas = anexo.totalPaginas || 1;
    const titulo = anexo.titulo || 'Documento anexado';
    const nomeArquivo = anexo.nomeArquivo || 'Arquivo digitalizado';
    const protocoloDocumento = protocolo || 'Em processamento';
    const areaDocumento = { x: 16, y: 49, largura: 178, altura: 218 };
    const escala = Math.min(
      areaDocumento.largura / larguraImagem,
      areaDocumento.altura / alturaImagem,
    );
    const largura = larguraImagem * escala;
    const altura = alturaImagem * escala;
    const posicaoX = areaDocumento.x + (areaDocumento.largura - largura) / 2;
    const posicaoY = areaDocumento.y + (areaDocumento.altura - altura) / 2;

    const logoPdf = await obterLogoPdf();
    pdf.addPage();
    pdf.setFillColor(220, 38, 38);
    // Logo oficial LIG com a faixa "IRMÃOS BARREIRO" preservando a proporção.
    pdf.addImage(logoPdf, 'PNG', 18, 11, 31, 13.7);
    pdf.setTextColor(24, 24, 27);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('DISTRIBUIDORA IRMÃOS BARREIRO DE BEBIDAS', 55, 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(82, 82, 91);
    pdf.text('Anexo do Comprovante Oficial de Cadastro', 55, 23);
    pdf.text('Sede: Distrito Industrial, Cascavel - CE', 55, 29);
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(164, 10, 32, 20, 2, 2, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(5.8);
    pdf.setTextColor(161, 161, 170);
    pdf.text('PROTOCOLO OFICIAL', 180, 15, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setTextColor(220, 38, 38);
    pdf.text(protocoloDocumento, 180, 20, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.4);
    pdf.setTextColor(113, 113, 122);
    pdf.text(`Emissão: ${dataEmissao}`, 180, 25, { align: 'center' });
    pdf.setDrawColor(220, 38, 38);
    pdf.setLineWidth(0.5);
    pdf.line(10, 39, 200, 39);

    pdf.setTextColor(24, 24, 27);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(titulo.toUpperCase(), 16, 45);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(82, 82, 91);
    pdf.text(`Arquivo: ${nomeArquivo}`, 16, 272);
    pdf.text(`Página digitalizada ${paginaAtual} de ${totalPaginas}`, 194, 272, { align: 'right' });

    pdf.setDrawColor(212, 212, 216);
    pdf.setLineWidth(0.35);
    pdf.roundedRect(14, 47, 182, 222, 1.5, 1.5, 'S');
    pdf.addImage(imagem, formato, posicaoX, posicaoY, largura, altura, undefined, 'FAST');

    pdf.setDrawColor(228, 228, 231);
    pdf.line(10, 281, 200, 281);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(113, 113, 122);
    pdf.text('Distribuidora Irmãos Barreiro de Bebidas • Documento Oficial', 10, 286);
    pdf.text('Anexo digitalizado vinculado ao cadastro', 200, 286, { align: 'right' });
  }

  function lerImagem(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const imagem = new Image();
      imagem.onload = () => resolve({ url, largura: imagem.naturalWidth, altura: imagem.naturalHeight, formato: blob.type === 'image/png' ? 'PNG' : 'JPEG' });
      imagem.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem invalida')); };
      imagem.src = url;
    });
  }

  async function adicionarDocumentosAnexados(pdf) {
    if (!colaboradorId) return;
    const ordem = ['ficha_assinada', 'identidade', 'comprovante_residencia', 'comprovante_bancario'];
    const pessoaJuridica = formData.tipoPessoa === 'juridica';
    const documentos = pessoaJuridica
      ? await getDocumentosPessoaJuridicaApi(colaboradorId)
      : await getDocumentosColaboradorApi(colaboradorId);
    documentos.sort((a, b) => pessoaJuridica
      ? a.posicao - b.posicao
      : ordem.indexOf(a.tipo_documento) - ordem.indexOf(b.tipo_documento));
    const titulos = {
      ficha_assinada: 'CPF',
      identidade: 'Documento de identidade',
      comprovante_residencia: 'Comprovante de residência',
      comprovante_bancario: 'Outro documento',
    };
    for (const documento of documentos) {
      try {
        const arquivo = pessoaJuridica
          ? await baixarDocumentoPessoaJuridicaApi(colaboradorId, documento.id)
          : await baixarDocumentoColaboradorApi(colaboradorId, documento.id);
        const nomeArquivo = documento.nome_arquivo || '';
        const tipoArquivo = (documento.content_type || arquivo.type || '').toLowerCase();
        const ehPdf = tipoArquivo.includes('pdf') || nomeArquivo.toLowerCase().endsWith('.pdf');

        if (ehPdf) {
          // Uint8Array evita que o PDF.js transfira/invalide o ArrayBuffer do
          // arquivo em alguns navegadores durante a renderização do anexo.
          const dadosPdf = new Uint8Array(await arquivo.arrayBuffer());
          const tarefaPdf = getDocument({
            data: dadosPdf,
            disableAutoFetch: true,
            disableStream: true,
            isEvalSupported: false,
          });
          const pdfAnexado = await tarefaPdf.promise;
          for (let paginaNumero = 1; paginaNumero <= pdfAnexado.numPages; paginaNumero += 1) {
            const pagina = await pdfAnexado.getPage(paginaNumero);
            const viewport = pagina.getViewport({ scale: 2 });
            const canvasAnexo = document.createElement('canvas');
            canvasAnexo.width = viewport.width;
            canvasAnexo.height = viewport.height;
            await pagina.render({ canvasContext: canvasAnexo.getContext('2d'), viewport }).promise;
            await adicionarImagemComoLauda(pdf, canvasAnexo.toDataURL('image/jpeg', 0.95), canvasAnexo.width, canvasAnexo.height, 'JPEG', {
              titulo: pessoaJuridica ? `DOCUMENTO ${String(documento.posicao).padStart(2, '0')}` : titulos[documento.tipo_documento],
              nomeArquivo,
              paginaAtual: paginaNumero,
              totalPaginas: pdfAnexado.numPages,
            });
          }
          try {
            await pdfAnexado.destroy();
          } catch (erroLimpeza) {
            // A página já foi inserida; uma falha ao encerrar o worker não deve
            // impedir o download do PDF final.
            console.warn('Nao foi possivel encerrar o leitor do PDF anexado:', erroLimpeza);
          }
        } else {
          const imagem = await lerImagem(arquivo);
          await adicionarImagemComoLauda(pdf, imagem.url, imagem.largura, imagem.altura, imagem.formato, {
            titulo: pessoaJuridica ? `DOCUMENTO ${String(documento.posicao).padStart(2, '0')}` : titulos[documento.tipo_documento],
            nomeArquivo,
          });
          URL.revokeObjectURL(imagem.url);
        }
      } catch (erro) {
        console.warn(`Nao foi possivel incluir o anexo ${documento.nome_arquivo}:`, erro);
        const detalhe = erro?.message ? ` Detalhe: ${erro.message}` : '';
        throw new Error(`Nao foi possivel incluir o anexo "${documento.nome_arquivo}" no PDF.${detalhe}`);
      }
    }
  }

  async function handleDownloadPDF() {
    if (!pdfRef.current || isGeneratingPDF) return;
    setIsGeneratingPDF(true);

    try {
      const element = pdfRef.current;

      // Aguarda fontes do navegador
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Captura via html2canvas com renderização em layout A4 padrão de 800px
      if (false) { const canvas = await html2canvas(element, {
        scale: 2.5, // Alta definição (nítido para impressão)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1024,
        onclone: (clonedDoc, clonedEl) => {
          // O html2canvas ainda não reconhece oklch()/color-mix(), usados pelo
          // Tailwind v4. Sobrescrevemos as cores da cópia com valores RGB antes
          // da captura, sem alterar a tela exibida ao usuário.
          const pdfColors = clonedDoc.createElement('style');
          pdfColors.textContent = `
            :root {
              --color-white: #ffffff;
              --color-black: #000000;
              --color-zinc-50: #fafafa; --color-zinc-100: #f4f4f5;
              --color-zinc-200: #e4e4e7; --color-zinc-300: #d4d4d8;
              --color-zinc-400: #a1a1aa; --color-zinc-500: #71717a;
              --color-zinc-600: #52525b; --color-zinc-700: #3f3f46;
              --color-zinc-800: #27272a; --color-zinc-900: #18181b;
              --color-zinc-950: #09090b;
              --color-red-50: #fef2f2; --color-red-100: #fee2e2;
              --color-red-200: #fecaca; --color-red-400: #f87171;
              --color-red-600: #dc2626; --color-red-700: #b91c1c;
              --color-emerald-50: #ecfdf5; --color-emerald-100: #d1fae5;
              --color-emerald-600: #059669; --color-emerald-800: #065f46;
            }
            [data-pdf-root] .bg-zinc-50\\/80 { background-color: #fafafa !important; }
            [data-pdf-root] .border-zinc-200\\/80 { border-color: #e4e4e7 !important; }
            [data-pdf-root] .border-black\\/40 { border-color: #000000 !important; }
            /* Evita que qualquer cor computada em oklch chegue ao html2canvas. */
            [data-pdf-root], [data-pdf-root] * {
              color: #18181b !important;
              background-color: #ffffff !important;
              background-image: none !important;
              border-color: #e4e4e7 !important;
              box-shadow: none !important;
              text-shadow: none !important;
              outline-color: #18181b !important;
            }
            [data-pdf-root] .text-red-600 { color: #dc2626 !important; }
            [data-pdf-root] .text-emerald-800 { color: #065f46 !important; }
            [data-pdf-root] .bg-zinc-50, [data-pdf-root] .bg-zinc-50\\/80 { background-color: #fafafa !important; }
            [data-pdf-root] .border-red-600 { border-color: #dc2626 !important; }
            [data-pdf-root] .border-black { border-color: #000000 !important; }
          `;
          clonedDoc.head.appendChild(pdfColors);

          // Padroniza o elemento para formato de página A4 sem cortes
          clonedEl.style.width = '800px';
          clonedEl.style.maxWidth = '800px';
          clonedEl.style.minWidth = '800px';
          clonedEl.style.margin = '0 auto';
          clonedEl.style.boxShadow = 'none';
          clonedEl.style.borderRadius = '0px';
          clonedEl.style.border = 'none';
          clonedEl.style.padding = '20px 22px';
          // Remove height constraints — deixa o conteúdo determinar a altura natural
          clonedEl.style.height = 'auto';
          clonedEl.style.minHeight = 'unset';
        }
      }); }

      // Diferente do html2canvas, esta biblioteca não tenta interpretar
      // oklch(): o próprio navegador desenha as cores modernas do Tailwind.
      const larguraCaptura = Math.ceil(element.scrollWidth);
      const canvas = await toCanvas(element, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: larguraCaptura,
        style: {
          width: `${larguraCaptura}px`,
          maxWidth: `${larguraCaptura}px`,
          minWidth: `${larguraCaptura}px`,
          boxSizing: 'border-box',
          margin: '0 auto',
          boxShadow: 'none',
          borderRadius: '0px',
          border: 'none',
          padding: '20px 22px',
          height: 'auto',
          minHeight: 'unset',
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210; // A4 largura total em mm
      const pdfHeight = 297; // A4 altura total em mm
      const marginX = 8;
      const marginY = 8;
      const printableWidth = pdfWidth - marginX * 2;   // 194mm
      const printableHeight = pdfHeight - marginY * 2; // 281mm

      // Sempre escala a imagem para caber em 1 página inteira — sem cortes, sem segunda página
      if (false) { // bloco legado PF nunca ativado para PJ
      } else {
        const marginX = 10; // 10mm de margem horizontal
        const marginY = 10; // 10mm de margem vertical
        const printableWidth = pdfWidth - marginX * 2; // 190mm de largura útil
        const printableHeight = (canvas.height * printableWidth) / canvas.width;

        // Se couber em 1 página A4 com margens
        if (printableHeight <= pdfHeight - marginY * 2) {
          pdf.addImage(imgData, 'JPEG', marginX, marginY, printableWidth, printableHeight, undefined, 'FAST');
        } else {
          const maxAvailableHeight = pdfHeight - marginY * 2;
          const scaleFactor = maxAvailableHeight / printableHeight;
          
          // Se ultrapassar levemente, ajusta proporcionalmente para 1 página mantendo perfeita leitura
          if (scaleFactor >= 0.82) {
            const scaledW = printableWidth * scaleFactor;
            const leftM = (pdfWidth - scaledW) / 2;
            pdf.addImage(imgData, 'JPEG', leftM, marginY, scaledW, maxAvailableHeight, undefined, 'FAST');
          } else {
          // Se for extenso, divide em páginas A4 sem cortar texto
          const pageCanvasHeight = (canvas.width * maxAvailableHeight) / printableWidth;
          let currentY = 0;
          let pageNum = 0;

          while (currentY < canvas.height) {
            if (pageNum > 0) pdf.addPage();

            const chunkCanvas = document.createElement('canvas');
            const chunkHeight = Math.min(pageCanvasHeight, canvas.height - currentY);
            chunkCanvas.width = canvas.width;
            chunkCanvas.height = chunkHeight;

            const ctx = chunkCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, chunkCanvas.width, chunkHeight);
              ctx.drawImage(
                canvas,
                0,
                currentY,
                canvas.width,
                chunkHeight,
                0,
                0,
                canvas.width,
                chunkHeight
              );

              const chunkImg = chunkCanvas.toDataURL('image/jpeg', 0.98);
              const renderedHeight = (chunkHeight * printableWidth) / canvas.width;
              pdf.addImage(chunkImg, 'JPEG', marginX, marginY, printableWidth, renderedHeight, undefined, 'FAST');
            }

            currentY += pageCanvasHeight;
            pageNum++;
          }
        }
      }
    }

      await adicionarDocumentosAnexados(pdf);

      const nomeArquivo = `Ficha_Cadastral_${((formData.tipoPessoa === 'juridica' ? formData.razaoSocial : formData.nome) || 'Cadastro').replace(/[^a-zA-Z0-9]/g, '_')}_${protocolo}.pdf`;
      
      // Download direto via Blob padrão
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = nomeArquivo;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Erro detalhado ao gerar PDF:', err);
      window.alert(err.message || 'Nao foi possivel gerar o PDF com os documentos anexados. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  // Helpers de formatação automática
  function formatCPF(val) {
    const v = val.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
    if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`;
  }

  function formatCNPJ(val) {
    const v = val.replace(/\D/g, '').slice(0, 14);
    if (v.length <= 2) return v;
    if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
    if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
    if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`;
  }

  function formatPhone(val) {
    const v = val.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 2) return v;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
  }

  function formatCEP(val) {
    const v = val.replace(/\D/g, '').slice(0, 8);
    if (v.length <= 5) return v;
    return `${v.slice(0, 5)}-${v.slice(5, 8)}`;
  }

  function formatRG(val) {
    return val.replace(/[^a-zA-Z0-9.\-\/\s]/g, '').slice(0, 20);
  }

  function formatAgencia(val) {
    const clean = val.replace(/[^0-9xX]/g, '').toUpperCase().slice(0, 5);
    if (clean.length <= 4) return clean;
    return `${clean.slice(0, 4)}-${clean.slice(4, 5)}`;
  }

  function formatConta(val) {
    const clean = val.replace(/[^0-9xX]/g, '').toUpperCase().slice(0, 13);
    if (clean.length <= 1) return clean;
    return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
  }

  // Validação por campo
  function validateField(field, value) {
    let errorMsg = '';
    if (field === 'cpf') {
      if (!value) {
        errorMsg = 'CPF é obrigatório';
      } else if (!isValidCPF(value)) {
        errorMsg = 'CPF inválido. Verifique os números digitados.';
      }
    }

    if (field === 'razaoSocial') {
      if (!value || !value.trim()) {
        errorMsg = 'Razão Social é obrigatória';
      }
    }

    if (field === 'cnpj') {
      if (!value) {
        errorMsg = 'CNPJ é obrigatório';
      } else if (!isValidCNPJ(value)) {
        errorMsg = 'CNPJ inválido. Verifique os números digitados.';
      }
    }

    if (field === 'rg') {
      if (!value.trim()) {
        errorMsg = 'RG / Órgão Emissor é obrigatório';
      }
    }

    if (field === 'email') {
      if (value && !isValidEmail(value)) {
        errorMsg = 'Por favor, informe um e-mail válido (ex: contato@empresa.com)';
      }
    }

    if (field === 'telefone') {
      if (value && !isValidPhone(value)) {
        errorMsg = 'Informe um telefone com DDD válido (10 ou 11 dígitos)';
      }
    }

    if (field === 'nome') {
      if (!value.trim()) {
        errorMsg = 'Nome completo é obrigatório';
      } else if (value.trim().split(' ').length < 2) {
        errorMsg = 'Informe o nome e sobrenome completo';
      }
    }

    if (field === 'cep') {
      const cleanCep = value.replace(/\D/g, '');
      if (!value) {
        errorMsg = 'CEP é obrigatório';
      } else if (cleanCep.length < 8) {
        errorMsg = 'CEP incompleto (8 dígitos)';
      }
    }

    if (field === 'logradouro' && !value.trim()) {
      errorMsg = 'Rua/Logradouro é obrigatório';
    }

    if (field === 'numero' && !value.trim()) {
      errorMsg = 'Número é obrigatório';
    }

    if (field === 'bairro' && !value.trim()) {
      errorMsg = 'Bairro é obrigatório';
    }

    if (field === 'chavePix' && !value.trim()) {
      errorMsg = 'Chave PIX é obrigatória';
    }

    if (field === 'agencia') {
      if (value.trim() && value.replace(/[^0-9xX]/g, '').length < 2) {
        errorMsg = 'Informe uma agência válida (mínimo 2 dígitos)';
      }
    }

    if (field === 'conta') {
      if (value.trim() && value.replace(/[^0-9xX]/g, '').length < 3) {
        errorMsg = 'Informe a conta completa com dígito';
      }
    }

    if (field === 'outroBanco') {
      if (formData.banco === 'Outro' && !value.trim()) {
        errorMsg = 'Informe o nome da instituição bancária';
      }
    }

    if (field === 'outroCargo') {
      if (formData.cargo === 'Outro' && !value.trim()) {
        errorMsg = 'Informe o nome da sua função ou cargo';
      }
    }

    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    return !errorMsg;
  }

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  }

  // Busca de CEP automática via ViaCEP
  async function handleCepLookup(cepValue) {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      setErrors((prev) => ({ ...prev, cep: '' }));
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (data.erro) {
          setErrors((prev) => ({ ...prev, cep: 'CEP não encontrado na base dos Correios' }));
        } else {
          setFormData((prev) => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            estado: data.uf || prev.estado
          }));
          setErrors((prev) => ({
            ...prev,
            logradouro: '',
            bairro: '',
            cep: ''
          }));
        }
      } catch (err) {
        setErrors((prev) => ({ ...prev, cep: 'Erro ao consultar CEP automaticamente' }));
      } finally {
        setLoadingCep(false);
      }
    }
  }

  function handleChange(field, value) {
    let formatted = value;
    if (field === 'cpf') formatted = formatCPF(value);
    if (field === 'cnpj') formatted = formatCNPJ(value);
    if (field === 'telefone') formatted = formatPhone(value);
    if (field === 'rg') formatted = formatRG(value);
    if (field === 'agencia') formatted = formatAgencia(value);
    if (field === 'conta') formatted = formatConta(value);
    if (field === 'cep') {
      formatted = formatCEP(value);
      handleCepLookup(value);
    }

    setFormData((prev) => {
      const updated = { ...prev, [field]: formatted };
      if (field === 'banco' && formatted !== 'Outro') {
        updated.outroBanco = '';
      }
      if (field === 'cargo' && formatted !== 'Outro') {
        updated.outroCargo = '';
      }
      return updated;
    });

    if (field === 'banco' && formatted !== 'Outro') {
      setErrors((prev) => ({ ...prev, outroBanco: '' }));
    }
    if (field === 'cargo' && formatted !== 'Outro') {
      setErrors((prev) => ({ ...prev, outroCargo: '' }));
    }

    if (touched[field]) {
      validateField(field, formatted);
    }
  }

  function handleTipoPessoaChange(tipo) {
    setCurrentStep(1);
    setMaxStepReached(1);
    setFormData((prev) => ({
      ...prev,
      tipoPessoa: tipo,
      // Se for PJ, sugere chave PIX tipo CNPJ caso esteja em CPF
      tipoPix: tipo === 'juridica' ? 'CNPJ' : (prev.tipoPix === 'CNPJ' ? 'CPF' : prev.tipoPix)
    }));
    // Limpa erros específicos
    setErrors((prev) => ({
      ...prev,
      nome: '',
      cpf: '',
      rg: '',
      razaoSocial: '',
      cnpj: '',
      telefone: ''
    }));
  }

  function validateCurrentStep() {
    let valid = true;
    const newErrors = {};
    const newTouched = { ...touched };

    if (currentStep === 1) {
      if (formData.tipoPessoa === 'fisica') {
        if (!validateField('nome', formData.nome)) {
          newErrors.nome = 'Nome completo é obrigatório';
          valid = false;
        }
        if (!validateField('cpf', formData.cpf)) {
          newErrors.cpf = !formData.cpf ? 'CPF é obrigatório' : 'CPF inválido';
          valid = false;
        }
        if (!validateField('rg', formData.rg)) {
          newErrors.rg = 'RG / Órgão Emissor é obrigatório';
          valid = false;
        }
        if (formData.email && !validateField('email', formData.email)) {
          newErrors.email = 'E-mail inválido';
          valid = false;
        }
        if (formData.telefone && !validateField('telefone', formData.telefone)) {
          newErrors.telefone = 'Telefone com formato incompleto';
          valid = false;
        }
        newTouched.nome = true;
        newTouched.cpf = true;
        newTouched.rg = true;
      } else {
        // Pessoa Jurídica
        if (!validateField('razaoSocial', formData.razaoSocial)) {
          newErrors.razaoSocial = 'Razão Social é obrigatória';
          valid = false;
        }
        if (!validateField('cnpj', formData.cnpj)) {
          newErrors.cnpj = !formData.cnpj ? 'CNPJ é obrigatório' : 'CNPJ inválido';
          valid = false;
        }
        if (formData.telefone && !validateField('telefone', formData.telefone)) {
          newErrors.telefone = 'Telefone corporativo incompleto';
          valid = false;
        }
        if (formData.email && !validateField('email', formData.email)) {
          newErrors.email = 'E-mail corporativo inválido';
          valid = false;
        }
        newTouched.razaoSocial = true;
        newTouched.cnpj = true;
      }
    } else if (currentStep === 2) {
      if (!validateField('cep', formData.cep)) {
        newErrors.cep = 'CEP obrigatório';
        valid = false;
      }
      if (!validateField('logradouro', formData.logradouro)) {
        newErrors.logradouro = 'Rua obrigatória';
        valid = false;
      }
      if (!validateField('numero', formData.numero)) {
        newErrors.numero = 'Número obrigatório';
        valid = false;
      }
      if (!validateField('bairro', formData.bairro)) {
        newErrors.bairro = 'Bairro obrigatório';
        valid = false;
      }
      newTouched.cep = true;
      newTouched.logradouro = true;
      newTouched.numero = true;
      newTouched.bairro = true;
    } else if (currentStep === 3) {
      if (!validateField('chavePix', formData.chavePix)) {
        newErrors.chavePix = 'Chave PIX é obrigatória';
        valid = false;
      }
      newTouched.chavePix = true;

      if (formData.agencia && !validateField('agencia', formData.agencia)) {
        newErrors.agencia = 'Informe uma agência válida';
        valid = false;
      }
      newTouched.agencia = !!formData.agencia;

      if (formData.conta && !validateField('conta', formData.conta)) {
        newErrors.conta = 'Informe a conta completa com dígito';
        valid = false;
      }
      newTouched.conta = !!formData.conta;

      if (formData.banco === 'Outro') {
        if (!validateField('outroBanco', formData.outroBanco)) {
          newErrors.outroBanco = 'Informe o nome da instituição bancária';
          valid = false;
        }
        newTouched.outroBanco = true;
      }
    } else if (currentStep === 4) {
      if (formData.cargo === 'Outro') {
        if (!validateField('outroCargo', formData.outroCargo)) {
          newErrors.outroCargo = 'Informe o nome da sua função ou cargo';
          valid = false;
        }
        newTouched.outroCargo = true;
      }
    }

    setTouched(newTouched);
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return valid;
  }

  const steps = formData.tipoPessoa === 'juridica'
    ? [
        { id: 1, title: 'Identificação da Empresa (PJ)', icon: Building2 }
      ]
    : [
        { id: 1, title: 'Dados pessoais', icon: User },
        { id: 2, title: 'Endereço', icon: MapPin },
        { id: 3, title: 'Dados bancários', icon: CreditCard },
        { id: 4, title: 'Profissionais', icon: Briefcase }
      ];

  async function handleNext(e) {
    e.preventDefault();
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < steps.length) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setMaxStepReached((prev) => Math.max(prev, nextStep));
    } else {
      try {
        const dadosCadastro = {
          tipo_pessoa: formData.tipoPessoa,
          razao_social: formData.razaoSocial,
          nome_fantasia: formData.nomeFantasia,
          cnpj: formData.cnpj,
          inscricao_municipal: formData.inscricaoMunicipal,
          inscricao_estadual: formData.inscricaoEstadual,
          porte: formData.porte,
          horario_funcionamento: formData.horarioFuncionamento,
          socio_administrador: formData.socioAdministrador,
          categoria_atuacao: formData.categoriaAtuacao,
          regime_tributacao: formData.regimeTributacao,
          atividade_principal: formData.atividadePrincipal,
          atividade_secundaria: formData.atividadeSecundaria,
          area_instalacoes: formData.areaInstalacoes,
          endereco_pj: formData.enderecoPJ,
          tipo_alvara: formData.tipoAlvara,
          numero_alvara: formData.numeroAlvara,
          inscricao_imobiliaria: formData.inscricaoImobiliaria,
          validade_alvara: formData.validadeAlvara,
          data_emissao_alvara: formData.dataEmissaoAlvara,
          codigo_validacao: formData.codigoValidacao,
          nome_completo: formData.tipoPessoa === 'juridica' ? formData.razaoSocial : formData.nome,
          cpf: formData.tipoPessoa === 'juridica' ? formData.cnpj : formData.cpf,
          rg: formData.tipoPessoa === 'juridica' ? (formData.inscricaoEstadual || 'ISENTO') : formData.rg,
          data_nascimento: formData.dataNascimento,
          email: formData.email,
          telefone: formData.telefone,
          cep: formData.cep,
          logradouro: formData.logradouro,
          numero: formData.numero,
          complemento: formData.complemento,
          bairro: formData.bairro,
          cidade: formData.cidade,
          estado: formData.estado,
          banco: formData.banco,
          outro_banco: formData.outroBanco,
          tipo_conta: formData.tipoConta,
          agencia: formData.agencia,
          conta: formData.conta,
          tipo_pix: formData.tipoPix,
          chave_pix: formData.chavePix,
          cargo: formData.cargo,
          outro_cargo: formData.outroCargo,
          unidade: formData.unidade,
          turno: formData.turno,
          sede: formData.sede,
          aceitou_termos: formData.aceitouTermos
        };
        const cadastroCriado = formData.tipoPessoa === 'juridica'
          ? await createPessoaJuridicaApi(dadosCadastro)
          : await createColaboradorApi(dadosCadastro);
        setColaboradorId(cadastroCriado.id);
      } catch (err) {
        console.warn("Erro ao salvar no PostgreSQL, continuando com visualização do PDF local...", err);
      }
      setIsCompleted(true);
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  function handleStepClick(stepId) {
    if (stepId <= maxStepReached || stepId === currentStep) {
      setCurrentStep(stepId);
    } else if (stepId === currentStep + 1) {
      if (validateCurrentStep()) {
        setCurrentStep(stepId);
        setMaxStepReached((prev) => Math.max(prev, stepId));
      }
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Botão de retorno ao Menu de Módulos (Hub) */}
      {onBack && (
        <div className="no-print flex items-center justify-between bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-zinc-200 shadow-sm">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-zinc-600 hover:text-red-600 transition-all group cursor-pointer"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-100 group-hover:bg-red-50 group-hover:text-red-600 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </span>
            <span>Voltar ao Menu Principal</span>
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-500 text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Relatório Individual
            </span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TELA DE SUCESSO & COMPROVANTE OFICIAL FORMATADO PARA PDF/PRINT */}
      {/* ============================================================ */}
      {isCompleted ? (
        <div className="space-y-6 animate-fadeIn">
          
          {/* BARRA DE AÇÕES NA TELA (Oculta na impressão do PDF) */}
          <div className="no-print bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/80 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900">
                  Ficha Cadastral Gerada com Sucesso
                </h3>
                <p className="text-xs text-zinc-500">
                  Visualize os dados abaixo ou gere o arquivo PDF oficial com carimbo corporativo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white shadow-md shadow-red-600/25 transition-all cursor-pointer"
              >
                {isGeneratingPDF ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    <span>Gerando PDF...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Salvar / Imprimir PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setIsCompleted(false);
                  setCurrentStep(1);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Editar</span>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* DOCUMENTO OFICIAL A4 PARA VISUALIZAÇÃO E IMPRESSÃO (PDF)     */}
          {/* ============================================================ */}
          {formData.tipoPessoa === 'juridica' ? (
            /* ========================================================== */
            /* LAYOUT EXATO DO ALVARÁ DE FUNCIONAMENTO (IMAGEM 2)         */
            /* ========================================================== */
            <div
              ref={pdfRef}
              data-pdf-root
              className="print-document bg-white text-black p-4 border-2 border-black max-w-4xl mx-auto font-sans select-none shadow-2xl leading-tight flex flex-col"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9px' }}
            >
              <div className="space-y-1.5 flex flex-col">
                {/* TOPO: LOGO DISTRIBUIDORA / CABEÇALHO CORPORATIVO / QR CODE */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b-2 border-black">
                  {/* Logo da Distribuidora Esquerda */}
                  <div className="w-20 shrink-0 flex items-center justify-start">
                    <Logo className="h-10 w-auto object-contain" />
                  </div>

                  {/* Textos Centrais Corporativos */}
                  <div className="flex-1 text-center text-black">
                    <h3 className="text-[10px] font-bold tracking-wider uppercase text-black leading-tight">
                      DISTRIBUIDORA IRMÃOS BARREIRO DE BEBIDAS
                    </h3>
                    <h2 className="text-[11px] font-black tracking-tight uppercase text-black leading-tight">
                      DEPARTAMENTO DE CADASTRO CORPORATIVO
                    </h2>
                    <h4 className="text-[9px] font-bold uppercase tracking-wider text-black leading-tight">
                      REGISTRO DE PRESTADOR & FORNECEDOR (PESSOA JURÍDICA)
                    </h4>
                  </div>

                  {/* QR Code Direita */}
                  <div className="w-16 shrink-0 flex flex-col items-center justify-center">
                    <div className="p-0.5 border-2 border-black bg-white">
                      <QrCode className="w-11 h-11 text-black stroke-[1.5]" />
                    </div>
                    <span className="text-[6px] font-mono font-bold mt-0.5 text-black">
                      {formData.codigoValidacao || protocolo || 'FA6A094467'}
                    </span>
                  </div>
                </div>

                {/* TÍTULO CENTRAL DESTACADO */}
                <div className="border-t-2 border-b-2 border-black py-1 text-center font-black">
                  <div className="text-[13px] tracking-wider uppercase font-black text-black leading-tight">
                    CADASTRO DE PESSOA JURÍDICA
                  </div>
                  <div className="text-[11px] font-black tracking-widest text-black leading-tight">
                    REGISTRO Nº {formData.numeroAlvara || protocolo}
                  </div>
                </div>

                {/* TABELA PRINCIPAL DE DADOS */}
                <table className="w-full border-collapse border border-black text-[9px] text-black">
                  <tbody>
                    {/* Razão Social */}
                    <tr>
                      <td colSpan={4} className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Razão Social</span>
                        <span className="block text-[10px] font-black uppercase text-black">
                          {formData.razaoSocial || 'EQUILIBRIUM SERVICOS DE DEDETIZACAO LTDA'}
                        </span>
                      </td>
                    </tr>

                    {/* Nome Fantasia */}
                    <tr>
                      <td colSpan={4} className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Nome Fantasia</span>
                        <span className="block text-[10px] font-black uppercase text-black">
                          {formData.nomeFantasia || 'EQUILIBRIUM SOLUCOES AMBIENTAIS'}
                        </span>
                      </td>
                    </tr>

                    {/* Endereço */}
                    <tr>
                      <td colSpan={4} className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Endereço Comercial</span>
                        <span className="block text-[9px] font-bold uppercase text-black">
                          {formData.enderecoPJ || (formData.logradouro ? `${formData.logradouro}, ${formData.numero || 'S/N'}, ${formData.bairro || ''} ${formData.cidade ? `- ${formData.cidade}` : ''} ${formData.estado ? `- ${formData.estado}` : ''}` : 'ENDEREÇO DA SEDE EMPRESARIAL')}
                        </span>
                      </td>
                    </tr>

                    {/* Linha com 4 Colunas: CNPJ, Área, Porte, Horário */}
                    <tr>
                      <td className="border border-black px-2 py-1 w-[26%] bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">CNPJ</span>
                        <span className="block text-[9px] font-bold font-mono text-black">
                          {formData.cnpj || '13.020.344/0001-04'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 w-[14%] bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Área</span>
                        <span className="block text-[9px] font-bold text-black">
                          {formData.areaInstalacoes || '12m²'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 w-[35%] bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Porte</span>
                        <span className="block text-[9px] font-bold text-black">
                          {formData.porte || 'Microempresa (ME EPP)'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 w-[25%] bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Horário Func.</span>
                        <span className="block text-[9px] font-bold font-mono text-black">
                          {formData.horarioFuncionamento || '07:00 - 17:00'}
                        </span>
                      </td>
                    </tr>

                    {/* Linha com 4 Colunas: Inscrições, Uso Categoria, Tipo de Tributação */}
                    <tr>
                      <td className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Insc. Municipal</span>
                        <span className="block text-[9px] font-bold font-mono text-black">
                          {formData.inscricaoMunicipal || '43133'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Insc. Estadual / Imob.</span>
                        <span className="block text-[9px] font-bold font-mono text-black">
                          {formData.inscricaoImobiliaria || formData.inscricaoEstadual || '11954'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Uso Categoria</span>
                        <span className="block text-[9px] font-bold text-black">
                          {formData.categoriaAtuacao || 'Prestação de Serviços'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Regime Tributário</span>
                        <span className="block text-[9px] font-bold uppercase text-black">
                          {formData.regimeTributacao || 'SIMPLES NACIONAL'}
                        </span>
                      </td>
                    </tr>

                    {/* Sócio Administrador & Tipo de Registro */}
                    <tr>
                      <td colSpan={3} className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Sócio Administrador</span>
                        <span className="block text-[9px] font-bold text-black">
                          {formData.socioAdministrador || '-'}
                        </span>
                      </td>
                      <td className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Tipo de Registro</span>
                        <span className="block text-[9.5px] font-black uppercase text-black">
                          {formData.tipoAlvara || 'HOMOLOGAÇÃO CORPORATIVA'}
                        </span>
                      </td>
                    </tr>

                    {/* Aviso de conformidade corporativa */}
                    <tr>
                      <td colSpan={4} className="border border-black px-2 py-0.5 text-center font-bold text-[8px] text-black bg-white">
                        A regularidade deste cadastro corporativo está condicionada à conformidade documental e operacional junto à Distribuidora Irmãos Barreiro.
                      </td>
                    </tr>

                    {/* Bloco Central – Marca d'água + Orientações */}
                    <tr>
                      <td colSpan={4} className="border border-black p-0 bg-white">
                        <div className="relative py-3 px-3 text-center overflow-hidden">
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-[0.07] select-none">
                            <div className="text-2xl font-black tracking-widest text-zinc-900 uppercase">
                              DISTRIBUIDORA IRMÃOS BARREIRO
                            </div>
                            <div className="text-xs font-bold text-zinc-700 italic mt-0.5">
                              Departamento de Cadastro & Homologação
                            </div>
                          </div>
                          <div className="relative z-10 space-y-0.5 text-[8.5px] font-bold text-black leading-snug">
                            <div className="font-black text-[9.5px] uppercase text-black mb-1 tracking-wide">
                              COMUNICAR À DISTRIBUIDORA QUANDO:
                            </div>
                            <div>1 - Mudança de Endereço / Sede.</div>
                            <div>2 - Alteração de Porte ou Estrutura.</div>
                            <div>3 - Mudança de Atividade ou Escopo.</div>
                            <div>4 - Alteração na Razão Social.</div>
                            <div>5 - Alteração no Nome Fantasia.</div>
                            <div>6 - Encerramento das Atividades Comerciais.</div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Atividade Principal */}
                    <tr>
                      <td colSpan={4} className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Atividade Principal</span>
                        <span className="block text-[8.5px] font-medium text-black leading-snug">
                          {formData.atividadePrincipal || 'Prestação de serviços operacionais, logísticos e especializados.'}
                        </span>
                      </td>
                    </tr>

                    {/* Atividade Secundária */}
                    <tr>
                      <td colSpan={4} className="border border-black px-2 py-1 bg-white">
                        <span className="block text-[8px] font-bold text-black uppercase">Atividade Secundária</span>
                        <div className="text-[8px] font-medium text-black leading-snug space-y-0.5">
                          {formData.atividadeSecundaria ? (
                            formData.atividadeSecundaria.split('\n').map((linha, idx) => (
                              <div key={idx}>{linha}</div>
                            ))
                          ) : (
                            <div>Atividades auxiliares e de suporte operacional especializado.</div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Validade e Data Emissão */}
                    <tr>
                      <td colSpan={2} className="border border-black px-2 py-1 bg-white">
                        <span className="font-bold text-[8px] text-black uppercase">Validade do Registro: </span>
                        <span className="font-medium text-[8.5px] text-black">
                          {formData.validadeAlvara || 'Indeterminada / Conforme Contrato'}
                        </span>
                      </td>
                      <td colSpan={2} className="border border-black px-2 py-1 bg-white">
                        <span className="font-bold text-[8px] text-black uppercase">Data de Emissão: </span>
                        <span className="font-medium text-[8.5px] text-black">
                          {formData.dataEmissaoAlvara || dataEmissao}
                        </span>
                      </td>
                    </tr>

                    {/* Situação Cadastral e Código Validação */}
                    <tr>
                      <td colSpan={2} className="border border-black px-2 py-1 bg-white">
                        <span className="font-bold text-[8px] text-black uppercase">Situação Cadastral: </span>
                        <span className="font-bold text-[8.5px] text-emerald-800 uppercase">
                          ATIVO / HOMOLOGADO
                        </span>
                      </td>
                      <td colSpan={2} className="border border-black px-2 py-1 bg-white">
                        <span className="font-bold text-[8px] text-black uppercase">Código de Autenticação: </span>
                        <span className="font-bold font-mono text-[8.5px] text-black">
                          {formData.codigoValidacao || protocolo || 'FA6A094467'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* RODAPÉ CORPORATIVO */}
              <div className="border-t border-black/40 pt-1.5 mt-1.5 flex items-center justify-between text-[7.5px] font-semibold text-zinc-500 uppercase">
                <span>Distribuidora Irmãos Barreiro de Bebidas &bull; Cadastro Corporativo (PJ)</span>
                <span className="font-mono">Página 1 de 1</span>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* LAYOUT ORIGINAL DE CADASTRO INDIVIDUAL (PESSOA FÍSICA)     */
            /* ========================================================== */
            <div
              ref={pdfRef}
              data-pdf-root
              className="print-document bg-white text-zinc-900 rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-xl space-y-4 max-w-4xl mx-auto"
            >
              {/* CABEÇALHO EXECUTIVO OFICIAL */}
              <div className="border-b-2 border-red-600 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <Logo className="h-12 sm:h-14 shrink-0" />
                  <div className="border-l border-zinc-300 pl-3">
                    <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight leading-tight">
                      Distribuidora Irmãos Barreiro de Bebidas
                    </h1>
                    <p className="text-xs text-zinc-500 font-medium">
                      Comprovante Oficial de Cadastro e Alocação Operacional
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Sede: Distrito Industrial, Cascavel - CE
                    </p>
                  </div>
                </div>

                {/* Box de Protocolo */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-left sm:text-right min-w-[190px] shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Protocolo Oficial
                  </span>
                  <span className="text-sm font-mono font-black text-red-600 block">
                    {protocolo}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    Emissão: {dataEmissao}
                  </span>
                </div>
              </div>

              {/* SEÇÃO 1: IDENTIFICAÇÃO PESSOAL */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-1.5">
                  <User className="w-4 h-4 text-red-600 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-900">
                    1. Identificação Pessoal do Colaborador
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="col-span-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Nome Completo</span>
                    <span className="text-sm font-bold text-zinc-900">{formData.nome || 'Não informado'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">CPF</span>
                    <span className="font-bold text-zinc-900 font-mono">{formData.cpf || 'Não informado'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">RG / Órgão Emissor</span>
                    <span className="font-bold text-zinc-900">{formData.rg || 'Não informado'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Telefone / WhatsApp</span>
                    <span className="font-bold text-zinc-900">{formData.telefone || 'Não informado'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">E-mail</span>
                    <span className="font-bold text-zinc-900 truncate block">{formData.email || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: ENDEREÇO RESIDENCIAL */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-1.5">
                  <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-900">
                    2. Endereço Residencial
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="col-span-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Logradouro / Rua</span>
                    <span className="font-bold text-zinc-900">{formData.logradouro || 'Não informado'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Número</span>
                    <span className="font-bold text-zinc-900">{formData.numero || 'S/N'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Complemento</span>
                    <span className="font-bold text-zinc-900">{formData.complemento || '—'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Bairro</span>
                    <span className="font-bold text-zinc-900">{formData.bairro || 'Não informado'}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">CEP</span>
                    <span className="font-bold text-zinc-900 font-mono">{formData.cep || 'Não informado'}</span>
                  </div>

                  <div className="col-span-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Município / UF</span>
                    <span className="font-bold text-zinc-900">{formData.cidade} - {formData.estado}</span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: DADOS BANCÁRIOS */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-1.5">
                  <CreditCard className="w-4 h-4 text-red-600 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-900">
                    3. Informações Bancárias & Pagamento
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="col-span-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Instituição Bancária</span>
                    <span className="font-bold text-zinc-900">
                      {formData.banco === 'Outro' ? (formData.outroBanco || 'Outra Instituição') : formData.banco}
                    </span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Tipo de Conta</span>
                    <span className="font-bold text-zinc-900">{formData.tipoConta}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Agência / Conta</span>
                    <span className="font-bold text-zinc-900 font-mono">
                      Ag: {formData.agencia || '—'} | Cc: {formData.conta || '—'}
                    </span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Tipo de PIX</span>
                    <span className="font-bold text-zinc-900">{formData.tipoPix}</span>
                  </div>

                  <div className="col-span-3 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Chave PIX Cadastrada</span>
                    <span className="font-bold text-red-600 font-mono">{formData.chavePix || formData.cpf || 'Cadastrada'}</span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: DADOS PROFISSIONAIS */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-1.5">
                  <Briefcase className="w-4 h-4 text-red-600 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-900">
                    4. Atribuição Profissional & Unidade
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Cargo / Função</span>
                    <span className="font-bold text-zinc-900">
                      {formData.cargo === 'Outro' ? (formData.outroCargo || 'Outra Função') : formData.cargo}
                    </span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Unidade Operacional</span>
                    <span className="font-bold text-zinc-900">{formData.unidade}</span>
                  </div>

                  <div className="bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Turno de Trabalho</span>
                    <span className="font-bold text-zinc-900">{formData.turno}</span>
                  </div>
                </div>
              </div>

              {/* TERMO E AUTENTICAÇÃO */}
              <div className="pt-3 border-t border-zinc-200 space-y-4 text-xs">
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-zinc-600 leading-relaxed text-[11px]">
                  <p>
                    <strong>Declaração de Veracidade e Sigilo:</strong> O colaborador declara sob as penas da lei que todas as informações acima são verídicas e atualizadas, autorizando o tratamento de seus dados pessoais exclusivamente para fins trabalhistas, cadastrais e bancários pela <strong>Distribuidora Irmãos Barreiro de Bebidas</strong> em conformidade com a LGPD (Lei Federal nº 13.709/2018).
                  </p>
                </div>

                {/* ASSINATURAS (Para documento impresso) */}
                <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                  <div className="border-t border-zinc-400 pt-1.5">
                    <p className="font-bold text-zinc-900">{formData.nome || 'Assinatura do Colaborador'}</p>
                    <p className="text-[10px] text-zinc-500">Colaborador / Titular dos Dados</p>
                  </div>

                  <div className="border-t border-zinc-400 pt-1.5">
                    <p className="font-bold text-zinc-900">Distribuidora Irmãos Barreiro</p>
                    <p className="text-[10px] text-zinc-500">Depto. de Pessoal / Validação RH</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {formData.tipoPessoa === 'fisica' && (
            <DocumentosPessoaFisica colaboradorId={colaboradorId} />
          )}
          {formData.tipoPessoa === 'juridica' && (
            <DocumentosPessoaJuridica cadastroId={colaboradorId} />
          )}
        </div>
      ) : (
        /* CONTAINER PRINCIPAL DO FORMULÁRIO (SIDEBAR DESKTOP + STEPPER MOBILE) */
        <div className="space-y-4">

          {/* STEPPER SUPERIOR COMPACTO (EXCLUSIVO PARA MOBILE < md) */}
          <div className="md:hidden bg-zinc-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar pb-1">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isPast = currentStep > step.id;
                const isClickable = step.id <= maxStepReached || step.id === currentStep;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepClick(step.id)}
                    disabled={!isClickable}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      isActive
                        ? 'bg-red-600 text-white shadow-md'
                        : isPast
                        ? 'bg-zinc-800 text-emerald-400'
                        : 'bg-zinc-800/60 text-zinc-400 opacity-60'
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    <span>{step.id}. {step.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CARD PRINCIPAL EM GRID */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-zinc-200/80 shadow-2xl shadow-zinc-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[520px]">

            {/* SIDEBAR ESQUERDA (DESKTOP >= md) */}
            <div className="hidden md:flex md:col-span-4 flex-col justify-between border-r border-zinc-800/60 text-white relative overflow-hidden"
              style={{ background: 'linear-gradient(165deg, #111827 0%, #0f172a 60%, #1a0a0a 100%)' }}
            >
              {/* Decoração de fundo */}
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #ef233c 0%, transparent 70%)' }} />
              <div className="absolute bottom-10 left-0 w-32 h-32 rounded-full opacity-5 blur-2xl" style={{ background: 'radial-gradient(circle, #ef233c 0%, transparent 70%)' }} />

              <div className="relative p-6 space-y-5">
                {/* Header da sidebar */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-400/80">Portal RH</p>
                    <h4 className="text-sm font-black text-white mt-0.5 tracking-tight">Etapas do Cadastro</h4>
                  </div>
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 font-mono text-xs font-black text-white">
                    {currentStep}/{steps.length}
                  </span>
                </div>

                {/* Barra de progresso total */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Progresso</span>
                    <span className="text-red-400">{Math.round((currentStep / steps.length) * 100)}% concluído</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(currentStep / steps.length) * 100}%`, background: 'linear-gradient(90deg, #ef233c, #f87171)' }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {steps.map((step) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isPast = currentStep > step.id;
                    const isClickable = step.id <= maxStepReached || step.id === currentStep;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => handleStepClick(step.id)}
                        disabled={!isClickable}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? 'text-white shadow-lg shadow-red-600/30'
                            : isPast
                            ? 'bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white cursor-pointer border border-white/5'
                            : isClickable
                            ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 cursor-pointer'
                            : 'text-zinc-600 opacity-50 cursor-not-allowed'
                        }`}
                        style={isActive ? { background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', border: '1px solid rgba(239,35,60,0.4)' } : {}}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 text-[11px] font-black transition-all ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : isPast
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : 'bg-white/5 text-zinc-500 border border-white/10'
                        }`}>
                          {isPast ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="block truncate font-bold text-[12.5px] leading-tight">{step.title}</span>
                          <span className="text-[10px] font-normal block mt-0.5 opacity-70">
                            {isActive ? 'Em preenchimento' : isPast ? '✓ Concluído' : `Etapa ${step.id} de ${steps.length}`}
                          </span>
                        </div>

                        {isPast && (
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          </span>
                        )}
                        {isActive && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rodapé da sidebar */}
              <div className="relative p-6 border-t border-white/5">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/8">
                  <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-200 mb-0.5">Navegação livre</p>
                    <p className="text-[10.5px] text-zinc-500 leading-relaxed">
                      Volte nas etapas concluídas para revisar dados a qualquer momento.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* PAINEL DIREITO (Conteúdo do Formulário) */}
            <div className="md:col-span-8 flex flex-col justify-between bg-white">
              <form onSubmit={handleNext} className="flex-1 flex flex-col justify-between">

                <div className="p-6 sm:p-8 md:p-10 space-y-6">
                  {/* Cabeçalho da Etapa Ativa */}
                  <div>
                    <div className="flex items-start justify-between mb-1">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-500">Etapa {currentStep} de {steps.length}</span>
                        </div>
                        <h3 className="text-[22px] font-black text-zinc-950 tracking-tight leading-tight">
                          {steps[currentStep - 1]?.title || 'Cadastro'}
                        </h3>
                        <p className="text-xs text-zinc-400 font-medium">
                          Preencha os campos com atenção
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-red-50 to-rose-50 text-red-600 border border-red-200/80 shadow-sm shrink-0">
                        {Math.round((currentStep / steps.length) * 100)}% Concluído
                      </span>
                    </div>

                    {/* Barra de Progresso Segmentada */}
                    <div className="flex gap-1.5 mt-4">
                      {steps.map((step) => (
                        <div key={step.id} className="h-1 flex-1 rounded-full overflow-hidden bg-zinc-100">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: currentStep > step.id ? '100%' : currentStep === step.id ? '60%' : '0%',
                              background: currentStep > step.id ? '#16a34a' : 'linear-gradient(90deg, #ef233c, #f87171)'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ============================================================ */}
                  {/* ETAPA 1: IDENTIFICAÇÃO (PESSOA FÍSICA OU PESSOA JURÍDICA)     */}
                  {/* ============================================================ */}
                  {currentStep === 1 && (
                    <div className="space-y-5 animate-fadeIn">
                      {/* SELETOR DE TIPO: PESSOA FÍSICA VS PESSOA JURÍDICA */}
                      <div className="bg-zinc-50 p-3 sm:p-4 rounded-2xl border border-zinc-200">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-black uppercase text-zinc-700 tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Selecione o Tipo de Cadastro</span>
                          </label>
                          <span className="text-[11px] font-semibold text-zinc-500">
                            {formData.tipoPessoa === 'juridica' ? 'Cadastro Empresarial (PJ)' : 'Cadastro Individual (PF)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => handleTipoPessoaChange('fisica')}
                            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                              formData.tipoPessoa === 'fisica'
                                ? 'border-red-600 bg-red-600 text-white shadow-md shadow-red-600/25 scale-[1.01]'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <User className="w-4 h-4" />
                            <span>Pessoa Física</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTipoPessoaChange('juridica')}
                            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                              formData.tipoPessoa === 'juridica'
                                ? 'border-red-600 bg-red-600 text-white shadow-md shadow-red-600/25 scale-[1.01]'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                            <span>Pessoa Jurídica (PJ)</span>
                          </button>
                        </div>
                      </div>

                      {/* CAMPOS PESSOA FÍSICA */}
                      {formData.tipoPessoa === 'fisica' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Nome Completo <span className="text-red-600 font-black">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.nome}
                              onChange={(e) => handleChange('nome', e.target.value)}
                              onBlur={() => handleBlur('nome')}
                              placeholder="Ex: João da Silva Barreiro"
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.nome && errors.nome
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.nome && errors.nome && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.nome}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              CPF <span className="text-red-600 font-black">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.cpf}
                              onChange={(e) => handleChange('cpf', e.target.value)}
                              onBlur={() => handleBlur('cpf')}
                              placeholder="000.000.000-00"
                              maxLength={14}
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.cpf && errors.cpf
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.cpf && errors.cpf && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.cpf}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              RG / Órgão Emissor <span className="text-red-600 font-black">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.rg}
                              onChange={(e) => handleChange('rg', e.target.value)}
                              onBlur={() => handleBlur('rg')}
                              placeholder="Ex: 2008010... SSP/CE"
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.rg && errors.rg
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.rg && errors.rg && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.rg}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-extrabold uppercase text-zinc-900 tracking-wide">
                                Telefone / WhatsApp
                              </label>
                              <span className="text-zinc-400 font-medium text-[11px] lowercase">(opcional)</span>
                            </div>
                            <input
                              type="text"
                              value={formData.telefone}
                              onChange={(e) => handleChange('telefone', e.target.value)}
                              onBlur={() => handleBlur('telefone')}
                              placeholder="(85) 99999-9999"
                              maxLength={15}
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.telefone && errors.telefone
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.telefone && errors.telefone && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.telefone}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-extrabold uppercase text-zinc-900 tracking-wide">
                                E-mail
                              </label>
                              <span className="text-zinc-400 font-medium text-[11px] lowercase">(opcional)</span>
                            </div>
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleChange('email', e.target.value)}
                              onBlur={() => handleBlur('email')}
                              placeholder="nome@empresa.com"
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.email && errors.email
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.email && errors.email && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.email}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* CAMPOS PESSOA JURÍDICA (PJ) - CAMPOS CORPORATIVOS */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                          {/* CAMPO OBRIGATÓRIO EM DESTAQUE: RAZÃO SOCIAL */}
                          <div className="sm:col-span-2 bg-red-50/40 p-3.5 rounded-2xl border border-red-200/80">
                            <label className="block text-xs font-black uppercase text-red-900 tracking-wide mb-1.5 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-red-600" />
                                Razão Social da Empresa <span className="text-red-600 font-black text-sm">*</span>
                              </span>
                              <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">
                                Obrigatório
                              </span>
                            </label>
                            <input
                              type="text"
                              value={formData.razaoSocial}
                              onChange={(e) => handleChange('razaoSocial', e.target.value)}
                              onBlur={() => handleBlur('razaoSocial')}
                              placeholder="Ex: EQUILIBRIUM SERVICOS DE DEDETIZACAO LTDA"
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-bold placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none uppercase ${
                                touched.razaoSocial && errors.razaoSocial
                                  ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 bg-white hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.razaoSocial && errors.razaoSocial && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.razaoSocial}</span>
                              </p>
                            )}
                          </div>

                          {/* NOME FANTASIA */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Nome Fantasia
                            </label>
                            <input
                              type="text"
                              value={formData.nomeFantasia}
                              onChange={(e) => handleChange('nomeFantasia', e.target.value)}
                              placeholder="Ex: EQUILIBRIUM SOLUCOES AMBIENTAIS"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* CNPJ */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              CNPJ <span className="text-red-600 font-black">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.cnpj}
                              onChange={(e) => handleChange('cnpj', e.target.value)}
                              onBlur={() => handleBlur('cnpj')}
                              placeholder="00.000.000/0000-00"
                              maxLength={18}
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.cnpj && errors.cnpj
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.cnpj && errors.cnpj && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.cnpj}</span>
                              </p>
                            )}
                          </div>

                          {/* ENDEREÇO DA EMPRESA (ALVARÁ) */}
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Endereço Completo da Empresa
                            </label>
                            <input
                              type="text"
                              value={formData.enderecoPJ}
                              onChange={(e) => handleChange('enderecoPJ', e.target.value)}
                              placeholder="Ex: Av. Principal, 500 - Sede Empresarial"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none uppercase"
                            />
                          </div>

                          {/* TIPO DE REGISTRO */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Tipo de Registro / Alvará
                            </label>
                            <select
                              value={formData.tipoAlvara}
                              onChange={(e) => handleChange('tipoAlvara', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                            >
                              <option value="HOMOLOGAÇÃO CORPORATIVA">HOMOLOGAÇÃO CORPORATIVA</option>
                              <option value="RENOVAÇÃO">RENOVAÇÃO</option>
                              <option value="INICIAL">INICIAL</option>
                              <option value="DEFINITIVO">DEFINITIVO</option>
                            </select>
                          </div>

                          {/* NÚMERO DO REGISTRO */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Nº do Registro / Alvará
                            </label>
                            <input
                              type="text"
                              value={formData.numeroAlvara}
                              onChange={(e) => handleChange('numeroAlvara', e.target.value)}
                              placeholder="Ex: REG-2025/01"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* INSCRIÇÃO MUNICIPAL */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Inscrição Municipal
                            </label>
                            <input
                              type="text"
                              value={formData.inscricaoMunicipal}
                              onChange={(e) => handleChange('inscricaoMunicipal', e.target.value)}
                              placeholder="Ex: 43133"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* INSCRIÇÃO ESTADUAL */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Inscrição Estadual
                            </label>
                            <input
                              type="text"
                              value={formData.inscricaoEstadual}
                              onChange={(e) => handleChange('inscricaoEstadual', e.target.value)}
                              placeholder="Ex: 11954"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* PORTE DA EMPRESA */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Porte da Empresa
                            </label>
                            <select
                              value={formData.porte}
                              onChange={(e) => handleChange('porte', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                            >
                              <option value="Microempresa (ME EPP)">Microempresa (ME EPP)</option>
                              <option value="MEI - Microempreendedor Individual">MEI - Microempreendedor Individual</option>
                              <option value="EPP - Empresa de Pequeno Porte">EPP - Empresa de Pequeno Porte</option>
                              <option value="Sociedade Limitada (LTDA)">Sociedade Limitada (LTDA)</option>
                              <option value="Médio / Grande Porte">Médio / Grande Porte</option>
                            </select>
                          </div>

                          {/* HORÁRIO DE ATENDIMENTO / FUNCIONAMENTO */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Horário de Funcionamento
                            </label>
                            <input
                              type="text"
                              value={formData.horarioFuncionamento}
                              onChange={(e) => handleChange('horarioFuncionamento', e.target.value)}
                              placeholder="07:00 - 17:00"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* SÓCIO ADMINISTRADOR / REPRESENTANTE */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Sócio Administrador / Responsável
                            </label>
                            <input
                              type="text"
                              value={formData.socioAdministrador}
                              onChange={(e) => handleChange('socioAdministrador', e.target.value)}
                              placeholder="Nome do sócio ou representante"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* CATEGORIA DE ATUAÇÃO */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Categoria de Atuação
                            </label>
                            <select
                              value={formData.categoriaAtuacao}
                              onChange={(e) => handleChange('categoriaAtuacao', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                            >
                              <option value="Prestação de Serviços">Prestação de Serviços</option>
                              <option value="Comércio Varejista / Atacadista">Comércio Varejista / Atacadista</option>
                              <option value="Transporte e Logística">Transporte e Logística</option>
                              <option value="Dedetização e Controle de Pragas">Dedetização e Controle de Pragas</option>
                              <option value="Manutenção e Conservação">Manutenção e Conservação</option>
                              <option value="Outro Ramo">Outro Ramo</option>
                            </select>
                          </div>

                          {/* REGIME DE TRIBUTAÇÃO */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Regime de Tributação
                            </label>
                            <select
                              value={formData.regimeTributacao}
                              onChange={(e) => handleChange('regimeTributacao', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                            >
                              <option value="Simples Nacional">Simples Nacional</option>
                              <option value="Isenção Fiscal">Isenção Fiscal</option>
                              <option value="Lucro Presumido">Lucro Presumido</option>
                              <option value="Lucro Real">Lucro Real</option>
                            </select>
                          </div>

                          {/* ÁREA DAS INSTALAÇÕES */}
                          <div>
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Área das Instalações
                            </label>
                            <input
                              type="text"
                              value={formData.areaInstalacoes}
                              onChange={(e) => handleChange('areaInstalacoes', e.target.value)}
                              placeholder="Ex: 12m²"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* TELEFONE COMERCIAL */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-extrabold uppercase text-zinc-900 tracking-wide">
                                Telefone Comercial / WhatsApp
                              </label>
                              <span className="text-zinc-400 font-medium text-[11px] lowercase">(opcional)</span>
                            </div>
                            <input
                              type="text"
                              value={formData.telefone}
                              onChange={(e) => handleChange('telefone', e.target.value)}
                              onBlur={() => handleBlur('telefone')}
                              placeholder="(85) 99999-9999"
                              maxLength={15}
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.telefone && errors.telefone
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.telefone && errors.telefone && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.telefone}</span>
                              </p>
                            )}
                          </div>

                          {/* E-MAIL CORPORATIVO */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-extrabold uppercase text-zinc-900 tracking-wide">
                                E-mail Corporativo
                              </label>
                              <span className="text-zinc-400 font-medium text-[11px] lowercase">(opcional)</span>
                            </div>
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleChange('email', e.target.value)}
                              onBlur={() => handleBlur('email')}
                              placeholder="contato@empresa.com"
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.email && errors.email
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {touched.email && errors.email && (
                              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.email}</span>
                              </p>
                            )}
                          </div>

                          {/* ATIVIDADE PRINCIPAL (CNAE / RAMO) */}
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Atividade Principal (Ramo Principal)
                            </label>
                            <input
                              type="text"
                              value={formData.atividadePrincipal}
                              onChange={(e) => handleChange('atividadePrincipal', e.target.value)}
                              placeholder="Ex: 812220000 - Imunização e controle de pragas urbanas (Dedetização, desinfecção, pulverização)"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>

                          {/* ATIVIDADE SECUNDÁRIA */}
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                              Atividade Secundária (Opcional)
                            </label>
                            <input
                              type="text"
                              value={formData.atividadeSecundaria}
                              onChange={(e) => handleChange('atividadeSecundaria', e.target.value)}
                              placeholder="Ex: 81290000 - Atividades de limpeza não especificadas anteriormente"
                              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ============================================================ */}
                  {/* ETAPA 2: ENDEREÇO                                            */}
                  {/* ============================================================ */}
                  {currentStep === 2 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            CEP <span className="text-red-600 font-black">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.cep}
                              onChange={(e) => handleChange('cep', e.target.value)}
                              onBlur={() => handleBlur('cep')}
                              placeholder="62850-000"
                              maxLength={9}
                              className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                touched.cep && errors.cep
                                  ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                  : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                              }`}
                            />
                            {loadingCep && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-600 font-semibold animate-pulse">
                                Buscando...
                              </span>
                            )}
                          </div>
                          {touched.cep && errors.cep && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.cep}</span>
                            </p>
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Rua / Logradouro <span className="text-red-600 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.logradouro}
                            onChange={(e) => handleChange('logradouro', e.target.value)}
                            onBlur={() => handleBlur('logradouro')}
                            placeholder="Ex: Av. Chanceler Edson Queiroz"
                            className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                              touched.logradouro && errors.logradouro
                                ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                            }`}
                          />
                          {touched.logradouro && errors.logradouro && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.logradouro}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Número <span className="text-red-600 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.numero}
                            onChange={(e) => handleChange('numero', e.target.value)}
                            onBlur={() => handleBlur('numero')}
                            placeholder="Ex: 5003"
                            className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                              touched.numero && errors.numero
                                ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                            }`}
                          />
                          {touched.numero && errors.numero && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.numero}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-extrabold uppercase text-zinc-900 tracking-wide">
                              Complemento
                            </label>
                            <span className="text-zinc-400 font-medium text-[11px] lowercase">(opcional)</span>
                          </div>
                          <input
                            type="text"
                            value={formData.complemento}
                            onChange={(e) => handleChange('complemento', e.target.value)}
                            placeholder="Ex: Galpão A, Apto 101"
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Bairro <span className="text-red-600 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.bairro}
                            onChange={(e) => handleChange('bairro', e.target.value)}
                            onBlur={() => handleBlur('bairro')}
                            placeholder="Ex: Distrito Industrial"
                            className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                              touched.bairro && errors.bairro
                                ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                            }`}
                          />
                          {touched.bairro && errors.bairro && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.bairro}</span>
                            </p>
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Cidade <span className="text-red-600 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.cidade}
                            onChange={(e) => handleChange('cidade', e.target.value)}
                            placeholder="Cascavel"
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Estado (UF) <span className="text-red-600 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.estado}
                            onChange={(e) => handleChange('estado', e.target.value)}
                            placeholder="CE"
                            maxLength={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm uppercase transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============================================================ */}
                  {/* ETAPA 3: DADOS BANCÁRIOS                                     */}
                  {/* ============================================================ */}
                  {currentStep === 3 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Instituição Bancária <span className="text-red-600 font-black">*</span>
                          </label>
                          <select
                            value={formData.banco}
                            onChange={(e) => handleChange('banco', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                          >
                            <option value="Caixa Econômica Federal">Caixa Econômica Federal</option>
                            <option value="Banco do Brasil">Banco do Brasil</option>
                            <option value="Bradesco">Bradesco</option>
                            <option value="Itaú">Itaú</option>
                            <option value="Santander">Santander</option>
                            <option value="Nubank">Nubank</option>
                            <option value="Banco Inter">Banco Inter</option>
                            <option value="Outro">Outra Instituição</option>
                          </select>

                          {formData.banco === 'Outro' && (
                            <div className="mt-3 animate-fadeIn">
                              <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                                Nome da Instituição Bancária <span className="text-red-600 font-black">*</span>
                              </label>
                              <input
                                type="text"
                                value={formData.outroBanco}
                                onChange={(e) => handleChange('outroBanco', e.target.value)}
                                onBlur={() => handleBlur('outroBanco')}
                                placeholder="Digite o nome da sua instituição bancária (ex: C6 Bank, PagBank, Sicredi...)"
                                autoFocus
                                className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                  touched.outroBanco && errors.outroBanco
                                    ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                    : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                                }`}
                              />
                              {touched.outroBanco && errors.outroBanco && (
                                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>{errors.outroBanco}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Tipo de Chave PIX <span className="text-red-600 font-black">*</span>
                          </label>
                          <select
                            value={formData.tipoPix}
                            onChange={(e) => handleChange('tipoPix', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                          >
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                            <option value="E-mail">E-mail</option>
                            <option value="Telefone">Telefone / Celular</option>
                            <option value="Aleatória">Chave Aleatória (EVP)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Chave PIX <span className="text-red-600 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.chavePix}
                            onChange={(e) => handleChange('chavePix', e.target.value)}
                            onBlur={() => handleBlur('chavePix')}
                            placeholder="Informe a chave cadastrada"
                            className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                              touched.chavePix && errors.chavePix
                                ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                            }`}
                          />
                          {touched.chavePix && errors.chavePix && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.chavePix}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Agência <span className="text-zinc-400 font-medium normal-case">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={formData.agencia}
                            onChange={(e) => handleChange('agencia', e.target.value)}
                            onBlur={() => handleBlur('agencia')}
                            placeholder="0000"
                            maxLength={7}
                            className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                              touched.agencia && errors.agencia
                                ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                            }`}
                          />
                          {touched.agencia && errors.agencia && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.agencia}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Conta com Dígito <span className="text-zinc-400 font-medium normal-case">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={formData.conta}
                            onChange={(e) => handleChange('conta', e.target.value)}
                            onBlur={() => handleBlur('conta')}
                            placeholder="0000000-0"
                            maxLength={16}
                            className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-mono font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                              touched.conta && errors.conta
                                ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                            }`}
                          />
                          {touched.conta && errors.conta && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{errors.conta}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============================================================ */}
                  {/* ETAPA 4: PROFISSIONAIS & TERMOS                              */}
                  {/* ============================================================ */}
                  {currentStep === 4 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Cargo / Função Operacional <span className="text-red-600 font-black">*</span>
                          </label>
                          <select
                            value={formData.cargo}
                            onChange={(e) => handleChange('cargo', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                          >
                            <option value="Ajudante de Motorista">Ajudante de Motorista</option>
                            <option value="Motorista">Motorista</option>
                            <option value="Pintor">Pintor</option>
                            <option value="Mecânico">Mecânico</option>
                            <option value="Eletricista">Eletricista</option>
                            <option value="Técnico de Ar">Técnico de Ar</option>
                            <option value="Técnico de Refrigeração">Técnico de Refrigeração</option>
                            <option value="Jardineiro">Jardineiro</option>
                            <option value="Pedreiro">Pedreiro</option>
                            <option value="Servente">Servente</option>
                            <option value="Vigia">Vigia</option>
                            <option value="Controlador de Pragas">Controlador de Pragas</option>
                            <option value="Soldador">Soldador</option>
                            <option value="Motorista de Carteiro">Motorista de Carteiro</option>
                            <option value="Outro">Outra Função</option>
                          </select>

                          {formData.cargo === 'Outro' && (
                            <div className="mt-3 animate-fadeIn">
                              <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                                Nome da Função / Cargo <span className="text-red-600 font-black">*</span>
                              </label>
                              <input
                                type="text"
                                value={formData.outroCargo}
                                onChange={(e) => handleChange('outroCargo', e.target.value)}
                                onBlur={() => handleBlur('outroCargo')}
                                placeholder="Digite a sua função (ex: Eletricista, Mecânico, Repositor...)"
                                autoFocus
                                className={`w-full px-4 py-2.5 rounded-xl border text-zinc-900 font-medium placeholder:text-zinc-400 placeholder:font-normal text-sm transition-all outline-none ${
                                  touched.outroCargo && errors.outroCargo
                                    ? 'border-red-500 bg-red-50/20 focus:ring-2 focus:ring-red-500/20'
                                    : 'border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20'
                                }`}
                              />
                              {touched.outroCargo && errors.outroCargo && (
                                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>{errors.outroCargo}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Unidade Operacional
                          </label>
                          <input
                            type="text"
                            disabled
                            value={formData.unidade}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Turno de Atuação
                          </label>
                          <select
                            value={formData.turno}
                            onChange={(e) => handleChange('turno', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 hover:border-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 text-zinc-900 font-medium text-sm bg-white outline-none"
                          >
                            <option value="Diurno (Comercial / Rota)">Diurno (Comercial / Rota)</option>
                            <option value="Noturno (Carregamento / Logística)">Noturno (Carregamento / Logística)</option>
                            <option value="Escala / Revezamento">Escala / Revezamento</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold uppercase text-zinc-900 tracking-wide mb-1.5">
                            Sede Central
                          </label>
                          <div className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-700 flex items-center gap-2 font-medium">
                            <Building2 className="w-4 h-4 text-red-600 shrink-0" />
                            <span>Rua João Damasceno Fontenele, 5003</span>
                          </div>
                        </div>
                      </div>

                      {/* Box LGPD */}
                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mt-4">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formData.aceitouTermos}
                            onChange={(e) => handleChange('aceitouTermos', e.target.checked)}
                            className="mt-1 w-4 h-4 text-red-600 rounded border-zinc-300 focus:ring-red-500"
                          />
                          <span className="text-xs text-zinc-700 leading-relaxed">
                            Confirmo que as informações prestadas são verdadeiras e estou ciente da{' '}
                            <Link
                              to="/politica-de-privacidade"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 font-bold underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Política de Privacidade
                            </Link>{' '}
                            da Distribuidora Irmãos Barreiro para fins cadastrais e operacionais internos.
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTÕES DE NAVEGAÇÃO */}
                <div className="px-6 sm:px-8 md:px-10 py-5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 shadow-sm transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                  ) : (
                    <div></div>
                  )}

                  <button
                    type="submit"
                    disabled={currentStep === 4 && formData.tipoPessoa === 'fisica' && !formData.aceitouTermos}
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:shadow-red-600/45 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #ef233c 0%, #c9182e 100%)' }}
                  >
                    <span>{currentStep === steps.length ? 'Concluir Cadastro' : 'Continuar'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
