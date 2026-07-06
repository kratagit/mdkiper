const notesList = document.getElementById('notesList');
const noteEditor = document.getElementById('noteEditor');
const notePreview = document.getElementById('notePreview');
const newNoteBtn = document.getElementById('newNoteBtn');
const saveStatus = document.getElementById('saveStatus');

const sidebar = document.getElementById('sidebar');
const hideSidebarBtn = document.getElementById('hideSidebarBtn');
const showSidebarBtn = document.getElementById('showSidebarBtn');
const contentArea = document.getElementById('contentArea');

const togglePreviewBtn = document.getElementById('togglePreviewBtn');
const toggleEditorBtn = document.getElementById('toggleEditorBtn');
const editorPane = document.querySelector('.editor-pane');
const previewPane = document.querySelector('.preview-pane');

// Prevent empty state flash by checking URL synchronously
if (window.location.pathname.endsWith('.md')) {
    contentArea.classList.remove('empty-mode');
}
// Restore layout state
if (localStorage.getItem('isSidebarCollapsed') === 'true') {
    sidebar.classList.add('collapsed');
    if (showSidebarBtn) showSidebarBtn.classList.remove('hidden');
    contentArea.classList.add('sidebar-collapsed');
}

if (localStorage.getItem('isPreviewHidden') === 'true' && previewPane && togglePreviewBtn) {
    previewPane.classList.add('hidden');
    togglePreviewBtn.title = "Show Preview";
    togglePreviewBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line><path d="m14 9-3 3 3 3"></path></svg>';
}

if (localStorage.getItem('isEditorHidden') === 'true' && editorPane && toggleEditorBtn) {
    editorPane.classList.add('hidden');
    toggleEditorBtn.title = "Show Editor";
    toggleEditorBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m10 9 3 3-3 3"></path></svg>';
}

// Remove preload class to enable transitions again
setTimeout(() => {
    document.body.classList.remove('preload');
}, 50);

let currentNote = null;
let saveTimeout = null;
let clearStatusTimeout = null;
let statusTransitionTimeout = null;

const syncChannel = new BroadcastChannel('mdkiper_sync');

