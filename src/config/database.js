import mongoose from 'mongoose';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);
  mongoose.connection.on('error', (error) =>
    console.error('MongoDB error:', error.message),
  );
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/actorlab',
    { serverSelectionTimeoutMS: 5000 },
  );
  console.log('Connected to MongoDB');
}
