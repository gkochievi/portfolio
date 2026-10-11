# Sinji media scripts

Calls play on a silent clock until real audio exists. These two scripts turn generated speech into the files and the manifest the demo already reads (`src/demo/seed/media.ts`). Nothing else in the demo changes.

**Needs macOS** (the built-in `afconvert` and `afinfo`; there is no ffmpeg fallback), Node 20 or newer, and the repo's installed `node_modules` (esbuild comes with Vite). No new dependency. Run everything from the repo root.

## The three steps

**1. Export the text to speak**

```
node demos/sinji/scripts/media/export-dialogues.mjs ~/sinji-text
```

Writes `calls/<call_id>.json` (one multi-voice dialogue per call: `turns: [{ i, speaker: agent|customer, text }]`), `clips/<clip_id>.json` (one voice, one text) and `voices.json` (the voice list with a suggested preview sentence each), and prints the size of the job (at the time of writing: 7 calls, 189 turns, 10,798 characters; 6 clips, 460; 8 previews, 675; 11,933 in all). The text is read from the seed, so it is exactly what the transcript shows. Keep each turn's `i`: it is the segment index the demo's claims and scores point at.

**2. Generate the audio elsewhere** (a text-to-speech service)

Per call, one file with every turn in order, agent and customer in different voices, and a clear pause at each change of speaker. Per clip, one file in the clip's `voice_id`. Per voice, a short preview. Put them in one folder, named by id:

```
<audio-dir>/calls/cc_mtb_01.mp3       any of mp3 wav m4a ogg aac aif aiff caf flac
<audio-dir>/clips/clip_01.mp3
<audio-dir>/voices/vo_ka_1.mp3        the voice's preview
```

One file per id; not every id is needed (missing ones stay silent in the demo). Ids that are not in the seed are ignored with a warning. `ogg` only works if macOS can decode that file; if the report says it cannot, convert it to wav or mp3 first.

**3. Build**

```
node demos/sinji/scripts/media/build-media.mjs <audio-dir>
```

Writes compact mono AAC `.m4a` files and the manifest, then prints one line per file (duration, sizes, how the turns were timed), the total size, and any warnings:

| Output | |
|---|---|
| `public/media/calls/<call_id>.m4a` | 48 kbps |
| `public/media/tts/<clip_id>.m4a` | 32 kbps |
| `public/media/tts/<voice_id>-preview.m4a` | 32 kbps |
| `src/demo/seed/media-manifest.json` | audio URLs, durations, 600 waveform peaks per call, measured `segments` per call |

Commit those files. It is safe to run again: the same input gives byte-identical files and manifest.

## How the turns are timed

The transcript's turn boundaries are matched to the silences between turns (short-time energy, the N-1 gaps that best fit, using the transcript's length as a guide). The report says `silence gaps, high` when the turn gaps clearly stand out from the pauses inside turns, and `medium` (with a warning to spot-check) when they barely do.

If the gaps cannot be matched (fewer silences than turns, or the audio has different turns than the transcript, or pauses inside turns are as long as the pauses between them) the call falls back to **estimated** timings from character counts, and the script says so loudly (`ESTIMATED`, and a red line at the end). Fix it by regenerating that call with a clearer pause between speakers, or by supplying the times: put `calls/<call_id>.timing.json` next to the audio, a list `[{ "i": 0, "start": 0.5, "end": 4.2 }, ...]` with one entry per turn, in seconds (for example mapped from the speech service's per-turn timestamps). It is validated and used instead of detection.

## Options

| | |
|---|---|
| `--out <dir>` | Write `public/media/` and `src/demo/seed/media-manifest.json` under `<dir>` instead of the demo. For trying it out; the repo is untouched. |
| `--merge` | Keep manifest entries of ids that are not in this input (if their `.m4a` is still there). Without it, the manifest describes exactly the input you gave. |

It refuses to run if the input folder is missing or holds no audio. The media is warned about above 12 MB in total, because it ships with every deploy.
