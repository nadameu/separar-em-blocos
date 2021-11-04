import { JSXInternal } from 'preact/src/jsx';
import { createBroadcastService } from '../createBroadcastService';
import { getBloco, getBlocos, updateBloco } from '../database';
import { expectUnreachable } from '../lib/expectUnreachable';
import { Handler } from '../lib/Handler';
import { assert, isNotNull } from '../lib/predicates';
import { Bloco, BlocoProcesso } from '../types/Bloco';
import { NumProc } from '../types/NumProc';

type BC = ReturnType<typeof createBroadcastService>;

type Model = { numproc: NumProc; bc: BC } & (
  | { status: 'Loading' }
  | { status: 'Success'; blocos: Bloco[]; loading: boolean }
  | { status: 'Error'; reason: unknown }
);
type Action = { (state: Model, dispatch: Dispatch): Model };
type Dispatch = { (action: Action): void };

function fromAsync(
  loading: Model | { (state: Model): Model },
  asyncAction: { (state: Model): Promise<Action> },
  onError: { (error: unknown): Action },
): Action {
  return (state, dispatch) => {
    asyncAction(state).catch(onError).then(dispatch);
    if (typeof loading === 'function') return loading(state);
    return loading;
  };
}

const Carregando = (state: Model): Model => {
  switch (state.status) {
    case 'Loading':
      return state;

    case 'Error':
      return { status: 'Loading', bc: state.bc, numproc: state.numproc };

    case 'Success':
      return { ...state, loading: true };
  }
  return expectUnreachable(state);
};

const Action = {
  Blocos(blocos: Bloco[]): Action {
    return ({ bc, numproc }) => ({ status: 'Success', blocos, bc, numproc, loading: false });
  },
  Error(reason: unknown): Action {
    return ({ bc, numproc }) => ({ status: 'Error', reason, bc, numproc });
  },
  Inserir(id: Bloco['id']): Action {
    return fromAsync(
      Carregando,
      async ({ numproc }) => {
        const bloco = await getBloco(id);
        if (!bloco) return Action.ObterBlocos();
        const processos = new Set(bloco.processos).add(numproc);
        await updateBloco({ ...bloco, processos: [...processos] });
        return Action.ObterBlocos();
      },
      Action.Error,
    );
  },
  InserirEFechar(id: Bloco['id']): Action {
    return fromAsync(
      Carregando,
      async ({ bc, numproc }) => {
        const bloco = await getBloco(id);
        if (!bloco) return Action.ObterBlocos();
        const processos = new Set(bloco.processos).add(numproc);
        await updateBloco({ ...bloco, processos: [...processos] });
        const blocos = await getBlocos();
        bc.publish({ type: 'Blocos', blocos });
        window.close();
        return Action.Blocos(blocos);
      },
      Action.Error,
    );
  },
  NoOp(): Action {
    return state => state;
  },
  ObterBlocos(): Action {
    return fromAsync(
      Carregando,
      async ({ bc }) => {
        const blocos = await getBlocos();
        bc.publish({ type: 'Blocos', blocos });
        return Action.Blocos(blocos);
      },
      Action.Error,
    );
  },
  Remover(id: Bloco['id']): Action {
    return fromAsync(
      Carregando,
      async ({ numproc }) => {
        const bloco = await getBloco(id);
        if (!bloco) return Action.ObterBlocos();
        const processos = new Set(bloco.processos);
        processos.delete(numproc);
        await updateBloco({ ...bloco, processos: [...processos] });
        return Action.ObterBlocos();
      },
      Action.Error,
    );
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
  grid-gap: 0 4px;
  align-items: start;
}
`;

export function ProcessoSelecionar(numproc: NumProc) {
  const mainMenu = document.getElementById('main-menu');
  assert(isNotNull(mainMenu));
  document.head.appendChild(
    (s => {
      s.textContent = css;
      return s;
    })(document.createElement('style')),
  );
  const div = document.createElement('div');
  mainMenu.insertAdjacentElement('beforebegin', div);
  preact.render(<Main numproc={numproc} />, mainMenu, div);
}

function mount(init: { (): [Model] | [Model, Action] }): [Model, Handler<Action>] {
  const [initialState, initialAction] = preactHooks.useMemo(init, []);

  const [state, dispatch] = preactHooks.useReducer((state: Model, action: Action): Model => {
    const next = action(state, dispatch);
    return next;
  }, initialState);

  preactHooks.useEffect(() => {
    if (initialAction) dispatch(initialAction);
  }, []);

  return [state, dispatch];
}

function Main(props: { numproc: NumProc }) {
  const [state, dispatch] = mount(() => [
    { status: 'Loading', bc: createBroadcastService(), numproc: props.numproc },
    Action.ObterBlocos(),
  ]);
  state.bc.subscribe(msg => {
    switch (msg.type) {
      case 'Blocos':
        dispatch(Action.Blocos(msg.blocos));
        break;

      case 'NoOp':
        break;

      default:
        expectUnreachable(msg);
    }
  });

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
        {props.blocos.map(info => (
          <Bloco key={info.id} {...info} dispatch={props.dispatch} disabled={props.disabled} />
        ))}
      </div>
    </>
  );
}

function Bloco(props: BlocoProcesso & { dispatch: Handler<Action>; disabled: boolean }) {
  const onChange = preactHooks.useCallback(
    (evt: JSXInternal.TargetedEvent<HTMLInputElement>) => {
      if (evt.currentTarget.checked) {
        props.dispatch(Action.Inserir(props.id));
      } else {
        props.dispatch(Action.Remover(props.id));
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
            onClick={() => props.dispatch(Action.InserirEFechar(props.id))}
            disabled={props.disabled}
          />
        </>
      )}
      <br />
    </>
  );
}
