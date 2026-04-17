export function generateStrokeId(): string {
  return Math.random().toString(36).substring(2, 9);
}
