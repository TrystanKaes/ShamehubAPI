var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.Promise = global.Promise
mongoose.connect(process.env.DB, {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);

var CommitSchema = new Schema({

    repo_name: {type: String, required: true},
    github_username: {type: String, required: true},
    author_name: {type: String, required: true},
    message: {type: String, required: true},
    date_time: {type: Date, required: true},
    likes: {type: Number, required: true},
    dislikes: {type: Number, required: true}

});

// return the model
module.exports = mongoose.model('Commits', CommitSchema, 'commits');