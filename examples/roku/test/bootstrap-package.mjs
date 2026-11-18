import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const packageDir = new URL('../dist-build/pkg-dir/', import.meta.url);
const manifest = await readFile(new URL('manifest', packageDir), 'utf8');
const entry = manifest.match(/^ts_path=pkg:\/(.+)$/m)?.[1];
assert(entry, 'SDK manifest names the production program');
const bytecode = entry.endsWith('.hbc');
const program =
  process.argv[2] ??
  (bytecode
    ? new URL('../bundle/source/compiled/index.js', packageDir)
    : new URL(entry, packageDir));
const strings = new Map();
const nodes = new Map();
const declarations = new Map();
const writes = [];
const transactions = [];
let callbacks;
const noop = () => {};
const errors = [];
const logger = {
  getLoggerRef: () => ({}),
  logDevConsole(_ref, level, message) {
    if (level >= 4) errors.push(message);
  },
};
const perfetto = {
  beginEvent: noop,
  endEvent: noop,
  instantEvent: noop,
  flowEvent: noop,
  terminateFlow: noop,
};
const setProperty = (_anchor, node, property, value) => {
  assert(nodes.has(node), 'native writes target a created node');
  assert(
    strings.has(property),
    'native writes use the registered string interner',
  );
  nodes.get(node).props.set(strings.get(property), value);
  writes.push({
    type: nodes.get(node).type,
    property: strings.get(property),
    value,
  });
};
const roku = {
  hasFeature: () => false,
  getRuntimeSingletonSync(name) {
    assert.equal(name, 'LoggerAPI');
    return logger;
  },
  LogLevel: { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 },
  perfetto,
  InternStringApi: {
    internString(value) {
      const ref = {};
      strings.set(ref, value);
      return ref;
    },
  },
  Transaction: {
    start: () => transactions.push('start'),
    end: () => transactions.push('end'),
  },
  ComponentDeclarationApi: {
    declareComponent(name, base) {
      declarations.set(strings.get(name), { name, base });
    },
    addStringField: noop,
    addBooleanField: noop,
    addIntField: noop,
    addFloatField: noop,
    addArrayField: noop,
    addObjectField: noop,
    commit: noop,
  },
  TreeManipulationApi: {
    createNode(_anchor, type) {
      assert(
        strings.has(type),
        'native node creation uses the registered string interner',
      );
      const ref = {};
      nodes.set(ref, { type: strings.get(type), props: new Map() });
      return ref;
    },
    setNodePropBool: setProperty,
    setNodePropInt: setProperty,
    setNodePropFloat: setProperty,
    setNodePropString: setProperty,
    setNodePropNull: setProperty,
    setNodePropArray: setProperty,
    setNodePropObject: setProperty,
    setNodePropNodeRef: setProperty,
    registerFieldChangeHandler: noop,
    unregisterFieldHandler: noop,
    appendNode: noop,
    insertNodeBefore: noop,
    removeNode: noop,
    setFocus: noop,
  },
  AnchorManipulationEventApi: {},
  StructuredDataApi: {
    createArray: () => [],
    appendInt: (array, value) => array.push(value),
    appendFloat: (array, value) => array.push(value),
    appendBool: (array, value) => array.push(value),
    appendString: (array, value) => array.push(value),
    appendNull: (array) => array.push(null),
    appendArray: (array, value) => array.push(value),
    appendObject: (array, value) => array.push(value),
    createObject: () => ({}),
  },
  Setup: {
    initApiObject(value) {
      callbacks = value;
    },
  },
};
const context = vm.createContext({
  roku,
  perfetto,
  console,
  queueMicrotask,
  setTimeout,
  clearTimeout,
});
vm.runInContext(await readFile(program, 'utf8'), context, {
  filename: String(program),
});
assert(
  callbacks?.anchorNode,
  'production SDK bootstrap registers the anchor-node API',
);
const app = declarations.get('SolidtvRokuProof');
assert(app, 'production entry declares the example component');
callbacks.anchorNode.createAnchorNode(app.name, {});
await new Promise(setImmediate);
assert.deepEqual(errors, [], 'production SDK bootstrap reports no errors');
assert(
  writes.some(
    ({ type, property, value }) =>
      type === 'label' && property === 'text' && value === 'Poster 1',
  ),
  'production bootstrap renders the SolidTV screen through native writes',
);
assert(
  transactions.includes('start') && transactions.includes('end'),
  'SDK bootstrap and SolidTV writes share the transaction runtime',
);
console.log(
  `Roku ${bytecode ? 'compiler-input JavaScript' : 'packaged JavaScript'} bootstrap passed with mocked hardware APIs: ${nodes.size} native nodes, ${writes.length} native property writes, committed SDK transaction.${bytecode ? ' Bytecode was not executed.' : ''}`,
);
