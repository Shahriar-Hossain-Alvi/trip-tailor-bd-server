const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');


const app = express();
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());



//mongodb starts
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mfte2wh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("tripTailorBD").collection("users");
    const packageCollection = client.db("tripTailorBD").collection("packages");
    const storyCollection = client.db("tripTailorBD").collection("stories");

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
      res.send({ token });
    })




    //save a user in the db 
    app.put('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };

      //check if the user already exist in the db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user?.status === "requested") {
          const result = await usersCollection.updateOne(query, { $set: { status: user?.status } })
          return res.send(result);
        }
        else {
          return res.send(isExist);
        }
      }
      //save the user for the first time
      const options = { upsert: true };
      const updateDoc = { $set: { ...user } }

      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })

    //get only the tour types
    app.get("/tour-types", async (req, res) => {
      const pipeline = [
        { $unwind: "$tourType" },
        { $group: { _id: "$tourType", } },
        { $project: { tourType: "$_id" } }
      ];
      const result = await packageCollection.aggregate(pipeline).toArray();
      // Extract unique tour types from the results
      const uniqueTourTypes = [...new Set(result.map(item => item.tourType))];

      res.send(uniqueTourTypes);
    });


    //add stories in the db
    app.post('/story', async (req, res) => {
      const storyInfo = req.body;

      const result = await storyCollection.insertOne(storyInfo);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





//start the server
app.get('/', (req, res) => {
  res.send('Trip Tailor Bangladesh server is running');
});

app.listen(port, () => {
  console.log(`Trip Tailor Bangladesh is running on port ${port}`);
});
