import type { JSXInternal } from 'preact/src/jsx';
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
import { assert, isNonEmptyString, isNotNull, NonNegativeInteger } from '../lib/predicates';
import {
  isServerErrorAction,
  isServerLoadedAction,
  isServerLoadingAction,
  ServerAction,
  ServerErrorAction,
  ServerLoadedAction,
  ServerLoadingAction,
} from '../types/Action';
import { Bloco } from '../types/Bloco';
import { ServerState } from '../types/State';

export function LocalizadorProcessoLista() {
  const barra = document.getElementById('divInfraBarraLocalizacao');
  assert(isNotNull(barra));
  const div = document.createElement('div');
  barra.insertAdjacentElement('afterend', div);
  preact.render(<Main />, barra.parentElement!, div);
}

type State = ServerLoadingState | ServerLoadedState | ServerErrorState;
type ServerLoadingState = { status: 'loading'; previousValue: ServerState | null };
type ServerLoadedState = { status: 'loaded'; value: ServerState };
type ServerErrorState = { status: 'error'; reason: string };

type Lazy<T> = () => T;

function useServerState(): [state: State, dispatch: Handler<ServerAction>] {
  const [state, setState] = preactHooks.useState<State>({ status: 'loading', previousValue: null });

  const dispatch = preactHooks.useCallback(handler, [state]);

  preactHooks.useEffect(() => dispatch({ type: 'ObterDados' }), []);

  return [state, dispatch];

  function handler(action: ServerAction) {
    go(state, action, []).then(setState).catch(handleError);

    function go(
      state: State,
      action: ServerAction,
      thunks: Lazy<Promise<ServerAction>>[],
    ): Promise<State> {
      const [newState, ...newThunks] = reducer(state, action);
      const result = extractFirst(thunks, newThunks);
      if (!result) return Promise.resolve(newState);
      const [first, rest] = result;
      return first().then(action => go(newState, action, rest));
    }

    function extractFirst<T>(xs: T[], ys: T[]): [first: T, rest: T[]] | null {
      const all = xs.concat(ys);
      if (all.length === 0) return null;
      const first = all.splice(0, 1);
      return [first[0]!, all];
    }
  }

  function handleError(err: unknown) {
    let motivo = '';
    if (err instanceof Error) {
      motivo = err.message;
    } else {
      motivo = String(err);
    }
    if (!isNonEmptyString(motivo)) motivo = 'Erro desconhecido.';
    dispatch({ type: 'Erro', motivo });
  }

  function loadingReducer(
    state: ServerLoadingState,
    action: ServerLoadingAction,
  ): [State, ...Array<() => Promise<ServerAction>>] {
    switch (action.type) {
      case 'AtualizarBlocos': {
        const blocos = action.blocos.slice().sort((a, b) => {
          const [c, d] = [a, b].map(x => x.nome.toLowerCase()) as [string, string];
          if (c < d) return -1;
          if (c > d) return +1;
          if (a.nome < b.nome) return -1;
          if (a.nome > b.nome) return +1;
          throw new Error(`Há dois blocos com o mesmo nome: ${a.nome}`);
        });
        return [
          {
            status: 'loaded',
            value: {
              aberto: false,
              ...(state.previousValue || {}),
              aviso: undefined,
              blocos,
            },
          },
        ];
      }
      case 'DadosInvalidos':
        if (state.previousValue)
          return [{ status: 'loaded', value: { ...state.previousValue, aviso: action.motivo } }];
        return [{ status: 'error', reason: action.motivo }];

      case 'Erro':
        return [{ status: 'error', reason: action.motivo }];

      case 'ObterDados':
        return [state, async () => ({ type: 'AtualizarBlocos', blocos: await getBlocos() })];
    }
    expectUnreachable(action);
  }
  function loadedReducer(
    state: ServerLoadedState,
    action: ServerLoadedAction,
  ): [State, ...Array<() => Promise<ServerAction>>] {
    switch (action.type) {
      case 'CriarBloco': {
        return [
          { status: 'loading', previousValue: state.status === 'loaded' ? state.value : null },
          async () => {
            const blocos = await getBlocos();
            if (blocos.some(b => b.nome === action.nome))
              return {
                type: 'DadosInvalidos',
                motivo: `Já existe um bloco chamado "${action.nome}".`,
              };
            const bloco: Bloco = {
              id: (Math.max(0, ...blocos.map(x => x.id)) + 1) as NonNegativeInteger,
              nome: action.nome,
              processos: [],
            };
            await createBloco(bloco);
            return { type: 'AtualizarBlocos', blocos: [...blocos, bloco] };
          },
        ];
      }

      case 'Erro': {
        return [{ status: 'error', reason: action.motivo }];
      }

      case 'ExcluirBloco': {
        return [
          { status: 'loading', previousValue: state.value },
          async () => {
            await deleteBloco(action.bloco);
            return { type: 'ObterDados' };
          },
        ];
      }

      case 'RenomearBloco': {
        return [
          { status: 'loading', previousValue: state.value },
          async () => {
            const blocos = await getBlocos();
            const bloco = blocos.find(x => x.id === action.bloco);
            if (!bloco) return { type: 'ObterDados' };
            const outrosBlocos = blocos.filter(b => b.id !== action.bloco);
            if (outrosBlocos.some(b => b.nome === action.nome))
              return {
                type: 'DadosInvalidos',
                motivo: `Já existe um bloco chamado "${action.nome}".`,
              };
            await updateBloco({ ...bloco, nome: action.nome });
            return { type: 'ObterDados' };
          },
        ];
      }
    }
    expectUnreachable(action);
  }
  function errorReducer(
    state: ServerErrorState,
    action: ServerErrorAction,
  ): [State, ...Array<() => Promise<ServerAction>>] {
    switch (action.type) {
      case 'Erro': {
        return [state];
      }
      case 'ExcluirBanco': {
        return [
          { status: 'loading', previousValue: null },
          () => deleteBlocos().then(() => ({ type: 'ObterDados' })),
        ];
      }
      case 'ObterDados': {
        return [
          { status: 'loading', previousValue: null },
          async () => {
            return { type: 'AtualizarBlocos', blocos: await getBlocos() };
          },
        ];
      }
    }
    expectUnreachable(action);
  }

  function reducer(
    state: State,
    action: ServerAction,
  ): [State, ...Array<() => Promise<ServerAction>>] {
    console.log('reducer', action);
    switch (state.status) {
      case 'loading':
        if (isServerLoadingAction(action)) return loadingReducer(state, action);
        break;
      case 'loaded':
        if (isServerLoadedAction(action)) return loadedReducer(state, action);
        break;
      case 'error':
        if (isServerErrorAction(action)) return errorReducer(state, action);
        break;
      default:
        return expectUnreachable(state);
    }
    return [
      {
        status: 'error',
        reason: `Ação incompatível com estado atual da aplicação (${
          state.status
        }): ${JSON.stringify(action)}.`,
      },
    ];
  }
}

