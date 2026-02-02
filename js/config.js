/**
 * Kanban Configuration
 * Edit these values to connect to your Usable.dev workspace
 */

const CONFIG = {
  // Use local proxy to bypass CORS (run: node server.js)
  API_BASE_URL: '/api',
  API_TOKEN: 'YOUR_USABLE_API_TOKEN_HERE', // Get from usable.dev
  
  // Workspace and fragment type IDs
  WORKSPACE_ID: '7f72369b-0bd7-4bdb-84cf-0eb5b467b1c9',
  FRAGMENT_TYPE_ID: '6eb5d328-ed05-4b14-a3fe-4bb893ab82fc', // Todo type
  
  // Status values used in frontmatter
  STATUSES: {
    TODO: 'todo',
    IN_PROGRESS: 'in-progress',
    DONE: 'done'
  },
  
  // Priority values
  PRIORITIES: ['low', 'medium', 'high'],
  
  // Default tags to include
  DEFAULT_TAGS: ['kloddin', 'todo']
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.STATUSES);
Object.freeze(CONFIG.PRIORITIES);
Object.freeze(CONFIG.DEFAULT_TAGS);
