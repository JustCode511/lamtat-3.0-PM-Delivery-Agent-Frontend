// Turns a CSS color (var(--x) or a literal) into a translucent version of
// itself, theme-aware since it's computed from the color, not a fixed hex.
// Replaces the old "hexColor + '40'" alpha-suffix trick, which breaks once
// colors come from CSS variables instead of literal hex strings.
export function alpha(color, percent) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
