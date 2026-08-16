export function processData(input) {
  try {
    return JSON.parse(input);
  } catch {
    // Silently ignore parse errors
  }
}
