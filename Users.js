var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
require('dotenv').config({ path: '.env' });

mongoose.Promise = global.Promise;

//put in environment file (or variable on heroku)
mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);

// user schema
//TODO add an array of commits that the user has chosen to show for his/her profile
// questions, should it be an array of commits, or a JSON object for more details about the commits
var UserSchema = new Schema({
    name: String,
    username: { type: String, required: true, index: { unique: true }},
    password: { type: String, required: true, select: false },
    github_username: {type: String, required: true, unique: true},
    profile_img: {type: String, required: false},
    github_link: {type: String, required: false},
    bio: {type: String, required: false},
    new_repo_info: {type: JSON, required: false},
    repo_info: {type: JSON, required: false},
    fe_repo_info: {type: JSON, required: false}
});

// hash the password before the user is saved
UserSchema.pre('save', function(next) {
    var user = this;

    // hash the password only if the password has been changed or user is new
    if (!user.isModified('password')) return next();

    // generate the hash
    bcrypt.hash(user.password, null, null, function(err, hash) {
        if (err) return next(err);

        // change the password to the hashed version
        user.password = hash;
        next();
    });
});

UserSchema.methods.comparePassword = function(password, callback) {
    var user = this;

    bcrypt.compare(password, user.password, function(err, isMatch) {
       callback(isMatch) ;
    });
};

// return the model
module.exports = mongoose.model('User', UserSchema);