// Main JavaScript for Malaysian Teachers Prompt Library

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app
    initializeFilters();
    renderAllPrompts();
    setupSearch();
    setupSmoothScroll();
});

// Initialize filter buttons
function initializeFilters() {
    const filterContainer = document.getElementById('filterButtons');
    
    // Add category filter buttons
    promptsData.categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.setAttribute('data-category', category.id);
        button.innerHTML = `<i class="${category.icon} fas"></i> ${category.name}`;
        button.addEventListener('click', () => filterByCategory(category.id));
        filterContainer.appendChild(button);
    });
}

// Render all prompts
function renderAllPrompts() {
    const container = document.getElementById('promptsContainer');
    container.innerHTML = '';
    
    promptsData.categories.forEach(category => {
        const categorySection = createCategorySection(category);
        container.appendChild(categorySection);
    });
}

// Create category section
function createCategorySection(category) {
    const section = document.createElement('div');
    section.className = 'category-section';
    section.setAttribute('data-category-id', category.id);
    
    section.innerHTML = `
        <div class="category-header">
            <i class="${category.icon} fas"></i>
            <h2>${category.name}</h2>
        </div>
        <p class="category-description">${category.description}</p>
        <div class="prompts-grid" id="grid-${category.id}"></div>
    `;
    
    const grid = section.querySelector(`#grid-${category.id}`);
    category.prompts.forEach(prompt => {
        const card = createPromptCard(prompt, category.id);
        grid.appendChild(card);
    });
    
    return section;
}

// Create prompt card
function createPromptCard(prompt, categoryId) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.setAttribute('data-prompt-title', prompt.title.toLowerCase());
    card.setAttribute('data-prompt-tags', prompt.tags.join(' ').toLowerCase());
    card.setAttribute('data-category', categoryId);

    const tags = prompt.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

    // Build image section if image exists
    const imageSection = prompt.image ? `
        <div class="prompt-image">
            <img src="${prompt.image}" alt="${prompt.title}" onerror="this.style.display='none'">
            ${prompt.imageCredit ? `<p class="image-credit">${prompt.imageCredit}</p>` : ''}
        </div>
    ` : '';

    card.innerHTML = `
        ${imageSection}
        <div class="prompt-header">
            <h3 class="prompt-title">${prompt.title}</h3>
        </div>
        <div class="prompt-tags">${tags}</div>
        <p class="prompt-description">${prompt.description}</p>
        <div class="prompt-content">${escapeHtml(prompt.prompt.substring(0, 200))}...</div>
        <div class="prompt-actions">
            <button class="copy-btn" onclick="copyPrompt(this)">
                <i class="fas fa-copy"></i> Copy Prompt
            </button>
            <button class="view-btn" onclick="viewFullPrompt(this)">
                <i class="fas fa-eye"></i> View Full
            </button>
        </div>
    `;

    // Store full prompt in data attribute
    card.setAttribute('data-full-prompt', prompt.prompt);

    return card;
}

// Copy prompt to clipboard
function copyPrompt(button) {
    const card = button.closest('.prompt-card');
    const fullPrompt = card.getAttribute('data-full-prompt');
    
    navigator.clipboard.writeText(fullPrompt).then(() => {
        showNotification('Prompt copied to clipboard!');
        
        // Change button text temporarily
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.background = '#10b981';
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy. Please try again.', 'error');
    });
}

// Extract unique [Placeholder] tokens from a prompt template
function extractPromptPlaceholders(template) {
    const matches = [];
    const seen = new Set();
    const regex = /\[([^\]\n]{2,50})\](?!\()/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
        const key = match[1].trim();
        if (key && !seen.has(key)) {
            seen.add(key);
            matches.push(key);
        }
    }
    return matches;
}

// Replace filled placeholders in a prompt template
function buildFilledPrompt(template, values) {
    return template.replace(/\[([^\]\n]{2,50})\](?!\()/g, (full, rawKey) => {
        const key = rawKey.trim();
        const val = values[key];
        return val && val.trim() ? val.trim() : full;
    });
}

// Build AI launch URL for a provider (falls back to base URL when prompt is too long)
function getAILaunchInfo(provider, promptText) {
    const encoded = encodeURIComponent(promptText);
    const urls = {
        chatgpt: `https://chatgpt.com/?q=${encoded}`,
        claude: `https://claude.ai/new?q=${encoded}`,
        perplexity: `https://www.perplexity.ai/?q=${encoded}`
    };
    const baseUrls = {
        chatgpt: 'https://chatgpt.com/',
        claude: 'https://claude.ai/new',
        perplexity: 'https://www.perplexity.ai/'
    };
    const fullUrl = urls[provider];
    if (!fullUrl) return { href: '#', tooLong: false };
    if (fullUrl.length > 3800) {
        return { href: baseUrls[provider], tooLong: true };
    }
    return { href: fullUrl, tooLong: false };
}

