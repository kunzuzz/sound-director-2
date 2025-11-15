import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// For Vercel environment compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root handler that will delegate to specific handlers based on the request
export default async function handler(req, res) {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = req;

  // Route to different handlers based on the pathname
 if (pathname === '/api/versions' && req.method === 'GET') {
    return getVersions(req, res);
  } else if (pathname === '/api/versions' && req.method === 'POST') {
    return createVersion(req, res);
  } else if (pathname.match(/^\/api\/versions\/.*\/scenes$/) && req.method === 'GET') {
    return getScenesForVersion(req, res);
  } else if (pathname === '/api/move-track' && req.method === 'PUT') {
    return moveTrack(req, res);
  } else if (pathname === '/api/copy-track' && req.method === 'POST') {
    return copyTrack(req, res);
  } else if (pathname === '/api/create-tag' && req.method === 'POST') {
    return createTag(req, res);
  } else if (pathname === '/api/rename-track' && req.method === 'PUT') {
    return renameTrack(req, res);
  } else if (pathname === '/api/reorder-tracks' && req.method === 'PUT') {
    return reorderTracks(req, res);
  } else if (pathname === '/api/select-track' && req.method === 'PUT') {
    return selectTrack(req, res);
  }

  // If no route matches
  res.status(404).json({ error: 'Route not found' });
}

// Helper function to get the music directory path
const getMusicDir = () => {
  // In Vercel environment, we need to handle file paths differently
  // For now, we'll use a relative path
  return path.join(process.cwd(), 'music');
};

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

// Get all versions
async function getVersions(req, res) {
  try {
    const musicDir = getMusicDir();
    const dirs = fs.readdirSync(musicDir);
    const versions = dirs.filter(dir => dir.startsWith('ver'));
    res.status(200).json(versions);
  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
}

// Get scenes for a specific version
async function getScenesForVersion(req, res) {
  try {
    // Extract version from the URL
    const version = req.url.split('/')[3]; // /api/versions/:version/scenes
    const musicDir = getMusicDir();
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
      
      // For complex names like "Scene 1", "Scene 2", use localeCompare with numeric option
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
    
    res.status(200).json(scenesData);
  } catch (error) {
    console.error('Error getting scenes:', error);
    res.status(500).json({ error: 'Failed to get scenes' });
  }
}

// Save a new version by copying current version or base
async function createVersion(req, res) {
  try {
    const { fromVersion = 'base' } = req.body || {};
    const musicDir = getMusicDir();
    
    const dirs = fs.readdirSync(musicDir);
    const versions = dirs.filter(dir => dir.startsWith('ver'));
    
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
    
    res.status(200).json({ version: nextVersion });
  } catch (error) {
    console.error('Error creating new version:', error);
    res.status(50).json({ error: 'Failed to create new version' });
  }
}

// Move track between scenes
async function moveTrack(req, res) {
  try {
    const { sourceScene, targetScene, trackName, version, tagName } = req.body || {};
    
    if (!sourceScene || !targetScene || !trackName || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const musicDir = getMusicDir();
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error moving track:', error);
    res.status(500).json({ error: 'Failed to move track' });
  }
}

// Copy track to another scene
async function copyTrack(req, res) {
  try {
    const { sourceScene, targetScene, trackName, version, tagName } = req.body || {};
    
    if (!sourceScene || !targetScene || !trackName || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const musicDir = getMusicDir();
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error copying track:', error);
    res.status(500).json({ error: 'Failed to copy track' });
  }
}

// Create a new tag folder in a scene
async function createTag(req, res) {
  try {
    const { scene, version, tagName } = req.body || {};
    
    if (!scene || !version || !tagName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const musicDir = getMusicDir();
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
}

// Rename a track with play time information
async function renameTrack(req, res) {
  try {
    const { scene, version, oldName, newName, tagName } = req.body || {};
    
    if (!scene || !version || !oldName || !newName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const musicDir = getMusicDir();
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error renaming track:', error);
    res.status(500).json({ error: 'Failed to rename track' });
  }
}

// Reorder tracks between 'select' and 'selected' folders
async function reorderTracks(req, res) {
  try {
    const { scene, version } = req.body || {};
    
    if (!scene || !version) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const musicDir = getMusicDir();
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error reordering tracks:', error);
    res.status(500).json({ error: 'Failed to reorder tracks' });
  }
}

// Select a specific track from 'select' folder to move to 'selected' folder
async function selectTrack(req, res) {
  try {
    const { scene, version, trackName } = req.body || {};
    
    if (!scene || !version || !trackName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const musicDir = getMusicDir();
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error selecting track:', error);
    res.status(500).json({ error: 'Failed to select track' });
  }
}
