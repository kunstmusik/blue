# Python Example Client

Features:
- Clean Pythonic API with type hints
- Context manager for resource cleanup
- Struct packing for binary protocol

## Requirements

- Python 3.10+
- [uv](https://github.com/astral-sh/uv)

## Run

```bash
uv run test_client.py
```

Run a specific test (1-5):

```bash
uv run test_client.py --test=N
```

See `examples/README.md` for test scenario descriptions.
