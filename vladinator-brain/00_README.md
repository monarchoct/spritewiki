# VLADINATOR_BRAIN

This repository is the source of truth for Vladinator.

## For Codex

Do NOT inject every file into the model.

Instead:

1. Detect the task (routine tweet, buy, sell, reply, quote).
2. Load only the relevant markdown files.
3. Inject live wallet data.
4. Inject recent tweets and memory.
5. Generate one output.
6. Save output back into memory.

Keep prompts around 5k-10k tokens rather than loading the entire brain.