syncChannel.onmessage = async (event) => {
    if (event.data.type === 'SYNC_NOTES') {
        await loadNotes();
        if (currentNote) {
            const existingNotes = Array.from(notesList.querySelectorAll('li span')).map(span => span.textContent);
            if (!existingNotes.includes(currentNote)) {
                showEmptyState();
            } else {
                try {
                    const response = await fetch(`/api/notes/${currentNote}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (noteEditor.value !== data.content) {
                            const start = noteEditor.selectionStart;
                            const end = noteEditor.selectionEnd;
                            
                            noteEditor.value = data.content;
                            renderMarkdown(data.content);
                            
                            if (document.activeElement === noteEditor) {
                                noteEditor.setSelectionRange(start, end);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error syncing note', e);
                }
            }
        }
    }
};

function broadcastSync() {
    syncChannel.postMessage({ type: 'SYNC_NOTES' });
}

function updateSaveStatus(text, color = '', autoClear = false) {
    clearTimeout(clearStatusTimeout);

    if (saveStatus.textContent === text && !saveStatus.classList.contains('fade-out')) {
        saveStatus.style.color = color;
        if (autoClear) {
            clearStatusTimeout = setTimeout(() => {
                if (saveStatus.textContent === text) {
                    saveStatus.classList.add('fade-out');
                }
            }, 5000);
        }
        return;
    }
    
    saveStatus.classList.add('fade-out');
    clearTimeout(statusTransitionTimeout);
    
    statusTransitionTimeout = setTimeout(() => {
        saveStatus.textContent = text;
        saveStatus.style.color = color;
        
        if (text !== '') {
            saveStatus.classList.remove('fade-out');
        }
        
        if (autoClear) {
            clearStatusTimeout = setTimeout(() => {
                if (saveStatus.textContent === text) {
                    saveStatus.classList.add('fade-out');
                }
            }, 5000);
        }
    }, 200);
}

// Custom dialogs (replace prompt, confirm and alert)
function showModal({ title, message, type = 'confirm', inputPlaceholder = '', initialValue = '', confirmText = 'OK', cancelText = 'Cancel', danger = false, hideCancel = false }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('appModalOverlay');
        const mTitle = document.getElementById('modalTitle');
        const mMessage = document.getElementById('modalMessage');
        const mInput = document.getElementById('modalInput');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        
        mTitle.textContent = title;
        mMessage.textContent = message;
        
        if (type === 'prompt') {
            mInput.style.display = 'block';
            mInput.placeholder = inputPlaceholder;
            mInput.value = initialValue;
        } else {
            mInput.style.display = 'none';
        }
        
        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmText;
        cancelBtn.style.display = hideCancel ? 'none' : 'block';
        
        if (danger) {
            confirmBtn.className = 'modal-btn modal-btn-danger';
        } else {
            confirmBtn.className = 'modal-btn modal-btn-confirm';
        }
        
        overlay.classList.remove('hidden');
        if (type === 'prompt') {
            mInput.focus();
            mInput.select();
        }
        
        const outsideClickListener = (e) => {
            if (e.target === overlay) {
                cancelBtn.click();
            }
        };
        overlay.addEventListener('click', outsideClickListener);
        
        const cleanup = () => {
            overlay.classList.add('hidden');
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            mInput.onkeydown = null;
            overlay.removeEventListener('click', outsideClickListener);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };
        
        confirmBtn.onclick = () => {
            cleanup();
            if (type === 'prompt') resolve(mInput.value);
            else resolve(true);
        };
        
        mInput.onkeydown = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        };
    });
}

function showAlert(message) {
    return showModal({ title: 'Information', message, hideCancel: true });
}

// Show / hide sidebar
hideSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    showSidebarBtn.classList.remove('hidden');
    contentArea.classList.add('sidebar-collapsed');
    localStorage.setItem('isSidebarCollapsed', 'true');
});

showSidebarBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    showSidebarBtn.classList.add('hidden');
    contentArea.classList.remove('sidebar-collapsed');
    localStorage.setItem('isSidebarCollapsed', 'false');
});

// Context menu
const contextMenu = document.getElementById('noteContextMenu');
const ctxRename = document.getElementById('ctxRename');
const ctxDelete = document.getElementById('ctxDelete');
let contextNoteName = null;

function showContextMenu(e, name) {
    e.stopPropagation();
    e.preventDefault();
    contextNoteName = name;
    
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.classList.remove('hidden');
}

document.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
});

ctxRename.addEventListener('click', async (e) => {
    e.stopPropagation();
    contextMenu.classList.add('hidden');
    if (!contextNoteName) return;
    
    const newName = await showModal({
        title: 'Rename',
        message: 'Enter a new name for the note:',
        type: 'prompt',
        initialValue: contextNoteName,
        confirmText: 'Save'
    });
    
    if (!newName || newName.trim() === '' || newName === contextNoteName) return;
    
    const safeName = newName.trim();
    const existingNotes = Array.from(notesList.querySelectorAll('li span')).map(span => span.textContent);
    
    if (existingNotes.includes(safeName)) {
        await showAlert('A note with this name already exists!');
        return;
    }
    
    try {
        const response = await fetch(`/api/notes/${contextNoteName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName: safeName })
        });
        
        if (!response.ok) throw new Error('Error renaming note');
        
        if (currentNote === contextNoteName) {
            currentNote = safeName;
            window.history.replaceState({}, '', `/${encodeURIComponent(safeName)}.md`);
        }
        await loadNotes();
        broadcastSync();
    } catch (err) {
        console.error(err);
        await showAlert('Error while renaming the note!');
    }
});

ctxDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    contextMenu.classList.add('hidden');
    if (contextNoteName) deleteNoteByName(contextNoteName);
});

