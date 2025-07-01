const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = 3000;
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!')
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});


// Middleware
app.use(express.json());

// MongoDB Connection
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Database connection function
async function connectToMongo() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("MongoDB connected successfully!");

        // Event listeners for connection monitoring
        client.on('serverHeartbeatFailed', (event) => {
            console.error('MongoDB connection lost:', event);
            // Implement reconnection logic if needed
        });
    } catch (e) {
        console.error("Failed to connect to MongoDB:", e);
        process.exit(1);
    }
}

// Connect to MongoDB when the application starts
connectToMongo().catch(console.error);

// Routes

// Login route (changed to POST)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send("Email and password are required.");
        }

        const database = client.db('mydatabase');
        const customersCollection = database.collection('customers');
        const driversCollection = database.collection('drivers');
        const adminsCollection = database.collection('admins');

        let user = null;
        let role = null;

        // Check in customers collection
        user = await customersCollection.findOne({ email, password });
        if (user) {
            role = 'customer';
        } else {
            // Check in drivers collection
            user = await driversCollection.findOne({ email, password });
            if (user) {
                role = 'driver';
            } else {
                // Check in admins collection
                user = await adminsCollection.findOne({ username: email, password });
                if (user) {
                    role = 'admin';
                }
            }
        }

        if (!user) {
            return res.status(401).send("Invalid credentials.");
        }

        // Don't send password back in response
        delete user.password;
        res.status(200).json({
            message: "Login successful",
            userId: user._id,
            role: role,
            userDetails: user
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error during login.");
    }
});

// Customer Registration
app.post('/api/customer/register', async (req, res) => {
    try {
        const { name, email, password, num_phone } = req.body;

        if (!name || !email || !password || !num_phone) {
            return res.status(400).send("Name, email, password, and phone number are required.");
        }

        const database = client.db('mydatabase');
        const customersCollection = database.collection('customers');

        const existingCustomer = await customersCollection.findOne({
            $or: [{ email }, { num_phone }]
        });
        if (existingCustomer) {
            return res.status(409).send("Customer with this email or phone number already exists.");
        }

        const result = await customersCollection.insertOne({
            name,
            email,
            password, // In production, you should hash this password
            num_phone,
            status: 'active',
           
        });

        res.status(201).json({
            message: "Customer registered successfully",
            cust_id: result.insertedId
        });
    } catch (error) {
        console.error("Error during customer registration:", error);
        res.status(500).send("Internal Server Error during registration.");
    }
});

// Customer Book Ride
app.post('/api/customer/book', async (req, res) => {
    try {
        const { cust_id, pickupLocation, destination } = req.body;

        if (!cust_id || !pickupLocation || !destination) {
            return res.status(400).send("Customer ID, pickup location, and destination are required.");
        }

        const database = client.db('mydatabase');
        const ridesCollection = database.collection('rides');

        const result = await ridesCollection.insertOne({
            cust_id: new ObjectId(cust_id),
            driver_id: null,
            fare_amount: 0,
            pickup_loc: pickupLocation,
            destination: destination,
            status: 'requested',
            
        });

        res.status(201).json({
            message: "Ride requested successfully",
            ride_id: result.insertedId
        });
    } catch (error) {
        console.error("Error booking ride:", error);
        res.status(500).send("Internal Server Error booking ride.");
    }
});

