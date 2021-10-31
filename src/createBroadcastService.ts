import { BroadcastMessage, isBroadcastMessage } from './types/Action';
import { Handler } from './lib/Handler';

export function createBroadcastService(): {
  publish: (message: BroadcastMessage) => void;
  subscribe: (handler: Handler<BroadcastMessage>) => () => boolean;
  destroy: () => void;
};
export function createBroadcastService({ debug = false } = {}) {
  const handlers = new Set<Handler<BroadcastMessage>>();
  const bc = new BroadcastChannel('gm-blocos');
  bc.addEventListener('message', listener);
  return { publish, subscribe, destroy };
  function destroy() {
    bc.removeEventListener('message', listener);
    handlers.clear();
    bc.close();
  }
  function listener(evt: MessageEvent<unknown>) {
    if (debug) {
      console.debug(evt);
    }
    if (isBroadcastMessage(evt.data)) for (const handler of handlers) handler(evt.data);
  }
  function publish(message: BroadcastMessage) {
    if (debug) {
      console.debug(message);
    }
    bc.postMessage(message);
  }
  function subscribe(handler: Handler<BroadcastMessage>) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  }
}
