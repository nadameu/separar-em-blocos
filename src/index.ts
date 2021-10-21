import { assert } from './lib/predicates';
import { isState } from './types/State';

const a = {};
assert(isState(a));
console.log(a);
