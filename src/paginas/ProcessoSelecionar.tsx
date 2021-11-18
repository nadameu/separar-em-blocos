import { Fragment, h, JSX, render } from 'preact';
import { useCallback, useEffect, useMemo, useReducer } from 'preact/hooks';
import { createBroadcastService } from '../createBroadcastService';
import * as Database from '../database';
import { expectUnreachable } from '../lib/expectUnreachable';
import { Handler } from '../lib/Handler';
import { assert, isNonEmptyString, isNotNull, NonNegativeInteger } from '../lib/predicates';
import { BroadcastMessage } from '../types/Action';
import { Bloco, BlocoProcesso } from '../types/Bloco';
import { NumProc } from '../types/NumProc';

type BC = ReturnType<typeof createBroadcastService>;

type Dependencias = {
  DB: Pick<typeof Database, 'createBloco' | 'getBloco' | 'getBlocos' | 'updateBloco'>;
  bc: BC;
  numproc: NumProc;
};

type Model =
  | { status: 'Loading' }
  | { status: 'Success'; blocos: Bloco[]; inactive: boolean; erro?: string }
  | { status: 'Error'; reason: unknown };

interface Action {
  (state: Model, dispatch: Dispatch, extra: Dependencias): Model;
}
interface Dispatch {
  (action: Action): void;
}

function fromThunk(thunk: {
  (state: Model, extra: Dependencias): Action | Promise<Action>;
}): Action {
  return (state, dispatch, extra) => {
    Promise.resolve()
      .then(() => thunk(state, extra))
      .catch(actions.erro)
      .then(dispatch);
    return actions.carregando()(state, dispatch, extra);
  };
}

const actions = {
  blocosObtidos(blocos: Bloco[]): Action {
    return () => ({ status: 'Success', blocos, inactive: false });
  },
  carregando(): Action {
    return (state) => {
      switch (state.status) {
        case 'Loading':
        case 'Error':
          return { status: 'Loading' };

        case 'Success':
          return { ...state, inactive: true, erro: undefined };
      }
      return expectUnreachable(state);
    };
  },
  criarBloco(nome: Bloco['nome']): Action {
    return fromThunk(async ({}, { DB }) => {
      const blocos = await DB.getBlocos();
      if (blocos.some((x) => x.nome === nome))
        return actions.erroCapturado(`Já existe um bloco com o nome ${JSON.stringify(nome)}.`);
      await DB.createBloco({
        id: (Math.max(-1, ...blocos.map((x) => x.id)) + 1) as NonNegativeInteger,
        nome,
        processos: [],
      });
      return actions.obterBlocos();
    });
  },
  erro(reason: unknown): Action {
    return () => ({ status: 'Error', reason });
  },
  erroCapturado(reason: string): Action {
    return (state) => {
      switch (state.status) {
        case 'Loading':
          return { status: 'Error', reason };
        case 'Error':
          return state;
        case 'Success':
          return { ...state, inactive: false, erro: reason };
      }
      return expectUnreachable(state);
    };
  },
  inserir(id: Bloco['id']): Action {
    return fromThunk(async ({}, { DB, numproc }) => {
      const bloco = await DB.getBloco(id);
      if (!bloco) throw new Error(`Bloco não encontrado: ${id}.`);
      const processos = new Set(bloco.processos).add(numproc);
      await DB.updateBloco({ ...bloco, processos: [...processos] });
      return actions.obterBlocos();
    });
  },
  inserirEFechar(id: Bloco['id']): Action {
    return fromThunk(async (state, { DB, bc, numproc }) => {
      const bloco = await DB.getBloco(id);
      if (!bloco) throw new Error(`Bloco não encontrado: ${id}.`);
      const processos = new Set(bloco.processos).add(numproc);
      await DB.updateBloco({ ...bloco, processos: [...processos] });
      const blocos = await DB.getBlocos();
      bc.publish({ type: 'Blocos', blocos });
      window.close();
      return actions.blocosObtidos(blocos);
    });
  },
  mensagemRecebida(msg: BroadcastMessage): Action {
    return fromThunk(() => {
      switch (msg.type) {
        case 'Blocos':
          return actions.blocosObtidos(msg.blocos);
        case 'NoOp':
          return actions.noop();
      }
      expectUnreachable(msg);
    });
  },
  noop(): Action {
    return (state) => state;
  },
  obterBlocos(): Action {
    return fromThunk(async ({}, { DB, bc }) => {
      const blocos = await DB.getBlocos();
      bc.publish({ type: 'Blocos', blocos });
      return actions.blocosObtidos(blocos);
    });
  },
  remover(id: Bloco['id']): Action {
    return fromThunk(async ({}, { DB, numproc }) => {
      const bloco = await DB.getBloco(id);
      if (bloco) {
        const processos = new Set(bloco.processos);
        processos.delete(numproc);
        await DB.updateBloco({ ...bloco, processos: [...processos] });
      }
      return actions.obterBlocos();
    });
  },
};

