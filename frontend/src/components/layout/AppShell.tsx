import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getToken, useAuth } from "../../hooks/useAuth";
import { THEME_PRESETS, isHexColor, useTheme } from "../../theme/ThemeProvider";
import type { Project, Task } from "../../types";
import { Icon, type IconName } from "./Icon";
import ProjectSwitcher from "../projects/ProjectSwitcher";

interface NavigationItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: string;
  future?: boolean;
}

const workspaceItems: NavigationItem[] = [
  { to: "/dashboard", label: "Overview", icon: "overview" },
  { to: "/projects?scope=mine", label: "My work", icon: "tasks" },
  { to: "/projects", label: "Projects", icon: "projects" },
];

const controlItems: NavigationItem[] = [
  { to: "/review", label: "Review queue", icon: "review" },
  { to: "/dashboard#activity", label: "Activity", icon: "activity" },
];

const toolItems: NavigationItem[] = [
  { to: "/canvases", label: "Project Canvas", icon: "canvas" },
  { to: "/automation", label: "Automation Studio", icon: "automation", future: true },
  { to: "/git-commits", label: "Git activity", icon: "git" },
  { to: "/connectors", label: "Integrations", icon: "integrations" },
];

const manageItems: NavigationItem[] = [
  { to: "/users", label: "People & access", icon: "people" },
  { to: "/appearance", label: "Appearance", icon: "appearance" },
  { to: "/import-export", label: "Import & export", icon: "settings" },
];

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavigationItem[];
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const scope = new URLSearchParams(location.search).get("scope");

  const isCurrent = (item: NavigationItem) => {
    if (item.to.includes("#")) {
      return location.pathname === "/dashboard" && location.hash === "#activity";
    }

    if (item.to === "/projects?scope=mine") {
      return location.pathname === "/projects" && scope === "mine";
    }

    if (item.to === "/projects") {
      return location.pathname === "/projects" && scope !== "mine";
    }

    if (item.to === "/canvases") {
      return location.pathname.startsWith("/canvas");
    }

    return location.pathname === item.to;
  };

  return (
    <div className="pm-nav-group">
      <div className="pm-nav-label">{label}</div>

      {items.map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          onClick={onNavigate}
          className={`pm-nav-link${isCurrent(item) ? " is-active" : ""}`}
        >
          <Icon name={item.icon} size={15} />
          <span>{item.label}</span>

          {item.future ? (
            <span className="pm-future-tag">Preview</span>
          ) : null}

          {item.badge ? (
            <span className="pm-nav-badge">{item.badge}</span>
          ) : null}
        </NavLink>
      ))}
    </div>
  );
}

function ThemeMenu({ onClose }: { onClose: () => void }) {
  const {
    theme,
    accent,
    hasCustomAccent,
    setTheme,
    setCustomAccent,
    resetAccent,
    resetTheme,
  } = useTheme();

  const [input, setInput] = useState(accent);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setInput(accent);
    setInvalid(false);
  }, [accent]);

  const applyInput = () => {
    if (setCustomAccent(input)) {
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div
      className="pm-popover-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="pm-theme-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Appearance settings"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pm-menu-header">
          <div>
            <div className="pm-menu-kicker">
              APPEARANCE · GLASS ENGINE
            </div>

            <h2>Theme & crystal accent</h2>
          </div>

          <button
            className="pm-icon-button"
            onClick={onClose}
            aria-label="Close appearance settings"
          >
            <Icon name="close" />
          </button>
        </header>

        <p className="pm-menu-copy">
          Obsidian Signal is the default: graphite-black glass with
          crystal-bright-blue emphasis. Pick a preset or enter any hex code.
        </p>

        <div className="pm-theme-preset-list">
          {THEME_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={`pm-theme-preset${
                theme === preset.id && !hasCustomAccent
                  ? " is-selected"
                  : ""
              }`}
              onClick={() => setTheme(preset.id)}
            >
              <span
                className="pm-theme-preview"
                style={{
                  "--preview-accent": preset.accent,
                } as CSSProperties}
              >
                <i />
                <i />
                <i />
              </span>

              <span>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </span>

              {theme === preset.id && !hasCustomAccent ? (
                <Icon name="spark" size={13} />
              ) : null}
            </button>
          ))}
        </div>

        <div className="pm-custom-color">
          <div className="pm-custom-color-head">
            <div>
              <strong>Custom color picker & hex code</strong>
              <small>
                Enter a 6-digit hex color or use the visual picker.
              </small>
            </div>

            {hasCustomAccent ? (
              <button
                type="button"
                className="pm-text-button"
                onClick={resetAccent}
              >
                Restore preset
              </button>
            ) : (
              <button
                type="button"
                className="pm-text-button"
                onClick={resetTheme}
              >
                Default
              </button>
            )}
          </div>

          <div className="pm-color-input-row">
            <input
              aria-label="Pick an accent color"
              type="color"
              value={accent}
              onChange={(event) => {
                setInput(event.target.value.toUpperCase());
                setCustomAccent(event.target.value);
              }}
            />

            <input
              aria-label="Custom accent hexadecimal value"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setInvalid(false);
              }}
              onBlur={applyInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyInput();
              }}
              placeholder="#54C8FF"
              spellCheck="false"
            />

            <button
              type="button"
              className="pm-compact-button"
              onClick={applyInput}
            >
              Apply
            </button>
          </div>

          <div className={`pm-color-feedback${invalid ? " is-error" : ""}`}>
            {invalid
              ? "Use a valid #RRGGBB color code."
              : isHexColor(input)
                ? `Active accent: ${accent}`
                : "Enter a 6-digit color code (e.g. #54C8FF)."}
          </div>
        </div>
      </section>
    </div>
  );
}

