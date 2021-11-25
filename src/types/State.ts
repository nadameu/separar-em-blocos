import * as p from '../lib/predicates';
import { isBloco } from './Bloco';

export const isServerState = /* #__PURE__ */ p.hasShape({
  aberto: p.isBoolean,
  blocos: p.isArray(isBloco),
  aviso: p.isOptional(p.isAnyOf(p.isString)),
});
export type ServerState = p.Static<typeof isServerState>;
