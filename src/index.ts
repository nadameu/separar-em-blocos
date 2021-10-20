import { isState } from './types/State';

const a = {};
const b = isState.parse(a);
console.log(b);
