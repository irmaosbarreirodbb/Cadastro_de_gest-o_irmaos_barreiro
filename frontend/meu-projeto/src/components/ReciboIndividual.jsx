import React, { useState, useEffect, useMemo } from 'react';
import { getDiaristasApi, emitirReciboApi } from '../services/api';
import {
  FileText,
  Printer,
  ArrowLeft,
  Copy,
  Check,
  User,
  Calendar,
  Receipt,
  Save,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function numeroPorExtenso(valor) {
  const v = parseFloat(valor) || 0;
  const inteiros = Math.floor(v);
  const unidades = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
  const especiais = ['Dez', 'Onze', 'Doze', 'Treze', 'Quatorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove'];
  const dezenas = ['', 'Dez', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa'];
  const centenas = ['', 'Cento', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos'];
  if (inteiros === 0) return 'Zero Reais';
  if (inteiros === 100) return 'Cem Reais';
  let extenso = '';
  if (inteiros >= 1000) {
    const mil = Math.floor(inteiros / 1000);
    const restoMil = inteiros % 1000;
    extenso += (mil === 1 ? 'Mil' : `${unidades[mil]} Mil`);
    if (restoMil > 0) extenso += ' e ';
  }
  const c = Math.floor((inteiros % 1000) / 100);
  const restoC = inteiros % 100;
  if (c > 0) { extenso += centenas[c]; if (restoC > 0) extenso += ' e '; }
  if (restoC >= 10 && restoC <= 19) {
    extenso += especiais[restoC - 10];
  } else if (restoC > 0) {
    const d = Math.floor(restoC / 10);
    const u = restoC % 10;
    if (d > 0) { extenso += dezenas[d]; if (u > 0) extenso += ' e '; }
    if (u > 0) extenso += unidades[u];
  }
  return extenso.trim() + (inteiros === 1 ? ' Real' : ' Reais');
}

function getHojeISO() {
  return new Date().toISOString().split('T')[0];
}

function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataRecibo(dataISO) {
  return dataISO ? formatarDataBR(dataISO) : 'Data não informada';
}

function formatarDataPorExtenso(dataStr) {
  const str = dataStr || getHojeISO();
  try {
    const [ano, mes, dia] = str.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `Cascavel, ${parseInt(dia, 10)} de ${meses[parseInt(mes, 10) - 1]} de ${ano}`;
  } catch {
    const hoje = new Date();
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `Cascavel, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  }
}

/** Retorna a segunda (0=Dom,1=Seg) e o sábado da semana de uma data ISO */
function getSemana(dataISO) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  const diaSem = d.getDay(); // 0=Dom
  const diffSeg = (diaSem === 0 ? -6 : 1 - diaSem);
  const seg = new Date(d); seg.setDate(d.getDate() + diffSeg);
  const sab = new Date(seg); sab.setDate(seg.getDate() + 5);
  // gerar array de 6 dias: seg → sab
  const dias = [];
  for (let i = 0; i <= 5; i++) {
    const dt = new Date(seg); dt.setDate(seg.getDate() + i);
    dias.push(dt.toISOString().split('T')[0]);
  }
  return { inicio: seg.toISOString().split('T')[0], fim: sab.toISOString().split('T')[0], dias };
}

/** Retorna todos os dias do mês de uma data ISO */
function getDiasMes(dataISO) {
  const [ano, mes] = dataISO.split('-').map(Number);
  const total = new Date(ano, mes, 0).getDate();
  const dias = [];
  for (let d = 1; d <= total; d++) {
    dias.push(`${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dias;
}

function normalizarNome(nome) {
  return (nome || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

function valorDoLancamento(lancamento) {
  if (lancamento.valor_total != null) return parseFloat(lancamento.valor_total) || 0;
  return (parseFloat(lancamento.valor_diaria ?? lancamento.valor) || 0)
    * (parseInt(lancamento.quantidade_diarias ?? lancamento.diarias, 10) || 1);
}

// ─── Componente de Impressão ───────────────────────────────────────────────────

function ReciboImpressao({ tipo, nome, cpf, pix, total, dataEmissao, empresa, numeroRecibo }) {
  const valorExtenso = numeroPorExtenso(total);
  const dataExt = formatarDataPorExtenso(dataEmissao);
  const totalFormatado = total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Texto do referente adaptado por tipo
  const textoReferente = (() => {
    if (tipo === 'diaria') {
      return `diária por serviços prestados nesta data`;
    } else if (tipo === 'semanal') {
      return `diárias por serviços prestados nesta semana`;
    } else {
      return `diárias por serviços prestados neste mês`;
    }
  })();

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-zinc-300 p-10 sm:p-14 text-zinc-950 font-serif print:p-[30px] print:border-none print:shadow-none print:rounded-none">

      {/* ── Cabeçalho: "Recibo" + valor (Idêntico ao documento físico) ── */}
      <div className="flex items-baseline justify-between mb-8 border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold font-serif tracking-tight text-zinc-900">Recibo</h1>
          {numeroRecibo && (
            <span className="text-xs font-sans font-black text-zinc-500 uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300">
              Nº {numeroRecibo}
            </span>
          )}
        </div>
        <div className="text-3xl font-black font-sans tracking-tight text-zinc-900">
          R$ {totalFormatado}
        </div>
      </div>

      {/* ── Corpo principal com texto formal ── */}
      <div className="space-y-6">
        <p className="text-[15px] sm:text-[16px] leading-relaxed text-justify indent-10 text-zinc-900">
          Recebi da{' '}
          <strong className="font-extrabold uppercase tracking-wide text-zinc-950">
            {empresa}
          </strong>{' '}
          a importância da supra referente ao pagamento de {textoReferente}.
        </p>

        <p className="text-[15px] sm:text-[16px] leading-relaxed text-justify indent-10 text-zinc-900">
          Onde firmo o presente dando plena e total quitação, para os devidos fins e efeitos legais.
        </p>
      </div>

      {/* ── Rodapé: Data por extenso, linha de assinatura, Nome e PIX ── */}
      <div className="mt-10 sm:mt-12 space-y-6">
        <div className="text-center text-[15px] font-serif text-zinc-900">
          {dataExt}.
        </div>

        <div className="flex flex-col items-center justify-center gap-1.5 pt-2">
          <div className="w-80 sm:w-96 border-t border-zinc-900" />
          <div className="font-bold text-base font-sans uppercase tracking-tight text-zinc-950">
            {nome || '________________________________________'}
          </div>
          {pix && (
            <div className="text-sm font-sans font-semibold text-zinc-800">
              PIX: {pix}
            </div>
          )}
          {cpf && cpf !== pix && (
            <div className="text-sm font-sans font-medium text-zinc-600">
              CPF: {cpf}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ReciboIndividual({ diaristaInicial, diaristas = [], onUpdateDiarista, onBack }) {
  const [tipoRecibo, setTipoRecibo] = useState('diaria'); // 'diaria' | 'semanal' | 'mensal'

  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    pix: '',
    valorUnitario: 120.0,
    dataRef: getHojeISO(),
    empresa: 'DISTRIBUIDORA IRMÃOS BARREIRO DE BEBIDAS LTDA',
  });

  const [diaristaId, setDiaristaId] = useState(null);
  const [pessoaSelecionada, setPessoaSelecionada] = useState('');
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [reciboSalvo, setReciboSalvo] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  // Dias com valores buscados do banco para o período
  const [lancamentosPeriodo, setLancamentosPeriodo] = useState([]);
  const [carregandoDias, setCarregandoDias] = useState(false);

  // Preenche form com diarista inicial vindo da relação
  useEffect(() => {
    if (diaristaInicial) {
      setDiaristaId(diaristaInicial.id);
      setPessoaSelecionada(diaristaInicial.id);
      setReciboSalvo(null);
      setForm(prev => ({
        ...prev,
        nome: diaristaInicial.nome || '',
        cpf: diaristaInicial.tipoPix === 'cpf' ? diaristaInicial.pix : (diaristaInicial.cpf || ''),
        pix: diaristaInicial.pix || diaristaInicial.chavePix || '',
        valorUnitario: parseFloat(diaristaInicial.valor) || 120.0,
        dataRef: diaristaInicial.data || getHojeISO(),
      }));
    }
  }, [diaristaInicial]);

  // Quando tipo ou data de ref muda, busca os dias do período
  useEffect(() => {
    buscarDiasPeriodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoRecibo, form.dataRef]);

  async function buscarDiasPeriodo() {
    setCarregandoDias(true);
    try {
      let diasISO = [];
      if (tipoRecibo === 'diaria') {
        diasISO = [form.dataRef];
      } else if (tipoRecibo === 'semanal') {
        diasISO = getSemana(form.dataRef).dias;
      } else {
        diasISO = getDiasMes(form.dataRef);
      }

      // Busca diaristas do banco para o período
      let dadosBanco = [];
      if (tipoRecibo === 'diaria') {
        // No modo diário, disponibiliza todos os lançamentos para escolha,
        // sempre identificados pela data no seletor.
        const res = await getDiaristasApi();
        dadosBanco = Array.isArray(res) ? res : [];
      } else if (tipoRecibo === 'semanal') {
        // Busca cada dia da semana
        const semana = getSemana(form.dataRef);
        const promises = semana.dias.map(d => getDiaristasApi(d).catch(() => []));
        const results = await Promise.all(promises);
        dadosBanco = results.flat();
      } else {
        const [ano, mes] = form.dataRef.split('-');
        const mesISO = `${ano}-${mes}`;
        const res = await getDiaristasApi(null, mesISO);
        dadosBanco = Array.isArray(res) ? res : [];
      }

      // Filtra pelo nome do diarista (case-insensitive)
      const nomeFiltro = form.nome?.trim().toLowerCase();
      const filtrados = nomeFiltro
        ? dadosBanco.filter(d => d.nome?.toLowerCase().includes(nomeFiltro))
        : dadosBanco;

      // Monta mapa: data -> valor total do diarista
      const mapaValores = {};
      filtrados.forEach(d => {
        if (d.data) {
          const v = (parseFloat(d.valor_diaria) || 0) * (parseInt(d.quantidade_diarias, 10) || 1);
          mapaValores[d.data] = (mapaValores[d.data] || 0) + v;
        }
      });

      // Monta lista de dias do período
      const lista = diasISO.map(data => ({
        data,
        valor: mapaValores[data] || 0,
      }));

      setLancamentosPeriodo(dadosBanco);
    } catch (err) {
      console.warn('Erro ao buscar dias do período:', err);
      // Fallback: usa valor unitário do form
      let diasISO = [];
      if (tipoRecibo === 'diaria') diasISO = [form.dataRef];
      else if (tipoRecibo === 'semanal') diasISO = getSemana(form.dataRef).dias;
      else diasISO = getDiasMes(form.dataRef);
      setLancamentosPeriodo([]);
    } finally {
      setCarregandoDias(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleSelecionarDiarista(e) {
    const chave = e.target.value;
    if (!chave) return;
    const sel = diaristasDoPeriodo.find(d => d.chave === chave);
    if (sel) {
      setDiaristaId(sel.id);
      setPessoaSelecionada(chave);
      setReciboSalvo(null);
      setForm(prev => ({
        ...prev,
        nome: sel.nome || '',
        cpf: sel.cpf || prev.cpf,
        pix: sel.pix || prev.pix || '',
        valorUnitario: parseFloat(sel.valor) || 0,
        dataRef: tipoRecibo === 'diaria' && sel.data ? sel.data : prev.dataRef,
      }));
    }
  }

  // Total calculado com base nos dias que têm valor
  const diaristasDoPeriodo = useMemo(() => {
    // No recibo diário, cada lançamento do dia é uma opção independente.
    // Assim, a mesma pessoa pode ter valores diferentes no mesmo dia.
    if (tipoRecibo === 'diaria') {
      return lancamentosPeriodo.map(d => ({
        chave: d.id,
        id: d.id,
        nome: d.nome || '',
        cpf: d.tipo_pix === 'cpf' ? d.chave_pix : (d.cpf || ''),
        pix: d.chave_pix || d.pix || '',
        data: d.data,
        valor: d.valor_diaria ?? d.valor ?? 0,
        diarias: d.quantidade_diarias ?? d.diarias ?? 1,
        total: valorDoLancamento(d),
      })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    const agrupados = new Map();
    lancamentosPeriodo.forEach(d => {
      const chave = normalizarNome(d.nome);
      if (!chave) return;
      const atual = agrupados.get(chave);
      const valor = valorDoLancamento(d);
      agrupados.set(chave, atual
        ? { ...atual, total: atual.total + valor, valor: atual.total + valor, diarias: 1 }
        : { chave, id: d.id, nome: d.nome || '', cpf: d.tipo_pix === 'cpf' ? d.chave_pix : (d.cpf || ''), pix: d.chave_pix || d.pix || '', valor, diarias: 1, total: valor });
    });
    return [...agrupados.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [tipoRecibo, lancamentosPeriodo]);

  const diasComValor = useMemo(() => {
    const dias = tipoRecibo === 'diaria'
      ? [form.dataRef]
      : tipoRecibo === 'semanal'
        ? getSemana(form.dataRef).dias
        : getDiasMes(form.dataRef);
    const pessoa = normalizarNome(form.nome);
    return dias.map(data => ({
      data,
      valor: lancamentosPeriodo
        .filter(d => d.data === data && (
          tipoRecibo === 'diaria'
            ? (diaristaId ? (d.id === diaristaId || normalizarNome(d.nome) === pessoa) : normalizarNome(d.nome) === pessoa)
            : normalizarNome(d.nome) === pessoa
        ))
        .reduce((total, d) => total + valorDoLancamento(d), 0),
    }));
  }, [tipoRecibo, form.dataRef, form.nome, diaristaId, lancamentosPeriodo]);
  const totalGeral = diasComValor.reduce((acc, d) => acc + d.valor, 0);

  // Se nenhum dia tem valor do banco, usa o valor unitário informado no formulário
  const diasParaExibir = (() => {
    const temValorBanco = diasComValor.some(d => d.valor > 0);
    if (temValorBanco) return diasComValor;
    const fallbackUnitario = parseFloat(form.valorUnitario) || 0;
    return diasComValor.map(d => ({
      ...d,
      valor: fallbackUnitario,
    }));
  })();
  const totalExibido = diasParaExibir.reduce((acc, d) => acc + d.valor, 0);

  async function handleSalvarRecibo(silent = false) {
    try {
      setSalvando(true);
      setMensagemErro('');
      setMensagemSucesso('');
      const payload = {
        diarista_id: diaristaId || null,
        nome_diarista: form.nome || 'Não informado',
        cpf_diarista: form.cpf || null,
        funcao: null,
        valor_unitario: parseFloat(form.valorUnitario) || 0,
        dias_trabalhados: diasParaExibir.filter(d => d.valor > 0).length || 1,
        tem_almoco: false,
        valor_almoco: 0.0,
        valor_total: totalExibido,
        valor_extenso: numeroPorExtenso(totalExibido),
        tipo_pix: 'cpf',
        chave_pix: null,
        data_referencia: form.dataRef || getHojeISO(),
        status_pagamento: true,
        observacoes: `Recibo ${tipoRecibo}`,
      };
      const resultado = await emitirReciboApi(payload);
      setReciboSalvo(resultado);
      setMensagemSucesso(`Recibo nº ${resultado.numero_recibo} registrado com sucesso!`);
      return resultado;
    } catch (err) {
      if (!silent) setMensagemErro(err.message || 'Erro ao registrar recibo.');
      return null;
    } finally {
      setSalvando(false);
    }
  }

  async function handleImprimir() {
    if (!reciboSalvo) await handleSalvarRecibo(true);
    window.print();
  }

  const labelTipo = tipoRecibo === 'diaria' ? 'Diária' : tipoRecibo === 'semanal' ? 'Semanal' : 'Mensal';

  return (
    <div className="space-y-6">

      {/* ── Barra de Navegação ─────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-zinc-200/80 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-all shadow-xs cursor-pointer group"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-red-700 text-xs font-black uppercase tracking-wider mb-1.5 shadow-xs">
              <Receipt className="w-3.5 h-3.5 text-red-600" />
              <span>Emissão Oficial</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              Recibos — <span className="text-red-600">{labelTipo}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleSalvarRecibo(false)}
            disabled={salvando}
            className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition cursor-pointer disabled:opacity-60 ${reciboSalvo
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                : 'bg-zinc-900 hover:bg-black text-white shadow-zinc-900/30 hover:shadow-zinc-900/50 transform hover:-translate-y-0.5'
              }`}
          >
            {salvando ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Salvando...</span></>
            ) : reciboSalvo ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-200" /><span>Salvo ({reciboSalvo.numero_recibo})</span></>
            ) : (
              <><Save className="w-4 h-4 text-zinc-300" /><span>Salvar no Banco</span></>
            )}
          </button>

          <button
            onClick={handleImprimir}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-sm shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transform hover:-translate-y-0.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Recibo</span>
          </button>
        </div>
      </div>

      {/* ── Feedbacks ─────────────────────────────────────── */}
      {mensagemSucesso && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl flex items-center justify-between shadow-md no-print">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="font-bold text-sm">{mensagemSucesso}</p>
          </div>
          <button onClick={() => setMensagemSucesso('')} className="text-xs text-emerald-600 hover:text-emerald-900 font-bold px-2 py-1 rounded-lg">Fechar</button>
        </div>
      )}
      {mensagemErro && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-2xl flex items-center justify-between shadow-md no-print">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="font-bold text-sm">{mensagemErro}</p>
          </div>
          <button onClick={() => setMensagemErro('')} className="text-xs text-red-600 hover:text-red-900 font-bold px-2 py-1 rounded-lg">Fechar</button>
        </div>
      )}

      {/* ── Grid Principal ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Painel de Configuração ── */}
        <div className="lg:col-span-5 space-y-5 no-print">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-7 shadow-xl border border-zinc-200/80 space-y-5">

            {/* Tipo de recibo */}
            <div>
              <label className="block text-xs font-black uppercase text-red-700 mb-3 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Tipo de Recibo
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'diaria', label: 'Diária', icon: CalendarDays, desc: 'Somente o dia selecionado' },
                  { id: 'semanal', label: 'Semanal', icon: CalendarRange, desc: 'Segunda a Sábado' },
                  { id: 'mensal', label: 'Mensal', icon: CalendarCheck, desc: 'Todo o mês' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const ativo = tipoRecibo === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                       onClick={() => { setTipoRecibo(opt.id); setPessoaSelecionada(''); setReciboSalvo(null); }}
                      className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${ativo
                          ? 'border-red-500 bg-red-50 text-red-700 shadow-md shadow-red-100'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                    >
                      <Icon className={`w-5 h-5 ${ativo ? 'text-red-600' : 'text-zinc-400'}`} />
                      <span className={`text-xs font-black ${ativo ? 'text-red-700' : 'text-zinc-700'}`}>{opt.label}</span>
                      <span className="text-[10px] leading-tight text-zinc-500">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4 space-y-4">

              {/* Selecionar diarista cadastrado */}
               {diaristasDoPeriodo.length > 0 && (
                <div>
                  <label className="block text-xs font-black uppercase text-red-700 mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Preencher com Diarista Cadastrado
                  </label>
                  <select
                    onChange={handleSelecionarDiarista}
                     value={pessoaSelecionada}
                    className="w-full px-4 py-3 rounded-2xl border border-red-200 bg-red-50/50 text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  >
                    <option value="" disabled>Selecione um diarista para autopreencher...</option>
                     {diaristasDoPeriodo.map(d => (
                       <option key={d.chave} value={d.chave}>
                         {d.nome} — R$ {((parseFloat(d.valor) || 0) * (d.diarias || 1)).toFixed(2).replace('.', ',')}{tipoRecibo === 'diaria' ? ` — ${formatarDataRecibo(d.data)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">Nome do Diarista</label>
                <input
                  type="text"
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  placeholder="Nome completo"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white"
                />
              </div>

              {/* CPF e PIX */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">CPF</label>
                  <input
                    type="text"
                    name="cpf"
                    value={form.cpf}
                    onChange={handleChange}
                    placeholder="000.000.000-00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">Chave PIX</label>
                  <input
                    type="text"
                    name="pix"
                    value={form.pix}
                    onChange={handleChange}
                    placeholder="Chave PIX ou telefone"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white"
                  />
                </div>
              </div>

              {/* Data de Referência */}
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                  {tipoRecibo === 'diaria' ? 'Data' : tipoRecibo === 'semanal' ? 'Qualquer dia da Semana' : 'Qualquer dia do Mês'}
                </label>
                <input
                  type="date"
                  name="dataRef"
                  value={form.dataRef}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white"
                />
              </div>

              {/* Valor unitário */}
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1.5">
                  Valor por Diária (R$) — usado se não houver dado no banco
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    name="valorUnitario"
                    value={form.valorUnitario}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-300 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white"
                  />
                </div>
              </div>

              {/* Buscar dias */}
              <button
                type="button"
                onClick={buscarDiasPeriodo}
                disabled={carregandoDias}
                className="w-full py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                {carregandoDias ? (
                  <><div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" /><span>Buscando dias...</span></>
                ) : (
                  <><Calendar className="w-3.5 h-3.5" /><span>Atualizar dados do período</span></>
                )}
              </button>
            </div>

            {/* Card Total */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black text-red-200 uppercase block tracking-wider">
                  Total {labelTipo}:
                </span>
                <span className="text-xs text-red-100 font-semibold">
                  {diasParaExibir.filter(d => d.valor > 0).length} dia(s) com valor
                </span>
              </div>
              <div className="text-2xl font-black tracking-tight">
                R$ {totalExibido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

          </div>
        </div>

        {/* ── Prévia do Recibo ── */}
        <div className="lg:col-span-7">
          <ReciboImpressao
            tipo={tipoRecibo}
            nome={form.nome}
            cpf={form.cpf}
            pix={form.pix}
            total={totalExibido}
            dataEmissao={form.dataRef}
            empresa={form.empresa}
            numeroRecibo={reciboSalvo?.numero_recibo}
          />
        </div>

      </div>
    </div>
  );
}
