export type IconName =
  | "overview" | "tasks" | "projects" | "review" | "activity" | "canvas" | "automation"
  | "git" | "integrations" | "people" | "appearance" | "search" | "plus" | "chevron"
  | "command" | "settings" | "close" | "spark" | "theme" | "logout" | "arrow"
  | "grid" | "list" | "flow" | "plug" | "users" | "bell" | "check" | "branch"
  | "play" | "history" | "shield" | "filter" | "code" | "palette";

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (name) {
    case "overview":
    case "grid":
      return <svg {...common}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></svg>;
    case "tasks":
    case "list":
      return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case "projects":
    case "canvas":
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 14h7"/></svg>;
    case "review":
      return <svg {...common}><path d="M4 5h16v12H8l-4 3V5Z"/><path d="m9 11 2 2 4-4"/></svg>;
    case "activity":
      return <svg {...common}><path d="M4 12h3l2-6 4 12 2-6h5"/></svg>;
    case "automation":
    case "flow":
      return <svg {...common}><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 11 10-5M7 13l10 5"/></svg>;
    case "git":
    case "code":
    case "command":
      return <svg {...common}><path d="M8 5 3 12l5 7M16 5l5 7-5 7M14 4l-4 16"/></svg>;
    case "integrations":
    case "plug":
      return <svg {...common}><path d="M8 12a4 4 0 0 1 4-4h2a4 4 0 0 1 0 8h-2M16 12a4 4 0 0 1-4 4H10a4 4 0 0 1 0-8h2"/></svg>;
    case "people":
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M17 15c2.4.4 4 2 4 4"/></svg>;
    case "appearance":
    case "theme":
    case "palette":
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.6 4.6 6 6M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "chevron":
      return <svg {...common}><path d="m7 10 5 5 5-5"/></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.8v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5.7v-2.8h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L7 8.2l2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.8v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>;
    case "logout":
      return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case "branch":
      return <svg {...common}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 6h8M12 8v8"/></svg>;
    case "play":
      return <svg {...common}><path d="m9 5 10 7-10 7V5Z"/></svg>;
    case "history":
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/></svg>;
    case "filter":
      return <svg {...common}><path d="M4 6h16M7 12h10m-7 6h4"/></svg>;
    default:
      return null;
  }
}
