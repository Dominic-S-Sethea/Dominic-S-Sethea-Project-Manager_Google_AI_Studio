import { useEffect, useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getToken, useAuth } from "../hooks/useAuth";
import type { Project } from "../types";
import TaskWorkspace from "./TaskWorkspace";

interface SaveProjectVariables {
  project: Project | null;
  name: string;
  description: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();

  const [createSignal, setCreateSignal] = useState(0);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(
    null
  );
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const scope = searchParams.get("scope") === "mine" ? "mine" : "all";
  const projectId = searchParams.get("project");

  // Share the same query key and request convention used elsewhere.
  const projectsQuery = useQuery<Project[]>({
    queryKey: ["workspace-projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Projects could not be loaded.");
      }

      const data = (await response.json()) as {
        projects: Project[];
      };

      return data.projects;
    },
  });

  // Consume both create signals while preserving every other query parameter.
  useEffect(() => {
    const createMode = searchParams.get("create");

    if (createMode !== "task" && createMode !== "project") {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("create");

    if (createMode === "task") {
      setCreateSignal((current) => current + 1);
    } else {
      setEditingProject(null);
      setProjectName("");
      setProjectDescription("");
      setProjectDialogOpen(true);
    }

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const saveProject = useMutation<
    Project,
    Error,
    SaveProjectVariables
  >({
    mutationFn: async ({ project, name, description }) => {
      const isEditing = Boolean(project);

      const endpoint = isEditing
        ? `/api/projects/${encodeURIComponent(project!.project_id)}`
        : "/api/projects";

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { project?: Project; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body?.message || "Project could not be saved."
        );
      }

      if (!body?.project) {
        throw new Error("Project response was incomplete.");
      }

      return body.project;
    },
    onSuccess: (savedProject, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-projects"],
      });

      setProjectDialogOpen(false);
      setEditingProject(null);
      setProjectName("");
      setProjectDescription("");
      saveProject.reset();

      // Automatically select newly created projects.
      // Editing an existing project does not change the current selection.
      if (!variables.project) {
        window.localStorage.setItem(
          "pm-selected-project",
          savedProject.project_id
        );

        const next = new URLSearchParams(searchParams);
        next.set("project", savedProject.project_id);

        setSearchParams(next);
      }
    },
  });

  // The backend DELETE endpoint performs a soft delete (archive).
  const archiveProject = useMutation<void, Error, string>({
    mutationFn: async (projectIdToArchive) => {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectIdToArchive)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(
          body?.message || "Project could not be archived."
        );
      }
    },
    onSuccess: (_data, archivedProjectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-projects"],
      });

      // Clear persisted selection if the archived project was selected.
      if (
        window.localStorage.getItem("pm-selected-project") ===
        archivedProjectId
      ) {
        window.localStorage.removeItem("pm-selected-project");
      }

      // Remove only the matching project parameter.
      // Preserve scope and any other query parameters.
      if (searchParams.get("project") === archivedProjectId) {
        const next = new URLSearchParams(searchParams);
        next.delete("project");

        setSearchParams(next);
      }
    },
  });

  const openNewProject = () => {
    saveProject.reset();
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
    setProjectDialogOpen(true);
  };

  const openEditProject = (project: Project) => {
    saveProject.reset();
    setEditingProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description);
    setProjectDialogOpen(true);
  };

  const closeProjectDialog = () => {
    setProjectDialogOpen(false);
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
    saveProject.reset();
  };

  const handleProjectSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectName.trim()) {
      return;
    }

    saveProject.mutate({
      project: editingProject,
      name: projectName.trim(),
      description: projectDescription.trim(),
    });
  };

  const selectProject = (selectedProjectId: string) => {
    window.localStorage.setItem(
      "pm-selected-project",
      selectedProjectId
    );

    const next = new URLSearchParams(searchParams);
    next.set("project", selectedProjectId);

    setSearchParams(next);
  };

  const clearProjectFilter = () => {
    window.localStorage.removeItem("pm-selected-project");

    const next = new URLSearchParams(searchParams);
    next.delete("project");

    setSearchParams(next);
  };

  const handleArchiveProject = (project: Project) => {
    if (
      project.status !== "active" ||
      archiveProject.isPending
    ) {
      return;
    }

    if (
      window.confirm(
        `Archive "${project.name}"? The project will no longer be active.`
      )
    ) {
      archiveProject.mutate(project.project_id);
    }
  };

  return (
    <>
      <section
        className="pm-glass-panel"
        style={{
          padding: "16px",
          marginBottom: "16px",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div>
            <span className="pm-eyebrow">PROJECT DIRECTORY</span>

            <h2
              style={{
                margin: "5px 0",
                color: "var(--pm-text)",
                fontSize: "16px",
              }}
            >
              Project management
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--pm-text-secondary)",
                fontSize: "10px",
              }}
            >
              Select, create, edit, and archive projects.
            </p>
          </div>

          <button
            type="button"
            className="pm-button pm-button-primary"
            onClick={openNewProject}
          >
            + New project
          </button>
        </header>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "9px 0",
            borderTop: "1px solid var(--pm-border)",
            borderBottom: "1px solid var(--pm-border)",
          }}
        >
          <span
            style={{
              color: "var(--pm-text-secondary)",
              fontSize: "10px",
            }}
          >
            {projectId
              ? "Showing tasks from the selected project."
              : "Showing tasks across all projects."}
          </span>

          {projectId ? (
            <button
              type="button"
              className="pm-button pm-button-quiet"
              onClick={clearProjectFilter}
            >
              All projects
            </button>
          ) : null}
        </div>

        {projectsQuery.isLoading ? (
          <div
            style={{
              padding: "17px 4px",
              color: "var(--pm-text-muted)",
              fontSize: "10px",
            }}
            aria-live="polite"
          >
            Loading projects…
          </div>
        ) : projectsQuery.error ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "15px 4px",
            }}
          >
            <span
              style={{
                color: "var(--pm-danger)",
                fontSize: "10px",
              }}
              role="alert"
            >
              Projects could not be loaded.
            </span>

            <button
              type="button"
              className="pm-button pm-button-small"
              onClick={() => void projectsQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "6px",
              paddingTop: "10px",
            }}
          >
            {(projectsQuery.data ?? []).length ? (
              projectsQuery.data!.map((project) => {
                const isSelected =
                  projectId === project.project_id;

                return (
                  <div
                    key={project.project_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      padding: "10px",
                      border: isSelected
                        ? "1px solid var(--pm-accent)"
                        : "1px solid var(--pm-border)",
                      borderRadius: "var(--pm-radius)",
                      background: isSelected
                        ? "var(--pm-accent-soft)"
                        : "var(--pm-glass)",
                    }}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        selectProject(project.project_id)
                      }
                      style={{
                        display: "grid",
                        gap: "4px",
                        flex: 1,
                        minWidth: 0,
                        padding: 0,
                        border: 0,
                        background: "var(--pm-glass)",
                        color: "var(--pm-text)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <strong
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: "10px",
                        }}
                      >
                        {project.name}
                      </strong>

                      <small
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--pm-text-muted)",
                          fontSize: "9px",
                        }}
                      >
                        {project.description || "No description"}
                      </small>
                    </button>

                    <span
                      style={{
                        flexShrink: 0,
                        color:
                          project.status === "active"
                            ? "var(--pm-success)"
                            : "var(--pm-text-muted)",
                        fontSize: "9px",
                        textTransform: "capitalize",
                      }}
                    >
                      {project.status}
                    </span>

                    <div className="pm-row-actions">
                      <button
                        type="button"
                        onClick={() => openEditProject(project)}
                      >
                        Edit
                      </button>

                      {project.status === "active" ? (
                        <button
                          type="button"
                          className="is-danger"
                          disabled={archiveProject.isPending}
                          onClick={() => handleArchiveProject(project)}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: "18px 5px",
                  color: "var(--pm-text-muted)",
                  fontSize: "10px",
                }}
              >
                No projects available. Create your first project to get
                started.
              </div>
            )}
          </div>
        )}

        {archiveProject.error ? (
          <p className="pm-inline-error" role="alert">
            {archiveProject.error.message}
          </p>
        ) : null}
      </section>

      <TaskWorkspace
        createSignal={createSignal}
        scope={scope}
        currentUserId={user?.user_id ?? null}
        projectId={projectId}
      />

      {projectDialogOpen ? (
        <div
          className="pm-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProjectDialog();
            }
          }}
        >
          <section
            className="pm-task-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-dialog-title"
          >
            <div className="pm-dialog-heading">
              <div>
                <span className="pm-eyebrow">
                  {editingProject ? "PROJECT SETTINGS" : "NEW WORKSPACE"}
                </span>

                <h2 id="project-dialog-title">
                  {editingProject ? "Edit project" : "Create project"}
                </h2>
              </div>

              <button
                type="button"
                className="pm-icon-button"
                aria-label="Close project editor"
                onClick={closeProjectDialog}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={handleProjectSubmit}>
              <div className="pm-form-grid">
                <label className="pm-field pm-field-wide">
                  <span>Project name *</span>

                  <input
                    autoFocus
                    type="text"
                    value={projectName}
                    onChange={(event) =>
                      setProjectName(event.target.value)
                    }
                    placeholder="Enter project name"
                    required
                  />
                </label>

                <label className="pm-field pm-field-wide">
                  <span>Description</span>

                  <textarea
                    rows={4}
                    value={projectDescription}
                    onChange={(event) =>
                      setProjectDescription(event.target.value)
                    }
                    placeholder="Describe the project's purpose and goals."
                  />
                </label>
              </div>

              {saveProject.error ? (
                <p className="pm-inline-error" role="alert">
                  {saveProject.error.message}
                </p>
              ) : null}

              <div className="pm-dialog-actions">
                <button
                  type="button"
                  className="pm-button pm-button-quiet"
                  onClick={closeProjectDialog}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="pm-button pm-button-primary"
                  disabled={
                    saveProject.isPending || !projectName.trim()
                  }
                >
                  {saveProject.isPending
                    ? "Saving…"
                    : editingProject
                      ? "Save changes"
                      : "Create project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
