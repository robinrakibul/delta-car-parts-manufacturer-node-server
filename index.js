const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
const { query } = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('My server is running');
})

// mongodb connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.qj1eq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        // verify JWT
        function verifyJWT(req, res, next) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'UnAuthorized access' });
            }
            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
                if (err) {
                    return res.status(403).send({ message: 'Forbidden access' })
                }
                req.decoded = decoded;
                next();
            });
        }
        await client.connect();
        // collection in mongodb
        const itemsCollection = client.db('carParts').collection('items');
        const reviewsCollection = client.db('carParts').collection('reviews');
        const userCollection = client.db('carParts').collection('users');
        const orderCollection = client.db('carParts').collection('order');
        const paymentCollection = client.db('carParts').collection('payments');

        // items DB
        app.get('/items', async (req, res) => {
            const query = {};
            const cursor = itemsCollection.find(query);
            const items = await cursor.toArray();
            res.send(items);
        });


        // Reviews DB
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const items = await cursor.toArray();
            res.send(items);
        });

        // auth jwt for login
        app.put('/login', async (req, res) => {
            const user = req.body;
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '7d'
            });
            res.send({ accessToken });
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.send({ result, token });
        });

        // verify an admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        // For giving admin role
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // admin email check 
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        // searchId Items
        app.get('/items/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const itemSearch = await itemsCollection.findOne(query);
            res.send(itemSearch);
        });


        // order adding
        app.post('/order/:email', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });

        // reviews adding
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        });

        //get all users
        app.get('/users', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // update profile data
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.send({ result, token });
        });

        // profiles app.get
        app.get('/profile', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const cursor = userCollection.find(query);
            const myProfile = await cursor.toArray();
            res.send(myProfile);
        });

        // get all orders
        app.get('/allorders', async (req, res) => {
            const orders = await orderCollection.find().toArray();
            res.send(orders);
        });

        // insert status to orders
        app.patch('/allorders/:id',async(req,res)=>{
            const id = req.params.id;
            const order = req.body;
            const filter = {_id: ObjectId(id)};
            const updateOrderStatus = {
                $set: {
                    status: true,
                }
            }
            const patchData =await orderCollection.updateOne(filter, updateOrderStatus);
            res.send(patchData);
        })

        // myOrders app.get email find
        app.get('/myorders', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const cursor = orderCollection.find(query);
            const myOrders = await cursor.toArray();
            res.send(myOrders);
        });

        app.get('/myorders/:id',async(req,res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await orderCollection.findOne(query);
            res.send(result);
        })


        // STRIPE PAYMENT
        app.post('/create-payment-intent', async(req, res) =>{
            const order = req.body;
            const price = order.totalCost;
            const amount = price*100;
            const paymentIntent = await stripe.paymentIntents.create({
              amount : amount,
              currency: 'usd',
              payment_method_types:['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
          });

        // store payment data to db
        app.patch('/myorders/:id',async(req,res)=>{
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updateNewDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const updateData =await orderCollection.updateOne(filter, updateNewDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updateData);
        })

        // deletion from my orders
        app.delete('/myorders/:id', async(req,res)=>{
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })

        // deletion of an item in items
        app.delete('/items/:id', async(req,res)=>{
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await itemsCollection.deleteOne(query);
            res.send(result);
        })


        // Adding A Product
        app.post('/items', async (req, res) => {
            const item = req.body;
            const result = await itemsCollection.insertOne(item);
            res.send(result);
        });
    }
    finally {

    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log('Listening to port', port);
})