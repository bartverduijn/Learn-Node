const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const jimp = require('jimp');
const uuid = require('uuid');
const multer = require('multer');
const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true); // first value is error, second success
    } else {
      next({ message: 'That filetype isn\'t allowed!' }, false);
    }
  },
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // 1. if there is no new file to resize, skip this step
  if (!req.file) {
    next();
    return;
  }
  // 2. rename the photo with a unique id
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  // 3. resize the image
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // 4. once we have written the photo to our filesystem, go to the next middleware
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  // save also in store to generate slug
  const store = await (new Store(req.body)).save();
  req.flash('success', `Succesfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;

  // 1. Query database for list of al stores
  const storesPromise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc' });
  const countPromise = Store.count();
  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit); // ceil is oppossite of floor

  if (!stores.length && skip) {
    req.flash('info', `Hey! You asked for page ${page}, but that one doesn't exist. So I put you on page ${pages}!`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it!');
  }
};

exports.editStore = async (req, res) => {
  // 1. Find store given the id
  const store = await Store.findOne({ _id: req.params.id });
  // 2. Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. Render out edit form
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  //  0. Set the location data to be a point
  req.body.location.type = 'Point';
  // 1. find and update store
  // findOneAndUpdate(query, what to update, options)
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return the new store instead of the old one
    runValidators: true, // run required validators in our model. Default value is false
  }).exec();
  // 2. redirect them to stort and tell user it worked
  req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store</a>`);
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
  // if no store is found, kick in de errorhandling and send a 404
  if (!store) {
    next();
    return;
  }
  res.render('store', { title: store.name, store });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag; // put slug in this variable and pass it through

  const tagQuery = tag || { $exists: true }; // if not filtered on tag, show all
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tag', { title: 'Tags', tags, tag, stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store
  // 1. Find stores
  .find({
    $text: {
      $search: req.query.q // search in things that were indexed as text (name and description)
    }
  }, {
    score: { $meta: 'textScore' } // calculate relevance based on frequency query
  })
  // 2. sort them
  .sort({
    score: { $meta: 'textScore' } // and sort based on these values
  })
  // 3. limit to only 5 results
  .limit(5);

  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 // 10km
      }
    }
  };

  const stores = await Store
    .find(q)
    .select('slug name description location photo') // take only what we need.
    .limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  // if the id is already in the map array, delete it, otherwise add it
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User.findByIdAndUpdate(
      req.user._id,
      { [operator]: { hearts: req.params.id } },
      { new: true }
  );

  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts }
  });
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { title: 'Top Stores', stores });
};
