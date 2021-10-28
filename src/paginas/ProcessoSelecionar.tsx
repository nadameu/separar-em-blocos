import { JSXInternal } from 'preact/src/jsx';
import { expectUnreachable } from '../lib/expectUnreachable';
import { Handler } from '../lib/Handler';
import { assert, isNotNull, NonNegativeInteger } from '../lib/predicates';
import { ClientAction, ClientMessage, isResponseMessage, RequestMessage } from '../types/Action';
import { BlocoProcesso } from '../types/Bloco';
import { isNumProc, NumProc } from '../types/NumProc';

const css = /*css*/ `
div#gm-blocos {
  background: black;
  color:white;
}
`;

export function ProcessoSelecionar(numproc: NumProc) {
  assert(window.opener instanceof Window);
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
  preact.render(<Main numproc={numproc} opener={window.opener} />, mainMenu, div);
}

function useClientReducer(
  opener: Window,
  numproc: NumProc,
): [BlocoProcesso[], Handler<ClientAction>] {
  const [blocos, setBlocos] = preactHooks.useState<BlocoProcesso[]>([]);

  const [ids, setIds] = preactHooks.useState(new Set<NonNegativeInteger>());

  const getRequestId = preactHooks.useCallback(() => {
    const last = Math.max(-1, ...ids);
    const next = (last + 1) as NonNegativeInteger;
    setIds(s => s.add(next));
    return next;
  }, [ids]);

  preactHooks.useEffect(() => {
    send({ type: 'ObterBlocosProcesso', numproc });
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);

    function listener(evt: MessageEvent<unknown>) {
      try {
        assert(evt.origin === document.location.origin, 'o');
        assert(evt.source === opener, 's');
        assert(isResponseMessage(evt.data), `Mensagem desconhecida: ${JSON.stringify(evt.data)}.`);
        const { message, responseId } = evt.data;
        assert(ids.has(responseId));
        ids.delete(responseId);
        switch (message.type) {
          case 'FornecerBlocosProcesso': {
            setBlocos(message.blocos);
            break;
          }

          // default:
          //   expectUnreachable(message);
        }
      } catch (_) {
        console.error(_);
      }
    }
  }, []);

  return [blocos, dispatch];

  function dispatch(action: ClientAction) {
    switch (action.type) {
      case 'InserirEmBloco': {
        if (blocos.some(x => x.id === action.bloco && !x.inserido)) {
          setBlocos([]);
          send({ type: 'InserirProcesso', bloco: action.bloco, numproc });
        }
        break;
      }
      case 'RemoverDeBloco': {
        if (blocos.some(x => x.id === action.bloco && x.inserido)) {
          setBlocos([]);
          send({ type: 'RemoverProcesso', bloco: action.bloco, numproc });
        }
        break;
      }
      default:
        expectUnreachable(action);
    }
  }

  function send(message: ClientMessage) {
    const requestId = getRequestId();
    const request: RequestMessage = { requestId, message };
    opener.postMessage(request, document.location.origin);
  }
}

function Main(props: { numproc: NumProc; opener: Window }) {
  const [blocos, dispatch] = useClientReducer(props.opener, props.numproc);

  return (
    <div id="gm-blocos">
      {blocos.length > 0 ? <Blocos blocos={blocos} dispatch={dispatch} /> : null}
    </div>
  );
}

function Blocos(props: { blocos: BlocoProcesso[]; dispatch: Handler<ClientAction> }) {
  return (
    <>
      <h2>Blocos</h2>
      <ul>
        {props.blocos.map(info => (
          <Bloco {...info} dispatch={props.dispatch} />
        ))}
      </ul>
    </>
  );
}

function Bloco(props: BlocoProcesso & { dispatch: Handler<ClientAction> }) {
  const onChange = preactHooks.useCallback(
    (evt: JSXInternal.TargetedEvent<HTMLInputElement>) => {
      if (evt.currentTarget.checked) {
        props.dispatch({ type: 'InserirEmBloco', bloco: props.id });
      } else {
        props.dispatch({ type: 'RemoverDeBloco', bloco: props.id });
      }
    },
    [props.dispatch],
  );
  return (
    <li>
      <label>
        <input type="checkbox" checked={props.inserido} onChange={onChange} />
        {props.nome} ({props.id})
      </label>
    </li>
  );
}
