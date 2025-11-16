import { getServerSession } from '../../utils/session';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Check credentials against environment variables
  if (username === process.env.USERNAME && password === process.env.PASSWORD) {
    // Get the session
    const session = await getServerSession(req, res);
    
    // Set session data
    session.authenticated = true;
    session.username = username;
    session.createdAt = new Date().toISOString();
    
    // Save the session
    await session.save();

    res.status(200).json({ 
      success: true, 
      message: 'Login successful' 
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}
