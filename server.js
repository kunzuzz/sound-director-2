const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001'] // Allow React dev server
}));
app.use(express.json());
// Enhanced static file serving for music folder with proper content-type handling
app.use('/music', (req, res, next) => {
  // Decode the URL to handle special characters in file paths
  req.url = decodeURIComponent(req.url);
  express.static('music', {
    setHeaders: (res, filePath) => {
      // Enhanced content-type detection for various audio formats
      const ext = path.extname(filePath).toLowerCase();
      const contentTypeMap = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.m4b': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/opus',
        '.wma': 'audio/x-ms-wma',
        '.aiff': 'audio/x-aiff',
        '.aif': 'audio/x-aiff',
        '.mid': 'audio/midi',
        '.midi': 'audio/midi'
      };
      
      const contentType = contentTypeMap[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
    }
  })(req, res, next);
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const scenePath = req.body.scenePath;
    cb(null, scenePath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Create base music directory structure if it doesn't exist
const musicDir = path.join(__dirname, 'music');
const baseDir = path.join(musicDir, 'base');

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir);
}

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir);
}

// Get all versions
app.get('/api/versions', (req, res) => {
  try {
    const dirs = fs.readdirSync(musicDir);
    const versions = dirs.filter(dir => dir.startsWith('ver'));
    res.json(versions);
  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

// Get scenes for a specific version
app.get('/api/versions/:version/scenes', (req, res) => {
  try {
    const version = req.params.version;
    const versionPath = path.join(musicDir, version);
    
    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const scenes = fs.readdirSync(versionPath).filter(item => {
      const itemPath = path.join(versionPath, item);
      return fs.statSync(itemPath).isDirectory();
    });
    
    // Natural sort for scenes (e.g., Scene 1, Scene 2, ..., Scene 10, Scene 11)
    const sortedScenes = scenes.sort((a, b) => {
      // Try to compare as numbers first if they are pure numbers
      const numA = parseInt(a);
      const numB = parseInt(b);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      
      // For complex names like "Scene 1", "Scene 10", use localeCompare with numeric option
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    const scenesData = sortedScenes.map(scene => {
      const scenePath = path.join(versionPath, scene);
      const tracks = getTracksForScene(scenePath);
      return {
        name: scene,
        tracks
      };
    });
    
    res.json(scenesData);
  } catch (error) {
    console.error('Error getting scenes:', error);
    res.status(500).json({ error: 'Failed to get scenes' });
  }
});

// Helper function to get tracks for a scene
function getTracksForScene(scenePath) {
  const tracks = [];
  const items = fs.readdirSync(scenePath);
  
  for (const item of items) {
    const itemPath = path.join(scenePath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // It's a tag folder
      const tagTracks = fs.readdirSync(itemPath).filter(file => 
        file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a')
      ).map(track => ({
        name: track,
        path: path.join(scenePath, item, track),
        relativePath: path.join(item, track),
        isTag: true,
        tagName: item
      }));
      
      tracks.push(...tagTracks);
    } else if (stat.isFile() && (item.endsWith('.mp3') || item.endsWith('.wav') || item.endsWith('.m4a'))) {
      // It's a regular track
      tracks.push({
        name: item,
        path: path.join(scenePath, item),
        relativePath: item,
        isTag: false,
        tagName: null
      });
    }
  }
  
  // Sort tracks: first by tag (grouped), then by name
  tracks.sort((a, b) => {
    if (a.isTag && !b.isTag) return 1;
    if (!a.isTag && b.isTag) return -1;
    if (a.isTag && b.isTag) {
      if (a.tagName < b.tagName) return -1;
      if (a.tagName > b.tagName) return 1;
      return a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  
  return tracks;
}

// Save a new version by copying current version or base
app.post('/api/versions', (req, res) => {
  try {
    const { fromVersion = 'base' } = req.body;
    const versions = fs.readdirSync(musicDir).filter(dir => dir.startsWith('ver'));
    
    // Get the next version number
    let nextVersion = 'ver1';
    if (versions.length > 0) {
      const versionNumbers = versions.map(v => parseInt(v.replace('ver', '')));
      const maxVersion = Math.max(...versionNumbers);
      nextVersion = `ver${maxVersion + 1}`;
    }
    
    const sourcePath = path.join(musicDir, fromVersion);
    const targetPath = path.join(musicDir, nextVersion);
    
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source version not found' });
    }
    
    // Copy the entire directory
    fs.copySync(sourcePath, targetPath);
    
    res.json({ version: nextVersion });
  } catch (error) {
    console.error('Error creating new version:', error);
    res.status(500).json({ error: 'Failed to create new version' });
  }
});

// Move track between scenes
app.put('/api/move-track', (req, res) => {
  try {
    const { sourceScene, targetScene, trackName, version, tagName } = req.body;
    
    if (!sourceScene || !targetScene || !trackName || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const versionPath = path.join(musicDir, version);
    const sourceScenePath = path.join(versionPath, sourceScene);
    const targetScenePath = path.join(versionPath, targetScene);
    
    if (!fs.existsSync(sourceScenePath) || !fs.existsSync(targetScenePath)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    let sourceTrackPath;
    let targetTrackPath;
    
    if (tagName) {
      // Track is in a tag folder
      const sourceTagPath = path.join(sourceScenePath, tagName);
      sourceTrackPath = path.join(sourceTagPath, trackName);
      
      // Create target tag folder if it doesn't exist
      const targetTagPath = path.join(targetScenePath, tagName);
      if (!fs.existsSync(targetTagPath)) {
        fs.mkdirSync(targetTagPath, { recursive: true });
      }
      
      targetTrackPath = path.join(targetTagPath, trackName);
    } else {
      // Regular track
      sourceTrackPath = path.join(sourceScenePath, trackName);
      targetTrackPath = path.join(targetScenePath, trackName);
    }
    
    if (!fs.existsSync(sourceTrackPath)) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Move the file
    fs.moveSync(sourceTrackPath, targetTrackPath, { overwrite: true });
    
    // If the source tag folder is now empty, remove it
    if (tagName) {
      const sourceTagPath = path.join(sourceScenePath, tagName);
      const files = fs.readdirSync(sourceTagPath);
      if (files.length === 0) {
        fs.rmdirSync(sourceTagPath);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error moving track:', error);
    res.status(500).json({ error: 'Failed to move track' });
  }
});

// Copy track to another scene
app.post('/api/copy-track', (req, res) => {
  try {
    const { sourceScene, targetScene, trackName, version, tagName } = req.body;
    
    if (!sourceScene || !targetScene || !trackName || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const versionPath = path.join(musicDir, version);
    const sourceScenePath = path.join(versionPath, sourceScene);
    const targetScenePath = path.join(versionPath, targetScene);
    
    if (!fs.existsSync(sourceScenePath) || !fs.existsSync(targetScenePath)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    let sourceTrackPath;
    let targetTrackPath;
    
    if (tagName) {
      // Track is in a tag folder
      const sourceTagPath = path.join(sourceScenePath, tagName);
      sourceTrackPath = path.join(sourceTagPath, trackName);
      
      // Create target tag folder if it doesn't exist
      const targetTagPath = path.join(targetScenePath, tagName);
      if (!fs.existsSync(targetTagPath)) {
        fs.mkdirSync(targetTagPath, { recursive: true });
      }
      
      targetTrackPath = path.join(targetTagPath, trackName);
    } else {
      // Regular track
      sourceTrackPath = path.join(sourceScenePath, trackName);
      targetTrackPath = path.join(targetScenePath, trackName);
    }
    
    if (!fs.existsSync(sourceTrackPath)) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Check if source and target are the same path - if so, create a copy with a suffix
    if (sourceTrackPath === targetTrackPath) {
      // Create a new filename by adding a suffix
      const ext = path.extname(sourceTrackPath);
      const baseName = path.basename(sourceTrackPath, ext);
      const dirPath = path.dirname(sourceTrackPath);
      let newTrackName = `${baseName}_copy${ext}`;
      targetTrackPath = path.join(dirPath, newTrackName);
      
      // If that name already exists, add a number
      let counter = 1;
      while (fs.existsSync(targetTrackPath)) {
        newTrackName = `${baseName}_copy_${counter}${ext}`;
        targetTrackPath = path.join(dirPath, newTrackName);
        counter++;
      }
    }
    
    // Copy the file
    fs.copySync(sourceTrackPath, targetTrackPath);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error copying track:', error);
    res.status(500).json({ error: 'Failed to copy track' });
  }
});

// Create a new tag folder in a scene
app.post('/api/create-tag', (req, res) => {
  try {
    const { scene, version, tagName } = req.body;
    
    if (!scene || !version || !tagName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const versionPath = path.join(musicDir, version);
    const scenePath = path.join(versionPath, scene);
    const tagPath = path.join(scenePath, tagName);
    
    if (!fs.existsSync(scenePath)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    if (fs.existsSync(tagPath)) {
      return res.status(409).json({ error: 'Tag already exists' });
    }
    
    fs.mkdirSync(tagPath, { recursive: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Rename a track with play time information
app.put('/api/rename-track', (req, res) => {
  try {
    const { scene, version, oldName, newName, tagName } = req.body;
    
    if (!scene || !version || !oldName || !newName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const versionPath = path.join(musicDir, version);
    const scenePath = path.join(versionPath, scene);
    
    if (!fs.existsSync(scenePath)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    let sourceTrackPath;
    let targetTrackPath;
    
    if (tagName) {
      // Track is in a tag folder
      const tagPath = path.join(scenePath, tagName);
      sourceTrackPath = path.join(tagPath, oldName);
      targetTrackPath = path.join(tagPath, newName);
    } else {
      // Regular track
      sourceTrackPath = path.join(scenePath, oldName);
      targetTrackPath = path.join(scenePath, newName);
    }
    
    if (!fs.existsSync(sourceTrackPath)) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    if (fs.existsSync(targetTrackPath)) {
      return res.status(409).json({ error: 'New track name already exists' });
    }
    
    // Rename the file
    fs.renameSync(sourceTrackPath, targetTrackPath);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming track:', error);
    res.status(500).json({ error: 'Failed to rename track' });
  }
});

// Reorder tracks between 'select' and 'selected' folders
app.put('/api/reorder-tracks', (req, res) => {
  try {
    const { scene, version } = req.body;
    
    if (!scene || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const versionPath = path.join(musicDir, version);
    const scenePath = path.join(versionPath, scene);
    
    if (!fs.existsSync(scenePath)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    // Check if both 'select' and 'selected' folders exist
    const selectPath = path.join(scenePath, 'select');
    const selectedPath = path.join(scenePath, 'selected');
    
    if (!fs.existsSync(selectPath) || !fs.existsSync(selectedPath)) {
      return res.status(404).json({ error: 'Both select and selected folders must exist' });
    }
    
    // Get all tracks in the 'select' folder
    const selectTracks = fs.readdirSync(selectPath).filter(file => 
      file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a')
    );
    
    // Get all tracks in the 'selected' folder
    const selectedTracks = fs.readdirSync(selectedPath).filter(file => 
      file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a')
    );
    
    // Move all tracks from 'select' to 'selected'
    for (const track of selectTracks) {
      const sourcePath = path.join(selectPath, track);
      const targetPath = path.join(selectedPath, track);
      fs.moveSync(sourcePath, targetPath);
    }
    
    // Move all tracks from 'selected' to 'select'
    for (const track of selectedTracks) {
      const sourcePath = path.join(selectedPath, track);
      const targetPath = path.join(selectPath, track);
      fs.moveSync(sourcePath, targetPath);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering tracks:', error);
    res.status(50).json({ error: 'Failed to reorder tracks' });
  }
});

// Select a specific track from 'select' folder to move to 'selected' folder
app.put('/api/select-track', (req, res) => {
  try {
    const { scene, version, trackName } = req.body;
    
    if (!scene || !version || !trackName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const versionPath = path.join(musicDir, version);
    const scenePath = path.join(versionPath, scene);
    
    if (!fs.existsSync(scenePath)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    // Check if both 'select' and 'selected' folders exist
    const selectPath = path.join(scenePath, 'select');
    const selectedPath = path.join(scenePath, 'selected');
    
    if (!fs.existsSync(selectPath) || !fs.existsSync(selectedPath)) {
      return res.status(404).json({ error: 'Both select and selected folders must exist' });
    }
    
    // Get the track to move from 'select' to 'selected'
    const trackToMovePath = path.join(selectPath, trackName);
    
    if (!fs.existsSync(trackToMovePath)) {
      return res.status(404).json({ error: 'Track to move not found in select folder' });
    }
    
    // Move all existing tracks from 'selected' back to 'select' (if any)
    const existingSelectedTracks = fs.readdirSync(selectedPath).filter(file => 
      file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a')
    );
    
    for (const track of existingSelectedTracks) {
      const sourcePath = path.join(selectedPath, track);
      const targetPath = path.join(selectPath, track);
      fs.moveSync(sourcePath, targetPath);
    }
    
    // Move the selected track from 'select' to 'selected'
    const targetPath = path.join(selectedPath, trackName);
    fs.moveSync(trackToMovePath, targetPath);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error selecting track:', error);
    res.status(500).json({ error: 'Failed to select track' });
  }
});

// For development, we'll run the React dev server separately
// In production, uncomment the lines below
/*
// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// Handle React routing
app.get('*', (req, res) => {
 res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});
*/

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
