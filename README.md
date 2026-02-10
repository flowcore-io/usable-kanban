# Usable Kanban

A beautiful, local-only Kanban board that syncs with [Usable.dev](https://usable.dev) Todo fragments.

![Kanban Board](https://img.shields.io/badge/vanilla-HTML%2FCSS%2FJS-blue)
![No Dependencies](https://img.shields.io/badge/dependencies-0-green)

## Features

- **Three-column board**: Todo, In Progress, Done
- **Drag & drop**: Reorder cards within and across columns with visual drop indicators
- **Card size toggle**: Switch between large, medium, and small card views
- **Settings UI**: Configure API token, workspace, and fragment type from the browser
- **Real-time sync**: Reads and writes to Usable.dev API
- **Dark theme**: Modern, minimal design
- **Keyboard shortcuts**: `Ctrl/Cmd + N` to add task, `Esc` to close modal
- **No dependencies**: Pure vanilla HTML/CSS/JS

## Setup

1. **Clone and start the server**
   ```bash
   git clone https://github.com/flowcore-io/usable-kanban.git
   cd usable-kanban
   node server.js
   ```

2. **Open in browser**

   Navigate to `http://localhost:8888`

3. **Configure settings**

   Click the gear icon in the header, enter your Usable.dev API token, and click **Load**. Select your workspace and fragment type from the dropdowns, then click **Save Settings**.

   Settings are stored in your browser's localStorage.

   Alternatively, you can create a `.env` file (see `.env.example`) to provide default values that will be used when localStorage is empty.

## Usage

### Adding Tasks
- Click **"Add Task"** or press `Ctrl/Cmd + N`
- Use the **"+ Add task"** button at the bottom of any column to add directly to that status

### Moving Tasks
- **Drag and drop** cards between columns
- A visual indicator shows where the card will be placed
- Status and sort order sync automatically to Usable.dev

### Editing Tasks
- **Click** on any card to open the edit modal

### Deleting Tasks
- Open a task for editing and click **"Delete"**

### Card Sizes
Use the toggle in the header to switch between:
- **Large** — title, summary, priority, and tags
- **Medium** — title, priority, and tags
- **Small** — title only (single line with priority indicator)

## Fragment Structure

Tasks are stored as Usable.dev fragments with YAML frontmatter:

```yaml
---
status: todo | in-progress | done
priority: low | medium | high
sort: 1234567890
---

Task details and notes go here...
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Add new task |
| `Esc` | Close modal |

## Tech Stack

- **HTML5** — Semantic markup with ARIA attributes
- **CSS3** — Custom properties, Grid, Flexbox, animations
- **Vanilla JS** — ES6+ classes, Fetch API, Drag & Drop API
- **BEM** — Block Element Modifier methodology

## Project Structure

```
usable-kanban/
├── index.html      # Main HTML file
├── favicon.svg     # Kanban board favicon
├── server.js       # Local proxy server (bypasses CORS)
├── .env.example    # Environment variable template
├── css/
│   └── main.css    # All styles with design tokens
└── js/
    ├── config.js   # Configuration (localStorage + env fallback)
    ├── api.js      # Usable.dev API client
    └── kanban.js   # Main application logic
```

## Security Note

This app is designed for **local use only**. The API token is stored in localStorage in your browser. Never deploy this to a public server without implementing proper authentication.

## License

MIT
