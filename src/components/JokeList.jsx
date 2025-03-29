import React, { useState, useEffect, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { loadJokesFromStorage, saveJokesToStorage, clearJokesFromStorage } from '../utils/localStorage';
import './JokeList.css';

// Dostępne kategorie żartów z JokeAPI
const CATEGORIES = [
  'Programming', 
  'Miscellaneous', 
  'Dark', 
  'Pun', 
  'Spooky', 
  'Christmas'
];

// Funkcja do ograniczenia atrybutów dla localStorage (zmniejszona liczba pól)
const limitAttributes = (joke) => {
  return {
    id: joke.id,
    summary: joke.type === 'twopart' ? 
      `${joke.setup.substring(0, 50)}...` : 
      joke.joke.substring(0, 50) + '...',
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

  // Funkcja do pobierania żartów
  const fetchJokes = useCallback(async (selectedCategory, forceRefresh = false) => {
    const storageKey = `jokes:${selectedCategory}`;
    
    if (!forceRefresh) {
      // Sprawdź czy dane są w localStorage
      const cachedJokes = loadJokesFromStorage(storageKey);
      if (cachedJokes && cachedJokes.length > 0) {
        console.log('Data loaded from localStorage (limited attributes)');
        setJokes(cachedJokes);
        setFromCache(true);
        setLastUpdated(new Date(localStorage.getItem(`${storageKey}:timestamp`) || Date.now()).toLocaleString());
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setFromCache(false);
    
    try {
      const apiUrl = `https://v2.jokeapi.dev/joke/${selectedCategory}?type=single,twopart&amount=50`;
      console.log('Fetching jokes from API:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Unknown API error');
      }
      
      // Normalizacja danych - upewnij się, że zawsze otrzymujesz tablicę
      let jokesArray = [];
      if (data.jokes && Array.isArray(data.jokes)) {
        jokesArray = data.jokes;
      } else if (data.joke || data.setup) {
        jokesArray = [data];
      }
      
      if (jokesArray.length === 0) {
        throw new Error('No jokes found in the selected category');
      }
      
      // Pełne dane do wyświetlenia
      const processedJokes = jokesArray.map(joke => ({
        id: joke.id,
        joke: joke.joke || null,
        setup: joke.setup || null,
        delivery: joke.delivery || null,
        category: joke.category,
        type: joke.type,
        flags: joke.flags
      }));
      
      // Zapisz pełne dane do stanu aplikacji
      setJokes(processedJokes);
      setLastUpdated(new Date().toLocaleString());
      
      // Zapisz ograniczone dane do localStorage
      const limitedJokes = processedJokes.map(limitAttributes);
      saveJokesToStorage(storageKey, limitedJokes);
      localStorage.setItem(`${storageKey}:timestamp`, Date.now().toString());
      
      console.log('Saved limited data to localStorage');
    } catch (error) {
      console.error('Error fetching jokes:', error);
      setError(error.message);
      setJokes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Zmiana kategorii
  const handleCategoryChange = (event) => {
    const newCategory = event.target.value;
    setCategory(newCategory);
    fetchJokes(newCategory);
  };

  // Wymuś odświeżenie z API
  const handleRefresh = () => {
    fetchJokes(category, true);
  };

  // Wyczyść pamięć podręczną dla bieżącej kategorii
  const handleClearCache = () => {
    clearJokesFromStorage(`jokes:${category}`);
    localStorage.removeItem(`jokes:${category}:timestamp`);
    fetchJokes(category, true);
  };

  // Pobierz żarty przy pierwszym renderowaniu
  useEffect(() => {
    fetchJokes(category);
  }, [category, fetchJokes]);

  // Komponent renderujący pojedynczy element na liście
  const JokeRow = ({ index, style }) => {
    const joke = jokes[index];
    
    if (!joke) return null;
    
    return (
      <div className="joke-item" style={style}>
        <div className="joke-content">
          {fromCache ? (
            // Widok z danymi z localStorage (ograniczone atrybuty)
            <div>
              <p className="joke-summary">{joke.summary}</p>
              <div className="joke-meta">
                <span className="joke-category">Category: {joke.category}</span>
                <span className="joke-id">ID: {joke.id}</span>
                <span className="joke-type">Type: {joke.type}</span>
              </div>
            </div>
          ) : (
            // Widok z pełnymi danymi z API
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
                <span className="joke-flags">
                  {Object.entries(joke.flags || {})
                    .filter(([_, value]) => value)
                    .map(([key]) => key)
                    .join(', ')}
                </span>
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
          >
            Refresh from API
          </button>
          
          <button 
            onClick={handleClearCache}
            className="clear-cache-button"
            disabled={loading}
          >
            Clear Cache
          </button>
        </div>
      </div>

      <div className={`data-source-indicator ${fromCache ? 'from-cache' : 'from-api'}`}>
        {fromCache ? 'Data loaded from LocalStorage (limited attributes)' : 'Data fetched from API (full attributes)'}
        {lastUpdated && <span className="last-updated">Last updated: {lastUpdated}</span>}
      </div>

      {loading ? (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Loading jokes...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          Error: {error}
        </div>
      ) : jokes.length === 0 ? (
        <div className="empty-message">
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
