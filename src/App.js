
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function fetchMatchups() {
      const res = await fetch("https://api.sleeper.app/v1/league/YOUR_LEAGUE_ID/matchups/1");
      const matchups = await res.json();

      setData(matchups.map(m => ({
        roster: `Roster ${m.roster_id}`,
        points: m.points,
      })));
    }

    fetchMatchups();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Week 1 Scores</h1>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <XAxis dataKey="roster" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="points" fill="#4f46e5" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default App;
