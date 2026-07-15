import React, { useMemo } from "react";

function pad(n) {
  return String(n).padStart(2, "0");
}

function splitValue(value) {
  if (!value) return { date: "", time: "09:00" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const [datePart, timePart] = String(value).split("T");
    return { date: datePart || "", time: (timePart || "09:00").slice(0, 5) };
  }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combine(date, time) {
  if (!date) return "";
  const t = time || "00:00";
  return `${date}T${t}`;
}

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return opts;
})();

export default function DateTimeField({ label, value, onChange, disabled, className = "" }) {
  const { date, time } = useMemo(() => splitValue(value), [value]);

  const setDate = (nextDate) => onChange(combine(nextDate, time));
  const setTime = (nextTime) => onChange(combine(date, nextTime));

  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-crm-text-dim mb-1">{label}</label>}
      <div className="flex gap-2">
        <input
          type="date"
          disabled={disabled}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="crm-input flex-1 min-w-0"
        />
        <select
          disabled={disabled}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="crm-input w-28 shrink-0"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
