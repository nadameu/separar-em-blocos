// General helpers

import { Opaque } from './Opaque';

type Force<T> = { result: T }['result'];

type Simplify<A> = Force<{ [K in keyof A]: A[K] }>;

type T = DeepWhile<{ a: { b: typeof Math; c: { d: typeof localStorage } } }>;

type Extends<A, B, T = true, F = false> = A extends B ? T : F;

type DeepWhile<T> = Extends<
  true,
  Extends<T[keyof T], Function>,
  T,
  {
    [K in keyof T]: DeepWhile<T[K]>;
  }
>;

type UnionToIntersection<T> = (T extends infer U ? (_: U) => any : never) extends (
  _: infer R,
) => any
  ? DeepWhile<R>
  : never;

type GetPayload<P extends Pair, Key extends string> = P extends Pair<Key, infer Value>
  ? Value
  : never;

// Partial helpers

type PairsToActionCreators<P extends Pair, Result> = (
  P extends Pair<infer ActionName, infer Input>
    ? (_: { [K in ActionName]: ActionCreator<Input, Result> }) => any
    : never
) extends (_: infer R) => any
  ? { [K in keyof R]: R[K] }
  : never;

type ActionCreator<Input, Result> = [Input] extends [void] ? () => Result : (_: Input) => Result;

type ValidActionType<B extends BuilderState, T extends string> = Exclude<
  T,
  B['actionCreators']['key'] | ''
>;

type ValidAsyncActionType<B extends BuilderState, T extends string> = Exclude<
  T,
  B['actionCreators']['key'] | ConflictingKeys<B['actionCreators']['key']> | ''
>;

type ConflictingKeys<T extends string> = T extends `${infer U}/${
  | 'pending'
  | 'fulfilled'
  | 'rejected'}`
  ? U
  : never;

// Interfaces

interface Pair<Key extends string = string, Value = any> {
  key: Key;
  value: Value;
}

interface BuilderState {
  state: unknown;
  actionCreators: Pair;
  dependencies: {};
  unhandled: Pair;
}

// Transformations

type AddActionCreator<B extends BuilderState, Type extends string, Input> = {
  result: {
    state: B['state'];
    actionCreators: B['actionCreators'] | Pair<Type, Input>;
    dependencies: B['dependencies'];
    unhandled: B['unhandled'];
  };
}['result'];

type AddReducer<B extends BuilderState, Type extends B['unhandled']['key']> = {
  result: {
    state: B['state'];
    actionCreators: B['actionCreators'];
    dependencies: B['dependencies'];
    unhandled: Exclude<B['unhandled'], Pair<Type, any>>;
  };
}['result'];

type AddUnhandledAction<
  B extends BuilderState,
  Type extends string,
  Input,
  Payload,
  Extra = never,
> = {
  result: {
    state: B['state'];
    actionCreators: B['actionCreators'] | Pair<Type, Input>;
    dependencies: B['dependencies'] | Extra;
    unhandled: B['unhandled'] | Pair<Type, Payload>;
  };
}['result'];

type AddUnhandledAsyncActions<
  B extends BuilderState,
  Type extends string,
  Input,
  Payload,
  Extra = never,
> = {
  result: {
    state: B['state'];
    actionCreators: B['actionCreators'] | Pair<Type, Input>; // Cons<Type, Input, B['actionCreators']>;
    dependencies: B['dependencies'] | Extra;
    unhandled:
      | B['unhandled']
      | Pair<Type, Promise<Payload>>
      | Pair<`${Type}/pending`, never>
      | Pair<`${Type}/fulfilled`, Payload>
      | Pair<`${Type}/rejected`, unknown>;
  };
}['result'];

declare class Builder<B extends BuilderState> {
  __getTypes(): {
    state: B['state'];
    actionCreators: PairsToActionCreators<B['actionCreators'], unknown>;
    dependencies: UnionToIntersection<B['dependencies']>;
    unhandled: PairsToActionCreators<B['unhandled'], unknown>;
  };

  addAction<Type extends string, Payload = void>(
    type: ValidActionType<B, Type>,
    reducer: (state: B['state'], payload: Payload) => B['state'],
  ): Builder<AddActionCreator<B, Type, Payload>>;
  addAction<Type extends string, Payload, Input = void>(
    type: ValidActionType<B, Type>,
    options: {
      prepare(input: Input): Payload;
      reducer(state: B['state'], payload: Payload): B['state'];
    },
  ): Builder<AddActionCreator<B, Type, Input>>;
  addAction<Type extends string, Payload, Input = void>(
    type: ValidActionType<B, Type>,
    options: {
      prepare(input: Input): Payload;
    },
  ): Builder<AddUnhandledAction<B, Type, Input, Payload, {}>>;

