import fs from 'fs-extra';
import path from 'path';

// For Vercel environment compatibility
const getMusicDir = () => {
  return path.join(process.cwd(), '../music');
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

  const { version } = req.query;

  if (req.method === 'GET' && version) {
    return getScenesForVersion(req, res);
  } else {
    res.status(400).json({ error: 'Invalid request' });
  }
}

// Get scenes for a specific version
async function getScenesForVersion(req, res) {
  try {
    const { version } = req.query;
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
    res.status(50).json({ error: 'Failed to get scenes' });
  }
}
