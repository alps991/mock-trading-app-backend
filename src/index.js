const express = require('express');
const moment = require('moment');
const cors = require('cors');
require('dotenv').config()
const { db } = require('./firebase/firebase');
const { calculateTotalValue } = require('./resolveTick');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send(`Welcome to the root of the api`);
});

app.get('/api/curPrices', async (req, res) => {
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

app.get('/api/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userRes = await db.ref(`users/${id}`).once('value');
        const user = userRes.val();
        if (user) {
            const coinsRes = await db.ref(`coins`).once('value');
            const coins = coinsRes.val();
            const { totalValue } = user;

            const userBalances = [];
            for (let coin of Object.keys(user.balances)) {
                const balance = user.balances[coin];
                let curPrice = coins.cur[coin];
                const value = Math.round(balance * curPrice * 100) / 100;
                const percentage = Math.round(value / totalValue * 100 * 10) / 10;
                userBalances.push({
                    symbol: coin,
                    balance: user.balances[coin],
                    value,
                    percentage,
                });
            }

            return res.status(200).send({
                balances: userBalances,
                totalValue
            });
        }

        return res.status(204).send();

    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
})

app.post('/api/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userRes = await db.ref(`users/${id}/balances`).once('value');
        const user = userRes.val();
        if (user) {
            return res.status(400).send({ error: "User already exists" });
        }

        const defaultValues = {
            balances: {
                USD: 1000,
                BTC: 0,
                ETH: 0,
                LTC: 0,
            }, totalValue: 1000
        };

        await db.ref(`users/${id}`).set(defaultValues);

        const userBalances = [];
        for (let coin of Object.keys(defaultValues.balances)) {
            userBalances.push({
                symbol: coin,
                balance: defaultValues.balances[coin],
            });
        }

        res.status(201).send({
            balances: userBalances,
            totalValue: 1000,
        });

    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

app.patch('/api/users/:id', async (req, res) => {
    try {
        const updates = req.body;
        const userId = req.params.id;
        if (balances in updates) {
            const coinRes = await db.ref(`coins/cur`).once('value');
            const coinPrices = coinRes.val();
            updates.totalValue = calculateTotalValue(coinPrices, updates.balances);
        }
        await db.ref(`users/${userId}`).update(updates);
        const userRes = await db.ref(`users/${userId}`).once('value');
        res.status(200).send(userRes.val());
    } catch (err) {
        console.log(err);
    }
});

app.post('/api/trades/marketTrade', async (req, res) => {
    try {
        const { currencyToSell, quantityToSell, currencyToBuy, uid } = req.body;
        const coinRes = await db.ref(`coins/cur`).once('value');
        const coinPrices = coinRes.val();
        if (!(currencyToSell in coinPrices) || !(currencyToBuy in coinPrices)) {
            return res.status(400).send({ error: "Invalid currency code" });
        }

        const userRes = await db.ref(`users/${uid}`).once('value');
        const user = userRes.val();
        if (user.balances[currencyToSell] < quantityToSell) {
            return res.status(400).send({ error: "Insufficient balance" });
        }

        let quantityToBuy = (coinPrices[currencyToSell] * quantityToSell) / coinPrices[currencyToBuy];

        user.balances[currencyToSell] -= quantityToSell;
        user.balances[currencyToBuy] += quantityToBuy;

        if (currencyToBuy == "USD") {
            user.balances[currencyToBuy] = Math.round(user.balances[currencyToBuy] * 100) / 100;
        } else {
            user.balances[currencyToBuy] = Math.round(user.balances[currencyToBuy] * 100000000) / 100000000;
        }

        if (currencyToSell == "USD") {
            user.balances[currencyToSell] = Math.round(user.balances[currencyToSell] * 100) / 100;
        } else {
            user.balances[currencyToSell] = Math.round(user.balances[currencyToSell] * 100000000) / 100000000;
        }

        const newTrade = {
            currencyToSell,
            currencyToBuy,
            quantityToSell,
            quantityToBuy,
            boughtCurrencyPrice: coinPrices[currencyToBuy],
            soldCurrencyPrice: coinPrices[currencyToSell],
            ts: moment().format(),
            type: 'market',
            uid,
        }

        const newTradeKey = db.ref(`closedTrades`).push().key;
        const updates = {};
        updates[`/trades/${newTradeKey}`] = newTrade;
        updates[`/users/${uid}/balances`] = user.balances;
        updates[`/users/${uid}/tradeHistory/${newTradeKey}`] = true;

        await db.ref().update(updates);

        const newUserBalances = [];
        for (let coin of Object.keys(user.balances)) {
            const balance = user.balances[coin];
            let curPrice = coinPrices[coin];
            const value = Math.round(balance * curPrice * 100) / 100;
            const percentage = Math.round(value / user.totalValue * 100 * 10) / 10;
            newUserBalances.push({
                symbol: coin,
                balance,
                value,
                percentage,
            });
        }

        res.status(201).send({ newTrade, newUserBalances });

    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log("app is running");
});