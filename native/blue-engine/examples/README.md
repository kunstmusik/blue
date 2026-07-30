# Blue Engine Example Clients

This directory contains example clients for **blue-engine** in multiple languages. All clients exercise the same core set of audio tests against the engine via ZeroMQ.

## Shared Test Scenarios

Each language client implements the following numbered tests:

- **Test 1 – Manual Channel Updates**
  - Creates an engine and simple synth.
  - Compiles a standard `chnexport` orchestra, then plays a 5-second note and manually updates the exported `freq` control channel (e.g. 440 → 550 → 660 → 880 → …).
  - Verifies basic engine lifecycle and channel control.

- **Test 2 – LINEAR Curve Automation**
  - Creates a `freq` automation with a LINEAR curve.
  - Typical shape: 440 Hz → 880 Hz between 2–4 seconds of a 6-second note.
  - Starts with automation disabled, then enables it mid-playback.

- **Test 3 – STEP Curve Automation**
  - Creates a STEP automation on `freq`.
  - Frequency jumps every ~0.5 seconds between several values.
  - Automation is enabled a couple of seconds into the note.

- **Test 4 – EXPONENTIAL Curve Automation**
  - Creates an EXPONENTIAL automation on `freq`.
  - Smooth exponential glide, typically 220 Hz → 880 Hz during a 6-second note.
  - After playback, tests listing and clearing automations.

- **Test 5 – LINEAR Automation with Resolution (Quantization)**
  - Creates a LINEAR automation from 220 Hz → 880 Hz over a longer window (e.g. 2–6 seconds of an 8-second note).
  - Uses a coarse `resolution` (e.g. `100.0`) so the glide is audibly quantized into steps.
  - Lets you verify the automation `resolution`/quantization behavior.

## Running Examples per Language

Each language has its own client and build instructions; see the language-specific `README.md` files for full details. Below are the common entry points and how to select tests.

### Python

- Client: `examples/python/test_client.py`
- Run all tests:
  - `python test_client.py`
- Run a specific test `N` (1–5):
  - `python test_client.py --test=N`

### C

- Client (after building): `build/examples/c/example_client_c`
- Run all tests:
  - `./example_client_c`
- Run a specific test `N` (1–5):
  - `./example_client_c --test=N`

### C++

- Client (after building): `build/examples/cpp/example_client_cpp`
- Run all tests:
  - `./example_client_cpp`
- Run a specific test `N` (1–5):
  - `./example_client_cpp --test=N`

### JavaScript (Node.js)

- Client: `examples/javascript/test_client.js`
- Run all tests:
  - `node test_client.js`
- Run a specific test `N` (1–5):
  - `node test_client.js --test=N`

### Java

- Client: `examples/java/src/main/java/com/kunstmusik/blueengine/BlueEngineClient.java`
- Run all tests via Maven:
  - `mvn exec:java`
- Run a specific test `N` (1–5):
  - `mvn exec:java -Dexec.args="--test=N"`

### Rust

- Client: `examples/rust/src/main.rs`
- Run all tests sequentially:
  - `cargo run`
- Run a specific test `N` (1–5):
  - `cargo run -- --test=N`

All clients assume that a `blue-engine` server is running and listening on `tcp://localhost:5555` with shared memory configured as described in the main project `README.md`.
