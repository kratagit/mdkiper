const notesList = document.getElementById('notesList');
const noteEditor = document.getElementById('noteEditor');
const notePreview = document.getElementById('notePreview');
const newNoteBtn = document.getElementById('newNoteBtn');
const saveStatus = document.getElementById('saveStatus');

const sidebar = document.getElementById('sidebar');
const hideSidebarBtn = document.getElementById('hideSidebarBtn');
const showSidebarBtn = document.getElementById('showSidebarBtn');

let currentNote = null;
let saveTimeout = null;

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
        
        const cleanup = () => {
            overlay.classList.add('hidden');
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            mInput.onkeydown = null;
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
});

showSidebarBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    showSidebarBtn.classList.add('hidden');
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
        
        noteEditor.disabled = false;
        saveStatus.textContent = '';
    } catch (err) {
        console.error(err);
        saveStatus.textContent = 'Load error!';
    }
}

// Render markdown
function renderMarkdown(text) {
    notePreview.innerHTML = marked.parse(text || '*Empty note*');
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
    } catch (err) {
        await showAlert('Error creating note!');
    }
}

// Save note
async function saveNote() {
    if (!currentNote) return;
    
    const content = noteEditor.value;
    saveStatus.textContent = 'Saving...';
    saveStatus.style.color = '';

    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentNote, content })
        });
        
        if (!response.ok) throw new Error('Save error');
        
        saveStatus.textContent = 'Saved';
    } catch (err) {
        console.error(err);
        saveStatus.textContent = 'Save error!';
        saveStatus.style.color = 'var(--danger-color)';
    }
}

// Autosave
function handleInput() {
    renderMarkdown(noteEditor.value);
    saveStatus.style.color = '';
    saveStatus.textContent = 'Editing...';
    
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
            notePreview.innerHTML = `<div class="empty-state"><p>Select a note from the list or create a new one.</p></div>`;
            window.history.pushState({}, '', '/');
            noteEditor.disabled = true;
            saveStatus.textContent = '';
        }
        
        await loadNotes();
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
            createNewNote(false);
        }
    } else {
        createNewNote(false);
    }
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
