import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const MusicTable = forwardRef(({ version, onSave }, ref) => {
  

MusicTable.displayName = 'MusicTable';
  // Expose the clearChanges function to the parent component
  useImperativeHandle(ref, () => ({
    clearChanges: () => {
      setChanges({
        moved: [],
        copied: [],
        renamed: [],
        tagsCreated: []
      });
    }
 }));

  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
 const [draggedTrack, setDraggedTrack] = useState(null);
  const [newTagName, setNewTagName] = useState('');
  const [renameTrack, setRenameTrack] = useState(null);
  const [showCopyMoveDialog, setShowCopyMoveDialog] = useState(false);
  const [dialogData, setDialogData] = useState({ sourceScene: null, targetScene: null, track: null });
  const [changes, setChanges] = useState({ 
    moved: [],     // { fromScene, toScene, trackName, tagName } - appears as red in fromScene, green in toScene
    copied: [],    // { scene, trackName, tagName } - appears as green in scene
    renamed: [],   // { scene, oldName, newName, tagName } - appears as orange in scene
    tagsCreated: [] // { scene, tagName } - tag creation doesn't directly affect track display but could affect UI
  }); // Track changes since last save
  const [mode, setMode] = useState('display'); // 'display' or 'edit'
  const [selectedOptions, setSelectedOptions] = useState({}); // Track selected options for scenes with multiple tracks
  const [trimMode, setTrimMode] = useState(false); // Whether trim mode is active
  const [trimStart, setTrimStart] = useState({}); // Store trim start time for each track
  const [trimEnd, setTrimEnd] = useState({}); // Store trim end time for each track
  const [reorderedTracks, setReorderedTracks] = useState({}); // Store reordered track sequences for each scene
  
  // Function to identify scenes with multiple tracks for dropdown selection
  const getMultipleTrackScenes = () => {
    const multipleTrackScenes = {};
    scenes.forEach(scene => {
      // Check if the scene has both "select" and "selected" folders
      const hasSelectFolder = scene.tracks.some(track => track.relativePath && track.relativePath.includes("/select/"));
      const hasSelectedFolder = scene.tracks.some(track => track.relativePath && track.relativePath.includes("/selected/"));
      
      if (hasSelectFolder && hasSelectedFolder) {
        // Group tracks by their base name to identify options
        const trackGroups = {};
        scene.tracks.forEach(track => {
          // Extract the base name from the relative path
          const basePath = track.relativePath || track.name;
          const baseName = basePath.split('/').pop(); // Get the filename without path
          
          if (!trackGroups[baseName]) {
            trackGroups[baseName] = [];
          }
          trackGroups[baseName].push(track);
        });
        
        // Find groups that have multiple options
        for (const [baseName, tracks] of Object.entries(trackGroups)) {
          if (tracks.length > 1) {
            multipleTrackScenes[scene.name] = {
              mainTrack: tracks[0], // First track as default
              options: tracks // All tracks as options
            };
            break; // Just need to identify that this scene has multiple options
          }
        }
      }
    });
    return multipleTrackScenes;
  };
  const audioRefs = useRef({});
  const [playingTrack, setPlayingTrack] = useState(null);
   const [trackProgress, setTrackProgress] = useState({});
  const [trackDurations, setTrackDurations] = useState({});
  const [trackCurrentTimes, setTrackCurrentTimes] = useState({});
  const [trackStartTimes, setTrackStartTimes] = useState({});
   const [trackMarkers, setTrackMarkers] = useState({}); // Store start/end markers for each track
  const [expandedTracks, setExpandedTracks] = useState({}); // Track expanded state for each scene

  useEffect(() => {
    fetchScenes();
 }, [version]); // Fetch scenes when version changes, but preserve changes

 // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Handle 'n' key for next song
      if (e.key === 'n' || e.key === 'N') {
        playNextSong();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [scenes, playingTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchScenes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scenes?version=${version}`);
      const data = await response.json();
      setScenes(data);
      // Don't reset changes when loading scenes - only clear on save
    } catch (error) {
      console.error('Error fetching scenes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to play the next song
  const playNextSong = () => {
    if (scenes.length === 0) return;

    // Find the currently playing track's scene and track
    let currentSceneIndex = -1;
    let currentTrackIndex = -1;

    if (playingTrack) {
      // Extract scene and track name from playingTrack (format: `${scene.name}-${track.name}`)
      // Find the last occurrence of the separator to handle scene names with hyphens
      const lastSeparatorIndex = playingTrack.lastIndexOf('-');
      
      if (lastSeparatorIndex !== -1) {
        const sceneName = playingTrack.substring(0, lastSeparatorIndex);
        const trackName = playingTrack.substring(lastSeparatorIndex + 1);
        
        currentSceneIndex = scenes.findIndex(scene => scene.name === sceneName);
        
        if (currentSceneIndex !== -1) {
          // Find the track in the current scene
          const currentScene = scenes[currentSceneIndex];
          
          // For scenes with select/selected folders, we only consider the selected track
          const sceneOptions = getMultipleTrackScenes();
          const hasMultipleTracks = sceneOptions[sceneName];
          
          if (hasMultipleTracks) {
            // For multiple track scenes, find the selected track
            currentTrackIndex = currentScene.tracks.findIndex(track => 
              track.tagName === 'selected' && track.name === trackName
            );
          } else {
            currentTrackIndex = currentScene.tracks.findIndex(track => track.name === trackName);
          }
        }
      }
    }

    // Determine the next track to play
    let nextSceneIndex = currentSceneIndex;
    let nextTrackIndex = currentTrackIndex + 1;

    // If no current track was playing, start with the first track of the first scene
    if (currentSceneIndex === -1) {
      nextSceneIndex = 0;
      nextTrackIndex = 0;
    } else {
      // If we've reached the end of tracks in the current scene
      if (nextSceneIndex !== -1 && nextTrackIndex >= scenes[nextSceneIndex].tracks.length) {
        nextSceneIndex++;
        nextTrackIndex = 0;
      }

      // If we've reached the end of all scenes, loop back to the first scene
      if (nextSceneIndex >= scenes.length) {
        nextSceneIndex = 0;
        nextTrackIndex = 0;
      }
    }

    // Find the next track to play
    const nextScene = scenes[nextSceneIndex];
    if (!nextScene || nextScene.tracks.length === 0) return;

    // For scenes with multiple tracks (select/selected), only play the selected track
    const sceneOptions = getMultipleTrackScenes();
    const hasMultipleTracks = sceneOptions[nextScene.name];
    
    if (hasMultipleTracks) {
      // Find the selected track in the scene
      const selectedTrack = nextScene.tracks.find(track => track.tagName === 'selected');
      if (selectedTrack) {
        playSpecificTrack(selectedTrack.name, nextScene.name);
      }
    } else {
      // For regular scenes, play the track at the calculated index
      // If we've gone beyond the last track in the scene, go back to the first track
      let adjustedTrackIndex = nextTrackIndex;
      if (adjustedTrackIndex >= nextScene.tracks.length) {
        adjustedTrackIndex = 0;
      }
      
      if (adjustedTrackIndex < nextScene.tracks.length) {
        const nextTrack = nextScene.tracks[adjustedTrackIndex];
        playSpecificTrack(nextTrack.name, nextScene.name);
      }
    }
  };
  
  // Function to play a specific track, handling all the audio playback logic
  const playSpecificTrack = (trackName, sceneName) => {
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];

    if (!audioElement) return;

    // Check if audio element has any error before attempting to play
    if (audioElement.error) {
      console.error(`Audio element error for ${trackName}:`, audioElement.error);
      return;
    }

    // Pause any currently playing track
    if (playingTrack && playingTrack !== audioId) {
      const currentAudio = audioRefs.current[playingTrack];
      if (currentAudio) {
        currentAudio.pause();
      }
    }

    // Set start time based on markers if they exist
    const marker = trackMarkers[audioId];
    let startTime = trackStartTimes[audioId] || 0;
    
    if (marker && marker.start !== undefined) {
      startTime = marker.start;
    }
    
    // If this is the first time playing or we're replaying after end
    if (audioElement.paused) {
      if (audioElement.currentTime === 0 || audioElement.currentTime >= (audioElement.duration || 0)) {
        // Only set currentTime if duration is valid
        if (isFinite(audioElement.duration) && audioElement.duration > 0) {
          audioElement.currentTime = Math.max(startTime, 0);
        }
      } else {
        // If we're not at the beginning, but we're starting from a marker, go to the start marker
        if (startTime > 0 && audioElement.currentTime < startTime) {
          audioElement.currentTime = startTime;
        }
      }
      
      try {
        audioElement.play();
        setPlayingTrack(audioId);
      } catch (error) {
        console.error(`Error playing audio: ${trackName}`, error);
      }
    }
  };

  const handleDragStart = (e, track, scene) => {
    if (mode !== 'edit') return;
    setDraggedTrack({ track, sourceScene: scene });
    e.dataTransfer.setData('text/plain', 'track');
  };

  const handleDragOver = (e) => {
    if (mode !== 'edit') return;
    e.preventDefault();
  };

  const handleDrop = async (e, targetScene) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    if (!draggedTrack) return;

    // Show the copy/move dialog
    setDialogData({
      sourceScene: draggedTrack.sourceScene,
      targetScene: targetScene,
      track: draggedTrack.track
    });
    setShowCopyMoveDialog(true);
  };

  const handleDialogAction = async (action) => {
    const { sourceScene, targetScene, track } = dialogData;
    
    if (action === 'move') {
      try {
        const response = await fetch('/api/move-track', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceScene: sourceScene,
            targetScene: targetScene,
            trackName: track.name,
            version: version,
            tagName: track.tagName
          }),
        });

        if (response.ok) {
          // Track the move change
          setChanges(prev => ({
            ...prev,
            moved: [...prev.moved, {
              fromScene: sourceScene,
              toScene: targetScene,
              trackName: track.name,
              tagName: track.tagName,
              originalPath: `${sourceScene}/${track.tagName ? track.tagName + '/' : ''}${track.name}`
            }]
          }));
          fetchScenes(); // Refresh the data
        } else {
          console.error('Failed to move track');
        }
      } catch (error) {
        console.error('Error moving track:', error);
      }
    } else if (action === 'copy') {
      try {
        const response = await fetch('/api/copy-track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceScene: sourceScene,
            targetScene: targetScene,
            trackName: track.name,
            version: version,
            tagName: track.tagName
          }),
        });

        if (response.ok) {
          // Track the copy change
          setChanges(prev => ({
            ...prev,
            copied: [...prev.copied, {
              scene: targetScene,
              trackName: track.name,
              tagName: track.tagName,
              newPath: `${targetScene}/${track.tagName ? track.tagName + '/' : ''}${track.name}`
            }]
          }));
          fetchScenes(); // Refresh the data
        } else {
          console.error('Failed to copy track');
        }
      } catch (error) {
        console.error('Error copying track:', error);
      }
    }

    setShowCopyMoveDialog(false);
    setDialogData({ sourceScene: null, targetScene: null, track: null });
  };

  const copyTrack = async (sourceScene, track) => {
    if (mode !== 'edit') return;
    try {
      const response = await fetch('/api/copy-track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceScene: sourceScene,
          targetScene: sourceScene, // Copying to the same scene
          trackName: track.name,
          version: version,
          tagName: track.tagName
        }),
      });

      if (response.ok) {
        fetchScenes(); // Refresh the data
      } else {
        console.error('Failed to copy track');
      }
    } catch (error) {
      console.error('Error copying track:', error);
    }
  };

   const createTag = async (scene) => {
    if (mode !== 'edit') return;
    if (!newTagName.trim()) return;

    try {
      const response = await fetch('/api/create-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scene: scene,
          version: version,
          tagName: newTagName.trim()
        }),
      });

      if (response.ok) {
        // Track the tag creation change
        setChanges(prev => ({
          ...prev,
          tagsCreated: [...prev.tagsCreated, {
            scene: scene,
            tagName: newTagName.trim()
          }]
        }));
        setNewTagName('');
        fetchScenes(); // Refresh the data
      } else {
        console.error('Failed to create tag');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const renameTrackHandler = async (scene, oldName, newName, tagName) => {
    if (mode !== 'edit') return;
    try {
      // Check if the new name follows the marker pattern (e.g., trackname_from_10s_to_20s.mp3 or trackname_from_10s_to_end.mp3)
      const newMarkerMatch = newName.match(/^(.+)_from_(\d+)s_to_((\d+)s|end)(\.[^.]+)$/);
      
      let actualNewName = newName;
      if (newMarkerMatch) {
        // The new name already follows the marker pattern, use it as is
        actualNewName = newName;
      } else {
        // Check if the old name had markers and preserve them if the new name doesn't have them
        const oldMarkerMatch = oldName.match(/^(.+)_from_(\d+)s_to_(\d+)s(\.[^.]+)$/);
        if (oldMarkerMatch) {
          // Keep the same markers but update the base name
          const baseName = newName.replace(/\.[^.]+$/, ''); // Remove extension if present
          const startMarker = oldMarkerMatch[2];
          const endMarker = oldMarkerMatch[3];
          const ext = oldMarkerMatch[4];
          actualNewName = `${baseName}_from_${startMarker}s_to_${endMarker}s${ext}`;
        } else {
          // No markers to preserve, use the new name as is
          actualNewName = newName;
        }
      }
      
      const response = await fetch('/api/rename-track', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scene: scene,
          version: version,
          oldName: oldName,
          newName: actualNewName,
          tagName: tagName
        }),
      });

      if (response.ok) {
        // Track the rename change
        setChanges(prev => ({
          ...prev,
          renamed: [...prev.renamed, {
            scene: scene,
            oldName: oldName,
            newName: actualNewName,
            tagName: tagName
          }]
        }));
        setRenameTrack(null);
        fetchScenes(); // Refresh the data
      } else {
        console.error('Failed to rename track');
      }
    } catch (error) {
      console.error('Error renaming track:', error);
    }
  };

  // Initialize audio elements and handle track start times
  useEffect(() => {
    // Extract start times for all tracks
    const startTimes = {};
    const currentTimes = {};
    const markers = {};
    
    scenes.forEach(scene => {
      scene.tracks.forEach(track => {
        const audioId = `${scene.name}-${track.name}`;
        
        // Parse start/end markers from track name - support multiple patterns
        const markerMatch = track.name.match(/_from_(\d+)s_to_((\d+)s|end)/);
        if (markerMatch) {
          const startMarker = parseInt(markerMatch[1]);
          let endMarker = null;
          
          // Check if the end is specified as a number or 'end'
          if (markerMatch[2] && markerMatch[2] !== 'end') {
            endMarker = parseInt(markerMatch[2].replace('s', '')); // Remove 's' suffix if present
          }
          
          markers[audioId] = { start: startMarker, end: endMarker };
          startTimes[audioId] = startMarker;
          currentTimes[audioId] = startMarker; // Initialize current time with start time
        } else {
          // Check for the existing _play_from_X_sec pattern
          const timeMatch = track.name.match(/_play_from_(\d+)_sec\./);
          if (timeMatch) {
            const seconds = parseInt(timeMatch[1]);
            startTimes[audioId] = seconds;
            currentTimes[audioId] = seconds; // Initialize current time with start time
          } else {
            startTimes[audioId] = 0;
            currentTimes[audioId] = 0;
          }
          // Default markers (0 to end of track)
          markers[audioId] = { start: 0, end: null }; // null means end of track
        }
      });
    });
    
    setTrackStartTimes(startTimes);
    setTrackCurrentTimes(currentTimes);
    setTrackMarkers(markers);
  }, [scenes]);

// Handle audio playback
  const handlePlayTrack = async (trackName, sceneName) => {
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];

    if (!audioElement) return;

    // Check if audio element has any error before attempting to play
    if (audioElement.error) {
      console.error(`Audio element error for ${trackName}:`, audioElement.error);
      return;
    }

    // Pause any currently playing track
    if (playingTrack && playingTrack !== audioId) {
      const currentAudio = audioRefs.current[playingTrack];
      if (currentAudio) {
        currentAudio.pause();
      }
    }

    // Set start time based on markers if they exist
    const marker = trackMarkers[audioId];
    let startTime = trackStartTimes[audioId] || 0;
    
    if (marker && marker.start !== undefined) {
      startTime = marker.start;
    }
    
    if (audioElement.paused) {
      // If this is the first time playing or we're replaying after end
      if (audioElement.currentTime === 0 || audioElement.currentTime >= (audioElement.duration || 0)) {
        // Only set currentTime if duration is valid
        if (isFinite(audioElement.duration) && audioElement.duration > 0) {
          audioElement.currentTime = Math.max(startTime, 0);
        }
      } else {
        // If we're not at the beginning, but we're starting from a marker, go to the start marker
        if (startTime > 0 && audioElement.currentTime < startTime) {
          audioElement.currentTime = startTime;
        }
      }
      
      try {
        await audioElement.play();
        setPlayingTrack(audioId);
      } catch (error) {
        console.error(`Error playing audio: ${trackName}`, error);
      }
    } else {
      audioElement.pause();
      setPlayingTrack(null);
      // Update current time when pausing
      setTrackCurrentTimes(prev => ({
        ...prev,
        [audioId]: audioElement.currentTime
      }));
    }
 };

  // Handle seeking in the audio track
  const handleSeek = (e, trackName, sceneName) => {
    if (mode !== 'edit') return;
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];
    if (!audioElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    // Check if duration is valid before seeking
    if (isNaN(audioElement.duration) || !isFinite(audioElement.duration)) {
      console.warn(`Cannot seek in audio track ${trackName} - duration is not valid`);
      return;
    }
    
    const newTime = pos * audioElement.duration;
    
    // If Alt key is pressed, set the start marker
    if (e.altKey) {
      setTrackMarkers(prev => ({
        ...prev,
        [audioId]: { ...prev[audioId], start: Math.floor(newTime) }
      }));
      return;
    }
    
    // If Ctrl key is pressed (Cmd on Mac), set the end marker
    if (e.ctrlKey || e.metaKey) {
      setTrackMarkers(prev => ({
        ...prev,
        [audioId]: { ...prev[audioId], end: Math.floor(newTime) }
      }));
      return;
    }
    
    // Check if we should update the track name based on the new markers
    const marker = trackMarkers[audioId];
    if (marker) {
      // If the user clicked near an existing marker, adjust that marker instead of seeking
      const duration = audioElement.duration;
      if (duration && isFinite(duration)) {
        const startMarkerPos = (marker.start / duration) * 100;
        const endMarkerPos = marker.end !== null ? (marker.end / duration) * 100 : 100;
        const clickPos = pos * 100;
        
        // If click is close to start marker (within 5% of timeline), adjust start marker
        if (Math.abs(clickPos - startMarkerPos) < 5) {
          setTrackMarkers(prev => ({
            ...prev,
            [audioId]: { ...prev[audioId], start: Math.floor(newTime) }
          }));
          return;
        }
        
        // If click is close to end marker (within 5% of timeline), adjust end marker
        if (Math.abs(clickPos - endMarkerPos) < 5 && marker.end !== null) {
          setTrackMarkers(prev => ({
            ...prev,
            [audioId]: { ...prev[audioId], end: Math.floor(newTime) }
          }));
          return;
        }
      }
    }
    
    // Ensure we don't seek before the start time
    const startTime = trackStartTimes[audioId] || 0;
    audioElement.currentTime = Math.max(newTime, startTime);
  };

  // Update progress as track plays
  const updateProgress = (trackName, sceneName) => {
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];
    if (!audioElement) return;

    // Only update progress if duration is valid
    if (isNaN(audioElement.duration) || !isFinite(audioElement.duration) || audioElement.duration <= 0) {
      return;
    }

    // Check if current time has reached the end marker
    const marker = trackMarkers[audioId];
    if (marker && marker.end !== null && audioElement.currentTime >= marker.end) {
      // If we've reached the end marker, pause the track
      audioElement.pause();
      if (playingTrack === audioId) {
        setPlayingTrack(null);
      }
    } else if (marker && audioElement.currentTime < marker.start) {
      // If we've somehow gone before the start marker, reset to start marker
      audioElement.currentTime = marker.start;
    }

    const progress = (audioElement.currentTime / audioElement.duration) * 100;
    setTrackProgress(prev => ({
      ...prev,
      [audioId]: progress
    }));
    
    // Update current time as well
    setTrackCurrentTimes(prev => ({
      ...prev,
      [audioId]: audioElement.currentTime
    }));
 };

  // Handle when track ends
  const handleTrackEnd = (trackName, sceneName) => {
    const audioId = `${sceneName}-${trackName}`;
    if (playingTrack === audioId) {
      setPlayingTrack(null);
    }
    setTrackProgress(prev => ({
      ...prev,
      [audioId]: 0
    }));
    setTrackCurrentTimes(prev => ({
      ...prev,
      [audioId]: 0
    }));
  };
  
  // Function to set the start marker to the current position
  const setStartMarker = (trackName, sceneName) => {
    if (mode !== 'edit') return;
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];
    
    if (!audioElement) return;
    
    setTrackMarkers(prev => ({
      ...prev,
      [audioId]: { ...prev[audioId], start: Math.floor(audioElement.currentTime) }
    }));
  };
  
  // Function to set the end marker to the current position
  const setEndMarker = (trackName, sceneName) => {
    if (mode !== 'edit') return;
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];
    
    if (!audioElement) return;
    
    setTrackMarkers(prev => ({
      ...prev,
      [audioId]: { ...prev[audioId], end: Math.floor(audioElement.currentTime) }
    }));
  };
  
  // Function to save markers to the track filename
  const saveMarkersToTrack = async (trackName, sceneName) => {
    if (mode !== 'edit') return;
    const audioId = `${sceneName}-${trackName}`;
    const marker = trackMarkers[audioId];
    
    if (!marker) return;
    
    // Extract the base name and extension from the current track name
    const nameMatch = trackName.match(/^(.+?)(?:_from_\d+s_to_\d+s)?(\.[^.]+)$/);
    if (!nameMatch) return; // If no extension found, return
    
    const baseName = nameMatch[1].replace(/_from_\d+s_to_\d+$/, ''); // Remove any existing marker info
    const extension = nameMatch[2];
    
    // Create new name with markers
    const newTrackName = `${baseName}_from_${marker.start}s_to_${marker.end || 'end'}s${extension}`;
    
    // Only make the API call if the name actually changed
    if (newTrackName !== trackName) {
      // Find the track object to get the tagName
      const trackObj = scenes.find(s => s.name === sceneName)
        ?.tracks.find(t => t.name === trackName);
      
      const tagName = trackObj ? trackObj.tagName : null;
      
      try {
        const response = await fetch('/api/rename-track', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scene: sceneName,
            version: version,
            oldName: trackName,
            newName: newTrackName,
            tagName: tagName
          }),
        });
        
        if (response.ok) {
          // Track the rename change
          setChanges(prev => ({
            ...prev,
            renamed: [...prev.renamed, {
              scene: sceneName,
              oldName: trackName,
              newName: newTrackName,
              tagName: tagName
            }]
          }));
          
          // Refresh the scenes to update the track name
          fetchScenes();
        }
      } catch (error) {
        console.error('Error saving markers to track:', error);
      }
    }
 };
  
  // Function to update track name based on current markers
 const updateTrackNameWithMarkers = (trackName, sceneName) => {
    const audioId = `${sceneName}-${trackName}`;
    const marker = trackMarkers[audioId];
    
    if (!marker) return trackName;
    
    // Extract the base name and extension from the current track name
    const nameMatch = trackName.match(/^(.+?)(?:_from_\d+s_to_\d+s)?(\.[^.]+)$/);
    if (!nameMatch) return trackName; // If no extension found, return as is
    
    const baseName = nameMatch[1].replace(/_from_\d+s_to_\d+$/, ''); // Remove any existing marker info
    const extension = nameMatch[2];
    
    // If markers are at defaults (0 to end), don't add them to the name
    if (marker.start === 0 && marker.end === null) {
      return trackName; // Keep original name if at defaults
    }
    
    // Create new name with markers
    const newTrackName = `${baseName}_from_${marker.start}s_to_${marker.end || 'end'}s${extension}`;
    return newTrackName;
  };

  // Format time in MM:SS format
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

   // Function to generate waveform data for a track
 const generateWaveformData = (audioId) => {
    // This is a simplified implementation - in a real app, you'd want to use a proper waveform generation library
    // For now, we'll simulate waveform data with random values
    const duration = trackDurations[audioId] || 10; // Default to 10 seconds if duration is unknown
    const sampleCount = 200; // Number of points in the waveform
    const data = [];
    
    for (let i = 0; i < sampleCount; i++) {
      // Generate a random amplitude between 0 and 1, simulating waveform data
      data.push(Math.random());
    }
    
    return data;
  };

  // State to store track metadata from music_tracks.csv
  const [trackMetadata, setTrackMetadata] = useState({});

  // Function to load track metadata from music_tracks.csv
  const loadTrackMetadata = async () => {
    try {
      // First try loading the file directly from the public directory
      const response = await fetch('/music_tracks.csv');
      if (response.ok) {
        const csvDataText = await response.text();
        const lines = csvDataText.split('\n');
        
        if (lines[0].includes('Scene') && lines[0].includes('Music') && lines[0].includes('Description')) {
          const trackData = {};
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // Parse the line by comma, but be careful with quoted content
            let row = [];
            let currentField = '';
            let inQuotes = false;
            let char;
            
            for (let j = 0; j < lines[i].length; j++) {
              char = lines[i][j];
              
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                row.push(currentField);
                currentField = '';
              } else {
                currentField += char;
              }
            }
            row.push(currentField); // Add the last field
            
            // Clean up the fields by removing leading/trailing quotes
            row = row.map(field => field.trim().replace(/^"|"$/g, ''));
            
            if (row.length >= 3) {
              const scene = row[0];
              const musicPath = row[1];
              const description = row[2];
              
              // Extract track name from the music path
              const trackName = musicPath.split('/').pop();
              
              // Create a key combining scene and track name to uniquely identify the track
              const trackKey = `${scene}-${trackName}`;
              
              trackData[trackKey] = description;
            }
          }
          
          console.log('Track metadata loaded successfully from public directory:', trackData);
          return trackData;
        }
      }
    } catch (error) {
      console.error('Error loading track metadata:', error);
      return {};
    }
  };

  // Load track metadata when component mounts
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await loadTrackMetadata();
        setTrackMetadata(data);
        console.log('Track metadata set in state:', data);
      } catch (error) {
        console.error('Error in loadMetadata:', error);
      }
    };
    loadMetadata();
  }, []);

  // Function to get track description from metadata
  const getTrackDescription = (sceneName, trackName) => {
    // Create a key combining scene and track name to look up the metadata
    const trackKey = `${sceneName}-${trackName}`;
    
    // Check if we have data for this specific track
    if (trackMetadata && trackMetadata[trackKey]) {
      return trackMetadata[trackKey];
    }
    
    // Try to find the track by just the track name (in case scene naming is different)
    if (trackMetadata) {
      for (const [key, description] of Object.entries(trackMetadata)) {
        if (key.endsWith(`-${trackName}`)) {
          return description;
        }
      }
    }
    
    return '';
  };

  // State to manage track descriptions editing and visibility
 const [trackDescriptions, setTrackDescriptions] = useState({});
  const [expandedTrackDescriptions, setExpandedTrackDescriptions] = useState({});

  // Function to update track description
  const updateTrackDescription = (sceneName, trackName, newDescription) => {
    const trackKey = `${sceneName}-${trackName}`;
    setTrackDescriptions(prev => ({
      ...prev,
      [trackKey]: newDescription
    }));
  };

  // Update duration when loaded
 const handleLoadedMetadata = (trackName, sceneName) => {
    const audioId = `${sceneName}-${trackName}`;
    const audioElement = audioRefs.current[audioId];
    if (!audioElement) return;

    setTrackDurations(prev => ({
      ...prev,
      [audioId]: audioElement.duration
    }));
 };

  if (loading) {
    return <div>Loading scenes...</div>;
  }

  // Function to determine the change status of a track
  const getTrackChangeStatus = (sceneName, track) => {
    // Check if this track was moved FROM another scene TO this scene (green - added)
    const wasMovedToScene = changes.moved.some(move => 
      move.toScene === sceneName && 
      move.trackName === track.name && 
      move.tagName === track.tagName
    );
    
    // Check if this track was moved FROM this scene TO another scene (red - removed)
    const wasMovedFromScene = changes.moved.some(move => 
      move.fromScene === sceneName && 
      move.trackName === track.name && 
      move.tagName === track.tagName
    );
    
    // Check if this track was renamed (orange - changed)
    const wasRenamed = changes.renamed.some(rename => 
      rename.scene === sceneName && 
      (rename.oldName === track.name || rename.newName === track.name)
    );
    
    // Check if this track was copied to this scene (green - added)
    const wasCopiedToScene = changes.copied.some(copy => 
      copy.scene === sceneName && 
      copy.trackName === track.name && 
      copy.tagName === track.tagName
    );
    
    // Determine the status
    if (wasMovedFromScene && !wasMovedToScene) {
      // Track was moved from this scene to another scene (but not back to this scene)
      return 'removed';
    } else if (wasMovedToScene || wasCopiedToScene) {
      // Track was moved to this scene or copied to this scene
      return 'added';
    } else if (wasRenamed) {
      // Track was renamed in this scene
      return 'changed';
    }
    
    // No change for this track
    return 'none';
 };

// Function to save changes in current version
  const handleSave = async () => {
    if (mode !== 'edit') return;
    // Update track names with current markers before saving
    for (const scene of scenes) {
      for (const track of scene.tracks) {
        const audioId = `${scene.name}-${track.name}`;
        const marker = trackMarkers[audioId];
        
        if (marker) {
          // Extract the base name and extension from the current track name
          const nameMatch = track.name.match(/^(.+?)(?:_from_\d+s_to_\d+s)?(\.[^.]+)$/);
          if (nameMatch) {
            const baseName = nameMatch[1].replace(/_from_\d+s_to_\d+$/, ''); // Remove any existing marker info
            const extension = nameMatch[2];
            
            // Only update the name if markers are not at defaults (0 to end)
            if (!(marker.start === 0 && marker.end === null)) {
              const newTrackName = `${baseName}_from_${marker.start}s_to_${marker.end || 'end'}s${extension}`;
              
              // Only make the API call if the name actually changed
              if (newTrackName !== track.name) {
                try {
                  const response = await fetch('/api/rename-track', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      scene: scene.name,
                      version: version,
                      oldName: track.name,
                      newName: newTrackName,
                      tagName: track.tagName
                    }),
                  });
                  
                  if (response.ok) {
                    // Track the rename change
                    setChanges(prev => ({
                      ...prev,
                      renamed: [...prev.renamed, {
                        scene: scene.name,
                        oldName: track.name,
                        newName: newTrackName,
                        tagName: track.tagName
                      }]
                    }));
                  }
                } catch (error) {
                  console.error('Error updating track name with markers:', error);
                }
              }
            }
          }
        }
      }
    }
    
    await onSave();
    setChanges({
      moved: [],
      copied: [],
      renamed: [],
      tagsCreated: []
    });
  };
  
  // Function to create a new version with current changes
  const handleCreateNewVersion = async () => {
    if (mode !== 'edit') return;
    try {
      // First save any pending changes to current version
      await handleSave();
      
      // Create a new version by copying the current one
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromVersion: version
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        const newVersion = result.version;
        
        // Update the version in the parent component
        // Since we can't directly change the version prop, we'll need to notify the parent
        // The parent component will need to handle updating the version
        console.log("New version created:", newVersion);
        
        // For now, just trigger the onSave callback to let parent know to refresh
        await onSave();
      } else {
        console.error('Failed to create new version');
      }
    } catch (error) {
      console.error('Error creating new version:', error);
    }
  };
  
  // Function to clear all changes without saving
  const handleClearChanges = () => {
    if (mode !== 'edit') return;
    setChanges({
      moved: [],
      copied: [],
      renamed: [],
      tagsCreated: []
    });
  };

  // Function to reorder tracks between 'select' and 'selected' folders
 const reorderTracks = async (sceneName, tagType, trackName) => {
    if (mode !== 'edit') return;
    
    if (tagType === 'select') {
      try {
        // Find the specific track in the 'select' folder that was clicked
        const scene = scenes.find(s => s.name === sceneName);
        if (!scene) return;
        
        // Find the specific track that was clicked
        const trackToMove = scene.tracks.find(t => 
          t.tagName === 'select' && t.name === trackName
        );
        
        if (!trackToMove) return;
        
        const response = await fetch('/api/select-track', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scene: sceneName,
            version: version,
            trackName: trackName
          }),
        });

        if (response.ok) {
          // Refresh the scenes to update the track order
          fetchScenes();
        } else {
          console.error('Failed to reorder tracks');
        }
      } catch (error) {
        console.error('Error reordering tracks:', error);
      }
    }
 };

  return (
    <div className="music-table">
      <div className="mode-toggle">
        <button 
          className={`mode-btn ${mode === 'display' ? 'active' : ''}`}
          onClick={() => setMode('display')}
        >
          Display Mode
        </button>
        <button 
          className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => setMode('edit')}
        >
          Edit Mode
        </button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Scene</th>
            <th>Music Tracks</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene) => {
            return (
              <tr 
                key={scene.name} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, scene.name)}
              >
                <td className="scene-name">{scene.name}</td>
                <td className="tracks-container">
                  <div className="tracks-list">
                    {(() => {
                      // Check if this is a scene with multiple tracks that need special ordering
                      const isMultipleTrackScene = (scene.name.includes("Scene 9") && 
                                                    (scene.name.includes("Bar beginning") || 
                                                     scene.name.includes("Bar continuation")));
                      
                      // For scenes with multiple tracks, sort them so "selected" tracks appear first
                      let sortedTracks = [...scene.tracks];
                      if (isMultipleTrackScene) {
                        sortedTracks.sort((a, b) => {
                          // If 'a' is a 'selected' tag, it should come first (return -1)
                          if (a.tagName === 'selected') return -1;
                          // If 'b' is a 'selected' tag and 'a' is not, 'b' should come first (return 1)
                          if (b.tagName === 'selected') return 1;
                          // Otherwise, maintain original order
                          return 0;
                        });
                      }
                      
                      // Group tracks by tag for better organization
                      const groupedTracks = {};
                      sortedTracks.forEach(track => {
                        const tag = track.tagName || 'default';
                        if (!groupedTracks[tag]) {
                          groupedTracks[tag] = [];
                        }
                        groupedTracks[tag].push(track);
                      });
                      
                      // Create an array to hold all elements to render
                      const elementsToRender = [];
                      
                      // Process each tag group
                      Object.entries(groupedTracks).forEach(([tagName, tracks]) => {
                        // Add the tag header
                        elementsToRender.push(
                          <div key={`tag-${scene.name}-${tagName}`} className="tag-header">
                            <span className={`tag-label ${tagName}`}>{tagName}</span>
                            {tagName === 'select' && tracks.length > 1 && (
                              <button 
                                className="expand-btn"
                                onClick={() => setExpandedTracks(prev => ({
                                  ...prev,
                                  [`${scene.name}-${tagName}`]: !prev[`${scene.name}-${tagName}`]
                                }))}
                              >
                                {(expandedTracks[`${scene.name}-${tagName}`] || false) ? '▼' : '▶️'} Other options
                              </button>
                            )}
                          </div>
                        );
                        
                        // Determine if this group should be expanded
                        const isExpanded = expandedTracks[`${scene.name}-${tagName}`] || false;
                        
                        // Add tracks based on expanded state
                        tracks.forEach((track, trackIndex) => {
                          // For select tags with multiple tracks, only show the first track when collapsed
                          // For other tags, always show all tracks
                          if (tagName === 'select' && tracks.length > 1 && !isExpanded && trackIndex > 0) {
                            return; // Skip rendering this track when collapsed
                          }
                          
                          const audioId = `${scene.name}-${track.name}`;
                          const waveformData = generateWaveformData(audioId);
                          
                          elementsToRender.push(
                            <div 
                              key={`track-${scene.name}-${track.name}-${trackIndex}`}
                              className={`track-item ${trackIndex > 0 ? 'expanded-track' : ''} ${
                                getTrackChangeStatus(scene.name, track) === 'removed' ? 'track-removed' : 
                                getTrackChangeStatus(scene.name, track) === 'added' ? 'track-added' :
                                getTrackChangeStatus(scene.name, track) === 'changed' ? 'track-changed' : ''
                              }`}
                              draggable={mode === 'edit'}
                              onDragStart={(e) => handleDragStart(e, track, scene.name)}
                            >
                              <span className="track-name">
                                    {renameTrack && renameTrack.scene === scene.name && renameTrack.trackName === track.name ? (
                                  <input
                                    type="text"
                                    value={renameTrack.newName}
                                    onChange={(e) => setRenameTrack({
                                      ...renameTrack,
                                      newName: e.target.value
                                    })}
                                    onBlur={() => renameTrackHandler(
                                      scene.name, 
                                      track.name, 
                                      renameTrack.newName, 
                                      track.tagName
                                    )}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        renameTrackHandler(
                                          scene.name, 
                                          track.name, 
                                          renameTrack.newName, 
                                          track.tagName
                                        );
                                      }
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    {track.name}
                                    {mode === 'edit' && (
                                      <button 
                                        className="rename-btn"
                                        onClick={() => setRenameTrack({
                                          scene: scene.name,
                                          trackName: track.name,
                                          newName: track.name,
                                          tagName: track.tagName  // Include tagName when setting renameTrack
                                        })}
                                      >
                                        Rename
                                      </button>
                                    )}
                                  </>
                                )}
                              </span>
                              
                              {/* Track metadata display */}
                              <div className="track-metadata">
                                <span 
                                  className="metadata-preview"
                                  onClick={() => {
                                    const trackKey = `${scene.name}-${track.name}`;
                                    setExpandedTrackDescriptions(prev => ({
                                      ...prev,
                                      [trackKey]: !prev[trackKey]
                                    }));
                                  }}
                                >
                                  {getTrackDescription(scene.name, track.name).substring(0, 60) + (getTrackDescription(scene.name, track.name).length > 60 ? '...' : '')}
                                  <span className="show-hide-icon">
                                    {expandedTrackDescriptions[`${scene.name}-${track.name}`] ? '▲' : '▼'}
                                  </span>
                                </span>
                                
                                {expandedTrackDescriptions[`${scene.name}-${track.name}`] && (
                                  <div className="metadata-full">
                                    {mode === 'edit' ? (
                                      <textarea
                                        className="metadata-editor"
                                        value={trackDescriptions[`${scene.name}-${track.name}`] || getTrackDescription(scene.name, track.name)}
                                        onChange={(e) => updateTrackDescription(scene.name, track.name, e.target.value)}
                                        rows="4"
                                      />
                                    ) : (
                                      <div className="metadata-content">
                                        {trackDescriptions[`${scene.name}-${track.name}`] || getTrackDescription(scene.name, track.name)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Waveform visualization for trim mode */}
                              {mode === 'edit' && (
                                <div className="waveform-container">
                                  <div className="waveform">
                                    {waveformData.map((amplitude, index) => (
                                      <div
                                        key={index}
                                        className="waveform-bar"
                                        style={{
                                          height: `${amplitude * 100}%`,
                                          left: `${(index / waveformData.length) * 10}%`
                                        }}
                                      ></div>
                                    ))}
                                  </div>
                                  <div className="trim-controls">
                                    <div className="trim-start">
                                      <label>Start: </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={trackMarkers[audioId]?.start || 0}
                                        onChange={(e) => {
                                          const newStart = parseFloat(e.target.value) || 0;
                                          setTrackMarkers(prev => ({
                                            ...prev,
                                            [audioId]: { 
                                              ...prev[audioId], 
                                              start: newStart 
                                            }
                                          }));
                                        }}
                                        step="0.1"
                                      />
                                    </div>
                                    <div className="trim-end">
                                      <label>End: </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={trackMarkers[audioId]?.end ?? (trackDurations[audioId] || 10)}
                                        onChange={(e) => {
                                          const newEnd = parseFloat(e.target.value);
                                          setTrackMarkers(prev => ({
                                            ...prev,
                                            [audioId]: { 
                                              ...prev[audioId], 
                                              end: newEnd 
                                            }
                                          }));
                                        }}
                                        step="0.1"
                                      />
                                    </div>
                                    <button 
                                      className="save-trim-btn"
                                      onClick={() => saveMarkersToTrack(track.name, scene.name)}
                                    >
                                      Save Trim
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              <div className="track-actions">
                                {/* Audio player with timeline */}
                                <div className="audio-player">
                                  <button 
                                    className="play-btn"
                                    onClick={() => handlePlayTrack(track.name, scene.name)}
                                  >
                                    {playingTrack === `${scene.name}-${track.name}` ? '⏸️' : '▶️'}
                                  </button>
                                  
                                  {mode === 'edit' && (
                                    <div className="timeline-container">
                                      <div 
                                        className="timeline"
                                        onClick={(e) => handleSeek(e, track.name, scene.name)}
                                      >
                                        <div 
                                          className="progress"
                                          style={{ width: `${trackProgress[`${scene.name}-${track.name}`] || 0}%` }}
                                        ></div>
                                        
                                        {/* Start marker indicator */}
                                        {trackMarkers[`${scene.name}-${track.name}`] && trackMarkers[`${scene.name}-${track.name}`].start !== 0 && trackDurations[`${scene.name}-${track.name}`] && isFinite(trackDurations[`${scene.name}-${track.name}`]) && (
                                          <div 
                                            className="marker start-marker"
                                            style={{ 
                                              left: `${(trackMarkers[`${scene.name}-${track.name}`].start / trackDurations[`${scene.name}-${track.name}`]) * 100}%` 
                                            }}
                                            title={`Start: ${formatTime(trackMarkers[`${scene.name}-${track.name}`].start)}`}
                                          >
                                            |
                                          </div>
                                        )}
                                        
                                        {/* End marker indicator */}
                                        {trackMarkers[`${scene.name}-${track.name}`] && trackMarkers[`${scene.name}-${track.name}`].end !== null && trackDurations[`${scene.name}-${track.name}`] && isFinite(trackDurations[`${scene.name}-${track.name}`]) && (
                                          <div 
                                            className="marker end-marker"
                                            style={{ 
                                              left: `${(trackMarkers[`${scene.name}-${track.name}`].end / trackDurations[`${scene.name}-${track.name}`]) * 100}%` 
                                            }}
                                            title={`End: ${formatTime(trackMarkers[`${scene.name}-${track.name}`].end)}`}
                                          >
                                            |
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="time-info">
                                        {isNaN(trackDurations[`${scene.name}-${track.name}`]) ? (
                                          <span className="error-indicator">❌ Error loading audio</span>
                                        ) : (
                                          <>
                                            {formatTime(trackCurrentTimes[`${scene.name}-${track.name}`] || 0)} / {formatTime(trackDurations[`${scene.name}-${track.name}`] || 0)}
                                          </>
                                        )}
                                      </div>
                                    
                                      <div className="marker-controls">
                                        <button 
                                          className="marker-btn start-btn"
                                          onClick={() => setStartMarker(track.name, scene.name)}
                                          title="Set start marker to current position"
                                        >
                                          |◀
                                        </button>
                                        <button 
                                          className="marker-btn end-btn"
                                          onClick={() => setEndMarker(track.name, scene.name)}
                                          title="Set end marker to current position"
                                        >
                                          ▶|
                                        </button>
                                        <button 
                                          className="marker-btn save-btn"
                                          onClick={() => saveMarkersToTrack(track.name, scene.name)}
                                          title="Save markers to filename"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Hidden audio element */}
                                  <audio
                                    ref={el => audioRefs.current[`${scene.name}-${track.name}`] = el}
                                    src={`/api/music/${version}/${encodeURIComponent(scene.name)}/${encodeURIComponent(track.relativePath || track.name)}`}
                                    preload="metadata"
                                    onTimeUpdate={() => updateProgress(track.name, scene.name)}
                                    onEnded={() => handleTrackEnd(track.name, scene.name)}
                                    onLoadedMetadata={() => handleLoadedMetadata(track.name, scene.name)}
                                    onError={(e) => {
                                      const audioSrc = e.target.src;
                                      console.error(`Error loading audio: ${track.name}`, `URL: ${audioSrc}`, e.target.error);
                                      // Set an error state for this specific track to show in UI
                                      setTrackDurations(prev => ({
                                        ...prev,
                                        [`${scene.name}-${track.name}`]: NaN
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        });
                      });
                      
                      return elementsToRender;
                    })()}
                  </div>
                  
                  {mode === 'edit' && (
                    <div className="tag-creation">
                      <input
                        type="text"
                        placeholder="Create new tag..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            createTag(scene.name);
                          }
                        }}
                      />
                      <button onClick={() => createTag(scene.name)}>Create Tag</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Copy/Move Dialog */}
      {showCopyMoveDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Copy or Move Track?</h3>
            <p>What would you like to do with <strong>{dialogData.track?.name}</strong>?</p>
            <div className="dialog-buttons">
              <button className="dialog-btn move-btn" onClick={() => handleDialogAction('move')}>
                Move
              </button>
              <button className="dialog-btn copy-btn" onClick={() => handleDialogAction('copy')}>
                Copy
              </button>
              <button className="dialog-btn cancel-btn" onClick={() => setShowCopyMoveDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default MusicTable;
