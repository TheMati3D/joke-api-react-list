import React from 'react';
import { JokeList } from './components/JokeList';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Jokes Application</h1>
      </header>
      <main className="App-main">
        <JokeList />
      </main>
      <footer className="App-footer">
      </footer>
    </div>
  );
}

export default App;