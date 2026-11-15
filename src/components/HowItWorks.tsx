// "How Prescient works": the data-to-decision pipeline as a flowchart, then how the same
// pipeline extends to other climate phenomena. Every box carries its status today.

type Status = 'live' | 'demo' | 'planned';
const STATUS_LABEL: Record<Status, string> = { live: 'Live', demo: 'Demo estimate', planned: 'Planned' };

function Tag({ status }: { status: Status }) {
  return <span className={`flow-tag flow-tag-${status}`}>{STATUS_LABEL[status]}</span>;
}

interface Source { name: string; detail: string; status: Status }
const FACTORS: Array<{ key: string; letter: string; title: string; question: string; sources: Source[] }> = [
  {
    key: 'hazard', letter: 'H', title: 'Hazard', question: 'Is there permafrost here, and is it thawing year after year?',
    sources: [
      { name: 'ESA CCI Permafrost', detail: 'Is there permafrost under each 1 km cell?', status: 'live' },
      { name: 'Sentinel-1 InSAR (OPERA)', detail: 'Old trend: net sinking 2016–2025 (Fairbanks; OPERA covers the US only)', status: 'live' },
      { name: 'NISAR GUNW', detail: 'Ground movement every 12 days, from 2026 onwards', status: 'live' },
      { name: 'NISAR GCOV', detail: 'Radar brightness: wetting, new water', status: 'live' },
      { name: 'NASA POWER + ERA5-Land', detail: 'Degree days of thaw (Stefan model), ground temperature', status: 'live' },
    ],
  },
  {
    key: 'exposure', letter: 'E', title: 'Exposure', question: 'Who and what is in the way?',
    sources: [
      { name: 'ESA WorldCover', detail: 'Built-up land, water mask', status: 'live' },
      { name: 'WorldPop · OpenStreetMap', detail: 'People, homes, roads, pipelines', status: 'planned' },
    ],
  },
  {
    key: 'vulnerability', letter: 'V', title: 'Vulnerability', question: 'How badly would they be hurt, and can they cope?',
    sources: [
      { name: 'Census · World Bank', detail: 'Poverty, age, building type, isolation', status: 'planned' },
      { name: 'Health and emergency maps', detail: 'Hospitals, monitoring, local plans (capacity to cope)', status: 'planned' },
    ],
  },
];

const PROCESS: Array<{ step: string; detail: string }> = [
  { step: 'Fetch', detail: 'NASA CMR finds every NISAR pass over the area; Harmony cuts out only the layers and area needed. No full files are downloaded.' },
  { step: 'Clean', detail: 'Remove the ionosphere, unreliable pixels and open water; keep one unbroken region per radar pair.' },
  { step: 'Measure', detail: 'Chain the 12-day pairs into centimetres of movement per 1 km cell, then fit it to √(degree days of thaw), the Stefan model, to separate thaw sinking from noise and, over several seasons, the long-term trend.' },
];

const USERS: Array<{ who: string; gets: string }> = [
  { who: 'Governments', gets: 'Ranked list of roads, buildings and slopes, with time until each crosses a damage threshold' },
  { who: 'NGOs', gets: 'Hotspot maps of rising risk with population and vulnerability layered on' },
  { who: 'Communities', gets: 'A plain green, amber or red status and what to plan for' },
  { who: 'Conservation groups', gets: 'Where forest loss is spreading, year on year' },
];

const PHENOMENA: Array<{ name: string; signal: string; product: string }> = [
  { name: 'Permafrost thaw', signal: 'Seasonal sinking and heave, and its long-term trend', product: 'GUNW + GCOV' },
  { name: 'Slow landslides & slope creep', signal: 'Slopes that move faster from one 12-day pass to the next', product: 'GUNW' },
  { name: 'Coastal erosion & subsidence', signal: 'Shoreline retreat and sinking coastal land', product: 'GCOV + GUNW' },
  { name: 'Land sinking from groundwater', signal: 'Steady subsidence over months to years', product: 'GUNW' },
  { name: 'Flood-prone areas', signal: 'Ground that floods again and again, plus sinking land', product: 'GCOV + GUNW' },
  { name: 'Forest loss', signal: 'Drop in cross-polarised radar brightness as trees are cleared', product: 'GCOV' },
];

