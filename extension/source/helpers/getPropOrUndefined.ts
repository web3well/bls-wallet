export default function getPropOrUndefined(
  value: unknown,
  prop: string | symbol,
): unknown {
  try {
    return (value as Record<string | symbol, unknown>)[prop];
  } catch {
    return undefined;
  }
}
