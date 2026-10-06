/** Brand mark: a graduation cap over an open hand-shaped base. Also used for the favicon (src/app/icon.svg). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#b4561d" />
      <path d="M32 14 8 26l24 12 18-9v12h4V26z" fill="#fff" />
      <path d="M18 34v9c0 4 6.5 7 14 7s14-3 14-7v-9l-14 7z" fill="#5fd3c2" />
    </svg>
  );
}
