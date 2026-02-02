/**
 * Usable.dev API Client
 * Handles all communication with the Usable.dev API
 */

const UsableAPI = {
  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${CONFIG.API_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }
    
    return response.json();
  },
  
  /**
   * Fetch all Todo fragments from the workspace
   * @returns {Promise<Array>} List of todo fragments
   */
  async getTodos() {
    const data = await this.request(
      `/memory-fragments?workspaceId=${CONFIG.WORKSPACE_ID}&fragmentTypeId=${CONFIG.FRAGMENT_TYPE_ID}&limit=100`
    );
    return data.fragments || [];
  },
  
  /**
   * Create a new Todo fragment
   * @param {Object} todo - Todo data
   * @returns {Promise<Object>} Created fragment
   */
  async createTodo(todo) {
    const content = this.buildContent(todo);
    
    const data = await this.request('/memory-fragments', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: CONFIG.WORKSPACE_ID,
        fragmentTypeId: CONFIG.FRAGMENT_TYPE_ID,
        title: todo.title,
        summary: todo.summary || '',
        content: content,
        tags: this.buildTags(todo.tags)
      })
    });
    
    return data;
  },
  
  /**
   * Update an existing Todo fragment
   * @param {string} id - Fragment ID
   * @param {Object} todo - Updated todo data
   * @returns {Promise<Object>} Updated fragment
   */
  async updateTodo(id, todo) {
    const content = this.buildContent(todo);
    
    const data = await this.request(`/memory-fragments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: todo.title,
        summary: todo.summary || '',
        content: content,
        tags: this.buildTags(todo.tags)
      })
    });
    
    return data;
  },
  
  /**
   * Delete a Todo fragment
   * @param {string} id - Fragment ID
   * @returns {Promise<void>}
   */
  async deleteTodo(id) {
    await this.request(`/memory-fragments/${id}`, {
      method: 'DELETE'
    });
  },
  
  /**
   * Build YAML frontmatter content
   * @param {Object} todo - Todo data
   * @returns {string} Formatted content with frontmatter
   */
  buildContent(todo) {
    const frontmatter = [
      '---',
      `status: ${todo.status || CONFIG.STATUSES.TODO}`,
      `priority: ${todo.priority || 'medium'}`,
      '---'
    ].join('\n');
    
    const body = todo.content || '';
    
    return `${frontmatter}\n\n${body}`;
  },
  
  /**
   * Build tags array with defaults
   * @param {Array|string} tags - User-provided tags
   * @returns {Array} Tags array with defaults
   */
  buildTags(tags) {
    let tagArray = [];
    
    if (typeof tags === 'string') {
      tagArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    } else if (Array.isArray(tags)) {
      tagArray = tags.map(t => t.trim().toLowerCase()).filter(Boolean);
    }
    
    // Add default tags if not present
    const allTags = new Set([...CONFIG.DEFAULT_TAGS, ...tagArray]);
    return Array.from(allTags);
  },
  
  /**
   * Parse fragment content to extract frontmatter and body
   * @param {string} content - Raw content with frontmatter
   * @returns {Object} Parsed data { status, priority, body }
   */
  parseContent(content) {
    const result = {
      status: CONFIG.STATUSES.TODO,
      priority: 'medium',
      body: ''
    };
    
    if (!content) return result;
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.body = frontmatterMatch[2].trim();
      
      // Parse status
      const statusMatch = frontmatter.match(/status:\s*(.+)/);
      if (statusMatch) {
        result.status = statusMatch[1].trim();
      }
      
      // Parse priority
      const priorityMatch = frontmatter.match(/priority:\s*(.+)/);
      if (priorityMatch) {
        result.priority = priorityMatch[1].trim();
      }
    } else {
      result.body = content;
    }
    
    return result;
  }
};
