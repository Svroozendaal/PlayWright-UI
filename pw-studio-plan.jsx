import { useState } from "react";

const NAV = [
  { id: "vision", label: "Vision" },
  { id: "scope", label: "Scope" },
  { id: "architecture", label: "Architecture" },
  { id: "data", label: "Data Model" },
  { id: "phases", label: "Build Phases" },
  { id: "done", label: "Definition of Done" },
];

const PHASES = [
  {
    n: 1,
    title: "Foundation",
    color: "#4ade80",
    items: [
      "Electron shell",
      "React renderer + routing",
      "SQLite bootstrap",
      "Project registry",
      "IPC envelope versioning",
      "Basic settings screen",
    ],
    milestone: "App starts, project kan worden aangemaakt en geregistreerd",
  },
  {
    n: 2,
    title: "Project Lifecycle + Health",
    color: "#60a5fa",
    items: [
      "Create / import project wizard",
      "Template generation",
      "Project open flow",
      "Health checks (Node, npm, Playwright)",
      "Playwright version compatibility detection",
      "Health Panel in dashboard",
    ],
    milestone: "Project importeren, health checks zien, Force Run escape aanwezig",
  },
  {
    n: 3,
    title: "Explorer Foundation",
    color: "#f472b6",
    items: [
      "chokidar file watching",
      "ProjectIndexService (memory cache + invalidatie strategie)",
      "File tree rendering",
      "Test file detection (*.spec.ts, *.test.ts)",
      "Basale testcase extractie (best effort)",
      "Parse warnings in detail pane",
    ],
    milestone: "Explorer toont live tree die refresht bij bestandswijzigingen",
  },
  {
    n: 4,
    title: "Run Engine ← vroeg valideren",
    color: "#fb923c",
    items: [
      "CLI command builder (--reporter=json vast)",
      "Single active run via child_process.spawn()",
      "Log streaming naar bestand",
      "Optionele live logs in UI",
      "Run history in SQLite",
      "Run detail screen (basics)",
      "Cancel + rerun",
    ],
    milestone: "Één test file runnen, exit code + log zien — PoC parallel aan Phase 3",
  },
  {
    n: 5,
    title: "Artifact Layer",
    color: "#a78bfa",
    items: [
      "Artifact indexering na run",
      "Per-file artifact policy (screenshot/trace/video)",
      "Project-level default + file override",
      "Report linking (HTML report openen)",
      "Rerun failed tests",
      "Run detail: artifacts tabblad",
    ],
    milestone: "Artifacts instelbaar per bestand, direct toegankelijk vanuit run detail",
  },
  {
    n: 6,
    title: "Environments + Secrets + Recorder",
    color: "#34d399",
    items: [
      "Environment JSON management (environments/*.json)",
      "SecretsService via OS keychain (keytar)",
      "secretRefs patroon in environment files",
      "Tijdelijke run overrides",
      "Recorder / codegen flow starten",
      "Opname opslaan naar projectmap",
    ],
    milestone: "Environment met versleuteld secret ophalen in run, recording opslaan",
  },
  {
    n: 7,
    title: "Packaging + Polish",
    color: "#fbbf24",
    items: [
      "Windows .exe build via electron-builder",
      "Installer",
      "Error state polish",
      "Cross-platform paden (geen hardcoded Windows paths)",
      "Documentatie",
      "Sample project + contribution guide",
    ],
    milestone: "PW Studio v1 installeerbaar als .exe op Windows",
  },
];

