import * as p from '../lib/predicates';
import { isBloco } from './Bloco';

export const isServerState = p.hasShape({
  aberto: p.isBoolean,
  blocos: p.isArray(isBloco),
});
export type State = p.Static<typeof isServerState>;
