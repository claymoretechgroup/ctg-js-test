# ChainStep

Extends CTGTestStep. Inlines another pipeline's steps, threading the subject through. Results are nested under a chain entry in the outer state. Outer config and prior results are preserved.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _pipeline | CTGTest | The pipeline to inline |

### CONSTRUCTOR :: STRING, CTGTest -> chainStep

Creates a chain step with a name and a CTGTest instance. The target must be a CTGTest instance — duck typing is not accepted.

---

### chainStep.expectedOutcome :: VOID -> NULL

Returns `null`. Chain steps do not require comparison. The pipeline evaluates the chained pipeline's aggregate status.

---

### chainStep.execute :: CTGTestState -> PROMISE(CTGTestState)

Executes the chained pipeline with the current `state.subject` and `state.config`. Updates `state.subject` with the chained pipeline's final subject. Sets `state._chainResult` with nested results and status for the pipeline to record.

```javascript
const inner = CTGTest.init("inner")
    .stage("add 1", (state) => { state.subject = state.subject + 1; return state; });

CTGTest.init("outer")
    .chain("use inner", inner)
    .start(5);
```
