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

  if (req.method === 'GET') {
    return getVersions(req, res);
  } else if (req.method === 'POST') {
    return createVersion(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
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
    res.status(500).json({ error: 'Failed to create new version' });
  }
}
