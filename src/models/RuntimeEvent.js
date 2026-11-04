import mongoose from 'mongoose';
const RuntimeEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  details: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});
export default mongoose.models.RuntimeEvent ||
  mongoose.model('RuntimeEvent', RuntimeEventSchema);
