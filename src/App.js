import React, { useState, useEffect, useRef } from 'react';
import MusicTable from './components/MusicTable';

function App() {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [loading, setLoading] = useState(false);
  const musicTableRef = useRef(null);

  useEffect(() => {
    fetchVersions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/versions');
      const data = await response.json();
      setVersions(data);
      
      // If there are versions, select the latest one
      if (data.length > 0) {
        // Sort versions to get the latest one
        const sortedVersions = data.sort((a, b) => {
          const aNum = parseInt(a.replace('ver', ''));
          const bNum = parseInt(b.replace('ver', ''));
          return bNum - aNum;
        });
        setSelectedVersion(sortedVersions[0]);
      } else {
        // If no versions exist, create one from base
        createNewVersion();
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewVersion = async (fromVersion = null) => {
    try {
      setLoading(true);
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fromVersion: fromVersion || selectedVersion || 'base' }),
      });
      const data = await response.json();
      if (data.version) {
        setVersions(prev => [...prev, data.version]);
        setSelectedVersion(data.version);
        
        // Clear changes after successful save
        if (musicTableRef.current && typeof musicTableRef.current.clearChanges === 'function') {
          musicTableRef.current.clearChanges();
        }
      }
    } catch (error) {
      console.error('Error creating new version:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Update track names with current markers before saving
      // This will be handled by the MusicTable component via the onSave callback
      
      // Refresh versions after saving
      const response = await fetch('/api/versions');
      const data = await response.json();
      setVersions(data);
      
      // Clear changes after successful save
      if (musicTableRef.current && typeof musicTableRef.current.clearChanges === 'function') {
        musicTableRef.current.clearChanges();
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionChange = (event) => {
    setSelectedVersion(event.target.value);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Theatre Sound Director</h1>
      </header>
      
      <div className="controls">
        <select value={selectedVersion} onChange={handleVersionChange}>
          <option value="">Select a version</option>
          {versions.map(version => (
            <option key={version} value={version}>{version}</option>
          ))}
        </select>
        
        <button onClick={() => createNewVersion()} disabled={loading}>
          {loading ? 'Creating...' : 'Create New Version'}
        </button>
        
        <button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        
        <button onClick={() => {
          if (musicTableRef.current && typeof musicTableRef.current.clearChanges === 'function') {
            musicTableRef.current.clearChanges();
          }
        }}>
          Clear Changes
        </button>
      </div>
      
      <main>
        {selectedVersion ? (
          <MusicTable 
            ref={musicTableRef}
            version={selectedVersion} 
            onSave={fetchVersions} 
          />
        ) : (
          <p>Please select or create a version to begin.</p>
        )}
      </main>
    </div>
  );
}

export default App;
