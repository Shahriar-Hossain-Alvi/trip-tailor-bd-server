const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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
    const wishlistCollection = client.db("tripTailorBD").collection("wishList");

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
      res.send({ token });
    })

    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      });
    }


    // ============ user related api ===========

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

    //get single user
    app.get('/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email
      }
      const result = await usersCollection.findOne(query);
      res.send(result);
    })


    //  ========= packages related api =========

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

    //get all the packages
    app.get('/packages', async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });


    //get 3 highest price packages
    app.get('/highestPricePackages', async (req, res) => {
      const result = await packageCollection.find().sort({ price: -1 }).limit(3).toArray();
      res.send(result);
    })


    //get a specific package
    app.get('/package/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }

      const result = await packageCollection.find(query).toArray();
      res.send(result);
    })


    //  =========== story related api ===========

    //add stories in the db
    app.post('/story', async (req, res) => {
      const storyInfo = req.body;

      const result = await storyCollection.insertOne(storyInfo);
      res.send(result);
    })

    //get all the stories
    app.get('/stories', async (req, res) => {
      const result = await storyCollection.find().toArray();
      res.send(result);
    })

    //get 4 stories
    app.get('/limitedStories', async (req, res) => {
      const result = await storyCollection.find().limit(4).toArray();
      res.send(result);
    })

    //get single story data
    app.get('/story/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }

      const result = await storyCollection.findOne(query);
      res.send(result)
    })


    // ============== wishlist related api =========
    app.post('/wishlist', async (req, res) => {
      const wishlist = req.body;
      const result = await wishlistCollection.insertOne(wishlist);
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
