// Small moments of delight: which plan stages have just been finished, and a light haptic tap. Pure + tiny.

/** Stage ids where every task is done (stages with no tasks don't count). */
export function completeStages(tasks: { stage: string; done: boolean }[]): Set<string> {
  const total = new Map<string, number>()
  const done = new Map<string, number>()
  for (const t of tasks) {
    total.set(t.stage, (total.get(t.stage) ?? 0) + 1)
    if (t.done) done.set(t.stage, (done.get(t.stage) ?? 0) + 1)
  }
  return new Set([...total].filter(([s, n]) => n > 0 && done.get(s) === n).map(([s]) => s))
}

/** Stages complete now that weren't before. */
export function newlyComplete(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter((s) => !before.has(s))
}

/** A short vibration where supported (Android); silently nothing elsewhere or with reduced motion. */
export function haptic(ms = 10): void {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    navigator.vibrate?.(ms)
  } catch {
    /* not supported */
  }
}
