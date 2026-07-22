const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;
const DATA_DIR = path.join(__dirname, 'data');
const TRASH_DIR = path.join(DATA_DIR, '.trash');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure data directories exist
async function init() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(TRASH_DIR, { recursive: true });
    } catch (err) {
        console.error('Error creating data directory:', err);
    }
}
init();

// Get notes list
app.get('/api/notes', async (req, res) => {
    try {
        const files = await fs.readdir(DATA_DIR);
        const notes = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get notes list' });
    }
});

// Get trash list
app.get('/api/trash', async (req, res) => {
    try {
        await fs.mkdir(TRASH_DIR, { recursive: true });
        const files = await fs.readdir(TRASH_DIR);
        const trashNotes = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
        res.json(trashNotes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get trash list' });
    }
});

// Restore note from trash
app.post('/api/trash/:name/restore', async (req, res) => {
    try {
        const safeName = path.basename(req.params.name);
        const trashPath = path.join(TRASH_DIR, `${safeName}.md`);
        
        let targetName = safeName;
        let targetPath = path.join(DATA_DIR, `${targetName}.md`);
        
        let counter = 1;
        while (true) {
            try {
                await fs.access(targetPath);
                targetName = `${safeName} (${counter})`;
                targetPath = path.join(DATA_DIR, `${targetName}.md`);
                counter++;
            } catch (err) {
                break;
            }
        }
        
        await fs.rename(trashPath, targetPath);
        res.json({ success: true, restoredName: targetName });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Note not found in trash' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Failed to restore note' });
        }
    }
});

// Permanently delete single note from trash
app.delete('/api/trash/:name', async (req, res) => {
    try {
        const safeName = path.basename(req.params.name);
        const trashPath = path.join(TRASH_DIR, `${safeName}.md`);
        await fs.unlink(trashPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to permanently delete note' });
    }
});

// Empty entire trash
app.delete('/api/trash', async (req, res) => {
    try {
        await fs.mkdir(TRASH_DIR, { recursive: true });
        const files = await fs.readdir(TRASH_DIR);
        for (const file of files) {
            if (file.endsWith('.md')) {
                await fs.unlink(path.join(TRASH_DIR, file));
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to empty trash' });
    }
});

// Get content of a specific note
app.get('/api/notes/:name', async (req, res) => {
    try {
        const filePath = path.join(DATA_DIR, `${req.params.name}.md`);
        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Note not found' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Save/Create a note
app.post('/api/notes', async (req, res) => {
    try {
        const { name, content } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Note name cannot be empty' });
        }
        
        // Prevent path traversal
        const safeName = path.basename(name);
        const filePath = path.join(DATA_DIR, `${safeName}.md`);
        
        await fs.writeFile(filePath, content || '', 'utf-8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save note' });
    }
});

// Rename note
app.put('/api/notes/:name', async (req, res) => {
    try {
        const oldSafeName = path.basename(req.params.name);
        const { newName } = req.body;
        
        if (!newName || newName.trim() === '') {
            return res.status(400).json({ error: 'New name cannot be empty' });
        }
        
        const newSafeName = path.basename(newName);
        const oldPath = path.join(DATA_DIR, `${oldSafeName}.md`);
        const newPath = path.join(DATA_DIR, `${newSafeName}.md`);
        
        await fs.access(oldPath);
        await fs.rename(oldPath, newPath);
        
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Note does not exist' });
        } else {
            res.status(500).json({ error: 'Failed to rename note' });
        }
    }
});

// Delete note (move to trash)
app.delete('/api/notes/:name', async (req, res) => {
    try {
        const safeName = path.basename(req.params.name);
        const filePath = path.join(DATA_DIR, `${safeName}.md`);
        const trashPath = path.join(TRASH_DIR, `${safeName}.md`);
        
        await fs.mkdir(TRASH_DIR, { recursive: true });
        await fs.rename(filePath, trashPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

// SPA Routing - redirect all unhandled requests to HTML app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown for Docker orchestrators (like Watchtower / Tugtainer)
// When running as PID 1, Node.js ignores SIGTERM unless explicitly handled.
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});
