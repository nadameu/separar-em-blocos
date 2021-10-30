import {
  createBloco,
  deleteBloco,
  deleteBlocos,
  getBloco,
  getBlocos,
  updateBloco,
} from '../database';
import { expectUnreachable } from '../lib/expectUnreachable';
import { Handler } from '../lib/Handler';
import * as p from '../lib/predicates';
import { Bloco } from '../types/Bloco';
import { isNumProc, NumProc } from '../types/NumProc';

type MapaProcessos = Map<
  NumProc,
  {
    linha: HTMLTableRowElement;
    checkbox: HTMLInputElement;
  }
>;

type Model =
  | { status: 'init'; mapa: MapaProcessos }
  | { status: 'loaded'; mapa: MapaProcessos; blocos: Bloco[]; aviso?: string }
  | { status: 'error'; error: unknown };

const Action = {
  Blocos: (blocos: Bloco[]) => ({ type: 'Blocos' as const, blocos }),
  CriarBloco: (nome: p.NonEmptyString) => ({ type: 'CriarBloco' as const, nome }),
  ExcluirBD: () => ({ type: 'ExcluirBD' as const }),
  ExcluirBloco: (bloco: p.NonNegativeInteger) => ({ type: 'ExcluirBloco' as const, bloco }),
  GetBlocos: () => ({ type: 'GetBlocos' as const }),
  NoOp: () => ({ type: 'NoOp' as const }),
  RenomearBloco: (bloco: p.NonNegativeInteger, nome: p.NonEmptyString) => ({
    type: 'RenomearBloco' as const,
    bloco,
    nome,
  }),
  SelecionarProcessos: (bloco: p.NonNegativeInteger) => ({
    type: 'SelecionarProcessos' as const,
    bloco,
  }),
};
type Action = ReturnType<typeof Action[keyof typeof Action]>;

function selecionarNenhum(processos: MapaProcessos) {
  for (const { checkbox } of processos.values()) if (checkbox.checked) checkbox.click();
}

export function LocalizadorProcessoLista() {
  const tabela = document.querySelector<HTMLTableElement>('table#tabelaLocalizadores');
  const linhas = Array.from(tabela?.rows ?? { length: 0 });
  if (linhas.length <= 1) return;
  const mapa: MapaProcessos = new Map(
    linhas.slice(1).map((linha, i) => {
      const endereco = linha.cells[1]?.querySelector<HTMLAnchorElement>('a[href]')?.href;
      p.assert(p.isNotNullish(endereco), `Link do processo não encontrado: linha ${i}.`);
      const numproc = new URL(endereco).searchParams.get('num_processo');
      p.assert(isNumProc(numproc), `Número de processo desconhecido: ${JSON.stringify(numproc)}.`);
      const checkbox = linha.cells[0]?.querySelector<HTMLInputElement>('input[type=checkbox]');
      p.assert(p.isNotNullish(checkbox), `Caixa de seleção não encontrada: linha ${i}.`);
      return [numproc, { linha, checkbox }];
    }),
  );

  const barra = document.getElementById('divInfraBarraLocalizacao');
  p.assert(p.isNotNull(barra), 'Não foi possível inserir os blocos na página.');
  const div = document.createElement('div');
  barra.insertAdjacentElement('afterend', div);
  preact.render(<Main mapa={mapa} />, barra.parentElement!, div);
}

type Lazy<T> = () => T;

type Cmd<T> = Lazy<Promise<T>>;

function useListaState(
  initialState: Model,
  initialCommand: Cmd<Action> | null,
  update: (state: Model, action: Action) => [Model, ...([Cmd<Action>] | [])],
): [state: Model, dispatch: Handler<Action>] {
  console.log('ran');
  const [state, setState] = preactHooks.useState(initialState);

  const dispatch = preactHooks.useCallback(handler, [state]);

  preactHooks.useEffect(() => {
    if (initialCommand)
      go(initialState, initialCommand)
        .then(value => setState(value))
        .catch(error => setState({ status: 'error', error }));
  }, []);

  return [state, dispatch];
  async function go(state: Model, cmd?: Cmd<Action>): Promise<Model>;
  async function go(...args: [state: Model] | [state: Model, cmd: Cmd<Action>]): Promise<Model>;
  async function go(state: Model, cmd?: Cmd<Action>): Promise<Model> {
    if (!cmd) return state;
    const action = await cmd();
    return go(...update(state, action));
  }

  function handler(action: Action) {
    go(...update(state, action))
      .then(value => setState(value))
      .catch(error => setState(state => ({ ...state, error })));
  }
}

