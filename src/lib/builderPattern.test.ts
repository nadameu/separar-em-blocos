import { expect } from 'chai';
import { builderPattern } from './builderPattern';

describe('builderPattern', () => {
  it('is an object', () => {
    const builder = builderPattern<number>();
    expect(builder).to.be.an('object');
  });
  it('has the correct methods', () => {
    const builder = builderPattern<number>();
    expect(builder).to.have.a.property('createAction').which.is.a('function');
    expect(builder).to.have.a.property('createThunk').which.is.a('function');
    expect(builder).to.have.a.property('handleAction').which.is.a('function');
    expect(builder).to.have.a.property('initialize').which.is.a('function');
  });
});

describe('initialized', () => {
  it('contains a getState method', () => {
    const store = builderPattern().initialize(null);
    expect(store).to.have.a.property('getState').which.is.a('function');
  });
  it('stores a value', () => {
    const store = builderPattern<number>().initialize(42);
    expect(store.getState()).to.equal(42);
  });
  it('creates action creators', () => {
    const store = builderPattern<number>()
      .createAction('increment', state => state + 1)
      .initialize(0);
    expect(store)
      .to.have.a.property('actions')
      .which.is.an('object')
      .with.a.property('increment')
      .which.is.a('function');
  });
  it('dispatches actions', () => {
    const store = builderPattern<number>()
      .createAction('increment', state => state + 1)
      .initialize(10);
    store.actions.increment();
    expect(store.getState()).to.equal(11);
  });
  it('creates thunks', () => {
    const store = builderPattern<number>()
      .createThunk('add', (payload: number) => () => {
        return payload;
      })
      .initialize(10);
    expect(store.actions).to.have.a.property('add').which.is.a('function');
  });
  it('handles thunks actions', () => {
    const store = builderPattern<string[]>()
      .createAction('log', (state, payload: unknown) => {
        return state.concat([JSON.stringify(payload)]);
      })
      .createThunk('thunk', (payload: string) => actions => {
        actions.log({ 'payload-is': payload });
        return payload.length;
      })
      .initialize([]);
    const result = store.actions.thunk('hey there');
    expect(store.getState()).to.deep.equal(['{"payload-is":"hey there"}']);
    expect(result).to.equal(9);
  });
  it('dispatches an action when using thunks', () => {
    const store = builderPattern<string[]>()
      .createThunk('thunk', (payload: string) => () => ({ augmented: payload }))
      .handleAction('thunk', (state, payload) => state.concat([JSON.stringify(payload)]))
      .initialize([]);
    store.actions.thunk('hey');
    expect(store.getState()).to.deep.equal(['{"augmented":"hey"}']);
  });
  it('handles actions using matchers', () => {
    const store = builderPattern<number>()
      .createThunk('unhandled', () => () => 'result')
      .handleAction(
        (x): x is 'unhandled' => x === 'unhandled',
        (state, { payload: text }) => state + text.length,
      )
      .initialize(12);
    const result = store.actions.unhandled();
    expect(result).to.equal('result');
    expect(store.getState()).to.equal(18);
  });
  it('handles async thunks', async () => {
    const store = builderPattern<number>()
      .createAction('add', (state, amount: number) => state + amount)
      .createThunk('thunk', (amount: number) => async actions => {
        actions.add(amount);
        return 'this is the result';
      })
      .initialize(12);

    const result = await store.actions.thunk(17);
    expect(result).to.equal('this is the result');
    expect(store.getState()).to.equal(29);
  });
  it('handles async thunks with rejections', async () => {
    const store = builderPattern<Array<Record<string, string>>>()
      .createThunk('thunk', () => async _ => {
        throw 'this is the result';
      })
      .initialize([]);
    const result = await store.actions.thunk().then(
      value => ({ type: 'ok' as const, value }),
      reason => ({ type: 'error' as const, reason }),
    );
    expect(result).to.deep.equal({ type: 'error', reason: 'this is the result' });
  });
  it('dispatches actions on async thunks', async () => {
    const store = builderPattern<Record<string, unknown>>()
      .createThunk('thunk', () => async _ => 'this is the result')
      .handleAction(
        (x): x is string => true,
        (state, action) => {
          return Object.assign({}, state, { [action.type]: action.payload });
        },
      )
      .initialize({});
    await store.actions.thunk().catch(() => {});
    expect(store.getState()).to.have.a.property('thunk').which.is.a('promise');
    expect(store.getState()).to.have.a.property('thunk/pending').which.is.a('undefined');
    expect(store.getState())
      .to.have.a.property('thunk/fulfilled')
      .which.equals('this is the result');
    expect(store.getState()).not.to.have.a.property('thunk/rejected');
  });
  it('dispatches actions on rejected async thunks', async () => {
    const store = builderPattern<Record<string, unknown>>()
      .createThunk('thunk', () => async _ => {
        throw 'this is the result';
      })
      .handleAction(
        (x): x is string => true,
        (state, action) => {
          return Object.assign({}, state, { [action.type]: action.payload });
        },
      )
      .initialize({});
    await store.actions.thunk().catch(() => {});
    expect(store.getState()).to.have.a.property('thunk').which.is.a('promise');
    expect(store.getState()).to.have.a.property('thunk/pending').which.is.a('undefined');
    expect(store.getState())
      .to.have.a.property('thunk/rejected')
      .which.equals('this is the result');
    expect(store.getState()).not.to.have.a.property('thunk/fulfilled');
  });

  it('has a subscribe method', () => {
    const store = builderPattern<number>().initialize(0);
    expect(store).to.have.a.property('subscribe').which.is.a('function');
  });

  it('calls the subscribers when first subscribed, and when the value of the store has changed', () => {
    const store = builderPattern<number>()
      .createAction('add', (state, amount: number) => state + amount)
      .initialize(0);
    let called = 0;
    const unsubscribe = store.subscribe(() => {
      called++;
    });
    expect(called).to.equal(1);
    store.actions.add(0);
    expect(called).to.equal(1);
    store.actions.add(3);
    expect(called).to.equal(2);
    unsubscribe();
    store.actions.add(-3);
    expect(called).to.equal(2);
  });

  it('handles external dependencies', () => {
    const store = builderPattern<string[]>()
      .createAction('register', (state, name: string) => state.concat([name]))
      .createThunk('thunk', () => (actions, getState, { Math }: { Math: { random(): number } }) => {
        actions.register(`Random number: ${Math.random()}`);
      })
      .initialize([], {
        Math: {
          random() {
            return 27;
          },
        },
      });
    store.actions.thunk();
    expect(store.getState()).to.deep.equal([`Random number: 27`]);
  });
});

describe('thunks', () => {
  it('have access to the current state', () => {
    const store = builderPattern<number>()
      .createAction('increment', state => state + 1)
      .createThunk('thunk', () => (actions, getState) => {
        actions.increment();
        actions.increment();
        actions.increment();
        return getState();
      })
      .initialize(5);
    const result = store.actions.thunk();
    expect(result).to.equal(8);
  });
});
