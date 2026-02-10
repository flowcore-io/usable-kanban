/**
 * Kanban Configuration
 * Edit these values to connect to your Usable.dev workspace
 */

const CONFIG = {
  // Use local proxy to bypass CORS (run: node server.js)
  API_BASE_URL: '/api',
  API_TOKEN: '', // Loaded dynamically from server

  // Workspace and fragment type IDs (loaded dynamically from server)
  WORKSPACE_ID: '',
  FRAGMENT_TYPE_ID: '',

  // Status values used in frontmatter
  STATUSES: {
    TODO: 'todo',
    IN_PROGRESS: 'in-progress',
    DONE: 'done'
  },

  // Priority values
  PRIORITIES: ['low', 'medium', 'high'],

  // Default tags to include
  DEFAULT_TAGS: ['kloddin', 'todo'],

  // Initialize config: localStorage takes priority, server env as fallback
  async init() {
    // Load server defaults
    let serverDefaults = {};
    try {
      const res = await fetch('/config');
      serverDefaults = await res.json();
    } catch (err) {
      console.error('Failed to load server config:', err);
    }

    CONFIG.API_TOKEN = localStorage.getItem('kanban-api-token') || serverDefaults.API_TOKEN || '';
    CONFIG.WORKSPACE_ID = localStorage.getItem('kanban-workspace-id') || serverDefaults.WORKSPACE_ID || '';
    CONFIG.FRAGMENT_TYPE_ID = localStorage.getItem('kanban-fragment-type-id') || serverDefaults.FRAGMENT_TYPE_ID || '';
  },

  // Save settings to localStorage and update config
  saveSettings(token, workspaceId, fragmentTypeId) {
    localStorage.setItem('kanban-api-token', token);
    localStorage.setItem('kanban-workspace-id', workspaceId);
    localStorage.setItem('kanban-fragment-type-id', fragmentTypeId);
    CONFIG.API_TOKEN = token;
    CONFIG.WORKSPACE_ID = workspaceId;
    CONFIG.FRAGMENT_TYPE_ID = fragmentTypeId;
  }
};

// Freeze nested objects
Object.freeze(CONFIG.STATUSES);
Object.freeze(CONFIG.PRIORITIES);
Object.freeze(CONFIG.DEFAULT_TAGS);
