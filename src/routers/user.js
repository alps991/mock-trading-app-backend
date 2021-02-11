const express = require('express');
const { calculateTotalValue } = require('../resolveTick');
const { db } = require('../firebase/firebase');
const { balancesObjToArray, lockedBalancesObjToArray } = require('../utils/utils');
const router = express.Router();

router.get('/api/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userRes = await db.ref(`users/${id}`).once('value');
        const user = userRes.val();
        if (user) {
            const coinsRes = await db.ref(`coins`).once('value');
            const coins = coinsRes.val();
            const { totalValue } = user;

            const balancesArray = balancesObjToArray(user.balances, coins.cur, totalValue);
            const lockedBalancesArray = lockedBalancesObjToArray(user.lockedBalances);

            return res.status(200).send({
                balancesArray,
                lockedBalancesArray,
                user
            });
        }

        return res.status(204).send();

    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
})

router.post('/api/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userRes = await db.ref(`users/${id}/balances`).once('value');
        const user = userRes.val();
        if (user) {
            return res.status(400).send({ error: "User already exists" });
        }

        const defaultValues = {
            balances: {
                USD: 10000,
                BTC: 0,
                ETH: 0,
                LTC: 0,
            },
            lockedBalances: {
                USD: 0,
                BTC: 0,
                ETH: 0,
                LTC: 0,
            }, totalValue: 10000
        };

        await db.ref(`users/${id}`).set(defaultValues);

        const coins = { USD: 1 }

        const balancesArray = balancesObjToArray(defaultValues.balances, coins, 10000);
        const lockedBalancesArray = lockedBalancesObjToArray(defaultValues.lockedBalances);

        res.status(201).send({
            balancesArray,
            lockedBalancesArray,
            user: defaultValues,
        });

    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

router.patch('/api/users/:id', async (req, res) => {
    try {
        const updates = req.body;
        const uid = req.params.id;
        if (balances in updates) {
            const coinRes = await db.ref(`coins/cur`).once('value');
            const coinPrices = coinRes.val();
            updates.totalValue = calculateTotalValue(coinPrices, updates.balances);
        }
        await db.ref(`users/${uid}`).update(updates);
        const userRes = await db.ref(`users/${uid}`).once('value');
        res.status(200).send(userRes.val());
    } catch (err) {
        console.log(err);
    }
});

router.get('/api/users/:id/trades/:tradeType', async (req, res) => {
    try {
        const uid = req.params.id;
        const tradeType = req.params.tradeType;

        if (tradeType != "openTrades" && tradeType != "closedTrades") {
            return res.status(400).send("Invalid trade type");
        }

        const tradesRes = await db.ref(`users/${uid}/${tradeType}`).once('value');
        const trades = tradesRes.val();
        if (!trades) {
            return res.send([]);
        }
        const tradesArray = [];
        for (let tradeId of Object.keys(trades)) {
            const tradeRes = await db.ref(`trades/${tradeType}/${tradeId}`).once('value');
            const trade = tradeRes.val();
            trade.tradeId = tradeId;
            tradesArray.push(trade);
        }
        res.send(tradesArray);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

module.exports = router;