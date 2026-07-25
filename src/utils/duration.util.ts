const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a duration string like '30s', '15m', '2h' or '7d' into milliseconds.
 * A unit suffix is required: a bare number like '60' is rejected because it is
 * ambiguous (seconds? minutes?) and has silently meant different things across
 * config options in the past.
 */
export function parseDuration(value: string, optionName: string): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(value?.trim() ?? '');
  if (!match) {
    throw new Error(
      `[KcAuthModule] Invalid duration "${value}" for "${optionName}". ` +
        `Use a number followed by a unit (s, m, h, d), e.g. '15m' or '7d'.`,
    );
  }
  return Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
}