// Fetching and refreshing the notes list
async function loadNotes() {
    try {
        const response = await fetch('/api/notes');
        const notes = await response.json();
        
        notesList.innerHTML = '';
        notes.forEach(note => {
            const li = document.createElement('li');
            
            const span = document.createElement('span');
            span.textContent = note;
            li.appendChild(span);
            
            const optBtn = document.createElement('button');
            optBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>';
            optBtn.className = 'options-icon';
            optBtn.title = 'Options';
            optBtn.onclick = (e) => showContextMenu(e, note);
            li.appendChild(optBtn);

            li.onclick = () => selectNote(note);
            if (note === currentNote) {
                li.classList.add('active');
            }
            notesList.appendChild(li);
        });
        
        // Re-apply filter if one was typed in
        const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
        if (query) {
            notesList.querySelectorAll('li').forEach(li => {
                li.style.display = li.querySelector('span').textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        }
        
        return notes;
    } catch (err) {
        console.error('Error fetching notes list:', err);
        return [];
    }
}

// Select a note from the list
async function selectNote(name, updateUrl = true) {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        await saveNote();
    }

    try {
        const response = await fetch(`/api/notes/${name}`);
        if (!response.ok) throw new Error('Failed to fetch note');
        const data = await response.json();
        
        currentNote = name;
        noteEditor.value = data.content;
        
        if (updateUrl) {
            window.history.pushState({}, '', `/${encodeURIComponent(name)}.md`);
        }
        
        renderMarkdown(data.content);
        updateListSelection();
        
        contentArea.classList.remove('empty-mode');
        noteEditor.disabled = false;
        updateSaveStatus('');
        noteEditor.focus();
    } catch (err) {
        console.error(err);
        updateSaveStatus('Load error!', 'var(--danger-color)');
    }
}

// Render markdown
function renderMarkdown(text) {
    notePreview.innerHTML = marked.parse(text || '*Empty note*');
    
    notePreview.querySelectorAll('pre').forEach(pre => {
        // Extract language from code class (e.g., language-js)
        const codeElement = pre.querySelector('code');
        let langName = '';
        if (codeElement && codeElement.className) {
            const match = codeElement.className.match(/language-(\w+)/);
            if (match) langName = match[1];
        }
        
        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        
        // Header
        const header = document.createElement('div');
        header.className = 'code-block-header';
        
        // Language label
        const langSpan = document.createElement('span');
        langSpan.className = 'code-language';
        langSpan.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>' + (langName || 'Code');
        header.appendChild(langSpan);
        
        // Copy button
        const btn = document.createElement('button');
        btn.className = 'icon-btn copy-code-btn';
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        btn.title = "Copy code";
        
        btn.addEventListener('click', () => {
            const codeText = pre.querySelector('code')?.innerText || pre.innerText;
            navigator.clipboard.writeText(codeText).then(() => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            });
        });
        
        header.appendChild(langSpan);
        header.appendChild(btn);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

// Create a new note with a prompt
async function createNewNote() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        await saveNote();
    }

    const title = await showModal({
        title: 'New note',
        message: 'Enter a name for the new note:',
        type: 'prompt',
        confirmText: 'Create'
    });
    if (!title || !title.trim()) return;
    
    const safeTitle = title.trim();

    const existingNotes = Array.from(notesList.querySelectorAll('li span')).map(span => span.textContent);
    if (existingNotes.includes(safeTitle)) {
        await showAlert(`Note "${safeTitle}" already exists!`);
        return;
    }

    try {
        await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: safeTitle, content: '' })
        });
        
        await loadNotes();
        selectNote(safeTitle, true);
        broadcastSync();
    } catch (err) {
        await showAlert('Error creating note!');
    }
}

// Save note
async function saveNote() {
    if (!currentNote) return;
    
    const content = noteEditor.value;
    updateSaveStatus('Saving...');

    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentNote, content })
        });
        
        if (!response.ok) throw new Error('Save error');
        
        updateSaveStatus('Saved', '', true);
        broadcastSync();
    } catch (err) {
        console.error(err);
        updateSaveStatus('Save error!', 'var(--danger-color)');
    }
}

// Autosave
function handleInput() {
    renderMarkdown(noteEditor.value);
    updateSaveStatus('Editing...');
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveNote();
    }, 800);
}

// Delete selected note (icon)
async function deleteNoteByName(name) {
    const confirmed = await showModal({
        title: 'Delete note',
        message: `Are you sure you want to permanently delete the note "${name}"?`,
        type: 'confirm',
        confirmText: 'Delete',
        danger: true
    });
    
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/notes/${name}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete error');
        
        if (currentNote === name) {
            clearTimeout(saveTimeout);
            currentNote = null;
            noteEditor.value = '';
            noteEditor.disabled = true;
            renderMarkdown('');
            updateSaveStatus('');
            contentArea.classList.add('empty-mode');
        }
        
        await loadNotes();
        broadcastSync();
    } catch (err) {
        console.error(err);
        await showAlert('Error deleting note!');
    }
}

