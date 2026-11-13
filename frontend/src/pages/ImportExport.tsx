import { useState } from "react";
import { getToken } from "../hooks/useAuth";

interface ImportResult {
  imported?: {
    tasks?: number;
    skipped?: number;
    projects?: number;
    checklists?: number;
  };
  message?: string;
}

export default function ImportExportPage() {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: "json" | "csv" | "markdown") => {
    try {
      const res = await fetch(`/api/import-export/export/${format === "json" ? "json" : format === "csv" ? "csv" : "markdown"}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-manager-export.${format === "markdown" ? "md" : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch("/api/import-export/export/pdf", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-manager-report.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleExportXlsx = async () => {
    try {
      const res = await fetch("/api/import-export/export/xlsx", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tasks-export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setImportResult(null);
    try {
      const text = await file.text();
      const projRes = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const projData = await projRes.json();
      const projectId = projData?.projects?.[0]?.project_id;
      if (!projectId) throw new Error("No project found. Create a project first.");
      const res = await fetch("/api/import-export/import/csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ csv: text, project_id: projectId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setImportResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message || "CSV import failed" : "CSV import failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/import-export/import/json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setImportResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message || "Import failed" : "Import failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const exportButtonStyle = {
    padding: "8px 16px",
    borderRadius: "var(--pm-radius-sm)",
    border: "none",
    color: "white",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  };

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">WORK · IMPORT / EXPORT</span>
          <h1>Import &amp; export.</h1>
          <p>Download your data or import from external sources.</p>
        </div>
      </div>

      <section className="pm-glass-panel pm-task-surface">
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "12px",
              borderRadius: "var(--pm-radius-sm)",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              fontSize: "12px",
            }}
          >
            {error}
          </div>
        )}

        {/* Export Section */}
        <div
          className="pm-glass-panel"
          style={{ padding: "16px", marginBottom: "12px" }}
        >
          <h2
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--pm-text)",
              marginBottom: "4px",
            }}
          >
            Export Data
          </h2>
          <p
            style={{
              fontSize: "11px",
              color: "var(--pm-text-muted)",
              marginBottom: "12px",
            }}
          >
            Download your data in various formats. PII is masked by default.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleExport("json")}
              style={{ ...exportButtonStyle, background: "var(--pm-accent)" }}
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport("csv")}
              style={{ ...exportButtonStyle, background: "#22c55e" }}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("markdown")}
              style={{ ...exportButtonStyle, background: "#a855f7" }}
            >
              Export Markdown
            </button>
            <button
              type="button"
              onClick={() => handleExportPdf()}
              style={{ ...exportButtonStyle, background: "#ef4444" }}
            >
              Export PDF Report
            </button>
            <button
              type="button"
              onClick={() => handleExportXlsx()}
              style={{ ...exportButtonStyle, background: "#10b981" }}
            >
              Export XLSX
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div
          className="pm-glass-panel"
          style={{ padding: "16px", marginBottom: "12px" }}
        >
          <h2
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--pm-text)",
              marginBottom: "4px",
            }}
          >
            Import Data
          </h2>
          <p
            style={{
              fontSize: "11px",
              color: "var(--pm-text-muted)",
              marginBottom: "12px",
            }}
          >
            Upload a JSON export file to import data. Duplicates are skipped.
          </p>
          <label
            className="pm-button pm-button-primary"
            style={{ cursor: "pointer", display: "inline-flex" }}
          >
            {loading ? "Importing..." : "Choose JSON File"}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={loading}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* CSV Import Section */}
        <div
          className="pm-glass-panel"
          style={{ padding: "16px", marginBottom: "12px" }}
        >
          <h2
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--pm-text)",
              marginBottom: "4px",
            }}
          >
            Import CSV
          </h2>
          <p
            style={{
              fontSize: "11px",
              color: "var(--pm-text-muted)",
              marginBottom: "12px",
            }}
          >
            Upload a CSV file with task data. Required column: title. Optional:
            description, status, priority, due_date.
          </p>
          <label
            className="pm-button pm-button-primary"
            style={{ cursor: "pointer", display: "inline-flex" }}
          >
            {loading ? "Importing..." : "Choose CSV File"}
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              disabled={loading}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {importResult && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--pm-radius-sm)",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#22c55e",
              fontSize: "12px",
            }}
          >
            <p style={{ fontWeight: 500, margin: 0 }}>Import completed!</p>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>
              {importResult.imported?.tasks !== undefined
                ? `Tasks: ${importResult.imported.tasks} imported, ${importResult.imported.skipped || 0} skipped`
                : `Projects: ${importResult.imported?.projects || 0}, Tasks: ${importResult.imported?.tasks || 0}, Checklists: ${importResult.imported?.checklists || 0}`}
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
