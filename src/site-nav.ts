// The site header, shared by every page so the sections, the theme toggle and the
// spacing can't drift apart. The homepage draws its own markup (its sections are
// in-page views, so they're buttons there) but uses the same stylesheet.

export type NavSection = 'api' | 'subscriptions' | 'rankings' | 'about' | null;

const SUN_MOON = `
    <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`;

/** The theme button's icons; the homepage puts them in its own button. */
export const THEME_ICONS = SUN_MOON;

/** The header for every page but the homepage: the sections link back to its views. */
export function siteNav(active: NavSection): string {
  const link = (section: NavSection, href: string, label: string) =>
    `<a href="${href}" class="nav-link${active === section ? ' active' : ''}"${active === section ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav>
  <a href="/" class="nav-brand"><span class="diamond" aria-hidden="true">◈</span><span>token.app</span></a>
  <div class="nav-links">
    ${link('api', '/', 'Models')}
    ${link('subscriptions', '/#subscriptions', 'Subscriptions')}
    ${link('rankings', '/#rankings', 'Rankings')}
    ${link('about', '/about', 'About')}
  </div>
  <div class="nav-meta">
    <button type="button" class="theme-btn" onclick="toggleTheme()" title="Toggle light/dark theme" aria-label="Toggle light/dark theme">${SUN_MOON}
    </button>
  </div>
</nav>
<script>function toggleTheme(){var n=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(e){}}</script>`;
}

export const SITE_NAV_CSS = `
    /* ── Nav ── The side padding lines the brand up with a 1200px page column. */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--nav-bg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 0 max(24px, calc((100% - 1152px) / 2));
      height: 60px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
    }
    .nav-brand {
      justify-self: start;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 650;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.01em;
    }
    .nav-brand .diamond { color: var(--accent); font-size: 16px; line-height: 1; }
    .nav-links { display: flex; align-items: center; gap: 4px; }
    .nav-link {
      display: inline-block;
      line-height: 20px;
      padding: 6px 12px;
      border: 0;
      border-radius: 6px;
      background: none;
      color: var(--text2);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      transition: color 0.15s, background-color 0.15s;
    }
    .nav-link:hover { color: var(--text); }
    .nav-link.active { color: var(--text); background: var(--surface2); }
    .nav-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .nav-meta {
      justify-self: end;
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 13px;
      color: var(--text3);
    }
    .updated-badge { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    .updated-badge .pulse {
      width: 6px; height: 6px;
      background: var(--green);
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .theme-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--border2);
      background: var(--surface2);
      color: var(--text2);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
    }
    .theme-btn:hover { background: var(--border); border-color: var(--text3); color: var(--text); transform: rotate(15deg); }
    .theme-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .theme-btn svg { display: block; pointer-events: none; }
    .theme-btn .icon-moon { display: block; }
    .theme-btn .icon-sun  { display: none; }
    html[data-theme="light"] .theme-btn .icon-moon { display: none; }
    html[data-theme="light"] .theme-btn .icon-sun  { display: block; }

    @media (max-width: 768px) {
      /* Brand and theme on top, the sections on a row of their own */
      nav {
        height: auto;
        padding: 10px 16px 0;
        grid-template-columns: 1fr auto;
        row-gap: 6px;
      }
      .nav-links { grid-column: 1 / -1; grid-row: 2; margin: 0 -16px; padding: 0 12px 8px; overflow-x: auto; scrollbar-width: none; }
      .nav-links::-webkit-scrollbar { display: none; }
      .updated-badge { display: none; }
    }`;
