import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const framesDir = path.join(root, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const W = 1280;
const H = 720;

const palette = {
  ink: '#07110d',
  deep: '#0d1e16',
  green: '#1f7a61',
  mint: '#dce9df',
  paper: '#f7f4e8',
  cream: '#fbf9ef',
  line: '#d1d4c8',
  blue: '#315f9b',
  amber: '#bb7a24',
  plum: '#6e4b73',
  red: '#b14d3a',
  black: '#10130f'
};

const phases = [
  ['hook', '#1f7a61', [
    ['Most AI stops at chat.', 'Wingman keeps going.', 'hero'],
    ['A request lands.', 'It becomes work.', 'chat'],
    ['Chat -> task.', 'Context stays attached.', 'flow'],
    ['Task -> agent.', 'Fresh worker, clear brief.', 'agent'],
    ['Agent -> app.', 'The right interface opens.', 'wapp'],
    ['App -> result.', 'Back where the team works.', 'result'],
    ['This is not a bot.', 'It is an operating layer.', 'hero'],
    ['AI that runs work.', 'People stay in control.', 'system']
  ]],
  ['flight deck', '#315f9b', [
    ['Flight Deck is the cockpit.', 'Humans and agents share one surface.', 'deck'],
    ['Threads become tasks.', 'No work disappears into chat.', 'chat'],
    ['Boards show status.', 'Ready, doing, review, shipped.', 'board'],
    ['Comments carry evidence.', 'Decisions are inspectable.', 'comments'],
    ['Docs sit beside work.', 'Context is not a scavenger hunt.', 'docs'],
    ['Files stay attached.', 'Screens, audio, notes, artifacts.', 'files'],
    ['Approvals slow the risk.', 'Not the whole system.', 'approval'],
    ['Agents report back.', 'The handoff is visible.', 'handoff'],
    ['Launch the app.', 'From the same workspace.', 'launcher'],
    ['Flight Deck is control.', 'Not another inbox.', 'deck']
  ]],
  ['autopilot', '#bb7a24', [
    ['Autopilot is runtime.', 'Sessions, workers, pipelines, triggers.', 'terminal'],
    ['Start a session.', 'Give it a real goal.', 'agent'],
    ['Dispatch a worker.', 'Focused repo, focused outcome.', 'dispatch'],
    ['Run a pipeline.', 'Repeat the process.', 'pipeline'],
    ['Trigger from events.', 'Schedules, tasks, chats, apps.', 'trigger'],
    ['Validate with commands.', 'Evidence before confidence.', 'terminal'],
    ['Host managed apps.', 'Ports, aliases, live links.', 'apps'],
    ['Keep runs observable.', 'Logs, state, handoffs.', 'observability'],
    ['Autopilot makes AI repeatable.', 'The work can run again.', 'pipeline'],
    ['Prompts become process.', 'Process becomes infrastructure.', 'system']
  ]],
  ['tower', '#6e4b73', [
    ['Tower is the record.', 'The durable truth underneath.', 'tower'],
    ['Auth is signed.', 'Workspace access is explicit.', 'auth'],
    ['Tasks are typed records.', 'Agents and humans use the same state.', 'records'],
    ['Messages are addressable.', 'Threads do not vanish.', 'messages'],
    ['Docs have bodies.', 'Comments have anchors.', 'docs'],
    ['Files have storage.', 'Metadata and object access.', 'storage'],
    ['Memory becomes graph.', 'Evidence, people, repos, decisions.', 'graph'],
    ['APIs are the boundary.', 'Apps build on shared state.', 'api'],
    ['Tower keeps trust.', 'Durable, permissioned, queryable.', 'tower'],
    ['Everything has a place.', 'So agents can work safely.', 'records']
  ]],
  ['wapps', '#b14d3a', [
    ['WApps are the unlock.', 'When chat is too small.', 'wapp'],
    ['Custom intake.', 'The workflow gets a home.', 'intake'],
    ['Research console.', 'Agents enrich the case.', 'research'],
    ['Proposal builder.', 'Human approves the package.', 'proposal'],
    ['Ops dashboard.', 'Live status without digging.', 'dashboard'],
    ['Pipeline control.', 'Run, inspect, retry, approve.', 'pipelineApp'],
    ['Client-specific UI.', 'Without bloating Flight Deck.', 'custom'],
    ['Agents can use the app.', 'People can use it too.', 'sharedApp'],
    ['Ship the workflow.', 'Not just the prompt.', 'ship'],
    ['WApps make it real.', 'Business-specific AI systems.', 'wapp']
  ]],
  ['examples', '#1f7a61', [
    ['A lead comes in.', 'Kindling starts research.', 'research'],
    ['The task appears.', 'Flight Deck tracks ownership.', 'board'],
    ['A worker investigates.', 'Autopilot runs the session.', 'terminal'],
    ['Tower recalls context.', 'Graph memory returns evidence.', 'graph'],
    ['A WApp opens.', 'The team works in the right shape.', 'wapp'],
    ['A draft is generated.', 'The app exposes the choices.', 'proposal'],
    ['Approval is requested.', 'Humans decide the risk.', 'approval'],
    ['Result is attached.', 'Files, comments, artifact.', 'handoff'],
    ['The process repeats.', 'Next client, same system.', 'pipeline'],
    ['This is operating leverage.', 'Not chat theatre.', 'hero']
  ]],
  ['close', '#10130f', [
    ['One request.', 'Many coordinated surfaces.', 'flow'],
    ['One machine.', 'Agents, apps, memory, workflows.', 'system'],
    ['One workspace.', 'People can see and steer.', 'deck'],
    ['One record.', 'Tower keeps the truth.', 'tower'],
    ['One runtime.', 'Autopilot runs the work.', 'terminal'],
    ['One extension model.', 'WApps shape the business.', 'launcher'],
    ['AI chat was the start.', 'AI operations is the move.', 'hero'],
    ['Wingman Suite.', 'AI that actually runs work.', 'final'],
    ['Build the system.', 'Run the work.', 'final'],
    ['Wingman.', 'From chat to operations.', 'final']
  ]]
];

const shots = phases.flatMap(([phase, color, items]) =>
  items.map(([headline, subline, layout], index) => ({ phase, color, headline, subline, layout, index }))
);
const duration = 120 / shots.length;

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function words(text, max = 22) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

function textBlock(text, x, y, size, color, weight = 700, max = 20, leading = 1.05, family = 'Impact') {
  const lines = words(text, max);
  return `<text x="${x}" y="${y}" font-family="${family}, Arial Black, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="0">${lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * leading}">${esc(line)}</tspan>`)
    .join('')}</text>`;
}

function label(text, x, y, color) {
  return `<text x="${x}" y="${y}" font-family="Verdana, Arial, sans-serif" font-size="18" font-weight="700" fill="${color}" letter-spacing="2">${esc(text.toUpperCase())}</text>`;
}

function pill(text, x, y, fill = palette.deep, stroke = 'none') {
  return `<rect x="${x}" y="${y}" width="188" height="54" rx="8" fill="${fill}" stroke="${stroke}"/><text x="${x + 18}" y="${y + 34}" font-family="Verdana, Arial, sans-serif" font-size="18" font-weight="700" fill="${palette.cream}">${esc(text)}</text>`;
}

function card(x, y, w, h, title, body = '', accent = palette.green) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${palette.cream}" stroke="${palette.line}"/>
    <rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${accent}"/>
    <text x="${x + 24}" y="${y + 34}" font-family="Verdana, Arial, sans-serif" font-size="20" font-weight="700" fill="${palette.black}">${esc(title)}</text>
    <text x="${x + 24}" y="${y + 62}" font-family="Verdana, Arial, sans-serif" font-size="15" fill="#555b53">${esc(body)}</text>`;
}