export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <header className="how-head">
        <span className="more-kicker">How Prescient works</span>
        <h1 id="how-title">From radar in orbit to a decision on the ground</h1>
        <p>NISAR measures how the ground moves. Prescient combines that with who lives there and how well they can cope, using the IPCC climate-risk framework, and turns it into hotspots people can act on.</p>
        <div className="flow-legend"><Tag status="live" /><Tag status="demo" /><Tag status="planned" /></div>
      </header>

      <ol className="flow" aria-label="Pipeline">
        <li className="flow-stage">
          <div className="flow-stage-label"><b>1</b>Observe</div>
          <div className="flow-card flow-nisar">
            <div className="flow-orbit" aria-hidden="true"><i /></div>
            <h3>NISAR satellite</h3>
            <p>NASA–ISRO L-band radar. Sees through cloud and darkness, and images almost all land every 12 days.</p>
            <Tag status="live" />
          </div>
        </li>

        <li className="flow-stage">
          <div className="flow-stage-label"><b>2</b>Process</div>
          <div className="flow-steps">
            {PROCESS.map((item, index) => (
              <div key={item.step} className="flow-card flow-step">
                <span className="flow-step-n">{String.fromCharCode(97 + index)}</span>
                <h3>{item.step}</h3>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </li>

        <li className="flow-stage">
          <div className="flow-stage-label"><b>3</b>Score three factors</div>
          <div className="flow-factors">
            {FACTORS.map((factor) => (
              <div key={factor.key} className={`flow-card flow-factor flow-factor-${factor.key}`}>
                <div className="flow-factor-head"><span>{factor.letter}</span><h3>{factor.title}</h3></div>
                <p className="flow-question">{factor.question}</p>
                <ul>
                  {factor.sources.map((source) => <li key={source.name}><b>{source.name}</b><span>{source.detail}</span><Tag status={source.status} /></li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="flow-aside">Until every input is measured, the demo hotspots use researched estimates for the three factors (<Tag status="demo" />). The formula stays the same; only the inputs change.</p>
        </li>

        <li className="flow-stage">
          <div className="flow-stage-label"><b>4</b>Combine</div>
          <div className="flow-card flow-formula">
            <div className="flow-equation">Risk = f(<span className="h">H</span>, <span className="e">E</span>, <span className="v">V</span>)</div>
            <p>The IPCC (AR5, AR6) frames climate risk as the interaction of hazard, exposure and vulnerability, where vulnerability includes lack of capacity to cope and adapt. The IPCC prescribes no formula, so Prescient uses its own geometric mean of H, E and V, shown out of 100 as a risk index: if nobody is exposed, or there is no thawing permafrost, risk falls to zero.</p>
          </div>
        </li>

        <li className="flow-stage">
          <div className="flow-stage-label"><b>5</b>Map hotspots</div>
          <div className="flow-card flow-hotspot">
            <div className="flow-halo" aria-hidden="true"><i /><i /><i /></div>
            <div>
              <h3>Danger zones</h3>
              <p>High-risk cells join into hotspots that follow the land: the slopes, valleys and coasts that are moving, where people are. Live at Fairbanks and Ulaanbaatar (<Tag status="live" />); elsewhere a glow on a point marks a researched estimate (<Tag status="demo" />).</p>
            </div>
          </div>
        </li>

        <li className="flow-stage">
          <div className="flow-stage-label"><b>6</b>Act, months to years ahead</div>
          <div className="flow-users">
            {USERS.map((user) => <div key={user.who} className="flow-card flow-user"><h3>{user.who}</h3><p>{user.gets}</p></div>)}
          </div>
          <p className="flow-aside">Slow-onset hazards build up over many 12-day passes, so the warning comes early enough to repair, reinforce or relocate. Prescient is not for real-time emergencies. It is the first line of defence: it shows where the ground is turning risky, so governments, NGOs and communities can investigate what it means for homes, roads, water, health and livelihoods.</p>
        </li>
      </ol>

      <section className="how-reuse" aria-labelledby="reuse-title">
        <h2 id="reuse-title">One pipeline, many climate phenomena</h2>
        <p>Only the hazard step changes. Exposure, vulnerability, the risk formula and the hotspot map are shared, so each new phenomenon is one new NISAR measurement away.</p>
        <div className="reuse-diagram">
          <div className="reuse-swap">
            <span className="reuse-label">Swap the hazard</span>
            {PHENOMENA.map((item, index) => (
              <div key={item.name} className={`reuse-item ${index === 0 ? 'ready' : ''}`}>
                <b>{item.name}{index === 0 ? <em>Ready</em> : <em>Soon</em>}</b>
                <span>{item.signal}</span>
                <small>{item.product}</small>
              </div>
            ))}
          </div>
          <div className="reuse-arrow" aria-hidden="true">→</div>
          <div className="reuse-shared">
            <span className="reuse-label">Keep everything else</span>
            <div className="reuse-chip">Exposure</div>
            <div className="reuse-chip">Vulnerability</div>
            <div className="reuse-chip strong">Risk = f(H, E, V)</div>
            <div className="reuse-chip strong">Hotspot map + alerts</div>
          </div>
        </div>
      </section>
    </section>
  );
}
