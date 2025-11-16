import { serialize } from 'cookie';
import { encryptSession } from '../../utils/session';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Check credentials against environment variables
  if (username === process.env.USERNAME && password === process.env.PASSWORD) {
    // Create session data
    const sessionData = {
      authenticated: true,
      username,
      createdAt: new Date().toISOString(),
    };

    // Encrypt the session data
    const encryptedSession = await encryptSession(sessionData);

    // Set the session cookie
    const cookie = serialize('session', encryptedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 24 * 60, // 2 months in seconds
      sameSite: true,
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);
    res.status(200).json({ 
      success: true, 
      session: encryptedSession,
      message: 'Login successful' 
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}
