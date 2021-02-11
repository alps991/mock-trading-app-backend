const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { db } = require('./firebase/firebase');
const tradesRouter = require('./routers/trades');
const userRouter = require('./routers/user');

const app = express();
app.use(cors());
app.use(express.json());
app.use(tradesRouter);
app.use(userRouter);

app.get('/', (req, res) => {
    res.send(`Welcome to the root of the api`);
});

app.get('/api/coins/curPrices', async (req, res) => {
    try {
        const coinRes = await db.ref(`coins/cur`).once('value');
        const coins = coinRes.val();
        const curPrices = [];
        for (let coin of Object.keys(coins)) {
            curPrices.push({ symbol: coin, curPrice: coins[coin] });
        }

        res.send(curPrices);

    } catch (err) {
        res.status(500).send();
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log("app is running");
});