interface CommandEntry {
  id: string;
  group: "Actions" | "Projects" | "Tasks";
  title: string;
  subtitle?: string;
  hint: string;
  icon: IconName;
  run: () => void;
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const tasksQuery = useQuery<Task[]>({
    queryKey: ["workspace-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        tasks?: Task[];
      };

      return data.tasks ?? [];
    },
  });

  const projectsQuery = useQuery<Project[]>({
    queryKey: ["workspace-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        projects?: Project[];
      };

      return data.projects ?? [];
    },
  });

  const entries = useMemo<CommandEntry[]>(() => {
    const baseActions: CommandEntry[] = [
      {
        id: "act-new-task",
        group: "Actions",
        title: "Create task",
        subtitle: "Fast task capture",
        hint: "C",
        icon: "plus",
        run: () => navigate("/projects?create=task"),
      },
      {
        id: "act-overview",
        group: "Actions",
        title: "Open overview",
        subtitle: "Focus queue & workspace pulse",
        hint: "G O",
        icon: "overview",
        run: () => navigate("/dashboard"),
      },
      {
        id: "act-my-work",
        group: "Actions",
        title: "Open my work",
        subtitle: "Tasks assigned to you",
        hint: "G M",
        icon: "tasks",
        run: () => navigate("/projects?scope=mine"),
      },
      {
        id: "act-projects",
        group: "Actions",
        title: "Open projects & tasks",
        subtitle: "All work lenses",
        hint: "G P",
        icon: "projects",
        run: () => navigate("/projects"),
      },
      {
        id: "act-review",
        group: "Actions",
        title: "Open review queue",
        subtitle: "Blocked & overdue attention",
        hint: "G R",
        icon: "review",
        run: () => navigate("/review"),
      },
      {
        id: "act-canvas",
        group: "Actions",
        title: "Open Project Canvas",
        subtitle: "Visual planning & task links",
        hint: "G C",
        icon: "canvas",
        run: () => navigate("/canvases"),
      },
      {
        id: "act-automation",
        group: "Actions",
        title: "Open Automation Studio",
        subtitle: "Node workflow studio preview",
        hint: "G W",
        icon: "automation",
        run: () => navigate("/automation"),
      },
      {
        id: "act-appearance",
        group: "Actions",
        title: "Customize theme & hex accent",
        subtitle: "Obsidian Signal glass settings",
        hint: "G A",
        icon: "appearance",
        run: () => navigate("/appearance"),
      },
    ];

    const projectEntries: CommandEntry[] = (
      projectsQuery.data ?? []
    ).slice(0, 6).map((project) => ({
      id: `proj-${project.project_id}`,
      group: "Projects",
      title: project.name,
      subtitle: project.description || project.status,
      hint: "Project",
      icon: "projects",
      run: () =>
        navigate(
          `/projects?project=${encodeURIComponent(project.project_id)}`
        ),
    }));

    const taskEntries: CommandEntry[] = (
      tasksQuery.data ?? []
    ).slice(0, 8).map((task) => ({
      id: `task-${task.task_id}`,
      group: "Tasks",
      title: task.title,
      subtitle: `${task.status.replace("_", " ")} · ${task.priority} priority`,
      hint: "Task",
      icon: "tasks",
      run: () =>
        navigate(`/projects?task=${encodeURIComponent(task.task_id)}`),
    }));

    const all = [...baseActions, ...projectEntries, ...taskEntries];
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) return all.slice(0, 10);

    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(trimmed) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(trimmed)) ||
        item.group.toLowerCase().includes(trimmed)
    );
  }, [navigate, projectsQuery.data, query, tasksQuery.data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <div
      className="pm-command-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="pm-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pm-command-input">
          <Icon name="search" size={17} />

          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  entries.length
                    ? (current + 1) % entries.length
                    : 0
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) =>
                  entries.length
                    ? (current - 1 + entries.length) % entries.length
                    : 0
                );
              } else if (event.key === "Enter" && entries[activeIndex]) {
                event.preventDefault();
                entries[activeIndex].run();
                onClose();
              }
            }}
            placeholder="Search tasks, projects, or run a command…"
            aria-label="Search commands"
          />

          <kbd>Esc</kbd>
        </div>

        <div className="pm-command-label">
          {query.trim()
            ? `Matches (${entries.length})`
            : "Quick actions & recent work"}
        </div>

        {entries.length ? (
          entries.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className="pm-command-item"
              style={
                index === activeIndex
                  ? {
                      background: "var(--pm-accent-soft)",
                      color: "var(--pm-text)",
                    }
                  : undefined
              }
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                item.run();
                onClose();
              }}
            >
              <span className="pm-command-icon">
                <Icon name={item.icon} size={15} />
              </span>

              <span>
                <strong
                  style={{
                    display: "block",
                    fontWeight: 590,
                  }}
                >
                  {item.title}
                </strong>

                {item.subtitle ? (
                  <small
                    style={{
                      color: "var(--pm-text-muted)",
                      fontSize: "7.5px",
                    }}
                  >
                    {item.subtitle}
                  </small>
                ) : null}
              </span>

              <kbd>{item.hint}</kbd>
            </button>
          ))
        ) : (
          <div className="pm-empty-state">
            <strong>No matching commands or tasks</strong>
            <p>Try another keyword or press Esc.</p>
          </div>
        )}

        <div className="pm-command-footer">
          <span>↑ ↓ to navigate</span>
          <span>Enter to execute</span>
          <span>Esc to close</span>
        </div>
      </section>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { presetName, accent } = useTheme();
  const navigate = useNavigate();

  const [themeOpen, setThemeOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPaletteOpen(true);
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
        setThemeOpen(false);
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <div className="pm-app-shell">
      <aside
        className={`pm-sidebar${mobileNavOpen ? " is-mobile-open" : ""}`}
      >
        <div className="pm-brand">
          <span className="pm-brand-mark">P</span>
          <span>Project Manager</span>

          <button
            type="button"
            className="pm-icon-button pm-mobile-nav-toggle"
            aria-label="Toggle navigation menu"
            onClick={() =>
              setMobileNavOpen((current) => !current)
            }
          >
            <Icon
              name={mobileNavOpen ? "close" : "list"}
              size={15}
            />
          </button>
        </div>

        {/* Functional project switcher */}
        <ProjectSwitcher />

        <NavGroup
          label="Workspace"
          items={workspaceItems}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <NavGroup
          label="Control"
          items={controlItems}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <NavGroup
          label="Tools"
          items={toolItems}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <NavGroup
          label="Manage"
          items={manageItems}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <div className="pm-user-menu">
          <span className="pm-user-avatar">
            {user?.username.slice(0, 2).toUpperCase() || "PM"}
          </span>

          <span>
            <strong>{user?.username || "Workspace user"}</strong>
            <small>{user?.role || "Member"}</small>
          </span>

          <button
            type="button"
            className="pm-icon-button pm-user-logout"
            aria-label="Sign out"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
      </aside>

      <section className="pm-main-column">
        <header className="pm-topbar">
          <button
            type="button"
            className="pm-command-trigger"
            onClick={() => setPaletteOpen(true)}
          >
            <Icon name="search" size={15} />
            <span>Search tasks, projects, or commands</span>
            <kbd className="pm-keycap">Ctrl K</kbd>
          </button>

          <div className="pm-topbar-actions">
            <button
              type="button"
              className="pm-theme-menu-trigger"
              onClick={() => setThemeOpen(true)}
            >
              <i
                className="pm-theme-dot"
                style={{ backgroundColor: accent }}
              />

              <span>{presetName}</span>

              <Icon name="chevron" size={13} />
            </button>

            <button
              type="button"
              className="pm-primary-button"
              onClick={() => navigate("/projects?create=task")}
            >
              <Icon name="plus" size={14} />
              <span>New task</span>
            </button>
          </div>
        </header>

        <main className="pm-workspace">
          <Outlet />
        </main>
      </section>

      {themeOpen ? (
        <ThemeMenu onClose={() => setThemeOpen(false)} />
      ) : null}

      {paletteOpen ? (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      ) : null}
    </div>
  );
}
