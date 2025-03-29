/**
 * Funkcja ładująca dane z localStorage
 * @param {string} key - Klucz localStorage
 * @returns {Array|null} - Dane z localStorage lub null
 */
export const loadJokesFromStorage = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    return null;
  }
};

/**
 * Funkcja zapisująca dane do localStorage
 * @param {string} key - Klucz localStorage
 * @param {Array} data - Dane do zapisania
 */
export const saveJokesToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving data to localStorage:', error);
  }
};

/**
 * Funkcja czyszcząca dane z localStorage
 * @param {string} key - Klucz localStorage
 */
export const clearJokesFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing data from localStorage:', error);
  }
};