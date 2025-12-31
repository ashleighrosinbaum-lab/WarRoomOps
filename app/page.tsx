export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>WarRoom Ops</h1>
        <a href="/login" style={{ textDecoration: "none", border: "1px solid #ddd", padding: "8px 12px", borderRadius: 10 }}>
          Login
        </a>
      </div>
      <p style={{ color: "#555" }}>
        Alliance performance + leadership ops — VS, tech, events, roles, and audit trail.
      </p>
    </main>
  );
}
