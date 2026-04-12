# CTGTest

Pipeline-based test engine. Sequences operations, evaluates outcomes, records results on state. Test instances are definitions — they hold no subject and carry no runtime state until `start()` is called.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _label | STRING | Label for this pipeline (trimmed at construction) |
| _operations | [OBJECT] | Ordered list of operation descriptors |

### Static Fields

| Field | Type | Description |
|-------|------|-------------|
| MAX_CHAIN_DEPTH | INT | Maximum chain nesting depth (64) |
| DEFAULT_CONFIG | OBJECT | Default configuration merged into every `start()` call |
| VALID_CONFIG_KEYS | [STRING] | Accepted config keys: `haltOnFailure`, `timeout` |

---

### CTGTest.init :: STRING -> ctgTest

Creates a new pipeline with the given label. Uses late-bound construction (`new this(...)`) so subclasses inherit correctly.

```javascript
const test = CTGTest.init("my test");
```

---

### ctgTest.label :: VOID -> STRING

Getter. Returns the pipeline label.

```javascript
const test = CTGTest.init("my test");
test.label; // "my test"
```

---

### ctgTest.stage :: STRING, (ctgTestState -> *) -> ctgTest

Adds a stage operation to the pipeline. At execution time, the handler receives the current `CTGTestState` and its return value becomes the new subject. Chainable.

```javascript
CTGTest.init("arithmetic")
    .stage("double", (state) => state.subject * 2);
```

---

### ctgTest.assert :: STRING, (ctgTestState -> *), ctgTestPredicate -> ctgTest

Adds an assert operation to the pipeline. The handler receives the current `CTGTestState` and returns a computed value. The predicate evaluates the computed value to determine pass or fail. Chainable.

```javascript
CTGTest.init("arithmetic")
    .stage("double", (state) => state.subject * 2)
    .assert("is four", (state) => state.subject, CTGTestPredicates.equals(4));
```

---

### ctgTest.chain :: STRING, ctgTest -> ctgTest

Appends a chain operation that embeds another pipeline inline. The chained pipeline runs against the same state, threading the subject through. Result labels are prefixed with the chain label path. Chainable.

```javascript
const validate = CTGTest.init("validate")
    .assert("is positive", (state) => state.subject, CTGTestPredicates.greaterThan(0));

CTGTest.init("math")
    .stage("add one", (state) => state.subject + 1)
    .chain("validate result", validate);
```

---

### ctgTest.skip :: STRING, (ctgTestState -> BOOL)? -> ctgTest

Adds a skip directive targeting the operation with the given label. If the condition function returns true (or is omitted for unconditional skip), the target operation is skipped at execution time. The target must exist in the same pipeline. Chainable.

```javascript
CTGTest.init("conditional")
    .skip("expensive check")
    .assert("expensive check", (state) => state.subject, CTGTestPredicates.isTrue());
```

---

### ctgTest.start :: ctgTestState | *, OBJECT? -> PROMISE(ctgTestState)

Executes the pipeline. Validates config and operations synchronously, then runs operations asynchronously. If the subject is not a `CTGTestState` instance, it is wrapped in one. Returns the final `CTGTestState` containing all results.

The pipeline does not write to stdout or select formatters — the caller owns delivery.

```javascript
const state = await CTGTest.init("arithmetic")
    .stage("double", (state) => state.subject * 2)
    .assert("is four", (state) => state.subject, CTGTestPredicates.equals(4))
    .start(2);
```

### Config

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `haltOnFailure` | BOOL | `true` | Stop pipeline at first fail or error |
| `timeout` | INT | `5000` | Per-operation timeout in ms (0 = disabled) |
