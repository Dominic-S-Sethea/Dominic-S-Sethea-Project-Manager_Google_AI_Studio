import { useEffect, useState, type CSSProperties } from "react";
import { THEME_PRESETS, isHexColor, useTheme } from "../theme/ThemeProvider";
import { Icon } from "../components/layout/Icon";

export default function AppearancePage() {
  const { theme, accent, hasCustomAccent, setTheme, setCustomAccent, resetAccent, resetTheme } = useTheme();
  const [input, setInput] = useState(accent);
  const [error, setError] = useState("");

  useEffect(() => {
    setInput(accent);
  }, [accent]);

  const selectTheme = (id: typeof theme) => {
    setTheme(id);
    setError("");
  };

  const apply = () => {
    if (setCustomAccent(input)) {
      setError("");
    } else {
      setError("Enter a valid 6-digit hex color code (e.g. #54C8FF).");
    }
  };

  return (
    <div className="pm-page">
      <header className="pm-page-heading">
        <div>
          <div className="pm-kicker">APPEARANCE · GLASS THEME ENGINE</div>
          <h1>Graphite-black glass by default. Yours by choice.</h1>
          <p>Obsidian Signal (graphite-black glass with crystal-bright-blue emphasis) is the default theme. Pick a preset or enter any hex color code.</p>
        </div>
        <span className="pm-data-status">Active: {accent}</span>
      </header>

      <div className="pm-appearance-layout">
        <section className="pm-glass-panel pm-appearance-main">
          <header className="pm-panel-header">
            <div>
              <h2>Glass theme presets</h2>
              <p>Every preset preserves glass panel blur, specular rims, hierarchy, and semantic status meanings.</p>
            </div>
            <button type="button" className="pm-secondary-button" onClick={resetTheme}>
              Reset to Obsidian Signal
            </button>
          </header>
          <div className="pm-theme-card-grid">
            {THEME_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`pm-appearance-theme-card${theme === preset.id && !hasCustomAccent ? " is-selected" : ""}`}
                onClick={() => selectTheme(preset.id)}
              >
                <span className="pm-theme-swatch" style={{ "--swatch-accent": preset.accent } as CSSProperties}>
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{preset.name}</strong>
                  <small>{preset.description}</small>
                </span>
                {theme === preset.id && !hasCustomAccent ? <Icon name="spark" size={14} /> : null}
              </button>
            ))}
          </div>
        </section>

        <aside className="pm-appearance-side">
          <section className="pm-glass-panel pm-custom-accent-card">
            <div className="pm-panel-header">
              <div>
                <h2>Custom color picker &amp; hex code</h2>
                <p>Click the color swatch or enter a 6-digit hex code (`#RRGGBB`) for primary actions, focus rings, and active highlights.</p>
              </div>
            </div>
            <div className="pm-custom-color-large">
              <label className="pm-accent-picker-label" aria-label="Open visual color picker">
                <span className="pm-accent-preview" style={{ background: accent }} />
                <input
                  type="color"
                  aria-label="Pick accent color"
                  value={accent}
                  onChange={(event) => {
                    const next = event.target.value.toUpperCase();
                    setInput(next);
                    setCustomAccent(next);
                    setError("");
                  }}
                />
              </label>
              <input
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setError("");
                }}
                onBlur={apply}
                onKeyDown={(event) => {
                  if (event.key === "Enter") apply();
                }}
                placeholder="#54C8FF"
                aria-label="Custom accent hexadecimal value"
                spellCheck="false"
              />
              <button type="button" className="pm-primary-button" onClick={apply}>
                Apply
              </button>
            </div>
            {error ? (
              <p className="pm-color-error" role="alert">{error}</p>
            ) : (
              <p className="pm-color-help">
                {isHexColor(input)
                  ? `${hasCustomAccent ? "Custom accent active" : "Preset accent active"} (${accent}) · Contrast-safe button text is computed automatically.`
                  : "Enter a 6-digit hex code such as #54C8FF."}
              </p>
            )}
            {hasCustomAccent ? (
              <div style={{ padding: "0 15px 14px" }}>
                <button
                  type="button"
                  className="pm-text-button"
                  onClick={() => {
                    resetAccent();
                  }}
                >
                  Restore preset accent <Icon name="arrow" size={12} />
                </button>
              </div>
            ) : null}
          </section>

          <section className="pm-glass-panel pm-appearance-rule-card">
            <Icon name="theme" size={16} />
            <div>
              <h2>Glassmorphism discipline</h2>
              <p>Translucent frosted glass is applied to structural layers, panels, menus, and dialogs, while data rows stay sharp and high-contrast.</p>
            </div>
            <ul>
              <li><i className="pm-status-dot success" />Confirmed / healthy</li>
              <li><i className="pm-status-dot warning" />Review / attention</li>
              <li><i className="pm-status-dot danger" />Blocked / destructive</li>
              <li><i className="pm-status-dot info" />Active work</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
