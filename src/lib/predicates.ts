export class AssertionError extends Error {
  readonly name = 'AssertionError';
  constructor(message?: string) {
    super(message);
  }
}

export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

export interface Narrow<T, U extends T> {
  (value: T): value is U;
}
export interface Predicate<T> extends Narrow<unknown, T> {}

export function isUnknown(value: unknown): value is unknown {
  return true;
}

interface IsOfTypeMap {
  bigint: bigint;
  boolean: boolean;
  function: Function;
  number: number;
  object: object | null;
  string: string;
  symbol: symbol;
  undefined: undefined;
}

export function isOfType<K extends keyof IsOfTypeMap>(
  typeRepresentation: K
): Predicate<IsOfTypeMap[K]> {
  return (value: unknown): value is IsOfTypeMap[K] => typeof value === typeRepresentation;
}

export const isBigInt = /* @__PURE__ */ isOfType('bigint');
export const isBoolean = /* @__PURE__ */ isOfType('boolean');
export const isFunction = /* @__PURE__ */ isOfType('function');
export const isNumber = /* @__PURE__ */ isOfType('number');
export const isOfTypeObject = /* @__PURE__ */ isOfType('object');
export const isString = /* @__PURE__ */ isOfType('string');
export const isSymbol = /* @__PURE__ */ isOfType('symbol');

export function isLiteral<T extends string | number | bigint | boolean | symbol | null | undefined>(
  literal: T
) {
  return (value: unknown): value is T => value === literal;
}
export const isUndefined = /* @__PURE__ */ isLiteral(undefined);
export const isNull = /* @__PURE__ */ isLiteral(null);

export function negate<U>(predicate: Predicate<U>) {
  return <T>(value: T | U): value is T => !predicate(value);
}
export const isNotNull = /* @__PURE__ */ negate(isNull);
export const isDefined = /* @__PURE__ */ negate(isUndefined);

export function refine<T, U extends T>(
  predicate: Predicate<T>,
  refinement: Narrow<T, U>
): Predicate<U>;
export function refine<T, U extends T, V extends U>(
  predicate: Predicate<T>,
  refinement0: Narrow<T, U>,
  refinement1: Narrow<U, V>
): Predicate<V>;
export function refine(...predicates: Predicate<any>[]): any {
  return (value: any) => predicates.every(p => p(value));
}
export const isObject = /* @__PURE__ */ refine(isOfTypeObject, isNotNull);

export function isAnyOf<T extends Predicate<any>[]>(
  ...predicates: T
): Predicate<T extends Predicate<infer U>[] ? U : never> {
  return (value): value is any => predicates.some(p => p(value));
}
export const isNullish = /* @__PURE__ */ isAnyOf(isNull, isUndefined);
export const isNotNullish = /* @__PURE__ */ negate(isNullish);

export function isArray<T>(predicate: Predicate<T>): Predicate<T[]> {
  return refine(
    (value): value is unknown[] => Array.isArray(value),
    (xs): xs is T[] => xs.every(predicate)
  );
}
