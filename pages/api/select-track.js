import fs from 'fs-extra';
import path from 'path';
import { requireAuthentication } from '../../utils/session';

// For Vercel environment compatibility
const getMusicDir = () => {
  return path.join(process.cwd(), 'music');
};

export default async function handler(req, res) {
  // Require authentication for all requests except OPTIONS
  if (req.method !== 'OPTIONS') {
    const session = await requireAuthentication(req, res);
    if (!session) {
      return; // Response already handled by requireAuthentication
    }
 }

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
    return selectTrack(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
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
