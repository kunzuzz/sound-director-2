import fs from 'fs';
import path from 'path';

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
    try {
      // Read the CSV file
      const csvPath = path.join(process.cwd(), 'Music - list 2.csv');
      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: 'CSV file not found' });
      }
      
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        res.status(200).send(csvContent);
    } catch (error) {
      console.error('Error reading CSV file:', error);
      res.status(500).json({ error: 'Failed to read CSV file' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
