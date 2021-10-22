import { Opaque } from '../lib/Opaque';
import * as p from '../lib/predicates';

declare const NumProcSymbol: unique symbol;
export type NumProc = Opaque<string, typeof NumProcSymbol>;
export const isNumProc = p.refine(p.isString, (x): x is NumProc => /^\d{20}$/.test(x));
