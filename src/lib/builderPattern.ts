// General helpers

type Extends<A, B, T = true, F = false> = A extends B ? T : F;

type DeepWhile<T> = Extends<
  true,
  Extends<T[keyof T], Function>,
  T,
  {
    [K in keyof T]: DeepWhile<T[K]>;
  }
>;

type UnionToIntersection<T> = [T] extends [never]
  ? never
  : (T extends infer U ? (_: U) => any : never) extends (_: infer R) => any
  ? DeepWhile<R>
  : never;

type GetPayload<P extends Pair, Key extends string> = P extends Pair<Key, infer Value>
  ? Value
  : never;

// Partial helpers

type ActionCreators<AC extends ActionCreator | ThunkCreator> = (
  AC extends ActionCreator<infer Type, infer Input, infer Payload>
    ? (_: { [K in Type]: ConcreteActionCreator<Type, Input, Payload> }) => any
    : AC extends ThunkCreator<
        infer Type,
        infer Input,
        infer State,
        infer Dependencies,
        infer Payload
      >
    ? (_: { [K in Type]: ConcreteThunkCreator<Type, Input, State, Dependencies, Payload> }) => any
    : never
) extends (_: infer R) => any
  ? { [K in keyof R]: R[K] }
  : never;

type ConcreteActionCreator<Type extends string, Input, Payload> = [Input] extends [never]
  ? () => void
  : (_: Input) => void;

type ConcreteThunkCreator<Type extends string, Input, State, Dependencies, Payload> = [
  Input,
] extends [never]
  ? () => Payload
  : (_: Input) => Payload;

type GetType<AC extends ActionCreator | ThunkCreator> = AC extends ActionCreator<infer Type>
  ? Type
  : AC extends ThunkCreator<infer Type>
  ? Type
  : never;

type ValidActionType<B extends BuilderState, T extends string> = Exclude<
  T,
  GetType<B['actionCreators']> | ''
>;

type ValidAsyncActionType<B extends BuilderState, T extends string> = Exclude<
  T,
  GetType<B['actionCreators']> | ConflictingKeys<GetType<B['actionCreators']>> | ''
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

interface Action<Type extends string = string, Payload = unknown> {
  type: Type;
  payload: Payload;
}

interface ActionCreator<Type extends string = string, Input = never, Payload = unknown> {
  (input: Input): Action<Type, Payload>;
}

interface Thunk<
  Type extends string = string,
  State = never,
  Dependencies = never,
  Result = unknown,
> {
  type: Type;
  (
    actionCreators: Record<string, (payload: never) => unknown>,
    getState: () => State,
    extra: Dependencies,
  ): Result;
}

interface ThunkCreator<
  Type extends string = string,
  Input = never,
  State = never,
  Dependencies = never,
  Result = unknown,
> {
  (input: Input): Thunk<Type, State, Dependencies, Result>;
}

interface BuilderState {
  state: unknown;
  actionCreators: ActionCreator | ThunkCreator;
  dependencies: {};
  unhandled: Pair;
}

// Transformations

