import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cloud,
  CloudOff,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Signal,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { createLocalSummary } from "./summary.js";

const CACHE_KEY = "campusmate-notices-v1";
const MAX_CACHE_AGE_MS = 30 * 60 * 1000;
const PRIORITIES = ["High", "Medium", "Low"];

function readSavedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { notices: [], lastSuccessfulRefresh: null, error: "" };

    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.notices)) {
      throw new Error("Saved notice data has an unexpected format.");
    }

    return {
      notices: saved.notices,
      lastSuccessfulRefresh: saved.lastSuccessfulRefresh || null,
      error: "",
    };
  } catch (error) {
    return {
      notices: [],
      lastSuccessfulRefresh: null,
      error: `Saved data could not be read: ${error.message}`,
    };
  }
}

function saveData(notices, lastSuccessfulRefresh) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ notices, lastSuccessfulRefresh }),
  );
}

function formatDate(dateString) {
  if (!dateString) return "No date set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${dateString}T12:00:00`));
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "No successful local refresh yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getCacheState(timestamp, now) {
  if (!timestamp) return "unknown";
  const refreshedAt = new Date(timestamp).getTime();
  if (!Number.isFinite(refreshedAt) || refreshedAt > now) return "unknown";
  return now - refreshedAt <= MAX_CACHE_AGE_MS ? "fresh" : "stale";
}