function Main() {
  const [state, dispatch] = useServerState();

  return (
    <div>
      {state.status === 'loading' ? (
        <Loading />
      ) : state.status === 'error' ? (
        <ShowError reason={state.reason} dispatch={dispatch} />
      ) : (
        <Blocos state={state.value} dispatch={dispatch} />
      )}
    </div>
  );
}

function Loading() {
  return <>Carregando...</>;
}

function ShowError({ dispatch, reason }: { reason: string; dispatch: Handler<ServerAction> }) {
  return (
    <>
      <span style="color:red; font-weight: bold;">{reason}</span>
      <br />
      <br />
      <button onClick={() => dispatch({ type: 'ObterDados' })}>Tentar carregar dados salvos</button>
      <button onClick={() => dispatch({ type: 'ExcluirBanco' })}>Apagar os dados locais</button>
    </>
  );
}

function Blocos(props: { state: ServerState; dispatch: Handler<ServerAction> }) {
  const [nome, setNome] = preactHooks.useState('');

  const onSubmit = preactHooks.useCallback(() => {
    if (isNonEmptyString(nome)) props.dispatch({ type: 'CriarBloco', nome });
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
      {props.state.aviso ? <span style="color:red">{props.state.aviso}</span> : null}
    </>
  );
}

function Bloco(props: Bloco & { dispatch: Handler<ServerAction> }) {
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
        if (isNonEmptyString(nome)) {
          setNome(props.nome);
          props.dispatch({ type: 'RenomearBloco', bloco: props.id, nome });
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
        <button onClick={() => props.dispatch({ type: 'ExcluirBloco', bloco: props.id })}>
          Excluir
        </button>
      ) : null}
    </li>
  );
}
