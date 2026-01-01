"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AppPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) router.replace("/login");
      else setEmail(user.email ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>WarRoom Ops — App</h1>
      <p>Signed in as: <b>{email || "…"}</b></p>
      <p>✅ App route is working again.</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/");
        }}
        style={{ padding: "10px 14px", borderRadius: 8 }}
      >
        Log out
      </button>
    </div>
  );
}