function App() {
  const [savedData, setSavedData] = useState(readSavedData);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [demoOffline, setDemoOffline] = useState(false);
  const [failNextRefresh, setFailNextRefresh] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [activeFilter, setActiveFilter] = useState("All notices");
  const [showComposer, setShowComposer] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    date: "",
    priority: "Medium",
  });

  const effectiveOnline = isOnline && !demoOffline;
  const cacheState = getCacheState(savedData.lastSuccessfulRefresh, now);
  const freshCount =
    cacheState === "fresh" ? savedData.notices.length : 0;

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredNotices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return savedData.notices
      .filter((notice) => {
        const matchesQuery =
          !normalizedQuery ||
          [notice.title, notice.body, ...(notice.summary || [])]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesFilter =
          activeFilter === "All notices" ||
          (activeFilter === "High priority" && notice.priority === "High") ||
          (activeFilter === "Upcoming" &&
            notice.date &&
            new Date(`${notice.date}T23:59:59`).getTime() >= now);
        return matchesQuery && matchesFilter;
      })
      .sort((first, second) => {
        if (sortOrder === "oldest") {
          return new Date(first.createdAt) - new Date(second.createdAt);
        }
        if (sortOrder === "date") {
          return (first.date || "9999-12-31").localeCompare(second.date || "9999-12-31");
        }
        return new Date(second.createdAt) - new Date(first.createdAt);
      });
  }, [activeFilter, now, query, savedData.notices, sortOrder]);

  function persist(nextNotices, nextRefresh = savedData.lastSuccessfulRefresh) {
    if (savedData.error) {
      setNoticeError("Local storage is unavailable until the saved data issue is resolved.");
      return false;
    }
    try {
      saveData(nextNotices, nextRefresh);
      setSavedData({
        notices: nextNotices,
        lastSuccessfulRefresh: nextRefresh,
        error: "",
      });
      setNoticeError("");
      return true;
    } catch (error) {
      setNoticeError(`Your change could not be saved locally: ${error.message}`);
      return false;
    }
  }

  function addNotice(event) {
    event.preventDefault();
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || !body) return;

    const notice = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      title,
      body,
      date: form.date,
      priority: form.priority,
      createdAt: new Date().toISOString(),
      summary: createLocalSummary(body),
    };
    if (persist([notice, ...savedData.notices])) {
      setForm({ title: "", body: "", date: "", priority: "Medium" });
      setShowComposer(false);
      setNoticeMessage("Notice and local summary saved on this device.");
    }
  }

  function deleteNotice(noticeId) {
    if (persist(savedData.notices.filter((notice) => notice.id !== noticeId))) {
      setNoticeMessage("Notice deleted from this device.");
    }
  }

  async function refreshLocalCache() {
    if (refreshing) return;
    setRefreshing(true);
    setNoticeError("");
    setNoticeMessage("");

    await new Promise((resolve) => window.setTimeout(resolve, 450));
    if (!effectiveOnline) {
      setNoticeError("Refresh failed because this device is offline. Your saved notices were kept.");
      setRefreshing(false);
      return;
    }
    if (failNextRefresh) {
      setFailNextRefresh(false);
      setNoticeError("The simulated connection failed. Your saved notices were kept unchanged.");
      setRefreshing(false);
      return;
    }

    const refreshedAt = new Date().toISOString();
    if (persist(savedData.notices, refreshedAt)) {
      setNoticeMessage(
        "Local cache checked successfully. No live college notice feed is connected, so newer notices cannot be verified.",
      );
    }
    setNow(Date.now());
    setRefreshing(false);
  }

  function ageCache() {
    const agedTimestamp = new Date(Date.now() - MAX_CACHE_AGE_MS - 60_000).toISOString();
    if (persist(savedData.notices, agedTimestamp)) {
      setNow(Date.now());
      setNoticeMessage("Demo: cache timestamp moved beyond 30 minutes to show the stale warning.");
    }
  }

  function resetDemo() {
    setDemoOffline(false);
    setFailNextRefresh(false);
    setNoticeMessage("Demo network controls reset.");
    setNoticeError("");
  }

  const cacheDescription =
    cacheState === "fresh"
      ? "Saved snapshot is within the 30-minute window"
      : cacheState === "stale"
        ? "Saved snapshot is older than 30 minutes"
        : "No successful local refresh recorded";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="CampusMate home">
          <span className="brand-mark"><GraduationCap size={22} /></span>
          <span>Campus<span className="brand-accent">Mate</span></span>
        </a>

        <div className="workspace-label">YOUR CAMPUS</div>
        <nav aria-label="Main navigation">
          <button className="nav-item active" type="button">
            <Bell size={18} /> Notices <span className="nav-count">{savedData.notices.length}</span>
          </button>
          <button className="nav-item" type="button" onClick={() => setActiveFilter("Upcoming")}>
            <CalendarDays size={18} /> Upcoming
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className={`connection-card ${effectiveOnline ? "is-online" : "is-offline"}`}>
            {effectiveOnline ? <Wifi size={17} /> : <CloudOff size={17} />}
            <div>
              <strong>{effectiveOnline ? "You're online" : "You're offline"}</strong>
              <span>{effectiveOnline ? "Local data is available" : "Viewing saved notices"}</span>
            </div>
            <span className="connection-dot" aria-hidden="true" />
          </div>
          <div className="profile">
            <div className="avatar">CM</div>
            <div><strong>CampusMate</strong><span>Student workspace</span></div>
            <CircleHelp size={18} aria-hidden="true" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Campus <span>/</span> <strong>Notices</strong></div>
          <div className={`status-pill ${effectiveOnline ? "online" : "offline"}`}>
            <span className="status-dot" />
            {effectiveOnline ? "Online" : "Offline"}
            {demoOffline && <span className="demo-tag">DEMO</span>}
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date())}
              </p>
              <h1>Your campus, <span>in sync.</span></h1>
              <p className="welcome-copy">Important updates and deadlines, all in one place.</p>
            </div>
            <button className="button button-primary add-button" type="button" onClick={() => setShowComposer(true)}>
              <Plus size={18} /> Add notice
            </button>
          </section>

          <section className={`freshness-banner ${cacheState}`} aria-live="polite">
            <div className="freshness-icon">
              {cacheState === "fresh" ? <Check size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div className="freshness-copy">
              <strong>
                {cacheState === "fresh"
                  ? "Saved information is within its 30-minute cache window"
                  : cacheState === "stale"
                    ? "Your saved information may be out of date"
                    : "No successful local refresh recorded"}
              </strong>
              <span>
                {cacheDescription}. Last local refresh: {formatTimestamp(savedData.lastSuccessfulRefresh)}.
                {" "}This is a local snapshot only; no college feed is connected.
              </span>
            </div>
            <button className="button button-refresh" type="button" onClick={refreshLocalCache} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              {refreshing ? "Checking..." : "Refresh cache"}
            </button>
          </section>

          {!effectiveOnline && (
            <div className="offline-warning" role="status">
              <CloudOff size={17} />
              <span><strong>Offline mode.</strong> You can still view notices saved on this device.</span>
            </div>
          )}
          {cacheState === "stale" && (
            <div className="stale-warning" role="alert">
              <AlertTriangle size={17} />
              <span><strong>Stale cache warning:</strong> these saved notices are more than 30 minutes past the last local refresh. They may no longer be current.</span>
            </div>
          )}
          {savedData.error && <div className="error-message" role="alert">{savedData.error}</div>}
          {noticeError && <div className="error-message" role="alert"><AlertTriangle size={17} /> {noticeError}</div>}
          {noticeMessage && <div className="success-message" role="status"><Check size={16} /> {noticeMessage}</div>}

          <section className="stats-grid" aria-label="Notice overview">
            <div className="stat-card">
              <div className="stat-icon purple"><Bell size={18} /></div>
              <div className="stat-label">SAVED NOTICES</div>
              <strong className="stat-value">{savedData.notices.length}</strong>
              <span className="stat-foot">Stored on this device</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange"><Clock3 size={18} /></div>
              <div className="stat-label">UPCOMING</div>
              <strong className="stat-value">
                {savedData.notices.filter((notice) => notice.date && new Date(`${notice.date}T23:59:59`).getTime() >= now).length}
              </strong>
              <span className="stat-foot">With a future date</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><Cloud size={18} /></div>
              <div className="stat-label">CACHE STATUS</div>
              <strong className={`stat-value status-value ${cacheState}`}>{cacheState === "fresh" ? "Fresh" : cacheState === "stale" ? "Stale" : "Unverified"}</strong>
              <span className="stat-foot">{freshCount} notice{freshCount === 1 ? "" : "s"} in fresh window</span>
            </div>
          </section>

          <section className="notice-section">
            <div className="section-heading">
              <div>
                <h2>All notices <span>{savedData.notices.length}</span></h2>
                <p>Your saved campus updates</p>
              </div>
              <button className="text-button" type="button" onClick={() => setShowDemo((current) => !current)} aria-expanded={showDemo}>
                <Signal size={16} /> Demo controls <ChevronDown size={15} className={showDemo ? "rotate" : ""} />
              </button>
            </div>

            {showDemo && (
              <div className="demo-panel">
                <div className="demo-heading"><strong>Network failure demo</strong><span>Test offline and stale-cache behavior without disconnecting your device.</span></div>
                <div className="demo-actions">
                  <button className={`demo-control ${demoOffline ? "selected" : ""}`} type="button" onClick={() => setDemoOffline((current) => !current)}>
                    <CloudOff size={16} /> {demoOffline ? "Restore demo connection" : "Simulate offline"}
                  </button>
                  <button className="demo-control" type="button" onClick={() => setFailNextRefresh(true)}>
                    <AlertTriangle size={16} /> Fail next refresh
                  </button>
                  <button className="demo-control" type="button" onClick={ageCache}>
                    <Clock3 size={16} /> Age cache past 30 min
                  </button>
                  <button className="demo-reset" type="button" onClick={resetDemo}>Reset controls</button>
                </div>
                <p className="demo-note">Scenarios: disconnected device, failed refresh while online, and cache older than 30 minutes. Failed refreshes never erase saved notices.</p>
              </div>
            )}

            <div className="toolbar">
              <label className="search-box">
                <Search size={17} />
                <input type="search" placeholder="Search notices..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search notices" />
                <kbd>⌘ K</kbd>
              </label>
              <label className="filter-select">
                <span className="sr-only">Filter notices</span>
                <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                  <option>All notices</option>
                  <option>High priority</option>
                  <option>Upcoming</option>
                </select>
                <ChevronDown size={15} />
              </label>
              <button className="sort-button" type="button" onClick={() => setSortOrder((current) => current === "newest" ? "oldest" : current === "oldest" ? "date" : "newest")} aria-label={`Sort notices; current order is ${sortOrder}`}>
                <ArrowDownUp size={16} /> Sort
              </button>
            </div>

            {savedData.notices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Bell size={24} /></div>
                <h3>No notices yet</h3>
                <p>Add a campus notice to save it here. Its key points will be extracted locally on this device.</p>
                <button className="button button-primary" type="button" onClick={() => setShowComposer(true)}><Plus size={17} /> Add your first notice</button>
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="empty-state compact-empty">
                <div className="empty-icon"><Search size={22} /></div>
                <h3>No matching notices</h3>
                <p>Try a different search or filter.</p>
                <button className="text-button" type="button" onClick={() => { setQuery(""); setActiveFilter("All notices"); }}>Clear search and filters</button>
              </div>
            ) : (
              <div className="notice-list">
                {filteredNotices.map((notice) => (
                  <article className="notice-card" key={notice.id}>
                    <div className="notice-main">
                      <div className="notice-title-row">
                        <h3>{notice.title}</h3>
                        <span className={`priority-badge ${notice.priority.toLowerCase()}`}><span />{notice.priority} priority</span>
                      </div>
                      <p className="notice-body">{notice.body}</p>
                      <div className="summary-block">
                        <div className="summary-label"><span className="sparkle">✳</span> LOCAL KEY POINTS <span className="rule-tag">RULE-BASED</span></div>
                        <ul>
                          {(notice.summary?.length ? notice.summary : createLocalSummary(notice.body)).map((point, index) => <li key={`${notice.id}-${index}`}>{point}</li>)}
                        </ul>
                      </div>
                      <div className="notice-meta">
                        <span><CalendarDays size={14} /> {formatDate(notice.date)}</span>
                        <span><Clock3 size={14} /> Saved {formatTimestamp(notice.createdAt)}</span>
                      </div>
                    </div>
                    <button className="delete-button" type="button" onClick={() => deleteNotice(notice.id)} aria-label={`Delete ${notice.title}`} title="Delete notice"><Trash2 size={17} /></button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span><span className="footer-dot" /> Local-first campus companion</span>
            <span>Summaries are rule-based, not generated by an AI service</span>
          </footer>
        </div>
      </main>

      {showComposer && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowComposer(false); }}>
          <section className="composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <div className="modal-heading">
              <div><span className="modal-kicker">CAMPUS UPDATE</span><h2 id="composer-title">Add a notice</h2></div>
              <button className="icon-button" type="button" onClick={() => setShowComposer(false)} aria-label="Close form"><X size={20} /></button>
            </div>
            <p className="modal-copy">Save an announcement and extract key points on this device. Nothing is sent to a server.</p>
            <form onSubmit={addNotice}>
              <label className="form-field">Notice title
                <input autoFocus required maxLength={100} placeholder="e.g. Mid-semester exam schedule" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </label>
              <label className="form-field">Notice details
                <textarea required rows={5} maxLength={3000} placeholder="Paste the notice text here..." value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
              </label>
              <div className="form-row">
                <label className="form-field">Relevant date
                  <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                </label>
                <label className="form-field">Priority
                  <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                    {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </label>
              </div>
              <div className="summary-hint"><span className="sparkle">✳</span> A local, rule-based summary will be saved with this notice.</div>
              <div className="modal-actions">
                <button className="button button-quiet" type="button" onClick={() => setShowComposer(false)}>Cancel</button>
                <button className="button button-primary" type="submit"><Plus size={17} /> Save notice</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
