#!/usr/bin/env node

import { run } from "./bin";

run().then((code) => {
  process.exitCode = code;
});
