class DrawingApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        // Set attribute on canvas element too for maximum compatibility
        this.canvas.setAttribute('willReadFrequently', 'true');
        this.isDrawing = false;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        this.state = {
            tool: 'brush',
            strokeColor: '#000000',
            fillColor: '#ffffff',
            size: 5,
            font: 'Arial',
            fontSize: 20,
            grid: {
                show: false,
                size: 20,
                snap: false
            },
            selection: null,
            pattern: {
                type: 'dots',
                size: 10,
                spacing: 5
            }
        };

        this.projects = [];

        // Add default canvas size
        this.defaultSize = {
            width: 800,
            height: 600
        };
        
        this.container = document.querySelector('.canvas-container');
        this.sizeDisplay = document.querySelector('.canvas-size-display');
        
        this.initializeCanvas();
        this.initializeResizing();
        this.attachEventListeners();
        this.saveInitialState();
        this.initializePatterns();
        this.loadProjects();

        this.autoSaveInterval = null;
        this.hasUnsavedChanges = false;
        this.setupAutoSave();
        this.setupProjectManager();

        // Timers and indicators
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds
        this.saveIndicator = document.createElement('div');
        this.saveIndicator.className = 'auto-save-indicator';
        document.querySelector('.toolbar').appendChild(this.saveIndicator);

        // Add error handling
        this.setupErrorHandling();
        
        // Add state validation
        this.validateState = this.validateState.bind(this);
        this.addStateValidation();
    }

    setupErrorHandling() {
        window.onerror = (msg, url, lineNo, columnNo, error) => {
            console.error('Error: ', msg, url, lineNo, columnNo, error);
            this.updateAutoSaveIndicator('Error occurred, please refresh');
            return false;
        };

        window.onunhandledrejection = (event) => {
            console.error('Promise rejection: ', event.reason);
            this.updateAutoSaveIndicator('Save failed, retrying...');
            this.retryOperation(event.reason);
        };
    }

    retryOperation(error) {
        if (error.message.includes('quota')) {
            // Clean up old data before retrying
            this.cleanupStorage();
            setTimeout(() => this.saveProject(), 1000);
        }
    }

    cleanupStorage() {
        const projectList = JSON.parse(localStorage.getItem('projectList') || '[]');
        if (projectList.length > 20) {  // Keep only last 20 projects
            projectList.slice(20).forEach(p => {
                localStorage.removeItem(`project_${p.id}`);
            });
            localStorage.setItem('projectList', JSON.stringify(projectList.slice(0, 20)));
        }
    }

    validateState() {
        if (!this.canvas || !this.ctx) {
            this.initializeCanvas();
        }
        if (!this.state) {
            this.resetState();
        }
        return true;
    }

    addStateValidation() {
        ['draw', 'saveState', 'undo', 'redo'].forEach(method => {
            const original = this[method];
            this[method] = (...args) => {
                if (this.validateState()) {
                    return original.apply(this, args);
                }
            };
        });
    }

    resetState() {
        this.state = {
            tool: 'brush',
            strokeColor: '#000000',
            fillColor: '#ffffff',
            size: 5,
            font: 'Arial',
            fontSize: 20,
            grid: { show: false, size: 20, snap: false },
            selection: null,
            pattern: { type: 'dots', size: 10, spacing: 5 }
        };
    }

    initializeCanvas() {
        // Set initial canvas size
        this.canvas.width = this.defaultSize.width;
        this.canvas.height = this.defaultSize.height;
        
        // Set container size
        this.container.style.width = `${this.defaultSize.width}px`;
        this.container.style.height = `${this.defaultSize.height}px`;
        
        this.updateSizeDisplay();
    }

    initializeResizing() {
        const handles = document.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', this.startResize.bind(this));
        });

        this.resizing = false;
        this.currentHandle = null;
        
        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
    }

    startResize(e) {
        this.resizing = true;
        this.currentHandle = e.target.className.split(' ')[1];
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startWidth = this.canvas.width;
        this.startHeight = this.canvas.height;
        this.container.classList.add('resizing');
        
        // Save current canvas content
        this.resizeState = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        e.preventDefault();
    }

    handleResize(e) {
        if (!this.resizing) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        
        let newWidth = this.startWidth;
        let newHeight = this.startHeight;

        switch(this.currentHandle) {
            case 'bottom-right':
                newWidth += dx;
                newHeight += dy;
                break;
            case 'bottom-left':
                newWidth -= dx;
                newHeight += dy;
                break;
            case 'top-right':
                newWidth += dx;
                newHeight -= dy;
                break;
            case 'top-left':
                newWidth -= dx;
                newHeight -= dy;
                break;
        }

        // Minimum size of 100x100
        newWidth = Math.max(100, newWidth);
        newHeight = Math.max(100, newHeight);

        this.resizeCanvas(newWidth, newHeight);
    }

    stopResize() {
        if (!this.resizing) return;
        this.resizing = false;
        this.container.classList.remove('resizing');
        this.saveState();
    }

    resizeCanvas(width, height) {
        // Create temporary canvas to store current content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(this.resizeState, 0, 0);

        // Resize canvas
        this.canvas.width = width;
        this.canvas.height = height;
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;

        // Restore content
        this.ctx.drawImage(tempCanvas, 0, 0);
        
        this.updateSizeDisplay();
    }

    updateSizeDisplay() {
        this.sizeDisplay.textContent = `${this.canvas.width} × ${this.canvas.height}`;
    }

    attachEventListeners() {
        // Tool Selection
        document.getElementById('tool').addEventListener('change', (e) => {
            this.state.tool = e.target.value;
            document.getElementById('textControls').style.display = 
                e.target.value === 'text' ? 'flex' : 'none';
        });

        // Color and Size Controls
        document.getElementById('strokeColor').addEventListener('change', (e) => 
            this.state.strokeColor = e.target.value);
        document.getElementById('fillColor').addEventListener('change', (e) => 
            this.state.fillColor = e.target.value);
        document.getElementById('size').addEventListener('change', (e) => 
            this.state.size = e.target.value);

        // Text Controls
        document.getElementById('font').addEventListener('change', (e) => 
            this.state.font = e.target.value);
        document.getElementById('fontSize').addEventListener('change', (e) => 
            this.state.fontSize = e.target.value);

        // Action Buttons
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());
        document.getElementById('clear').addEventListener('click', () => this.clear());
        document.getElementById('save').addEventListener('click', () => this.showSaveDialog());
        document.getElementById('load').addEventListener('click', () => this.showProjectManager());
        document.getElementById('closeProjectManager').addEventListener('click', 
            () => this.overlay.style.display = 'none');

        // Drawing Events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') this.undo();
                if (e.key === 'y') this.redo();
            }
        });

        document.getElementById('gridToggle').addEventListener('click', 
            () => this.toggleGrid());
        document.getElementById('snapToggle').addEventListener('click', 
            () => this.state.grid.snap = !this.state.grid.snap);
        document.getElementById('rotation').addEventListener('change', 
            (e) => this.rotateSelection(e.target.value));
        
        document.getElementById('patternType').addEventListener('change',
            (e) => this.state.pattern.type = e.target.value);
        document.getElementById('patternSize').addEventListener('change',
            (e) => this.state.pattern.size = parseInt(e.target.value));
        document.getElementById('patternSpacing').addEventListener('change',
            (e) => this.state.pattern.spacing = parseInt(e.target.value));
    }

    startDrawing(e) {
        this.isDrawing = true;
        this.lastX = e.offsetX;
        this.lastY = e.offsetY;
        this.ctx.strokeStyle = this.state.strokeColor;
        this.ctx.fillStyle = this.state.fillColor;
        this.ctx.lineWidth = this.state.size;
        this.ctx.lineCap = 'round';
        
        // Save state for shape preview
        this.startState = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        if (this.state.tool === 'select') {
            this.startSelection(e);
        }
    }

    draw(e) {
        if (!this.isDrawing) return;

        switch (this.state.tool) {
            case 'brush':
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(e.offsetX, e.offsetY);
                this.ctx.stroke();
                [this.lastX, this.lastY] = [e.offsetX, e.offsetY];
                break;

            case 'line':
                this.ctx.putImageData(this.startState, 0, 0);
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(e.offsetX, e.offsetY);
                this.ctx.stroke();
                break;

            case 'rect':
                this.ctx.putImageData(this.startState, 0, 0);
                const width = e.offsetX - this.lastX;
                const height = e.offsetY - this.lastY;
                this.ctx.strokeRect(this.lastX, this.lastY, width, height);
                this.ctx.fillRect(this.lastX, this.lastY, width, height);
                break;

            case 'circle':
                this.ctx.putImageData(this.startState, 0, 0);
                const radius = Math.sqrt(
                    Math.pow(e.offsetX - this.lastX, 2) +
                    Math.pow(e.offsetY - this.lastY, 2)
                );
                this.ctx.beginPath();
                this.ctx.arc(this.lastX, this.lastY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.fill();
                break;

            case 'eraser':
                this.ctx.save();
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.beginPath();
                this.ctx.arc(e.offsetX, e.offsetY, this.state.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                break;

            case 'select':
                this.updateSelection(e);
                break;

            case 'pattern':
                this.drawPattern(e);
                break;
        }

        this.hasUnsavedChanges = true;
        this.updateAutoSaveIndicator('Unsaved changes...');
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.state.tool === 'text') {
            const text = document.getElementById('textInput').value;
            if (text) {
                this.ctx.font = `${this.state.fontSize}px ${this.state.font}`;
                this.ctx.fillStyle = this.state.strokeColor;
                this.ctx.fillText(text, e.offsetX, e.offsetY);
            }
        }

        if (this.state.tool === 'select') {
            this.finishSelection();
        }

        this.saveState();
    }

    saveState() {
        this.historyIndex++;
        this.history = this.history.slice(0, this.historyIndex);
        this.history.push(
            this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
        );
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateButtons();
    }

    saveInitialState() {
        this.saveState();
    }

    updateButtons() {
        document.getElementById('undo').disabled = this.historyIndex < 1;
        document.getElementById('redo').disabled = this.historyIndex >= this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
            this.updateButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.ctx.putImageData(this.history[this.historyIndex], 0, 0);
            this.updateButtons();
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveState();
    }

    save() {
        localStorage.setItem('drawing', this.canvas.toDataURL());
    }

    load() {
        const data = localStorage.getItem('drawing');
        if (data) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
                this.saveState();
            };
            img.src = data;
        }
    }

    initializePatterns() {
        this.patterns = {
            dots: (ctx, size, spacing) => {
                ctx.beginPath();
                ctx.arc(spacing, spacing, size/4, 0, Math.PI * 2);
                ctx.fill();
            },
            lines: (ctx, size, spacing) => {
                ctx.beginPath();
                ctx.moveTo(0, spacing);
                ctx.lineTo(size, spacing);
                ctx.stroke();
            },
            zigzag: (ctx, size, spacing) => {
                ctx.beginPath();
                ctx.moveTo(0, spacing);
                ctx.lineTo(size/2, size-spacing);
                ctx.lineTo(size, spacing);
                ctx.stroke();
            },
            crosshatch: (ctx, size, spacing) => {
                ctx.beginPath();
                ctx.moveTo(0, spacing);
                ctx.lineTo(size, spacing);
                ctx.moveTo(spacing, 0);
                ctx.lineTo(spacing, size);
                ctx.stroke();
            }
        };
    }

    drawPattern(e) {
        const pattern = this.patterns[this.state.pattern.type];
        if (!pattern) return;

        const { size, spacing } = this.state.pattern;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size * 2;
        tempCanvas.height = size * 2;
        
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.strokeStyle = this.state.strokeColor;
        tempCtx.fillStyle = this.state.strokeColor;
        
        pattern(tempCtx, size, spacing);
        
        this.ctx.fillStyle = this.ctx.createPattern(tempCanvas, 'repeat');
        this.ctx.fillRect(e.offsetX - size, e.offsetY - size, size * 2, size * 2);
    }

    toggleGrid() {
        this.state.grid.show = !this.state.grid.show;
        this.drawGrid();
    }

    drawGrid() {
        if (!this.state.grid.show) return;
        
        const w = this.canvas.width;
        const h = this.canvas.height;
        const s = this.state.grid.size;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 0.5;
        
        for (let x = 0; x < w; x += s) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < h; y += s) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    startSelection(e) {
        this.state.selection = {
            startX: e.offsetX,
            startY: e.offsetY,
            width: 0,
            height: 0,
            content: null
        };
    }

    updateSelection(e) {
        if (!this.state.selection) return;
        
        const selection = this.state.selection;
        selection.width = e.offsetX - selection.startX;
        selection.height = e.offsetY - selection.startY;
        
        this.ctx.putImageData(this.startState, 0, 0);
        this.ctx.strokeStyle = '#000';
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            selection.startX, 
            selection.startY, 
            selection.width, 
            selection.height
        );
        this.ctx.setLineDash([]);
    }

    finishSelection() {
        if (!this.state.selection) return;
        
        const s = this.state.selection;
        s.content = this.ctx.getImageData(
            s.startX, s.startY, 
            s.width, s.height
        );
    }

    saveProject() {
        if (!this.currentProjectId) return;

        try {
            const projectData = this.getProjectData();
            const savePromise = storageHelpers.saveWithThrottle(
                `project_${this.currentProjectId}`, 
                JSON.stringify(projectData)
            );

            savePromise
                .then(() => this.updateAutoSaveIndicator('Project saved', 'success'))
                .catch(error => {
                    console.error('Save failed:', error);
                    this.updateAutoSaveIndicator('Save failed, retrying...', 'error');
                    this.retryOperation(error);
                });

        } catch (error) {
            console.error('Save failed:', error);
            this.updateAutoSaveIndicator('Save failed', 'error');
        }
    }

    loadProjects() {
        const stored = localStorage.getItem('novasketch_projects');
        if (stored) {
            this.projects = JSON.parse(stored);
        }
    }

    loadProject(project) {
        if (project.width && project.height) {
            this.resizeCanvas(project.width, project.height);
        }
        // ...rest of load method...
    }

    setupProjectManager() {
        this.overlay = document.getElementById('projectOverlay');
        this.projectGrid = document.getElementById('projectGrid');
        
        // Project manager button
        document.getElementById('projectManagerBtn').addEventListener('click', 
            () => this.showProjectManager());
        document.getElementById('closeProjectManager').addEventListener('click', 
            () => this.hideProjectManager());
            
        // Project actions
        document.getElementById('newProject').addEventListener('click', () => {
            if (confirm('Start a new project? Current work will be saved first.')) {
                this.saveCurrentProject();
                this.createNewProject();
            }
        });
        
        document.getElementById('saveProject').addEventListener('click', 
            () => this.showSaveDialog());
            
        document.getElementById('clearCanvas').addEventListener('click', () => {
            if (confirm('Clear the canvas? This cannot be undone.')) {
                this.clear();
            }
        });

        // Load existing projects
        this.loadProjectList();

        // Add project card hover effects
        this.projectGrid.addEventListener('mouseover', (e) => {
            const card = e.target.closest('.project-card');
            if (card) {
                card.classList.add('hover');
            }
        });

        this.projectGrid.addEventListener('mouseout', (e) => {
            const card = e.target.closest('.project-card');
            if (card) {
                card.classList.remove('hover');
            }
        });

        // Close on backdrop click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hideProjectManager();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.hideProjectManager();
            }
        });
    }

    createNewProject() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentProjectId = null;
        this.currentProjectName = null;
        this.hasUnsavedChanges = false;
        this.saveState();
        this.overlay.style.display = 'none';
    }

    saveCurrentProject() {
        if (this.hasUnsavedChanges || !this.currentProjectId) {
            const name = this.currentProjectName || 'Untitled';
            this.saveProject(name);
        }
    }

    loadProjectList() {
        const projectList = JSON.parse(localStorage.getItem('projectList') || '[]');
        this.projectGrid.innerHTML = '';

        if (projectList.length === 0) {
            this.projectGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-folder-open"></i>
                    <h3>No projects yet</h3>
                    <p>Create a new project to get started</p>
                </div>
            `;
            return;
        }

        projectList.sort((a, b) => b.lastModified - a.lastModified)
            .forEach(project => {
                const card = document.createElement('div');
                card.className = 'project-card';
                card.innerHTML = `
                    <img src="${project.thumbnail}" alt="${project.name}">
                    <div class="project-info">
                        <h3>${project.name}</h3>
                        <p><i class="fa-regular fa-clock"></i> ${new Date(project.lastModified).toLocaleDateString()}</p>
                    </div>
                    <div class="project-actions">
                        <button class="primary-btn" onclick="app.loadProject('${project.id}')">
                            <i class="fa-solid fa-folder-open"></i> Open
                        </button>
                        <button class="danger-btn" onclick="app.deleteProject('${project.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                this.projectGrid.appendChild(card);
            });
    }

    showProjectManager() {
        this.saveCurrentProject();
        this.loadProjectList();
        this.overlay.classList.add('active');
    }

    hideProjectManager() {
        this.overlay.classList.remove('active');
    }

    // Update existing project methods
    saveProject(name) {
        const projectId = this.currentProjectId || Date.now().toString();
        this.currentProjectId = projectId;
        this.currentProjectName = name;

        const projectData = this.getProjectData();
        
        // Save project data
        localStorage.setItem(`project_${projectId}`, JSON.stringify(projectData));
        
        // Update project list
        let projectList = JSON.parse(localStorage.getItem('projectList') || '[]');
        const existingIndex = projectList.findIndex(p => p.id === projectId);
        
        if (existingIndex >= 0) {
            projectList[existingIndex] = projectData;
        } else {
            projectList.push(projectData);
        }
        
        localStorage.setItem('projectList', JSON.stringify(projectList));
        this.loadProjectList();
        this.updateAutoSaveIndicator('Project saved');
    }

    loadProject(projectId) {
        const projectData = JSON.parse(localStorage.getItem(`project_${projectId}`));
        if (!projectData) return;

        this.currentProjectId = projectId;
        this.currentProjectName = projectData.name;
        
        // Load canvas size
        this.resizeCanvas(projectData.width, projectData.height);

        // Load canvas content
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
            this.saveState();
            this.overlay.style.display = 'none';
        };
        img.src = projectData.canvasData;
        this.updateAutoSaveIndicator('Project loaded');
    }

    deleteProject(projectId) {
        if (!confirm('Are you sure you want to delete this project?')) return;

        localStorage.removeItem(`project_${projectId}`);
        
        let projectList = JSON.parse(localStorage.getItem('projectList') || '[]');
        projectList = projectList.filter(p => p.id !== projectId);
        localStorage.setItem('projectList', JSON.stringify(projectList));
        
        this.loadProjectList();
    }

    setupAutoSave() {
        // Clear any existing interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Set up new auto-save interval
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges && this.currentProjectId) {
                this.autoSave();
            }
        }, this.autoSaveDelay);

        // Initial indicator state
        this.updateAutoSaveIndicator('Ready');
    }

    autoSave() {
        if (!this.currentProjectId) return;
        
        try {
            const projectData = this.getProjectData();
            localStorage.setItem(`project_${this.currentProjectId}`, JSON.stringify(projectData));
            this.hasUnsavedChanges = false;
            this.updateAutoSaveIndicator('Auto-saved');
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.updateAutoSaveIndicator('Auto-save failed');
        }
    }

    updateAutoSaveIndicator(status, type = 'info') {
        const indicator = document.querySelector('.auto-save-indicator');
        if (!indicator) return;

        // Clear any existing timeouts
        if (this.indicatorTimeout) {
            clearTimeout(this.indicatorTimeout);
        }

        const icons = {
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle'
        };

        indicator.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${status}</span>
        `;
        
        indicator.className = `auto-save-indicator ${type} active`;

        this.indicatorTimeout = setTimeout(() => {
            indicator.classList.remove('active');
        }, 3000);
    }

    getProjectData() {
        return {
            id: this.currentProjectId,
            name: this.currentProjectName || 'Untitled',
            thumbnail: this.canvas.toDataURL('image/jpeg', 0.5),
            canvasData: this.canvas.toDataURL(),
            width: this.canvas.width,
            height: this.canvas.height,
            lastModified: Date.now()
        };
    }

    showSaveDialog() {
        const name = prompt('Enter project name:', this.currentProjectName || 'Untitled');
        if (name) {
            this.saveProject(name);
            this.updateAutoSaveIndicator('Project saved successfully');
        }
    }

    cleanup() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }
}

// Make app global for project manager buttons
const app = new DrawingApp();
window.app = app;
window.addEventListener('unload', () => app.cleanup());
