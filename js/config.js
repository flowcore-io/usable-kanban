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

  // Initialize config by loading values from server
  async init() {
    try {
      const res = await fetch('/config');
      const data = await res.json();
      CONFIG.API_TOKEN = data.API_TOKEN || '';
      CONFIG.WORKSPACE_ID = data.WORKSPACE_ID || '';
      CONFIG.FRAGMENT_TYPE_ID = data.FRAGMENT_TYPE_ID || '';
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }
};

// Freeze nested objects
Object.freeze(CONFIG.STATUSES);
Object.freeze(CONFIG.PRIORITIES);
Object.freeze(CONFIG.DEFAULT_TAGS);
