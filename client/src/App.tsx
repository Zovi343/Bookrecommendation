import React, { useState, useRef } from 'react';
import axios from 'axios';
import './app.scss';

interface Book {
  image: string,
  title: string,
  author: string
} 

function App() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = async () => {
    setBooks([]);
    setSearched('');

    if (!inputValue) {
      setError('Please enter a search term');
      return;
    }

    try {
      const response = await fetch(`/api?title=${inputValue}&exact=${isChecked}`);
      if (response.status == 400) {
        setError("Such Book is not in our database.");
        return;
      }

      const data = await response.json();
      const books = data.books.map((book: any) => book.metadata);
      setBooks(books);
      setSearched(data.searched_for.vectors[data.searched_for_isbn].metadata.title);
      setInputValue('');
      setError('');
    } catch (error) {
      setError(`${error}`);
    }
  };

  const [isChecked, setIsChecked] = useState(false);

  const handleCheckboxChange = () => {
    setIsChecked(!isChecked);
  };

  return (
    <div className="container">
      <div>
        <div className="search">
          <h1>Book Recommendation App</h1>
          <div className='search__field'>
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              ref={inputRef}
              className="search__input"
            />
            <div className='exact-checkbox'>
              <label>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={handleCheckboxChange}
                />
              </label>
            </div>
            <button onClick={handleButtonClick} className="search__button">
              Search
            </button>
          </div>
        </div>
        <div className="searched">
          {error &&  <p className="searched__error">{error}</p>}
          {searched &&  <p className="searched__error"><strong>You have searched for:</strong> {searched}</p>}
        </div>
      </div>
      <div className="results">
          {books.map((book, index) => (
            <div className="results__book" key={index}>
              <div className='results__image-wrap'>
                <img key={book.image} src={book.image} alt="search result" className="results__image" />
              </div>
              <div className="results__book-text">
                <p>{ book.title }</p>
                <p>by</p>
                <p>{ book.author }</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default App;
