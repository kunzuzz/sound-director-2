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

  if (req.method === 'POST') {
    return createTag(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
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
