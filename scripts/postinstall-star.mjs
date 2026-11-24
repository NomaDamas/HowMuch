#!/usr/bin/env node
// After `npm install`: the same prompt as everywhere else (see star-lib.mjs).
import { starPrompt } from './star-lib.mjs';
await starPrompt().catch(() => {});
