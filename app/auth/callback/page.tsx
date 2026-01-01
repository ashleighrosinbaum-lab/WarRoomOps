"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const url = window.location.href;
      const code = new URL(url).searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login?error=No%20session%20found");
        return;
      }

      router.replace("/app");
    })();
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <p>Signing you in…</p>
    </main>
  );
}
