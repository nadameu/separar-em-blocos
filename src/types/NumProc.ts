import * as p from '../lib/predicates';

export const isNumProc = p.refine(p.isString, (x): x is string => /^\d{20}$/.test(x));

export type NumProc = p.Static<typeof isNumProc>;
