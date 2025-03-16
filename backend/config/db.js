const mongoose = require('mongoose');
const dbConfig = require('./database.config');

const connectDB = async () => {
  try {
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected! Attempting to reconnect...');
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
      mongoose.disconnect();
    });

    const conn = await mongoose.connect(dbConfig.url, dbConfig.options);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes for the database
    await createIndexes();
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Retry connection after 5 seconds
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Function to create necessary indexes
const createIndexes = async () => {
  try {
    const collections = await mongoose.connection.db.collections();
    
    for (let collection of collections) {
      if (collection.collectionName === 'accounts') {
        // Create compound unique indexes
        await collection.createIndex({ username: 1, website: 1 }, { unique: true });
        await collection.createIndex({ email: 1, website: 1 }, { unique: true });
        console.log('Account indexes created successfully');
      }
    }
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

module.exports = connectDB; 