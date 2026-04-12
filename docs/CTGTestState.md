# CTGTestState

Mutable state object threaded through pipeline operations. Carries the subject, computed value, accumulated results, and pipeline label.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _subject | * | The current subject being tested |
| _computed | * | Intermediate computed value (starts undefined) |
| _results | [CTGTestResult] | Accumulated results from pipeline steps |
| _label | STRING | Pipeline label for reporting |

---

### CONSTRUCTOR :: { subject: *, label: STRING }? -> ctgTestState

Creates state with optional subject and label. Results starts as an empty array. Computed starts undefined.

```javascript
const state = new CTGTestState({ subject: 42, label: "my pipeline" });
```

---

### CTGTestState.init :: STRING, * -> ctgTestState

Static factory. Creates a new state with the given label and subject.

```javascript
const state = CTGTestState.init("my pipeline", 42);
```

---

### ctgTestState.label :: VOID -> STRING

Gets or sets the pipeline label.

```javascript
state.label = "updated label";
console.log(state.label); // "updated label"
```

---

### ctgTestState.subject :: VOID -> *

Gets or sets the current subject.

```javascript
state.subject = state.subject * 2;
```

---

### ctgTestState.computed :: VOID -> *

Gets or sets the intermediate computed value.

```javascript
state.computed = someFunction(state.subject);
```

---

### ctgTestState.results :: VOID -> [CTGTestResult]

Returns the accumulated results array.

```javascript
const results = state.results;
```

---

### ctgTestState.status :: VOID -> INT

Aggregate status derived from results. Delegates to `CTGTestResult.aggregateStatus`. Error outranks fail outranks pass.

```javascript
const status = state.status; // 0 = PASS, 1 = FAIL, 2 = ERROR
```

---

### ctgTestState.addResult :: CTGTestResult -> VOID

Appends a result to the results array.

```javascript
state.addResult(CTGTestResult.stageResult(["my pipeline", "step1"], CTGTestResult.STATUS.PASS));
```

---

### ctgTestState.toJSON :: VOID -> OBJECT

Returns a plain object for JSON serialization. Exposes label, subject, computed, and results.

```javascript
JSON.stringify(state); // uses toJSON internally
```
