# CTGTestState

Mutable state object threaded through pipeline steps. Carries the subject, accumulated results, config, and handoff fields for step-to-pipeline communication. Returned by `start()` to the caller.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| subject | * | Current subject value, mutated by stage steps |
| results | [OBJECT] | Accumulated step result entries |
| config | OBJECT | Resolved pipeline config |
| name | STRING | Pipeline name |
| actual | * | Computed value from assert/assertAny steps for pipeline comparison |
| skipTargets | OBJECT | Map of step names to skip flags, set by skip steps |

### CONSTRUCTOR :: OBJECT? -> ctgTestState

Creates a new state with optional subject, config, and name. Results starts as an empty array. skipTargets starts as an empty object.

```javascript
const state = new CTGTestState({ subject: 5, config: { strict: true }, name: "my test" });
```

---

### ctgTestState.status :: VOID -> STRING

Getter. Aggregates status from results. Error takes precedence over fail, which takes precedence over recovered, skip, and pass.

| Results contain | Status |
|----------------|--------|
| any error | `"error"` |
| any fail (no error) | `"fail"` |
| any recovered (no fail/error) | `"recovered"` |
| any skip (no fail/error/recovered) | `"skip"` |
| all pass or empty | `"pass"` |

```javascript
const state = new CTGTestState({ subject: 1 });
state.results.push({ name: "a", status: "pass" });
state.results.push({ name: "b", status: "fail" });
state.status; // "fail"
```
