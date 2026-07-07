/**
 * Sample content shaped exactly like the Phase 3 MongoDB schema
 * (Diary / Category collections), so this is a drop-in stand-in until
 * the public pages are wired to live API endpoints in a later phase.
 */
(function () {
  const categories = [
    {
      slug: 'bug-fixes',
      name: 'Bug Fixes',
      description: 'Root causes chased down and squashed.',
      color: '#f87171',
    },
    {
      slug: 'learning',
      name: 'Learning',
      description: 'New concepts, courses, and rabbit holes.',
      color: '#34d399',
    },
    {
      slug: 'side-projects',
      name: 'Side Projects',
      description: 'Late-night builds and weekend experiments.',
      color: '#5b9cff',
    },
    {
      slug: 'career',
      name: 'Career',
      description: 'Interviews, reviews, and the long game.',
      color: '#fb923c',
    },
    {
      slug: 'tooling',
      name: 'Tooling',
      description: 'Editor configs, scripts, and workflow tweaks.',
      color: '#c084fc',
    },
  ];

  const entries = [
    {
      id: 'e9',
      title: 'Finally found the memory leak',
      date: '2026-06-28',
      category: 'bug-fixes',
      mood: 'great',
      tags: ['nodejs', 'profiling', 'memory'],
      excerpt:
        'Three days of chasing a slow leak in the worker process. Turned out to be an uncleared interval holding a closure over the whole request object.',
      content:
        'Three days of chasing a slow leak in the worker process. Turned out to be an uncleared interval holding a closure over the whole request object.\n\nHeap snapshots in Chrome DevTools finally made it obvious once I compared two snapshots twenty minutes apart — the same "detached" request objects kept piling up. Once I saw the pattern, the fix was a single clearInterval() in the cleanup path.\n\nLesson: always take the first heap snapshot earlier than you think you need to. The leak is often visible way before it becomes a symptom.',
    },
    {
      id: 'e8',
      title: 'Started the Rust course again',
      date: '2026-06-24',
      category: 'learning',
      mood: 'good',
      tags: ['rust', 'ownership'],
      excerpt:
        'Third attempt at really understanding the borrow checker. This time it clicked when I stopped fighting it and started thinking in terms of who owns what.',
      content:
        'Third attempt at really understanding the borrow checker. This time it clicked when I stopped fighting it and started thinking in terms of who owns what.\n\nThe exercise that finally made it land: writing a small linked list without Rc/RefCell first, feeling the pain, and then reaching for them once the pain justified it instead of starting there.\n\nNext up: async Rust, which I hear is a whole second borrow-checker boss fight.',
    },
    {
      id: 'e7',
      title: 'Diary app: database schema day',
      date: '2026-06-20',
      category: 'side-projects',
      mood: 'good',
      tags: ['mongodb', 'schema-design'],
      excerpt:
        'Spent the evening designing the Diary, Category, and Image collections for this very app. Went back and forth on embedding vs referencing images twice.',
      content:
        'Spent the evening designing the Diary, Category, and Image collections for this very app. Went back and forth on embedding vs referencing images twice.\n\nSettled on a separate Image collection so a photo can exist independently before being attached to an entry — closer to how the upload flow actually works in the UI.\n\nAdded a compound index on administrator + date since "my entries, most recent first" is the only query that will ever really matter here.',
    },
    {
      id: 'e6',
      title: 'Offer accepted',
      date: '2026-06-15',
      category: 'career',
      mood: 'great',
      tags: ['job-search', 'milestone'],
      excerpt:
        'After four months of interviews, an offer finally landed that felt right — not just the compensation, but the actual day-to-day of the role.',
      content:
        'After four months of interviews, an offer finally landed that felt right — not just the compensation, but the actual day-to-day of the role.\n\nBiggest lesson from this search: the system design rounds got dramatically easier once I started sketching diagrams out loud instead of narrating them from memory.\n\nGiving two weeks notice tomorrow. Equal parts relief and nostalgia.',
    },
    {
      id: 'e5',
      title: 'Neovim config cleanup',
      date: '2026-06-09',
      category: 'tooling',
      mood: 'neutral',
      tags: ['neovim', 'lua', 'dotfiles'],
      excerpt:
        'Migrated the last few Vimscript plugins over to Lua equivalents. Startup time dropped from 180ms to 40ms, which matters more than it should psychologically.',
      content:
        'Migrated the last few Vimscript plugins over to Lua equivalents. Startup time dropped from 180ms to 40ms, which matters more than it should psychologically.\n\nAlso finally set up a proper LSP config instead of copy-pasting from three-year-old blog posts. Half the plugins I was using turned out to be redundant with built-in LSP features now.',
    },
    {
      id: 'e4',
      title: 'The off-by-one that cost an afternoon',
      date: '2026-06-03',
      category: 'bug-fixes',
      mood: 'bad',
      tags: ['pagination', 'testing'],
      excerpt:
        'A pagination bug that only showed up on exactly the last page, for exactly one specific page size. Classic boundary condition, expensive to isolate.',
      content:
        'A pagination bug that only showed up on exactly the last page, for exactly one specific page size. Classic boundary condition, expensive to isolate.\n\nWriting a property-based test after the fact would have caught this in seconds instead of the hour it took to find manually. Adding that to the test suite this week as a preventive measure, not just a fix.',
    },
    {
      id: 'e3',
      title: 'Reading through the Postgres source',
      date: '2026-05-28',
      category: 'learning',
      mood: 'good',
      tags: ['postgres', 'internals'],
      excerpt:
        'Started poking around the query planner source out of curiosity after a slow query at work. Deeper rabbit hole than expected, in the best way.',
      content:
        'Started poking around the query planner source out of curiosity after a slow query at work. Deeper rabbit hole than expected, in the best way.\n\nUnderstanding how the planner estimates row counts from statistics explains so many "why did it pick that index" mysteries from the past few years.',
    },
    {
      id: 'e2',
      title: 'Weekend project: a CLI habit tracker',
      date: '2026-05-20',
      category: 'side-projects',
      mood: 'great',
      tags: ['cli', 'go', 'sqlite'],
      excerpt:
        'Built a tiny Go CLI to log daily habits into a local SQLite file. No UI, no server, just a binary and a database file that lives in my home folder.',
      content:
        'Built a tiny Go CLI to log daily habits into a local SQLite file. No UI, no server, just a binary and a database file that lives in my home folder.\n\nThere is something deeply satisfying about a tool with zero external dependencies at runtime. Might add a "streak" view next weekend if the motivation holds.',
    },
    {
      id: 'e1',
      title: 'First entry',
      date: '2026-05-12',
      category: 'career',
      mood: 'neutral',
      tags: ['meta'],
      excerpt:
        'Decided to start keeping an actual log of what I build, break, and learn — mostly for my future self, and partly because the pattern-matching only shows up in hindsight.',
      content:
        'Decided to start keeping an actual log of what I build, break, and learn — mostly for my future self, and partly because the pattern-matching only shows up in hindsight.\n\nNo particular format yet. Just going to write what actually happened and see what shape it takes over time.',
    },
  ];

  window.DiaryMockData = { categories, entries };
})();
