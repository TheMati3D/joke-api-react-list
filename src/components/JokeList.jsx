import React, { useState, useEffect, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { loadJokesFromStorage, saveJokesToStorage, clearJokesFromStorage } from '../utils/localStorage';
import './JokeList.css';

// Lista dostępnych kategorii żartów z JokeAPI
// Każda kategoria reprezentuje inny rodzaj żartów
const CATEGORIES = [
  'Programming', 
  'Miscellaneous', 
  'Dark', 
  'Pun', 
  'Spooky', 
  'Christmas'
];

// Funkcja tworząca "odchudzoną" wersję obiektu żartu do zapisu w localStorage
// Przechowujemy tylko niezbędne pola, aby oszczędzać miejsce i uniknąć limitów localStorage
const limitAttributes = (joke) => {
  return {
    id: joke.id,
    // Tworzymy krótki podgląd/podsumowanie treści żartu
    summary: joke.type === 'twopart' ? 
      `${joke.setup.substring(0, 50)}...` : 
      joke.joke.substring(0, 50) + '...',
    category: joke.category,
    type: joke.type
  };
};

export const JokeList = () => {
  // Główne zmienne stanu dla komponentu
  const [jokes, setJokes] = useState([]); // Tablica obiektów z żartami
  const [loading, setLoading] = useState(false); // Śledzi stan ładowania dla wywołań API
  const [error, setError] = useState(null); // Przechowuje komunikaty błędów
  const [category, setCategory] = useState(CATEGORIES[0]); // Aktualnie wybrana kategoria żartów
  const [fromCache, setFromCache] = useState(false); // Flaga wskazująca, czy dane pochodzą z localStorage
  const [lastUpdated, setLastUpdated] = useState(null); // Znacznik czasu ostatniej aktualizacji danych

  // Funkcja obsługująca pobieranie żartów z localStorage lub z API
  // Opakowana w useCallback, aby zapobiec niepotrzebnym ponownym renderowaniom
  const fetchJokes = useCallback(async (selectedCategory, forceRefresh = false) => {
    // Tworzymy unikalny klucz pamięci na podstawie wybranej kategorii
    const storageKey = `jokes:${selectedCategory}`;
    
    // Jeśli nie wymuszamy odświeżenia, najpierw próbujemy załadować dane z localStorage
    if (!forceRefresh) {
      // Sprawdzamy, czy mamy już żarty zapisane w cache dla tej kategorii
      const cachedJokes = loadJokesFromStorage(storageKey);
      if (cachedJokes && cachedJokes.length > 0) {
        console.log('Data loaded from localStorage (limited attributes)');
        setJokes(cachedJokes);
        setFromCache(true);
        // Pobieramy i formatujemy znacznik czasu, kiedy dane zostały zapisane w cache
        setLastUpdated(new Date(localStorage.getItem(`${storageKey}:timestamp`) || Date.now()).toLocaleString());
        setLoading(false);
        return; // Wyjście wcześniej, nie trzeba pobierać z API
      }
    }

    // Jeśli doszliśmy do tego miejsca, musimy pobrać dane z API
    // Ustawiamy stany interfejsu, aby pokazać ładowanie i resetujemy wcześniejsze błędy
    setLoading(true);
    setError(null);
    setFromCache(false);
    
    try {
      // Budujemy URL API z wybraną kategorią i żądamy 50 żartów
      const apiUrl = `https://v2.jokeapi.dev/joke/${selectedCategory}?type=single,twopart&amount=50`;
      console.log('Fetching jokes from API:', apiUrl);
      
      // Wykonujemy zapytanie do API
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      // Parsujemy odpowiedź JSON
      const data = await response.json();
      
      // Sprawdzamy, czy API zwróciło błąd
      if (data.error) {
        throw new Error(data.message || 'Unknown API error');
      }
      
      // Normalizacja danych - upewniamy się, że zawsze pracujemy z tablicą
      let jokesArray = [];
      if (data.jokes && Array.isArray(data.jokes)) {
        jokesArray = data.jokes;
      } else if (data.joke || data.setup) {
        // Jeśli API zwróciło pojedynczy żart, zamieniamy go na tablicę z jednym elementem
        jokesArray = [data];
      }
      
      // Sprawdzamy, czy udało się pobrać jakiekolwiek żarty
      if (jokesArray.length === 0) {
        throw new Error('No jokes found in the selected category');
      }
      
      // Przetwarzamy pełne dane do wyświetlenia na ekranie
      const processedJokes = jokesArray.map(joke => ({
        id: joke.id,
        joke: joke.joke || null, // Treść żartu dla żartów typu 'single'
        setup: joke.setup || null, // Początek żartu dla żartów typu 'twopart'
        delivery: joke.delivery || null, // Pointa żartu dla żartów typu 'twopart'
        category: joke.category,
        type: joke.type,
        flags: joke.flags // Oznaczenia dotyczące zawartości żartu (np. niecenzuralny, polityczny itp.)
      }));
      
      // Zapisujemy pełne dane do stanu aplikacji
      setJokes(processedJokes);
      setLastUpdated(new Date().toLocaleString());
      
      // Zapisujemy ograniczone dane do localStorage, aby zmniejszyć ilość zajmowanego miejsca
      const limitedJokes = processedJokes.map(limitAttributes);
      saveJokesToStorage(storageKey, limitedJokes);
      localStorage.setItem(`${storageKey}:timestamp`, Date.now().toString());
      
      console.log('Saved limited data to localStorage');
    } catch (error) {
      // W przypadku błędu, zapisujemy go do stanu i wyświetlamy użytkownikowi
      console.error('Error fetching jokes:', error);
      setError(error.message);
      setJokes([]);
    } finally {
      // Niezależnie od wyniku, kończymy stan ładowania
      setLoading(false);
    }
  }, []);

  // Obsługa zmiany kategorii przez użytkownika
  const handleCategoryChange = (event) => {
    const newCategory = event.target.value;
    setCategory(newCategory);
    fetchJokes(newCategory); // Pobieramy żarty z nowej kategorii
  };

  // Funkcja wymuszająca odświeżenie danych z API, ignorując cache
  const handleRefresh = () => {
    fetchJokes(category, true);
  };

  // Funkcja czyszcząca pamięć podręczną dla bieżącej kategorii
  const handleClearCache = () => {
    clearJokesFromStorage(`jokes:${category}`);
    localStorage.removeItem(`jokes:${category}:timestamp`);
    fetchJokes(category, true); // Pobieramy świeże dane z API
  };

  // Efekt uruchamiany przy pierwszym renderowaniu i zmianie kategorii
  // Pobiera żarty dla wybranej kategorii
  useEffect(() => {
    fetchJokes(category);
  }, [category, fetchJokes]);

  // Komponent renderujący pojedynczy element na liście żartów
  // Funkcja jest wykorzystywana przez bibliotekę react-window do efektywnego renderowania długich list
  const JokeRow = ({ index, style }) => {
    const joke = jokes[index];
    
    if (!joke) return null;
    
    return (
      <div className="joke-item" style={style}>
        <div className="joke-content">
          {fromCache ? (
            // Widok z danymi z localStorage (ograniczone atrybuty)
            // Pokazujemy tylko skróconą wersję żartu, która była zapisana w cache
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
            // Pokazujemy pełną treść żartu, różnie formatowaną w zależności od typu
            <div>
              {joke.type === 'twopart' ? (
                // Dla żartów dwuczęściowych pokazujemy setup i delivery osobno
                <>
                  <p className="joke-setup">{joke.setup}</p>
                  <p className="joke-delivery">{joke.delivery}</p>
                </>
              ) : (
                // Dla żartów jednoczęściowych pokazujemy całą treść
                <p className="joke-text">{joke.joke}</p>
              )}
              <div className="joke-meta">
                <span className="joke-category">Category: {joke.category}</span>
                <span className="joke-id">ID: {joke.id}</span>
                <span className="joke-flags">
                  {/* Pokazujemy tylko te flagi, które są ustawione na true */}
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
      {/* Panel kontrolny z wyborem kategorii i przyciskami akcji */}
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

      {/* Wskaźnik źródła danych - pokazuje, czy dane są z API czy z localStorage */}
      <div className={`data-source-indicator ${fromCache ? 'from-cache' : 'from-api'}`}>
        {fromCache ? 'Data loaded from LocalStorage (limited attributes)' : 'Data fetched from API (full attributes)'}
        {lastUpdated && <span className="last-updated">Last updated: {lastUpdated}</span>}
      </div>

      {/* Wyświetlanie różnych stanów interfejsu */}
      {loading ? (
        // Stan ładowania z animowanym spinnerem
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Loading jokes...</p>
        </div>
      ) : error ? (
        // Stan błędu z komunikatem
        <div className="error-message">
          Error: {error}
        </div>
      ) : jokes.length === 0 ? (
        // Stan braku danych
        <div className="empty-message">
          No jokes found in the selected category
        </div>
      ) : (
        // Stan z danymi - wyświetlamy zwirtualizowaną listę żartów
        <div className="virtualized-list-container">
          <div className="jokes-count">
            Showing {jokes.length} jokes
          </div>
          {/* 
            Lista wirtualizowana - renderuje tylko widoczne elementy,
            co znacznie poprawia wydajność przy długich listach
          */}
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