#!/usr/bin/env node
// Runs before `npm run demo`, `demo:phone` and `dev` (npm pre-scripts). Never blocks the command and never fails it.
import { starPrompt } from './star-lib.mjs';
await starPrompt().catch(() => {});
