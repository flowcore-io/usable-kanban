/**
 * Kanban Board Application
 * Main application logic for the Usable.dev Kanban board
 */

class KanbanBoard {
  constructor() {
    this.todos = [];
    this.draggedCard = null;
    this.draggedCardData = null;
    this.dropIndicator = null;
    this.chatPollInterval = null;
    this.chatDocked = localStorage.getItem('kanban-chat-docked') === 'true';

    // DOM elements
    this.board = document.getElementById('board');
    this.modal = document.getElementById('task-modal');
    this.form = document.getElementById('task-form');
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsForm = document.getElementById('settings-form');
    this.toast = document.getElementById('toast');
    this.loading = document.getElementById('loading');
    this.taskCount = document.getElementById('task-count');

    this.cardSize = localStorage.getItem('kanban-card-size') || 'small';

    this.createDropIndicator();
    this.init();
    this.applyCardSize(this.cardSize);
  }

  /**
   * Create the drop indicator element
   */
  createDropIndicator() {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'drop-indicator';
    this.dropIndicator.style.display = 'none';
  }
  
  /**
   * Initialize the application
   */
  async init() {
    this.bindEvents();

    // Re-send JWT to embed whenever the token changes (refresh, re-auth)
    UsableAuth._onTokenChange = () => this.sendAuthToEmbed();

    // Handle OAuth callback redirect
    const wasCallback = await UsableAuth.handleCallback();

    // If not a callback, try restoring session from stored refresh token
    if (!wasCallback) {
      await UsableAuth.tryRestore();
    }

    this.updateAuthUI();

    // Send JWT to embed if already loaded
    if (UsableAuth.isAuthenticated()) {
      this.sendAuthToEmbed();
    }
    await this.loadTodos();
  }
  
  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Header buttons
    document.getElementById('add-btn').addEventListener('click', () => this.openModal());
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadTodos());

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
    document.getElementById('settings-load-btn').addEventListener('click', () => this.loadWorkspaces());
    document.getElementById('settings-workspace').addEventListener('change', (e) => this.loadFragmentTypes(e.target.value));
    this.settingsModal.querySelectorAll('[data-close-settings]').forEach(el => {
      el.addEventListener('click', () => this.closeSettings());
    });
    this.settingsForm.addEventListener('submit', (e) => this.handleSettingsSave(e));

    // Card size toggle
    document.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => this.applyCardSize(btn.dataset.size));
    });

    // Column add buttons
    document.querySelectorAll('[data-add-status]').forEach(btn => {
      btn.addEventListener('click', () => this.openModal(null, btn.dataset.addStatus));
    });
    
    // Modal close buttons
    this.modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => this.closeModal());
    });
    
    // Form submission
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Delete button
    document.getElementById('delete-btn').addEventListener('click', () => this.handleDelete());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeModal(); this.closeSettings(); }
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.openModal();
      }
    });
    
    // Auth buttons
    document.getElementById('login-btn').addEventListener('click', () => UsableAuth.login());
    document.getElementById('logout-btn').addEventListener('click', () => UsableAuth.logout());

    // PostMessage listener for chat embed auth
    window.addEventListener('message', async (e) => {
      if (e.origin !== 'https://chat.usable.dev') return;

      if (e.data?.type === 'READY') {
        this.sendAuthToEmbed();
        this.registerChatTools();
      }

      if (e.data?.type === 'REQUEST_TOKEN_REFRESH') {
        await UsableAuth.refreshToken();
        this.sendAuthToEmbed();
      }

      if (e.data?.type === 'TOOL_CALL') {
        this.handleToolCall(e.data.payload);
      }

      if (e.data?.type === 'TOOLS_REGISTERED') {
        console.log('Chat tools registered:', e.data.payload);
      }
    });

    // Chat widget toggle
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');
    const chatIconChat = chatFab.querySelector('.chat-fab__icon--chat');
    const chatIconClose = chatFab.querySelector('.chat-fab__icon--close');
    chatFab.addEventListener('click', () => {
      const isOpen = chatPanel.classList.toggle('chat-panel--open');
      chatIconChat.style.display = isOpen ? 'none' : '';
      chatIconClose.style.display = isOpen ? '' : 'none';
      chatFab.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');

      // Send JWT + register tools when panel opens (in case READY was missed)
      if (isOpen) {
        this.applyDockState();
        this.sendAuthToEmbed();
        this.registerChatTools();
        this.chatPollInterval = setInterval(() => this.refreshSilently(), 5000);
      } else {
        clearInterval(this.chatPollInterval);
        this.chatPollInterval = null;
        // Remove docked layout when panel closes
        document.body.classList.remove('chat-docked');
        document.getElementById('chat-panel').classList.remove('chat-panel--docked');
      }
    });

    // Chat dock toggle
    document.getElementById('chat-dock-btn').addEventListener('click', () => this.toggleDock());

    // Setup drop zones
    this.setupDropZones();
  }
  
  /**
   * Setup drag and drop for all columns
   */
  setupDropZones() {
    const dropzones = document.querySelectorAll('[data-dropzone]');
    
    dropzones.forEach(zone => {
      zone.addEventListener('dragover', (e) => this.handleDragOver(e));
      zone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
      zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      zone.addEventListener('drop', (e) => this.handleDrop(e));
    });
  }
  
  /**
   * Load todos from API and render
   */
  async loadTodos() {
    this.showLoading();
    
    try {
      this.todos = await UsableAPI.getTodos();
      this.renderBoard();
      this.showToast('Tasks loaded', 'success');
    } catch (error) {
      console.error('Failed to load todos:', error);
      this.showToast('Failed to load tasks', 'error');
    } finally {
      this.hideLoading();
    }
  }
  
  /**
   * Silently refresh todos (no loading spinner or toast)
   */
  async refreshSilently() {
    try {
      const todos = await UsableAPI.getTodos();
      if (JSON.stringify(todos) !== JSON.stringify(this.todos)) {
        this.todos = todos;
        this.renderBoard();
        this.sendBoardContext();
      }
    } catch (_) {
      // Ignore errors during silent refresh
    }
  }

  /**
   * Render the entire board
   */
  renderBoard() {
    // Clear all columns
    document.querySelectorAll('[data-dropzone]').forEach(zone => {
      zone.innerHTML = '';
    });
    
    // Group todos by status
    const grouped = {
      [CONFIG.STATUSES.TODO]: [],
      [CONFIG.STATUSES.IN_PROGRESS]: [],
      [CONFIG.STATUSES.DONE]: []
    };
    
    this.todos.forEach(todo => {
      const parsed = UsableAPI.parseContent(todo.content);
      const status = parsed.status || CONFIG.STATUSES.TODO;

      // Skip deleted items
      if (status === 'deleted') return;

      if (grouped[status]) {
        grouped[status].push({ ...todo, parsed });
      } else {
        grouped[CONFIG.STATUSES.TODO].push({ ...todo, parsed });
      }
    });
    
    // Render each group (sorted by sort field)
    Object.entries(grouped).forEach(([status, todos]) => {
      const zone = document.querySelector(`[data-dropzone="${status}"]`);
      const countEl = document.querySelector(`[data-count="${status}"]`);

      // Sort by sort field (ascending)
      todos.sort((a, b) => (a.parsed.sort || 0) - (b.parsed.sort || 0));

      if (zone) {
        todos.forEach((todo, index) => {
          const card = this.createCard(todo);
          card.style.animationDelay = `${index * 50}ms`;
          card.classList.add('card--entering');
          zone.appendChild(card);
        });
      }

      if (countEl) {
        countEl.textContent = todos.length;
      }
    });
    
    // Update total count
    this.taskCount.textContent = `${this.todos.length} task${this.todos.length !== 1 ? 's' : ''}`;
  }
  
  /**
   * Create a card element for a todo
   * @param {Object} todo - Todo data with parsed content
   * @returns {HTMLElement} Card element
   */
  createCard(todo) {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.dataset.id = todo.id;
    
    const priority = todo.parsed.priority || 'medium';
    const priorityLetter = priority[0].toUpperCase();
    const tags = (todo.tags || []).filter(t => !CONFIG.DEFAULT_TAGS.includes(t));

    card.innerHTML = `
      <h3 class="card__title">${this.escapeHtml(todo.title)}</h3>
      <span class="card__priority-compact card__priority-compact--${priority}">${priorityLetter}</span>
      ${todo.summary ? `<p class="card__summary">${this.escapeHtml(todo.summary)}</p>` : ''}
      <div class="card__footer">
        <span class="card__priority card__priority--${priority}">${priority}</span>
        ${tags.length ? `
          <div class="card__tags">
            ${tags.slice(0, 3).map(t => `<span class="card__tag">${this.escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
    
    // Drag events
    card.addEventListener('dragstart', (e) => this.handleDragStart(e, todo));
    card.addEventListener('dragend', (e) => this.handleDragEnd(e));
    
    // Click to edit
    card.addEventListener('click', () => this.openModal(todo));
    
    return card;
  }
  
  /**
   * Handle drag start
   */
  handleDragStart(e, todo) {
    this.draggedCard = e.target;
    this.draggedCardData = todo;
    
    e.target.classList.add('card--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todo.id);
    
    // Add dragging class to body for global styling
    document.body.classList.add('is-dragging');
  }
  
  /**
   * Handle drag end
   */
  handleDragEnd(e) {
    e.target.classList.remove('card--dragging');
    document.body.classList.remove('is-dragging');

    // Remove all drag-over states
    document.querySelectorAll('.column__cards--drag-over').forEach(el => {
      el.classList.remove('column__cards--drag-over');
    });

    // Hide drop indicator
    this.hideDropIndicator();

    this.draggedCard = null;
    this.draggedCardData = null;
  }

  /**
   * Hide the drop indicator
   */
  hideDropIndicator() {
    this.dropIndicator.style.display = 'none';
    if (this.dropIndicator.parentElement) {
      this.dropIndicator.parentElement.removeChild(this.dropIndicator);
    }
  }
  
  /**
   * Handle drag over
   */
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const zone = e.target.closest('[data-dropzone]');
    if (!zone || !this.draggedCard) return;

    // Position the drop indicator
    this.positionDropIndicator(zone, e.clientY);
  }

  /**
   * Position the drop indicator based on mouse position
   * @param {HTMLElement} zone - The dropzone element
   * @param {number} mouseY - The mouse Y position
   */
  positionDropIndicator(zone, mouseY) {
    const cards = Array.from(zone.querySelectorAll('.card:not(.card--dragging)'));

    // Ensure indicator is in this zone
    if (this.dropIndicator.parentElement !== zone) {
      zone.appendChild(this.dropIndicator);
    }
    this.dropIndicator.style.display = 'block';

    // Find insertion point
    let insertBeforeCard = null;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const cardMiddle = rect.top + rect.height / 2;
      if (mouseY < cardMiddle) {
        insertBeforeCard = card;
        break;
      }
    }

    // Position the indicator
    if (insertBeforeCard) {
      zone.insertBefore(this.dropIndicator, insertBeforeCard);
    } else {
      zone.appendChild(this.dropIndicator);
    }
  }
  
  /**
   * Handle drag enter
   */
  handleDragEnter(e) {
    e.preventDefault();
    const zone = e.target.closest('[data-dropzone]');
    if (zone) {
      zone.classList.add('column__cards--drag-over');
    }
  }
  
  /**
   * Handle drag leave
   */
  handleDragLeave(e) {
    const zone = e.target.closest('[data-dropzone]');
    if (zone && !zone.contains(e.relatedTarget)) {
      zone.classList.remove('column__cards--drag-over');
      // Hide indicator when leaving the zone
      if (this.dropIndicator.parentElement === zone) {
        this.dropIndicator.style.display = 'none';
      }
    }
  }
  
  /**
   * Handle drop
   */
  async handleDrop(e) {
    e.preventDefault();

    const zone = e.target.closest('[data-dropzone]');
    if (!zone || !this.draggedCardData) return;

    zone.classList.remove('column__cards--drag-over');

    const newStatus = zone.dataset.dropzone;
    const oldStatus = this.draggedCardData.parsed.status;

    // Find drop position based on indicator position
    const cards = Array.from(zone.querySelectorAll('.card:not(.card--dragging)'));
    const indicatorIndex = Array.from(zone.children).indexOf(this.dropIndicator);
    let dropIndex = cards.length; // Default to end

    // Calculate drop index based on indicator position
    if (indicatorIndex >= 0) {
      let cardsBefore = 0;
      for (let i = 0; i < indicatorIndex; i++) {
        if (zone.children[i].classList.contains('card') && !zone.children[i].classList.contains('card--dragging')) {
          cardsBefore++;
        }
      }
      dropIndex = cardsBefore;
    }

    // Hide the indicator
    this.hideDropIndicator();

    // Calculate new sort value
    const newSort = this.calculateSortValue(zone, dropIndex);

    // Check if anything changed
    const statusChanged = newStatus !== oldStatus;
    const sortChanged = newSort !== this.draggedCardData.parsed.sort;

    if (!statusChanged && !sortChanged) return;

    // Optimistic UI update
    if (this.draggedCard) {
      this.draggedCard.remove();
      if (cards[dropIndex]) {
        zone.insertBefore(this.draggedCard, cards[dropIndex]);
      } else {
        zone.appendChild(this.draggedCard);
      }
    }

    // Update in API
    try {
      await UsableAPI.updateTodo(this.draggedCardData.id, {
        title: this.draggedCardData.title,
        summary: this.draggedCardData.summary,
        status: newStatus,
        priority: this.draggedCardData.parsed.priority,
        sort: newSort,
        content: this.draggedCardData.parsed.body,
        tags: this.draggedCardData.tags
      });

      // Update local data
      this.draggedCardData.parsed.status = newStatus;
      this.draggedCardData.parsed.sort = newSort;

      // Update counts
      this.updateCounts();

      this.showToast('Task moved', 'success');
    } catch (error) {
      console.error('Failed to update task:', error);
      this.showToast('Failed to move task', 'error');
      // Reload to restore correct state
      await this.loadTodos();
    }
  }

  /**
   * Calculate sort value for a drop position
   * @param {HTMLElement} zone - The dropzone element
   * @param {number} index - The target index
   * @returns {number} New sort value
   */
  calculateSortValue(zone, index) {
    const cards = Array.from(zone.querySelectorAll('.card:not(.card--dragging)'));

    // Get sort values of surrounding cards
    const prevCard = cards[index - 1];
    const nextCard = cards[index];

    const prevSort = prevCard ? this.getCardSort(prevCard.dataset.id) : 0;
    const nextSort = nextCard ? this.getCardSort(nextCard.dataset.id) : Date.now();

    // Calculate midpoint
    return Math.floor((prevSort + nextSort) / 2);
  }

  /**
   * Get sort value for a card by ID
   * @param {string} id - Card ID
   * @returns {number} Sort value
   */
  getCardSort(id) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      const parsed = UsableAPI.parseContent(todo.content);
      return parsed.sort || 0;
    }
    return 0;
  }
  
  /**
   * Update column counts
   */
  updateCounts() {
    const counts = {
      [CONFIG.STATUSES.TODO]: 0,
      [CONFIG.STATUSES.IN_PROGRESS]: 0,
      [CONFIG.STATUSES.DONE]: 0
    };
    
    document.querySelectorAll('[data-dropzone]').forEach(zone => {
      const status = zone.dataset.dropzone;
      counts[status] = zone.querySelectorAll('.card').length;
    });
    
    Object.entries(counts).forEach(([status, count]) => {
      const el = document.querySelector(`[data-count="${status}"]`);
      if (el) el.textContent = count;
    });
  }
  
  /**
   * Open the task modal
   * @param {Object} todo - Optional todo for editing
   * @param {string} status - Optional status for new tasks
   */
  openModal(todo = null, status = null) {
    const isEditing = !!todo;

    document.getElementById('modal-title').textContent = isEditing ? 'Edit Task' : 'Add Task';
    document.getElementById('delete-btn').style.display = isEditing ? 'block' : 'none';

    if (isEditing) {
      document.getElementById('task-id').value = todo.id;
      document.getElementById('task-title').value = todo.title || '';
      document.getElementById('task-summary').value = todo.summary || '';
      document.getElementById('task-status').value = todo.parsed.status || CONFIG.STATUSES.TODO;
      document.getElementById('task-priority').value = todo.parsed.priority || 'medium';
      document.getElementById('task-content').value = todo.parsed.body || '';
      document.getElementById('task-tags').value = (todo.tags || [])
        .filter(t => !CONFIG.DEFAULT_TAGS.includes(t))
        .join(', ');
    } else {
      this.form.reset();
      document.getElementById('task-id').value = '';
      document.getElementById('task-status').value = status || CONFIG.STATUSES.TODO;
    }

    this.modal.setAttribute('aria-hidden', 'false');
    document.getElementById('task-title').focus();
  }
  
  /**
   * Close the task modal
   */
  closeModal() {
    this.modal.setAttribute('aria-hidden', 'true');
  }
  
  /**
   * Handle form submission
   */
  async handleSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('task-id').value;
    const existing = id ? this.todos.find(t => t.id === id) : null;
    const todoData = {
      title: document.getElementById('task-title').value,
      summary: document.getElementById('task-summary').value,
      status: document.getElementById('task-status').value,
      priority: document.getElementById('task-priority').value,
      content: document.getElementById('task-content').value,
      tags: document.getElementById('task-tags').value,
      sort: existing ? UsableAPI.parseContent(existing.content).sort : undefined
    };
    
    this.showLoading();
    
    try {
      if (id) {
        await UsableAPI.updateTodo(id, todoData);
        this.showToast('Task updated', 'success');
      } else {
        await UsableAPI.createTodo(todoData);
        this.showToast('Task created', 'success');
      }
      
      this.closeModal();
      await this.loadTodos();
    } catch (error) {
      console.error('Failed to save task:', error);
      this.showToast('Failed to save task', 'error');
    } finally {
      this.hideLoading();
    }
  }
  
  /**
   * Handle task deletion (soft-delete)
   */
  async handleDelete() {
    const id = document.getElementById('task-id').value;
    if (!id) return;

    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;

    if (!confirm('Are you sure you want to delete this task?')) return;

    this.showLoading();

    try {
      await UsableAPI.deleteTodo(id, {
        title: todo.title,
        summary: todo.summary,
        priority: todo.parsed?.priority,
        content: todo.parsed?.body,
        tags: todo.tags
      });
      this.showToast('Task deleted', 'success');
      this.closeModal();
      await this.loadTodos();
    } catch (error) {
      console.error('Failed to delete task:', error);
      this.showToast('Failed to delete task', 'error');
    } finally {
      this.hideLoading();
    }
  }
  
  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'success' or 'error'
   */
  showToast(message, type = 'success') {
    this.toast.textContent = message;
    this.toast.className = `toast toast--visible toast--${type}`;
    
    setTimeout(() => {
      this.toast.classList.remove('toast--visible');
    }, 3000);
  }
  
  /**
   * Show loading overlay
   */
  showLoading() {
    this.loading.classList.add('loading--visible');
  }
  
  /**
   * Hide loading overlay
   */
  hideLoading() {
    this.loading.classList.remove('loading--visible');
  }
  
  /**
   * Open settings modal
   */
  openSettings() {
    const tokenInput = document.getElementById('settings-token');
    const workspaceSelect = document.getElementById('settings-workspace');
    const fragmentTypeSelect = document.getElementById('settings-fragment-type');

    tokenInput.value = CONFIG.API_TOKEN;

    // Reset dropdowns
    workspaceSelect.innerHTML = '<option value="">Enter token and click Load</option>';
    workspaceSelect.disabled = true;
    fragmentTypeSelect.innerHTML = '<option value="">Select a workspace first</option>';
    fragmentTypeSelect.disabled = true;

    this.settingsModal.setAttribute('aria-hidden', 'false');

    // Auto-load if token exists
    if (CONFIG.API_TOKEN) {
      this.loadWorkspaces();
    }
  }

  /**
   * Close settings modal
   */
  closeSettings() {
    this.settingsModal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Load workspaces from API using the entered token
   */
  async loadWorkspaces() {
    const token = document.getElementById('settings-token').value.trim();
    const workspaceSelect = document.getElementById('settings-workspace');
    const fragmentTypeSelect = document.getElementById('settings-fragment-type');

    if (!token) {
      this.showToast('Enter an API token first', 'error');
      return;
    }

    workspaceSelect.innerHTML = '<option value="">Loading...</option>';
    workspaceSelect.disabled = true;

    try {
      const data = await UsableAPI.getWorkspaces(token);
      const workspaces = data.workspaces || data || [];

      workspaceSelect.innerHTML = '<option value="">Select a workspace</option>';
      workspaces.forEach(ws => {
        const opt = document.createElement('option');
        opt.value = ws.id;
        opt.textContent = ws.name;
        if (ws.id === CONFIG.WORKSPACE_ID) opt.selected = true;
        workspaceSelect.appendChild(opt);
      });
      workspaceSelect.disabled = false;

      // Auto-load fragment types if a workspace is already selected
      if (CONFIG.WORKSPACE_ID && workspaceSelect.value) {
        await this.loadFragmentTypes(workspaceSelect.value);
      }
    } catch (err) {
      workspaceSelect.innerHTML = '<option value="">Failed to load</option>';
      this.showToast('Failed to load workspaces', 'error');
    }
  }

  /**
   * Load fragment types for a workspace
   */
  async loadFragmentTypes(workspaceId) {
    const token = document.getElementById('settings-token').value.trim();
    const fragmentTypeSelect = document.getElementById('settings-fragment-type');

    if (!workspaceId) {
      fragmentTypeSelect.innerHTML = '<option value="">Select a workspace first</option>';
      fragmentTypeSelect.disabled = true;
      return;
    }

    fragmentTypeSelect.innerHTML = '<option value="">Loading...</option>';
    fragmentTypeSelect.disabled = true;

    try {
      const data = await UsableAPI.getFragmentTypes(token, workspaceId);
      const types = data.fragmentTypes || data || [];

      fragmentTypeSelect.innerHTML = '<option value="">Select a fragment type</option>';
      types.forEach(ft => {
        const opt = document.createElement('option');
        opt.value = ft.id;
        opt.textContent = ft.name;
        if (ft.id === CONFIG.FRAGMENT_TYPE_ID) opt.selected = true;
        fragmentTypeSelect.appendChild(opt);
      });
      fragmentTypeSelect.disabled = false;

      // Auto-select: saved value > "Todo" > "Knowledge"
      if (!fragmentTypeSelect.value) {
        const todoType = types.find(ft => ft.name.toLowerCase() === 'todo');
        const knowledgeType = types.find(ft => ft.name.toLowerCase() === 'knowledge');
        const fallback = todoType || knowledgeType;
        if (fallback) fragmentTypeSelect.value = fallback.id;
      }
    } catch (err) {
      fragmentTypeSelect.innerHTML = '<option value="">Failed to load</option>';
      this.showToast('Failed to load fragment types', 'error');
    }
  }

  /**
   * Save settings and reload
   */
  async handleSettingsSave(e) {
    e.preventDefault();
    const token = document.getElementById('settings-token').value.trim();
    const workspaceId = document.getElementById('settings-workspace').value;
    const fragmentTypeId = document.getElementById('settings-fragment-type').value;

    if (!token || !workspaceId || !fragmentTypeId) {
      this.showToast('Please fill in all settings', 'error');
      return;
    }

    CONFIG.saveSettings(token, workspaceId, fragmentTypeId);
    this.closeSettings();
    this.showToast('Settings saved', 'success');
    await this.loadTodos();
  }

  /**
   * Apply card size and update toggle buttons
   * @param {string} size - 'large', 'medium', or 'small'
   */
  applyCardSize(size) {
    this.cardSize = size;
    localStorage.setItem('kanban-card-size', size);

    this.board.classList.remove('board--large', 'board--medium', 'board--small');
    this.board.classList.add(`board--${size}`);

    document.querySelectorAll('[data-size]').forEach(btn => {
      btn.classList.toggle('size-toggle__btn--active', btn.dataset.size === size);
    });
  }

  /**
   * Toggle docked/floating chat mode
   */
  toggleDock() {
    this.chatDocked = !this.chatDocked;
    localStorage.setItem('kanban-chat-docked', this.chatDocked);
    this.applyDockState();
  }

  /**
   * Apply the current dock state to the DOM
   */
  applyDockState() {
    const chatPanel = document.getElementById('chat-panel');
    const dockIcon = document.querySelector('.chat-panel__dock-icon--dock');
    const undockIcon = document.querySelector('.chat-panel__dock-icon--undock');
    const dockBtn = document.getElementById('chat-dock-btn');

    chatPanel.classList.toggle('chat-panel--docked', this.chatDocked);
    document.body.classList.toggle('chat-docked', this.chatDocked);
    dockIcon.style.display = this.chatDocked ? 'none' : '';
    undockIcon.style.display = this.chatDocked ? '' : 'none';
    dockBtn.setAttribute('aria-label', this.chatDocked ? 'Undock chat' : 'Dock to side');
    dockBtn.setAttribute('title', this.chatDocked ? 'Undock chat' : 'Dock to side');
  }

  /**
   * Post a message to the chat embed iframe
   * @param {Object} message - Message to send
   */
  postToEmbed(message) {
    const iframe = document.getElementById('usable-chat');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(message, 'https://chat.usable.dev');
    }
  }

  /**
   * Send the current JWT to the chat embed iframe
   */
  sendAuthToEmbed() {
    const token = UsableAuth.getAccessToken();
    if (!token) return;
    this.postToEmbed({ type: 'AUTH', payload: { token } });
  }

  /**
   * Get tool definitions for the chat embed
   * @returns {Array} Tool schemas
   */
  getChatToolDefinitions() {
    return [
      {
        name: 'list_tasks',
        description: 'List all tasks on the kanban board. Optionally filter by status (todo, in-progress, done).',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['todo', 'in-progress', 'done'],
              description: 'Filter tasks by status column'
            }
          }
        }
      },
      {
        name: 'get_task',
        description: 'Get a single task by its ID. Returns full details including title, summary, status, priority, content, and tags.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The task ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task on the kanban board.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            summary: { type: 'string', description: 'Short summary' },
            status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Initial status column (default: todo)' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level (default: medium)' },
            content: { type: 'string', description: 'Detailed description / notes (markdown)' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the task' }
          },
          required: ['title']
        }
      },
      {
        name: 'update_task',
        description: 'Update an existing task. Only the provided fields are changed. Does NOT change the status column — use move_task for that.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The task ID' },
            title: { type: 'string', description: 'New title' },
            summary: { type: 'string', description: 'New summary' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority' },
            content: { type: 'string', description: 'New detailed description / notes' },
            tags: { type: 'array', items: { type: 'string' }, description: 'New tags (replaces existing)' }
          },
          required: ['id']
        }
      },
      {
        name: 'move_task',
        description: 'Move a task to a different status column on the board.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The task ID' },
            status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Target status column' }
          },
          required: ['id', 'status']
        }
      },
      {
        name: 'delete_task',
        description: 'Delete a task from the kanban board (soft-delete).',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The task ID' }
          },
          required: ['id']
        }
      }
    ];
  }

  /**
   * Build a text summary of the current board state for the chat AI
   * @returns {string} Board context description
   */
  getBoardContext() {
    const tasks = this.todos
      .map(t => ({ ...t, parsed: UsableAPI.parseContent(t.content) }))
      .filter(t => t.parsed.status !== 'deleted');

    const grouped = { todo: [], 'in-progress': [], done: [] };
    tasks.forEach(t => {
      if (grouped[t.parsed.status]) grouped[t.parsed.status].push(t);
    });

    const lines = [
      'You are embedded in a Kanban board app. The board has 3 columns: To Do, In Progress, and Done.',
      'IMPORTANT: Always use the registered parent tools (list_tasks, get_task, create_task, update_task, move_task, delete_task) for ALL kanban operations. Do NOT use MCP fragment tools — the kanban status (todo/in-progress/done) is stored in YAML frontmatter inside the fragment content, not in the fragment API status field.',
      '',
      `Current board: ${tasks.length} tasks total — To Do: ${grouped.todo.length}, In Progress: ${grouped['in-progress'].length}, Done: ${grouped.done.length}`,
      ''
    ];

    Object.entries(grouped).forEach(([status, items]) => {
      if (!items.length) return;
      lines.push(`## ${status} (${items.length})`);
      items.forEach(t => {
        const priority = t.parsed.priority || 'medium';
        const tags = (t.tags || []).filter(tg => !CONFIG.DEFAULT_TAGS.includes(tg));
        lines.push(`- [${priority}] "${t.title}" (id: ${t.id})${tags.length ? ' tags: ' + tags.join(', ') : ''}`);
      });
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Register tools and context with the chat embed
   */
  registerChatTools() {
    this.postToEmbed({
      type: 'REGISTER_TOOLS',
      payload: { tools: this.getChatToolDefinitions() }
    });
    this.postToEmbed({
      type: 'ADD_CONTEXT',
      payload: {
        items: [
          { contextType: 'workspace', contextId: CONFIG.WORKSPACE_ID },
          { contextType: 'text', text: this.getBoardContext() }
        ]
      }
    });
  }

  /**
   * Send updated board context to the chat embed
   */
  sendBoardContext() {
    this.postToEmbed({
      type: 'ADD_CONTEXT',
      payload: {
        items: [{ contextType: 'text', text: this.getBoardContext() }]
      }
    });
  }

  /**
   * Handle a tool call from the chat embed
   * @param {Object} payload - { requestId, tool, input }
   */
  async handleToolCall(payload) {
    const { requestId, tool, input } = payload;

    try {
      let result;

      switch (tool) {
        case 'list_tasks': {
          const tasks = this.todos
            .map(t => ({ ...t, parsed: UsableAPI.parseContent(t.content) }))
            .filter(t => t.parsed.status !== 'deleted');
          const filtered = input?.status
            ? tasks.filter(t => t.parsed.status === input.status)
            : tasks;
          result = filtered.map(t => ({
            id: t.id,
            title: t.title,
            summary: t.summary,
            status: t.parsed.status,
            priority: t.parsed.priority,
            tags: (t.tags || []).filter(tg => !CONFIG.DEFAULT_TAGS.includes(tg))
          }));
          break;
        }

        case 'get_task': {
          const todo = this.todos.find(t => t.id === input.id);
          if (!todo) throw new Error(`Task not found: ${input.id}`);
          const parsed = UsableAPI.parseContent(todo.content);
          result = {
            id: todo.id,
            title: todo.title,
            summary: todo.summary,
            status: parsed.status,
            priority: parsed.priority,
            content: parsed.body,
            tags: (todo.tags || []).filter(tg => !CONFIG.DEFAULT_TAGS.includes(tg))
          };
          break;
        }

        case 'create_task': {
          await UsableAPI.createTodo({
            title: input.title,
            summary: input.summary || input.title,
            status: input.status || CONFIG.STATUSES.TODO,
            priority: input.priority || 'medium',
            content: input.content || '',
            tags: input.tags || []
          });
          await this.loadTodos();
          this.showToast('Task created by chat', 'success');
          result = { success: true, message: `Task "${input.title}" created` };
          break;
        }

        case 'update_task': {
          const existing = this.todos.find(t => t.id === input.id);
          if (!existing) throw new Error(`Task not found: ${input.id}`);
          const existingParsed = UsableAPI.parseContent(existing.content);
          await UsableAPI.updateTodo(input.id, {
            title: input.title || existing.title,
            summary: input.summary || existing.summary,
            status: existingParsed.status,
            priority: input.priority || existingParsed.priority,
            sort: existingParsed.sort,
            content: input.content !== undefined ? input.content : existingParsed.body,
            tags: input.tags || existing.tags
          });
          await this.loadTodos();
          this.showToast('Task updated by chat', 'success');
          result = { success: true, message: `Task "${input.title || existing.title}" updated` };
          break;
        }

        case 'move_task': {
          const toMove = this.todos.find(t => t.id === input.id);
          if (!toMove) throw new Error(`Task not found: ${input.id}`);
          const moveParsed = UsableAPI.parseContent(toMove.content);
          await UsableAPI.updateTodo(input.id, {
            title: toMove.title,
            summary: toMove.summary,
            status: input.status,
            priority: moveParsed.priority,
            sort: moveParsed.sort,
            content: moveParsed.body,
            tags: toMove.tags
          });
          await this.loadTodos();
          this.showToast(`Task moved to ${input.status}`, 'success');
          result = { success: true, message: `Task "${toMove.title}" moved to ${input.status}` };
          break;
        }

        case 'delete_task': {
          const toDelete = this.todos.find(t => t.id === input.id);
          if (!toDelete) throw new Error(`Task not found: ${input.id}`);
          const deleteParsed = UsableAPI.parseContent(toDelete.content);
          await UsableAPI.deleteTodo(input.id, {
            title: toDelete.title,
            summary: toDelete.summary,
            priority: deleteParsed.priority,
            content: deleteParsed.body,
            tags: toDelete.tags
          });
          await this.loadTodos();
          this.showToast('Task deleted by chat', 'success');
          result = { success: true, message: `Task "${toDelete.title}" deleted` };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${tool}`);
      }

      this.postToEmbed({
        type: 'TOOL_RESPONSE',
        payload: { requestId, result }
      });
    } catch (err) {
      console.error('Tool call failed:', err);
      this.postToEmbed({
        type: 'TOOL_RESPONSE',
        payload: { requestId, result: { error: err.message } }
      });
    }
  }

  /**
   * Update the auth UI based on login state
   */
  updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    const authUser = document.getElementById('auth-user');
    const authUserName = document.getElementById('auth-user-name');

    if (UsableAuth.isAuthenticated()) {
      const user = UsableAuth.getUserInfo();
      loginBtn.style.display = 'none';
      authUser.style.display = 'flex';
      authUserName.textContent = user?.name || 'User';
    } else {
      loginBtn.style.display = '';
      authUser.style.display = 'none';
      authUserName.textContent = '';
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await CONFIG.init();
  window.kanban = new KanbanBoard();
});
