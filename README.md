# Gherkin Tests for OPC UA

This repository contains an OPC UA AutoId CS server that interacts with a simulated RFID reader
using a TCP socket. The RFID reader implementation has a method to inject simulated tag reads.

The DI and AutoId nodeset files are pulled from the OPC Foundation's `UA-Nodeset` repository which
is included as a git submodule.

The server is intended to demonstrate the usage of `cucumber-js` to run tests written in the
`Gherkin` syntax against an OPC UA server using a `NodeOPCUA` based OPC UA client.

## Project Structure

The `features` directory contains the `.feature` files with the `Gherkin` test scenarios.
Its subdirectory `step_definitions` contains several `TypeScript` files with the step definitions
grouped by topic.

The `world` directory contains the file `opcuaworld.ts` with the scope the tests run inside.
It manages the OPC UA server and reader simulator and provides the OPC UA client and the methods
that are required to implement the step definitions.

The OPC UA server and reader simulator implementations are located in the `src` directory.

## Setup

The submodule must be initialized and the dependencies must be installed before the tests can be run.

```
git submodule update --init --recursive
npm ci
```

## Usage

The tests are run by executing

```
npm run test
```

This generates output on the console and also creates a HTML report in the `reports` directory.

If the default configuration does not work on the current host, for example if the standard OPC UA
port `4840` is already in use, the file `.env` can be changed accordingly.

## Development

Extending the tests, test setup or demo server code is best done in Visual Studio Code with the
`esbenp.prettier-vscode` plugin installed to use the `format-on-save` option.

The `package.json` also provides the `npm run check` script which applies code formatting, runs
the linter and executes a dry run of `cucumber-js` to point out any missing step definitions.
