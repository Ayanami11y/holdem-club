const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeChainableState(selector, store) {
  const state = store[selector] || (store[selector] = { selector });

  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'state') return state;
        if (prop === 'length') return 1;
        if (prop === Symbol.toPrimitive) return () => selector;
        if (prop === 'toString') return () => selector;
        if (prop === 'ready') {
          return (cb) => {
            if (typeof cb === 'function') cb();
            return chain;
          };
        }
        if (prop === 'text' || prop === 'html' || prop === 'val') {
          return (value) => {
            if (typeof value === 'undefined') return state[prop];
            state[prop] = value;
            return chain;
          };
        }
        if (prop === 'is') {
          return (value) => Boolean(state.is === value);
        }
        if (prop === 'prop') {
          return (name, value) => {
            if (typeof value === 'undefined') return state[name];
            state[name] = value;
            return chain;
          };
        }
        if (prop === 'data') {
          return (name, value) => {
            state.data = state.data || {};
            if (typeof value === 'undefined') return state.data[name];
            state.data[name] = value;
            return chain;
          };
        }
        if (prop === 'append' || prop === 'prepend' || prop === 'empty' || prop === 'hide' || prop === 'show' || prop === 'addClass' || prop === 'removeClass' || prop === 'css' || prop === 'click' || prop === 'submit' || prop === 'change' || prop === 'on' || prop === 'off' || prop === 'modal' || prop === 'leanModal' || prop === 'tooltip' || prop === 'dropdown' || prop === 'find' || prop === 'children' || prop === 'eq' || prop === 'each' || prop === 'focus') {
          return () => chain;
        }
        return chain[prop];
      },
    }
  );

  return chain;
}

function loadClientScript() {
  const scriptPath = path.join(__dirname, '../../src/client/main.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  const store = {};
  const emitCalls = [];

  const socket = {
    emit: (event, payload) => {
      emitCalls.push({ event, payload });
    },
    on: () => socket,
    disconnect: () => {},
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    window: null,
    document: {},
    location: { href: 'http://localhost/' },
    navigator: { userAgent: 'jest' },
    Materialize: { toast: jest.fn() },
    io: () => socket,
    socket,
    alert: jest.fn(),
    prompt: jest.fn(),
    confirm: jest.fn(() => true),
    global: null,
    $: (arg) => {
      if (typeof arg === 'function') {
        arg();
        return makeChainableState('document', store);
      }
      if (arg && arg === context.document) {
        return makeChainableState('document', store);
      }
      return makeChainableState(String(arg), store);
    },
  };
  context.window = context;
  context.global = context;

  vm.createContext(context);
  vm.runInContext(code, context, { filename: scriptPath });

  return { context, socket, emitCalls, store };
}

test('renderSelf only requests possible moves when turn changes', () => {
  const { context, emitCalls } = loadClientScript();

  expect(typeof context.renderSelf).toBe('function');

  context.renderSelf({ text: 'Their Turn', money: 80, blind: '', currentTurn: 'Alice' });
  expect(emitCalls).toEqual([{ event: 'evaluatePossibleMoves', payload: {} }]);
  expect(context.Materialize.toast).toHaveBeenCalledTimes(1);

  context.renderSelf({ text: 'Their Turn', money: 80, blind: '', currentTurn: 'Alice' });
  expect(emitCalls).toHaveLength(1);
  expect(context.Materialize.toast).toHaveBeenCalledTimes(1);

  context.renderSelf({ text: 'Check', money: 80, blind: '', currentTurn: 'Bob' });
  context.renderSelf({ text: 'Their Turn', money: 80, blind: '', currentTurn: 'Alice' });
  expect(emitCalls).toHaveLength(2);
  expect(context.Materialize.toast).toHaveBeenCalledTimes(2);
});
