import mongoose from 'mongoose';
const MessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true },
    actorId: { type: String, required: true, index: true },
    operation: String,
    payload: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
export default mongoose.models.Message ||
  mongoose.model('Message', MessageSchema);
