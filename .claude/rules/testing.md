# Testing Requirements

## Test Types

1. **Python Unit Tests** - pytest in `tests/` (mirrors `marimo/` structure)
2. **Frontend Unit Tests** - Vitest alongside source or in `__tests__/`
3. **E2E Tests** - Playwright in `frontend/e2e-tests/`

## Running Tests

```bash
# Python tests (specific file)
uvx hatch run +py=3.12 test:test tests/path/to/test.py

# Python tests with optional dependencies
uvx hatch run +py=3.12 test-optional:test tests/path/to/test.py

# Frontend tests
cd frontend && pnpm test src/path/to/file.test.ts

# E2E tests
make e2e
# or interactively:
cd frontend && pnpm playwright test --ui
```

## Python Test Patterns

```python
# Focus on single use-case per test
def test_number_init() -> None:
    number = ui.number(1, 10)
    assert number.start == 1 and number.stop == 10

# Test error cases with context managers
def test_number_out_of_bounds() -> None:
    with pytest.raises(ValueError) as e:
        ui.number(1, 10, value=11)
    assert "must be less than or equal" in str(e.value)

# Use parametrize for exhaustive test cases
@pytest.mark.parametrize(("a", "b"), [(1, 2), (2, 3)])
def test_add(a, b):
    assert a + b == 3

# Use fixtures for setup/teardown
@pytest.fixture
def k() -> Generator[Kernel, None, None]:
    mocked = MockedKernel()
    yield mocked.k
    mocked.teardown()
```

## Test-Driven Development

1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)

## Agent Support

- **tdd-guide** - Use PROACTIVELY for new features
- **e2e-runner** - Playwright E2E testing specialist
