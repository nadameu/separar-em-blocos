export class AssertionError extends Error {
  readonly name = 'AssertionError';
  constructor(message?: string) {
    super(message);
  }
}

export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

export interface Refinement<T, U extends T> {
  (value: T): value is U;
}
export interface Predicate<T> extends Refinement<unknown, T> {}

export interface Negate<U> {
  <T>(value: T | U): value is T;
}

export type Static<T> = T extends Predicate<infer U> ? U : never;

export const isUnknown: Predicate<unknown> = (value: unknown): value is unknown => true;

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
): Predicate<T> {
  return (value: unknown): value is T => value === literal;
}
export const isUndefined = /* @__PURE__ */ isLiteral(undefined);
export const isNull = /* @__PURE__ */ isLiteral(null);

export function negate<U>(predicate: Predicate<U>): Negate<U> {
  return <T>(value: T | U): value is T => !predicate(value);
}
export const isNotNull = /* @__PURE__ */ negate(isNull);
export const isDefined = /* @__PURE__ */ negate(isUndefined);

type Refine<T> = T extends never ? never : Predicate<ExtractPredicateType<T, unknown>>;
type ExtractPredicateType<T, V> = T extends [Negate<infer Exc>, ...infer R]
  ? ExtractPredicateType<R, Exclude<V, Exc>>
  : T extends [Refinement<infer From, infer To>, ...infer R]
  ? V extends From
    ? ExtractPredicateType<R, To>
    : unknown
  : T extends []
  ? V
  : never;

export function refine<T, U extends T>(
  predicate: Predicate<T>,
  refinement: Refinement<T, U>
): Predicate<U>;
export function refine<T extends Array<Refinement<any, any> | Negate<any>>>(
  ...predicates: T
): Refine<T>;
export function refine(...predicates: Function[]) {
  return (value: unknown) => predicates.every(p => p(value));
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

export function hasKeys<K extends string>(...keys: K[]): Predicate<Record<K, unknown>> {
  return refine(isObject, (obj: object): obj is Record<K, unknown> =>
    keys.every(key => key in obj)
  );
}

export function hasShape<T extends Record<string, Predicate<any>>>(
  predicates: T
): Predicate<{ [K in keyof T]: T[K] extends Predicate<infer U> ? U : never }> {
  return refine(hasKeys(...Object.keys(predicates)), (obj): obj is Record<keyof T, any> =>
    Object.entries(predicates).every(([key, predicate]) => predicate(obj[key]))
  );
}
