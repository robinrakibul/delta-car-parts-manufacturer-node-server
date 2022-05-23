const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
const { query } = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

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
                return res.status(401).send({ message: 'Unauthorized Access!' })
            }
            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).send({ message: 'Forbidden access' });
                }
            })
            next();
        }

        await client.connect();
        // collection in mongodb
        const itemsCollection = client.db('carParts').collection('items');
        const reviewsCollection = client.db('carParts').collection('reviews');
        const userCollection = client.db('carParts').collection('users');

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
        app.post('/login', async (req, res) => {
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

        // searchId Items
        app.get('/items/:id', async(req, res) =>{
            const id = req.params.id;
            const query={_id: ObjectId(id)};
            const itemSearch = await itemsCollection.findOne(query);
            res.send(itemSearch);
        });
    }
    finally {

    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log('Listening to port', port);
})