import type { Project } from "../../types";

interface ProjectListProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
}

export function ProjectList({ projects, onEdit, onDelete }: ProjectListProps) {
  return (
    <div
      className="pm-glass-panel"
      style={{
        overflow: "hidden",
        border: "1px solid var(--pm-border)",
        borderRadius: "var(--pm-radius)",
        boxShadow: "var(--pm-shadow)",
      }}
    >
      <div style={{ width: "100%", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead>
            <tr style={{ background: "var(--pm-glass-soft)" }}>
              {["Name", "Status", "Created"].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "12px 24px",
                    borderBottom: "1px solid var(--pm-border)",
                    color: "var(--pm-text-muted)",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {heading}
                </th>
              ))}
              <th
                style={{
                  padding: "12px 24px",
                  borderBottom: "1px solid var(--pm-border)",
                  color: "var(--pm-text-muted)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textAlign: "right",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project) => (
              <tr key={project.project_id}>
                <td
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid var(--pm-border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--pm-text)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {project.name}
                  </div>
                  <div
                    style={{
                      color: "var(--pm-text-muted)",
                      fontSize: "12px",
                      marginTop: "3px",
                    }}
                  >
                    {project.description}
                  </div>
                </td>

                <td
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid var(--pm-border)",
                  }}
                >
                  <span
                    className="pm-status-pill"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 9px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color:
                        project.status === "active"
                          ? "var(--pm-success)"
                          : "var(--pm-text-secondary)",
                      background:
                        project.status === "active"
                          ? "color-mix(in srgb, var(--pm-success) 12%, transparent)"
                          : "var(--pm-glass-soft)",
                      border: "1px solid var(--pm-border)",
                    }}
                  >
                    {project.status}
                  </span>
                </td>

                <td
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid var(--pm-border)",
                    color: "var(--pm-text-secondary)",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(project.created_at).toLocaleDateString()}
                </td>

                <td
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid var(--pm-border)",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  <button
                    type="button"
                    className="pm-button pm-button-quiet"
                    style={{
                      marginRight: "12px",
                      color: "var(--pm-accent)",
                    }}
                    onClick={() => onEdit(project)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="pm-button pm-button-quiet"
                    style={{ color: "var(--pm-danger)" }}
                    onClick={() => onDelete(project.project_id)}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}

            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "28px 24px",
                    textAlign: "center",
                    color: "var(--pm-text-muted)",
                    fontSize: "13px",
                  }}
                >
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectList;
