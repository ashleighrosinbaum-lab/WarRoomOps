"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AppHome() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? "");
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>WarRoom Ops</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Signed in as: <b>{email || "…"}</b>
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 10, maxWidth: 720 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Next up</h2>
          <ul style={{ marginBottom: 0 }}>
            <li>Alliance setup (create/join)</li>
            <li>VS daily entry (7.2m minimum)</li>
            <li>Tech donations (daily + weekly)</li>
            <li>Screenshot upload + archive</li>
            <li>Leadership Ops task board</li>
          </ul>
        </div>

        <button onClick={logout} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer", width: 160 }}>
          Log out
        </button>
      </div>
    </main>
  );
}
