"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Membership = {
  alliance_id: string;
  role: "R5" | "R4" | "R3" | "R2" | "R1";
  is_disabled: boolean;
};

type Alliance = { id: string; name: string };

type Player = {
  id: string;
  name: string;
  hq_level: number | null;
  is_active: boolean;
};

type VsEntryRowRaw = {
  id: string;
  score: number;
  game_day: string; // YYYY-MM-DD
  players: { name: string } | { name: string }[] | null;
};

type VsEntryRow = {
  id: string;
  score: number;
  game_day: string;
  player_name: string;
};

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AppHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState<string>("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [alliance, setAlliance] = useState<Alliance | null>(null);

  // Setup / join
  const [allianceName, setAllianceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [statusMsg, setStatusMsg] = useState<string>("");

  // In-alliance tools
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerHq, setNewPlayerHq] = useState<string>("");

  const [gameDay, setGameDay] = useState(todayISO());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [vsScore, setVsScore] = useState<string>("");
  const [vsRows, setVsRows] = useState<VsEntryRow[]>([]);
  const [weekStart, setWeekStart] = useState<string>(() => todayISO());
  const [weekType, setWeekType] = useState<"save" | "push">("save");

  const canOfficer = useMemo(
    () => membership?.role === "R5" || membership?.role === "R4",
    [membership]
  );

  const MIN_DAILY = 7200000;

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.replace("/login");
        return;
      }
      setUserEmail(userData.user.email ?? "");
      await loadMembershipAndAlliance(userData.user.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMembershipAndAlliance(userId: string) {
    setStatusMsg("");

    const { data: mem, error: memErr } = await supabase
      .from("alliance_members")
      .select("alliance_id, role, is_disabled")
      .eq("user_id", userId)
      .eq("is_disabled", false)
      .maybeSingle();

    if (memErr || !mem) {
      setMembership(null);
      setAlliance(null);
      return;
    }

    setMembership(mem as Membership);

    const { data: a, error: aErr } = await supabase
      .from("alliances")
      .select("id, name")
      .eq("id", mem.alliance_id)
      .single();

    if (aErr || !a) {
      setAlliance(null);
      return;
    }

    setAlliance(a as Alliance);

    await Promise.all([loadPlayers(mem.alliance_id), loadVsForDay(mem.alliance_id, gameDay)]);
  }

  async function loadPlayers(allianceId: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, hq_level, is_active")
      .eq("alliance_id", allianceId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!error) {
      const list = (data ?? []) as Player[];
      setPlayers(list);
      if (list.length && !selectedPlayerId) setSelectedPlayerId(list[0].id);
    }
  }

  async function loadVsForDay(allianceId: string, day: string) {
    const { data, error } = await supabase
      .from("vs_entries")
      .select("id, score, game_day, players(name)")
      .eq("alliance_id", allianceId)
      .eq("game_day", day)
      .order("score", { ascending: false });

    if (error) return;

    const raw = (data ?? []) as VsEntryRowRaw[];

    const normalized: VsEntryRow[] = raw.map((r) => {
      const p = r.players;
      const name =
        !p ? "Unknown" :
        Array.isArray(p) ? (p[0]?.name ?? "Unknown") :
        (p.name ?? "Unknown");

      return {
        id: r.id,
        score: Number(r.score),
        game_day: r.game_day,
        player_name: name,
      };
    });

    setVsRows(normalized);
  }

  async function handleCreateAlliance() {
    setStatusMsg("");
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    if (!u) return router.replace("/login");

    const name = allianceName.trim();
    if (!name) return setStatusMsg("Enter an alliance name.");

    const { data: a, error: aErr } = await supabase
      .from("alliances")
      .insert({ name, created_by: u.id })
      .select("id, name")
      .single();

    if (aErr || !a) return setStatusMsg(aErr?.message ?? "Failed to create alliance.");

    const { error: mErr } = await supabase.from("alliance_members").insert({
      alliance_id: a.id,
      user_id: u.id,
      role: "R5",
    });

    if (mErr) return setStatusMsg(mErr.message);

    setAllianceName("");
    await loadMembershipAndAlliance(u.id);
  }

  async function handleJoinAlliance() {
    setStatusMsg("");
    const code = inviteCode.trim().toUpperCase();
    if (!code) return setStatusMsg("Enter an invite code.");

    const { error } = await supabase.rpc("redeem_invite", { p_code: code });
    if (error) return setStatusMsg(error.message);

    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) await loadMembershipAndAlliance(userData.user.id);

    setInviteCode("");
  }

  async function handleCreateInvite() {
    if (!membership || !alliance) return;
    if (!canOfficer) return setStatusMsg("Only R5/R4 can create invites.");

    setStatusMsg("");

    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    if (!u) return router.replace("/login");

    const code = randomCode(8);

    const { error } = await supabase.from("alliance_invites").insert({
      alliance_id: membership.alliance_id,
      code,
      created_by: u.id,
      max_uses: 1,
    });

    if (error) return setStatusMsg(error.message);

    setStatusMsg(`Invite code created: ${code} (single-use)`);
  }

  async function handleAddPlayer() {
    if (!membership || !canOfficer) return setStatusMsg("Only R5/R4 can add players.");
    setStatusMsg("");

    const name = newPlayerName.trim();
    if (!name) return setStatusMsg("Enter a player name.");

    const hq = newPlayerHq.trim() ? Number(newPlayerHq.trim()) : null;
    if (newPlayerHq.trim() && Number.isNaN(hq)) return setStatusMsg("HQ level must be a number.");

    const { error } = await supabase.from("players").insert({
      alliance_id: membership.alliance_id,
      name,
      hq_level: hq,
    });

    if (error) return setStatusMsg(error.message);

    setNewPlayerName("");
    setNewPlayerHq("");
    await loadPlayers(membership.alliance_id);
    setStatusMsg(`Added player: ${name}`);
  }

  async function handleSaveWeekType() {
    if (!membership || !canOfficer) return setStatusMsg("Only R5/R4 can set week type.");
    if (!weekStart) return setStatusMsg("Pick a week start date.");

    const { error } = await supabase.from("vs_weeks").upsert({
      alliance_id: membership.alliance_id,
      week_start: weekStart,
      week_type: weekType,
      grace_days: 2,
    });

    if (error) return setStatusMsg(error.message);
    setStatusMsg(`Saved week type: ${weekType.toUpperCase()} for week starting ${weekStart}`);
  }

  async function handleSaveVs() {
    if (!membership || !canOfficer) return setStatusMsg("Only R5/R4 can enter VS scores.");
    setStatusMsg("");

    if (!selectedPlayerId) return setStatusMsg("Select a player.");
    if (!gameDay) return setStatusMsg("Pick a date.");
    const scoreNum = Number(vsScore.trim());
    if (!vsScore.trim() || Number.isNaN(scoreNum)) return setStatusMsg("Enter a numeric VS score.");

    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    if (!u) return router.replace("/login");

    const { error } = await supabase.from("vs_entries").upsert({
      alliance_id: membership.alliance_id,
      player_id: selectedPlayerId,
      game_day: gameDay,
      score: scoreNum,
      created_by: u.id,
    });

    if (error) return setStatusMsg(error.message);

    setVsScore("");
    await loadVsForDay(membership.alliance_id, gameDay);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  // Not in an alliance yet
  if (!membership || !alliance) {
    return (
      <div style={{ padding: 24, maxWidth: 760 }}>
        <h1 style={{ marginBottom: 4 }}>WarRoom Ops</h1>
        <div style={{ marginBottom: 16, opacity: 0.85 }}>
          Signed in as: <b>{userEmail}</b>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Create an Alliance</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={allianceName}
                onChange={(e) => setAllianceName(e.target.value)}
                placeholder="Alliance name"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", flex: "1 1 260px" }}
              />
              <button onClick={handleCreateAlliance} style={{ padding: "10px 14px", borderRadius: 8 }}>
                Create
              </button>
            </div>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Join with Invite Code</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Invite code (e.g., ABCD1234)"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", flex: "1 1 260px" }}
              />
              <button onClick={handleJoinAlliance} style={{ padding: "10px 14px", borderRadius: 8 }}>
                Join
              </button>
            </div>
          </div>

          {statusMsg ? (
            <div style={{ padding: 12, borderRadius: 10, background: "#fff6d6", border: "1px solid #f0d98a" }}>
              {statusMsg}
            </div>
          ) : null}

          <button onClick={handleLogout} style={{ padding: "10px 14px", borderRadius: 8, width: 120 }}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  // In an alliance
  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ marginBottom: 4 }}>WarRoom Ops</h1>
      <div style={{ marginBottom: 6, opacity: 0.85 }}>
        Signed in as: <b>{userEmail}</b>
      </div>
      <div style={{ marginBottom: 16, opacity: 0.9 }}>
        Alliance: <b>{alliance.name}</b> • Role: <b>{membership.role}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Invite-only onboarding</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={handleCreateInvite}
              disabled={!canOfficer}
              style={{ padding: "10px 14px", borderRadius: 8, opacity: canOfficer ? 1 : 0.5 }}
            >
              Create single-use invite code
            </button>
            <div style={{ fontSize: 13, opacity: 0.85, alignSelf: "center" }}>(R5/R4 only)</div>
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Week type (Save vs Push)</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 14 }}>
              Week start:
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                style={{ marginLeft: 8, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </label>

            <select
              value={weekType}
              onChange={(e) => setWeekType(e.target.value as any)}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
              disabled={!canOfficer}
            >
              <option value="save">Save week</option>
              <option value="push">Push week</option>
            </select>

            <button
              onClick={handleSaveWeekType}
              disabled={!canOfficer}
              style={{ padding: "10px 14px", borderRadius: 8, opacity: canOfficer ? 1 : 0.5 }}
            >
              Save
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            Daily minimum rule is always <b>7.2m</b>. Rewards logic comes next.
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Players</h2>

          {!canOfficer ? (
            <div style={{ fontSize: 13, opacity: 0.85 }}>Only R5/R4 can add players in MVP.</div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", flex: "1 1 260px" }}
              />
              <input
                value={newPlayerHq}
                onChange={(e) => setNewPlayerHq(e.target.value)}
                placeholder="HQ level (optional)"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", width: 180 }}
              />
              <button onClick={handleAddPlayer} style={{ padding: "10px 14px", borderRadius: 8 }}>
                Add
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 14 }}>
            Active players: <b>{players.length}</b>
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>VS Daily Entry</h2>

          {!canOfficer ? (
            <div style={{ fontSize: 13, opacity: 0.85 }}>Only R5/R4 can enter scores in MVP.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: 14 }}>
                  Game day:
                  <input
                    type="date"
                    value={gameDay}
                    onChange={async (e) => {
                      const d = e.target.value;
                      setGameDay(d);
                      await loadVsForDay(membership.alliance_id, d);
                    }}
                    style={{ marginLeft: 8, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
                  />
                </label>

                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", minWidth: 220 }}
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.hq_level ? ` (HQ ${p.hq_level})` : ""}
                    </option>
                  ))}
                </select>

                <input
                  value={vsScore}
                  onChange={(e) => setVsScore(e.target.value)}
                  placeholder="VS score (e.g., 7200000)"
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", width: 220 }}
                />

                <button onClick={handleSaveVs} style={{ padding: "10px 14px", borderRadius: 8 }}>
                  Save
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                Minimum target: <b>{MIN_DAILY.toLocaleString()}</b> daily.
              </div>
            </>
          )}

          <div style={{ marginTop: 14 }}>
            <h3 style={{ margin: "10px 0" }}>Entries for {gameDay}</h3>
            {vsRows.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.85 }}>No entries yet.</div>
            ) : (
              <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                {vsRows.map((r, idx) => {
                  const ok = r.score >= MIN_DAILY;
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "10px 12px",
                        borderTop: idx === 0 ? "none" : "1px solid #eee",
                        background: ok ? "#f3fff4" : "#fff3f3",
                      }}
                    >
                      <div>
                        <b>{r.player_name}</b>
                      </div>
                      <div style={{ whiteSpace: "nowrap" }}>
                        {Number(r.score).toLocaleString()} {ok ? "✅" : "⚠️"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {statusMsg ? (
          <div style={{ padding: 12, borderRadius: 10, background: "#fff6d6", border: "1px solid #f0d98a" }}>
            {statusMsg}
          </div>
        ) : null}

        <button onClick={handleLogout} style={{ padding: "10px 14px", borderRadius: 8, width: 120 }}>
          Log out
        </button>
      </div>
    </div>
  );
}
