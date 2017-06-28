const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!',
  },
  slug: String,
  description: {
    type: String,
    trim: true,
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      default: 'Point',
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!',
    }],
    address: {
      type: String,
      required: 'You must supply an address!',
    },
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author!',
  }
}, { // options
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define our indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop running
  }
  this.slug = slug(this.name);
  // find other stores with same slug
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

// EXTRA: prevent people to use html or javaScript in the input fields. Filter those out before saving (use a pre('save') again);

storeSchema.statics.getTagsList = function () {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

storeSchema.statics.getTopStores = function () {
  return this.aggregate([
    // 1. Look up stores and populate reviews
    { $lookup: { from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews' } },
    // 2. filter for only items that have 2 (where reviews[1] exists) or more reviews
    { $match: { 'reviews.1': { $exists: true } } },
    // 3. Add average reviews field
    { $project: {
      photo: '$$ROOT.photo',
      name: '$$ROOT.name',
      reviews: '$$ROOT.reviews',
      slug: '$$ROOT.slug',
      averageRating: { $avg: '$reviews.rating' }
    } },
    // 4. sort by avg rating (highest first)
    { $sort: { averageRating: -1 } },
    // 5. limit to at most 10 stores
    { $limit: 10 }
  ]);
};

// Find stores where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store
  foreignField: 'store' // which field on the review?
});

function autoPopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);

module.exports = mongoose.model('Store', storeSchema);
