import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// For Vercel environment compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

 try {
    // Extract the file path from the URL
    const filePath = req.query.path.join('/');
    
    // Construct the full path to the music file
    const fullPath = path.join(process.cwd(), 'music', filePath);
    
    // Security check: ensure the path doesn't go outside the music directory
    const musicDir = path.join(process.cwd(), 'music');
    const relativePath = path.relative(musicDir, fullPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      res.status(400).json({ error: 'Invalid file path' });
      return;
    }
    
    // Check if the file exists
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    // Check if it's a file (not a directory)
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      res.status(400).json({ error: 'Path is not a file' });
      return;
    }
    
    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
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
    
    // Read and send the file
    const fileBuffer = fs.readFileSync(fullPath);
    res.status(200).send(fileBuffer);
  } catch (error) {
    console.error('Error serving music file:', error);
    res.status(500).json({ error: 'Internal server error' });
 }
}
