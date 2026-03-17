import sqlite3 from 'sqlite3';
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the in-memory SQlite database.');
  }
});