function update(state: Model, action: Action): [Model, ...([Cmd<Action>] | [])] {
  switch (action.type) {
    case 'Blocos':
      if (state.status === 'error') return [state];
      return [{ status: 'loaded', mapa: state.mapa, blocos: action.blocos }];

    case 'CriarBloco':
      return [
        state,
        async () => {
          const blocos = await getBlocos();
          if (blocos.some(x => x.nome === action.nome)) return Action.Blocos(blocos);
          const bloco: Bloco = {
            id: (Math.max(-1, ...blocos.map(x => x.id)) + 1) as p.NonNegativeInteger,
            nome: action.nome,
            processos: [],
          };
          await createBloco(bloco);
          return Action.GetBlocos();
        },
      ];

    case 'ExcluirBD':
      return [
        state,
        async () => {
          await deleteBlocos();
          return Action.GetBlocos();
        },
      ];

    case 'ExcluirBloco':
      return [
        state,
        async () => {
          await deleteBloco(action.bloco);
          return Action.GetBlocos();
        },
      ];

    case 'GetBlocos':
      return [
        state,
        async () => {
          const blocos = await getBlocos();
          return Action.Blocos(blocos);
        },
      ];

    case 'NoOp':
      return [state];

    case 'RenomearBloco':
      return [
        state,
        async () => {
          const blocos = await getBlocos();
          const others = blocos.filter(x => x.id !== action.bloco);
          if (others.some(x => x.nome === action.nome)) return Action.Blocos(blocos);
          const bloco = await getBloco(action.bloco);
          if (!bloco) return Action.Blocos(blocos);
          await updateBloco({ ...bloco, nome: action.nome });
          return Action.GetBlocos();
        },
      ];

    case 'SelecionarProcessos':
      if (state.status !== 'loaded') return [state];
      return [
        state,
        async () => {
          selecionarNenhum(state.mapa);
          const bloco = await getBloco(action.bloco);
          if (!bloco) return Action.GetBlocos();
          const boxes = bloco.processos
            .map(x => state.mapa.get(x)?.checkbox ?? null)
            .filter((x): x is HTMLInputElement => x != null);
          for (const box of boxes) {
            box.click();
          }
          return Action.NoOp();
        },
      ];
  }
  return expectUnreachable(action);
}

function Main(props: { mapa: MapaProcessos }) {
  const [state, dispatch] = useListaState(
    { status: 'init', mapa: props.mapa },
    () => Promise.resolve(Action.GetBlocos()),
    update,
  );

  return (
    <div>
      {state.status === 'error' ? (
        <ShowError reason={String(state.error)} dispatch={dispatch} />
      ) : state.status === 'loaded' ? (
        <Blocos state={state} dispatch={dispatch} />
      ) : (
        <Loading />
      )}
    </div>
  );
}

function Loading() {
  return <>Carregando...</>;
}

function ShowError({ dispatch, reason }: { reason: string; dispatch: Handler<Action> }) {
  return (
    <>
      <span style="color:red; font-weight: bold;">{reason}</span>
      <br />
      <br />
      <button onClick={() => dispatch(Action.GetBlocos())}>Tentar carregar dados salvos</button>
      <button onClick={() => dispatch(Action.ExcluirBD())}>Apagar os dados locais</button>
    </>
  );
}

function Blocos(props: { state: Extract<Model, { status: 'loaded' }>; dispatch: Handler<Action> }) {
  const [nome, setNome] = preactHooks.useState('');

  const onSubmit = preactHooks.useCallback(() => {
    if (p.isNonEmptyString(nome)) props.dispatch(Action.CriarBloco(nome));
    setNome('');
  }, [nome]);

  const onKeyPress = preactHooks.useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'Enter') onSubmit();
    },
    [onSubmit],
  );

  return (
    <>
      <h1>Blocos</h1>
      <ul>
        {props.state.blocos.map(bloco => (
          <Bloco key={bloco.id} {...bloco} dispatch={props.dispatch} />
        ))}
      </ul>
      <input
        value={nome}
        onInput={evt => setNome(evt.currentTarget.value)}
        onKeyPress={onKeyPress}
      />
      <button onClick={onSubmit}>Criar</button>
      <br />
      {props.state.aviso ? (
        <>
          <span style="color:red">{props.state.aviso}</span>
          <button onClick={() => props.dispatch(Action.GetBlocos())}>Recarregar dados</button>
        </>
      ) : null}
    </>
  );
}

function Bloco(props: Bloco & { dispatch: Handler<Action> }) {
  const [editing, setEditing] = preactHooks.useState(false);
  const [nome, setNome] = preactHooks.useState(props.nome as string);
  const ref = preactHooks.useRef<HTMLInputElement>(null);
  preactHooks.useEffect(() => {
    if (ref.current) {
      ref.current.select();
      ref.current.focus();
    }
  }, [editing]);
  const onKey = preactHooks.useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'Enter') {
        if (p.isNonEmptyString(nome)) {
          setNome(props.nome);
          props.dispatch(Action.RenomearBloco(props.id, nome));
        } else {
          setNome(props.nome);
        }
        setEditing(false);
      } else if (evt.key === 'Escape') {
        setNome(props.nome);
        setEditing(false);
      }
    },
    [props.id, nome, props.nome],
  );
  return (
    <li>
      {editing ? (
        <input
          ref={ref}
          onInput={evt => setNome(evt.currentTarget.value)}
          onKeyUp={onKey}
          value={nome}
        />
      ) : (
        props.nome
      )}{' '}
      (#{props.id}) [ {props.processos.join(', ')} ]
      {editing ? null : <button onClick={() => setEditing(true)}>Renomear</button>}
      {props.processos.length === 0 ? (
        <button onClick={() => props.dispatch(Action.ExcluirBloco(props.id))}>Excluir</button>
      ) : (
        <button onClick={() => props.dispatch(Action.SelecionarProcessos(props.id))}>
          Selecionar processos
        </button>
      )}
    </li>
  );
}
