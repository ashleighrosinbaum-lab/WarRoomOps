"use client";

import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/callback`;
  }, []);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Magic link sent! Check your email.");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #eee", borderRadius: 14, padding: 20 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>WarRoom Ops</h1>
        <p style={{ marginTop: 0, color: "#555" }}>Login with a magic link. No passwords.</p>

        <form onSubmit={sendMagicLink} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@example.com"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <button
            type="submit"
            disabled={status === "sending"}
            style={{ padding: 12, borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {status === "sending" ? "Sending..." : "Send magic link"}
          </button>

          {message ? (
            <p style={{ margin: 0, color: status === "error" ? "#b00020" : "#0a7a2f" }}>{message}</p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
