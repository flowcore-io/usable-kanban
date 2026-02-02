# Usable Kanban

A beautiful, local-only Kanban board that syncs with [Usable.dev](https://usable.dev) Todo fragments.

![Kanban Board](https://img.shields.io/badge/vanilla-HTML%2FCSS%2FJS-blue)
![No Dependencies](https://img.shields.io/badge/dependencies-0-green)

## Features

- 🎯 **Three-column board**: Todo → In Progress → Done
- 🖱️ **Drag & drop**: Smooth animations when moving cards
- ✨ **Real-time sync**: Reads and writes to Usable.dev API
- 🎨 **Dark theme**: Modern, minimal design
- ⌨️ **Keyboard shortcuts**: `Ctrl/Cmd + N` to add task, `Esc` to close modal
- 📱 **Responsive**: Works on any screen size
- 🚫 **No dependencies**: Pure vanilla HTML/CSS/JS

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/kloddin0905/usable-kanban.git
   cd usable-kanban
   ```

2. **Configure your API token**
   
   Edit `js/config.js` and replace the placeholder values:
   ```javascript
   const CONFIG = {
     API_TOKEN: 'YOUR_USABLE_API_TOKEN_HERE',  // Get from usable.dev
     WORKSPACE_ID: 'your-workspace-id',
     FRAGMENT_TYPE_ID: 'your-todo-fragment-type-id'
   };
   ```

3. **Run locally**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve
   
   # Using PHP
   php -S localhost:8000
   ```

4. **Open in browser**
   
   Navigate to `http://localhost:8000`

## Usage

### Adding Tasks
- Click the **"Add Task"** button or press `Ctrl/Cmd + N`
- Fill in the title, summary, priority, and details
- Click **"Save Task"**

### Moving Tasks
- **Drag and drop** cards between columns
- Status updates automatically sync to Usable.dev

### Editing Tasks
- **Click** on any card to open the edit modal
- Update fields and click **"Save Task"**

### Deleting Tasks
- Open a task for editing
- Click the **"Delete"** button
- Confirm deletion

## Fragment Structure

Tasks are stored as Usable.dev fragments with YAML frontmatter:

```yaml
---
status: todo | in-progress | done
priority: low | medium | high
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
├── css/
│   └── main.css    # All styles with design tokens
├── js/
│   ├── config.js   # Configuration (API keys, IDs)
│   ├── api.js      # Usable.dev API client
│   └── kanban.js   # Main application logic
└── README.md
```

## Security Note

This app is designed for **local use only**. The API token is stored in plain text in `config.js`. Never deploy this to a public server without implementing proper authentication.

## License

MIT
