# Mdkiper

A sleek, minimalistic, and fully responsive Markdown note-taking web application. Built for speed, focus, and simplicity, Mdkiper allows you to write, organize, and preview your markdown notes in real-time within a beautiful dark-themed interface.

## ✨ Features

- 📝 **Live Markdown Preview**: See your formatting rendered in real-time as you type.
- 💾 **Autosave**: Never lose your progress. Your notes are saved automatically in the background.
- 🔍 **Instant Search**: Find your notes quickly using the built-in search bar.
- 📂 **File Management**: Create, rename, and delete notes effortlessly through custom, elegant context menus and modals.
- 🌙 **Dark Theme**: A premium, distraction-free dark interface designed to reduce eye strain.
- 🔗 **Client-side Routing**: Shareable links—the URL automatically updates to reflect the currently open note (e.g., `/MyNote.md`).
- 🐳 **Dockerized**: Fully containerized and ready to deploy anywhere.
- 🚀 **CI/CD Pipeline**: GitHub Actions automatically build and publish the latest Docker image to the GitHub Container Registry (GHCR) on every push to `main`.

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, Modern CSS (Flexbox, custom variables), `marked.js` for parsing Markdown.
- **Backend**: Node.js, Express.js (File system-based storage, no database required).
- **Deployment**: Docker, Docker Compose, GitHub Actions.

## 🚀 Installation & Usage

You can run Mdkiper using Docker (recommended) or manually via Node.js.

### Method 1: Using Docker (Recommended)
The easiest way to run the application without installing Node.js dependencies.

**Option A: Docker Compose**
1. Clone this repository.
2. Open your terminal in the repository folder.
3. Run the following command:
   ```bash
   docker compose up -d
   ```
4. Visit `http://localhost:3005` in your web browser.
*(Your notes will be saved securely in the `./data` folder on your host machine).*

**Option B: Docker Run**
You can directly pull and run the latest image from the GitHub Container Registry:
```bash
docker run -d \
  -p 3005:3005 \
  -v $(pwd)/data:/usr/src/app/data \
  --name mdkiper \
  ghcr.io/kratagit/mdkiper:latest
```

### Method 2: Manual Installation (Node.js)
If you prefer running the app natively on your machine:

1. Clone this repository:
   ```bash
   git clone https://github.com/kratagit/mdkiper.git
   cd mdkiper
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. Open your web browser and go to: `http://localhost:3005`
*(Notes will be stored as `.md` files in the automatically generated `data/` directory).*

## 📁 Project Structure

- `server.js`: The Express.js backend that handles REST API endpoints for note operations (CRUD).
- `public/`: Contains the frontend assets (`index.html`, `app.js`, `style.css`).
- `data/`: The directory where all your markdown notes are physically saved.
- `.github/workflows/`: Contains the CI/CD pipeline configuration.
