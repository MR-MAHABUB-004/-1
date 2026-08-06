"use strict";

/**
 * core/database.js
 * MongoDB Atlas database — drop-in replacement for the JSON database.
 * Same API: .get() .set() .update() .create() .delete() .getAll() .getOrCreate()
 *
 * Setup:
 *   1. Go to https://cloud.mongodb.com → free M0 cluster
 *   2. Create a database user + get your connection string
 *   3. Add to config.json:  "mongoUri": "mongodb+srv://user:pass@cluster.mongodb.net/goatbot"
 */

const mongoose = require("mongoose");
const log      = require("../logger/log.js");
const config   = require("../config.json");

// ── CONNECTION ────────────────────────────────────────────────────────────────
let _connected = false;

mongoose.set("strictQuery", false); // suppress Mongoose 7 deprecation warning

async function connect() {
  if (_connected) return;
  if (!config.mongoUri) {
    log.error("DB", "mongoUri is missing in config.json — database disabled");
    return;
  }
  try {
    await mongoose.connect(config.mongoUri, {
      dbName: config.dbName || "goatbot",
    });
    _connected = true;
    log.success("DB", "Connected to MongoDB Atlas");
  } catch (e) {
    log.error("DB", `MongoDB connection failed: ${e.message}`);
  }
}

connect();

// ── GENERIC SCHEMA ────────────────────────────────────────────────────────────
// One collection per model, each document is { id, ...data }
function makeModel(collectionName) {
  const schema = new mongoose.Schema(
    {
      id:   { type: String, required: true, unique: true },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    {
      collection:  collectionName,
      strict:      false,   // allow any fields
      timestamps:  true,
    }
  );

  // Avoid OverwriteModelError on hot-reload
  return mongoose.models[collectionName] ||
         mongoose.model(collectionName, schema);
}

// ── MODEL FACTORY ─────────────────────────────────────────────────────────────
function createModel(collectionName, defaultRecord = {}) {
  const Model = makeModel(collectionName);

  return {
    // ── get ────────────────────────────────────────────────────────────────
    async get(id) {
      try {
        const doc = await Model.findOne({ id: String(id) }).lean();
        if (!doc) return null;
        const { _id, __v, createdAt, updatedAt, ...rest } = doc;
        return rest;
      } catch (e) {
        log.error(collectionName, `get(${id}): ${e.message}`);
        return null;
      }
    },

    // ── getOrCreate ────────────────────────────────────────────────────────
    async getOrCreate(id, defaults = {}) {
      try {
        const key = String(id);
        const doc = await Model.findOneAndUpdate(
          { id: key },
          { $setOnInsert: { id: key, ...defaultRecord, ...defaults } },
          { upsert: true, new: true, lean: true }
        );
        const { _id, __v, createdAt, updatedAt, ...rest } = doc;
        return rest;
      } catch (e) {
        log.error(collectionName, `getOrCreate(${id}): ${e.message}`);
        return { id: String(id), ...defaultRecord, ...defaults };
      }
    },

    // ── create ─────────────────────────────────────────────────────────────
    async create(id, extra = {}) {
      try {
        const key = String(id);
        await Model.findOneAndUpdate(
          { id: key },
          { id: key, ...defaultRecord, ...extra },
          { upsert: true, new: true }
        );
        return this.get(key);
      } catch (e) {
        log.error(collectionName, `create(${id}): ${e.message}`);
        return null;
      }
    },

    // ── set (single key) ───────────────────────────────────────────────────
    async set(id, key, value) {
      try {
        const key_ = String(id);
        await Model.findOneAndUpdate(
          { id: key_ },
          { $set: { [key]: value } },
          { upsert: true, new: true }
        );
        return this.get(key_);
      } catch (e) {
        log.error(collectionName, `set(${id}, ${key}): ${e.message}`);
        return null;
      }
    },

    // ── update (multiple keys) ─────────────────────────────────────────────
    async update(id, updates = {}) {
      try {
        const key = String(id);
        await Model.findOneAndUpdate(
          { id: key },
          { $set: updates },
          { upsert: true, new: true }
        );
        return this.get(key);
      } catch (e) {
        log.error(collectionName, `update(${id}): ${e.message}`);
        return null;
      }
    },

    // ── delete ─────────────────────────────────────────────────────────────
    async delete(id) {
      try {
        await Model.deleteOne({ id: String(id) });
      } catch (e) {
        log.error(collectionName, `delete(${id}): ${e.message}`);
      }
    },

    // ── has ────────────────────────────────────────────────────────────────
    async has(id) {
      try {
        return !!(await Model.exists({ id: String(id) }));
      } catch { return false; }
    },

    // ── count ──────────────────────────────────────────────────────────────
    async count() {
      try { return await Model.countDocuments(); }
      catch { return 0; }
    },

    // ── getAll ─────────────────────────────────────────────────────────────
    // Returns plain object { id: record } — same shape as JSON database
    async getAll() {
      try {
        const docs = await Model.find({}).lean();
        const result = {};
        for (const doc of docs) {
          const { _id, __v, createdAt, updatedAt, ...rest } = doc;
          result[rest.id] = rest;
        }
        return result;
      } catch (e) {
        log.error(collectionName, `getAll(): ${e.message}`);
        return {};
      }
    },
  };
}

// ── MODELS ────────────────────────────────────────────────────────────────────
const threadsData   = createModel("threads",   { prefix: null, language: "en", adminOnly: false, disabledCmds: [], welcomeMsg: null, leaveMsg: null, data: {} });
const usersData     = createModel("users",     { exp: 0, money: 0, name: "", messageCount: 0, data: {} });
const globalData    = createModel("global",    { value: null, data: {} });
const dashboardData = createModel("dashboard", {});

module.exports = { threadsData, usersData, globalData, dashboardData, connect };
