export function clx(...args: (string | undefined)[]) {
  return args.filter(Boolean).join(" ");
}
