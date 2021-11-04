import { JSXInternal } from 'preact/src/jsx';
import { createBroadcastService } from '../createBroadcastService';
import { getBloco, getBlocos, updateBloco } from '../database';
import { expectUnreachable } from '../lib/expectUnreachable';
import { Handler } from '../lib/Handler';
import { assert, isNotNull } from '../lib/predicates';
import { BroadcastMessage } from '../types/Action';
import { Bloco, BlocoProcesso } from '../types/Bloco';
import { NumProc } from '../types/NumProc';

type Model =
  | { status: 'Loading' }
  | { status: 'Success'; blocos: Bloco[] }
  | { status: 'Error'; reason: unknown };
type Lazy<T> = { (): T };
type Cmd<T> = Handler<Handler<T>>;

const Action = {
  Blocos: (blocos: Bloco[]) => ({ type: 'Blocos' as const, blocos }),
  Error: (reason: unknown) => ({ type: 'Error' as const, reason }),
  Inserir: (bloco: Bloco['id']) => ({ type: 'Inserir' as const, bloco }),
  InserirEFechar: (bloco: Bloco['id']) => ({ type: 'InserirEFechar' as const, bloco }),
  NoOp: () => ({ type: 'NoOp' as const }),
  ObterBlocos: () => ({ type: 'ObterBlocos' as const }),
  Remover: (bloco: Bloco['id']) => ({ type: 'Remover' as const, bloco }),
};
type Action = ReturnType<typeof Action[keyof typeof Action]>;

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

function mount(
  init: Lazy<[Model] | [Model, Cmd<Action>]>,
  createUpdate: (
    send: Handler<BroadcastMessage>,
  ) => (state: Model, action: Action) => [Model] | [Model, Cmd<Action>],
): [Model, Handler<Action>] {
  const [initialState, initialCommand] = preactHooks.useMemo(init, []);

  const [state, setState] = preactHooks.useState(initialState);

  const dispatch = preactHooks.useCallback(handler, [state]);

  const update = preactHooks.useMemo(() => {
    const bc = createBroadcastService();
    bc.subscribe(action => {
      switch (action.type) {
        case 'Blocos':
          dispatch(action);
      }
    });
    return createUpdate(bc.publish);
  }, []);

  preactHooks.useEffect(() => {
    if (initialCommand) go(initialState, initialCommand)(setState);
  }, []);

  return [state, dispatch];

  function go(...args: [Model] | [Model, Cmd<Action>]): Cmd<Model> {
    const [state, cmd] = args;
    if (!cmd) return f => f(state);
    return f => cmd(action => go(...update(state, action))(f));
  }

  function handler(action: Action) {
    go(...update(state, action))(setState);
  }
}

function createUpdate(numproc: NumProc) {
  return (send: Handler<BroadcastMessage>) => {
    return (state: Model, action: Action): [Model] | [Model, Cmd<Action>] => {
      switch (action.type) {
        case 'Blocos':
          return [{ status: 'Success', blocos: action.blocos }];

        case 'Error':
          return [{ status: 'Error', reason: action.reason }];

        case 'Inserir':
        case 'InserirEFechar':
          return [
            { status: 'Loading' },
            resolve =>
              Promise.resolve()
                .then(async () => {
                  const bloco = await getBloco(action.bloco);
                  if (!bloco) return;
                  const processos = new Set(bloco.processos).add(numproc);
                  await updateBloco({ ...bloco, processos: [...processos] });
                  return;
                })
                .then(
                  async () => {
                    if (action.type === 'InserirEFechar') {
                      send(Action.Blocos(await getBlocos()));
                      window.close();
                    } else {
                      resolve(Action.ObterBlocos());
                    }
                  },
                  reason => {
                    resolve(Action.Error(reason));
                  },
                ),
          ];

        case 'NoOp':
          return [state];

        case 'ObterBlocos':
          return [
            { status: 'Loading' },
            resolve => {
              getBlocos()
                .then(Action.Blocos)
                .then(action => {
                  send(action);
                  return action;
                })
                .catch(Action.Error)
                .then(resolve);
            },
          ];

        case 'Remover':
          return [
            { status: 'Loading' },
            resolve =>
              Promise.resolve()
                .then(async () => {
                  const bloco = await getBloco(action.bloco);
                  if (!bloco) return Action.ObterBlocos();
                  const processos = new Set(bloco.processos);
                  processos.delete(numproc);
                  await updateBloco({ ...bloco, processos: [...processos] });
                  return Action.ObterBlocos();
                })
                .catch(Action.Error)
                .then(resolve),
          ];
      }
      return expectUnreachable(action);
    };
  };
}

function Main(props: { numproc: NumProc }) {
  const [state, dispatch] = mount(
    () => [{ status: 'Loading' }, resolve => resolve(Action.ObterBlocos())],
    createUpdate(props.numproc),
  );

  return (
    <div id="gm-blocos">
      {state.status === 'Success' ? (
        <Blocos
          blocos={state.blocos.map(({ processos, ...rest }) => ({
            ...rest,
            inserido: processos.includes(props.numproc),
          }))}
          dispatch={dispatch}
        />
      ) : null}
    </div>
  );
}

function Blocos(props: { blocos: BlocoProcesso[]; dispatch: Handler<Action> }) {
  return (
    <>
      <h2>Blocos</h2>
      <div id="gm-blocos-grid">
        {props.blocos.map(info => (
          <Bloco key={info.id} {...info} dispatch={props.dispatch} />
        ))}
      </div>
    </>
  );
}

function Bloco(props: BlocoProcesso & { dispatch: Handler<Action> }) {
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
          />
        </>
      )}
      <br />
    </>
  );
}
