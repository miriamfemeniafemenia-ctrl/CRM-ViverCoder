import React from "react";
import { Popover } from "../overlays/Popover";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function sameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isOutOfRange(date, min, max) {
  const iso = toISO(date);
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-600)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function CalendarPanel({ value, min, max, onSelect }) {
  const selected = parseISO(value);
  const today = new Date();
  const [viewDate, setViewDate] = React.useState(selected || today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div style={{ width: 232 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <button type="button" aria-label="Mes anterior" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
          border: "none", borderRadius: "var(--radius-sm)", background: "transparent", cursor: "pointer",
        }}>
          <ChevronLeftIcon />
        </button>
        <span style={{ font: "var(--text-label)", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>
          {MONTHS[month]} {year}
        </span>
        <button type="button" aria-label="Mes siguiente" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
          border: "none", borderRadius: "var(--radius-sm)", background: "transparent", cursor: "pointer",
        }}>
          <ChevronRightIcon />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map(w => (
          <span key={w} style={{ font: "var(--text-micro)", color: "var(--text-tertiary)", textAlign: "center" }}>{w}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <span key={i} />;
          const disabled = isOutOfRange(date, min, max);
          const isSelected = sameDay(date, selected);
          const isToday = sameDay(date, today);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(toISO(date))}
              style={{
                height: 30,
                border: isToday && !isSelected ? "1px solid var(--border-focus)" : "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                background: isSelected ? "var(--color-primary-500)" : "transparent",
                color: disabled ? "var(--color-neutral-300)" : isSelected ? "var(--text-on-brand)" : "var(--text-primary)",
                font: "var(--text-label)",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ label, value, onChange, error, disabled = false, min, max }) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseISO(value);
  const display = parsed ? parsed.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "";

  let border = "1px solid var(--border-default)";
  if (error) border = "1px solid var(--color-warning-border)";
  if (open && !error) border = "1px solid var(--border-focus)";

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }}>
      {label ? <span style={{ font: "var(--text-label)", color: "var(--text-secondary)" }}>{label}</span> : null}
      <Popover
        open={disabled ? false : open}
        onOpenChange={next => { if (!disabled) setOpen(next); }}
        width={232}
        trigger={
          <span style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            width: "100%",
            boxSizing: "border-box",
            height: 40,
            paddingInline: "var(--space-3)",
            borderRadius: "var(--radius-xs)",
            border,
            boxShadow: open && !error ? "var(--focus-ring)" : "none",
            background: disabled ? "var(--color-neutral-100)" : "var(--color-neutral-0)",
            color: display ? "var(--text-primary)" : "var(--text-tertiary)",
            font: "var(--text-body)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}>
            {display || "Selecciona una fecha"}
            <CalendarIcon />
          </span>
        }
      >
        <CalendarPanel
          value={value}
          min={min}
          max={max}
          onSelect={iso => { onChange && onChange(iso); setOpen(false); }}
        />
      </Popover>
      {error ? <span style={{ font: "var(--text-meta)", color: "var(--color-warning-fg)" }}>{error}</span> : null}
    </label>
  );
}
