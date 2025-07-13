import { useState } from 'react'
import { Routes, Route } from 'react-router-dom';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './index.css'

function Home() {
  const [count, setCount] = useState(0)
  return (
    <>
      <div className="flex justify-center gap-8 my-6">
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="w-20 h-20 animate-spin" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="w-20 h-20" alt="React logo" />
        </a>
      </div>
      <h1 className="text-5xl font-bold text-center mb-8">Vite + React + Tailwind</h1>
      <div className="card bg-gray-800 p-6 rounded-lg shadow-lg max-w-md mx-auto text-white">
        <button 
          onClick={() => setCount(count + 1)} 
          className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700 transition"
        >
          count is {count}
        </button>
        <p className="mt-4 text-center">
          Edit <code className="bg-gray-700 px-1 rounded">src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="text-center mt-10 text-gray-400">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

export default App