const css = /*css*/ `
div#gm-blocos {
  margin: 2px 3px 4px;
  padding: 4px;
  border-radius: 4px;
}
.menu-dark div#gm-blocos,
.menu-light div#gm-blocos {
  --accent: #41285e;
  --bg: #494251;
  --shadow: #262c31;
  --muted-accent: #453557;
  --text: #fff;
}
div#gm-blocos {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 3px 3px var(--shadow);
}
#gm-blocos h4 {
  margin: 3px 0;
  font-size: 1.25rem;
  font-weight: 300;
}
#gm-blocos ul {
  list-style-type: none;
  margin: 3px 0 7px;
  padding: 0;
}
#gm-blocos li {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-gap: 5px;
  align-items: center;
  margin: 4px 0;
  padding: 5px;
  border-radius: 2px;
}
#gm-blocos li::before {
  content: "";
  position: absolute;
  top: 2px;
  width: 100%;
  height: 100%;
  border-bottom: 1px solid #888;
  pointer-events: none;
}
#gm-blocos li:last-of-type::before {
  content: none;
}
#gm-blocos li:hover {
  background: var(--accent);
}
#gm-blocos label {
  margin: 0;
}
#gm-blocos button {
  display: block;
  margin: 0 auto 7px;
  padding: 2px 20px;
  font-size: 1.09rem;
  border: none;
  border-radius: 3px;
  box-shadow: 0 2px 4px var(--shadow);
  background: var(--muted-accent);
  color: var(--text);
}
#gm-blocos button:hover {
  transition: background-color 0.1s ease-in;
  background: var(--accent);
}
#gm-blocos .error {
  margin: 10px 5%;
  padding: 4px 5%;
  border-radius: 4px;
  font-weight: 500;
  background: white;
  color: red;
}
`;

export function ProcessoSelecionar(numproc: NumProc) {
  const mainMenu = document.getElementById('main-menu');
  assert(isNotNull(mainMenu));
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = css;
  const div = mainMenu.insertAdjacentElement('beforebegin', document.createElement('div'))!;
  div.id = 'gm-blocos';
  render(<Main numproc={numproc} />, div);
}

function Main(props: { numproc: NumProc }) {
  const extra = useMemo((): Dependencias => {
    const DB = Database,
      bc = createBroadcastService(),
      { numproc } = props;
    return { DB, bc, numproc };
  }, []);

  const [state, dispatch] = useReducer(
    (state: Model, action: Action): Model => action(state, dispatch, extra),
    { status: 'Loading' },
  );

  useEffect(() => {
    extra.bc.subscribe((msg) => dispatch(actions.mensagemRecebida(msg)));
    dispatch(actions.obterBlocos());
  }, []);

  switch (state.status) {
    case 'Loading':
      return <>Carregando...</>;
    case 'Error':
      return <ShowError dispatch={dispatch} reason={state.reason} />;
    case 'Success':
      return (
        <Blocos
          blocos={state.blocos.map(({ processos, ...rest }) => ({
            ...rest,
            inserido: processos.includes(props.numproc),
          }))}
          dispatch={dispatch}
          disabled={state.inactive}
          erro={state.erro}
        />
      );
  }
  return expectUnreachable(state);
}

function ShowError({ dispatch, reason }: { dispatch: Dispatch; reason: unknown }) {
  const message =
    typeof reason === 'object' && reason !== null && reason instanceof Error
      ? reason.message
        ? `Ocorreu um erro: ${reason.message}`
        : 'Ocorreu um erro desconhecido.'
      : `Ocorreu um erro: ${String(reason)}`;

  return (
    <>
      <h4>Blocos</h4>
      <div class="error">{message}</div>
      <button type="button" onClick={() => dispatch(actions.obterBlocos())}>
        Recarregar
      </button>
    </>
  );
}

function Blocos(props: {
  blocos: BlocoProcesso[];
  dispatch: Handler<Action>;
  disabled: boolean;
  erro?: string;
}) {
  let aviso: h.JSX.Element | null = null;
  if (props.erro) {
    aviso = <div class="error">{props.erro}</div>;
  }
  return (
    <>
      <h4>Blocos</h4>
      <ul>
        {props.blocos.map((info) => (
          <Bloco key={info.id} {...info} dispatch={props.dispatch} disabled={props.disabled} />
        ))}
      </ul>
      <button type="button" id="gm-novo-bloco" onClick={onNovoClicked} disabled={props.disabled}>
        Novo
      </button>
      {aviso}
    </>
  );

  function onNovoClicked(evt: Event) {
    evt.preventDefault();
    const nome = prompt('Nome do novo bloco:');
    if (nome === null) return;
    if (isNonEmptyString(nome)) {
      props.dispatch(actions.criarBloco(nome));
    }
  }
}

function Bloco(props: BlocoProcesso & { dispatch: Handler<Action>; disabled: boolean }) {
  const onChange = useCallback(
    (evt: JSX.TargetedEvent<HTMLInputElement>) => {
      if (evt.currentTarget.checked) {
        props.dispatch(actions.inserir(props.id));
      } else {
        props.dispatch(actions.remover(props.id));
      }
    },
    [props.dispatch],
  );
  return (
    <li>
      <input
        id={`gm-bloco-${props.id}`}
        type="checkbox"
        checked={props.inserido}
        onChange={onChange}
        disabled={props.disabled}
      />{' '}
      <label for={`gm-bloco-${props.id}`}>{props.nome}</label>
      {props.inserido ? (
        <span />
      ) : (
        <>
          {' '}
          <input
            type="image"
            src="infra_css/imagens/transportar.gif"
            onClick={() => props.dispatch(actions.inserirEFechar(props.id))}
            disabled={props.disabled}
          />
        </>
      )}
    </li>
  );
}
