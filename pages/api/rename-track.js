import fs from 'fs-extra';
import path from 'path';

// For Vercel environment compatibility
const getMusicDir = () => {
  return path.join(process.cwd(), '../music');
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
    return renameTrack(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
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
