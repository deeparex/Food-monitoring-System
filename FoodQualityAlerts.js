const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const moment = require('moment');
const socketIo = require('socket.io');

const app = express();
const server = require('http').Server(app);
const io = socketIo(server);

app.use(bodyParser.json());

// MongoDB Schema for Food Data Traceability
const FoodItemSchema = new mongoose.Schema({
  foodItem: String,  // Name of the food item
  origin: String,    // Supplier or farm where the food came from
  qualityCheckDate: { type: Date, default: Date.now },  // Last quality check date
  freshnessExpiryDate: Date,  // Expiry date based on freshness
  safetyCertifications: [String],  // List of certifications (e.g., Organic, Fair Trade)
  contaminationRisk: Boolean,  // Whether there is a contamination risk
  traceId: { type: String, unique: true },  // Unique identifier for each food item
  qualityIssue: { type: Boolean, default: false },  // Flag for quality issues
  lastUpdated: { type: Date, default: Date.now },  // Track last update time
});

// MongoDB model for Food Items
const FoodItem = mongoose.model('FoodItem', FoodItemSchema);

// MongoDB connection
mongoose
  .connect('mongodb://localhost:27017/foodQualityAlerts', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Function to check if there are any quality issues (e.g., contamination, expiry)
function checkQualityIssues(foodItem) {
  const qualityAlerts = [];

  // Check contamination risk
  if (foodItem.contaminationRisk) {
    qualityAlerts.push('Food item has contamination risk.');
  }

  // Check if food item has expired
  const currentDate = moment();
  const expiryDate = moment(foodItem.freshnessExpiryDate);
  if (expiryDate.isBefore(currentDate)) {
    qualityAlerts.push('Food item has expired.');
  }

  // Check if food item has necessary safety certifications
  const requiredCertifications = ['FDA Approved', 'FSSAI Certified', 'ISO 22000'];
  const missingCertifications = requiredCertifications.filter(cert => !foodItem.safetyCertifications.includes(cert));
  if (missingCertifications.length > 0) {
    qualityAlerts.push(`Missing required certifications: ${missingCertifications.join(', ')}`);
  }

  return qualityAlerts;
}

// Real-time notification to managers when quality issues are detected
function notifyQualityIssue(foodItem, qualityAlerts) {
  const alertMessage = `Quality issues detected for ${foodItem.foodItem}: ${qualityAlerts.join(' ')}`;

  // Emit a real-time alert to all connected clients (managers)
  io.emit('qualityAlert', {
    traceId: foodItem.traceId,
    alertMessage,
    foodItem: foodItem.foodItem,
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
  });
}

// Endpoint to get the traceability details and quality alerts of a food item
app.get('/api/food/:traceId', async (req, res) => {
  const { traceId } = req.params;

  try {
    // Fetch the food item by trace ID
    const foodItem = await FoodItem.findOne({ traceId });

    if (!foodItem) {
      return res.status(404).json({ error: 'Food item not found.' });
    }

    // Check if the food item has any quality issues
    const qualityAlerts = checkQualityIssues(foodItem);

    // If there are any quality issues, notify managers
    if (qualityAlerts.length > 0) {
      notifyQualityIssue(foodItem, qualityAlerts);
    }

    // Return food item details and any quality issues
    res.json({
      foodItem: foodItem.foodItem,
      origin: foodItem.origin,
      safetyCertifications: foodItem.safetyCertifications,
      contaminationRisk: foodItem.contaminationRisk,
      freshnessExpiryDate: foodItem.freshnessExpiryDate,
      traceId: foodItem.traceId,
      qualityAlerts,
      lastUpdated: foodItem.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching food item data:', error);
    res.status(500).json({ error: 'Failed to fetch food item data.' });
  }
});

// Endpoint to update food item traceability and quality data
app.post('/api/food/:traceId', async (req, res) => {
  const { traceId } = req.params;
  const updatedData = req.body;

  try {
    // Find the food item by trace ID and update the data
    const foodItem = await FoodItem.findOneAndUpdate(
      { traceId },
      { ...updatedData, lastUpdated: Date.now() },
      { new: true }
    );

    if (!foodItem) {
      return res.status(404).json({ error: 'Food item not found.' });
    }

    // Check the updated food item for quality issues
    const qualityAlerts = checkQualityIssues(foodItem);

    // If there are any quality issues, notify managers
    if (qualityAlerts.length > 0) {
      notifyQualityIssue(foodItem, qualityAlerts);
    }

    res.json({
      foodItem: foodItem.foodItem,
      origin: foodItem.origin,
      safetyCertifications: foodItem.safetyCertifications,
      contaminationRisk: foodItem.contaminationRisk,
      freshnessExpiryDate: foodItem.freshnessExpiryDate,
      traceId: foodItem.traceId,
      qualityAlerts,
      lastUpdated: foodItem.lastUpdated,
      message: 'Food item traceability and quality information updated successfully.',
    });
  } catch (error) {
    console.error('Error updating food item data:', error);
    res.status(500).json({ error: 'Failed to update food item data.' });
  }
});

// Start the server and WebSocket
const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

