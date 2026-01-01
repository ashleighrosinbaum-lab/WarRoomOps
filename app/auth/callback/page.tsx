"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        // This ensures Supabase stores the session after the magic-link redirect
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setMsg(`Sign-in error: ${error.message}`);
          return;
        }

        if (data.session) {
          router.replace("/app");
          return;
        }

        // If session isn't ready yet, wait briefly and try once more
        setTimeout(async () => {
          const again = await supabase.auth.getSession();
          if (again.data.session) {
            router.replace("/app");
          } else {
            const e =
              params.get("error_description") ||
              params.get("error") ||
              "No session was created.";
            setMsg(`Sign-in didn’t complete. ${e}`);
          }
        }, 800);
      } catch (e: any) {
        setMsg(`Unexpected error: ${e?.message ?? String(e)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>WarRoom Ops</h1>
      <p>{msg}</p>
    </div>
  );
}
