import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import Logo from './Logo';
import { 
  X, 
  Download, 
  Printer, 
  Calendar, 
  FileText, 
  Users, 
  Briefcase, 
  DollarSign, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  Filter
} from 'lucide-react';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function RelatorioMensalModal({
  isOpen,
  onClose,
  diaristas = [],
  mesInicial,
  anoInicial,
  autoDownload = false
}) {
  const agora = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(anoInicial || agora.getFullYear());
  const [mesSelecionadoIndex, setMesSelecionadoIndex] = useState(
    mesInicial !== undefined && mesInicial !== null ? mesInicial : agora.getMonth()
  );
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState('');
  const containerLaudasRef = useRef(null);

  // Sincroniza o mês e ano internos SEMPRE que o modal abre com novos valores
  useEffect(() => {
    if (isOpen) {
      if (mesInicial !== undefined && mesInicial !== null) {
        setMesSelecionadoIndex(mesInicial);
      }
      if (anoInicial !== undefined && anoInicial !== null) {
        setAnoSelecionado(anoInicial);
      }
      setSucessoMsg('');

      // Se for acionado autoDownload direto, aguarda montagem do DOM
      if (autoDownload) {
        const timer = setTimeout(() => {
          handleDownloadPdf(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, mesInicial, anoInicial, autoDownload]);

  // Lista de anos disponíveis com base nos diaristas + ano atual
  const anosDisponiveis = useMemo(() => {
    const setAnos = new Set([agora.getFullYear(), anoSelecionado]);
    diaristas.forEach(d => {
      if (d.data) {
        const ano = parseInt(d.data.split('-')[0], 10);
        if (!isNaN(ano)) setAnos.add(ano);
      }
    });
    return Array.from(setAnos).sort((a, b) => b - a);
  }, [diaristas, anoSelecionado]);

  // Formata mês com dois dígitos (01 - 12)
  const mesFormatado = String(mesSelecionadoIndex + 1).padStart(2, '0');
  const prefixoMesAno = `${anoSelecionado}-${mesFormatado}`;
  const nomeMesExtenso = MESES[mesSelecionadoIndex];

  // Quantidade de dias no mês selecionado
  const ultimoDiaMes = new Date(anoSelecionado, mesSelecionadoIndex + 1, 0).getDate();
  const periodoFormatado = `01/${mesFormatado}/${anoSelecionado} a ${String(ultimoDiaMes).padStart(2, '0')}/${mesFormatado}/${anoSelecionado}`;

  // =========================================================================
  // CONSOLIDAÇÃO DOS DIARISTAS DO MÊS (SEM REPETIÇÃO DE NOMES)
  // =========================================================================
  const diaristasConsolidados = useMemo(() => {
    const mapa = new Map();

    diaristas.forEach(d => {
      if (!d.data || !d.data.startsWith(prefixoMesAno)) return;

      const nomeLimpo = (d.nome || '').trim().toUpperCase();
      if (!nomeLimpo) return;

      const qtdDiarias = parseInt(d.diarias, 10) || 1;
      const valorUnitario = parseFloat(d.valor) || 0;
      const valorTotalItem = (d.total !== undefined && d.total !== null)
        ? parseFloat(d.total)
        : (valorUnitario * qtdDiarias);

      const profissao = (d.motorista || d.profissao || 'Diarista Geral').trim();
      const pix = (d.pix || d.chavePix || '').trim();

      if (!mapa.has(nomeLimpo)) {
        mapa.set(nomeLimpo, {
          nome: nomeLimpo,
          profissao: profissao || 'Diarista Geral',
          quantidadeDiarias: qtdDiarias,
          valorTotal: valorTotalItem,
          chavePix: pix,
          diasTrabalhados: [d.data],
          registrosOriginais: 1
        });
      } else {
        const registro = mapa.get(nomeLimpo);
        registro.quantidadeDiarias += qtdDiarias;
        registro.valorTotal += valorTotalItem;
        registro.registrosOriginais += 1;
        if (d.data && !registro.diasTrabalhados.includes(d.data)) {
          registro.diasTrabalhados.push(d.data);
        }
        if ((!registro.profissao || registro.profissao === 'Diarista Geral') && profissao) {
          registro.profissao = profissao;
        }
      }
    });

    // Ordenação alfabética por nome
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [diaristas, prefixoMesAno]);

  // Totais do Mês
  const totalDiaristasUnicos = diaristasConsolidados.length;
  const totalDiariasMes = diaristasConsolidados.reduce((acc, curr) => acc + curr.quantidadeDiarias, 0);
  const totalValorMes = diaristasConsolidados.reduce((acc, curr) => acc + curr.valorTotal, 0);

  // =========================================================================
  // DIVISÃO INTELIGENTE EM LAUDAS A4 (SEM CORTES)
  // =========================================================================
  const laudasData = useMemo(() => {
    const lista = diaristasConsolidados;
    const totalItens = lista.length;

    // Se houver 0 ou até 11 itens, cabe perfeitamente em 1 lauda
    if (totalItens <= 11) {
      return [{
        numero: 1,
        diaristas: lista,
        isPrimeira: true,
        isUltima: true,
        indexInicial: 0
      }];
    }

    // Caso contrário, divide em laudas com paginação oficial:
    // Lauda 1: cabeçalho completo + 3 cards + 11 diaristas
    // Laudas seguintes: cabeçalho compacto + até 15 diaristas
    const resultado = [];
    const ITENS_P1 = 11;
    const ITENS_OUTRAS = 14;

    resultado.push({
      numero: 1,
      diaristas: lista.slice(0, ITENS_P1),
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
        diaristas: lista.slice(cursor, cursor + qtdParaPegar),
        isPrimeira: false,
        isUltima,
        indexInicial: cursor
      });

      cursor += qtdParaPegar;
      numLauda++;
    }

    return resultado;
  }, [diaristasConsolidados]);

  // =========================================================================
  // GERAÇÃO DE PDF EM MÚLTIPLAS LAUDAS OFICIAIS A4
  // =========================================================================
  async function handleDownloadPdf(fecharAoConcluir = false) {
    const laudaEls = document.querySelectorAll('.lauda-relatorio-pdf');
    if (!laudaEls || laudaEls.length === 0) return;
    setGerandoPdf(true);
    setSucessoMsg('');

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < laudaEls.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const imgData = await toJpeg(laudaEls[i], {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });

        // 210mm x 297mm preenche perfeitamente a página A4 inteira sem cortes
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const nomeArquivo = `Relatorio_Mensal_Diaristas_${nomeMesExtenso}_${anoSelecionado}_Irmaos_Barreiro.pdf`;
      pdf.save(nomeArquivo);

      setSucessoMsg(`Relatório de ${nomeMesExtenso}/${anoSelecionado} baixado com sucesso! (${laudaEls.length} lauda${laudaEls.length > 1 ? 's' : ''})`);
      setTimeout(() => setSucessoMsg(''), 4000);

      if (fecharAoConcluir) {
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Erro ao gerar PDF do relatório mensal:', err);
      alert('Houve um erro ao gerar o arquivo PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  }

  function handleImprimir() {
    window.print();
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-6 flex flex-col max-h-[94vh]">
        
        {/* ================================================================= */}
        {/* TOPO MODAL: CONTROLES DE MÊS, ANO E AÇÕES                         */}
        {/* ================================================================= */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 text-white p-5 sm:p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wider text-red-300">
                <Sparkles className="w-3 h-3 text-red-400" />
                <span>Emissão Oficial em PDF ({laudasData.length} {laudasData.length === 1 ? 'lauda' : 'laudas'})</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Relatório Mensal de Diaristas
              </h2>
            </div>
          </div>

          {/* Seletores Rápidos de Mês e Ano */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-zinc-800/90 px-3 py-1.5 rounded-2xl border border-zinc-700">
              <Calendar className="w-4 h-4 text-red-400" />
              <label htmlFor="select-relatorio-mes" className="text-xs text-zinc-400 font-bold">Mês:</label>
              <select
                id="select-relatorio-mes"
                value={mesSelecionadoIndex}
                onChange={(e) => setMesSelecionadoIndex(parseInt(e.target.value, 10))}
                className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer"
              >
                {MESES.map((m, idx) => (
                  <option key={m} value={idx} className="bg-zinc-900 text-white">
                    {m}
                  </option>
                ))}
              </select>

              <span className="text-zinc-600">|</span>

              <label htmlFor="select-relatorio-ano" className="text-xs text-zinc-400 font-bold">Ano:</label>
              <select
                id="select-relatorio-ano"
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(parseInt(e.target.value, 10))}
                className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer"
              >
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a} className="bg-zinc-900 text-white">
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão Baixar PDF */}
            <button
              id="btn-baixar-pdf-mensal"
              onClick={() => handleDownloadPdf(false)}
              disabled={gerandoPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50"
              title="Gerar e Baixar arquivo PDF deste mês"
            >
              <Download className={`w-4 h-4 ${gerandoPdf ? 'animate-bounce' : ''}`} />
              <span>{gerandoPdf ? 'GERANDO PDF...' : 'BAIXAR PDF'}</span>
            </button>

            {/* Botão Imprimir */}
            <button
              onClick={handleImprimir}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition cursor-pointer"
              title="Imprimir relatório"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* Botão Fechar */}
            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-zinc-800 hover:bg-red-600/30 text-zinc-300 hover:text-white border border-zinc-700 transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificação de Progresso ou Sucesso */}
        {gerandoPdf && (
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 text-xs font-black flex items-center justify-between shadow-inner no-print animate-pulse">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
              <span>Gerando Relatório Oficial em PDF ({laudasData.length} lauda{laudasData.length > 1 ? 's' : ''})... O download iniciará em instantes!</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
              Processando Laudas A4
            </span>
          </div>
        )}

        {sucessoMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-6 py-2.5 text-xs font-bold flex items-center justify-between no-print">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {sucessoMsg}
            </span>
          </div>
        )}

        {/* ================================================================= */}
        {/* CORPO DO MODAL: RENDERIZAÇÃO DAS LAUDAS A4 OFICIAIS               */}
        {/* ================================================================= */}
        <div 
          ref={containerLaudasRef}
          className="overflow-y-auto p-4 sm:p-8 bg-zinc-200/80 flex-grow flex flex-col items-center gap-8"
        >
          {laudasData.map((lauda) => (
            <div
              key={`lauda-${lauda.numero}`}
              className="lauda-relatorio-pdf w-[800px] min-h-[1130px] max-h-[1130px] bg-white text-zinc-950 p-10 rounded-xl shadow-2xl border border-zinc-300 flex flex-col justify-between shrink-0 relative overflow-hidden"
              style={{
                boxSizing: 'border-box',
                aspectRatio: '210 / 297'
              }}
            >
              <div>
                {/* 1. CABEÇALHO DA LAUDA */}
                {lauda.isPrimeira ? (
                  // Cabeçalho Completo Oficial na Lauda 1
                  <div className="border-b-4 border-red-600 pb-4 mb-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Logo className="h-12 w-auto" />
                        <div className="border-l-2 border-zinc-200 pl-3">
                          <h1 className="text-base font-black tracking-tight text-zinc-900 leading-tight uppercase">
                            Distribuidora Irmãos Barreiro
                          </h1>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            De Bebidas Ltda. • CNPJ: 01.688.096/0001-95 • Financeiro
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-zinc-500">
                        <p className="font-semibold">
                          Emissão: <strong className="text-zinc-800">{new Date().toLocaleDateString('pt-BR')}</strong> às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-red-600 font-black uppercase text-[11px]">
                          Documento Oficial de Pagamento
                        </p>
                      </div>
                    </div>

                    {/* Título Principal */}
                    <div className="mt-3 pt-3 border-t border-zinc-100 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white rounded-xl p-3.5 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-red-200 block">
                            Relação Consolidada de Diaristas
                          </span>
                          <h2 className="text-lg font-black uppercase tracking-tight text-white leading-tight">
                            RELATÓRIO MENSAL — {nomeMesExtenso} de {anoSelecionado}
                          </h2>
                        </div>
                        <div className="bg-black/30 px-3 py-1 rounded-lg border border-white/20 text-right">
                          <span className="text-[8px] uppercase font-bold text-red-100 block">Período de Apuração:</span>
                          <span className="text-[11px] font-black text-white">{periodoFormatado}</span>
                        </div>
                      </div>
                    </div>

                    {/* Banner com os 3 cards estatísticos */}
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">
                          Diaristas Únicos
                        </span>
                        <span className="text-base font-black text-zinc-900">
                          {totalDiaristasUnicos}
                        </span>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">
                          Total de Diárias
                        </span>
                        <span className="text-base font-black text-zinc-900">
                          {totalDiariasMes}
                        </span>
                      </div>

                      <div className="bg-red-50/80 border border-red-200 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-red-700 block">
                          Valor Total do Mês
                        </span>
                        <span className="text-base font-black text-red-700">
                          R$ {totalValorMes.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Cabeçalho Compacto de Continuação para Laudas 2, 3...
                  <div className="border-b-2 border-red-600 pb-2.5 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Logo className="h-8 w-auto" />
                      <div className="border-l border-zinc-300 pl-2.5">
                        <span className="text-xs font-black uppercase tracking-tight text-zinc-900 block">
                          Distribuidora Irmãos Barreiro
                        </span>
                        <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider">
                          Relatório Mensal — {nomeMesExtenso} de {anoSelecionado} (Continuação)
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[9px] text-zinc-500">
                      <p>Período: <strong className="text-zinc-800">{periodoFormatado}</strong></p>
                      <p className="font-bold text-red-700">Lauda {lauda.numero} de {laudasData.length}</p>
                    </div>
                  </div>
                )}

                {/* 2. TABELA DOS DIARISTAS DA LAUDA */}
                <div className="overflow-hidden border border-zinc-300 rounded-lg">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-red-700 to-red-800 text-white font-black uppercase text-[10px] tracking-wider">
                        <th className="py-2 px-2.5 border border-red-900 w-10 text-center">#</th>
                        <th className="py-2 px-3 border border-red-900">Nome do Diarista</th>
                        <th className="py-2 px-3 border border-red-900">Função</th>
                        <th className="py-2 px-2.5 border border-red-900 text-center w-24">Qtd. Diárias</th>
                        <th className="py-2 px-3 border border-red-900 text-right w-32">Valor Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lauda.diaristas.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-zinc-500 border border-zinc-200 bg-zinc-50/50">
                            <AlertCircle className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                            <p className="font-bold text-xs text-zinc-700">
                              Nenhum diarista cadastrado em {nomeMesExtenso} de {anoSelecionado}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        lauda.diaristas.map((diarista, idx) => {
                          const numGlobal = lauda.indexInicial + idx + 1;
                          const isPar = idx % 2 === 1;
                          return (
                            <tr
                              key={`diarista-row-${diarista.nome}-${numGlobal}`}
                              className={`${isPar ? 'bg-zinc-50/70' : 'bg-white'} border-b border-zinc-200`}
                            >
                              <td className="py-2 px-2.5 border-r border-zinc-200 text-center font-bold text-zinc-500">
                                {numGlobal}
                              </td>
                              <td className="py-2 px-3 border-r border-zinc-200 font-black text-zinc-950 uppercase tracking-tight">
                                {diarista.nome}
                              </td>
                              <td className="py-2 px-3 border-r border-zinc-200 font-semibold text-zinc-700">
                                {diarista.profissao}
                              </td>
                              <td className="py-2 px-2.5 border-r border-zinc-200 text-center font-black text-zinc-900">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[10px]">
                                  {diarista.quantidadeDiarias}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-black text-red-700 text-xs whitespace-nowrap bg-red-50/30">
                                R$ {diarista.valorTotal.toFixed(2).replace('.', ',')}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>

                    {/* Rodapé da tabela com Totais (Apenas na Última Lauda) */}
                    {lauda.isUltima && (
                      <tfoot>
                        <tr className="bg-zinc-900 text-white font-black text-[11px]">
                          <td colSpan="3" className="py-2.5 px-3 uppercase tracking-wider text-left border border-zinc-800">
                            TOTAL DO MÊS ({nomeMesExtenso.toUpperCase()} / {anoSelecionado})
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-amber-400 font-black border border-zinc-800">
                            {totalDiariasMes} {totalDiariasMes === 1 ? 'diária' : 'diárias'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-black text-xs border border-zinc-800 whitespace-nowrap bg-zinc-950">
                            R$ {totalValorMes.toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Nota Legal e de Consolidação (Apenas na Última Lauda) */}
                {lauda.isUltima && (
                  <div className="mt-3 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[9px] text-zinc-500 leading-snug">
                    <p>
                      * <strong>Regra de Consolidação Mensal:</strong> Todos os lançamentos de um mesmo diarista efetuados no mês de {nomeMesExtenso} de {anoSelecionado} foram devidamente unificados em uma única linha, sem duplicidade de nomes, com a somatória integral de diárias prestadas e respectivos valores financeiros.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. RODAPÉ DA LAUDA & ASSINATURAS */}
              <div>
                {lauda.isUltima ? (
                  // Bloco de Assinaturas na Última Lauda
                  <div className="pt-4 border-t-2 border-zinc-300">
                    <div className="grid grid-cols-2 gap-8 text-center text-[10px]">
                      <div>
                        <div className="border-t border-zinc-800 w-48 mx-auto mb-1"></div>
                        <p className="font-black text-zinc-900 uppercase">Responsável Financeiro</p>
                        <p className="text-[9px] text-zinc-500">Distribuidora Irmãos Barreiro de Bebidas Ltda.</p>
                      </div>

                      <div>
                        <div className="border-t border-zinc-800 w-48 mx-auto mb-1"></div>
                        <p className="font-black text-zinc-900 uppercase">Gerência Administrativa / RH</p>
                        <p className="text-[9px] text-zinc-500">Conferência e Quitação de Diárias</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between text-[8px] text-zinc-400">
                      <span>Distribuidora Irmãos Barreiro de Bebidas Ltda. • Sistema de Gestão e Controle Operacional</span>
                      <span className="font-bold text-zinc-600">Lauda {lauda.numero} de {laudasData.length}</span>
                    </div>
                  </div>
                ) : (
                  // Rodapé Simples nas Laudas Intermediárias
                  <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-[8px] text-zinc-400">
                    <span>Distribuidora Irmãos Barreiro • Relatório Mensal ({nomeMesExtenso}/{anoSelecionado}) — Continua na próxima lauda</span>
                    <span className="font-black text-red-600 text-[9px]">Lauda {lauda.numero} de {laudasData.length}</span>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>,
    document.body
  );
}
