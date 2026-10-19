# sounds

Builds the sound effects of the mobile app (`mobile/assets/sounds/`) from CC0 sample packs by
Kenney (www.kenney.nl), plus a few layers synthesized with ffmpeg.

```bash
python3 scripts/sounds/build.py              # everything, rewrites LICENSES.md
python3 scripts/sounds/build.py --only tap,flip
```

Requires `python3` (stdlib only) and `ffmpeg`/`ffprobe` with libmp3lame. The script downloads the
six packs into `scripts/sounds/.cache/` (git-ignored), checks their SHA-256 and that each
`License.txt` says CC0, then renders every recipe. Output is byte-for-byte reproducible.

## House style

- **One key.** Everything tonal is in D major: the glass "tings" (`impactGlass_medium_000`) and bells
  (`impactBell_heavy_002/003`) are resampled to exact notes, sampler-style, and the pizzicato jingles
  are retuned (they ship about 7 cents sharp).
- **One space.** Reward sounds go through the same synthesized hall (unit-energy noise impulse
  response, darkened); the mythic reveal uses a longer "cathedral". UI sounds stay dry.
- **Loudness tiers** (max momentary loudness): about -24 LUFS for taps and toggles, -20 for card
  handling, -17 to -15 for small rewards, -14 to -12 for the big reveals and fanfares. Peaks are
  limited to -1 dBFS, with at most 3 dB of limiting so transients stay crisp (very short clicks
  land a little under their target on purpose).
- **Formats.** Short effects are 16-bit 44.1 kHz WAV (mono for UI and card handling, stereo when
  there is reverb) so they start without decoder delay; anything longer than about 1.2 s is
  160 kbps stereo MP3. Both play through expo-audio on iOS and Android, and Jest maps both.

To change a sound, edit its `@recipe` function in `build.py` (layers, timing, gain, pitch) and run
the script again. `LICENSES.md` in the output folder lists the source files of every output.
