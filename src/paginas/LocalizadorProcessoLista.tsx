import { Fragment, h, render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createBroadcastService } from '../createBroadcastService';
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
import { BroadcastMessage } from '../types/Action';
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
  render(<Main mapa={mapa} />, barra.parentElement!, div);
}

type Lazy<T> = () => T;

type Cmd<T> = Lazy<Promise<T>>;

function mount(
  init: Lazy<[Model] | [Model, Cmd<Action>]>,
  createUpdate: (
    send: (msg: BroadcastMessage) => void,
  ) => (state: Model, action: Action) => [Model] | [Model, Cmd<Action>],
): [state: Model, dispatch: Handler<Action>] {
  const [initialState, initialCommand] = useMemo(init, []);

  const [state, setState] = useState(initialState);

  const dispatch = useCallback(handler, [state]);

  useEffect(() => {
    if (initialCommand)
      go(initialState, initialCommand)
        .then((value) => setState(value))
        .catch((error) => setState({ status: 'error', error }));
  }, []);

  const update = useMemo(() => {
    const bc = createBroadcastService();
    bc.subscribe((msg) => {
      switch (msg.type) {
        case 'Blocos':
          dispatch(msg);
          break;

        case 'NoOp':
          break;

        default:
          expectUnreachable(msg);
      }
    });
    return createUpdate(bc.publish);
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
      .then((value) => setState(value))
      .catch((error) => setState((state) => ({ ...state, error })));
  }
}

function createUpdate(
  send: Handler<BroadcastMessage>,
): (state: Model, action: Action) => [Model, ...([Cmd<Action>] | [])] {
  return (state, action) => {
    switch (action.type) {
      case 'Blocos':
        if (state.status === 'error') return [state];
        return [{ status: 'loaded', mapa: state.mapa, blocos: action.blocos }];

      case 'CriarBloco':
        return [
          state,
          async () => {
            const blocos = await getBlocos();
            if (blocos.some((x) => x.nome === action.nome)) return Action.Blocos(blocos);
            const bloco: Bloco = {
              id: (Math.max(-1, ...blocos.map((x) => x.id)) + 1) as p.NonNegativeInteger,
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
            send(Action.Blocos(blocos));
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
            const others = blocos.filter((x) => x.id !== action.bloco);
            if (others.some((x) => x.nome === action.nome)) return Action.Blocos(blocos);
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
            const bloco = await getBloco(action.bloco);
            if (!bloco) return Action.GetBlocos();
            for (const [numproc, { checkbox }] of state.mapa) {
              if (bloco.processos.includes(numproc)) {
                if (!checkbox.checked) checkbox.click();
              } else {
                if (checkbox.checked) checkbox.click();
              }
            }
            return Action.NoOp();
          },
        ];
    }
    return expectUnreachable(action);
  };
}

function Main(props: { mapa: MapaProcessos }) {
  const [state, dispatch] = mount(
    () => [{ status: 'init', mapa: props.mapa }, () => Promise.resolve(Action.GetBlocos())],
    createUpdate,
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
  const [nome, setNome] = useState('');

  const onSubmit = useCallback(() => {
    if (p.isNonEmptyString(nome)) props.dispatch(Action.CriarBloco(nome));
    setNome('');
  }, [nome]);

  const onKeyPress = useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'Enter') onSubmit();
    },
    [onSubmit],
  );

  return (
    <>
      <h1>Blocos</h1>
      <ul>
        {props.state.blocos.map((bloco) => (
          <Bloco key={bloco.id} {...bloco} dispatch={props.dispatch} />
        ))}
      </ul>
      <input
        value={nome}
        onInput={(evt) => setNome(evt.currentTarget.value)}
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
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(props.nome as string);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.select();
      ref.current.focus();
    }
  }, [editing]);
  const onKey = useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'Enter') {
        setEditing(false);
        if (p.isNonEmptyString(nome)) {
          props.dispatch(Action.RenomearBloco(props.id, nome));
        }
      } else if (evt.key === 'Escape') {
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
          onInput={(evt) => setNome(evt.currentTarget.value)}
          onKeyPress={onKey}
          value={nome}
        />
      ) : props.processos.length === 0 ? (
        props.nome
      ) : (
        <button onClick={() => props.dispatch(Action.SelecionarProcessos(props.id))}>
          {props.nome}
        </button>
      )}{' '}
      ({props.processos.length} processo{props.processos.length > 1 ? 's' : ''})
      {editing ? null : (
        <button
          onClick={() => {
            setNome(props.nome);
            setEditing(true);
          }}
        >
          Renomear
        </button>
      )}
      <button
        onClick={() => {
          let confirmed = true;
          const len = props.processos.length;
          if (len > 0)
            confirmed = window.confirm(
              `Este bloco possui ${len} processo${len > 1 ? 's' : ''}. Deseja excluí-lo?`,
            );
          if (confirmed) props.dispatch(Action.ExcluirBloco(props.id));
        }}
      >
        Excluir
      </button>
    </li>
  );
}
