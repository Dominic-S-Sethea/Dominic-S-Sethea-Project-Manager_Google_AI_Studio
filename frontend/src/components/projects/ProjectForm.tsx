import { useState } from "react";
import type { FormEvent } from "react";
import type { Project } from "../../types";

interface ProjectFormProps {
  project: Project | null;
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newErrors: string[] = [];
    if (!name.trim()) {
      newErrors.push("Project name is required");
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    onSubmit(name.trim(), description.trim());
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "672px",
        margin: "0 auto",
      }}
    >
      <div
        className="pm-glass-panel"
        style={{
          overflow: "hidden",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius)",
          boxShadow: "var(--pm-shadow)",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--pm-border)",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "var(--pm-text)",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            {project ? "Edit Project" : "New Project"}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            padding: "24px",
          }}
        >
          {errors.map((error, index) => (
            <p
              key={`${index}-${error}`}
              role="alert"
              style={{
                margin: 0,
                color: "var(--pm-danger)",
                fontSize: "13px",
              }}
            >
              {error}
            </p>
          ))}

          <div>
            <label
              htmlFor="project-name"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "var(--pm-text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Project Name *
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.length > 0) setErrors([]);
              }}
              placeholder="Enter project name"
              required
              className="pm-input"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                border: "1px solid var(--pm-border)",
                borderRadius: "var(--pm-radius-sm)",
                background: "var(--pm-glass-strong)",
                color: "var(--pm-text)",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "var(--pm-text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Description
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Brief description of the project"
              className="pm-input"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                border: "1px solid var(--pm-border)",
                borderRadius: "var(--pm-radius-sm)",
                background: "var(--pm-glass-strong)",
                color: "var(--pm-text)",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              paddingTop: "8px",
            }}
          >
            <button
              type="button"
              className="pm-button pm-button-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pm-button pm-button-primary"
            >
              {project ? "Update Project" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProjectForm;
