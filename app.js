class NovaSketch {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'select';
        this.isDrawing = false;
        this.shapes = [];
        this.selectedShape = null;
        this.currentColor = '#000000';
        this.startPos = null;
        this.currentShape = null;
        this.brushSize = 5;
        this.brushOpacity = 100;
        this.paths = [];
        this.currentPath = null;
        this.lastDrawTime = 0;
        this.drawThrottle = 1000 / 60; // 60 FPS
        this.lastPoint = null;
        this.fillColor = '#000000';
        this.strokeColor = '#000000';
        this.fontSize = 16;
        this.fontFamily = 'Arial';
        this.textColor = '#000000';
        this.textBackground = '#ffffff';
        this.textBold = false;
        this.editingText = null;
        this.selectedElements = new Set();
        this.layersList = document.getElementById('layersList');
        this.lastSelectedShape = null; // Add this new property

        this.initializeCanvas();
        this.addEventListeners();
        this.initializeElementControls();
        this.initializeElementPropertyControls();
        this.initializeExportControls();
        
        this.currentProject = null;
        this.loadProjectFromURL();
        this.setupAutoSave();
        this.initializeProjectTitle();
        this.initializeMenus();
        this.initializePanelCollapse();
        this.initializeResizeHandles();
    }

    initializeCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    addEventListeners() {
        // Update tool selection
        document.querySelectorAll('.tool').forEach(tool => {
            tool.addEventListener('click', (e) => {
                const toolType = e.currentTarget.dataset.tool;
                if (toolType === 'shapes') {
                    // Don't change the tool, just toggle the submenu visibility
                    return;
                }
                if (toolType) {
                    this.currentTool = toolType;
                    this.updateToolUI();
                }
            });
        });

        // Add submenu item selection
        document.querySelectorAll('.submenu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const toolType = e.currentTarget.dataset.tool;
                if (toolType) {
                    this.currentTool = toolType;
                    this.lastSelectedShape = toolType;
                    this.updateToolUI();
                }
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => {
            const now = performance.now();
            if (now - this.lastDrawTime < this.drawThrottle) return;
            this.lastDrawTime = now;
            this.handleMouseMove(e);
        });
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());

        // Color controls
        const fillColorInput = document.getElementById('fillColor');
        const strokeColorInput = document.getElementById('strokeColor');
        const fillPreview = document.getElementById('fillColorPreview');
        const strokePreview = document.getElementById('strokeColorPreview');

        if (fillColorInput && strokeColorInput && fillPreview && strokePreview) {
            fillColorInput.addEventListener('change', (e) => {
                this.fillColor = e.target.value;
                fillPreview.style.backgroundColor = e.target.value;
            });

            strokeColorInput.addEventListener('change', (e) => {
                this.strokeColor = e.target.value;
                strokePreview.style.backgroundColor = e.target.value;
            });

            // Initialize color previews
            fillPreview.style.backgroundColor = this.fillColor;
            strokePreview.style.backgroundColor = this.strokeColor;
        }

        // Brush properties
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeValue').textContent = `${this.brushSize}px`;
        });

        document.getElementById('brushOpacity').addEventListener('input', (e) => {
            this.brushOpacity = parseInt(e.target.value);
            document.getElementById('brushOpacityValue').textContent = `${this.brushOpacity}%`;
        });

        // Color pickers
        document.getElementById('fillColor').addEventListener('change', (e) => {
            this.fillColor = e.target.value;
        });
        document.getElementById('strokeColor').addEventListener('change', (e) => {
            this.strokeColor = e.target.value;
        });

        // Text properties
        document.getElementById('fontSize').addEventListener('input', (e) => {
            this.fontSize = parseInt(e.target.value);
            if (this.editingText) this.updateText(this.editingText);
        });
        document.getElementById('fontFamily').addEventListener('change', (e) => {
            this.fontFamily = e.target.value;
            if (this.editingText) this.updateText(this.editingText);
        });
        document.getElementById('textBold').addEventListener('change', (e) => {
            this.textBold = e.target.checked;
            if (this.editingText) this.updateText(this.editingText);
        });
        document.getElementById('textColor').addEventListener('change', (e) => {
            this.textColor = e.target.value;
            if (this.editingText) this.updateText(this.editingText);
        });
        document.getElementById('textBackground').addEventListener('change', (e) => {
            this.textBackground = e.target.value;
            if (this.editingText) this.updateText(this.editingText);
        });
    }

    initializeElementControls() {
        document.getElementById('deleteElement').addEventListener('click', () => this.deleteSelectedElements());
        document.getElementById('moveUp').addEventListener('click', () => this.moveElement('up'));
        document.getElementById('moveDown').addEventListener('click', () => this.moveElement('down'));
        document.getElementById('groupElements').addEventListener('click', () => this.groupSelectedElements());
    }

    initializeElementPropertyControls() {
        // Shape properties
        document.getElementById('elementFillColor').addEventListener('change', (e) => {
            this.updateSelectedElementProperty('fillColor', e.target.value);
        });
        document.getElementById('elementStrokeColor').addEventListener('change', (e) => {
            this.updateSelectedElementProperty('strokeColor', e.target.value);
        });

        // Text properties
        document.getElementById('elementFontSize').addEventListener('input', (e) => {
            this.updateSelectedElementProperty('fontSize', parseInt(e.target.value));
        });
        document.getElementById('elementFontFamily').addEventListener('change', (e) => {
            this.updateSelectedElementProperty('fontFamily', e.target.value);
        });
        document.getElementById('elementTextColor').addEventListener('change', (e) => {
            this.updateSelectedElementProperty('color', e.target.value);
        });
        document.getElementById('elementBackground').addEventListener('change', (e) => {
            this.updateSelectedElementProperty('background', e.target.value);
        });
        document.getElementById('elementTextBold').addEventListener('change', (e) => {
            this.updateSelectedElementProperty('bold', e.target.checked);
        });

        // Brush properties
        document.getElementById('elementBrushSize').addEventListener('input', (e) => {
            this.updateSelectedElementProperty('size', parseInt(e.target.value));
        });
        document.getElementById('elementOpacity').addEventListener('input', (e) => {
            this.updateSelectedElementProperty('opacity', parseInt(e.target.value) / 100);
        });
    }

    initializeExportControls() {
        // Export functions are now handled through the submenu items
        // with data-action attributes in initializeMenus()
        
        // Only keep the back to projects button initialization
        const backButton = document.getElementById('backToProjects');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.saveProject();
                window.location.href = 'index.html';
            });
        }
    }

    exportAs(type) {
        // Create a temporary canvas for export
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width;
        exportCanvas.height = this.canvas.height;
        const ctx = exportCanvas.getContext('2d');

        // Fill white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw all shapes
        this.shapes.forEach(shape => {
            this.drawShape.call({ ...this, canvas: exportCanvas, ctx }, shape);
        });

        switch (type) {
            case 'png':
                this.downloadImage(exportCanvas.toDataURL('image/png'), 'novasketch.png');
                break;
            case 'jpg':
                this.downloadImage(exportCanvas.toDataURL('image/jpeg', 0.9), 'novasketch.jpg');
                break;
            case 'pdf':
                this.exportToPDF(exportCanvas);
                break;
        }
    }

    downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
    }

    exportToPDF(canvas) {
        // Using jsPDF library - add this to index.html:
        // <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });

        const imageData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imageData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save('novasketch.pdf');
    }

    printCanvas() {
        const printWindow = window.open('', '_blank');
        const printDoc = printWindow.document;
        
        printDoc.write(`
            <html>
                <head>
                    <title>Print NovaSketch</title>
                    <style>
                        @media print {
                            body { margin: 0; }
                            canvas { width: 100%; }
                        }
                    </style>
                </head>
                <body>
                    <img src="${this.canvas.toDataURL()}" style="width: 100%"/>
                </body>
            </html>
        `);
        
        printDoc.close();
        printWindow.focus();
        
        // Wait for image to load before printing
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }

    updateSelectedElementProperty(property, value) {
        this.selectedElements.forEach(element => {
            element[property] = value;
        });
        this.render();
    }

    updateLayersList() {
        this.layersList.innerHTML = '';
        this.shapes.forEach((shape, index) => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            if (this.selectedElements.has(shape)) {
                item.classList.add('selected');
            }

            const visibility = document.createElement('span');
            visibility.className = 'visibility';
            visibility.innerHTML = '<i class="fas fa-eye"></i>';
            visibility.onclick = (e) => {
                e.stopPropagation();
                shape.hidden = !shape.hidden;
                visibility.classList.toggle('hidden');
                this.render();
            };

            const name = document.createElement('span');
            name.textContent = this.getElementName(shape);

            item.appendChild(visibility);
            item.appendChild(name);
            item.onclick = (e) => {
                if (e.ctrlKey) {
                    this.toggleElementSelection(shape);
                } else {
                    this.selectElement(shape);
                }
            };

            this.layersList.appendChild(item);
        });
    }

    getElementName(shape) {
        switch (shape.type) {
            case 'text':
                return `Text: ${shape.text.substring(0, 20)}`;
            case 'brush':
                return 'Brush Stroke';
            default:
                return shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
        }
    }

    toggleElementSelection(shape) {
        if (this.selectedElements.has(shape)) {
            this.selectedElements.delete(shape);
        } else {
            this.selectedElements.add(shape);
        }
        this.updateLayersList();
        this.updateElementPropertiesPanel();
    }

    selectElement(shape) {
        this.selectedElements.clear();
        this.selectedElements.add(shape);
        this.updateLayersList();
        this.updateElementPropertiesPanel();
    }

    deleteSelectedElements() {
        this.shapes = this.shapes.filter(shape => !this.selectedElements.has(shape));
        this.selectedElements.clear();
        this.updateLayersList();
        this.render();
    }

    moveElement(direction) {
        const element = Array.from(this.selectedElements)[0];
        if (!element) return;

        const index = this.shapes.indexOf(element);
        if (direction === 'up' && index < this.shapes.length - 1) {
            [this.shapes[index], this.shapes[index + 1]] = [this.shapes[index + 1], this.shapes[index]];
        } else if (direction === 'down' && index > 0) {
            [this.shapes[index], this.shapes[index - 1]] = [this.shapes[index - 1], this.shapes[index]];
        }
        
        this.updateLayersList();
        this.render();
    }

    groupSelectedElements() {
        const elements = Array.from(this.selectedElements);
        if (elements.length < 2) return;

        const group = {
            type: 'group',
            elements: elements,
            x: Math.min(...elements.map(e => e.x)),
            y: Math.min(...elements.map(e => e.y))
        };

        this.shapes = this.shapes.filter(shape => !this.selectedElements.has(shape));
        this.shapes.push(group);
        this.selectedElements.clear();
        this.selectedElements.add(group);
        
        this.updateLayersList();
        this.render();
    }

    handleMouseDown(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        
        if (this.currentTool === 'select') {
            const clicked = this.findShapeAtPosition(pos);
            if (clicked) {
                if (e.ctrlKey) {
                    this.toggleElementSelection(clicked);
                } else {
                    this.selectElement(clicked);
                }
            } else {
                this.selectedElements.clear();
            }
            this.updateLayersList();
        } else {
            this.startShape(pos);
        }
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;
        const pos = this.getMousePos(e);
        
        if (this.currentTool === 'select' && this.selectedShape) {
            this.moveShape(this.selectedShape, pos);
        } else {
            this.updateCurrentShape(pos);
        }
        
        this.render();
    }

    handleMouseUp() {
        this.lastPoint = null;
        this.isDrawing = false;
        if (this.currentShape) {
            this.shapes.push(this.currentShape);
            this.currentShape = null;
        }
        if (this.currentPath) {
            this.shapes.push(this.currentPath);
            this.currentPath = null;
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    render() {
        // Only clear and redraw everything when not using brush
        if (this.currentTool !== 'brush' || !this.isDrawing) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            [...this.shapes, this.currentShape].filter(Boolean).forEach(shape => {
                this.drawShape(shape);
            });
        }
    }

    updateToolUI() {
        // Update main tools
        document.querySelectorAll('.tool').forEach(tool => {
            const toolType = tool.dataset.tool;
            if (toolType === 'shapes') {
                // If any shape tool is selected, highlight the shapes button
                tool.classList.toggle('shapes-active', 
                    ['rectangle', 'circle', 'line', 'polygon'].includes(this.currentTool));
            } else {
                tool.classList.toggle('active', toolType === this.currentTool);
            }
        });

        // Update submenu items
        document.querySelectorAll('.submenu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tool === this.currentTool);
        });

        // Update property groups visibility
        document.querySelectorAll('.property-group').forEach(group => {
            const tools = group.dataset.tools?.split(',') || [];
            group.classList.toggle('visible', tools.includes(this.currentTool));
        });
    }

    findShapeAtPosition(pos) {
        return this.shapes.find(shape => {
            if (shape.type === 'text') {
                const metrics = this.ctx.measureText(shape.text);
                return pos.x >= shape.x &&
                       pos.x <= shape.x + metrics.width &&
                       pos.y >= shape.y - shape.fontSize &&
                       pos.y <= shape.y;
            }
            if (shape.type === 'rectangle') {
                return pos.x >= shape.x && 
                       pos.x <= shape.x + shape.width &&
                       pos.y >= shape.y && 
                       pos.y <= shape.y + shape.height;
            }
            return false;
        });
    }

    startShape(pos) {
        if (this.currentTool === 'text') {
            const text = prompt('Enter text:');
            if (text) {
                this.currentShape = {
                    type: 'text',
                    x: pos.x,
                    y: pos.y,
                    text,
                    fontSize: this.fontSize,
                    fontFamily: this.fontFamily,
                    color: this.textColor,
                    background: this.textBackground,
                    bold: this.textBold
                };
            }
            return;
        }
        if (this.currentTool === 'brush') {
            this.currentPath = {
                type: 'brush',
                points: [pos],
                color: this.currentColor,
                size: this.brushSize,
                opacity: this.brushOpacity / 100
            };
            return;
        }
        this.startPos = pos;
        this.currentShape = {
            type: this.currentTool,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fillColor: this.fillColor,
            strokeColor: this.strokeColor
        };
        if (this.currentShape) {
            this.updateLayersList();
        }
    }

    moveShape(shape, pos) {
        if (!this.lastPos) {
            this.lastPos = pos;
            return;
        }
        
        const dx = pos.x - this.lastPos.x;
        const dy = pos.y - this.lastPos.y;
        
        shape.x += dx;
        shape.y += dy;
        
        this.lastPos = pos;
    }

    updateCurrentShape(pos) {
        if (this.currentTool === 'brush' && this.currentPath) {
            // Draw immediate line segment instead of storing points
            if (this.lastPoint) {
                this.ctx.beginPath();
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.strokeStyle = this.currentPath.color;
                this.ctx.lineWidth = this.currentPath.size;
                this.ctx.globalAlpha = this.currentPath.opacity;
                
                this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            }
            this.lastPoint = pos;
            
            // Store simplified path for redrawing
            if (!this.currentPath.points || 
                this.getDistance(this.currentPath.points[this.currentPath.points.length - 1], pos) > 2) {
                this.currentPath.points = this.currentPath.points || [];
                this.currentPath.points.push(pos);
            }
            return;
        }
        if (!this.currentShape || !this.startPos) return;

        switch (this.currentShape.type) {
            case 'rectangle':
                this.currentShape.width = pos.x - this.startPos.x;
                this.currentShape.height = pos.y - this.startPos.y;
                break;
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(pos.x - this.startPos.x, 2) + 
                    Math.pow(pos.y - this.startPos.y, 2)
                );
                this.currentShape.radius = radius;
                break;
            case 'line':
                this.currentShape.endX = pos.x;
                this.currentShape.endY = pos.y;
                break;
        }
    }

    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    drawShape(shape) {
        if (!shape || shape.hidden) return;
        
        if (shape.type === 'group') {
            shape.elements.forEach(element => this.drawShape(element));
            return;
        }

        if (shape.type === 'brush') {
            const points = shape.points;
            if (!points || points.length < 2) return;

            this.ctx.beginPath();
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = shape.color;
            this.ctx.lineWidth = shape.size;
            this.ctx.globalAlpha = shape.opacity;

            this.ctx.moveTo(points[0].x, points[0].y);
            
            // Draw direct line segments for better performance
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
            return;
        }

        this.ctx.beginPath();

        // Reset line settings for other shapes
        this.ctx.lineCap = 'butt';
        this.ctx.lineWidth = 1;

        this.ctx.strokeStyle = shape.strokeColor;
        this.ctx.fillStyle = shape.fillColor;

        switch (shape.type) {
            case 'text':
                const font = `${shape.bold ? 'bold' : ''} ${shape.fontSize}px ${shape.fontFamily}`;
                this.ctx.font = font;
                this.ctx.fillStyle = shape.background;
                
                // Measure text for background
                const metrics = this.ctx.measureText(shape.text);
                const height = shape.fontSize;
                this.ctx.fillRect(
                    shape.x,
                    shape.y - height + 5,
                    metrics.width,
                    height
                );
                
                // Draw text
                this.ctx.fillStyle = shape.color;
                this.ctx.fillText(shape.text, shape.x, shape.y);
                break;

            case 'rectangle':
                if (shape.fillColor !== 'transparent') {
                    this.ctx.fillStyle = shape.fillColor;
                    this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                }
                this.ctx.strokeStyle = shape.strokeColor;
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                break;

            case 'circle':
                if (shape.radius) {
                    if (shape.fillColor !== 'transparent') {
                        this.ctx.fillStyle = shape.fillColor;
                        this.ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.strokeStyle = shape.strokeColor;
                    this.ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
                break;

            case 'line':
                if (shape.endX !== undefined) {
                    this.ctx.moveTo(shape.x, shape.y);
                    this.ctx.lineTo(shape.endX, shape.endY);
                    this.ctx.stroke();
                }
                break;
        }
        this.ctx.closePath();
    }

    updateElementPropertiesPanel() {
        const elements = Array.from(this.selectedElements);
        if (elements.length === 0) {
            document.querySelector('[data-tools="selected-element"]').classList.remove('visible');
            return;
        }

        document.querySelector('[data-tools="selected-element"]').classList.add('visible');
        
        // Hide all element-specific property groups first
        document.querySelectorAll('[data-element-types]').forEach(group => {
            group.classList.remove('visible');
        });

        const element = elements[0]; // Use first selected element for properties
        const type = element.type;

        // Show relevant property group
        document.querySelector(`[data-element-types="${type}"]`)?.classList.add('visible');

        // Update property values
        switch (type) {
            case 'rectangle':
            case 'circle':
                document.getElementById('elementFillColor').value = element.fillColor;
                document.getElementById('elementStrokeColor').value = element.strokeColor;
                break;
            case 'text':
                document.getElementById('elementFontSize').value = element.fontSize;
                document.getElementById('elementFontFamily').value = element.fontFamily;
                document.getElementById('elementTextColor').value = element.color;
                document.getElementById('elementBackground').value = element.background;
                document.getElementById('elementTextBold').checked = element.bold;
                break;
            case 'brush':
                document.getElementById('elementBrushSize').value = element.size;
                document.getElementById('elementOpacity').value = element.opacity * 100;
                break;
        }
    }

    loadProjectFromURL() {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('project');
        
        if (projectId) {
            const projects = JSON.parse(localStorage.getItem('novaSketchProjects')) || [];
            this.currentProject = projects.find(p => p.id === parseInt(projectId));
            
            if (this.currentProject) {
                this.shapes = this.currentProject.data.shapes;
                document.getElementById('projectTitle').value = this.currentProject.title;
                
                // Restore canvas size if saved
                if (this.currentProject.data.canvasSize) {
                    const container = this.canvas.parentElement;
                    container.style.width = `${this.currentProject.data.canvasSize.width}px`;
                    container.style.height = `${this.currentProject.data.canvasSize.height}px`;
                }
                
                this.resizeCanvas();
                this.render();
            }
        }

        // Add project title to the page
        document.title = this.currentProject ? 
            `${this.currentProject.title} - NovaSketch` : 
            'New Project - NovaSketch';
    }

    setupAutoSave() {
        setInterval(() => this.saveProject(), 30000); // Auto-save every 30 seconds
    }

    saveProject() {
        if (!this.currentProject) return;

        // Update project data
        this.currentProject.data.shapes = this.shapes;
        this.currentProject.lastModified = new Date();
        this.currentProject.thumbnail = this.canvas.toDataURL('image/png');

        // Save to localStorage
        const projects = JSON.parse(localStorage.getItem('novaSketchProjects')) || [];
        const index = projects.findIndex(p => p.id === this.currentProject.id);
        if (index !== -1) {
            projects[index] = this.currentProject;
        }
        localStorage.setItem('novaSketchProjects', JSON.stringify(projects));
    }

    initializeProjectTitle() {
        const titleInput = document.getElementById('projectTitle');
        titleInput.addEventListener('change', (e) => {
            if (this.currentProject) {
                this.currentProject.title = e.target.value;
                this.saveProject();
            }
        });
    }

    initializeMenus() {
        // Add action handlers for menu items
        document.querySelectorAll('.submenu-item[data-action]').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                switch (action) {
                    // File actions
                    case 'newProject':
                        if (confirm('Create new project? Unsaved changes will be lost.')) {
                            window.location.href = 'index.html';
                        }
                        break;
                    case 'saveProject':
                        this.saveProject();
                        alert('Project saved successfully!');
                        break;
                    case 'exportPNG':
                        this.exportAs('png');
                        break;
                    case 'exportJPG':
                        this.exportAs('jpg');
                        break;
                    case 'exportPDF':
                        this.exportAs('pdf');
                        break;
                    case 'printCanvas':
                        this.printCanvas();
                        break;

                    // Edit actions
                    case 'undo':
                        this.undo();
                        break;
                    case 'redo':
                        this.redo();
                        break;
                    case 'delete':
                        this.deleteSelected();
                        break;
                    case 'duplicate':
                        this.copySelected();
                        break;

                    // View actions
                    case 'zoomIn':
                        this.zoom(1.2);
                        break;
                    case 'zoomOut':
                        this.zoom(0.8);
                        break;
                    case 'fitScreen':
                        this.fitToScreen();
                        break;
                    case 'toggleGrid':
                        this.toggleGrid();
                        break;
                    case 'toggleRulers':
                        this.toggleRulers();
                        break;
                }
            });
        });

        // Initialize color previews
        const fillColorPreview = document.getElementById('fillColorPreview');
        const strokeColorPreview = document.getElementById('strokeColorPreview');
        const fillColor = document.getElementById('fillColor');
        const strokeColor = document.getElementById('strokeColor');

        if (fillColorPreview && strokeColorPreview && fillColor && strokeColor) {
            // ...existing color preview code...
        }
    }

    initializePanelCollapse() {
        const layersPanel = document.querySelector('.layers-panel');
        const collapseBtn = document.getElementById('collapseElements');
        
        if (collapseBtn && layersPanel) {
            collapseBtn.addEventListener('click', () => {
                layersPanel.classList.toggle('collapsed');
                // Save state to localStorage
                localStorage.setItem('layersPanelCollapsed', layersPanel.classList.contains('collapsed'));
            });

            // Restore previous state
            const wasCollapsed = localStorage.getItem('layersPanelCollapsed') === 'true';
            if (wasCollapsed) {
                layersPanel.classList.add('collapsed');
            }
        }
    }

    initializeResizeHandles() {
        const container = this.canvas.parentElement;
        let isResizing = false;
        let currentHandle = null;
        let startX, startY, startWidth, startHeight;

        // Add resize event listeners
        document.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentHandle = e.target.dataset.resize;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = container.offsetWidth;
                startHeight = container.offsetHeight;
                
                document.addEventListener('mousemove', onResize);
                document.addEventListener('mouseup', stopResize);
            });
        });

        const onResize = (e) => {
            if (!isResizing) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            switch (currentHandle) {
                case 'e':
                    container.style.width = `${startWidth + dx}px`;
                    break;
                case 's':
                    container.style.height = `${startHeight + dy}px`;
                    break;
                case 'se':
                    container.style.width = `${startWidth + dx}px`;
                    container.style.height = `${startHeight + dy}px`;
                    break;
            }

            // Update canvas size to match container
            this.resizeCanvas();
            this.render();
        };

        const stopResize = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onResize);
            document.removeEventListener('mouseup', stopResize);
            
            // Save canvas size to project data
            if (this.currentProject) {
                this.currentProject.data.canvasSize = {
                    width: container.offsetWidth,
                    height: container.offsetHeight
                };
                this.saveProject();
            }
        };
    }

    // Add these method stubs for the new functionality
    undo() { /* TODO: Implement undo */ }
    redo() { /* TODO: Implement redo */ }
    copySelected() { /* TODO: Implement copy */ }
    pasteSelected() { /* TODO: Implement paste */ }
    deleteSelected() { /* TODO: Implement delete */ }
    zoom(factor) { /* TODO: Implement zoom */ }
    fitToScreen() { /* TODO: Implement fit to screen */ }
    toggleGrid() { /* TODO: Implement grid toggle */ }
    toggleRulers() { /* TODO: Implement rulers toggle */ }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.novaSketch = new NovaSketch();
    } catch (error) {
        console.error('Failed to initialize NovaSketch:', error);
    }
});
