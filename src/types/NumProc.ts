import { Opaque } from '../lib/Opaque';
import * as p from '../lib/predicates';

export type NumProc = Opaque<string, { readonly Numproc: unique symbol }>;
export const isNumProc = p.refine(p.isString, (x): x is NumProc => /^\d{20}$/.test(x));