// Keep all AI launch links in the modal synced with the current prompt text
function updateAILaunchLinks(modal, promptText) {
    modal.querySelectorAll('.ai-launch-btn[data-provider]').forEach((link) => {
        const provider = link.getAttribute('data-provider');
        const info = getAILaunchInfo(provider, promptText);
        link.href = info.href;
        link.dataset.tooLong = info.tooLong ? 'true' : 'false';
    });
}

// Copy to clipboard on click if the prompt exceeded safe URL length
function handleAILaunchClick(link) {
    if (link.dataset.tooLong === 'true') {
        const modal = link.closest('.modal');
        const promptText = modal ? modal.querySelector('.modal-prompt').textContent : '';
        if (promptText && navigator.clipboard) {
            navigator.clipboard.writeText(promptText).then(() => {
                showNotification('Prompt is long — copied to clipboard! Paste it into the opened tab.');
            }).catch(() => {});
        }
    }
}

// Persist common teacher placeholder values (e.g. Subject, Grade Level) across prompts
const FILLER_STORAGE_KEY = 'my_educator_prompt_defaults_v1';
const MY_CLASS_PRESETS = [
    { label: 'KSSR Tahun 4 · Sains', subject: 'Sains', grade: '4', level: 'Tahun 4 (KSSR)', topic: 'Fotosintesis' },
    { label: 'KSSM Form 3 · Maths', subject: 'Mathematics', grade: '3', level: 'Form 3 (KSSM)', topic: 'Linear Equations' },
    { label: 'SPM · Bahasa Melayu', subject: 'Bahasa Melayu', grade: '5', level: 'Tingkatan 5 (SPM)', topic: 'Karangan Berformat' }
];

function loadSavedPlaceholderDefaults() {
    try {
        return JSON.parse(localStorage.getItem(FILLER_STORAGE_KEY) || '{}') || {};
    } catch (_err) {
        return {};
    }
}

function savePlaceholderDefault(key, value) {
    try {
        const saved = loadSavedPlaceholderDefaults();
        if (value && value.trim()) {
            saved[key.toLowerCase()] = value.trim();
        } else {
            delete saved[key.toLowerCase()];
        }
        localStorage.setItem(FILLER_STORAGE_KEY, JSON.stringify(saved));
    } catch (_err) {
        // ignore storage errors in private browsing
    }
}

function matchPresetValue(key, preset) {
    const k = key.toLowerCase();
    if (k.includes('subject') || k.includes('mata pelajaran')) return preset.subject;
    if (k === '1-5' || k.includes('grade') || k.includes('year') || k.includes('form') || k.includes('level') || k.includes('tingkatan') || k.includes('tahun')) return preset.level;
    if (k.includes('topic') || k.includes('tajuk')) return preset.topic;
    return null;
}

