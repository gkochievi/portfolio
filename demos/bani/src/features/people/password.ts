/** Client-side 16-character password generator (no look-alike characters). */
const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '#$%&*+-=?@']

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return (buf[0] ?? 0) % max
}

export function generatePassword(length = 16): string {
  const all = SETS.join('')
  const chars = SETS.map((set) => set.charAt(randomInt(set.length)))
  while (chars.length < length) chars.push(all.charAt(randomInt(all.length)))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j] as string, chars[i] as string]
  }
  return chars.join('')
}