// Customer Submit Complaint
app.post('/api/customer/complain', async (req, res) => {
    try {
        const { cust_id, ride_id, description, status } = req.body;

        if (!cust_id || !ride_id || !description || !status) {
            return res.status(400).send("Customer ID, Ride ID, description, and status are required.");
        }

        const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).send(`Invalid complaint status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const database = client.db('mydatabase');
        const complaintsCollection = database.collection('complaints');

        const result = await complaintsCollection.insertOne({
            cust_id: new ObjectId(cust_id),
            ride_id: new ObjectId(ride_id),
            description,
            status,
            
        });

        res.status(201).json({
            message: "Complaint submitted successfully.",
            complaint_id: result.insertedId
        });
    } catch (error) {
        console.error("Error submitting complaint:", error);
        res.status(500).send("Internal Server Error submitting complaint.");
    }
});

// Driver Registration
app.post('/api/driver/register', async (req, res) => {
    try {
        const { name, email, password, license_num } = req.body;

        if (!name || !email || !password || !license_num) {
            return res.status(400).send("Name, email, password, and license number are required.");
        }

        const database = client.db('mydatabase');
        const driversCollection = database.collection('drivers');

        const existingDriver = await driversCollection.findOne({
            $or: [{ email }, { license_num }]
        });
        if (existingDriver) {
            return res.status(409).send("Driver with this email or license number already exists.");
        }

        const result = await driversCollection.insertOne({
            name,
            email,
            password, // In production, you should hash this password
            license_num,
            vehicle_id: null,
            
            
        });

        res.status(201).json({
            message: "Driver registered successfully",
            driver_id: result.insertedId
        });
    } catch (error) {
        console.error("Error during driver registration:", error);
        res.status(500).send("Internal Server Error during driver registration.");
    }
});

// Driver Register Vehicle
app.post('/api/driver/register-vehicle', async (req, res) => {
    try {
        const { driver_id, registration_num, model } = req.body;

        if (!driver_id || !registration_num || !model) {
            return res.status(400).send("Driver ID, registration number, and model are required.");
        }

        const database = client.db('mydatabase');
        const vehiclesCollection = database.collection('vehicles');
        const driversCollection = database.collection('drivers');

        const existingVehicle = await vehiclesCollection.findOne({ registration_num });
        if (existingVehicle) {
            return res.status(409).send("Vehicle with this registration number is already registered.");
        }

        const vehicleResult = await vehiclesCollection.insertOne({
            driver_id: new ObjectId(driver_id),
            registration_num,
            model,
            
            
        });

        await driversCollection.updateOne(
            { _id: new ObjectId(driver_id) },
            { $set: { vehicle_id: vehicleResult.insertedId } }
        );

        res.status(201).json({
            message: "Vehicle registered successfully",
            vehicle_id: vehicleResult.insertedId
        });
    } catch (error) {
        console.error("Error registering vehicle:", error);
        res.status(500).send("Internal Server Error registering vehicle.");
    }
});

// Driver Accept Ride
app.post('/api/driver/accept-ride', async (req, res) => {
    try {
        const { ride_id, driver_id } = req.body;

        if (!ride_id || !driver_id) {
            return res.status(400).send("Ride ID and Driver ID are required.");
        }

        const database = client.db('mydatabase');
        const ridesCollection = database.collection('rides');

        const result = await ridesCollection.updateOne(
            { _id: new ObjectId(ride_id), status: 'requested', driver_id: null },
            {
                $set: {
                    driver_id: new ObjectId(driver_id),
                    status: 'accepted',
                    
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send("Ride not available for acceptance.");
        }

        res.status(200).json({ message: "Ride accepted successfully." });
    } catch (error) {
        console.error("Error accepting ride:", error);
        res.status(500).send("Internal Server Error accepting ride.");
    }
});

// Driver Complete Ride
app.post('/api/driver/complete-ride', async (req, res) => {
    try {
        const { ride_id, fare_amount } = req.body;

        if (!ride_id || fare_amount === undefined || fare_amount < 0) {
            return res.status(400).send("Valid Ride ID and fare amount are required.");
        }

        const database = client.db('mydatabase');
        const ridesCollection = database.collection('rides');
        const paymentsCollection = database.collection('payments');

        // Update ride status
        const rideUpdate = await ridesCollection.updateOne(
            { _id: new ObjectId(ride_id), status: 'accepted' },
            {
                $set: {
                    status: 'completed',
                    fare_amount,
                  
                    
                }
            }
        );

        if (rideUpdate.matchedCount === 0) {
            return res.status(404).send("Ride not found or not in 'accepted' status.");
        }

        // Create payment record
        const ride = await ridesCollection.findOne({ _id: new ObjectId(ride_id) });
        if (ride) {
            await paymentsCollection.insertOne({
                ride_id: new ObjectId(ride_id),
                fare_amount,
                method: 'cash', // Default method, can be changed
                
                
            });
        } else {
            console.warn(`Ride ${ride_id} not found during completion, payment record not created.`);
        }

        res.status(200).json({ message: "Ride completed successfully." });
    } catch (error) {
        console.error("Error completing ride:", error);
        res.status(500).send("Internal Server Error completing ride.");
    }
});
app.post('/api/driver/update-status', async (req, res) => {
    try {
        const { driver_id, status } = req.body;

        const validStatuses = ['available', 'unavailable', 'in_ride'];
        if (!validStatuses.includes(status)) {
            return res.status(400).send(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const database = client.db('mydatabase');
        const driversCollection = database.collection('drivers');

        await driversCollection.updateOne(
            { _id: new ObjectId(driver_id) },
            { $set: { status } }
        );

        res.status(200).json({ message: "Driver status updated successfully." });
    } catch (error) {
        console.error("Error updating driver status:", error);
        res.status(500).send("Internal Server Error updating status.");
    }
});

// Admin Registration
app.post('/api/admin/register', async (req, res) => {
    try {
        const { username, password, permissions } = req.body;

        if (!username || !password || !permissions) {
            return res.status(400).send("Username, password, and permissions are required.");
        }

        const database = client.db('mydatabase');
        const adminsCollection = database.collection('admins');

        const existingAdmin = await adminsCollection.findOne({ username });
        if (existingAdmin) {
            return res.status(409).send("Admin with this username already exists.");
        }

        const result = await adminsCollection.insertOne({
            username,
            password, // In production, you should hash this password
            permissions,
           
        });

        res.status(201).json({
            message: "Admin registered successfully",
            admin_id: result.insertedId
        });
    } catch (error) {
        console.error("Error during admin registration:", error);
        res.status(500).send("Internal Server Error during admin registration.");
    }
});

// Admin Handle Complaint
app.post('/api/admin/handle-complaint', async (req, res) => {
    try {
        const { complaint_id, status, notes, admin_id } = req.body;

        if (!complaint_id || !status || !admin_id) {
            return res.status(400).send("Complaint ID, status, and Admin ID are required.");
        }

        const validStatuses = ['resolved', 'in_progress', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).send(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const database = client.db('mydatabase');
        const complaintsCollection = database.collection('complaints');

        const result = await complaintsCollection.updateOne(
            { _id: new ObjectId(complaint_id) },
            {
                $set: {
                    status,
                    notes,
                    admin_id: new ObjectId(admin_id),
                    handledAt: new Date(),
                    
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send("Complaint not found.");
        }

        res.status(200).json({ message: "Complaint handled successfully." });
    } catch (error) {
        console.error("Error handling complaint:", error);
        res.status(500).send("Internal Server Error handling complaint.");
    }
});
// Add this with your other routes, before the error handling middleware

// Complaints Analytics Endpoint
app.get('/analytics/complaints', async (req, res) => {
    try {
        const { status } = req.query;
        const database = client.db('mydatabase');
        const complaintsCollection = database.collection('complaints');

        // Create the aggregation pipeline
        const pipeline = [
            // Stage 1: Filter by status if provided
            ...(status ? [{ $match: { status } }] : []),

            // Stage 2: Project only the fields we need (from your screenshots)
            {
                $project: {
                    _id: 1,
                    cust_id: 1,
                    description: 1,
                    status: 1,
                    handledAt: { $ifNull: ["$handledAt", null] }
                }
            },

            // Stage 3: Group by status for statistics
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    complaints: { $push: "$$ROOT" }
                }
            },

            // Stage 4: Format the output
            {
                $project: {
                    status: "$_id",
                    count: 1,
                    complaints: 1,
                    _id: 0
                }
            },

            // Stage 5: Sort by status
            {
                $sort: { status: 1 }
            }
        ];

        const results = await complaintsCollection.aggregate(pipeline).toArray();

        res.status(200).json({
            success: true,
            count: results.reduce((total, group) => total + group.count, 0),
            data: results
        });

    } catch (error) {
        console.error('Error in complaints analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get complaints analytics',
            error: error.message
        });
    }
});

                    


// Admin View Driver List
app.get('/api/admin/driver-list', async (req, res) => {
    try {
        const database = client.db('mydatabase');
        const driversCollection = database.collection('drivers');

        const drivers = await driversCollection.find({})
            .project({ password: 0 }) // Exclude passwords
            .sort({ createdAt: -1 }) // Newest first
            .toArray();

        if (!drivers.length) {
            return res.status(404).json({ message: "No drivers found." });
        }

        res.status(200).json(drivers);
    } catch (error) {
        console.error("Error retrieving driver list:", error);
        res.status(500).send("Internal Server Error retrieving driver list.");
    }
});

const cors = require('cors');
app.use(cors()); // Add this before your routes

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('Internal Server Error');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Start server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Closing MongoDB connection...');
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
});
