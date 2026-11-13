import { useEffect, useState } from "react";
import { THEME_PRESETS, useTheme } from "../../theme/ThemeProvider";

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function ThemeCustomizer() {
  const { preset, accent, presetName, resetTheme, setAccent, setPreset } = useTheme();
  const [hexValue, setHexValue] = useState(accent);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHexValue(accent);
  }, [accent]);

  const applyHex = () => {
    if (setAccent(hexValue)) {
      setMessage("Custom accent applied.");
    } else {
      setMessage("Enter a six-digit hexadecimal color, for example #54C8FF.");
    }
  };

  return (
    <section className="pm-glass-panel pm-theme-customizer" aria-labelledby="theme-customizer-title">
      <div className="pm-panel-heading">
        <div>
          <p className="pm-kicker">APPEARANCE</p>
          <h2 id="theme-customizer-title">Theme and accent</h2>
          <p>Obsidian Crystal is the default. Presets and a custom color change visual tokens, not status meanings or permissions.</p>
        </div>
        <span className="pm-theme-current"><i style={{ backgroundColor: accent }} />{presetName}</span>
      </div>

      <div className="pm-theme-grid" role="list" aria-label="Theme presets">
        {THEME_PRESETS.map((theme) => (
          <button
            type="button"
            role="listitem"
            key={theme.id}
            className={`pm-theme-choice ${preset === theme.id ? "is-selected" : ""}`}
            onClick={() => {
              setPreset(theme.id);
              setMessage(`${theme.name} applied.`);
            }}
            aria-pressed={preset === theme.id}
          >
            <span className="pm-theme-swatch" style={{ "--theme-choice-accent": theme.accent } as React.CSSProperties}>
              <i />
              <b />
              <em />
            </span>
            <strong>{theme.name}</strong>
            <small>{theme.description}</small>
          </button>
        ))}
      </div>

      <div className="pm-custom-accent">
        <div>
          <span className="pm-field-label">Custom emphasis color</span>
          <p>Use a six-digit hex code. The application automatically selects readable button text.</p>
        </div>
        <div className="pm-accent-controls">
          <label className="pm-color-input" aria-label="Choose custom accent color">
            <input
              type="color"
              value={isHex(hexValue) ? hexValue : accent}
              onChange={(event) => {
                const next = event.target.value.toUpperCase();
                setHexValue(next);
                setAccent(next);
                setMessage("Custom accent applied.");
              }}
            />
          </label>
          <input
            aria-label="Custom accent hex code"
            className="pm-hex-input"
            value={hexValue}
            onChange={(event) => setHexValue(event.target.value)}
            onBlur={applyHex}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyHex();
            }}
            placeholder="#54C8FF"
            spellCheck={false}
          />
          <button type="button" className="pm-button pm-button-secondary" onClick={applyHex}>Apply</button>
          <button
            type="button"
            className="pm-button pm-button-quiet"
            onClick={() => {
              resetTheme();
              setMessage("Obsidian Crystal restored.");
            }}
          >
            Reset default
          </button>
        </div>
      </div>
      {message && <p className="pm-inline-feedback" role="status">{message}</p>}
    </section>
  );
}
