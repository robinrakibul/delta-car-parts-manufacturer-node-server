const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
const { query } = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

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
        await client.connect();
        // collection in mongodb
        const itemsCollection = client.db('carParts').collection('items');
        const reviewsCollection = client.db('carParts').collection('reviews');

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
        app.post('/login', async(req, res)=>{
            const user = req.body;
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{
                expiresIn: '1d'
            });
            res.send({accessToken});
        })

    }
    finally {

    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log('Listening to port', port);
})