const SERVICES = [
  {
    name: "ProjectRegistryService",
    responsibility: "Welke projecten zijn bekend. Registry = paden + metadata, geen bronbestanden.",
    key: ["addProject", "importProject", "listProjects", "openProject"],
  },
  {
    name: "ProjectHealthService",
    responsibility: "Controleert of een project bruikbaar is. Blokkeert runs bij error, Force Run escape bij warning.",
    key: ["runHealthChecks", "getLastSnapshot", "checkCompatibility"],
  },
  {
    name: "ProjectTemplateService",
    responsibility: "Genereert nieuwe projectstructuur op schijf incl. playwright.config.ts, pages/, fixtures/.",
    key: ["createFromTemplate", "writeConfig", "generateExampleTests"],
  },
  {
    name: "FileWatchService",
    responsibility: "chokidar watcher per open project. Doet geen parsing — meldt alleen events.",
    key: ["watchProject", "unwatchProject", "onFileEvent"],
  },
  {
    name: "ProjectIndexService",
    responsibility: "Bouwt in-memory explorer tree. V1: volledige rebuild per watcher trigger. V2: AST-based.",
    key: ["buildIndex", "invalidate", "getTree", "getParseWarnings"],
  },
  {
    name: "RunService",
    responsibility: "Eén actieve run tegelijk. CLI-first via child_process.spawn(). --reporter=json als parseerbare output.",
    key: ["startRun", "cancelRun", "rerunRun", "rerunFailed", "buildCommand"],
  },
  {
    name: "ArtifactService",
    responsibility: "Indexeert artifacts na run, koppelt aan testresultaten, beheert bewaarbeleid.",
    key: ["collectArtifacts", "getByRunId", "openArtifact", "cleanupOldRuns"],
  },
  {
    name: "EnvironmentService",
    responsibility: "Laadt environments/*.json, combineert overrides, levert env payload aan RunService.",
    key: ["listEnvironments", "resolveForRun", "mergeOverrides"],
  },
  {
    name: "SecretsService",
    responsibility: "Secrets via OS keychain (keytar). JSON bevat alleen refs. Geen custom encryptie.",
    key: ["setSecret", "getSecret", "deleteSecret", "checkAvailability"],
  },
  {
    name: "RecorderService",
    responsibility: "Start Playwright codegen extern. Één sessie tegelijk. Heropenen beëindigt sessie.",
    key: ["startCodegen", "stopCodegen", "saveOutput", "getStatus"],
  },
];

const SCREENS = [
  { name: "Projects", desc: "Registry, create/import, recent projecten" },
  { name: "Dashboard", desc: "Project summary, health panel, laatste runs, quick actions" },
  { name: "Explorer", desc: "File tree, test nodes, artifact policy editing, run entrypoints" },
  { name: "Recorder", desc: "Codegen flow starten, outputmap kiezen, opname opslaan" },
  { name: "Runs", desc: "History list, actieve run state, filters (status/browser/env)" },
  { name: "Run Detail", desc: "Logs, test results, artifacts, errors, metadata tabs" },
  { name: "Settings", desc: "App defaults, project defaults, browsers, environments" },
];

const PRINCIPLES = [
  {
    title: "Registry, geen centrale opslag",
    body: "De app beheert paden en metadata. Projectmappen worden niet verplaatst. Geïmporteerde projecten blijven op hun locatie.",
    icon: "📋",
  },
  {
    title: "CLI-first execution",
    body: "Runs via child_process.spawn() met Playwright CLI. Stabieler over versies heen, eenvoudiger te debuggen, geen afhankelijkheid van interne API's.",
    icon: "⚡",
  },
  {
    title: "Graceful degradation",
    body: "Filesystem tree werkt altijd. Test file detection werkt meestal. Testcase-extractie mag falen — explorer blijft bruikbaar.",
    icon: "🛡️",
  },
  {
    title: "File watching als fundament",
    body: "chokidar watchers zijn kerninfrastructuur. Explorer en dashboard mogen niet stale worden. Watcher meldt events, indexer doet parsing.",
    icon: "👁️",
  },
  {
    title: "Security via OS secure storage",
    body: "Secrets via OS keychain (keytar). JSON-bestanden bevatten alleen secretRefs. Geen custom encryptie, geen plaintext fallback.",
    icon: "🔐",
  },
  {
    title: "Vroeg risico valideren",
    body: "Run engine PoC parallel aan Explorer Phase 3. Log streaming, exit codes en JSON reporter output valideren vóór het product 'af' is.",
    icon: "🧪",
  },
];