function browserFrame(x, y, w, h, title, inner) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#eef0e8" stroke="#cfd4c6"/>
    <rect x="${x}" y="${y}" width="${w}" height="44" rx="12" fill="#10130f"/>
    <circle cx="${x + 24}" cy="${y + 22}" r="6" fill="#b14d3a"/><circle cx="${x + 44}" cy="${y + 22}" r="6" fill="#bb7a24"/><circle cx="${x + 64}" cy="${y + 22}" r="6" fill="#1f7a61"/>
    <text x="${x + 92}" y="${y + 29}" font-family="Verdana, Arial, sans-serif" font-size="15" font-weight="700" fill="#f7f4e8">${esc(title)}</text>
    ${inner}`;
}

function visual(layout, color, n) {
  const c = color;
  if (layout === 'hero') {
    return `<path d="M760 0 L1280 0 L1280 720 L520 720 Z" fill="${palette.paper}" opacity="0.94"/>
      <path d="M828 112 C1030 86 1170 154 1224 330 C1110 268 950 294 830 422 C724 536 620 596 500 610 C604 472 652 256 828 112 Z" fill="${c}" opacity="0.28"/>
      ${pill('Flight Deck', 830, 160, palette.deep)}
      ${pill('Autopilot', 900, 238, c)}
      ${pill('Tower', 830, 316, palette.plum)}
      ${pill('WApps', 900, 394, palette.red)}`;
  }
  if (layout === 'chat') {
    return browserFrame(690, 96, 480, 470, 'Flight Deck / Chat',
      `${card(722, 164, 384, 70, 'Pete', 'Can this become a working system?', c)}
       ${card(762, 254, 384, 70, 'wm21', 'Created task, attached context.', palette.blue)}
       ${card(722, 344, 384, 70, 'Agent', 'Worker dispatched with evidence.', palette.amber)}
       ${card(762, 434, 384, 70, 'Result', 'Ready for review in thread.', palette.green)}`);
  }
  if (layout === 'flow') {
    return `${['Request', 'Task', 'Agent', 'App', 'Result'].map((t, i) => {
      const x = 670 + i * 112;
      return `<circle cx="${x}" cy="${250 + (i % 2) * 90}" r="42" fill="${i === n % 5 ? c : palette.cream}" stroke="${palette.line}" stroke-width="3"/>
        <text x="${x}" y="${256 + (i % 2) * 90}" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="15" font-weight="700" fill="${i === n % 5 ? palette.cream : palette.black}">${t}</text>
        ${i < 4 ? `<path d="M${x + 48} ${250 + (i % 2) * 90} L${x + 64} ${250 + ((i + 1) % 2) * 90}" stroke="${c}" stroke-width="5" fill="none"/>` : ''}`;
    }).join('')}`;
  }
  if (layout === 'board' || layout === 'deck') {
    return browserFrame(650, 82, 540, 510, 'Flight Deck / Task Board',
      ['Ready', 'Doing', 'Review'].map((col, i) => {
        const x = 680 + i * 166;
        return `<rect x="${x}" y="150" width="146" height="378" rx="8" fill="#ffffff" stroke="${palette.line}"/>
          <text x="${x + 14}" y="180" font-family="Verdana, Arial, sans-serif" font-size="16" font-weight="700" fill="${palette.black}">${col}</text>
          ${card(x + 12, 204, 122, 74, ['Lead brief', 'Worker run', 'Artifact v2'][i], ['Context', 'Validation', 'Feedback'][i], [palette.blue, palette.amber, palette.green][i])}
          ${card(x + 12, 294, 122, 74, ['Approval', 'Fix', 'Ship'][i], ['Human gate', 'Patch', 'Handoff'][i], c)}`;
      }).join(''));
  }
  if (layout === 'terminal' || layout === 'agent' || layout === 'dispatch') {
    return browserFrame(648, 92, 548, 470, 'Autopilot / Session',
      `<rect x="684" y="154" width="476" height="346" rx="8" fill="#07110d"/>
      ${['goal: show Wingman power', 'dispatch: worker session', 'pipeline: run visual cut', 'validate: smoke ok', 'handoff: artifact ready'].map((line, i) =>
        `<text x="716" y="${204 + i * 52}" font-family="Menlo, Consolas, monospace" font-size="22" fill="${i === n % 5 ? '#49d49d' : '#dce9df'}">$ ${esc(line)}</text>`
      ).join('')}`);
  }
  if (layout === 'pipeline' || layout === 'trigger' || layout === 'observability') {
    return browserFrame(650, 82, 540, 510, 'Autopilot / Pipeline',
      `${['Trigger', 'Brief', 'Agent', 'Validate', 'Report'].map((t, i) => {
        const y = 150 + i * 72;
        return `<rect x="724" y="${y}" width="332" height="50" rx="25" fill="${i === n % 5 ? c : '#ffffff'}" stroke="${palette.line}"/>
          <text x="890" y="${y + 32}" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="18" font-weight="700" fill="${i === n % 5 ? palette.cream : palette.black}">${t}</text>
          ${i < 4 ? `<path d="M890 ${y + 54} L890 ${y + 70}" stroke="${c}" stroke-width="4"/>` : ''}`;
      }).join('')}`);
  }
  if (layout === 'tower' || layout === 'records' || layout === 'api' || layout === 'auth' || layout === 'messages' || layout === 'storage') {
    return browserFrame(650, 88, 540, 500, 'Tower / System Record',
      `<rect x="686" y="154" width="468" height="64" rx="8" fill="${palette.deep}"/>
       <text x="710" y="194" font-family="Verdana, Arial, sans-serif" font-size="22" font-weight="700" fill="${palette.cream}">workspace state</text>
       ${['tasks', 'threads', 'docs', 'files', 'comments', 'groups', 'storage', 'auth'].map((t, i) => {
        const x = 686 + (i % 2) * 238;
        const y = 238 + Math.floor(i / 2) * 72;
        return `<rect x="${x}" y="${y}" width="218" height="48" rx="8" fill="${i === n % 8 ? c : '#fff'}" stroke="${palette.line}"/>
          <text x="${x + 18}" y="${y + 31}" font-family="Verdana, Arial, sans-serif" font-size="17" font-weight="700" fill="${i === n % 8 ? palette.cream : palette.black}">${t}</text>`;
      }).join('')}`);
  }
  if (layout === 'graph' || layout === 'research') {
    return browserFrame(650, 82, 540, 510, 'Tower / Graph Memory',
      `${['Pete', 'Wingman', 'Task', 'Repo', 'Artifact', 'Client'].map((t, i) => {
        const pts = [[760,210],[935,170],[1034,288],[906,412],[732,390],[814,300]][i];
        return `<circle cx="${pts[0]}" cy="${pts[1]}" r="${i === n % 6 ? 58 : 42}" fill="${i === n % 6 ? c : palette.cream}" stroke="${palette.line}" stroke-width="3"/>
          <text x="${pts[0]}" y="${pts[1]+6}" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="16" font-weight="700" fill="${i === n % 6 ? palette.cream : palette.black}">${t}</text>`;
      }).join('')}
      <path d="M760 210 L935 170 L1034 288 L906 412 L732 390 L814 300 L935 170 M814 300 L1034 288" stroke="${c}" stroke-width="4" opacity="0.7" fill="none"/>`);
  }
  if (layout === 'wapp' || layout === 'intake' || layout === 'proposal' || layout === 'dashboard' || layout === 'pipelineApp' || layout === 'custom' || layout === 'sharedApp' || layout === 'ship' || layout === 'apps' || layout === 'launcher') {
    return browserFrame(646, 76, 552, 528, 'Wingman Apps',
      `<rect x="682" y="146" width="482" height="82" rx="10" fill="${palette.deep}"/>
       <text x="710" y="196" font-family="Verdana, Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.cream}">${esc(['Client Intake','Research Console','Proposal Builder','Ops Dashboard'][n % 4])}</text>
       ${['Run pipeline', 'Review evidence', 'Approve draft', 'Send result'].map((t, i) =>
        `<rect x="${704 + (i % 2) * 218}" y="${260 + Math.floor(i / 2) * 108}" width="194" height="78" rx="10" fill="${i === n % 4 ? c : '#fff'}" stroke="${palette.line}"/>
         <text x="${724 + (i % 2) * 218}" y="${306 + Math.floor(i / 2) * 108}" font-family="Verdana, Arial, sans-serif" font-size="18" font-weight="700" fill="${i === n % 4 ? palette.cream : palette.black}">${t}</text>`
       ).join('')}`);
  }
  if (layout === 'approval' || layout === 'handoff' || layout === 'result' || layout === 'comments' || layout === 'docs' || layout === 'files') {
    return browserFrame(660, 88, 520, 486, 'Review Surface',
      `${card(704, 158, 392, 78, 'Evidence attached', 'Screenshot, command, artifact.', c)}
       ${card(744, 260, 392, 78, 'Human approval', 'Approve, revise, or block.', palette.amber)}
       ${card(704, 362, 392, 78, 'Result returned', 'Back to the thread and task.', palette.green)}`);
  }
  return '';
}

function frameSvg(shot, i) {
  const { phase, color, headline, subline, layout } = shot;
  const marker = `${String(i + 1).padStart(2, '0')} / ${shots.length}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#07110d" flood-opacity="0.22"/>
      </filter>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#07110d"/>
        <stop offset="58%" stop-color="#11281d"/>
        <stop offset="100%" stop-color="#f7f4e8"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="${120 + (i % 6) * 70}" cy="${90 + (i % 4) * 38}" r="170" fill="${color}" opacity="0.18"/>
    <path d="M0 566 C260 464 426 612 628 496 C804 394 884 210 1280 262 L1280 720 L0 720 Z" fill="#f7f4e8" opacity="0.09"/>
    <rect x="46" y="42" width="52" height="52" rx="26" fill="${palette.paper}"/>
    <text x="72" y="76" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="27" fill="${palette.ink}">W</text>
    ${label(`Wingman Suite / ${phase}`, 116, 74, palette.mint)}
    <text x="1168" y="74" font-family="Verdana, Arial, sans-serif" font-size="18" font-weight="700" fill="${palette.mint}" opacity="0.85">${marker}</text>
    <g filter="url(#shadow)">${visual(layout, color, i)}</g>
    <rect x="54" y="140" width="540" height="430" rx="8" fill="rgba(7,17,13,0.14)"/>
    ${textBlock(headline, 72, 260, headline.length > 24 ? 62 : 76, palette.cream, 400, 16, 0.95)}
    ${textBlock(subline, 76, 452, 29, '#dce9df', 700, 22, 1.18, 'Verdana')}
    <rect x="72" y="612" width="${Math.max(44, ((i + 1) / shots.length) * 1040)}" height="8" rx="4" fill="${color}"/>
    <rect x="72" y="612" width="1040" height="8" rx="4" fill="none" stroke="rgba(247,244,232,0.3)"/>
  </svg>`;
}

const concatLines = [];
shots.forEach((shot, i) => {
  const stem = `frame-${String(i).padStart(3, '0')}`;
  const svgPath = path.join(framesDir, `${stem}.svg`);
  const pngPath = path.join(framesDir, `${stem}.png`);
  fs.writeFileSync(svgPath, frameSvg(shot, i));
  execFileSync('convert', [svgPath, pngPath], { stdio: 'inherit' });
  concatLines.push(`file '${pngPath.replaceAll("'", "'\\''")}'`);
  concatLines.push(`duration ${duration}`);
});
concatLines.push(`file '${path.join(framesDir, `frame-${String(shots.length - 1).padStart(3, '0')}.png`).replaceAll("'", "'\\''")}'`);
fs.writeFileSync(path.join(root, 'frames.txt'), `${concatLines.join('\n')}\n`);

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', path.join(root, 'frames.txt'),
    '-t', '120',
    '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-movflags', '+faststart',
    path.join(root, 'wingman-suite-showoff-v2.mp4')
  ],
  { stdio: 'inherit' }
);

fs.copyFileSync(path.join(framesDir, 'frame-000.png'), path.join(root, 'poster.png'));
fs.writeFileSync(path.join(root, 'shotlist.json'), JSON.stringify(shots.map((shot, i) => ({
  shot: i + 1,
  time: `${(i * duration).toFixed(1)}-${((i + 1) * duration).toFixed(1)}s`,
  phase: shot.phase,
  headline: shot.headline,
  subline: shot.subline,
  layout: shot.layout
})), null, 2));
