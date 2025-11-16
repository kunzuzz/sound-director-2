import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import App from '../src/App';

export default function Home() {
  const [authorized, setAuthorized] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to access a protected API to check if user is authenticated
        const response = await fetch('/api/versions');
        
        if (response.status === 200) {
          // User is authenticated
          setAuthorized(true);
        } else {
          // User is not authenticated, redirect to login
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
