import { PHENOMENA, PHENOMENON_GROUPS } from '../lib/phenomena';
import type { LngLat } from '../lib/geo';
import { useAppStore } from '../store';
import { ArrowRightIcon } from './Icons';

interface Source { label: string; href: string; note?: string }
interface Story {
  title: string;
  place: string;
  date: string;
  summary: string;
  lesson: string;
  sources: Source[];
  map?: { center: LngLat; radiusKm: number; name: string; region: string };
}

const PERMAFROST_STORIES: Story[] = [
  {
    title: 'Could the Rasuwa flood have been prevented?',
    place: 'Gyirong, Tibet and Rasuwa, Nepal',
    date: '26 August 2026',
    summary: 'A rock and ice avalanche high on the Tibetan side of the border set off a flash flood that tore down the Trishuli valley into Nepal, destroying bridges and homes. Hundreds died. Scientists point to long-term glacier retreat and thawing high-altitude permafrost, which binds rock and ice together, as likely contributors; the exact chain of events is still debated.',
    lesson: 'Slopes that fail suddenly often creep for months first. Repeated radar passes can catch that creep in time to warn.',
    sources: [
      { label: 'The Observer: Could the deadly Nepal flood have been prevented?', href: 'https://observer.co.uk/news/international/article/could-the-deadly-nepal-flood-have-been-prevented-scientists-search-for-answers' },
      { label: 'Science: How scientists unraveled the cause of the flood', href: 'https://www.science.org/content/article/how-scientists-unraveled-cause-devastating-flood-tibet-and-nepal' },
      { label: 'Kathmandu Post: What triggered the Rasuwa flood?', href: 'https://kathmandupost.com/national/2026/08/28/what-triggered-the-rasuwa-flood-scientists-piece-together-a-complex-chain-of-events' },
      { label: 'ICIMOD: Kyirong–Rasuwa flood 2026', href: 'https://www.icimod.org/kyirong-rasuwa-flood-2026-nepal-china-border/' },
      { label: 'Preprint: Physical footprint of the 2026 Gyirong rock-ice cascade (arXiv)', href: 'https://arxiv.org/pdf/2609.04563', note: 'Not yet peer reviewed' },
    ],
    map: { center: [85.33, 28.4], radiusKm: 12, name: 'Gyirong', region: 'Tibet, China' },
  },
  {
    title: 'Norilsk: a fuel tank on thawing ground',
    place: 'Norilsk, Russian Arctic',
    date: '29 May 2020',
    summary: 'A diesel tank at a Norilsk power plant gave way when its supports sank, releasing about 21,000 tonnes of fuel into rivers and tundra. Nornickel blamed thawing permafrost; Russia’s environmental regulator found faults in construction and maintenance, and a court fined the company about 146 billion roubles (around US$2 billion).',
    lesson: 'Warming ground and weak foundations combine. Tracking subsidence under critical infrastructure shows where to reinforce first.',
    sources: [
      { label: 'The Guardian: Russian mining firm accused of using global heating to avoid blame', href: 'https://www.theguardian.com/environment/2020/jun/09/russian-mining-firm-accused-of-using-global-heating-to-avoid-blame-for-oil-spill' },
      { label: 'The Moscow Times: Nornickel fined record $2bn', href: 'https://www.themoscowtimes.com/2021/02/05/nornickel-fined-record-2bln-for-arctic-oil-disaster-a72846' },
      { label: 'The Moscow Times: Report finds tank flaws caused the catastrophe', href: 'https://www.themoscowtimes.com/2020/12/09/arctic-oil-spill-nornickel-failures-tank-flaws-caused-catastrophe-report' },
    ],
    map: { center: [88.2, 69.35], radiusKm: 30, name: 'Norilsk', region: 'Krasnoyarsk Krai, Russia' },
  },
  {
    title: 'Nome: roads sink and bridges tilt',
    place: 'Nome and the Seward Peninsula, Alaska',
    date: 'December 2019',
    summary: 'In the northern Bering Sea region, thawing permafrost is breaking up the roads and runways that remote towns depend on. Stretches of the unpaved highway north of Nome crack and collapse each summer, pilings under a bridge on the Nome–Teller road have tilted, a sinkhole about 14 feet deep opened along a Nome road during the hottest July on record, and the state spent about US$4.5 million patching the thawing ground under Nome’s airport runway.',
    lesson: 'The damage spreads along the infrastructure a town cannot do without. Mapping which stretches are sinking shows where to repair before they fail.',
    sources: [
      { label: 'Pulitzer Center: As climate change melts Alaska’s permafrost, roads sink, bridges tilt and greenhouse gases release', href: 'https://pulitzercenter.org/stories/climate-change-melts-alaskas-permafrost-roads-sink-bridges-tilt-and-greenhouse-gases' },
      { label: 'The Seattle Times, via Phys.org (Hal Bernton, 2019)', href: 'https://phys.org/news/2019-12-climate-alaska-permafrost-roads-bridges.html' },
    ],
    map: { center: [-165.41, 64.5], radiusKm: 10, name: 'Nome', region: 'Alaska, United States' },
  },
  {
    title: 'Denali’s road, cut by a thawing slope',
    place: 'Denali National Park, Alaska',
    date: '2014 – today',
    summary: 'The Pretty Rocks landslide, a rock glacier crossing the park road at Mile 45.4, moved inches per year before 2014, then inches per month, week and day, reaching up to 0.65 inches an hour in 2021. The road closed there in August 2021; a bridge over the slide has been under construction since 2023. The park maps more than 140 unstable slopes along the road.',
    lesson: 'Acceleration is the warning sign. A trend from regular radar passes shows a slope speeding up years before it fails.',
    sources: [
      { label: 'U.S. National Park Service: Landslides in Denali', href: 'https://www.nps.gov/dena/learn/nature/landslides.htm' },
      { label: 'TIME: Climate change and the Denali landslide', href: 'https://time.com/6094213/denali-climate-change-landslide' },
    ],
    map: { center: [-149.55, 63.55], radiusKm: 10, name: 'Pretty Rocks, Denali', region: 'Alaska, United States' },
  },
];

