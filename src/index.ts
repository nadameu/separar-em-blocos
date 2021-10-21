import { assert } from './lib/predicates';
import { isServerState } from './types/State';

const a = {};
assert(isServerState(a));
console.log(a);
