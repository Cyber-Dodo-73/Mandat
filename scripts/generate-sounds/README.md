# generate-sounds

Synthesizes the placeholder sound effects of the mobile app (`mobile/assets/sounds/*.wav`).

All sounds are generated from math (sine partials, filtered seeded noise, echo): no samples,
so they are royalty-free and the output is identical on every run.

```bash
node scripts/generate-sounds/generate.mjs
```

Format: WAV, 44.1 kHz, mono, 16-bit PCM, peak-normalized to about -1 dBFS, 3 ms fades at both edges.

To tweak a sound, edit its entry in the `sounds` object of `generate.mjs` and run the script again.
These are placeholders: replace the files with designed sounds later, keeping the same names.
