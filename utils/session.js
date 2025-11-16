import { seal, unseal, defaults } from 'iron-session';

// Configuration for iron-session
const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'session',
  ...defaults,
  ttl: 60 * 24 * 60, // 2 months in seconds
};

export async function encryptSession(sessionData) {
  try {
    return await seal(sessionData, sessionOptions);
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
    return await unseal(encryptedSession, sessionOptions);
  } catch (error) {
    console.error('Error decrypting session:', error);
    return null;
 }
}

export async function requireAuthentication(req, res) {
  const sessionCookie = req.cookies.session;
  
  if (!sessionCookie) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const session = await decryptSession(sessionCookie);
  
  if (!session || !session.authenticated) {
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }

  return session;
}
