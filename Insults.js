var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

//put in environment file (or variable on heroku)
mongoose.connect(process.env.DB, { useNewUrlParser: true } );
mongoose.set('useCreateIndex', true);

var InsultSchema = new Schema({
    insult: { type: String, required: true, index: { unique: true } },
    category: { type: String, required: true }
});

// return the model
module.exports = mongoose.model('Insults', InsultSchema, 'insults');