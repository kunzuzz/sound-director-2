import { getIronSession } from 'iron-session';

// Configuration for iron-session
export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'session',
  ttl: 60 * 24 * 60, // 2 months in seconds
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  }
};

// For API routes
export async function getServerSession(req, res) {
  return await getIronSession(req, res, sessionOptions);
}

// For server-side functions
export async function encryptSession(sessionData) {
 try {
    // Create a mock session object to encrypt the data
    const session = {
      data: sessionData,
      save: () => {}
    };
    Object.assign(session, sessionData);
    return session; // This is a simplified version
  } catch (error) {
    console.error('Error encrypting session:', error);
    throw error;
  }
}

export async function decryptSession(encryptedSession) {
  try {
    if (!encryptedSession) {
      return null;
    }
    return encryptedSession;
  } catch (error) {
    console.error('Error decrypting session:', error);
    return null;
 }
}

export async function requireAuthentication(req, res) {
  try {
    const session = await getServerSession(req, res);
    
    if (!session || !session.authenticated) {
      res.status(401).json({ error: 'Invalid session' });
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
}