  createAsyncThunk<Type extends string, Payload, Extra = never, Input = void>(
    type: ValidAsyncActionType<B, Type>,
    thunkCreator: (
      input: Input,
    ) => <Action>(
      actionCreators: PairsToActionCreators<B['actionCreators'], Action>,
      dispatch: (action: Action) => void,
      getState: () => B['state'],
      extra: Extra,
    ) => Promise<Payload>,
  ): Builder<AddUnhandledAsyncActions<B, Type, Input, Payload, Extra>>;

  createThunk<Type extends string, Payload, Extra = never, Input = void>(
    type: ValidActionType<B, Type>,
    thunkCreator: (
      input: Input,
    ) => <Action>(
      actionCreators: PairsToActionCreators<B['actionCreators'], Action>,
      dispatch: (action: Action) => void,
      getState: () => B['state'],
      extra: Extra,
    ) => Payload,
  ): Builder<AddUnhandledAction<B, Type, Input, Payload, Extra>>;

  handleAction<Type extends B['unhandled']['key']>(
    type: Type,
    reducer: (state: B['state'], payload: GetPayload<B['unhandled'], Type>) => B['state'],
  ): Builder<AddReducer<B, Type>>;
  handleAction<Type extends string>(
    matcher: (type: string) => type is Type,
    reducer: (state: B['state'], payload: GetPayload<B['unhandled'], Type>) => B['state'],
  ): Builder<AddReducer<B, Type>>;

  initialize(
    initialState: B['state'],
    dependencies: UnionToIntersection<B['dependencies']>,
  ): {
    actionCreators: PairsToActionCreators<B['actionCreators'], Action>;
    reducer: (state: B['state'], action: Action) => B['state'];
  };
}

declare const ActionSymbol: unique symbol;
declare class Action {
  private readonly [ActionSymbol]: never;
}

export declare function builderPattern<State>(): Builder<{
  state: State;
  actionCreators: never;
  dependencies: never;
  unhandled: never;
}>;

type Model = number;

const built = builderPattern<Model>()
  .addAction('noop', x => x)
  .addAction('dummy', {
    prepare: (name: string) => ({ name }),
  })
  .addAction('loading', state => state)
  .addAction('error', (state, reason: unknown) => {
    console.error(reason);
    return state;
  })
  .handleAction('dummy', (state, { name }) => state + name.length)
  .addAction('increment', state => state + 1)
  .addAction('decrement', state => state - 1)
  .addAction('add', (state, amount: number) => state + amount)
  .addAction('set', (_, value: number) => value)
  .createThunk('waitThenAdd', (amount: number) => ({ add, loading }, dispatch) => {
    dispatch(loading());
    return setTimeout(add, 1000, amount);
  })
  .handleAction('waitThenAdd', (state, timerId) => {
    clearTimeout(timerId);
    return state;
  })
  .createAsyncThunk(
    'getFromLocalStorage',
    (key: string) =>
      async ({ set }, dispatch, _, Effects: { Store: { local: typeof localStorage } }) => {
        const result = Effects.Store.local.getItem(key);
        if (!result) throw new Error();
        dispatch(set(Number(result)));
        return 369;
      },
  )
  .handleAction('getFromLocalStorage/pending', state => state)
  .createThunk(
    'saveToLocalStorage',
    () =>
      ({ noop }, dispatch, getState, Effects: { Store: { local: typeof localStorage } }) => {
        Effects.Store.local.setItem('key', String(getState()));
      },
  )
  .createThunk(
    'random',
    () =>
      ({ set }, dispatch, getState, Effects: { Math: { random: typeof Math.random } }) => {
        dispatch(set(Effects.Math.random()));
        return 42 as 42;
      },
  )
  .createThunk('abcd/rejected', () => () => {})
  .createAsyncThunk('abcdde', () => async () => {})
  .handleAction(
    (x): x is `${string}dom` | `${string}LocalStorage` => x.endsWith('dom'),
    (state, payload) => state,
  )
  .handleAction(
    (x): x is string => true,
    state => state,
  )
  .initialize(42, { Math: { random: Math.random.bind(Math) }, Store: { local: localStorage } });
const { actionCreators, reducer } = built;

reducer(0, actionCreators.decrement());
