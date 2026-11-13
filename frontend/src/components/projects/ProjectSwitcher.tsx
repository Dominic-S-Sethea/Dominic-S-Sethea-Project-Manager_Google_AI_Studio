import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "../../hooks/useAuth";
import type { Project } from "../../types";
import { Icon } from "../layout/Icon";

interface ProjectMenuEntry {
  id: string;
  kind: "project" | "new-project" | "manage-projects";
  project?: Project;
}

const SELECTED_PROJECT_KEY = "pm-selected-project";

export default function ProjectSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();

  const triggerId = useId();
  const menuId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpenRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reuse the existing project query used by CommandPalette.
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

  const projects = projectsQuery.data ?? [];

  const selectedProject = projects.find(
    (project) => project.project_id === selectedProjectId
  );

  const entries: ProjectMenuEntry[] = [
    ...projects.map((project): ProjectMenuEntry => ({
      id: project.project_id,
      kind: "project",
      project,
    })),
    {
      id: "new-project",
      kind: "new-project",
    },
    {
      id: "manage-projects",
      kind: "manage-projects",
    },
  ];

  // Restore the persisted project selection when the component mounts.
  useEffect(() => {
    const savedProjectId = window.localStorage.getItem(SELECTED_PROJECT_KEY);

    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
    }
  }, []);

  // Synchronize the selected project with the URL.
  // An explicitly selected valid URL project takes precedence over localStorage.
  // Otherwise, restore the saved project without removing other query parameters.
  useEffect(() => {
    if (!projectsQuery.data || location.pathname !== "/projects") {
      return;
    }

    const params = new URLSearchParams(location.search);
    const urlProjectId = params.get("project");

    if (urlProjectId) {
      const urlProject = projects.find(
        (project) => project.project_id === urlProjectId
      );

      if (urlProject) {
        window.localStorage.setItem(SELECTED_PROJECT_KEY, urlProjectId);
        setSelectedProjectId(urlProjectId);
        return;
      }
    }

    const savedProjectId = window.localStorage.getItem(SELECTED_PROJECT_KEY);

    if (!savedProjectId) return;

    const savedProject = projects.find(
      (project) => project.project_id === savedProjectId
    );

    if (!savedProject) return;

    setSelectedProjectId(savedProjectId);

    if (urlProjectId !== savedProjectId) {
      params.set("project", savedProjectId);

      navigate(
        {
          pathname: "/projects",
          search: `?${params.toString()}`,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [
    projectsQuery.data,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  // Return keyboard focus to the trigger whenever the dropdown closes.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Focus the selected project when the dropdown opens.
  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = entries.findIndex(
      (entry) =>
        entry.kind === "project" && entry.id === selectedProjectId
    );

    const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;

    setActiveIndex(initialIndex);
    itemRefs.current[initialIndex]?.focus();
  }, [isOpen, projects.length, selectedProjectId]);

  const closeMenu = () => {
    setIsOpen(false);
  };

  const focusEntry = (index: number) => {
    if (!entries.length) return;

    const nextIndex = (index + entries.length) % entries.length;

    setActiveIndex(nextIndex);
    itemRefs.current[nextIndex]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusEntry(activeIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusEntry(activeIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusEntry(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusEntry(entries.length - 1);
    }
  };

  const selectProject = (project: Project) => {
    window.localStorage.setItem(
      SELECTED_PROJECT_KEY,
      project.project_id
    );

    setSelectedProjectId(project.project_id);
    closeMenu();

    // Preserve existing query parameters such as create=task and scope=mine.
    const params = new URLSearchParams(location.search);
    params.set("project", project.project_id);

    navigate({
      pathname: "/projects",
      search: `?${params.toString()}`,
      hash: location.pathname === "/projects" ? location.hash : "",
    });
  };

  const openNewProject = () => {
    closeMenu();
    navigate("/projects?create=project");
  };

  const openProjectManagement = () => {
    closeMenu();
    navigate("/projects");
  };

  const entryButtonStyle = (
    index: number,
    isPrimary = false
  ): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    padding: "10px 11px",
    border: `1px solid ${
      index === activeIndex || isPrimary
        ? "var(--pm-accent)"
        : "var(--pm-border)"
    }`,
    borderRadius: "var(--pm-radius-sm)",
    background:
      index === activeIndex
        ? "var(--pm-accent-soft)"
        : isPrimary
          ? "var(--pm-accent)"
          : "var(--pm-glass)",
    color: isPrimary
      ? "var(--pm-accent-ink)"
      : "var(--pm-text)",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
    outline: "none",
  });

  return (
    <div
      className="pm-project-switcher"
      style={{
        position: "relative",
        width: "100%",
        zIndex: isOpen ? 81 : undefined,
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="pm-workspace-switcher"
        style={{
          width: "100%",
          textAlign: "left",
          font: "inherit",
          color: "var(--pm-text)",
          cursor: "pointer",
        }}
        aria-label={
          selectedProject
            ? `Choose project. Current project: ${selectedProject.name}`
            : "Choose project"
        }
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="pm-workspace-glyph">PM</span>

        <span>
          <small>Project</small>
          <strong>
            {selectedProject?.name ?? "Select project"}
          </strong>
        </span>

        <Icon name="chevron" size={14} />
      </button>

      {isOpen ? (
        <>
          <div
            className="pm-popover-backdrop"
            role="presentation"
            onMouseDown={closeMenu}
          />

          <div
            id={menuId}
            className="pm-project-switcher-menu"
            role="menu"
            aria-labelledby={triggerId}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 82,
              width: "min(320px, calc(100vw - 32px))",
              maxHeight: "min(70vh, 520px)",
              overflowY: "auto",
              boxSizing: "border-box",
              padding: "11px",
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-lg)",
              background: "var(--pm-glass-strong)",
              backdropFilter: "blur(22px) saturate(142%)",
              boxShadow: "var(--pm-shadow-float)",
              color: "var(--pm-text)",
            }}
          >
            <div
              style={{
                padding: "5px 5px 12px",
              }}
            >
              <div
                style={{
                  color: "var(--pm-accent)",
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                }}
              >
                PROJECT WORKSPACE
              </div>

              <div
                style={{
                  marginTop: "5px",
                  color: "var(--pm-text-secondary)",
                  fontSize: "11px",
                }}
              >
                Select a project to view its workspace.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "5px",
              }}
            >
              {projectsQuery.isLoading ? (
                <div
                  style={{
                    padding: "12px 10px",
                    color: "var(--pm-text-muted)",
                    fontSize: "11px",
                  }}
                  aria-live="polite"
                >
                  Loading projects…
                </div>
              ) : projects.length === 0 ? (
                <div
                  style={{
                    padding: "12px 10px",
                    color: "var(--pm-text-muted)",
                    fontSize: "11px",
                  }}
                  aria-live="polite"
                >
                  No projects available.
                </div>
              ) : (
                projects.map((project, index) => {
                  const isSelected =
                    selectedProjectId === project.project_id;

                  return (
                    <button
                      key={project.project_id}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      tabIndex={activeIndex === index ? 0 : -1}
                      style={entryButtonStyle(index)}
                      onFocus={() => setActiveIndex(index)}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectProject(project)}
                    >
                      <span
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {project.name}
                        </strong>

                        <small
                          style={{
                            fontSize: "9px",
                            color: "var(--pm-text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "190px",
                          }}
                        >
                          {project.description || "No description"}
                        </small>
                      </span>

                      <span
                        style={{
                          flexShrink: 0,
                          padding: "3px 6px",
                          border: "1px solid var(--pm-border)",
                          borderRadius: "var(--pm-radius-sm)",
                          background:
                            project.status === "active"
                              ? "var(--pm-accent-soft)"
                              : "var(--pm-glass)",
                          color:
                            project.status === "active"
                              ? "var(--pm-success)"
                              : "var(--pm-text-muted)",
                          fontSize: "8px",
                          fontWeight: 650,
                          textTransform: "capitalize",
                        }}
                      >
                        {project.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div
              role="separator"
              style={{
                margin: "10px 0",
                borderTop: "1px solid var(--pm-border)",
              }}
            />

            <div
              style={{
                display: "grid",
                gap: "6px",
              }}
            >
              <button
                ref={(element) => {
                  itemRefs.current[projects.length] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={activeIndex === projects.length ? 0 : -1}
                style={entryButtonStyle(projects.length, true)}
                onFocus={() => setActiveIndex(projects.length)}
                onMouseEnter={() => setActiveIndex(projects.length)}
                onClick={openNewProject}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    fontSize: "11px",
                    fontWeight: 650,
                  }}
                >
                  <Icon name="plus" size={14} />
                  New project…
                </span>
              </button>

              <button
                ref={(element) => {
                  itemRefs.current[projects.length + 1] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={activeIndex === projects.length + 1 ? 0 : -1}
                style={entryButtonStyle(projects.length + 1)}
                onFocus={() => setActiveIndex(projects.length + 1)}
                onMouseEnter={() => setActiveIndex(projects.length + 1)}
                onClick={openProjectManagement}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    fontSize: "11px",
                    fontWeight: 550,
                  }}
                >
                  <Icon name="projects" size={14} />
                  Manage projects…
                </span>

                <Icon
                  name="chevron"
                  size={12}
                />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