// View full prompt in modal with interactive placeholder filler, presets & 1-click AI launch
function viewFullPrompt(button) {
    const card = button.closest('.prompt-card');
    const fullPrompt = card.getAttribute('data-full-prompt') || '';
    const title = card.querySelector('.prompt-title').textContent;
    const placeholders = extractPromptPlaceholders(fullPrompt);
    const savedDefaults = loadSavedPlaceholderDefaults();
    const values = {};

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const fillerMarkup = placeholders.length ? `
        <div class="modal-filler">
            <div class="modal-filler-head">
                <div class="modal-filler-title-group">
                    <strong><i class="fas fa-sliders-h"></i> Customize Placeholders</strong>
                    <span class="modal-filler-progress">0 / ${placeholders.length} filled</span>
                </div>
                <div class="modal-filler-presets">
                    <span class="modal-filler-hint">Quick fill:</span>
                    ${MY_CLASS_PRESETS.map((p, idx) => `<button class="preset-chip" type="button" data-preset-idx="${idx}">${escapeHtml(p.label)}</button>`).join('')}
                    <button class="preset-chip preset-clear" type="button" data-preset-clear="true">Clear</button>
                </div>
            </div>
            <div class="modal-filler-grid"></div>
        </div>
    ` : '';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${escapeHtml(title)}</h2>
                <button class="modal-close" aria-label="Close modal" onclick="closeModal(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${fillerMarkup}
                <pre class="modal-prompt">${escapeHtml(fullPrompt)}</pre>
            </div>
            <div class="modal-footer">
                <div class="modal-ai-launch">
                    <span class="modal-ai-label">Open in:</span>
                    <a class="ai-launch-btn" data-provider="chatgpt" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" onclick="handleAILaunchClick(this)">ChatGPT ↗</a>
                    <a class="ai-launch-btn" data-provider="claude" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" onclick="handleAILaunchClick(this)">Claude ↗</a>
                    <a class="ai-launch-btn" data-provider="perplexity" href="https://www.perplexity.ai/" target="_blank" rel="noopener noreferrer" onclick="handleAILaunchClick(this)">Perplexity ↗</a>
                </div>
                <div class="modal-main-actions">
                    <button class="copy-btn" type="button" onclick="copyFromModal(this)">
                        <i class="fas fa-copy"></i> Copy Prompt
                    </button>
                    <button class="view-btn" type="button" onclick="closeModal(this)">Close</button>
                </div>
            </div>
        </div>
    `;

    updateAILaunchLinks(modal, fullPrompt);

    if (placeholders.length) {
        const grid = modal.querySelector('.modal-filler-grid');
        const promptEl = modal.querySelector('.modal-prompt');
        const progressEl = modal.querySelector('.modal-filler-progress');
        const inputs = [];

        const syncFillerState = () => {
            const filled = buildFilledPrompt(fullPrompt, values);
            promptEl.textContent = filled;
            updateAILaunchLinks(modal, filled);
            const filledCount = placeholders.filter((k) => values[k] && values[k].trim()).length;
            if (progressEl) {
                const allDone = filledCount === placeholders.length;
                progressEl.textContent = allDone ? `✓ Ready (${filledCount}/${placeholders.length})` : `${filledCount} / ${placeholders.length} filled`;
                progressEl.classList.toggle('is-ready', allDone);
            }
        };

        placeholders.forEach((key, index) => {
            const field = document.createElement('label');
            field.className = 'modal-filler-field';

            const labelText = document.createElement('span');
            labelText.textContent = key;

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `[${key}]`;
            const remembered = savedDefaults[key.toLowerCase()];
            if (remembered) {
                input.value = remembered;
                values[key] = remembered;
            }

            input.addEventListener('input', () => {
                values[key] = input.value;
                savePlaceholderDefault(key, input.value);
                syncFillerState();
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && inputs[index + 1]) {
                    e.preventDefault();
                    inputs[index + 1].focus();
                }
            });

            inputs.push(input);
            field.appendChild(labelText);
            field.appendChild(input);
            grid.appendChild(field);
        });

        modal.querySelectorAll('[data-preset-idx]').forEach((chip) => {
            chip.addEventListener('click', () => {
                const preset = MY_CLASS_PRESETS[Number(chip.getAttribute('data-preset-idx'))];
                if (!preset) return;
                placeholders.forEach((key, i) => {
                    const matched = matchPresetValue(key, preset);
                    if (matched !== null) {
                        inputs[i].value = matched;
                        values[key] = matched;
                        savePlaceholderDefault(key, matched);
                    }
                });
                syncFillerState();
            });
        });

        const clearBtn = modal.querySelector('[data-preset-clear]');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                placeholders.forEach((key, i) => {
                    inputs[i].value = '';
                    values[key] = '';
                    savePlaceholderDefault(key, '');
                });
                syncFillerState();
                if (inputs[0]) inputs[0].focus();
            });
        }

        syncFillerState();
    }

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal(modal.querySelector('.modal-close'));
        }
    };
    modal._onKeyDown = onKeyDown;
    document.addEventListener('keydown', onKeyDown);

    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal.querySelector('.modal-close'));
        }
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal(button) {
    const modal = button.closest('.modal');
    if (modal && modal._onKeyDown) {
        document.removeEventListener('keydown', modal._onKeyDown);
    }
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

// Copy from modal
function copyFromModal(button) {
    const modal = button.closest('.modal');
    const promptText = modal.querySelector('.modal-prompt').textContent;
    
    navigator.clipboard.writeText(promptText).then(() => {
        showNotification('Prompt copied to clipboard!');
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.background = '#10b981';
        
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i> Copy Prompt';
            button.style.background = '';
        }, 2000);
    });
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = notification.querySelector('i');
    const span = notification.querySelector('span');
    
    span.textContent = message;
    
    if (type === 'error') {
        notification.style.background = '#ef4444';
        icon.className = 'fas fa-exclamation-circle';
    } else {
        notification.style.background = '#10b981';
        icon.className = 'fas fa-check-circle';
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Filter by category
function filterByCategory(categoryId) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const categorySections = document.querySelectorAll('.category-section');
    
    // Update active button
    filterButtons.forEach(btn => {
        if (btn.getAttribute('data-category') === categoryId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show/hide categories
    if (categoryId === 'all') {
        categorySections.forEach(section => {
            section.style.display = 'block';
        });
    } else {
        categorySections.forEach(section => {
            if (section.getAttribute('data-category-id') === categoryId) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    }
    
    // Clear search
    document.getElementById('searchInput').value = '';
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', debounce(function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            // Show all prompts
            document.querySelectorAll('.prompt-card').forEach(card => {
                card.style.display = 'block';
            });
            
            // Show all category sections
            document.querySelectorAll('.category-section').forEach(section => {
                section.style.display = 'block';
            });
            
            return;
        }
        
        // Reset filter to "All"
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.getAttribute('data-category') === 'all') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Search through prompts
        let foundCount = 0;
        document.querySelectorAll('.category-section').forEach(section => {
            let categoryHasResults = false;
            
            section.querySelectorAll('.prompt-card').forEach(card => {
                const title = card.getAttribute('data-prompt-title');
                const tags = card.getAttribute('data-prompt-tags');
                const description = card.querySelector('.prompt-description').textContent.toLowerCase();
                
                if (title.includes(searchTerm) || 
                    tags.includes(searchTerm) || 
                    description.includes(searchTerm)) {
                    card.style.display = 'block';
                    categoryHasResults = true;
                    foundCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Show/hide category section based on results
            section.style.display = categoryHasResults ? 'block' : 'none';
        });
        
        if (foundCount === 0) {
            showNotification(`No results found for "${searchTerm}"`, 'error');
        }
    }, 300));
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Setup smooth scrolling
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add modal styles dynamically
const modalStyles = `
<style>
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 20px;
}

