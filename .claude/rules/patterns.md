# Common Patterns

## marimo Plugin Pattern

UI plugins require changes in both Python and React:

**Python** (`marimo/_plugins/ui/_impl/`):
```python
@mddoc
class slider(UIElement[int, int]):
    """A slider for selecting numeric values."""

    _name: Final[str] = "marimo-slider"

    def __init__(
        self,
        start: int,
        stop: int,
        value: int | None = None,
        step: int = 1,
        *,
        label: str = "",
    ) -> None:
        ...
```

**React** (`frontend/src/plugins/impl/`):
```typescript
export const SliderPlugin = createPlugin<SliderType>("marimo-slider")
  .withData(
    z.object({
      start: z.number(),
      stop: z.number(),
      value: z.number(),
      step: z.number(),
      label: z.string(),
    })
  )
  .withFunctions({ ... })
  .renderer((props) => <Slider {...props} />);
```

## Jotai State Pattern

```typescript
import { atom, useAtomValue } from "jotai";
import { createReducerAndAtoms } from "@/utils/createReducer";

// Complex state with reducer
const { useActions, valueAtom } = createReducerAndAtoms(initialState, {
  updateCell: (state, action) => ({ ...state, ... }),
});

// Derived atoms
export const cellIdsAtom = atom((get) => get(notebookAtom).cellIds);

// Per-item atoms (call .remove() to prevent leaks)
export const cellDataAtom = atomFamily((cellId: CellId) =>
  atom((get) => get(notebookAtom).cellData[cellId])
);
```

## Python API Models (msgspec)

```python
import msgspec

class SaveNotebookRequest(msgspec.Struct, rename="camel"):
    cell_ids: list[CellId_t]
    codes: list[str]
    filename: str
    persist: bool = True
```

## Error Handling

**Python:**
```python
from marimo._utils.http import HTTPStatus
raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="...")
```

**TypeScript:**
```typescript
import { Logger } from "@/utils/Logger";
Logger.error("Cell ${cellId} not found");
```
