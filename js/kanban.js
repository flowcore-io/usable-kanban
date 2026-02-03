/**
 * Kanban Board Application
 * Main application logic for the Usable.dev Kanban board
 */

class KanbanBoard {
  constructor() {
    this.todos = [];
    this.draggedCard = null;
    this.draggedCardData = null;
    
    // DOM elements
    this.board = document.getElementById('board');
    this.modal = document.getElementById('task-modal');
    this.form = document.getElementById('task-form');
    this.toast = document.getElementById('toast');
    this.loading = document.getElementById('loading');
    this.taskCount = document.getElementById('task-count');
    
    this.init();
  }
  
  /**
   * Initialize the application
   */
  async init() {
    this.bindEvents();
    await this.loadTodos();
  }
  
  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Header buttons
    document.getElementById('add-btn').addEventListener('click', () => this.openModal());
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadTodos());

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
      if (e.key === 'Escape') this.closeModal();
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.openModal();
      }
    });
    
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
    
    // Render each group
    Object.entries(grouped).forEach(([status, todos]) => {
      const zone = document.querySelector(`[data-dropzone="${status}"]`);
      const countEl = document.querySelector(`[data-count="${status}"]`);
      
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
    const tags = (todo.tags || []).filter(t => !CONFIG.DEFAULT_TAGS.includes(t));
    
    card.innerHTML = `
      <h3 class="card__title">${this.escapeHtml(todo.title)}</h3>
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
    
    this.draggedCard = null;
    this.draggedCardData = null;
  }
  
  /**
   * Handle drag over
   */
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
    
    if (newStatus === oldStatus) return;
    
    // Optimistic UI update
    if (this.draggedCard) {
      this.draggedCard.remove();
      zone.appendChild(this.draggedCard);
    }
    
    // Update in API
    try {
      await UsableAPI.updateTodo(this.draggedCardData.id, {
        title: this.draggedCardData.title,
        summary: this.draggedCardData.summary,
        status: newStatus,
        priority: this.draggedCardData.parsed.priority,
        content: this.draggedCardData.parsed.body,
        tags: this.draggedCardData.tags
      });
      
      // Update local data
      this.draggedCardData.parsed.status = newStatus;
      
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
    const todoData = {
      title: document.getElementById('task-title').value,
      summary: document.getElementById('task-summary').value,
      status: document.getElementById('task-status').value,
      priority: document.getElementById('task-priority').value,
      content: document.getElementById('task-content').value,
      tags: document.getElementById('task-tags').value
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