.modal-content {
    background: white;
    border-radius: 0.75rem;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e293b;
}

.modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0.5rem;
    transition: color 0.3s;
}

.modal-close:hover {
    color: #1e293b;
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.modal-prompt {
    background: #f8fafc;
    padding: 1.5rem;
    border-radius: 0.5rem;
    border-left: 4px solid #2563eb;
    font-family: 'Courier New', monospace;
    font-size: 0.95rem;
    line-height: 1.8;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: #1e293b;
    margin: 0;
}

.modal-filler {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
}

.modal-filler-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    color: #1e3a8a;
    font-size: 0.9rem;
}

.modal-filler-hint {
    font-size: 0.8rem;
    color: #475569;
}

.modal-filler-title-group,
.modal-filler-presets {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
}

.modal-filler-progress {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: #dbeafe;
    color: #1e40af;
}

.modal-filler-progress.is-ready {
    background: #dcfce7;
    color: #166534;
}

.preset-chip {
    background: #ffffff;
    color: #1e3a8a;
    border: 1px solid #93c5fd;
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
}

.preset-chip:hover {
    background: #dbeafe;
    border-color: #2563eb;
}

.preset-clear {
    color: #64748b;
    border-color: #cbd5e1;
}

.preset-clear:hover {
    background: #fee2e2;
    border-color: #ef4444;
    color: #b91c1c;
}

.modal-filler-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.65rem;
}

.modal-filler-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #334155;
}

.modal-filler-field input {
    padding: 0.45rem 0.65rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #0f172a;
    background: #ffffff;
}

.modal-filler-field input:focus {
    outline: 2px solid #2563eb;
    outline-offset: -1px;
}

.modal-footer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
}

.modal-ai-launch,
.modal-main-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.modal-footer button {
    white-space: nowrap;
}

.modal-ai-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
}

.ai-launch-btn {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    white-space: nowrap;
    background: #f1f5f9;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
}

.ai-launch-btn:hover {
    background: #e2e8f0;
    border-color: #2563eb;
    color: #1d4ed8;
}

@media (max-width: 768px) {
    .modal {
        padding: 10px;
    }
    
    .modal-content {
        max-height: 95vh;
    }
    
    .modal-header h2 {
        font-size: 1.125rem;
    }
    
    .modal-footer {
        flex-direction: column;
    }
    
    .modal-footer button {
        width: 100%;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', modalStyles);