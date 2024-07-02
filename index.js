const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 5000;


//middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://trip-tailor-bd.web.app",
    "https://trip-tailor-bd.firebaseapp.com"
  ]
}));
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
    // await client.connect();

    const usersCollection = client.db("tripTailorBD").collection("users");
    const packageCollection = client.db("tripTailorBD").collection("packages");
    const storyCollection = client.db("tripTailorBD").collection("stories");
    const wishlistCollection = client.db("tripTailorBD").collection("wishList");
    const bookingCollection = client.db("tripTailorBD").collection("bookings");
    const commentCollection = client.db("tripTailorBD").collection("comments");
    const newsletterCollection = client.db("tripTailorBD").collection("newsletters");
    const paymentCollection = client.db("tripTailorBD").collection("payments");

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
      res.send({ token });
    })

    const verifyToken = (req, res, next) => {
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


    // ========== get length ===========
    app.get('/total', async (req, res) => {
      const totalUsers = await usersCollection.countDocuments();
      const totalPackages = await packageCollection.countDocuments();
      const totalStories = await storyCollection.countDocuments();
      const totalComments = await commentCollection.countDocuments();
      const totalBookings = await bookingCollection.countDocuments();

      const countDocs = { totalUsers, totalPackages, totalStories, totalComments, totalBookings }

      res.send(countDocs)
    })

    // ============ user related api ===========

    //save a user in the db 
    app.put('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };

      //check if the user already exist in the db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user?.status === "requested") {
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status }
          })
          return res.send(result);
        }
        else if (user?.status === "accepted") {
          const result = await usersCollection.updateOne(query, {
            $set: {
              phoneNumber: user?.phoneNumber,
              education: user?.education,
              skills: user?.skills,
              experience: user?.experience,
              profileUpdateStatus: 'updated'
            }
          })
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

    //get all the users or searched user
    
    app.get('/users', verifyToken, async (req, res) => {
      const filter = req?.query;

      const query = {
        name: { $regex: filter?.search, $options: 'i' }
      };

      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })

    //make someone admin
    app.patch('/users/admin/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin',
          status: 'accepted'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // ========== tour guide related api ========= 

    //get all tour guides data from user collection
    app.get('/tourGuides', async (req, res) => {
      const query = {
        role: 'tour guide'
      }

      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })

    //make someone tour guide
    app.patch('/users/tourGuide/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'tour guide',
          status: 'accepted'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //get single tour guide data
    app.get('/tourGuide/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }

      const result = await usersCollection.findOne(query);
      res.send(result);
    })

    app.get('/myTours/:name', async (req, res) => {
      const name = req.params.name;
      const query = { selectedTourGuide: name }
      const result = await bookingCollection.find(query).toArray();
      res.send(result)
    })

    //  ========= packages related api =========

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

      const result = await packageCollection.findOne(query);
      res.send(result);
    })

    //post packages
    app.post('/packages', verifyToken, async (req, res) => {
      const packageInfo = req.body;
      const result = await packageCollection.insertOne(packageInfo);
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


    //get packages by category
    app.get("/tour-types/:category", async (req, res) => {
      const category = req.params.category;
      const query = { tourType: category }

      const result = await packageCollection.find(query).toArray();
      res.send(result);
    });


    //  =========== story related api ===========

    //add stories in the db
    app.post('/story', verifyToken, async (req, res) => {
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

    //get 5 star stories
    app.get('/featuredStories', async (req, res) => {
      const query = { rating: 5 }
      const result = await storyCollection.find(query).toArray();
      res.send(result)
    })


    // ============= booking related api ==========
    // add a booking to the db
    app.post('/booking', verifyToken, async (req, res) => {
      const bookingInfo = req.body;
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    })


    //get all the bookings
    app.get('/booking', async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    })


    //get bookings for specific user
    app.get('/booking/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })


    //get a single booking by id for payment
    app.get('/singleBooking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    //cancel a booking
    app.delete('/booking/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    // ============== wishlist related api =========

    //add packages to the wishlist
    app.post('/wishlist', async (req, res) => {
      const wishlist = req.body;
      const query = {
        email: wishlist.email,
        tripTitle: wishlist.tripTitle
      }

      const isExist = await wishlistCollection.findOne(query);
      if (isExist) {
        return res.send({ message: 'Already in your wishlist' })
      }

      const result = await wishlistCollection.insertOne(wishlist);
      res.send(result);
    })


    //get specific users wishlist
    app.get('/wishlist/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    })


    //remove packages from wishlist
    app.delete('/wishlist/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await wishlistCollection.deleteOne(query);
      res.send(result);
    })


    //accept booking
    app.patch('/wishlist/accept/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'Accepted'
        }
      }
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    //reject booking
    app.patch('/wishlist/reject/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'Rejected'
        }
      }
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // add comments to the db
    app.post('/comments', async (req, res) => {
      const commentInfo = req.body;
      const result = await commentCollection.insertOne(commentInfo);
      res.send(result);
    })

    app.get('/comments', async (req, res) => {
      const result = await commentCollection.find().toArray();
      res.send(result)
    })

    //newsletter subscriber
    app.post('/newsletters', async (req, res) => {
      const email = req.body;
      const result = await newsletterCollection.insertOne({ email, status: "subscribed" });
      res.send(result);
    })


    //payment related api
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })


    //add transaction info to the db
    app.post('/payments', async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
      res.send(result);
    })

    //get payment info to check paid status
    app.get('/payments/:id', async (req, res) => {
      const bookingId = req.params.id;
      const query = { bookingId: bookingId }
      const result = await paymentCollection.findOne(query);
      res.send(result);
    })

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
