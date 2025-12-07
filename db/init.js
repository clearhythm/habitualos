const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'habitualos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Check if database already exists
const dbExists = fs.existsSync(dbPath);

// Create database if it doesn't exist
const db = new Database(dbPath);

// Read and execute schema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

if (dbExists) {
  console.log('✅ Database already exists - schema updated');
} else {
  console.log('✅ Database initialized');
}

db.close();
