import { Fragment, h, render } from 'preact';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { createBroadcastService } from '../createBroadcastService';
import * as Database from '../database';
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
  | { status: 'init' }
  | { status: 'loaded'; blocos: Bloco[]; aviso?: string }
  | { status: 'error'; error: unknown };

interface Action {
  (state: Model, dispatch: Dispatch, extra: Dependencias): Model;
}

interface Dispatch {
  (action: Action): void;
}

type Dependencias = {
  DB: Pick<
    typeof Database,
    'createBloco' | 'deleteBloco' | 'deleteBlocos' | 'getBloco' | 'getBlocos' | 'updateBloco'
  >;
  bc: ReturnType<typeof createBroadcastService>;
  mapa: MapaProcessos;
};

function fromAsync(f: (state: Model, extra: Dependencias) => Promise<Action>): Action {
  return (state, dispatch, extra) => {
    f(state, extra)
      .catch(
        (error): Action =>
          () => ({ status: 'error', error }),
      )
      .then(dispatch);
    return state;
  };
}

const actions = {
  blocosObtidos:
    (blocos: Bloco[]): Action =>
    (state) => {
      if (state.status === 'error') return state;
      return { status: 'loaded', blocos };
    },
  criarBloco: (nome: Bloco['nome']): Action =>
    fromAsync(async (state, { DB }) => {
      const blocos = await DB.getBlocos();
      if (blocos.every((x) => x.nome !== nome)) {
        const bloco: Bloco = {
          id: (Math.max(-1, ...blocos.map((x) => x.id)) + 1) as p.NonNegativeInteger,
          nome,
          processos: [],
        };
        await DB.createBloco(bloco);
      }
      return actions.obterBlocos();
    }),
  excluirBD: (): Action =>
    fromAsync(async ({}, { DB }) => {
      await DB.deleteBlocos();
      return actions.obterBlocos();
    }),
  excluirBloco: (bloco: p.NonNegativeInteger): Action =>
    fromAsync(async ({}, { DB }) => {
      await DB.deleteBloco(bloco);
      return actions.obterBlocos();
    }),
  obterBlocos: (): Action =>
    fromAsync(async ({}, { DB, bc }) => {
      const blocos = await DB.getBlocos();
      bc.publish({ type: 'Blocos', blocos });
      return actions.blocosObtidos(blocos);
    }),
  noop: (): Action => (state) => state,
  renomearBloco: (id: Bloco['id'], nome: Bloco['nome']): Action =>
    fromAsync(async ({}, { DB }) => {
      const blocos = await DB.getBlocos();
      const bloco = blocos.find((x) => x.id === id);
      if (bloco) {
        const others = blocos.filter((x) => x.id !== id);
        if (others.every((x) => x.nome !== nome)) {
          await DB.updateBloco({ ...bloco, nome });
        }
      }
      return actions.obterBlocos();
    }),
  selecionarProcessos: (id: Bloco['id']): Action =>
    fromAsync(async ({}, { DB, mapa }) => {
      const bloco = await DB.getBloco(id);
      if (!bloco) return actions.obterBlocos();
      for (const [numproc, { checkbox }] of mapa) {
        if (bloco.processos.includes(numproc)) {
          if (!checkbox.checked) checkbox.click();
        } else {
          if (checkbox.checked) checkbox.click();
        }
      }
      return actions.noop();
    }),
};

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

function Main(props: { mapa: MapaProcessos }) {
  const extra = useMemo((): Dependencias => {
    const DB = Database,
      bc = createBroadcastService(),
      { mapa } = props;
    return { DB, bc, mapa };
  }, []);

  const [state, dispatch] = useReducer(
    (state: Model, action: Action): Model => action(state, dispatch, extra),
    { status: 'init' },
  );

  useEffect(() => {
    extra.bc.subscribe((msg) => {
      switch (msg.type) {
        case 'Blocos':
          dispatch(actions.blocosObtidos(msg.blocos));
          break;
        case 'NoOp':
          break;
        default:
          expectUnreachable(msg);
      }
    });

    dispatch(actions.obterBlocos());
  });

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

function ShowError({ dispatch, reason }: { reason: string; dispatch: Dispatch }) {
  return (
    <>
      <span style="color:red; font-weight: bold;">{reason}</span>
      <br />
      <br />
      <button onClick={() => dispatch(actions.obterBlocos())}>Tentar carregar dados salvos</button>
      <button onClick={() => dispatch(actions.excluirBD())}>Apagar os dados locais</button>
    </>
  );
}

function Blocos(props: { state: Extract<Model, { status: 'loaded' }>; dispatch: Dispatch }) {
  const [nome, setNome] = useState('');

  const onSubmit = useCallback(() => {
    if (p.isNonEmptyString(nome)) props.dispatch(actions.criarBloco(nome));
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
          <button onClick={() => props.dispatch(actions.obterBlocos())}>Recarregar dados</button>
        </>
      ) : null}
    </>
  );
}

function Bloco(props: Bloco & { dispatch: Dispatch }) {
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
          props.dispatch(actions.renomearBloco(props.id, nome));
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
        <button onClick={() => props.dispatch(actions.selecionarProcessos(props.id))}>
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
          if (confirmed) props.dispatch(actions.excluirBloco(props.id));
        }}
      >
        Excluir
      </button>
    </li>
  );
}
