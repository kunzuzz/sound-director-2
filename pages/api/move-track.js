import fs from 'fs-extra';
import path from 'path';

// For Vercel environment compatibility
const getMusicDir = () => {
  return path.join(process.cwd(), 'music');
};

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

  if (req.method === 'PUT') {
    return moveTrack(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
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
