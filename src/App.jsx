import { useEffect, useState } from "react";

function App() {
  const [username, setUsername] = useState("2Jar");
  const [userId, setUserId] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedCombined, setSelectedCombined] = useState(false);
  const [selectedCombinedLeagues, setSelectedCombinedLeagues] = useState([]);
  const [matchupData, setMatchupData] = useState([]);
  const [combinedMine, setCombinedMine] = useState([]);
  const [combinedOpp, setCombinedOpp] = useState([]);
  const [combinedSummaries, setCombinedSummaries] = useState([]);
  const [playerMap, setPlayerMap] = useState({});
  const [userMap, setUserMap] = useState({});
  const [activeWeek, setActiveWeek] = useState(null);

  // Dark mode (default ON unless user saved preference)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem("ff_dark");
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("ff_dark", darkMode ? "1" : "0");
    } catch {}
  }, [darkMode]);

  // Colors
  const getColors = (dark) => ({
    border: dark ? "#374151" : "#ccc",
    divider: dark ? "#374151" : "#e5e7eb",
    borderMuted: dark ? "#4b5563" : "#d1d5db",
    textMuted: dark ? "#9CA3AF" : "#374151",
    placeholder: dark ? "#9CA3AF" : "#6B7280",
    highlight: dark ? "#1f2937" : "#eef2ff",
    panelBg: dark ? "#0b0f1a" : "#fafafa",
    appBg: dark ? "#111827" : "#ffffff",
    text: dark ? "#e5e7eb" : "#111827",
    buttonBg: dark ? "#374151" : "#e5e7eb",
    buttonText: dark ? "#e5e7eb" : "#111827",
    cardBg: dark ? "#0f172a" : "#ffffff",
  });
  const COLORS = getColors(darkMode);
  const BORDER = `1px solid ${COLORS.border}`;
  const DIVIDER = `1px solid ${COLORS.divider}`;
  const BORDER_MUTED = `1px solid ${COLORS.borderMuted}`;

  // scheduleMap: { KC: { opponent:"DEN", startTime:"...", state:"pre|in|post" }, ... }
  const [scheduleMap, setScheduleMap] = useState({});

  const currentYear = new Date().getFullYear();
  const ROW_HEIGHT = 28;

  // Normalize ESPN team codes to Sleeper's
  const ESPN_TO_SLEEPER = { WSH: "WAS" };
  // ESPN logo slugs that differ from Sleeper's code
  const LOGO_SLUG = { WAS: "wsh" };

  // Default Combined selection is all leagues
  useEffect(() => {
    if (leagues.length) {
      setSelectedCombinedLeagues(leagues.map((l) => l.league_id));
    }
  }, [leagues]);

  // Fetch current NFL week
  useEffect(() => {
    async function fetchCurrentWeek() {
      try {
        const res = await fetch("https://api.sleeper.app/v1/state/nfl");
        const data = await res.json();
        setActiveWeek(data.week);
      } catch (err) {
        console.error("Failed to fetch current NFL week:", err);
        setActiveWeek(1);
      }
    }
    fetchCurrentWeek();
  }, []);

  // Fetch schedule for the active week (ESPN) with game state
  useEffect(() => {
    if (!activeWeek) return;
    async function fetchSchedule() {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${activeWeek}`
        );
        const js = await res.json();
        const map = {};
        (js.events || []).forEach((game) => {
          const comps = game.competitions?.[0]?.competitors || [];
          if (comps.length >= 2) {
            const teamAraw = comps[0].team.abbreviation;
            const teamBraw = comps[1].team.abbreviation;
            const teamA = ESPN_TO_SLEEPER[teamAraw] || teamAraw;
            const teamB = ESPN_TO_SLEEPER[teamBraw] || teamBraw;
            const startTime = game.date;
            const st = game.competitions?.[0]?.status?.type || game.status?.type || {};
            const state = (st.state || "pre").toLowerCase(); // "pre" | "in" | "post"
            map[teamA] = { opponent: teamB, startTime, state };
            map[teamB] = { opponent: teamA, startTime, state };
          }
        });
        setScheduleMap(map);
      } catch (err) {
        console.error("Failed to fetch schedule:", err);
        setScheduleMap({});
      }
    }
    fetchSchedule();
  }, [activeWeek]);

  // Fetch user ID from username
  useEffect(() => {
    if (!username) return;
    async function fetchUser() {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/user/${username}`);
        const user = await res.json();
        setUserId(user.user_id);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    }
    fetchUser();
  }, [username]);

  // Fetch leagues and user map
  useEffect(() => {
    if (!userId) return;
    async function fetchLeagues() {
      try {
        const res = await fetch(
          `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${currentYear}`
        );
        const data = await res.json();
        setLeagues(data);

        const map = {};
        for (const league of data) {
          const usersRes = await fetch(
            `https://api.sleeper.app/v1/league/${league.league_id}/users`
          );
          const users = await usersRes.json();
          map[league.league_id] = {};
          users.forEach((u) => {
            map[league.league_id][u.user_id] = u.display_name;
          });
        }
        setUserMap(map);
      } catch (err) {
        console.error("Failed to fetch leagues:", err);
      }
    }
    fetchLeagues();
  }, [userId, currentYear]);

  // Fetch players
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch("https://api.sleeper.app/v1/players/nfl");
        const players = await res.json();
        const map = {};
        Object.values(players).forEach((p) => {
          const id = p.player_id;
          map[id] = {
            player_id: id,
            name: p.full_name,
            status: p.injury_status,
            team: p.team,
            position: p.position,
            full_name: p.full_name,
          };
        });
        setPlayerMap(map);
      } catch (err) {
        console.error("Failed to fetch players:", err);
      }
    }
    fetchPlayers();
  }, []);

  // Map a player ID to a player object, include DSTs if missing
  const mapPlayer = (pid) => {
    if (playerMap[pid]) {
      const p = playerMap[pid];
      if (p.position === "DST") {
        const nickname = p.full_name?.split(" ").slice(1).join(" ") || p.team;
        return { ...p, position: "DEF", name: nickname };
      }
      return p;
    }
    if (typeof pid === "string" && pid.startsWith("DST_")) {
      const teamAbbr = pid.split("_")[1];
      return {
        player_id: pid,
        name: `${teamAbbr} Defense`,
        status: null,
        team: teamAbbr,
        position: "DEF",
      };
    }
    return { player_id: pid, name: "Unknown Player", status: null, position: "" };
  };

  // Team logo
  const getTeamLogo = (team) =>
    team
      ? `https://a.espncdn.com/i/teamlogos/nfl/500/${(LOGO_SLUG[team] || team).toLowerCase()}.png`
      : "";

  // Status helpers
  const isPlayerRed = (status) => {
    if (!status) return false;
    const s = status.toUpperCase();
    return s === "OUT" || s === "IR";
  };
  const isPlayerSuspended = (status) => {
    if (!status) return false;
    return status.toUpperCase().includes("SUS");
  };
  const isPlayerYellow = (status) => {
    if (!status) return false;
    const s = status.toUpperCase();
    return s === "Q" || s === "QUESTIONABLE" || s === "DOUBTFUL" || s === "D";
  };
  const normalizeStatus = (status) => {
    if (!status) return "";
    const s = status.toUpperCase();
    if (s === "QUESTIONABLE") return "Q";
    if (s === "DOUBTFUL") return "D";
    if (s.includes("SUS")) return "SUS";
    return status;
  };

  // PT kickoff text
  const formatGameTimePT = (iso) => {
    if (!iso) return "";
    const tz = "America/Los_Angeles";
    const d = new Date(iso);

    const weekdayLong = d.toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "long",
    });

    if (weekdayLong === "Thursday") return "THURS";
    if (weekdayLong === "Monday") return "MONDAY";

    if (weekdayLong === "Sunday") {
      const time24 = d.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const [hStr] = time24.split(":");
      const hour = parseInt(hStr, 10);

      if (hour >= 9 && hour < 11) return "MORNING"; // 9:00–10:59
      if (hour < 9) return "EARLY";
      if (hour >= 12 && hour < 16) return "MIDDAY";
      if (hour >= 16) return "LATE";
    }

    const day = d.toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "short",
    });
    const time = d.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${day} ${time} PT`;
  };

  // Kickoff breakdown order and position order
  const BUCKET_ORDER = ["THURS", "EARLY", "MORNING", "MIDDAY", "LATE", "MONDAY", "OTHER", "TBD"];
  const POS_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

  // Sorting helpers
  const sortPlayersCombined = (arr) =>
    [...(arr || [])].sort((a, b) => {
      const ta = (a?.team || "").toUpperCase();
      const tb = (b?.team || "").toUpperCase();
      if (ta !== tb) return ta.localeCompare(tb);
      const pa = POS_ORDER[a?.position] ?? 999;
      const pb = POS_ORDER[b?.position] ?? 999;
      if (pa !== pb) return pa - pb;
      const na = (a?.name || "").toUpperCase();
      const nb = (b?.name || "").toUpperCase();
      return na.localeCompare(nb);
    });

  const sortPlayersBench = (arr) =>
    [...(arr || [])].sort((a, b) => {
      const pa = POS_ORDER[a?.position] ?? 999;
      const pb = POS_ORDER[b?.position] ?? 999;
      if (pa !== pb) return pa - pb;
      const ta = (a?.team || "").toUpperCase();
      const tb = (b?.team || "").toUpperCase();
      if (ta !== tb) return ta.localeCompare(tb);
      const na = (a?.name || "").toUpperCase();
      const nb = (b?.name || "").toUpperCase();
      return na.localeCompare(nb);
    });

  const getKickoffBucketForPlayer = (p) => {
    if (!p?.team) return "TBD";
    const entry = scheduleMap[p.team];
    if (!entry?.startTime) return "TBD";
    const label = formatGameTimePT(entry.startTime);
    if (["THURS", "EARLY", "MORNING", "MIDDAY", "LATE", "MONDAY"].includes(label)) return label;
    return "OTHER";
  };

  const sortPlayersForBreakdown = (arr) =>
    [...(arr || [])].sort((a, b) => {
      const ra = POS_ORDER[a?.position] ?? 999;
      const rb = POS_ORDER[b?.position] ?? 999;
      if (ra !== rb) return ra - rb;
      const na = (a?.name || "").toUpperCase();
      const nb = (b?.name || "").toUpperCase();
      return na.localeCompare(nb);
    });

  const groupByBucket = (players) => {
    const groups = {};
    BUCKET_ORDER.forEach((b) => (groups[b] = []));
    (players || []).forEach((p) => {
      const b = getKickoffBucketForPlayer(p);
      groups[b].push(p);
    });
    BUCKET_ORDER.forEach((b) => {
      groups[b] = sortPlayersForBreakdown(groups[b]);
    });
    return groups;
  };

  // Placeholder renderer: 15 dashes when the other side has a player in that slot
  const renderPlaceholder = (key, showDashes = false) => (
    <li
      key={key}
      style={{
        listStyle: "none",
        height: ROW_HEIGHT,
        lineHeight: `${ROW_HEIGHT}px`,
        display: "flex",
        alignItems: "center",
        paddingLeft: "16px",
        whiteSpace: "nowrap",
        color: COLORS.placeholder,
        fontFamily: "Menlo, Consolas, monospace",
        fontSize: "13px",
      }}
    >
      {showDashes ? "-".repeat(15) : <span style={{ opacity: 0.25 }}>&nbsp;</span>}
    </li>
  );

  const formatPoints = (pts) =>
    typeof pts === "number" && !Number.isNaN(pts) ? pts.toFixed(2) : "0.00";

  // Byes
  const isTeamOnBye = (team) => !!team && !scheduleMap[team];

  // Active, remaining, done split for starters
  const splitByGameState = (players) => {
    const active = [];
    const remaining = [];
    const done = [];
    (players || []).forEach((p) => {
      if (!p?.team) {
        remaining.push(p);
        return;
      }
      if (isTeamOnBye(p.team)) {
        done.push(p);
        return;
      }
      const entry = scheduleMap[p.team];
      if (!entry?.state) {
        remaining.push(p);
        return;
      }
      const st = entry.state;
      if (st === "in") active.push(p);
      else if (st === "post") done.push(p);
      else remaining.push(p);
    });
    return { active, remaining, done };
  };

  // Player row renderer
  const renderPlayer = (p, opts = {}) => {
    const { showTimeLabel = true, nameSuffix = "", isStarter = true } = opts;
    const oppEntry = p?.team ? scheduleMap[p.team] : null;

    let color = COLORS.text;
    const red = isPlayerRed(p?.status) || isPlayerSuspended(p?.status);
    const yellow = isPlayerYellow(p?.status);
    const bye = isTeamOnBye(p?.team);

    if (red) {
      color = "red";
    } else if (bye) {
      color = "blue";
    } else {
      const isThursday =
        oppEntry?.startTime && formatGameTimePT(oppEntry.startTime) === "THURS";
      if (!isStarter && isThursday) {
        color = "lightblue"; // override yellow, not red
      } else if (yellow) {
        color = "orange";
      }
    }

    const statusText = p.status ? ` - ${normalizeStatus(p.status)}` : "";
    const byeText = bye ? " - Bye" : "";

    const leftLabel =
      p.position === "DEF"
        ? `DEF - ${p.team}${nameSuffix}${byeText}`
        : `${p.position ? p.position + " - " : ""}${p.name}${nameSuffix}${statusText}${byeText}`;

    return (
      <li
        key={p.player_id + Math.random()}
        style={{
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          height: ROW_HEIGHT,
          lineHeight: `${ROW_HEIGHT}px`,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          {p.team && (
            <img
              src={getTeamLogo(p.team)}
              alt={p.team}
              style={{ width: "20px", height: "20px", flexShrink: 0 }}
            />
          )}
          <span style={{ textOverflow: "ellipsis", overflow: "hidden" }}>{leftLabel}</span>
        </div>

        {oppEntry?.opponent && (
          <div
            style={{
              marginLeft: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            {showTimeLabel && (
              <span style={{ fontSize: "12px", color: COLORS.textMuted }}>
                {formatGameTimePT(oppEntry.startTime)}
              </span>
            )}
            <img
              src={getTeamLogo(oppEntry.opponent)}
              alt={oppEntry.opponent}
              style={{ width: "20px", height: "20px" }}
            />
          </div>
        )}
      </li>
    );
  };

  // ===== Metric cell helper (Combined alignment) =====
  function metricCell({ left, right, title, colSpec = "6ch 2ch 6ch" }) {
    const has = left != null && right != null;
    return (
      <div
        style={{
          padding: "6px 8px",
          border: BORDER,
          borderRadius: 6,
          fontSize: 12,
          background: COLORS.cardBg,
          color: COLORS.text,
        }}
        title={title}
      >
        {has ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: colSpec,
              alignItems: "center",
              fontFamily: "Menlo, Consolas, monospace",
            }}
          >
            <span style={{ justifySelf: "end" }}>{left}</span>
            <span style={{ textAlign: "center" }}>-</span>
            <span style={{ justifySelf: "start" }}>{right}</span>
          </div>
        ) : (
          <span>—</span>
        )}
      </div>
    );
  }
  // ===== end helper

  // Fetch matchup data for selected league and week (per-league view)
  const fetchMatchupPlayers = async (league, week) => {
    setSelectedCombined(false);
    setSelectedLeague(league);

    try {
      const rostersRes = await fetch(
        `https://api.sleeper.app/v1/league/${league.league_id}/rosters`
      );
      const rosters = await rostersRes.json();

      const matchupsRes = await fetch(
        `https://api.sleeper.app/v1/league/${league.league_id}/matchups/${week}`
      );
      const matchups = await matchupsRes.json(); // fixed

      const myRoster = rosters.find((r) => r.owner_id === userId);
      if (!myRoster) return;

      const myMatchup = matchups.find((m) => m.roster_id === myRoster.roster_id);
      if (!myMatchup) return;

      const matchupTeams = matchups.filter((m) => m.matchup_id === myMatchup.matchup_id);

      const data = matchupTeams.map((mu) => {
        const roster = rosters.find((r) => r.roster_id === mu.roster_id);
        const owner = roster?.owner_id;
        const ownerName = userMap[league.league_id]?.[owner] || "";
        const displayTeam = { team: ownerName, metadata: roster?.metadata };

        const starters = (roster?.starters || []).map(mapPlayer);

        const benchPlayers = (roster?.players || [])
          .map(mapPlayer)
          .filter((p) => p && !starters.includes(p));

        // bench sections
        const bench = sortPlayersBench(
          benchPlayers.filter((p) => !isPlayerRed(p.status) && !isTeamOnBye(p.team))
        );
        const byePlayers = sortPlayersBench(
          benchPlayers.filter((p) => !isPlayerRed(p.status) && isTeamOnBye(p.team))
        );
        const irPlayers = benchPlayers.filter((p) => isPlayerRed(p.status));

        return {
          displayTeam,
          starters,
          bench,
          byePlayers,
          irPlayers,
          isUser: owner === userId,
          score: typeof mu.points === "number" ? mu.points : 0,
        };
      });

      // Ensure user is always left
      data.sort((a, b) => (a.isUser === b.isUser ? 0 : a.isUser ? -1 : 1));

      setCombinedMine([]);
      setCombinedOpp([]);
      setCombinedSummaries([]);
      setMatchupData(data);
      setActiveWeek(week);
    } catch (err) {
      console.error("Failed to fetch matchup data:", err);
      setMatchupData([]);
    }
  };

  // Fetch combined starters and per-league summaries across all leagues
  const fetchCombinedBreakdown = async (weekParam) => {
    const week = weekParam || activeWeek;
    if (!week) return;
    try {
      const mine = [];
      const opp = [];
      const summaries = [];

      for (const league of leagues) {
        try {
          const [rostersRes, matchupsRes] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`),
            fetch(`https://api.sleeper.app/v1/league/${league.league_id}/matchups/${week}`),
          ]);
          const rosters = await rostersRes.json();
          const matchups = await matchupsRes.json();

          const myRoster = rosters.find((r) => r.owner_id === userId);
          if (!myRoster) continue;

          const myTeamEntry = matchups.find((m) => m.roster_id === myRoster.roster_id);
          if (!myTeamEntry) continue;

          const myMatchId = myTeamEntry.matchup_id;
          const oppEntry = matchups.find(
            (m) => m.matchup_id === myMatchId && m.roster_id !== myRoster.roster_id
          );
          const oppRoster = oppEntry
            ? rosters.find((r) => r.roster_id === oppEntry.roster_id)
            : null;

          const myStarters = (myRoster?.starters || []).map(mapPlayer);
          const oppStarters = (oppRoster?.starters || []).map(mapPlayer);

          const myScore = typeof myTeamEntry.points === "number" ? myTeamEntry.points : 0;
          const oppScore = typeof oppEntry?.points === "number" ? oppEntry.points : 0;

          const myCounts = splitByGameState(myStarters);
          const oppCounts = splitByGameState(oppStarters);

          summaries.push({
            leagueId: league.league_id,
            leagueName: league.name,
            myScore,
            oppScore,
            myCounts: {
              active: myCounts.active.length,
              remaining: myCounts.remaining.length,
              done: myCounts.done.length,
            },
            oppCounts: {
              active: oppCounts.active.length,
              remaining: oppCounts.remaining.length,
              done: oppCounts.done.length,
            },
          });

          // Build combined player pools
          myStarters.forEach((p) =>
            mine.push({ ...p, _leagueName: league.name, _leagueId: league.league_id })
          );
          oppStarters.forEach((p) =>
            opp.push({ ...p, _leagueName: league.name, _leagueId: league.league_id })
          );
        } catch (e) {
          console.error("Combined fetch failed for league", league.league_id, e);
        }
      }

      if (!selectedCombinedLeagues.length) {
        setSelectedCombinedLeagues(leagues.map((l) => l.league_id));
      }

      setSelectedLeague(null);
      setMatchupData([]);
      setSelectedCombined(true);
      setCombinedMine(mine);
      setCombinedOpp(opp);
      setCombinedSummaries(summaries);
    } catch (err) {
      console.error("Failed to build combined breakdown:", err);
      setCombinedMine([]);
      setCombinedOpp([]);
      setCombinedSummaries([]);
    }
  };

  // Combined league selection helpers
  const toggleCombinedLeague = (leagueId) => {
    setSelectedCombinedLeagues((prev) =>
      prev.includes(leagueId) ? prev.filter((id) => id !== leagueId) : [...prev, leagueId]
    );
  };
  const selectAllCombined = () => setSelectedCombinedLeagues(leagues.map((l) => l.league_id));
  const clearAllCombined = () => setSelectedCombinedLeagues([]);

  // Quick lookup for per-league summary rows
  const combinedSummaryByLeague = combinedSummaries.reduce((acc, s) => {
    acc[s.leagueId] = s;
    return acc;
  }, {});

  return (
    <div
      style={{
        padding: "20px",
        background: COLORS.appBg,
        color: COLORS.text,
        minHeight: "100vh",
      }}
    >
      {/* Top bar with title and Dark Mode toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <h1 style={{ margin: 0 }}>Sleeper Matchups</h1>
        <button
          onClick={() => setDarkMode((d) => !d)}
          style={{
            padding: "8px 12px",
            border: BORDER,
            background: darkMode ? "#4f46e5" : COLORS.buttonBg,
            color: darkMode ? "#ffffff" : COLORS.buttonText,
            borderRadius: "8px",
            cursor: "pointer",
          }}
          title="Toggle Dark Mode"
        >
          {darkMode ? "🌙 Dark" : "☀️ Light"}
        </button>
      </div>

      {/* Username input */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter Sleeper Username"
          style={{
            padding: "8px 10px",
            border: BORDER,
            borderRadius: 8,
            background: COLORS.cardBg,
            color: COLORS.text,
          }}
        />
      </div>

      {/* League buttons + Combined tab */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => fetchCombinedBreakdown(activeWeek)}
          style={{
            padding: "10px",
            background: selectedCombined ? "#4f46e5" : COLORS.buttonBg,
            color: selectedCombined ? "white" : COLORS.buttonText,
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
          disabled={!leagues.length || !activeWeek}
          title={
            !leagues.length
              ? "Loading leagues..."
              : !activeWeek
              ? "Loading week..."
              : "Show combined kickoff breakdown"
          }
        >
          Combined
        </button>

        {leagues.map((league) => (
          <button
            key={league.league_id}
            onClick={() => fetchMatchupPlayers(league, activeWeek)}
            style={{
              padding: "10px",
              background:
                selectedLeague?.league_id === league.league_id && !selectedCombined
                  ? "#4f46e5"
                  : COLORS.buttonBg,
              color:
                selectedLeague?.league_id === league.league_id && !selectedCombined
                  ? "white"
                  : COLORS.buttonText,
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {league.name}
          </button>
        ))}
      </div>

      {/* Week input + refetch for per-league view */}
      {!selectedCombined && selectedLeague && (
        <div style={{ marginTop: "20px" }}>
          <label>Week: </label>
          <input
            type="number"
            value={activeWeek || ""}
            onChange={(e) => setActiveWeek(e.target.value)}
            style={{
              width: "60px",
              marginRight: "10px",
              padding: "6px 8px",
              border: BORDER,
              borderRadius: 6,
              background: COLORS.cardBg,
              color: COLORS.text,
            }}
          />
          <button
            onClick={() => fetchMatchupPlayers(selectedLeague, activeWeek)}
            style={{
              padding: "8px 10px",
              border: BORDER,
              background: COLORS.buttonBg,
              color: COLORS.buttonText,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Refetch
          </button>
        </div>
      )}

      {/* Combined view */}
      {selectedCombined && (
        <div style={{ marginTop: "20px" }}>
          <h2>Combined - Week {activeWeek}</h2>

          <div
            style={{
              marginTop: "8px",
              padding: "12px",
              border: BORDER,
              borderRadius: "8px",
              background: COLORS.panelBg,
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <strong>Show leagues</strong>
              <button
                onClick={selectAllCombined}
                style={{
                  padding: "4px 8px",
                  border: BORDER_MUTED,
                  background: COLORS.cardBg,
                  color: COLORS.text,
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Select all
              </button>
              <button
                onClick={clearAllCombined}
                style={{
                  padding: "4px 8px",
                  border: BORDER_MUTED,
                  background: COLORS.cardBg,
                  color: COLORS.text,
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>

            <div style={{ marginTop: "12px", overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.2fr) repeat(4, minmax(150px, 0.9fr))",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted }}>
                  League
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted }}>
                  Score (You-Opp)
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted }}>
                  Active (You-Opp)
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted }}>
                  Remaining (You-Opp)
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted }}>
                  Done (You-Opp)
                </div>

                {leagues.map((lg) => {
                  const s = combinedSummaryByLeague[lg.league_id];
                  const selected = selectedCombinedLeagues.includes(lg.league_id);
                  return (
                    <div key={lg.league_id} style={{ display: "contents" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          border: BORDER,
                          borderRadius: "6px",
                          background: selected ? COLORS.highlight : COLORS.cardBg,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCombinedLeague(lg.league_id)}
                        />
                        <span style={{ fontSize: "12px" }}>{lg.name}</span>
                      </label>

                      {metricCell({
                        left: s ? formatPoints(s.myScore) : null,
                        right: s ? formatPoints(s.oppScore) : null,
                        title: "Your score - Opponent score",
                        colSpec: "7ch 2ch 7ch",
                      })}

                      {metricCell({
                        left: s ? `${s.myCounts.active}` : null,
                        right: s ? `${s.oppCounts.active}` : null,
                        title: "Active players now (you - opp)",
                        colSpec: "3ch 2ch 3ch",
                      })}

                      {metricCell({
                        left: s ? `${s.myCounts.remaining}` : null,
                        right: s ? `${s.oppCounts.remaining}` : null,
                        title: "Remaining players (you - opp)",
                        colSpec: "3ch 2ch 3ch",
                      })}

                      {metricCell({
                        left: s ? `${s.myCounts.done}` : null,
                        right: s ? `${s.oppCounts.done}` : null,
                        title: "Done players (you - opp)",
                        colSpec: "3ch 2ch 3ch",
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Player lists below the selector */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "16px" }}>
            {[
              {
                title: username,
                mine: combinedMine.filter((p) => selectedCombinedLeagues.includes(p._leagueId)),
                other: combinedOpp.filter((p) => selectedCombinedLeagues.includes(p._leagueId)),
              },
              {
                title: "Opponents",
                mine: combinedOpp.filter((p) => selectedCombinedLeagues.includes(p._leagueId)),
                other: combinedMine.filter((p) => selectedCombinedLeagues.includes(p._leagueId)),
              },
            ].map((side, i) => {
              const myGroups = groupByBucket(side.mine);
              const oppGroups = groupByBucket(side.other);

              const hasAny =
                BUCKET_ORDER.some((b) => (myGroups[b] || []).length > 0) ||
                BUCKET_ORDER.some((b) => (oppGroups[b] || []).length > 0);

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: BORDER,
                    borderRadius: "8px",
                    minWidth: "280px",
                    background: COLORS.cardBg,
                  }}
                >
                  <h3>{side.title}</h3>

                  {!hasAny && <div style={{ marginTop: "8px" }}>No starters found.</div>}

                  {hasAny && (
                    <div style={{ marginTop: "6px", marginBottom: "48px" }}>
                      <strong>Kickoff Breakdown:</strong>
                      {BUCKET_ORDER.map((bucket) => {
                        const mineRaw = myGroups[bucket] || [];
                        const theirsRaw = oppGroups[bucket] || [];
                        const mine = sortPlayersCombined(mineRaw);
                        const theirs = sortPlayersCombined(theirsRaw);
                        const maxLen = Math.max(mine.length, theirs.length);
                        if (maxLen === 0) return null;

                        return (
                          <div key={bucket} style={{ marginTop: "8px" }}>
                            <div
                              style={{
                                fontSize: "12px",
                                color: COLORS.textMuted,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                                marginBottom: "4px",
                              }}
                            >
                              {bucket}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: "0px" }}>
                              {Array.from({ length: maxLen }).map((_, idx) => {
                                const myP = mine[idx] || null;
                                const oppHasHere = Boolean(theirs[idx]);
                                if (myP) {
                                  return renderPlayer(myP, {
                                    showTimeLabel: false,
                                    nameSuffix: ` (${myP._leagueName})`,
                                    isStarter: true,
                                  });
                                }
                                return renderPlaceholder(
                                  `ph-combined-${i}-${bucket}-${idx}`,
                                  oppHasHere
                                );
                              })}
                            </ul>
                            <div style={{ height: "1px", background: COLORS.divider, marginTop: "8px" }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-league matchup display */}
      {!selectedCombined && matchupData.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h2>
            {selectedLeague.name} - Week {activeWeek}
          </h2>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {matchupData.map((team, i) => {
              const opponentTeam = matchupData.find((_, j) => j !== i);

              const myGroups = groupByBucket(team.starters);
              const oppGroups = groupByBucket(opponentTeam?.starters || []);

              // Player status counts
              const { active, remaining, done } = splitByGameState(team.starters);

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: BORDER,
                    borderRadius: "8px",
                    minWidth: "280px",
                    background: COLORS.cardBg,
                  }}
                >
                  {/* Header with counts stacked on the right */}
                  <h3 style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      {team.displayTeam.team}{" "}
                      <span
                        style={{
                          fontWeight: 600,
                          color: COLORS.text,
                          marginLeft: "6px",
                          fontSize: "0.95em",
                        }}
                        title="Current score"
                      >
                        {formatPoints(team.score)}
                      </span>
                      {team.displayTeam.metadata?.team_name && (
                        <span style={{ fontStyle: "italic", color: COLORS.textMuted, marginLeft: 6 }}>
                          ({team.displayTeam.metadata.team_name})
                        </span>
                      )}
                    </span>

                    {/* Right side: counts only */}
                    <span
                      style={{
                        marginLeft: "auto",
                        color: COLORS.textMuted,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: "0.85em" }} title="Active, Remaining, Done">
                        Active/Remaining/Done: {active.length}/{remaining.length}/{done.length}
                      </span>
                    </span>
                  </h3>

                  {/* Kickoff Breakdown under each team card */}
                  {team.starters.length > 0 && (
                    <div style={{ marginTop: "6px", marginBottom: "48px" }}>
                      <strong>Kickoff Breakdown:</strong>
                      {BUCKET_ORDER.map((bucket) => {
                        const mine = myGroups[bucket] || [];
                        const theirs = oppGroups[bucket] || [];
                        const maxLen = Math.max(mine.length, theirs.length);
                        if (maxLen === 0) return null;

                        return (
                          <div key={bucket} style={{ marginTop: "8px" }}>
                            <div
                              style={{
                                fontSize: "12px",
                                color: COLORS.textMuted,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                                marginBottom: "4px",
                              }}
                            >
                              {bucket}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: "0px" }}>
                              {Array.from({ length: maxLen }).map((_, idx) => {
                                const myP = mine[idx] || null;
                                const oppHasHere = Boolean(theirs[idx]);
                                if (myP) {
                                  return renderPlayer(myP, { showTimeLabel: false, isStarter: true });
                                }
                                return renderPlaceholder(`ph-${i}-${bucket}-${idx}`, oppHasHere);
                              })}
                            </ul>
                            <div style={{ height: "1px", background: COLORS.divider, marginTop: "8px" }} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Extra spacer */}
                  <div style={{ height: "16px" }} />

                  {team.starters.length > 0 && (
                    <div>
                      <strong>Starters:</strong>
                      <ul>{team.starters.map((p) => renderPlayer(p, { isStarter: true }))}</ul>
                    </div>
                  )}

                  {team.bench.length > 0 && (
                    <div>
                      <strong>Bench:</strong>
                      <ul>{team.bench.map((p) => renderPlayer(p, { isStarter: false }))}</ul>
                    </div>
                  )}

                  {team.byePlayers?.length > 0 && (
                    <div>
                      <strong>Bye:</strong>
                      <ul>{team.byePlayers.map((p) => renderPlayer(p, { isStarter: false }))}</ul>
                    </div>
                  )}

                  {team.irPlayers.length > 0 && (
                    <div>
                      <strong>IR:</strong>
                      <ul>{team.irPlayers.map((p) => renderPlayer(p, { isStarter: false }))}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
