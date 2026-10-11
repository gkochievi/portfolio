/**
 * Reads the Sinji seed (the same TypeScript the demo ships) from a plain Node
 * script: esbuild bundles `src/demo/seed/index.ts` into a temp file, which is
 * imported and then deleted. Nothing is written into the repo.
 *
 * `import.meta.glob` (a Vite feature used by seed/media.ts to find the optional
 * media manifest) is stubbed to an empty result, so the exported text never
 * depends on whether a manifest happens to exist.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** demos/sinji */
export const SINJI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

async function loadEsbuild() {
  try {
    return await import('esbuild')
  } catch {
    throw new Error(
      'esbuild is not installed. It comes with Vite: run `npm install` once at the repo root (no new dependency is needed).',
    )
  }
}

export async function loadSeed() {
  const { build } = await loadEsbuild()
  const dir = mkdtempSync(path.join(tmpdir(), 'sinji-seed-'))
  const outfile = path.join(dir, 'seed.mjs')
  try {
    await build({
      entryPoints: [path.join(SINJI_ROOT, 'src/demo/seed/index.ts')],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      jsx: 'automatic',
      tsconfig: path.join(SINJI_ROOT, 'tsconfig.json'),
      absWorkingDir: SINJI_ROOT,
      define: { 'import.meta.glob': '__noGlob' },
      banner: { js: 'const __noGlob = () => ({});' },
      logLevel: 'silent',
    })
    const mod = await import(pathToFileURL(outfile).href)
    if (!mod.seed) throw new Error('src/demo/seed/index.ts no longer exports `seed`')
    return mod.seed
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * What the media step needs from the seed.
 * A call "has audio" when its segments are timed (the seed's `timed: true`),
 * the same test recordings.ts uses.
 */
export function describeSeed(seed) {
  const calls = seed.cannedCalls
    .filter((call) => call.segments.some((s) => s.start !== null))
    .map((call) => ({
      id: call.id,
      language: call.language,
      turns: call.segments.map((s) => ({
        i: s.i,
        speaker: s.speaker === 'speaker_0' ? 'agent' : 'customer',
        text: s.text,
      })),
    }))
  const clips = seed.ttsClips.map((clip) => ({
    id: clip.id,
    voice_id: clip.voice_id,
    language: clip.language_code,
    text: clip.text,
  }))
  const voices = seed.voices.map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    language: v.language,
    gender: v.gender,
    category: v.category,
    is_default: v.is_default,
  }))
  return { calls, clips, voices }
}
