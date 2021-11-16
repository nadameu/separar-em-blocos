import { Fragment, h, JSX, render } from 'preact';
import { useCallback, useEffect, useMemo, useReducer } from 'preact/hooks';
import { createBroadcastService } from '../createBroadcastService';
import * as Database from '../database';
import { expectUnreachable } from '../lib/expectUnreachable';
import { Handler } from '../lib/Handler';
import { assert, isNotNull } from '../lib/predicates';
import { Bloco, BlocoProcesso } from '../types/Bloco';
import { NumProc } from '../types/NumProc';

type BC = ReturnType<typeof createBroadcastService>;

type Dependencias = {
  DB: Pick<typeof Database, 'getBloco' | 'getBlocos' | 'updateBloco'>;
  bc: BC;
  numproc: NumProc;
};

type Model =
  | { status: 'Loading' }
  | { status: 'Success'; blocos: Bloco[]; loading: boolean }
  | { status: 'Error'; reason: unknown };

interface Action {
  (state: Model, dispatch: Dispatch, extra: Dependencias): Model;
}
interface Dispatch {
  (action: Action): void;
}

function fromAsync(asyncAction: { (state: Model, extra: Dependencias): Promise<Action> }): Action {
  return (state, dispatch, extra) => {
    asyncAction(state, extra).catch(actions.erro).then(dispatch);
    return actions.carregando()(state, dispatch, extra);
  };
}

const actions = {
  blocosObtidos(blocos: Bloco[]): Action {
    return () => ({ status: 'Success', blocos, loading: false });
  },
  carregando(): Action {
    return (state) => {
      switch (state.status) {
        case 'Loading':
        case 'Error':
          return { status: 'Loading' };

        case 'Success':
          return { ...state, loading: true };
      }
      return expectUnreachable(state);
    };
  },
  erro(reason: unknown): Action {
    return () => ({ status: 'Error', reason });
  },
  inserir(id: Bloco['id']): Action {
    return fromAsync(async ({}, { DB, numproc }) => {
      const bloco = await DB.getBloco(id);
      if (bloco) {
        const processos = new Set(bloco.processos).add(numproc);
        await DB.updateBloco({ ...bloco, processos: [...processos] });
      }
      return actions.obterBlocos();
    });
  },
  inserirEFechar(id: Bloco['id']): Action {
    return fromAsync(async ({}, { DB, bc, numproc }) => {
      const bloco = await DB.getBloco(id);
      if (bloco) {
        const processos = new Set(bloco.processos).add(numproc);
        await DB.updateBloco({ ...bloco, processos: [...processos] });
        const blocos = await DB.getBlocos();
        bc.publish({ type: 'Blocos', blocos });
        window.close();
        return actions.blocosObtidos(blocos);
      }
      return actions.obterBlocos();
    });
  },
  noop(): Action {
    return (state) => state;
  },
  obterBlocos(): Action {
    return fromAsync(async ({}, { DB, bc }) => {
      const blocos = await DB.getBlocos();
      bc.publish({ type: 'Blocos', blocos });
      return actions.blocosObtidos(blocos);
    });
  },
  remover(id: Bloco['id']): Action {
    return fromAsync(async ({}, { DB, numproc }) => {
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
  background: black;
  color:white;
}
div#gm-blocos-grid {
  display: grid;
  grid-template: "checkbox descricao transportar ." auto / auto auto auto 0;
  grid-gap: 4px;
  align-items: start;
}
`;

export function ProcessoSelecionar(numproc: NumProc) {
  const mainMenu = document.getElementById('main-menu');
  assert(isNotNull(mainMenu));
  document.head.appendChild(
    ((s) => {
      s.textContent = css;
      return s;
    })(document.createElement('style')),
  );
  const div = document.createElement('div');
  mainMenu.insertAdjacentElement('beforebegin', div);
  render(<Main numproc={numproc} />, mainMenu, div);
}

function Main(props: { numproc: NumProc }) {
  const extra = useMemo((): Dependencias => {
    const bc = createBroadcastService(),
      { numproc } = props;
    return { DB: Database, bc, numproc };
  }, []);

  const [state, dispatch] = useReducer(
    (state: Model, action: Action): Model => action(state, dispatch, extra),
    { status: 'Loading' },
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
  }, []);

  return (
    <div id="gm-blocos">
      {state.status === 'Success' ? (
        <Blocos
          blocos={state.blocos.map(({ processos, ...rest }) => ({
            ...rest,
            inserido: processos.includes(props.numproc),
          }))}
          dispatch={dispatch}
          disabled={state.loading}
        />
      ) : null}
    </div>
  );
}

function Blocos(props: { blocos: BlocoProcesso[]; dispatch: Handler<Action>; disabled: boolean }) {
  return (
    <>
      <h2>Blocos</h2>
      <div id="gm-blocos-grid">
        {props.blocos.map((info) => (
          <Bloco key={info.id} {...info} dispatch={props.dispatch} disabled={props.disabled} />
        ))}
      </div>
    </>
  );
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
    <>
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
      <br />
    </>
  );
}
