# Fast csv-reader — a faster drop-in for csv-reader 1.0.0

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/durov001/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/durov001/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A make.fun bounty entry: `solve.js` reads broken CSV files and returns,
for every `{text, header}` input, exactly the answer csv-reader 1.0.0
returns — `{columns, rows, errors}` — under the competition's written
broken-row policy (BOM drop, stray CRs, quote junk, unterminated quotes,
short and long rows with their error records). It reads the text once,
left to right, with slices instead of one character at a time: unquoted
fields are scanned and sliced once, a quoted field finds its closing quote
with `indexOf` and is usually one slice too, and only the rare field with
a doubled quote or a line break inside is rebuilt.

## Run it

```sh
mkdir -p in out
# put cases.json (a JSON array of {id, input}) in in/
MAKEFUN_INPUT_DIR=in MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/answers.json, one answer per case, in the cases' order
```

`main.ts` is the driver the harness runs (`node /bot/main.ts`); it turns
V8's incremental marking off before importing `solve.js`, as the house
baseline does. `solve.js` is a dependency-free ES module with a single
export, `run(input)`.

Entered on [make.fun](https://make.fun/?ref=zsk0hsg3&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards.
