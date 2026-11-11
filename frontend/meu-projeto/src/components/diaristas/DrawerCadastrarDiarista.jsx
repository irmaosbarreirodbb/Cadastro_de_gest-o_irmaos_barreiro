import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  UserPlus, 
  DollarSign, 
  Calendar, 
  Clock, 
  KeyRound, 
  Sparkles, 
  Check, 
  Truck, 
  AlertCircle, 
  Database, 
  Search, 
  UserCheck 
} from 'lucide-react';
import { getDiaristasApi } from '../../services/api';

const TIPOS_PIX = [
  { valor: 'cpf', label: 'CPF' },
  { valor: 'telefone', label: 'Celular/Tel' },
  { valor: 'email', label: 'E-mail' },
  { valor: 'aleatoria', label: 'Chave Aleatória' },
  { valor: 'dados_bancarios', label: 'Conta Bancária' }
];

export default function DrawerCadastrarDiarista({
  isOpen,
  onClose,
  dataPadrao,
  onSalvarDiarista,
  diaristasExistentes = []
}) {
  const [nome, setNome] = useState('');
  const [motorista, setMotorista] = useState('');
  const [valorDiaria, setValorDiaria] = useState('150,00');
  const [quantidadeDiarias, setQuantidadeDiarias] = useState('1');
  const [tipoPix, setTipoPix] = useState('cpf');
  const [chavePix, setChavePix] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [feedbackSucesso, setFeedbackSucesso] = useState(false);

  // Estados de busca no banco de dados
  const [funcionariosDb, setFuncionariosDb] = useState([]);
  const [termoBuscaBanco, setTermoBuscaBanco] = useState('');
  const [dropdownBancoAberto, setDropdownBancoAberto] = useState(false);
  const [mostrarTodosModal, setMostrarTodosModal] = useState(false);
  const searchBoxRef = useRef(null);

  // Carrega catálogo de colaboradores do backend PostgreSQL
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
    if (isOpen) {
      carregarCatalogo();
    }
  }, [isOpen]);

  // Fecha dropdown do banco ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setDropdownBancoAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bancoCompleto = useMemo(() => {
    return (funcionariosDb || [])
      .filter((f) => f && f.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcionariosDb]);

  const funcionariosFiltrados = useMemo(() => {
    if (!termoBuscaBanco.trim()) {
      return bancoCompleto.slice(0, 6);
    }
    const termo = termoBuscaBanco.toLowerCase().trim();
    return bancoCompleto.filter((f) =>
      f.nome.toLowerCase().includes(termo) ||
      (f.chavePix && f.chavePix.toLowerCase().includes(termo)) ||
      (f.profissao && f.profissao.toLowerCase().includes(termo))
    );
  }, [bancoCompleto, termoBuscaBanco]);

  const handleSelecionarFuncionario = (func) => {
    if (!func) return;
    setNome(func.nome.toUpperCase().trim());
    if (func.profissao) setMotorista(func.profissao);
    if (func.chavePix) setChavePix(func.chavePix);
    if (func.tipoPix) setTipoPix(func.tipoPix);
    setTermoBuscaBanco('');
    setDropdownBancoAberto(false);
    setMostrarTodosModal(false);
  };

  if (!isOpen) return null;

  const parseValor = (valStr) => {
    if (!valStr) return 0;
    const limpo = String(valStr).replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
  };

  const valorTotalCalculado = parseValor(valorDiaria) * (parseInt(quantidadeDiarias, 10) || 1);

  const handleSubmit = async (manterAberto = false) => {
    if (!nome.trim()) {
      alert('Por favor, informe o nome do diarista.');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim().toUpperCase(),
        profissao: motorista.trim() || 'Diarista Geral',
        motorista: motorista.trim() || 'Diarista Geral',
        data: dataPadrao,
        valor_diaria: parseValor(valorDiaria),
        valor: parseValor(valorDiaria),
        quantidade_diarias: parseInt(quantidadeDiarias, 10) || 1,
        diarias: parseInt(quantidadeDiarias, 10) || 1,
        valor_total: valorTotalCalculado,
        total: valorTotalCalculado,
        tipo_pix: tipoPix,
        tipoPix: tipoPix,
        chave_pix: chavePix.trim() || 'Não informada',
        pix: chavePix.trim() || 'Não informada',
        observacoes: observacoes.trim(),
        pago: false
      };

      if (onSalvarDiarista) {
        await onSalvarDiarista(payload);
      }

      setFeedbackSucesso(true);
      setTimeout(() => setFeedbackSucesso(false), 2000);

      if (manterAberto) {
        setNome('');
        setChavePix('');
        setObservacoes('');
        setQuantidadeDiarias('1');
      } else {
        setTimeout(() => {
          onClose();
        }, 300);
      }
    } catch (err) {
      console.error('Erro ao salvar diarista pelo drawer:', err);
      alert('Erro ao salvar diarista. Verifique os dados e tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end no-print animate-fadeIn">
      {/* Backdrop com desfoque suave */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-slideLeft border-l border-zinc-200">
        
        {/* Cabeçalho do Drawer */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Cadastrar Diarista
                <span className="text-[10px] bg-red-600/30 text-red-300 font-extrabold px-2 py-0.5 rounded-full border border-red-500/30 uppercase">
                  Com Banco de Dados
                </span>
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Data de Referência: <span className="text-white font-bold">{dataPadrao}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual de sucesso */}
        {feedbackSucesso && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4" />
            <span>Diarista lançado com sucesso no dia!</span>
          </div>
        )}

        {/* Formulário com Scroll Suave */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">

          {/* ==================================================================== */}
          {/* BLOCO ESPECIAL: BUSCAR FUNCIONÁRIO NO BANCO DE DADOS               */}
          {/* ==================================================================== */}
          <div className="bg-gradient-to-br from-red-50/80 via-white to-zinc-50 p-4 rounded-2xl border-2 border-red-500/30 shadow-xs relative space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                    Buscar no Banco de Dados
                    <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[9px] font-bold">
                      Auto
                    </span>
                  </h4>
                  <p className="text-[10px] text-zinc-500">
                    Preenche: <b>Nome</b>, <b>Função</b> e <b>PIX</b>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMostrarTodosModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:border-red-300 hover:text-red-600 text-zinc-700 text-[11px] font-bold transition shadow-xs cursor-pointer"
              >
                <UserCheck className="w-3 h-3 text-red-600" />
                <span>Ver todos ({bancoCompleto.length})</span>
              </button>
            </div>

            {/* Campo de Busca no Banco */}
            <div ref={searchBoxRef} className="relative">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={termoBuscaBanco}
                  onChange={(e) => {
                    setTermoBuscaBanco(e.target.value);
                    setDropdownBancoAberto(true);
                  }}
                  onFocus={() => setDropdownBancoAberto(true)}
                  placeholder="Buscar no banco por nome, PIX ou função..."
                  className="w-full pl-8.5 pr-8 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-xs font-medium text-zinc-900 bg-white"
                />
                {termoBuscaBanco && (
                  <button
                    type="button"
                    onClick={() => {
                      setTermoBuscaBanco('');
                      setDropdownBancoAberto(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown com resultados do banco */}
              {dropdownBancoAberto && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>Encontrados no Banco ({funcionariosFiltrados.length})</span>
                    <span>Clique para selecionar</span>
                  </div>

                  {funcionariosFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-zinc-500 text-xs">
                      Nenhum colaborador encontrado no banco de dados.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {funcionariosFiltrados.map((func) => (
                        <button
                          key={func.id || func.nome}
                          type="button"
                          onClick={() => handleSelecionarFuncionario(func)}
                          className="w-full text-left p-2.5 hover:bg-red-50/70 transition flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div>
                            <span className="font-black text-zinc-950 text-xs block uppercase">
                              {func.nome}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-medium">
                              {func.profissao || 'Diarista Geral'}
                            </span>
                          </div>
                          {func.chavePix && (
                            <span className="text-[10px] text-zinc-600 font-mono bg-zinc-100 px-2 py-0.5 rounded-md">
                              PIX: {func.chavePix.slice(0, 10)}...
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal / Lista Completa do Banco */}
          {mostrarTodosModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden animate-fadeIn">
                <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-red-500" />
                    <span className="font-black text-sm">Banco de Colaboradores ({bancoCompleto.length})</span>
                  </div>
                  <button onClick={() => setMostrarTodosModal(false)} className="text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 border-b border-zinc-200">
                  <input
                    type="text"
                    value={termoBuscaBanco}
                    onChange={(e) => setTermoBuscaBanco(e.target.value)}
                    placeholder="Filtrar por nome, PIX ou função..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-medium"
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-2">
                  {funcionariosFiltrados.map((func) => (
                    <button
                      key={func.id || func.nome}
                      type="button"
                      onClick={() => handleSelecionarFuncionario(func)}
                      className="w-full text-left p-3 hover:bg-red-50/80 rounded-xl transition flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-zinc-950 text-xs block uppercase">{func.nome}</span>
                        <span className="text-[11px] text-zinc-500">{func.profissao || 'Diarista Geral'}</span>
                      </div>
                      {func.chavePix && (
                        <span className="text-[10px] text-zinc-600 font-mono bg-zinc-100 px-2 py-0.5 rounded-md">
                          {func.chavePix}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Campo Nome */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 block">
              Nome Completo do Diarista <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="EX: FRANCISCO DIONE OU DESCARREGO TEND TUDO"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-zinc-900 font-bold uppercase bg-zinc-50/50 focus:bg-white transition"
            />
          </div>

          {/* Função / Caminhão / Motorista */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 block flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Função / Caminhão / Motorista</span>
            </label>
            <input
              type="text"
              value={motorista}
              onChange={(e) => setMotorista(e.target.value)}
              placeholder="Ex: Ajudante de Motorista, Carga Caminhão 02..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-zinc-900 font-medium bg-zinc-50/50 focus:bg-white transition"
            />
          </div>

          {/* Linha com Valor Diária e Qtd Diárias */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 block">
                Valor da Diária (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-xs">
                  R$
                </span>
                <input
                  type="text"
                  value={valorDiaria}
                  onChange={(e) => setValorDiaria(e.target.value)}
                  placeholder="150,00"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-zinc-900 font-bold bg-zinc-50/50 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 block">
                Qtd. Diárias
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuantidadeDiarias(String(Math.max(1, (parseInt(quantidadeDiarias, 10) || 1) - 1)))}
                  className="px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold border border-zinc-200 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={quantidadeDiarias}
                  onChange={(e) => setQuantidadeDiarias(e.target.value)}
                  className="w-full py-2.5 text-center rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-zinc-900 font-black bg-zinc-50/50 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setQuantidadeDiarias(String((parseInt(quantidadeDiarias, 10) || 1) + 1))}
                  className="px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold border border-zinc-200 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Destaque do Total Calculado */}
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/60 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between">
            <span className="font-bold text-emerald-950 uppercase tracking-tight text-[11px]">
              Total a Pagar Diarista
            </span>
            <span className="text-base font-black text-emerald-700">
              R$ {valorTotalCalculado.toFixed(2).replace('.', ',')}
            </span>
          </div>

          {/* Tipo e Chave PIX */}
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="font-bold text-zinc-700 block flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                <span>Dados de Pagamento (PIX)</span>
              </label>
              <select
                value={tipoPix}
                onChange={(e) => setTipoPix(e.target.value)}
                className="text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
              >
                {TIPOS_PIX.map(tp => (
                  <option key={tp.valor} value={tp.valor}>{tp.label}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder="Digite a chave PIX para transferência..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-zinc-900 font-mono text-xs bg-zinc-50/50 focus:bg-white transition"
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-zinc-700 block">
              Observações (Opcional)
            </label>
            <textarea
              rows="2"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Alguma anotação sobre o trabalho ou horário..."
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-600 text-zinc-900 font-medium text-xs bg-zinc-50/50 focus:bg-white transition resize-none"
            />
          </div>

        </div>

        {/* Rodapé Fixo com Botões de Ação */}
        <div className="p-4 sm:p-5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 text-xs font-bold transition cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => handleSubmit(true)}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              title="Salva e limpa os campos para cadastrar o próximo imediatamente"
            >
              + Salvar & Outro
            </button>

            <button
              type="button"
              disabled={salvando}
              onClick={() => handleSubmit(false)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {salvando ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Concluir</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