function updateListSelection() {
    const items = notesList.querySelectorAll('li');
    items.forEach(li => {
        const span = li.querySelector('span');
        if (span && span.textContent === currentNote) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}

newNoteBtn.addEventListener('click', createNewNote);
noteEditor.addEventListener('input', handleInput);

if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener('click', () => {
        previewPane.classList.toggle('hidden');
        if (previewPane.classList.contains('hidden')) {
            togglePreviewBtn.title = "Show Preview";
            togglePreviewBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line><path d="m14 9-3 3 3 3"></path></svg>';
            localStorage.setItem('isPreviewHidden', 'true');
        } else {
            togglePreviewBtn.title = "Hide Preview";
            togglePreviewBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line><path d="m10 15 3-3-3-3"></path></svg>';
            localStorage.setItem('isPreviewHidden', 'false');
        }
    });
}

if (toggleEditorBtn) {
    toggleEditorBtn.addEventListener('click', () => {
        editorPane.classList.toggle('hidden');
        if (editorPane.classList.contains('hidden')) {
            toggleEditorBtn.title = "Show Editor";
            toggleEditorBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m10 9 3 3-3 3"></path></svg>';
            localStorage.setItem('isEditorHidden', 'true');
        } else {
            toggleEditorBtn.title = "Hide Editor";
            toggleEditorBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m14 15-3-3 3-3"></path></svg>';
            localStorage.setItem('isEditorHidden', 'false');
        }
    });
}

// Browser back/forward navigation
window.addEventListener('popstate', handleRouting);

// Client-side routing system
async function handleRouting() {
    const notes = await loadNotes();
    const path = window.location.pathname;
    
    if (path.endsWith('.md')) {
        const noteName = decodeURIComponent(path.substring(1, path.length - 3)); // removes '/' at start and '.md' at end
        if (notes.includes(noteName)) {
            selectNote(noteName, false); // false to prevent double pushState
        } else {
            showEmptyState();
        }
    } else {
        showEmptyState();
    }
}

function showEmptyState() {
    currentNote = null;
    contentArea.classList.add('empty-mode');
    noteEditor.value = '';
    notePreview.innerHTML = `<div class="empty-state"><p>Select a note from the list or create a new one.</p></div>`;
    noteEditor.disabled = true;
    updateSaveStatus('');
    updateListSelection();
}

// Note search engine
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const items = notesList.querySelectorAll('li');
        items.forEach(li => {
            if (li.textContent.toLowerCase().includes(query)) {
                li.style.display = '';
            } else {
                li.style.display = 'none';
            }
        });
    });
}

// Start application on refresh
handleRouting();

// Settings and Sync Scroll
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const syncScrollCheckbox = document.getElementById('syncScrollCheckbox');
const previewScroll = document.querySelector('.preview-scroll');

let syncScrollEnabled = localStorage.getItem('syncScrollEnabled') === 'true';
if (syncScrollCheckbox) syncScrollCheckbox.checked = syncScrollEnabled;

if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
}

if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });
}

if (syncScrollCheckbox) {
    syncScrollCheckbox.addEventListener('change', (e) => {
        syncScrollEnabled = e.target.checked;
        localStorage.setItem('syncScrollEnabled', syncScrollEnabled);
    });
}

let isSyncingLeft = false;
let isSyncingRight = false;

if (noteEditor && previewScroll) {
    noteEditor.addEventListener('scroll', () => {
        if (!syncScrollEnabled) return;
        if (isSyncingLeft) {
            isSyncingLeft = false;
            return;
        }
        isSyncingRight = true;
        
        // Prevent division by zero
        const editorScrollable = noteEditor.scrollHeight - noteEditor.clientHeight;
        if (editorScrollable <= 0) return;
        
        const percentage = noteEditor.scrollTop / editorScrollable;
        previewScroll.scrollTop = percentage * (previewScroll.scrollHeight - previewScroll.clientHeight);
    });

    previewScroll.addEventListener('scroll', () => {
        if (!syncScrollEnabled) return;
        if (isSyncingRight) {
            isSyncingRight = false;
            return;
        }
        isSyncingLeft = true;
        
        const previewScrollable = previewScroll.scrollHeight - previewScroll.clientHeight;
        if (previewScrollable <= 0) return;
        
        const percentage = previewScroll.scrollTop / previewScrollable;
        noteEditor.scrollTop = percentage * (noteEditor.scrollHeight - noteEditor.clientHeight);
    });
}