export default function App() {
  const [active, setActive] = useState("vision");
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [expandedService, setExpandedService] = useState(null);

  return (
    <div style={{
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
      background: "#0d0d0d",
      minHeight: "100vh",
      color: "#e8e8e0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e1e1e",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "#0d0d0d",
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32,
            background: "#c8f542",
            borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#0d0d0d",
          }}>PW</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", color: "#c8f542" }}>PW STUDIO</div>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em" }}>V1 PRODUCT PLAN</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActive(n.id)} style={{
              background: active === n.id ? "#1a1a1a" : "transparent",
              border: active === n.id ? "1px solid #2a2a2a" : "1px solid transparent",
              color: active === n.id ? "#c8f542" : "#666",
              padding: "5px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              letterSpacing: "0.08em",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}>{n.label.toUpperCase()}</button>
          ))}
        </nav>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px" }}>

        {/* VISION */}
        {active === "vision" && (
          <div>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: "#c8f542", letterSpacing: "0.15em", marginBottom: 12 }}>PRODUCTDOEL</div>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>
                Playwright bruikbaarder<br />via een GUI
              </h1>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.8, maxWidth: 600, margin: 0 }}>
                PW Studio v1 is een lokale Electron desktop-app die Playwright Test omhult met een visuele shell.
                Geen alternatief voor Playwright — een orchestratielaag eromheen.
                Lokaal-first, open-source klaar, zonder Playwright te forken.
              </p>
            </div>

            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", marginBottom: 20 }}>KERNPRINCIPES</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 48 }}>
              {PRINCIPLES.map((p, i) => (
                <div key={i} style={{
                  background: "#111",
                  border: "1px solid #1e1e1e",
                  borderRadius: 6,
                  padding: "20px 20px",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{p.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e0", marginBottom: 6 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>{p.body}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", marginBottom: 20 }}>SCHERMEN V1</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {SCREENS.map((s, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 20,
                  padding: "12px 0",
                  borderBottom: "1px solid #181818",
                }}>
                  <div style={{ fontSize: 11, color: "#c8f542", width: 100, flexShrink: 0 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCOPE */}
        {active === "scope" && (
          <div>
            <div style={{ fontSize: 11, color: "#c8f542", letterSpacing: "0.15em", marginBottom: 24 }}>V1 SCOPE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: "0.1em", marginBottom: 16 }}>✓ IN SCOPE</div>
                {[
                  "Electron desktop shell",
                  "Project registry (paden + metadata)",
                  "Nieuwe projecten aanmaken",
                  "Bestaande projecten importeren",
                  "Project health checks",
                  "Playwright versie compatibiliteit",
                  "File watching (chokidar)",
                  "Explorer: folders, files, testcases",
                  "Single active run",
                  "CLI command builder (--reporter=json)",
                  "Optionele live log streaming",
                  "Run history",
                  "Run detail + artifact tabs",
                  "Per-file artifact policy",
                  "Environments als JSON",
                  "Secrets via OS keychain",
                  "Tijdelijke run overrides",
                  "Recorder/codegen flow",
                  "Windows .exe packaging",
                  "Force run escape bij health error",
                ].map((item, i) => (
                  <div key={i} style={{
                    fontSize: 11,
                    color: "#666",
                    padding: "6px 0",
                    borderBottom: "1px solid #181818",
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                  }}>
                    <span style={{ color: "#4ade80", fontSize: 9 }}>▸</span> {item}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#f87171", letterSpacing: "0.1em", marginBottom: 16 }}>✗ OUT OF SCOPE</div>
                {[
                  "Meerdere parallelle runs",
                  "Plugin system",
                  "AI features (wel architectureel voorbereid)",
                  "Team collaboration",
                  "Cloud sync",
                  "Drag-and-drop builder",
                  "Ingebouwde code editor",
                  "Meerdere package managers (alleen npm)",
                  "Multi-user accounts",
                  "macOS / Linux installer (v1 = Windows)",
                ].map((item, i) => (
                  <div key={i} style={{
                    fontSize: 11,
                    color: "#666",
                    padding: "6px 0",
                    borderBottom: "1px solid #181818",
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                  }}>
                    <span style={{ color: "#f87171", fontSize: 9 }}>▸</span> {item}
                  </div>
                ))}
                <div style={{
                  marginTop: 24,
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: 6,
                  padding: 16,
                }}>
                  <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 8 }}>⚠ Bewuste technische schuld v1</div>
                  <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>
                    logPath als bestandspad (geen log-search).<br />
                    Volledige index rebuild per watcher trigger.<br />
                    Testcase extractie via regex, niet AST.<br />
                    Alleen project + file level artifact policies.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARCHITECTURE */}
        {active === "architecture" && (
          <div>
            <div style={{ fontSize: 11, color: "#c8f542", letterSpacing: "0.15em", marginBottom: 24 }}>ARCHITECTUURLAGEN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
              {[
                { label: "A. Electron Main Process", color: "#fb923c", desc: "App lifecycle, filesystem, subprocess management, watchers, SQLite, keychain, IPC handlers" },
                { label: "B. Renderer Process", color: "#60a5fa", desc: "React UI: schermen, forms, explorer, run status, settings, artifact views" },
                { label: "C. Domain Services", color: "#a78bfa", desc: "Node/TS services in main layer: 10 services met duidelijke boundaries" },
                { label: "D. Playwright Workspace", color: "#4ade80", desc: "Echte projectmappen op schijf. Playwright = source of truth voor execution." },
              ].map((l, i) => (
                <div key={i} style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  background: "#111", border: "1px solid #1e1e1e",
                  borderLeft: `3px solid ${l.color}`,
                  borderRadius: "0 6px 6px 0", padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: l.color, width: 200, flexShrink: 0, fontWeight: 700 }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{l.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", marginBottom: 20 }}>DOMAIN SERVICES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SERVICES.map((s, i) => (
                <div key={i} style={{
                  background: expandedService === i ? "#141414" : "#0f0f0f",
                  border: "1px solid",
                  borderColor: expandedService === i ? "#2a2a2a" : "#181818",
                  borderRadius: 6,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }} onClick={() => setExpandedService(expandedService === i ? null : i)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                    <div style={{ fontSize: 12, color: "#c8f542", fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "#333" }}>{expandedService === i ? "▲" : "▼"}</div>
                  </div>
                  {expandedService === i && (
                    <div style={{ padding: "0 16px 16px" }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 12, lineHeight: 1.7 }}>{s.responsibility}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {s.key.map((k, j) => (
                          <span key={j} style={{
                            background: "#1a1a1a", border: "1px solid #2a2a2a",
                            borderRadius: 4, padding: "3px 8px",
                            fontSize: 10, color: "#60a5fa", fontFamily: "inherit",
                          }}>{k}()</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DATA MODEL */}
        {active === "data" && (
          <div>
            <div style={{ fontSize: 11, color: "#c8f542", letterSpacing: "0.15em", marginBottom: 24 }}>DATABASE SCHEMA V1 — SQLITE</div>
            {[
              {
                table: "projects",
                color: "#4ade80",
                fields: [
                  { name: "id", type: "string", note: "UUID" },
                  { name: "name", type: "string", note: "" },
                  { name: "rootPath", type: "string", note: "Absoluut pad op schijf" },
                  { name: "source", type: "'created' | 'imported'", note: "" },
                  { name: "createdAt / updatedAt", type: "string", note: "ISO 8601" },
                  { name: "lastOpenedAt", type: "string?", note: "" },
                  { name: "defaultBrowser", type: "string?", note: "chromium | firefox | webkit" },
                  { name: "activeEnvironment", type: "string?", note: "" },
                ],
              },
              {
                table: "project_health_snapshots",
                color: "#fb923c",
                fields: [
                  { name: "projectId", type: "string", note: "FK → projects" },
                  { name: "checkedAt", type: "string", note: "ISO 8601" },
                  { name: "status", type: "'healthy' | 'warning' | 'error'", note: "" },
                  { name: "payloadJson", type: "string", note: "Volledige check output" },
                ],
              },
              {
                table: "runs",
                color: "#60a5fa",
                fields: [
                  { name: "id", type: "string", note: "UUID" },
                  { name: "projectId", type: "string", note: "FK → projects" },
                  { name: "status", type: "'queued' | 'running' | 'passed' | 'failed' | 'cancelled'", note: "" },
                  { name: "startedAt / finishedAt", type: "string", note: "" },
                  { name: "targetType", type: "'all' | 'folder' | 'file' | 'test'", note: "" },
                  { name: "targetPath / testTitleFilter", type: "string?", note: "" },
                  { name: "browser / environmentName", type: "string", note: "" },
                  { name: "overridesJson", type: "string?", note: "Tijdelijke overrides" },
                  { name: "command", type: "string", note: "Volledige CLI command" },
                  { name: "logPath / reportPath / resultsPath", type: "string?", note: "resultsPath = JSON reporter output" },
                ],
              },
              {
                table: "run_test_results",
                color: "#a78bfa",
                fields: [
                  { name: "id / runId", type: "string", note: "" },
                  { name: "filePath / testTitle", type: "string", note: "" },
                  { name: "status", type: "'passed' | 'failed' | 'skipped' | 'timedOut'", note: "" },
                  { name: "durationMs / retryCount", type: "number?", note: "" },
                  { name: "errorMessage", type: "string?", note: "" },
                  { name: "tracePath / screenshotPath / videoPath", type: "string?", note: "" },
                ],
              },
              {
                table: "file_artifact_policies",
                color: "#34d399",
                fields: [
                  { name: "id / projectId", type: "string", note: "" },
                  { name: "filePath", type: "string", note: "'*' = project default" },
                  { name: "screenshotMode", type: "'off' | 'on-failure' | 'always'", note: "" },
                  { name: "traceMode", type: "'off' | 'on-failure' | 'always'", note: "" },
                  { name: "videoMode", type: "'off' | 'on-failure' | 'always'", note: "" },
                  { name: "updatedAt", type: "string", note: "Resolution: file → project default" },
                ],
              },
            ].map((t, i) => (
              <div key={i} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: t.color, fontWeight: 700, marginBottom: 10, letterSpacing: "0.05em" }}>
                  TABLE: {t.table}
                </div>
                <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, overflow: "hidden" }}>
                  {t.fields.map((f, j) => (
                    <div key={j} style={{
                      display: "grid",
                      gridTemplateColumns: "200px 260px 1fr",
                      gap: 16,
                      padding: "8px 16px",
                      borderBottom: j < t.fields.length - 1 ? "1px solid #181818" : "none",
                      alignItems: "baseline",
                    }}>
                      <div style={{ fontSize: 11, color: "#e8e8e0" }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: "#60a5fa", fontFamily: "inherit" }}>{f.type}</div>
                      <div style={{ fontSize: 10, color: "#444" }}>{f.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PHASES */}
        {active === "phases" && (
          <div>
            <div style={{ fontSize: 11, color: "#c8f542", letterSpacing: "0.15em", marginBottom: 8 }}>BUILD VOLGORDE</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 32 }}>
              Run engine PoC parallel aan Phase 3 — vroeg risico valideren.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PHASES.map((p, i) => (
                <div key={i} style={{
                  background: expandedPhase === i ? "#141414" : "#0f0f0f",
                  border: "1px solid",
                  borderColor: expandedPhase === i ? "#2a2a2a" : "#181818",
                  borderLeft: `3px solid ${p.color}`,
                  borderRadius: "0 6px 6px 0",
                  overflow: "hidden",
                  cursor: "pointer",
                }} onClick={() => setExpandedPhase(expandedPhase === i ? null : i)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "#1a1a1a", border: `1px solid ${p.color}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, color: p.color, flexShrink: 0,
                    }}>{p.n}</div>
                    <div style={{ fontSize: 12, color: "#e8e8e0", fontWeight: 700, flex: 1 }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: "#333" }}>{expandedPhase === i ? "▲" : "▼"}</div>
                  </div>
                  {expandedPhase === i && (
                    <div style={{ padding: "0 16px 16px", paddingLeft: 56 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {p.items.map((item, j) => (
                          <div key={j} style={{ fontSize: 11, color: "#666", display: "flex", gap: 8 }}>
                            <span style={{ color: p.color, fontSize: 9 }}>▸</span> {item}
                          </div>
                        ))}
                      </div>
                      <div style={{
                        background: "#0d0d0d",
                        border: `1px solid ${p.color}22`,
                        borderRadius: 4, padding: "10px 12px",
                      }}>
                        <span style={{ fontSize: 10, color: p.color }}>✓ Milestone: </span>
                        <span style={{ fontSize: 10, color: "#888" }}>{p.milestone}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEFINITION OF DONE */}
        {active === "done" && (
          <div>
            <div style={{ fontSize: 11, color: "#c8f542", letterSpacing: "0.15em", marginBottom: 8 }}>DEFINITION OF DONE — V1</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 32 }}>
              PW Studio v1 is klaar wanneer een gebruiker alle onderstaande acties succesvol kan uitvoeren.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { n: "01", text: "Een nieuw project aanmaken via wizard (naam, map, browsers, auth optie, voorbeeld tests)", sub: "ProjectTemplateService + wizard UI" },
                { n: "02", text: "Een bestaand Playwright-project importeren door een map te kiezen", sub: "ProjectRegistryService + import flow" },
                { n: "03", text: "Direct zien of het project gezond is (Node, npm, Playwright, browsers)", sub: "ProjectHealthService + Health Panel" },
                { n: "04", text: "Tests zien in een explorer met folders, files en waar mogelijk testcases", sub: "FileWatchService + ProjectIndexService" },
                { n: "05", text: "Explorer refresht live bij bestandswijzigingen", sub: "chokidar events → indexer invalidatie" },
                { n: "06", text: "Een test/file/folder/all runnen, exit code en log terugzien", sub: "RunService + CLI command builder" },
                { n: "07", text: "Logs en testresultaten per run terugkijken in run detail", sub: "Run history + run_test_results" },
                { n: "08", text: "Artifacts (screenshot/trace/video) per bestand instellen en direct openen", sub: "ArtifactService + file_artifact_policies" },
                { n: "09", text: "Environments met variabelen en versleutelde secrets beheren", sub: "EnvironmentService + SecretsService (keytar)" },
                { n: "10", text: "Bij een run tijdelijk overrides meegeven (baseURL, env vars, headed)", sub: "RunRequest.overrides" },
                { n: "11", text: "Codegen starten en de opname opslaan naar het project", sub: "RecorderService" },
                { n: "12", text: "De app installeren als Windows .exe via een installer", sub: "electron-builder packaging" },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  background: "#111", border: "1px solid #1e1e1e",
                  borderRadius: 6, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: "#c8f542", width: 24, flexShrink: 0, opacity: 0.5 }}>{item.n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#e8e8e0", marginBottom: 4 }}>{item.text}</div>
                    <div style={{ fontSize: 10, color: "#444" }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 32, background: "#111",
              border: "1px solid #2a2a2a",
              borderLeft: "3px solid #c8f542",
              borderRadius: "0 6px 6px 0", padding: "20px 20px 20px 20px",
            }}>
              <div style={{ fontSize: 11, color: "#c8f542", marginBottom: 8, letterSpacing: "0.1em" }}>EERSTE MILESTONE</div>
              <div style={{ fontSize: 13, color: "#e8e8e0", lineHeight: 1.7 }}>
                "Open imported Playwright project, pass health checks, show live explorer that refreshes on file changes — <em style={{ color: "#c8f542" }}>en draai één test file, zie exit code en log.</em>"
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
