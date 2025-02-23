class ProjectManager {
    constructor() {
        this.projects = this.loadProjects();
        this.filteredProjects = [...this.projects];
        this.initializeUI();
        this.updateProjectCount();
        this.placeholderImage = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg width="250" height="150" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f0f0f0"/>
                <text x="50%" y="50%" font-family="Arial" font-size="14" 
                    fill="#666" text-anchor="middle" dy=".3em">No Preview</text>
            </svg>
        `);
    }

    initializeUI() {
        // Remove search listener
        document.getElementById('newProject').addEventListener('click', () => this.createNewProject());
        document.getElementById('sortProjects').addEventListener('change', (e) => this.sortProjects(e.target.value));
        this.renderProjects();
    }

    sortProjects(method) {
        switch (method) {
            case 'recent':
                this.filteredProjects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
                break;
            case 'oldest':
                this.filteredProjects.sort((a, b) => new Date(a.lastModified) - new Date(b.lastModified));
                break;
            case 'name':
                this.filteredProjects.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }
        this.renderProjects();
    }

    updateProjectCount() {
        const count = this.projects.length;
        document.getElementById('projectCount').textContent = 
            `${count} Project${count !== 1 ? 's' : ''}`;
    }

    formatDate(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return d.toLocaleDateString();
    }

    getProjectStats(project) {
        const shapes = project.data?.shapes || [];
        return {
            elements: shapes.length,
            lastModified: this.formatDate(project.lastModified)
        };
    }

    loadProjects() {
        return JSON.parse(localStorage.getItem('novaSketchProjects')) || [];
    }

    saveProjects() {
        localStorage.setItem('novaSketchProjects', JSON.stringify(this.projects));
    }

    createNewProject() {
        const title = prompt('Enter project name:');
        if (!title) return;

        const project = {
            id: Date.now(),
            title,
            created: new Date(),
            lastModified: new Date(),
            thumbnail: null,
            data: {
                shapes: []
            }
        };

        this.projects.push(project);
        this.saveProjects();
        this.renderProjects();
        
        // Open the editor with the new project
        window.location.href = `editor.html?project=${project.id}`;
    }

    renderProjects() {
        const grid = document.getElementById('projectsGrid');
        const emptyState = document.getElementById('emptyState');
        grid.innerHTML = '';

        if (this.filteredProjects.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        this.filteredProjects.forEach(project => {
            const stats = this.getProjectStats(project);
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <img class="project-thumbnail" 
                    src="${project.thumbnail || this.placeholderImage}" 
                    alt="${project.title}"
                    onerror="this.src='${this.placeholderImage}'">
                <div class="project-info">
                    <div class="project-header">
                        <h3 class="project-title">${project.title || 'Untitled Project'}</h3>
                    </div>
                    <div class="project-stats">
                        <div class="stat-item">
                            <i class="fas fa-shapes"></i>
                            ${stats.elements} elements
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-clock"></i>
                            ${stats.lastModified}
                        </div>
                    </div>
                    <div class="project-actions">
                        <button class="edit" onclick="projectManager.openProject(${project.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete" onclick="projectManager.deleteProject(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    openProject(id) {
        window.location.href = `editor.html?project=${id}`;
    }

    deleteProject(id) {
        if (!confirm('Are you sure you want to delete this project?')) return;
        
        this.projects = this.projects.filter(p => p.id !== id);
        this.saveProjects();
        this.renderProjects();
    }
}

// Initialize project manager
const projectManager = new ProjectManager();