type AddActionCreator<B extends BuilderState, AC extends ActionCreator | ThunkCreator> = {
  result: {
    state: B['state'];
    actionCreators: B['actionCreators'] | AC;
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

type AddUnhandledActionCreator<
  B extends BuilderState,
  AC extends ActionCreator | ThunkCreator,
  U extends Pair,
  Extra,
> = {
  result: {
    state: B['state'];
    actionCreators: B['actionCreators'] | AC;
    dependencies: B['dependencies'] | Extra;
    unhandled: B['unhandled'] | U;
  };
}['result'];

function defaultActionCreator(type: string) {
  return (payload: unknown): Action => ({ type, payload });
}

class Builder<B extends BuilderState> {
  private _actionCreators: Record<string, Function>;
  private _matchers: Array<[Function, Function]>;
  private _reducers: Record<string, Function>;

  constructor() {
    this._actionCreators = {};
    this._matchers = [];
    this._reducers = {};
  }

  createAction<Type extends string, Payload = void>(
    type: ValidActionType<B, Type>,
    reducer: (state: B['state'], payload: Payload) => B['state'],
  ): Builder<AddActionCreator<B, ActionCreator<Type, Payload, Payload>>>;
  createAction(type: string, reducer: Function) {
    this._actionCreators[type] = defaultActionCreator(type);
    this._reducers[type] = reducer;
    return this;
  }

  createThunk<Type extends string, Payload, Extra = never, Input = void>(
    type: ValidAsyncActionType<B, Type>,
    thunkCreator: (
      input: Input,
    ) => (
      actionCreators: ActionCreators<B['actionCreators']>,
      getState: () => B['state'],
      extra: Extra,
    ) => Promise<Payload>,
  ): Builder<
    AddUnhandledActionCreator<
      B,
      ThunkCreator<Type, Input, B['state'], Extra, Promise<Payload>>,
      | Pair<Type, Promise<Payload>>
      | Pair<`${Type}/pending`, never>
      | Pair<`${Type}/fulfilled`, Payload>
      | Pair<`${Type}/rejected`, unknown>,
      Extra
    >
  >;
  createThunk<Type extends string, Payload, Extra = never, Input = never>(
    type: ValidActionType<B, Type>,
    thunkCreator: (
      input: Input,
    ) => (
      actionCreators: ActionCreators<B['actionCreators']>,
      getState: () => B['state'],
      extra: Extra,
    ) => Payload,
  ): Builder<
    AddUnhandledActionCreator<
      B,
      ThunkCreator<Type, Input, B['state'], Extra, Payload>,
      Pair<Type, Payload>,
      Extra
    >
  >;
  createThunk(type: string, thunkCreator: Function): any {
    this._actionCreators[type] = (payload: any) => {
      const thunk = thunkCreator(payload);
      thunk.type = type;
      return thunk;
    };
    return this;
  }

  handleAction<Type extends B['unhandled']['key']>(
    type: Type,
    reducer: (state: B['state'], payload: GetPayload<B['unhandled'], Type>) => B['state'],
  ): Builder<AddReducer<B, Type>>;
  handleAction<Type extends string>(
    matcher: (type: string) => type is Type,
    reducer: (
      state: B['state'],
      payload: Action<Type, GetPayload<B['unhandled'], Type>>,
    ) => B['state'],
  ): Builder<AddReducer<B, Type>>;
  handleAction(type: string | Function, reducer: Function) {
    if (typeof type === 'string') {
      this._reducers[type] = reducer;
    } else {
      this._matchers.push([type, reducer]);
    }
    return this;
  }

  initialize(
    initialState: B['state'],
    ...dependencies: [B['dependencies']] extends [never]
      ? []
      : [UnionToIntersection<B['dependencies']>]
  ): {
    actions: ActionCreators<B['actionCreators']>;
    getState(): B['state'];
    subscribe(subscriber: () => void): () => void;
  };
  initialize(initialState: any, dependencies?: any) {
    let state = initialState;

    const dispatch = (action: Action | Function) => {
      let oldState = state;
      let returnValue: { current: any } | null = null;
      if (typeof action === 'object') {
        if (action.type in this._reducers) {
          state = this._reducers[action.type]!(state, action.payload);
        } else {
          for (const [matcher, reducer] of this._matchers) {
            if (matcher(action.type)) {
              state = reducer(state, action);
              break;
            }
          }
        }
      } else {
        const type = (action as any).type;
        const result = action(actions, getState, dependencies);
        dispatch({ type, payload: result });
        if (typeof result === 'object' && result !== null) {
          if (result instanceof Promise) {
            dispatch({ type: `${type}/pending`, payload: undefined });
            result.then(
              payload => {
                dispatch({ type: `${type}/fulfilled`, payload });
              },
              payload => {
                dispatch({ type: `${type}/rejected`, payload });
              },
            );
          }
        }
        returnValue = { current: result };
      }
      if (state !== oldState) {
        for (const subscriber of subscribers) {
          subscriber();
        }
      }
      if (returnValue) return returnValue.current;
    };

    const actions = Object.fromEntries(
      Object.entries(this._actionCreators).map(([key, creator]) => [
        key,
        (arg: unknown): void => dispatch(creator(arg)),
      ]),
    );

    const subscribers = new Set<() => void>();

    function getState() {
      return state;
    }

    return {
      actions,
      getState,
      subscribe(subscriber: () => void) {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
    };
  }
}

export function builderPattern<State>(): Builder<{
  state: State;
  actionCreators: never;
  dependencies: never;
  unhandled: never;
  results: never;
}> {
  return new Builder();
}
