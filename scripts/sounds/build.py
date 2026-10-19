#!/usr/bin/env python3
"""Builds the sound effects of the MANDAT mobile app (mobile/assets/sounds/).

Steps (all reproducible, no manual editing):
  1. download the Kenney.nl audio packs (CC0) and check their SHA-256,
  2. extract them into scripts/sounds/.cache/<pack>/ and check each licence says CC0,
  3. render every effect with ffmpeg: trim, pitch to the house key (D major), layer,
     convolve with a synthesized hall, fade, loudness-match, peak-limit, encode,
  4. write mobile/assets/sounds/LICENSES.md (source pack + files + licence per output).

Requirements: python3 (stdlib only) and ffmpeg/ffprobe with libmp3lame on PATH.
Usage: python3 scripts/sounds/build.py [--only name1,name2] [--keep-temp]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / '.cache'
OUT = ROOT / 'mobile' / 'assets' / 'sounds'
SR = 44100

# ---------------------------------------------------------------- sources

PACKS = {
    'ui-audio': (
        'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip',
        '946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6',
        'UI Audio',
    ),
    'interface-sounds': (
        'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
        'f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232',
        'Interface Sounds',
    ),
    'casino-audio': (
        'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip',
        'f36250766ac5bc378c13708ddf12a23a8e54a3251f8d482c7536e51b5dbafa18',
        'Casino Audio',
    ),
    'impact-sounds': (
        'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
        '029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8',
        'Impact Sounds',
    ),
    'rpg-audio': (
        'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
        '6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b',
        'RPG Audio',
    ),
    'music-jingles': (
        'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip',
        'b729ba57959bd58793d2c5cafa348aaf2655d354f3da35ec4729e03ec77197b8',
        'Music Jingles',
    ),
}


def fetch_packs() -> None:
    (CACHE / 'zips').mkdir(parents=True, exist_ok=True)
    for name, (url, sha, _) in PACKS.items():
        archive = CACHE / 'zips' / f'{name}.zip'
        if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != sha:
            print(f'download {url}')
            req = urllib.request.Request(url, headers={'User-Agent': 'mandat-sound-build/1.0'})
            with urllib.request.urlopen(req, timeout=120) as res:
                archive.write_bytes(res.read())
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        if digest != sha:
            sys.exit(f'checksum mismatch for {name}: {digest}')
        target = CACHE / name
        if not target.exists():
            with zipfile.ZipFile(archive) as zf:
                for member in zf.infolist():
                    dest = (target / member.filename).resolve()
                    if not str(dest).startswith(str(target.resolve())):
                        sys.exit(f'unsafe path in {name}: {member.filename}')
                zf.extractall(target)
        licence = (target / 'License.txt').read_text(errors='replace')
        if 'Creative Commons Zero, CC0' not in licence:
            sys.exit(f'{name}: licence file does not state CC0')


def src(pack: str, file: str) -> 'Src':
    sub = {
        'pizz': ('music-jingles', 'Audio/Pizzicato jingles/'),
    }
    if pack in sub:
        pack, prefix = sub[pack]
        file = prefix + file
    else:
        file = 'Audio/' + file
    return Src(pack, file)


@dataclass(frozen=True)
class Src:
    pack: str
    file: str

    @property
    def path(self) -> Path:
        return CACHE / self.pack / self.file


# ---------------------------------------------------------------- music helpers

NOTE_INDEX = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def hz(note: str) -> float:
    m = re.fullmatch(r'([A-G]#?)(-?\d)', note)
    assert m, note
    midi = NOTE_INDEX[m.group(1)] + (int(m.group(2)) + 1) * 12
    return 440.0 * 2 ** ((midi - 69) / 12)


# Measured fundamentals (strongest partial right after the attack) of the tonal sources.
GLASS = src('impact-sounds', 'impactGlass_medium_000.ogg')  # clean glass "ting", 901.5 Hz
GLASS_HZ = 901.5
TINK = src('impact-sounds', 'impactGlass_light_002.ogg')  # brighter, shorter, 1097.9 Hz
TINK_HZ = 1097.9
BELL = src('impact-sounds', 'impactBell_heavy_002.ogg')  # heavy bell, 226.1 Hz
BELL_HZ = 226.1
BELL_HI = src('impact-sounds', 'impactBell_heavy_003.ogg')  # lighter bell, 325.2 Hz
BELL_HI_HZ = 325.2
JINGLE_CENTS = 7  # the Kenney jingles are tuned about 7 cents sharp of A440
SEMI = 2 ** (1 / 12)
JINGLE_FIX = 2 ** (-JINGLE_CENTS / 1200)


# ---------------------------------------------------------------- layers


@dataclass
class Layer:
    """One sound placed on the timeline.

    source: a Src, a Path to an intermediate render, or a lavfi expression ('lavfi:...').
    rate: sampler-style pitch ratio (also changes duration, like a sampler).
    """

    source: object
    at: float = 0.0
    gain: float = 0.0
    rate: float = 1.0
    start: float = 0.0
    length: float | None = None
    fade_in: float = 0.0
    fade_out: float = 0.0
    pan: float = 0.0  # -1 left .. +1 right
    fx: str = ''
    reverse: bool = False


def ting(note: str, at: float, gain: float = 0.0, pan: float = 0.0, fx: str = '') -> Layer:
    # The high-pass removes the low "clack" of the glass being struck and keeps the tone.
    hp = 'highpass=f=450:p=2'
    return Layer(GLASS, at=at, gain=gain, rate=hz(note) / GLASS_HZ, pan=pan, fx=hp + (',' + fx if fx else ''),
                 fade_in=0.002)


def tink(note: str, at: float, gain: float = 0.0, pan: float = 0.0) -> Layer:
    return Layer(TINK, at=at, gain=gain, rate=hz(note) / TINK_HZ, pan=pan, fx='highpass=f=2200:p=2',
                 fade_in=0.004)


def bell(note: str, at: float, gain: float = 0.0, pan: float = 0.0, fx: str = '') -> Layer:
    return Layer(BELL, at=at, gain=gain, rate=hz(note) / BELL_HZ, pan=pan, fx=fx)


def bell_hi(note: str, at: float, gain: float = 0.0, pan: float = 0.0, fx: str = '') -> Layer:
    return Layer(BELL_HI, at=at, gain=gain, rate=hz(note) / BELL_HI_HZ, pan=pan, fx=fx)


def pizz(n: int, at: float, gain: float = 0.0, semitones: float = 0.0, fx: str = '', **kw) -> Layer:
    return Layer(src('pizz', f'jingles_PIZZI{n:02d}.ogg'), at=at, gain=gain,
                 rate=JINGLE_FIX * SEMI ** semitones, fx=fx, **kw)


def sparkles(seed: int, t0: float, t1: float, count: int, gain: float, notes: list[str]) -> list[Layer]:
    """Random shower of high glass tinks, spread across the stereo field, fading out."""
    rng = random.Random(seed)
    out = []
    for i in range(count):
        t = t0 + (t1 - t0) * (i + rng.random() * 0.8) / count
        decay = -9.0 * (t - t0) / max(t1 - t0, 1e-3)
        out.append(tink(rng.choice(notes), t, gain + decay + rng.uniform(-3, 0), pan=rng.uniform(-0.8, 0.8)))
    return out


def lavfi_sines(freqs: list[float], dur: float, attack: float, release: float, trem_hz: float = 0.0,
                trem_depth: float = 0.0) -> str:
    """Sum of sines with a linear attack, exponential-ish release and optional tremolo."""
    partials = '+'.join(f'sin(2*PI*{f:.3f}*t+{i * 1.3:.2f})' for i, f in enumerate(freqs))
    env = f'min(1,t/{attack:.4f})*min(1,({dur:.4f}-t)/{release:.4f})'
    trem = f'*(1-{trem_depth:.3f}*0.5*(1+sin(2*PI*{trem_hz:.3f}*t)))' if trem_depth else ''
    return f"lavfi:aevalsrc='({partials})/{len(freqs)}*{env}{trem}':s={SR}:d={dur:.4f}:c=stereo"


def shimmer(dur: float) -> str:
    """Glassy high pad (D major partials, slow random-feeling beating) for epic+ tails."""
    notes = [hz('D7'), hz('F#7') * 1.002, hz('A7') * 0.998, hz('D8') * 1.001]
    parts = []
    for i, f in enumerate(notes):
        rate = 3.1 + i * 1.7
        parts.append(f'sin(2*PI*{f:.3f}*t)*(0.55+0.45*sin(2*PI*{rate:.2f}*t+{i}))')
    env = f'min(1,t/0.25)*exp(-2.2*t/{dur:.3f})*min(1,({dur:.3f}-t)/0.2)'
    left = '+'.join(parts)
    right = '+'.join(p.replace('*t)*', '*t+1.1)*') for p in parts)
    return f"lavfi:aevalsrc='({left})/4*{env}|({right})/4*{env}':s={SR}:d={dur:.3f}"


def chirp(f0: float, f1: float, dur: float, curve: float = 2.0) -> str:
    """Exponential frequency sweep whose level rises along `curve`, ending at full level."""
    k = f1 / f0
    phase = f'2*PI*{f0:.3f}*{dur:.3f}/log({k:.5f})*(pow({k:.5f},t/{dur:.3f})-1)'
    env = f'pow(t/{dur:.3f},{curve:.2f})'
    vib = f'(1+0.004*sin(2*PI*5.5*t))'
    return f"lavfi:aevalsrc='sin({phase}*{vib})*{env}':s={SR}:d={dur:.3f}:c=stereo"


def accel_tremolo_drone(f: float, dur: float, r0: float, r1: float) -> str:
    """Low drone (fundamental + octave + fifth) with a tremolo that speeds up from r0 to r1 Hz."""
    tone = f'(sin(2*PI*{f:.3f}*t)+0.5*sin(2*PI*{2 * f:.3f}*t)+0.25*sin(2*PI*{3 * f:.3f}*t))/1.75'
    phase = f'2*PI*({r0:.3f}*t+({r1 - r0:.3f})*t*t/(2*{dur:.3f}))'
    env = f'(0.15+0.85*pow(t/{dur:.3f},1.6))'
    return f"lavfi:aevalsrc='{tone}*(0.6+0.4*sin({phase}))*{env}':s={SR}:d={dur:.3f}:c=stereo"


def noise(dur: float, color: str, seed: int, amp: float = 0.5) -> str:
    return f'lavfi:anoisesrc=d={dur:.3f}:c={color}:r={SR}:a={amp}:s={seed}'


def boom(f: float, dur: float) -> str:
    """Low thump with a quick downward pitch bend and exponential decay. The 2nd/3rd harmonics keep it
    audible on phone speakers, which reproduce almost nothing below ~150 Hz."""
    ph = f'2*PI*{f:.2f}*t*(1+0.6*exp(-t*30))'
    return (f"lavfi:aevalsrc='(sin({ph})+0.5*sin(2*{ph})+0.25*sin(3*{ph}))/1.75*exp(-t*{5.0 / dur:.3f})"
            f"*min(1,t/0.004)*min(1,({dur:.3f}-t)/0.08)':s={SR}:d={dur:.3f}:c=stereo")


# ---------------------------------------------------------------- ffmpeg plumbing

TMP: Path


def run(args: list[str]) -> str:
    res = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *args], capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f'ffmpeg failed:\n{" ".join(args)}\n{res.stderr[-3000:]}')
    return res.stderr


_counter = 0


def tmpfile(stem: str) -> Path:
    global _counter
    _counter += 1
    return TMP / f'{_counter:03d}_{stem}.wav'


def input_args(source: object) -> list[str]:
    if isinstance(source, Src):
        return ['-i', str(source.path)]
    if isinstance(source, Path):
        return ['-i', str(source)]
    if isinstance(source, str) and source.startswith('lavfi:'):
        return ['-f', 'lavfi', '-i', source[len('lavfi:'):]]
    raise TypeError(source)


def layer_chain(layer: Layer, idx: int) -> str:
    f = [f'[{idx}:a]aresample={SR}', 'aformat=sample_fmts=fltp:channel_layouts=stereo']
    if layer.start or layer.length:
        end = f':end={layer.start + layer.length:.4f}' if layer.length else ''
        f.append(f'atrim=start={layer.start:.4f}{end}')
        f.append('asetpts=PTS-STARTPTS')
    if layer.reverse:
        f.append('areverse')
    if abs(layer.rate - 1) > 1e-6:
        f.append(f'asetrate={SR * layer.rate:.3f}')
        f.append(f'aresample={SR}')
    if isinstance(layer.source, Src):
        f.append('highpass=f=20')  # several Kenney files carry a small DC offset in their tails
    if layer.fx:
        f.append(layer.fx)
    # Samples get at least a 1 ms fade-in and a 12 ms fade-out so trimmed or resampled edges never click.
    is_sample = isinstance(layer.source, (Src, Path))
    fade_in = max(layer.fade_in, 0.001 if is_sample else 0.0)
    fade_out = max(layer.fade_out, 0.012 if is_sample else 0.0)
    if fade_in:
        f.append(f'afade=t=in:d={fade_in:.4f}')
    if fade_out:
        f.append(f'areverse,afade=t=in:d={fade_out:.4f},areverse')
    if layer.pan:
        p = max(-1.0, min(1.0, layer.pan))
        lg = math.cos((p + 1) * math.pi / 4) * math.sqrt(2)
        rg = math.sin((p + 1) * math.pi / 4) * math.sqrt(2)
        f.append(f'pan=stereo|c0={lg:.3f}*c0|c1={rg:.3f}*c1')
    f.append(f'volume={layer.gain:.2f}dB')
    if layer.at > 0:
        f.append(f'adelay={int(round(layer.at * 1000))}:all=1')
    return ','.join(f) + f'[l{idx}]'


def mix(layers: list[Layer], dur: float, post: str = '') -> Path:
    """Renders the layers on one stereo timeline, `dur` seconds long (float WAV)."""
    out = tmpfile('mix')
    args: list[str] = []
    chains = []
    for i, layer in enumerate(layers):
        args += input_args(layer.source)
        chains.append(layer_chain(layer, i))
    labels = ''.join(f'[l{i}]' for i in range(len(layers)))
    tail = f'amix=inputs={len(layers)}:normalize=0:duration=longest,apad=whole_dur={dur:.4f},atrim=end={dur:.4f}'
    if post:
        tail += ',' + post
    graph = ';'.join(chains) + f';{labels}{tail}[out]'
    run([*args, '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_f32le', str(out)])
    return out


_irs: dict[str, Path] = {}


def impulse(kind: str) -> Path:
    """Synthesized stereo impulse responses: decorrelated noise with exponential decay, darkened."""
    if kind in _irs:
        return _irs[kind]
    rt, lp, pre = {'room': (0.45, 7000, 0.006), 'hall': (1.9, 5200, 0.018), 'cathedral': (3.2, 4200, 0.03)}[kind]
    dur = rt * 1.1
    k = 6.91 / rt  # -60 dB at rt
    amp = math.sqrt(3 * 2 * k / SR)  # unit-energy IR: the wet level then roughly matches the dry level
    expr = (f"if(lt(t,{pre}),0,{amp:.6f}*(random(0)*2-1)*exp(-{k:.3f}*(t-{pre})))|"
            f"if(lt(t,{pre}),0,{amp:.6f}*(random(1)*2-1)*exp(-{k:.3f}*(t-{pre})))")
    out = TMP / f'ir_{kind}.wav'
    run(['-f', 'lavfi', '-i', f"aevalsrc='{expr}':s={SR}:d={dur:.3f}",
         '-af', f'lowpass=f={lp}:p=1,highpass=f=180,afade=t=out:st={dur * 0.7:.3f}:d={dur * 0.3:.3f}',
         '-c:a', 'pcm_f32le', str(out)])
    _irs[kind] = out
    return out


def reverb(path: Path, kind: str, wet_db: float, dur: float | None = None) -> Path:
    """Adds a convolution reverb (dry + wet). The tail is kept up to `dur` seconds."""
    ir = impulse(kind)
    out = tmpfile(f'rev_{kind}')
    d = dur if dur is not None else probe_duration(path)
    graph = (f'[0:a]apad=whole_dur={d:.4f},asplit[dry][w];'
             f'[w][1:a]afir=dry=1:wet=1:irnorm=-1[wet];'
             f'[wet]volume={wet_db:.2f}dB[wetg];'
             f'[dry][wetg]amix=inputs=2:normalize=0:duration=first,atrim=end={d:.4f}[out]')
    run(['-i', str(path), '-i', str(ir), '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_f32le', str(out)])
    return out


def process(path: Path, af: str) -> Path:
    out = tmpfile('fx')
    run(['-i', str(path), '-af', af, '-c:a', 'pcm_f32le', str(out)])
    return out


def probe_duration(path: Path) -> float:
    res = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)],
                         capture_output=True, text=True, check=True)
    return float(json.loads(res.stdout)['format']['duration'])


def loudness(path: Path) -> tuple[float, float]:
    """(max momentary loudness LUFS, true peak dBTP). Short clips are padded so the 400 ms window fits."""
    err = run(['-v', 'verbose', '-i', str(path), '-af', 'apad=pad_dur=0.5,ebur128=peak=true:framelog=verbose',
               '-f', 'null', '-'])
    moments = [float(m) for m in re.findall(r'M:\s*(-?[\d.]+)', err)]
    peaks = re.findall(r'Peak:\s*(-?[\d.]+|-inf)\s*dBFS', err)
    tp = max((float(p) for p in peaks if p != '-inf'), default=-99.0)
    return max(moments), tp


# ---------------------------------------------------------------- final encode

MAX_LIMIT = 3.0  # dB of peak reduction allowed in the final limiter


@dataclass
class Output:
    name: str
    fmt: str  # 'wav' or 'mp3'
    mono: bool
    target: float  # max momentary loudness (LUFS)
    glue: bool = False  # gentle bus compression before the limiter (layered reward sounds)
    sources: list[Src] = field(default_factory=list)
    synth: list[str] = field(default_factory=list)
    duration: float = 0.0
    size: int = 0
    measured: tuple[float, float] = (0.0, 0.0)


def finish(spec: Output, path: Path, fade_out: float = 0.04, ceiling_db: float = -1.0) -> None:
    """Edge fades, gain to the loudness target, peak limiting, encode."""
    d = probe_duration(path)
    shaped = process(path, f'afade=t=in:d=0.002,afade=t=out:st={max(0.0, d - fade_out):.4f}:d={fade_out:.4f}'
                     + (',pan=mono|c0=0.5*c0+0.5*c1' if spec.mono else ''))
    if spec.glue:
        shaped = process(shaped, 'acompressor=threshold=0.08:ratio=3:attack=4:release=180:knee=6:makeup=1')
    m, peak = loudness(shaped)
    # Gain to the target, but never push more than MAX_LIMIT dB into the limiter: short transients
    # (taps, card snaps) stay crisp and simply end up a little under target.
    headroom = ceiling_db + MAX_LIMIT - peak
    gain = min(spec.target - m, headroom)
    lim = 10 ** (ceiling_db / 20)
    for _ in range(2):
        limited = process(shaped, f'volume={gain:.2f}dB,alimiter=limit={lim:.4f}:attack=1:release=40:level=disabled'
                          f':asc=1,volume=-0.1dB')
        m2, _ = loudness(limited)
        if abs(m2 - spec.target) < 0.4 or gain >= headroom:
            break
        gain = min(gain + spec.target - m2, headroom)
    dest = OUT / f'{spec.name}.{spec.fmt}'
    if spec.fmt == 'wav':
        run(['-i', str(limited), '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
             '-c:a', 'pcm_s16le', '-ar', str(SR), str(dest)])
    else:
        run(['-i', str(limited), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '160k', '-ar', str(SR),
             '-write_xing', '1', str(dest)])
    spec.duration = probe_duration(dest)
    spec.size = dest.stat().st_size
    spec.measured = loudness(dest)


# ---------------------------------------------------------------- recipes
#
# House style: everything tonal is in D major (glass "tings" and bells are resampled to exact notes,
# the pizzicato jingles are retuned), reward sounds share the same synthesized hall, UI sounds stay
# dry and short. Loudness targets are max momentary loudness: ~-24 for ticks, ~-19 for card handling,
# ~-15 for rewards, ~-13 for the big moments.

RECIPES = {}


def recipe(name: str, fmt: str, target: float, mono: bool = False, glue: bool = False):
    def deco(fn):
        RECIPES[name] = (fn, Output(name, fmt, mono, target, glue))
        return fn
    return deco


@recipe('tap', 'wav', -24, mono=True)
def r_tap():
    return mix([
        Layer(src('ui-audio', 'click2.ogg'), fx='highpass=f=180,lowpass=f=9000'),
        Layer(src('impact-sounds', 'impactSoft_medium_002.ogg'), gain=-14, length=0.05, fade_out=0.03),
    ], 0.07), 0.02


@recipe('toggle', 'wav', -23, mono=True)
def r_toggle():
    return mix([
        Layer(src('interface-sounds', 'toggle_002.ogg'), fx='highpass=f=200'),
        Layer(src('ui-audio', 'click2.ogg'), gain=-10, fx='highpass=f=300'),
    ], 0.13), 0.03


@recipe('flip', 'wav', -19, mono=True)
def r_flip():
    return mix([
        Layer(src('casino-audio', 'card-slide-1.ogg'), start=0.07, length=0.3, fx='highpass=f=250'),
        Layer(src('casino-audio', 'card-place-1.ogg'), at=0.05, start=0.06, length=0.3, gain=-3,
              fx='highpass=f=120'),
    ], 0.34), 0.08


@recipe('card_slide', 'wav', -20, mono=True)
def r_card_slide():
    return mix([
        Layer(src('casino-audio', 'card-shove-1.ogg'), length=0.5, fx='highpass=f=200'),
        Layer(src('casino-audio', 'card-slide-3.ogg'), at=0.03, length=0.4, gain=-8, fx='highpass=f=400'),
    ], 0.5), 0.18


@recipe('tear', 'wav', -17, mono=True)
def r_tear():
    # Two overlapping takes of a real card-pack opening make one long, continuous rip.
    return mix([
        Layer(src('casino-audio', 'cards-pack-open-1.ogg'), fx='highpass=f=150'),
        Layer(src('casino-audio', 'cards-pack-open-2.ogg'), at=0.32, gain=-5, fx='highpass=f=300'),
        Layer(src('casino-audio', 'cards-pack-take-out-1.ogg'), at=0.75, gain=-12, fx='highpass=f=500'),
    ], 1.15), 0.2


@recipe('coin', 'wav', -17, glue=True)
def r_coin():
    dry = mix([
        Layer(src('casino-audio', 'chips-stack-1.ogg'), start=0.06, fx='highpass=f=300'),
        Layer(src('rpg-audio', 'handleCoins2.ogg'), at=0.02, gain=6, fx='highpass=f=500'),
        ting('A6', 0.05, gain=-9, pan=-0.3),
        ting('D7', 0.13, gain=-11, pan=0.3),
    ], 0.75)
    return reverb(dry, 'room', -14), 0.15


@recipe('answer_correct', 'wav', -16)
def r_answer_correct():
    dry = mix([
        ting('D6', 0.0, gain=0, pan=-0.15),
        ting('A6', 0.09, gain=-1, pan=0.15),
        pizz(16, 0.0, gain=-10, semitones=-1, length=0.35, fade_out=0.15),
    ], 0.75)
    return reverb(dry, 'hall', -17), 0.25


@recipe('answer_wrong', 'wav', -21)
def r_answer_wrong():
    # Soft and short: a muted two-note pizzicato step down plus a dull low bell, nothing harsh.
    dry = mix([
        pizz(9, 0.0, gain=0, length=0.45, fade_out=0.2, fx='lowpass=f=2400'),
        bell('D3', 0.0, gain=-14, fx='lowpass=f=900', ),
    ], 0.6)
    return reverb(dry, 'room', -16), 0.2


@recipe('reveal_common', 'wav', -19)
def r_reveal_common():
    dry = mix([
        Layer(src('casino-audio', 'card-place-4.ogg'), length=0.35, fx='highpass=f=120'),
        ting('D6', 0.02, gain=-10),
    ], 0.7)
    return reverb(dry, 'room', -16), 0.25


@recipe('reveal_uncommon', 'wav', -17, glue=True)
def r_reveal_uncommon():
    dry = mix([
        Layer(src('casino-audio', 'card-place-4.ogg'), length=0.35, gain=-3, fx='highpass=f=120'),
        ting('D6', 0.0, gain=-2, pan=-0.2),
        ting('A6', 0.08, gain=-3, pan=0.2),
    ], 1.1)
    return reverb(dry, 'hall', -15), 0.4


@recipe('reveal_rare', 'mp3', -15, glue=True)
def r_reveal_rare():
    arp = [ting(n, 0.06 * i, gain=-1 - i, pan=-0.4 + 0.27 * i) for i, n in enumerate(['D6', 'F#6', 'A6', 'D7'])]
    dry = mix([
        Layer(src('casino-audio', 'card-place-4.ogg'), length=0.3, gain=-6, fx='highpass=f=150'),
        *arp,
        *sparkles(11, 0.22, 1.0, 7, -10, ['F#7', 'A7', 'D7']),
        Layer(shimmer(1.3), at=0.1, gain=-22),
    ], 1.7)
    return reverb(dry, 'hall', -11), 0.5


@recipe('reveal_epic', 'mp3', -14, glue=True)
def r_reveal_epic():
    arp = [ting(n, 0.05 + 0.055 * i, gain=-2 - 0.7 * i, pan=(-0.5 if i % 2 else 0.5) * (0.3 + i / 8))
           for i, n in enumerate(['D6', 'F#6', 'A6', 'D7', 'F#7', 'A7'])]
    dry = mix([
        bell('D4', 0.0, gain=-3),
        bell('A3', 0.0, gain=-8),
        Layer(src('impact-sounds', 'impactPlate_heavy_001.ogg'), gain=-10, fx='lowpass=f=500'),
        Layer(boom(hz('D2'), 0.6), gain=-10),
        *arp,
        *sparkles(23, 0.45, 1.7, 10, -9, ['D7', 'F#7', 'A7']),
        Layer(shimmer(2.0), at=0.12, gain=-18),
    ], 2.4)
    return reverb(dry, 'hall', -8), 0.6


@recipe('reveal_legendary', 'mp3', -13, glue=True)
def r_reveal_legendary():
    # Gold swell (reversed hall bloom of a D-major glass chord) -> bell + boom hit -> chime fanfare
    # (A5 D6 F#6 . A6) doubled an octave down by the light bell -> sparkle shower over a shimmer pad.
    bloom_src = mix([ting('D6', 0, -2), ting('F#6', 0, -3), ting('A6', 0, -3), ting('D7', 0, -6)], 0.4)
    bloom = process(reverb(bloom_src, 'cathedral', 0, dur=1.2), 'areverse,atrim=start=0.6,asetpts=PTS-STARTPTS')
    hit = 0.6
    fanfare = [('A5', 0.12), ('D6', 0.24), ('F#6', 0.36), ('A6', 0.56)]
    layers = [
        Layer(bloom, gain=-4, fx='highpass=f=400'),
        Layer(chirp(hz('A4'), hz('D6'), hit, curve=2.5), gain=-26),
        bell('D3', hit, gain=-2),
        bell('D4', hit, gain=-6),
        Layer(src('impact-sounds', 'impactPlate_heavy_001.ogg'), at=hit, gain=-8, fx='lowpass=f=450'),
        Layer(boom(hz('D2'), 0.8), at=hit, gain=-7),
    ]
    for i, (n, t) in enumerate(fanfare):
        last = i == len(fanfare) - 1
        layers.append(ting(n, hit + t, gain=0 if last else -2, pan=(-0.25 if i % 2 else 0.25)))
        octave_down = n[:-1] + str(int(n[-1]) - 1)
        layers.append(bell_hi(octave_down, hit + t, gain=-9 if last else -13))
    layers += [
        ting('D6', hit + 0.56, gain=-6, pan=-0.5),
        ting('F#6', hit + 0.56, gain=-7, pan=0.5),
        *sparkles(37, hit + 0.6, hit + 2.0, 16, -8, ['D7', 'F#7', 'A7']),
        Layer(shimmer(2.4), at=hit + 0.1, gain=-16),
    ]
    dry = mix(layers, 3.3)
    return reverb(dry, 'hall', -7), 0.8


@recipe('reveal_mythic', 'mp3', -12, glue=True)
def r_reveal_mythic():
    # 1) magical whole-tone pizzicato run + rising chirp + noise swell + reversed bloom (0 - 1.1 s)
    # 2) impact: deep gong (heavy bell resampled down to D2), D3 bell, plate, sub boom (1.1 s)
    # 3) whole-tone glass cascade resolving onto a D-major chord, long sparkle shower, shimmer, cathedral
    hit = 1.1
    bloom_src = mix([ting('D6', 0, -2), ting('E6', 0, -4), ting('F#6', 0, -3), ting('G#6', 0, -5),
                     ting('A#6', 0, -4), ting('D7', 0, -6)], 0.5)
    bloom = process(reverb(bloom_src, 'cathedral', 0, dur=1.6), 'areverse,atrim=start=0.5,asetpts=PTS-STARTPTS')
    whole_tone = ['D6', 'E6', 'F#6', 'G#6', 'A#6', 'C7', 'D7', 'E7']
    layers = [
        pizz(2, 0.25, gain=-6, semitones=2),
        Layer(bloom, gain=-3, fx='highpass=f=300'),
        Layer(chirp(hz('D4'), hz('D6'), hit, curve=2.2), gain=-24),
        Layer(noise(hit, 'pink', 7, 0.4), gain=-26, fx=f'highpass=f=3000,afade=t=in:d={hit:.2f}:curve=exp'),
        bell('D2', hit, gain=0, fx='lowpass=f=1800'),
        bell('D3', hit, gain=-5),
        bell_hi('A4', hit, gain=-10),
        Layer(src('impact-sounds', 'impactPlate_heavy_003.ogg'), at=hit, gain=-8, fx='lowpass=f=400'),
        Layer(boom(hz('D2'), 1.2), at=hit, gain=-5),
    ]
    for i, n in enumerate(whole_tone):
        layers.append(ting(n, hit + 0.08 + 0.07 * i, gain=-3 - 0.4 * i, pan=math.sin(i * 1.4) * 0.6))
    resolve = hit + 0.08 + 0.07 * len(whole_tone) + 0.1
    for n, g, p in [('D6', -2, -0.4), ('F#6', -3, 0.4), ('A6', -3, -0.1), ('D7', -4, 0.2)]:
        layers.append(ting(n, resolve, gain=g, pan=p))
    layers += [
        bell_hi('D4', resolve, gain=-9),
        bell_hi('F#4', resolve + 0.02, gain=-13),
        *sparkles(53, resolve + 0.05, resolve + 1.9, 22, -7, ['D7', 'E7', 'F#7', 'A7', 'D8']),
        Layer(shimmer(2.6), at=hit + 0.05, gain=-14),
    ]
    dry = mix(layers, 4.0)
    return reverb(dry, 'cathedral', -9), 0.9


@recipe('suspense_build', 'mp3', -16)
def r_suspense_build():
    # Rising tension that ends at its peak (the reveal sound takes over): accelerating tremolo drone on D,
    # exponential chirp D4->A5, filtered noise swell, reversed bell bloom. No tail on purpose.
    dur = 1.8
    bell_src = mix([bell('D3', 0, 0), bell_hi('A4', 0, -6)], 0.9)
    bell_rev = process(reverb(bell_src, 'hall', -2, dur=1.6), 'areverse')
    return mix([
        Layer(accel_tremolo_drone(hz('D2'), dur, 3.0, 16.0), gain=-6, fx='lowpass=f=1200'),
        Layer(chirp(hz('D4'), hz('A5'), dur, curve=2.0), gain=-16),
        Layer(chirp(hz('A4') * 1.003, hz('D6') * 1.003, dur, curve=2.6), gain=-20, pan=0.4),
        Layer(noise(dur, 'pink', 3, 0.4), gain=-12,
              fx=f'bandpass=f=4000:width_type=o:w=2,afade=t=in:d={dur:.2f}:curve=exp'),
        Layer(bell_rev, at=dur - 1.6, gain=-4),
    ], dur), 0.015


@recipe('new_card', 'wav', -16, glue=True)
def r_new_card():
    dry = mix([
        Layer(src('casino-audio', 'card-place-2.ogg'), length=0.3, gain=-8, fx='highpass=f=200'),
        ting('A6', 0.0, gain=-1, pan=-0.3),
        ting('D7', 0.07, gain=-2, pan=0.3),
        tink('F#7', 0.14, gain=-8),
    ], 1.0)
    return reverb(dry, 'hall', -14), 0.35


@recipe('mission_complete', 'mp3', -15, glue=True)
def r_mission_complete():
    # Wax-seal stamp (book thud + soft low impact), then the rising pizzicato D-E-F#-G and a chime landing.
    land = 0.5
    dry = mix([
        Layer(src('rpg-audio', 'bookPlace1.ogg'), gain=-2, fx='highpass=f=90,lowpass=f=6000'),
        Layer(src('impact-sounds', 'impactSoft_medium_001.ogg'), gain=-6),
        pizz(10, 0.1, gain=-2),
        ting('D6', land, gain=-2, pan=-0.3),
        ting('A6', land, gain=-4, pan=0.3),
        ting('D7', land + 0.06, gain=-7),
        bell_hi('D4', land, gain=-12),
    ], 1.6)
    return reverb(dry, 'hall', -13), 0.5


@recipe('level_up', 'mp3', -13, glue=True)
def r_level_up():
    land = 0.44
    arp = [ting(n, land + 0.05 * i, gain=-2 - 0.6 * i, pan=-0.45 + 0.18 * i)
           for i, n in enumerate(['D6', 'F#6', 'A6', 'D7', 'F#7', 'A7'])]
    dry = mix([
        pizz(10, 0.0, gain=-1),
        pizz(10, 0.0, gain=-9, semitones=12, pan=0.3),
        bell('D3', land, gain=-4),
        bell_hi('D4', land, gain=-8),
        Layer(boom(hz('D2'), 0.6), at=land, gain=-11),
        *arp,
        *sparkles(71, land + 0.35, land + 1.5, 10, -10, ['D7', 'F#7', 'A7']),
        Layer(shimmer(1.8), at=land + 0.05, gain=-18),
    ], 2.4)
    return reverb(dry, 'hall', -10), 0.6


@recipe('duel_clash', 'wav', -14, glue=True)
def r_duel_clash():
    dry = mix([
        Layer(src('impact-sounds', 'impactMetal_heavy_001.ogg'), gain=-1),
        Layer(src('impact-sounds', 'impactPlate_heavy_001.ogg'), gain=-5, fx='lowpass=f=2500'),
        Layer(src('rpg-audio', 'drawKnife3.ogg'), at=0.01, gain=8, fx='highpass=f=1500'),
        Layer(boom(hz('D2'), 0.5), gain=-6),
        bell_hi('D5', 0.0, gain=-16, fx='highpass=f=600'),
    ], 0.9)
    return reverb(dry, 'room', -9), 0.3


@recipe('duel_win', 'mp3', -13, glue=True)
def r_duel_win():
    land = 0.5
    dry = mix([
        pizz(10, 0.0, gain=-1),
        pizz(16, land - 0.04, gain=-4, semitones=-1, length=0.4, fade_out=0.15),
        bell('D3', land, gain=-5),
        Layer(boom(hz('D2'), 0.6), at=land, gain=-12),
        ting('D6', land, gain=-2, pan=-0.4),
        ting('F#6', land + 0.05, gain=-3, pan=0.4),
        ting('A6', land + 0.10, gain=-3, pan=-0.2),
        ting('D7', land + 0.15, gain=-4, pan=0.2),
        *sparkles(83, land + 0.3, land + 1.3, 9, -10, ['D7', 'F#7', 'A7']),
        Layer(shimmer(1.6), at=land + 0.1, gain=-19),
    ], 2.2)
    return reverb(dry, 'hall', -10), 0.6


@recipe('duel_lose', 'mp3', -18)
def r_duel_lose():
    # Gentle: descending chromatic pizzicato (F E D# D), darkened, ending on a soft low D bell.
    dry = mix([
        pizz(7, 0.0, gain=0, fx='lowpass=f=2600'),
        bell('D3', 0.66, gain=-11, fx='lowpass=f=1000'),
        bell('A2', 0.66, gain=-17, fx='lowpass=f=700'),
    ], 1.9)
    return reverb(dry, 'hall', -14), 0.6


# ---------------------------------------------------------------- licences


def used_sources(fn):
    """Collects the Kenney files a recipe reads (via a dry trace of the Layer objects it builds)."""
    seen: list[Src] = []
    synth = False
    orig_mix = globals()['mix']

    def spy(layers, dur, post=''):
        nonlocal synth
        for l in layers:
            if isinstance(l.source, Src) and l.source not in seen:
                seen.append(l.source)
            if isinstance(l.source, str):
                synth = True
        return orig_mix(layers, dur, post)

    globals()['mix'] = spy
    try:
        result = fn()
    finally:
        globals()['mix'] = orig_mix
    return seen, synth, result


def write_licenses(outputs: list[Output]) -> None:
    lines = [
        '# Sound effects — sources and licences',
        '',
        'Generated by `scripts/sounds/build.py` (do not edit the audio by hand; change the recipe and rebuild).',
        '',
        'Every sample comes from the audio packs by **Kenney (www.kenney.nl)**, released under',
        '**Creative Commons Zero (CC0 1.0)** — <http://creativecommons.org/publicdomain/zero/1.0/>.',
        'CC0 allows commercial use, modification and redistribution without attribution; we credit',
        'Kenney anyway. Each pack ships a `License.txt` stating "License (Creative Commons Zero, CC0)",',
        'which the build script checks before rendering.',
        '',
        'Synthesized layers (reverb impulse responses, shimmer pads, chirps, noise swells, sub booms) are',
        'generated from ffmpeg filter expressions by the build script and contain no third-party material.',
        '',
        '## Packs',
        '',
        '| Pack | Archive | SHA-256 | Licence |',
        '| --- | --- | --- | --- |',
    ]
    for name, (url, sha, title) in PACKS.items():
        lines.append(f'| Kenney — {title} | <{url}> | `{sha[:16]}…` | CC0 1.0 |')
    lines += ['', '## Files', '', '| Output | Duration | Size | Sources (pack / file) | Licence |',
              '| --- | --- | --- | --- | --- |']
    for o in outputs:
        srcs = '<br>'.join(f'{PACKS[s.pack][2]} / `{s.file.split("/")[-1]}`' for s in o.sources)
        if o.synth:
            srcs += '<br>+ synthesized layers (build script)'
        lines.append(f'| `{o.name}.{o.fmt}` | {o.duration:.2f} s | {o.size / 1024:.0f} KB | {srcs} | CC0 1.0 |')
    lines.append('')
    (OUT / 'LICENSES.md').write_text('\n'.join(lines))


# ---------------------------------------------------------------- main


def main() -> None:
    global TMP
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated list of sounds to rebuild')
    ap.add_argument('--keep-temp', action='store_true')
    args = ap.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        sys.exit('ffmpeg and ffprobe are required')
    fetch_packs()
    OUT.mkdir(parents=True, exist_ok=True)
    TMP = Path(tempfile.mkdtemp(prefix='mandat-sounds-'))  # honours $TMPDIR
    only = set(args.only.split(',')) if args.only else None
    outputs = []
    try:
        for name, (fn, spec) in RECIPES.items():
            if only and name not in only:
                continue
            spec.sources, spec.synth, (path, fade) = used_sources(fn)
            for stale in OUT.glob(f'{name}.*'):
                stale.unlink()
            finish(spec, path, fade_out=fade)
            outputs.append(spec)
            m, tp = spec.measured
            print(f'{spec.name + "." + spec.fmt:24s} {spec.duration:5.2f}s {spec.size / 1024:6.1f} KB  '
                  f'M-max {m:6.1f} LUFS  peak {tp:5.1f} dBFS')
    finally:
        if not args.keep_temp:
            shutil.rmtree(TMP, ignore_errors=True)
        else:
            print(f'temp files kept in {TMP}')
    if not only:
        write_licenses(outputs)
    total = sum(o.size for o in outputs)
    print(f'total {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
