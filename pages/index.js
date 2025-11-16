import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { decryptSession } from '../utils/session';
import App from '../src/App';

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export default function Home() {
  const [authorized, setAuthorized] = useState(null);
  const router = useRouter();

   useEffect(() => {
    const checkAuth = async () => {
      const sessionCookie = getCookie('session');
      
      if (!sessionCookie) {
        router.push('/login');
        return;
      }

      try {
        const session = await decryptSession(sessionCookie);
        if (session && session.authenticated) {
          setAuthorized(true);
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  if (authorized === null) {
    return <div>Loading...</div>;
  }

  if (authorized === false) {
    return null; // Redirect happens in useEffect
  }

  return <App />;
}
