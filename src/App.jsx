import { useState, useEffect, useRef } from "react";

const pad = (n) => String(n).padStart(2, "0");

function formatDuration(ms, showSeconds = false) {
  if (!ms || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m${showSeconds ? ` ${s}s` : ""}`;
  return `${m}m${showSeconds ? ` ${s}s` : ""}`;
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  let h = d.getHours(), mn = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${pad(mn)} ${ap}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupByDay(entries) {
  const map = {};
  entries.forEach(e => {
    const d = e.start.split("T")[0];
    if (!map[d]) map[d] = [];
    map[d].push(e);
  });
  return map;
}

function sweetSpot(ageWeeks) {
  if (ageWeeks < 6)  return { min: 45,  max: 60,  label: "45–60 min",    goal: 16 };
  if (ageWeeks < 12) return { min: 60,  max: 90,  label: "1–1.5 hrs",    goal: 15 };
  if (ageWeeks < 20) return { min: 75,  max: 105, label: "1.25–1.75 hrs", goal: 14.5 };
  if (ageWeeks < 32) return { min: 90,  max: 120, label: "1.5–2 hrs",    goal: 14 };
  if (ageWeeks < 52) return { min: 120, max: 180, label: "2–3 hrs",      goal: 13 };
  return              { min: 180, max: 240, label: "3–4 hrs",             goal: 12 };
}

function parseHuckleberry(text) {
  const entries = [];
  const lines = text.split("\n");
  let date = new Date().toISOString().split("T")[0];
  lines.forEach(line => {
    const dm = line.match(/(\w+\s+\d+,?\s+\d{4})/);
    if (dm) { try { date = new Date(dm[1]).toISOString().split("T")[0]; } catch {} return; }
    const sm = line.match(/(sleep|nap)\s+(\d{1,2}:\d{2}\s*[AP]M)\s*[→–\-]+\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (sm) {
      const s = new Date(`${date} ${sm[2]}`);
      let e2 = new Date(`${date} ${sm[3]}`);
      if (e2 < s) e2 = new Date(e2.getTime() + 86400000);
      if (!isNaN(s)) entries.push({
        id: `h-${Math.random().toString(36).slice(2)}`,
        type: /nap/i.test(sm[1]) ? "nap" : "night",
        start: s.toISOString(), end: e2.toISOString(),
        notes: "Imported from Huckleberry", source: "huckleberry"
      });
    }
  });
  return entries;
}

const SEED = [
  { id: "s1", type: "night", start: "2025-11-20T22:00:00", end: "2025-11-21T06:30:00", notes: "Good night!", source: "manual" },
  { id: "s2", type: "nap",   start: "2025-11-21T09:15:00", end: "2025-11-21T10:45:00", notes: "", source: "manual" },
  { id: "s3", type: "nap",   start: "2025-11-21T13:30:00", end: "2025-11-21T14:15:00", notes: "Short nap", source: "manual" },
  { id: "s4", type: "night", start: "2025-11-21T21:30:00", end: "2025-11-22T05:45:00", notes: "", source: "manual" },
  { id: "s5", type: "nap",   start: "2025-11-22T09:00:00", end: "2025-11-22T10:00:00", notes: "", source: "manual" },
];

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 20, padding: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      backdropFilter: "blur(12px)", ...style
    }}>
      {children}
    </div>
  );
}

function Badge({ children, color = "#94a3b8", bg = "rgba(255,255,255,0.08)" }) {
  return (
    <span style={{
      display: "inline-block", background: bg, color,
      padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600
    }}>
      {children}
    </span>
  );
}

function ProgressCircle({ pct, color, emoji }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * Math.min(100, pct) / 100);
  return (
    <div style={{ position: "relative", width: 130, height: 130, margin: "0 auto" }}>
      <svg width="130" height="130" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#1e2937" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 55 55)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", textAlign: "center", fontSize: 42
      }}>
        {emoji}
      </div>
    </div>
  );
}

function WeeklyChart({ entries }) {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const dayEntries = entries.filter(e => e.start.startsWith(key) && e.end);
    const totalMs = dayEntries.reduce((acc, e) => acc + (new Date(e.end) - new Date(e.start)), 0);
    const hours = Math.round(totalMs / 3600000 * 10) / 10;
    data.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), hours });
  }
  const maxH = Math.max(...data.map(d => d.hours), 1);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 160, justifyContent: "space-between", padding: "0 10px" }}>
      {data.map((day, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{
              width: "68%", height: `${(day.hours / maxH) * 100}%`,
              background: "linear-gradient(180deg,#67e8f9,#22d3ee)", borderRadius: 14,
              boxShadow: "0 0 20px #67e8f988", transition: "height 1s ease"
            }} />
          </div>
          <div style={{ fontSize: 11, marginTop: 8, color: "#94a3b8" }}>{day.label}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#67e8f9" }}>{day.hours}h</div>
        </div>
      ))}
    </div>
  );
}

function SleepRow({ entry, onDelete }) {
  const dur = entry.end ? new Date(entry.end) - new Date(entry.start) : null;
  const isNap = entry.type === "nap";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
      background: "rgba(255,255,255,0.05)", borderRadius: 16,
      border: `1px solid ${isNap ? "#0ea5e920" : "#6366f120"}`, transition: "all 0.2s",
      marginBottom: 8
    }}>
      <span style={{ fontSize: 24 }}>{isNap ? "😴" : "🌙"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {formatTime(entry.start)}{entry.end ? ` → ${formatTime(entry.end)}` : " (ongoing)"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {dur ? formatDuration(dur) : "ongoing"}
          {entry.notes ? ` · ${entry.notes}` : ""}
          {entry.source === "huckleberry" ? " · 🫐" : ""}
        </div>
      </div>
      <button onClick={() => onDelete(entry.id)}
        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 }}>✕</button>
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 12, padding: "12px 14px", color: "#e2e8f0", fontSize: 14, outline: "none",
};

const labelStyle = { fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" };

export default function LullabyBaby() {
  const [entries, setEntries] = useState(SEED);
  const [babyName, setBabyName] = useState("Luna");
  const [birthDate, setBirthDate] = useState("2025-11-15");
  const [view, setView] = useState("dashboard");
  const [activeEntry, setActiveEntry] = useState(null);
  const [form, setForm] = useState({ type: "nap", start: "", end: "", notes: "" });
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importJsonMsg, setImportJsonMsg] = useState("");
  const [, setTick] = useState(0);
  const timerRef = useRef(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("lullabySleepData");
    if (saved) {
      const { entries: sE, name, birth } = JSON.parse(saved);
      setEntries(sE || SEED);
      if (name) setBabyName(name);
      if (birth) setBirthDate(birth);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lullabySleepData", JSON.stringify({ entries, babyName, birthDate }));
  }, [entries, babyName, birthDate]);

  useEffect(() => {
    if (activeEntry) timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [activeEntry]);

  const ageWeeks = Math.max(0, Math.round((Date.now() - new Date(birthDate)) / (7 * 86400000)));
  const sweet = sweetSpot(ageWeeks);
  const sorted = [...entries].sort((a, b) => new Date(a.start) - new Date(b.start));
  const today = new Date().toISOString().split("T")[0];
  const todayEntries = sorted.filter(e => e.start.startsWith(today));
  const todaySleep = todayEntries.reduce((acc, e) => e.end ? acc + (new Date(e.end) - new Date(e.start)) : acc, 0);
  const lastSleep = sorted.filter(e => e.end).slice(-1)[0];
  const wakeMs = lastSleep ? Date.now() - new Date(lastSleep.end) : null;
  const wakeMin = wakeMs ? Math.round(wakeMs / 60000) : null;
  const wakePct = wakeMin !== null ? Math.min(100, Math.round((wakeMin / sweet.max) * 100)) : 0;
  const isSweet = wakeMin !== null && wakeMin >= sweet.min && wakeMin <= sweet.max;
  const isOvertired = wakeMin !== null && wakeMin > sweet.max;
  const dailyScore = Math.min(100, Math.round((todaySleep / (sweet.goal * 3600000)) * 100));
  const wakeEmoji = isOvertired ? "😩" : isSweet ? "😊" : "😐";

  function stopTracking() {
    if (!activeEntry) return;
    setEntries(prev => [...prev, {
      id: `e-${Date.now()}`, ...activeEntry,
      end: new Date().toISOString(), notes: "", source: "manual"
    }]);
    setActiveEntry(null);
  }

  function addManual(e) {
    e.preventDefault();
    if (!form.start) return;
    setEntries(prev => [...prev, {
      id: `m-${Date.now()}`, type: form.type,
      start: new Date(form.start).toISOString(),
      end: form.end ? new Date(form.end).toISOString() : null,
      notes: form.notes, source: "manual"
    }]);
    setForm({ type: "nap", start: "", end: "", notes: "" });
  }

  function handleImport() {
    const parsed = parseHuckleberry(importText);
    if (!parsed.length) { setImportMsg("❌ No entries found."); return; }
    setEntries(prev => [...prev, ...parsed]);
    setImportMsg(`✅ Imported ${parsed.length} entries!`);
    setImportText("");
  }

  function handleJsonImport() {
    try {
      const data = JSON.parse(importJson);
      const incoming = data.entries || (Array.isArray(data) ? data : []);
      if (!incoming.length) { setImportJsonMsg("❌ No entries found in JSON."); return; }
      const withIds = incoming.map((e, i) => ({ ...e, id: e.id || `j-${Date.now()}-${i}` }));
      setEntries(prev => [...prev, ...withIds]);
      if (data.name) setBabyName(data.name);
      if (data.birth) setBirthDate(data.birth);
      setImportJsonMsg(`✅ Imported ${withIds.length} entries!`);
      setImportJson("");
    } catch {
      setImportJsonMsg("❌ Invalid JSON format.");
    }
  }

  function handleExport() {
    const dataStr = JSON.stringify({ entries, babyName, birthDate }, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = `lullabybaby-backup-${today}.json`;
    link.click();
  }

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "log",       icon: "📋", label: "Log" },
    { id: "import",    icon: "📥", label: "Import" },
    { id: "settings",  icon: "⚙️",  label: "Settings" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 20%, #1e1133 0%, #0a0a1f 70%)",
      fontFamily: "'Inter',system-ui,sans-serif", color: "#e2e8f0",
      paddingBottom: 80, position: "relative", overflow: "hidden"
    }}>
      {activeEntry && (
        <div style={{
          position: "absolute", top: "25%", left: "55%", fontSize: 80,
          opacity: 0.12, animation: "float 8s infinite ease-in-out", pointerEvents: "none"
        }}>💤</div>
      )}

      {/* HEADER */}
      <div style={{
        background: "rgba(10,10,30,0.9)", borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 32, filter: "drop-shadow(0 0 12px #a5b4fc)" }}>🌙</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.4px" }}>LullabyBaby</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{babyName} · {ageWeeks}w</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} title={t.label} style={{
              background: view === t.id ? "rgba(103,232,249,0.25)" : "transparent",
              border: view === t.id ? "1px solid #67e8f9" : "1px solid transparent",
              color: view === t.id ? "#67e8f9" : "#64748b",
              padding: "10px 16px", borderRadius: 12, cursor: "pointer", fontSize: 19, transition: "all 0.2s"
            }}>{t.icon}</button>
          ))}
        </nav>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 20 }}>

        {/* ── DASHBOARD ── */}
        {view === "dashboard" && <>
          {activeEntry ? (
            <Card style={{
              background: "linear-gradient(135deg,#312e81,#1e3a5f)",
              border: "2px solid #6366f1", boxShadow: "0 0 40px #6366f188"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Badge color="#a5b4fc" bg="#312e81">{activeEntry.type === "nap" ? "😴 Nap" : "🌙 Night"}</Badge>
                  <div style={{
                    fontSize: 52, fontWeight: 800, margin: "12px 0",
                    fontVariantNumeric: "tabular-nums", letterSpacing: "-2px", color: "#c7d2fe"
                  }}>
                    {formatDuration(Date.now() - new Date(activeEntry.start), true)}
                  </div>
                  <div style={{ color: "#94a3b8" }}>Started {formatTime(activeEntry.start)}</div>
                </div>
                <button onClick={stopTracking} style={{
                  background: "#e11d48", color: "#fff", border: "none", borderRadius: 16,
                  padding: "16px 28px", fontSize: 16, fontWeight: 700,
                  boxShadow: "0 0 30px #e11d4888", cursor: "pointer"
                }}>⏹ Stop</button>
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 16 }}>Start Tracking</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { type: "nap",   emoji: "😴", label: "Nap",   color: "#0ea5e9" },
                  { type: "night", emoji: "🌙", label: "Night", color: "#6366f1" },
                ].map(b => (
                  <button key={b.type}
                    onClick={() => setActiveEntry({ type: b.type, start: new Date().toISOString() })}
                    style={{
                      padding: "24px", background: `linear-gradient(135deg,${b.color}22,transparent)`,
                      border: `1px solid ${b.color}44`, borderRadius: 18, color: "#e2e8f0",
                      fontSize: 15, fontWeight: 700, display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 10, cursor: "pointer", transition: "all 0.3s"
                    }}>
                    <span style={{ fontSize: 48 }}>{b.emoji}</span>{b.label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>🎯 Wake Window</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>Sweet spot: {sweet.label}</div>
              </div>
              {wakeMin !== null && (
                <Badge color={isSweet ? "#86efac" : isOvertired ? "#fca5a5" : "#fbbf24"}>
                  {isSweet ? "✅ Sweet Spot" : isOvertired ? "⚠️ Overtired" : "⏳"}
                </Badge>
              )}
            </div>
            <ProgressCircle pct={wakePct} color={isOvertired ? "#f43f5e" : isSweet ? "#22c55e" : "#eab308"} emoji={wakeEmoji} />
            {wakeMin !== null && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1px" }}>
                  {Math.floor(wakeMin / 60) > 0 ? `${Math.floor(wakeMin / 60)}h ` : ""}{wakeMin % 60}m
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>awake since last sleep</div>
              </div>
            )}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Today's Sleep</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{formatDuration(todaySleep)}</div>
            </Card>
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Daily Score</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: dailyScore > 85 ? "#86efac" : "#fbbf24" }}>
                {dailyScore}<span style={{ fontSize: 14 }}> /100</span>
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>This Week</div>
            <WeeklyChart entries={entries} />
          </Card>

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Today's Timeline</div>
            {todayEntries.length
              ? todayEntries.map(e => <SleepRow key={e.id} entry={e} onDelete={id => setEntries(p => p.filter(x => x.id !== id))} />)
              : <div style={{ textAlign: "center", padding: 30, color: "#475569" }}>Nothing logged today yet.</div>}
          </Card>
        </>}

        {/* ── LOG ── */}
        {view === "log" && <>
          <Card>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Add Sleep Entry</div>
            <form onSubmit={addManual} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { type: "nap",   emoji: "😴", label: "Nap",   color: "#0ea5e9" },
                    { type: "night", emoji: "🌙", label: "Night", color: "#6366f1" },
                  ].map(b => (
                    <button key={b.type} type="button"
                      onClick={() => setForm(f => ({ ...f, type: b.type }))}
                      style={{
                        padding: "12px", border: `1px solid ${form.type === b.type ? b.color : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 12, background: form.type === b.type ? `${b.color}22` : "transparent",
                        color: form.type === b.type ? b.color : "#94a3b8",
                        fontWeight: 600, cursor: "pointer", fontSize: 14, transition: "all 0.2s"
                      }}>
                      {b.emoji} {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Start time *</label>
                  <input type="datetime-local" required value={form.start}
                    onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End time</label>
                  <input type="datetime-local" value={form.end}
                    onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" placeholder="Optional notes…" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={inputStyle} />
              </div>

              <button type="submit" style={{
                background: "linear-gradient(135deg,#6366f1,#0ea5e9)", border: "none",
                borderRadius: 12, padding: "14px", color: "#fff", fontWeight: 700,
                fontSize: 15, cursor: "pointer"
              }}>+ Add Entry</button>
            </form>
          </Card>

          {Object.entries(groupByDay(sorted)).reverse().map(([day, dayEntries]) => (
            <Card key={day}>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>{formatDate(day)}</div>
              {dayEntries.map(e => (
                <SleepRow key={e.id} entry={e} onDelete={id => setEntries(p => p.filter(x => x.id !== id))} />
              ))}
            </Card>
          ))}
        </>}

        {/* ── IMPORT ── */}
        {view === "import" && <>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🫐 Import from Huckleberry</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Paste your Huckleberry export text below. Each line should follow the format:<br />
              <code style={{ color: "#67e8f9", fontSize: 12 }}>Nap 9:15 AM – 10:45 AM</code>
            </div>
            <textarea
              rows={8}
              placeholder={"November 21, 2025\nNap 9:15 AM – 10:45 AM\nSleep 9:30 PM – 6:00 AM"}
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportMsg(""); }}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
            />
            {importMsg && (
              <div style={{ marginTop: 8, fontSize: 13, color: importMsg.startsWith("✅") ? "#86efac" : "#fca5a5" }}>
                {importMsg}
              </div>
            )}
            <button onClick={handleImport} style={{
              marginTop: 12, width: "100%", background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
              border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontWeight: 700,
              fontSize: 15, cursor: "pointer"
            }}>Import Entries</button>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>📂 Import from JSON Backup</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Paste the contents of a previously exported LullabyBaby JSON backup.
            </div>
            <textarea
              rows={6}
              placeholder='{"entries": [...], "babyName": "Luna", "birthDate": "2025-11-15"}'
              value={importJson}
              onChange={e => { setImportJson(e.target.value); setImportJsonMsg(""); }}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
            />
            {importJsonMsg && (
              <div style={{ marginTop: 8, fontSize: 13, color: importJsonMsg.startsWith("✅") ? "#86efac" : "#fca5a5" }}>
                {importJsonMsg}
              </div>
            )}
            <button onClick={handleJsonImport} style={{
              marginTop: 12, width: "100%", background: "linear-gradient(135deg,#22c55e,#0ea5e9)",
              border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontWeight: 700,
              fontSize: 15, cursor: "pointer"
            }}>Import JSON</button>
          </Card>
        </>}

        {/* ── SETTINGS ── */}
        {view === "settings" && (
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 20 }}>⚙️ Settings</div>

            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Baby's name</label>
                <input type="text" value={babyName}
                  onChange={e => setBabyName(e.target.value)}
                  style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Date of birth</label>
                <input type="date" value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  style={inputStyle} />
              </div>

              <div style={{
                padding: "14px 16px", background: "rgba(103,232,249,0.08)",
                border: "1px solid rgba(103,232,249,0.2)", borderRadius: 14
              }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Age</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{ageWeeks} weeks</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  Recommended wake window: <span style={{ color: "#67e8f9" }}>{sweet.label}</span>
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Daily sleep goal: <span style={{ color: "#67e8f9" }}>{sweet.goal}h</span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: "#94a3b8", fontSize: 13 }}>DATA</div>
                <button onClick={handleExport} style={{
                  width: "100%", background: "rgba(34,197,94,0.2)", color: "#86efac",
                  border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12,
                  padding: "13px", fontWeight: 700, cursor: "pointer", fontSize: 14, marginBottom: 10
                }}>📤 Export Backup (JSON)</button>
                <button
                  onClick={() => {
                    if (window.confirm(`Clear all data for ${babyName}? This cannot be undone.`)) {
                      setEntries([]);
                      localStorage.removeItem("lullabySleepData");
                    }
                  }}
                  style={{
                    width: "100%", background: "rgba(225,29,72,0.15)", color: "#fca5a5",
                    border: "1px solid rgba(225,29,72,0.3)", borderRadius: 12,
                    padding: "13px", fontWeight: 700, cursor: "pointer", fontSize: 14
                  }}>🗑️ Clear All Data</button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
