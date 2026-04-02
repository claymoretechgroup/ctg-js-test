# CTGTestError

Typed error class extending `Error` with bidirectional name/code lookup. All framework errors use this class with a specific error type.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| _type | STRING | Resolved error type name (e.g., `"INVALID_STEP"`) |
| _code | INT | Resolved numeric error code (e.g., `1000`) |
| _msg | STRING | Error message (defaults to type name if not provided) |
| _data | * | Arbitrary context data or `null` |
| name | STRING | Always `"CTGTestError"` (for native Error compatibility) |
| message | STRING | Same as `_msg` (for native Error compatibility) |

### Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1000 | INVALID_STEP | Step defined with non-callable fn, empty name, duplicate name, or unknown type |
| 1001 | INVALID_CHAIN | Chain target is not a CTGTest instance, or chain depth exceeds 64 |
| 1002 | INVALID_CONFIG | Unknown config key, invalid output mode, wrong type for boolean/timeout/formatter |
| 1003 | INVALID_EXPECTED | Assert expected is a function, or assertAny expected is not an array |
| 1004 | INVALID_SKIP | Skip target doesn't exist, duplicate skip, or predicate is not a function |
| 2000 | FORMATTER_ERROR | Formatter threw a non-CTGTestError exception or returned non-string |
| 2001 | RUNNER_ERROR | CLI runner-level failure |

---

### CONSTRUCTOR :: STRING|INT, STRING?, * -> ctgTestError

Creates a typed error from a type name or numeric code. Resolves both directions via the `ERROR_TYPES` map. If `msg` is not provided, defaults to the type name. Unknown types or codes throw a native `TypeError`.

```javascript
throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
throw new CTGTestError(1002, "Unknown config key: bogus", { key: "bogus" });
```

---

### CTGTestError.lookup :: STRING|INT -> INT|STRING

Bidirectional lookup. String input returns the numeric code. Integer input returns the type name. Throws `TypeError` for unknown values.

```javascript
CTGTestError.lookup("INVALID_STEP"); // 1000
CTGTestError.lookup(1000);           // "INVALID_STEP"
```
