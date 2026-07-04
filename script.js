(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER = 50;
  // radii for: 32 leaves, round-of-32 winners, round-of-16 winners, QF winners, SF winners, champion
  const RADII = [46, 37, 28, 19, 10, 0];
  const ROUND_NAMES = ["round32", "round16", "quarter", "semi", "final"];
  const FLAG_BASE = "https://flagcdn.com/w320/";
  const FLAG_2X = "https://flagcdn.com/w640/";
  const STORAGE_KEY = "wc2026-last-valid-standings-v3";
  const OPENFOOTBALL_URL =
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

  const COUNTRY_CODES = {
    Algeria: "dz", Argentina: "ar", Australia: "au", Austria: "at",
    Belgium: "be", "Bosnia & Herzegovina": "ba", Brazil: "br", Canada: "ca",
    "Cape Verde": "cv", Colombia: "co", Croatia: "hr", "Curaçao": "cw",
    "Czech Republic": "cz", "DR Congo": "cd", Ecuador: "ec", Egypt: "eg",
    England: "gb-eng", France: "fr", Germany: "de", Ghana: "gh",
    Haiti: "ht", Iran: "ir", Iraq: "iq", "Ivory Coast": "ci",
    Japan: "jp", Jordan: "jo", Mexico: "mx", Morocco: "ma",
    Netherlands: "nl", "New Zealand": "nz", Norway: "no", Panama: "pa",
    Paraguay: "py", Portugal: "pt", Qatar: "qa", "Saudi Arabia": "sa",
    Scotland: "gb-sct", Senegal: "sn", "South Africa": "za", "South Korea": "kr",
    Spain: "es", Sweden: "se", Switzerland: "ch", Tunisia: "tn",
    Turkey: "tr", USA: "us", Uruguay: "uy", Uzbekistan: "uz",
  };

  // Fixed knockout-stage bracket connections for the 2026 World Cup: match
  // number -> [team1-source match, team2-source match]. Round of 32 matches
  // (73-88) are leaves; every later match is resolved recursively from them.
  // This shape is part of the official schedule and doesn't change, only the
  // results feeding into it do — so it's safe to hard-code here and drive
  // everything else from the live data fetched in fetchStandings().
  const BRACKET_TOPOLOGY = {
    90: [73, 75], 89: [74, 77], 91: [76, 78], 92: [79, 80],
    93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
    97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
    101: [97, 98], 102: [99, 100],
    104: [101, 102],
  };
  const FINAL_MATCH_NUM = 104;

  // FIFA Men's World Ranking, 11 June 2026 (Wikipedia / whereig.com — see the
  // "Next Matches" section footnote for the source link).
  const FIFA_RANKING = {
    Argentina: 1, Spain: 2, France: 3, England: 4, Portugal: 5, Brazil: 6,
    Morocco: 7, Netherlands: 8, Belgium: 9, Germany: 10, Croatia: 11,
    Colombia: 13, Mexico: 14, Senegal: 15, Uruguay: 16, USA: 17, Japan: 18,
    Switzerland: 19, Iran: 20, Turkey: 22, Ecuador: 23, Austria: 24,
    "South Korea": 25, Australia: 27, Algeria: 28, Egypt: 29, Canada: 30,
    Norway: 31, "Ivory Coast": 33, Panama: 34, Sweden: 38, "Czech Republic": 40,
    Paraguay: 41, Scotland: 42, Tunisia: 45, "DR Congo": 46, Uzbekistan: 50,
    Qatar: 56, Iraq: 57, "Saudi Arabia": 59, "South Africa": 60, Jordan: 63,
    "Bosnia & Herzegovina": 64, "Cape Verde": 67, Ghana: 73, "Curaçao": 81,
    Haiti: 83, "New Zealand": 85,
  };
  const RANK_DOMAIN = [1, 40];

  // Built-in snapshot so the page still has real data to show when opened
  // straight from disk (file://) or the live fetch can't be reached —
  // browsers block fetch() of local files, and some also restrict file://
  // pages from fetching external https:// URLs.
  const FALLBACK_STANDINGS = {
    snapshot_date: "2026-07-01",
    teams: [
      { name: "Brazil", code: "br" },
      { name: "Japan", code: "jp" },
      { name: "Norway", code: "no" },
      { name: "Ivory Coast", code: "ci" },
      { name: "Mexico", code: "mx" },
      { name: "Ecuador", code: "ec" },
      { name: "England", code: "gb-eng" },
      { name: "DR Congo", code: "cd" },
      { name: "Argentina", code: "ar" },
      { name: "Cape Verde", code: "cv" },
      { name: "Australia", code: "au" },
      { name: "Egypt", code: "eg" },
      { name: "Switzerland", code: "ch" },
      { name: "Algeria", code: "dz" },
      { name: "Colombia", code: "co" },
      { name: "Ghana", code: "gh" },
      { name: "Canada", code: "ca" },
      { name: "South Africa", code: "za" },
      { name: "Morocco", code: "ma" },
      { name: "Netherlands", code: "nl" },
      { name: "Paraguay", code: "py" },
      { name: "Germany", code: "de" },
      { name: "France", code: "fr" },
      { name: "Sweden", code: "se" },
      { name: "Portugal", code: "pt" },
      { name: "Croatia", code: "hr" },
      { name: "Spain", code: "es" },
      { name: "Austria", code: "at" },
      { name: "USA", code: "us" },
      { name: "Bosnia and Herzegovina", code: "ba" },
      { name: "Belgium", code: "be" },
      { name: "Senegal", code: "sn" },
    ],
    results: {
      round32: [0, 0, 0, 0, null, null, null, null, 0, 0, 0, 0, null, null, null, null],
      round16: [null, null, null, null, null, null, null, null],
      quarter: [null, null, null, null],
      semi: [null, null],
      final: [null],
    },
    // Round of 16 matchups already set (both opponents decided) as of this snapshot.
    nextMatches: [
      { team1: { name: "Paraguay", code: "py" }, team2: { name: "France", code: "fr" } },
      { team1: { name: "Canada", code: "ca" }, team2: { name: "Morocco", code: "ma" } },
      { team1: { name: "Brazil", code: "br" }, team2: { name: "Norway", code: "no" } },
      { team1: { name: "Mexico", code: "mx" }, team2: { name: "England", code: "gb-eng" } },
      { team1: { name: "Portugal", code: "pt" }, team2: { name: "Spain", code: "es" } },
      { team1: { name: "USA", code: "us" }, team2: { name: "Belgium", code: "be" } },
      { team1: { name: "Argentina", code: "ar" }, team2: { name: "Egypt", code: "eg" } },
    ],
  };

  const svg = document.getElementById("bracket-svg");
  const ringsGroup = document.getElementById("rings-group");
  const linesGroup = document.getElementById("lines-group");
  const nodesEl = document.getElementById("nodes");
  const statusEl = document.getElementById("status");
  const championEl = document.getElementById("champion-label");
  const trophyBtn = document.getElementById("trophy-btn");
  const rankChartEl = document.getElementById("rank-chart");

  function ordinal(n) {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }

  function polar(radius, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(rad),
      y: CENTER + radius * Math.sin(rad),
    };
  }

  function renderRings() {
    RADII.slice(0, -1).forEach((r) => {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", CENTER);
      circle.setAttribute("cy", CENTER);
      circle.setAttribute("r", r);
      circle.setAttribute("class", "ring-guide");
      ringsGroup.appendChild(circle);
    });
  }

  // Builds a smooth bowed arch between a child and its parent: a quadratic
  // curve whose control point sits further from the center than either
  // endpoint, so the connector bulges outward like an arch.
  function archPath(child, parent, childRadius, parentRadius) {
    let delta = ((parent.angle - child.angle + 180) % 360 + 360) % 360 - 180;
    const midAngle = child.angle + delta / 2;
    const midRadius = ((childRadius + parentRadius) / 2) * 1.15;
    const ctrl = polar(midRadius, midAngle);
    return `M ${child.x} ${child.y} Q ${ctrl.x} ${ctrl.y} ${parent.x} ${parent.y}`;
  }

  function buildBracket(teams, results) {
    const angleStep = 360 / teams.length;
    let current = teams.map((team, i) => ({
      team,
      angle: i * angleStep,
      ...polar(RADII[0], i * angleStep),
    }));

    const levels = [current];

    for (let lvl = 1; lvl <= ROUND_NAMES.length; lvl++) {
      const roundResult = results[ROUND_NAMES[lvl - 1]];
      const next = [];
      for (let m = 0; m < current.length / 2; m++) {
        const a = current[m * 2];
        const b = current[m * 2 + 1];
        const outcome = roundResult[m]; // 0 = a wins, 1 = b wins, null = not played yet
        const winner = outcome === null ? null : outcome === 1 ? b.team : a.team;
        const angle = (a.angle + b.angle) / 2;
        next.push({
          team: winner,
          angle,
          children: [a, b],
          ...polar(RADII[lvl], angle),
        });
      }
      levels.push(next);
      current = next;
    }

    const eliminated = new Set();
    for (let L = 1; L < levels.length; L++) {
      levels[L].forEach((parent) => {
        if (parent.team === null) return; // match not decided yet
        parent.children.forEach((child) => {
          if (child.team && child.team !== parent.team) eliminated.add(child.team);
        });
      });
    }

    return { levels, champion: levels[levels.length - 1][0].team, eliminated };
  }

  function flagUrl(code, hd) {
    return `${hd ? FLAG_2X : FLAG_BASE}${code}.png`;
  }

  function countryCode(name) {
    return COUNTRY_CODES[name] || name.slice(0, 2).toLowerCase();
  }

  // A match is only decided once its score is no longer tied — penalties
  // override extra time, which overrides full time, since each is only
  // recorded when the previous stage ended level.
  function decidedPair(score) {
    if (!score) return null;
    const pair = score.p || score.et || score.ft;
    if (!pair || pair[0] === pair[1]) return null;
    return pair;
  }

  // Converts the raw openfootball/worldcup.json match list into the
  // {snapshot_date, teams, results} shape buildBracket() expects. The bracket
  // connections themselves come from BRACKET_TOPOLOGY; this only reads scores
  // and the Round of 32 team names out of the fetched file.
  function parseOpenFootballData(json) {
    const byNum = new Map();
    (json.matches || []).forEach((m) => {
      if (typeof m.num === "number") byNum.set(m.num, m);
    });

    function winnerSide(num) {
      const pair = decidedPair(byNum.has(num) ? byNum.get(num).score : null);
      if (!pair) return null;
      return pair[0] > pair[1] ? 0 : 1;
    }

    // Match numbers exactly `depth` bracket-levels below `num`
    // (depth 0 = num itself, depth 3 = its 8 Round-of-32 ancestors).
    function descendants(num, depth) {
      if (depth === 0) return [num];
      const [a, b] = BRACKET_TOPOLOGY[num];
      return [...descendants(a, depth - 1), ...descendants(b, depth - 1)];
    }

    // The team name that ultimately wins match `num`, resolved recursively
    // through BRACKET_TOPOLOGY regardless of whether the file itself has
    // already propagated that name into later rounds' team1/team2 fields.
    function winnerOf(num) {
      const m = byNum.get(num);
      if (!m) return null;
      const side = winnerSide(num);
      if (side === null) return null;
      if (!BRACKET_TOPOLOGY[num]) return side === 0 ? m.team1 : m.team2;
      const [a, b] = BRACKET_TOPOLOGY[num];
      return side === 0 ? winnerOf(a) : winnerOf(b);
    }

    // Upcoming matches whose two opponents are already decided (even if the
    // file itself still shows a placeholder like "W86"), sorted by date.
    const nextMatches = Object.keys(BRACKET_TOPOLOGY)
      .map(Number)
      .filter((num) => winnerSide(num) === null)
      .map((num) => {
        const [a, b] = BRACKET_TOPOLOGY[num];
        const team1Name = winnerOf(a);
        const team2Name = winnerOf(b);
        if (!team1Name || !team2Name) return null;
        const m = byNum.get(num);
        return {
          round: m.round,
          date: m.date,
          team1: { name: team1Name, code: countryCode(team1Name) },
          team2: { name: team2Name, code: countryCode(team2Name) },
        };
      })
      .filter(Boolean)
      .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

    const [sf1, sf2] = BRACKET_TOPOLOGY[FINAL_MATCH_NUM];
    // sf2 (Brazil's side of the draw) first so it lands on the right of the
    // trophy, sf1 (France's side) second so it lands on the left — matches
    // the left/right split the bracket was arranged with previously.
    const halves = [sf2, sf1];

    const round32Nums = halves.flatMap((h) => descendants(h, 3));
    const round16Nums = halves.flatMap((h) => descendants(h, 2));
    const quarterNums = halves.flatMap((h) => descendants(h, 1));
    const semiNums = halves.flatMap((h) => descendants(h, 0));

    const teams = round32Nums.flatMap((num) => {
      const m = byNum.get(num);
      return [
        { name: m.team1, code: countryCode(m.team1) },
        { name: m.team2, code: countryCode(m.team2) },
      ];
    });

    const decidedDates = (json.matches || [])
      .filter((m) => m.score)
      .map((m) => m.date)
      .sort();

    return {
      snapshot_date: decidedDates[decidedDates.length - 1] || new Date().toISOString().slice(0, 10),
      teams,
      results: {
        round32: round32Nums.map(winnerSide),
        round16: round16Nums.map(winnerSide),
        quarter: quarterNums.map(winnerSide),
        semi: semiNums.map(winnerSide),
        final: [winnerSide(FINAL_MATCH_NUM)],
      },
      nextMatches,
    };
  }

  function render(bracket) {
    linesGroup.innerHTML = "";
    nodesEl.innerHTML = "";

    const { levels, eliminated } = bracket;

    for (let L = 1; L < levels.length; L++) {
      const childRadius = RADII[L - 1];
      const parentRadius = RADII[L];
      levels[L].forEach((parent) => {
        const pending = parent.team === null;
        parent.children.forEach((child) => {
          const advanced = !pending && child.team === parent.team;
          const path = document.createElementNS(SVG_NS, "path");
          path.setAttribute("d", archPath(child, parent, childRadius, parentRadius));
          path.setAttribute(
            "class",
            "bracket-line" + (advanced ? " advanced" : pending ? " pending" : "")
          );
          linesGroup.appendChild(path);
          const len = path.getTotalLength();
          path.style.setProperty("--len", len.toFixed(2));
          path.style.setProperty("--delay", `${(L - 1) * 0.35}s`);
        });
      });
    }

    levels.forEach((level, L) => {
      if (L === levels.length - 1) return; // champion slot sits under the trophy
      level.forEach((node) => {
        const isEliminated = node.team && eliminated.has(node.team);
        const el = document.createElement("div");
        el.className =
          `flag-node lvl-${L}` + (node.team ? "" : " tbd") + (isEliminated ? " eliminated" : "");
        el.style.left = `${node.x}%`;
        el.style.top = `${node.y}%`;
        el.style.setProperty("--delay", `${L * 0.35}s`);
        el.title = node.team
          ? node.team.name + (isEliminated ? " (eliminated)" : "")
          : "Not decided yet";

        if (node.team) {
          const img = document.createElement("img");
          img.src = flagUrl(node.team.code, false);
          img.srcset = `${flagUrl(node.team.code, true)} 2x`;
          img.alt = node.team.name;
          img.loading = "lazy";
          el.appendChild(img);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "placeholder";
          placeholder.textContent = "?";
          el.appendChild(placeholder);
        }

        if (L === 0) {
          const label = document.createElement("span");
          label.className = "team-name";
          label.textContent = node.team.name;
          el.appendChild(label);
        }

        nodesEl.appendChild(el);
      });
    });

    championEl.innerHTML = "";
    if (bracket.champion) {
      const champImg = document.createElement("img");
      champImg.src = flagUrl(bracket.champion.code, false);
      champImg.alt = bracket.champion.name;
      championEl.appendChild(champImg);
      championEl.append(`2026 Champion: ${bracket.champion.name}`);
    } else {
      championEl.append("Champion: to be decided");
    }
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  const AXIS_MARGIN = 5; // matches the margin baked into rankPercent()

  function rankPercent(rank) {
    const [min, max] = RANK_DOMAIN;
    const clamped = Math.min(Math.max(rank, min), max);
    const t = (clamped - min) / (max - min);
    return AXIS_MARGIN + t * (100 - 2 * AXIS_MARGIN);
  }

  // Flags always sit at their true rank position — never nudged — so a
  // team's left/right position stays consistent with every other row on the
  // shared axis. When two teams in the same row are close enough that their
  // name labels would overlap, the second one is stacked a tier higher
  // instead of shifting either dot.
  const LABEL_COLLISION_GAP = 14;

  const RANK_AXIS_TICKS = [1, 10, 20, 30, 40];

  function renderRankAxis() {
    const axis = document.createElement("div");
    axis.className = "rank-axis";
    RANK_AXIS_TICKS.forEach((rank) => {
      const tick = document.createElement("div");
      tick.className = "rank-axis-tick";
      tick.style.left = `${rankPercent(rank)}%`;

      const line = document.createElement("div");
      line.className = "rank-axis-line";

      const label = document.createElement("span");
      label.className = "rank-axis-label";
      label.textContent = `#${rank}`;

      tick.append(line, label);
      axis.appendChild(tick);
    });
    return axis;
  }

  // Renders each upcoming match as a row: a line spanning the two teams'
  // FIFA ranking positions on a shared axis, with round flags at each end.
  function renderNextMatches(matches) {
    rankChartEl.innerHTML = "";

    if (!matches || matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rank-empty";
      empty.textContent = "No upcoming matches with confirmed opponents yet.";
      rankChartEl.appendChild(empty);
      return;
    }

    rankChartEl.appendChild(renderRankAxis());

    matches.forEach((match, i) => {
      const rank1 = FIFA_RANKING[match.team1.name] || RANK_DOMAIN[1];
      const rank2 = FIFA_RANKING[match.team2.name] || RANK_DOMAIN[1];
      const x1 = rankPercent(rank1);
      const x2 = rankPercent(rank2);
      const tooClose = Math.abs(x2 - x1) < LABEL_COLLISION_GAP;
      const delay = `${i * 0.12}s`;

      const row = document.createElement("div");
      row.className = "rank-row";

      const line = document.createElement("div");
      line.className = "rank-line";
      line.style.left = `${Math.min(x1, x2)}%`;
      line.style.width = `${Math.abs(x2 - x1)}%`;
      line.style.setProperty("--delay", delay);
      row.appendChild(line);

      const leftmostIsTeam1 = x1 <= x2;

      [
        { team: match.team1, rank: rank1, x: x1, leftmost: leftmostIsTeam1 },
        { team: match.team2, rank: rank2, x: x2, leftmost: !leftmostIsTeam1 },
      ].forEach(({ team, rank, x, leftmost }) => {
        // When the two teams are close together, spread their labels apart
        // horizontally at the same height instead of centering each one on
        // its own flag — otherwise the names would overlap.
        const shiftClass = tooClose ? (leftmost ? " shift-left" : " shift-right") : "";
        const flag = document.createElement("div");
        flag.className = `rank-flag label-above${shiftClass}${x > 50 ? " side-right" : ""}`;
        flag.style.left = `${x}%`;
        flag.style.setProperty("--delay", delay);
        flag.title = `${team.name} — ${ordinal(rank)}`;

        const label = document.createElement("span");
        label.className = "rank-label";
        const name = document.createElement("span");
        name.className = "rank-name";
        name.textContent = team.name;
        const pos = document.createElement("span");
        pos.className = "rank-position";
        pos.textContent = ordinal(rank);
        label.append(name, pos);

        const img = document.createElement("img");
        img.src = flagUrl(team.code, false);
        img.srcset = `${flagUrl(team.code, true)} 2x`;
        img.alt = team.name;
        img.loading = "lazy";

        flag.append(label, img);
        row.appendChild(flag);
      });

      rankChartEl.appendChild(row);
    });
  }

  function loadSavedStandings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveStandings(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Storage unavailable (e.g. private browsing) — not fatal, just skip caching.
    }
  }

  function showStandings(data, statusText) {
    const bracket = buildBracket(data.teams, data.results);
    render(bracket);
    setStatus(statusText);
    renderNextMatches(data.nextMatches);
  }

  // Downloads the current openfootball/worldcup.json match data straight from
  // GitHub and rebuilds the bracket from it — this is the actual source of
  // truth, fetched fresh on every load and every trophy click. If the fetch
  // fails — no network, GitHub unreachable, or the page was opened directly
  // from disk where browsers block cross-origin fetch() — we fall back to the
  // last standings we successfully loaded, and finally to the built-in
  // snapshot above.
  async function fetchStandings() {
    setStatus("Downloading latest results from GitHub…");
    try {
      const res = await fetch(`${OPENFOOTBALL_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load worldcup.json: ${res.status}`);
      const raw = await res.json();
      const data = parseOpenFootballData(raw);
      saveStandings(data);
      showStandings(data, `Live standings as of ${data.snapshot_date} (openfootball/worldcup.json)`);
    } catch (err) {
      console.warn("Could not fetch live standings, using saved data instead.", err);
      const saved = loadSavedStandings();
      if (saved) {
        showStandings(saved, `Last saved standings (${saved.snapshot_date})`);
      } else {
        showStandings(
          FALLBACK_STANDINGS,
          `Built-in standings (${FALLBACK_STANDINGS.snapshot_date}) — couldn't reach live data`
        );
      }
    }
  }

  function refresh() {
    trophyBtn.classList.add("spinning");
    fetchStandings().finally(() => {
      // Matches the blob-burst animation duration in style.css so the glow
      // finishes its own soft landing before handing back to the idle animation.
      setTimeout(() => trophyBtn.classList.remove("spinning"), 1850);
    });
  }

  renderRings();
  trophyBtn.addEventListener("click", refresh);
  document.addEventListener("DOMContentLoaded", refresh);
})();
