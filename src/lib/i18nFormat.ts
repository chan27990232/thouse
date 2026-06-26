export function formatMessage(message: string, vars?: Record<string, string | number>): string {
  if (!vars) return message;
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    message,
  );
}
