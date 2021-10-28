export function expectUnreachable(value: never): never {
  throw new Error('Unreachable code.');
}
