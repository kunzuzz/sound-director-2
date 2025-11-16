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
    return reorderTracks(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
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
