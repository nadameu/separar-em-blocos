namespace Internal {
  declare const OpaqueSymbol: unique symbol;
  declare class Opaque<S extends symbol> {
    private [OpaqueSymbol]: S;
  }
  export type OpaqueType<T, S extends symbol> = T & Opaque<S>;
}
export type Opaque<T, S extends symbol> = Internal.OpaqueType<T, S>;
