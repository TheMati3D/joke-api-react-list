import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { loadJokesFromStorage, saveJokesToStorage, clearJokesFromStorage } from '../utils/localStorage';
import './JokeList.css';

// Available joke categories
const CATEGORIES = [
  'Programming', 
  'Miscellaneous', 
  'Dark', 
  'Pun', 
  'Spooky', 
  'Christmas'
];

// Constants
const STORAGE_PREFIX = 'jokes';
const JOKES_PER_FETCH = 50;

// Function to limit attributes for localStorage (reduced number of fields)
const limitAttributes = (joke) => {
  const summaryText = joke.type === 'twopart' ? joke.setup : joke.joke;
  return {
    id: joke.id,
    summary: summaryText ? `${summaryText.substring(0, 50)}...` : '',
    category: joke.category,
    type: joke.type
  };
};

export const JokeList = () => {
  const [jokes, setJokes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Generate storage key based on category
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${category}`, [category]);
  const timestampKey = useMemo(() => `${storageKey}:timestamp`, [storageKey]);

  // Function to format date
  const formatDate = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  // Function to fetch jokes
  const fetchJokes = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      // Check if data is in localStorage
      const cachedJokes = loadJokesFromStorage(storageKey);
      const cachedTimestamp = localStorage.getItem(timestampKey);
      
      if (cachedJokes?.length > 0) {
        console.log('Data loaded from localStorage (limited attributes)');
        setJokes(cachedJokes);
        setFromCache(true);
        setLastUpdated(formatDate(cachedTimestamp || Date.now()));
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setFromCache(false);
    
    try {
      const apiUrl = `https://v2.jokeapi.dev/joke/${category}?type=single,twopart&amount=${JOKES_PER_FETCH}`;
      console.log('Fetching jokes from API:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Unknown API error');
      }
      
      // Normalize data - ensure it's always an array
      let jokesArray = [];
      if (data.jokes && Array.isArray(data.jokes)) {
        jokesArray = data.jokes;
      } else if (data.joke || data.setup) {
        jokesArray = [data];
      }
      
      if (jokesArray.length === 0) {
        throw new Error('No jokes found in the selected category');
      }
      
      // Full data for display
      const processedJokes = jokesArray.map(joke => ({
        id: joke.id,
        joke: joke.joke || null,
        setup: joke.setup || null,
        delivery: joke.delivery || null,
        category: joke.category,
        type: joke.type,
        flags: joke.flags
      }));
      
      // Save full data to app state
      setJokes(processedJokes);
      
      const now = Date.now();
      setLastUpdated(formatDate(now));
      
      // Save limited data to localStorage
      const limitedJokes = processedJokes.map(limitAttributes);
      saveJokesToStorage(storageKey, limitedJokes);
      localStorage.setItem(timestampKey, now.toString());
      
      console.log('Saved limited data to localStorage');
    } catch (error) {
      console.error('Error fetching jokes:', error);
      setError(error.message);
      setJokes([]);
    } finally {
      setLoading(false);
    }
  }, [category, storageKey, timestampKey, formatDate]);

  // Category change handler
  const handleCategoryChange = (event) => {
    setCategory(event.target.value);
  };

  // Force refresh from API
  const handleRefresh = () => {
    fetchJokes(true);
  };

  // Clear cache for current category
  const handleClearCache = () => {
    clearJokesFromStorage(storageKey);
    localStorage.removeItem(timestampKey);
    fetchJokes(true);
  };

  // Fetch jokes on category change
  useEffect(() => {
    fetchJokes(false);
  }, [category, fetchJokes]);

  // Render joke row component
  const JokeRow = ({ index, style }) => {
    const joke = jokes[index];
    
    if (!joke) return null;
    
    return (
      <div className="joke-item" style={style}>
        <div className="joke-content">
          {fromCache ? (
            // View with data from localStorage (limited attributes)
            <div>
              <p className="joke-summary">{joke.summary}</p>
              <div className="joke-meta">
                <span className="joke-category">Category: {joke.category}</span>
                <span className="joke-id">ID: {joke.id}</span>
                <span className="joke-type">Type: {joke.type}</span>
              </div>
            </div>
          ) : (
            // View with full data from API
            <div>
              {joke.type === 'twopart' ? (
                <>
                  <p className="joke-setup">{joke.setup}</p>
                  <p className="joke-delivery">{joke.delivery}</p>
                </>
              ) : (
                <p className="joke-text">{joke.joke}</p>
              )}
              <div className="joke-meta">
                <span className="joke-category">Category: {joke.category}</span>
                <span className="joke-id">ID: {joke.id}</span>
                {joke.flags && Object.values(joke.flags).some(flag => flag) && (
                  <span className="joke-flags">
                    Flags: {Object.entries(joke.flags)
                      .filter(([_, value]) => value)
                      .map(([key]) => key)
                      .join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="joke-list-container">
      <div className="controls">
        <div className="control-group">
          <label htmlFor="category-select">Category:</label>
          <select 
            id="category-select"
            value={category} 
            onChange={handleCategoryChange}
            className="category-select"
            disabled={loading}
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div className="button-group">
          <button 
            onClick={handleRefresh}
            className="refresh-button"
            disabled={loading}
            aria-label="Refresh jokes from API"
          >
            Refresh from API
          </button>
          
          <button 
            onClick={handleClearCache}
            className="clear-cache-button"
            disabled={loading}
            aria-label="Clear cached jokes"
          >
            Clear Cache
          </button>
        </div>
      </div>

      <div className={`data-source-indicator ${fromCache ? 'from-cache' : 'from-api'}`}>
        <span>
          {fromCache ? 'Data loaded from LocalStorage (limited attributes)' : 'Data fetched from API (full attributes)'}
        </span>
        {lastUpdated && <span className="last-updated">Last updated: {lastUpdated}</span>}
      </div>

      {loading ? (
        <div className="loading-indicator" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Loading jokes...</p>
        </div>
      ) : error ? (
        <div className="error-message" role="alert">
          Error: {error}
        </div>
      ) : jokes.length === 0 ? (
        <div className="empty-message" role="status">
          No jokes found in the selected category
        </div>
      ) : (
        <div className="virtualized-list-container">
          <div className="jokes-count">
            Showing {jokes.length} jokes
          </div>
          <List
            className="virtualized-list"
            height={500}
            width="100%"
            itemCount={jokes.length}
            itemSize={150}
          >
            {JokeRow}
          </List>
        </div>
      )}
    </div>
  );
};