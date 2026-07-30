# Java Example Client

## Requirements

- Java 17+
- Maven

## Build

```bash
mvn compile
```

## Run

```bash
mvn exec:java
```

Run a specific test (1-5):

```bash
mvn exec:java -Dexec.args="--test=N"
```

See `examples/README.md` for test scenario descriptions.