const PAPERS: Source[] = [
  { label: 'Hjort et al. (2018) Degrading permafrost puts Arctic infrastructure at risk by mid-century. Nature Communications 9, 5147', href: 'https://doi.org/10.1038/s41467-018-07557-4' },
  { label: 'Hjort et al. (2022) Impacts of permafrost degradation on infrastructure. Nature Reviews Earth & Environment 3, 24–38', href: 'https://doi.org/10.1038/s43017-021-00247-8' },
  { label: 'Biskaborn et al. (2019) Permafrost is warming at a global scale. Nature Communications 10, 264', href: 'https://doi.org/10.1038/s41467-018-08240-4' },
  { label: 'Gruber & Haeberli (2007) Permafrost in steep bedrock slopes and its temperature-related destabilization following climate change. JGR Earth Surface 112', href: 'https://doi.org/10.1029/2006JF000547' },
];

export function StoriesPage() {
  const setMode = useAppStore((state) => state.setMode);
  const requestFocus = useAppStore((state) => state.requestFocus);
  const showOnMap = (map: NonNullable<Story['map']>) => {
    setMode('explore');
    // Wait for the More page to fold away and the map to mount.
    window.setTimeout(() => requestFocus(map.center, map.radiusKm, { name: map.name, region: map.region, center: map.center }), 700);
  };

  return (
    <main id="main-content" className="more-page">
      <header className="more-hero">
        <span className="more-kicker">More stories</span>
        <h1>Climate change, told by the ground</h1>
        <p>Real events behind each climate phenomenon. Permafrost thaw is ready to explore on the map; the other phenomena are coming soon.</p>
      </header>

      <section className="more-section">
        <h2>Permafrost thaw <span className="status status-real">Ready</span></h2>
        <div className="story-cards">
          {PERMAFROST_STORIES.map((story) => (
            <article key={story.title} className="story-card">
              <span className="story-meta">{story.place} · {story.date}</span>
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
              <p className="story-lesson">{story.lesson}</p>
              <ul className="story-sources">
                {story.sources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a>{source.note && <small>{source.note}</small>}</li>)}
              </ul>
              {story.map && <button className="text-link story-map-link" onClick={() => showOnMap(story.map!)}>See it on the map <ArrowRightIcon /></button>}
            </article>
          ))}
        </div>
        <div className="papers">
          <h3>Research behind it</h3>
          <ul className="story-sources">{PAPERS.map((paper) => <li key={paper.href}><a href={paper.href} target="_blank" rel="noreferrer">{paper.label} ↗</a></li>)}</ul>
        </div>
      </section>

      {PHENOMENON_GROUPS.map((group) => (
        <section key={group.id} className="more-section">
          <h2>{group.label}</h2>
          <p className="more-intro">{group.hint}</p>
          <div className="soon-grid">
            {PHENOMENA.filter((item) => item.group === group.id && !item.available).map((item) => (
              <div key={item.id} className="soon-card"><b>{item.label}</b><span>Stories coming soon</span></div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
