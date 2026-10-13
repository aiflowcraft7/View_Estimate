const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z",
  roof: "M2 12 12 4l10 8M5 10v10h14V10M9 20v-5h6v5",
  driveway: "M7 21 10 3h4l3 18M12 7v2m0 4v2m0 4v1",
  patio: "M3 7h18M3 12h18M3 17h18M8 3v18M16 3v18",
  window: "M4 4h16v16H4zM12 4v16M4 12h16",
  gutter: "M3 6h18v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm15 6v8",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  fence: "M4 21V7l2-3 2 3v14M10 21V7l2-3 2 3v14M16 21V7l2-3 2 3v14M2 11h20M2 17h20",
  deck: "M3 9h18v4H3zM5 13v8M19 13v8M3 5h18",
  default: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-1 13 6-6-1.4-1.4L11 13.2l-2.6-2.6L7 12l4 4Z",
};

export const ICON_OPTIONS = Object.keys(paths).filter((k) => k !== "default");

export function ServiceIcon({ name, className = "h-6 w-6" }: { name?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name ?? "default"] ?? paths.default} />
    </svg>
  );
}
