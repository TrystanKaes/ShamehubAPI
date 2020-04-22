var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Insult = require('./Insults');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var Github = require('github-api');
var request = require('request');
var https = require('https');

var app = express();
module.exports = app; // for testing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.use(passport.initialize());

var router = express.Router();


function strMapToObj(strMap) {
    let obj = Object.create(null);
    for (let [k,v] of strMap) {
        // We don’t escape the key '__proto__'
        // which can cause problems on older engines
        obj[k] = v;
    }
    return obj;
}

function objToStrMap(obj) {
    let strMap = new Map();
    for (let k of Object.keys(obj)) {
        strMap.set(k, obj[k]);
    }
    return strMap;
}
//retrieves all information about a user, this is like initializing all the data of a user
function fetchAllUserData(username) {
    let dict = new Map();
    let repo_arr = [];
    let repo_n_commits = {
        repo_name: '',
        commit_msg: []
    };
    let repo_names = [];
    let commit_messages = [];
    let commit_dates = [];

    const xhr = new XMLHttpRequest();
    const name = new XMLHttpRequest();
    const commits = new XMLHttpRequest();


    let url = 'https://api.github.com/';
    let repo, commit;
    let profile_name, profile_bio, profile_img;

    // GET /repos/:owner/:repo/git/commits/:commit_sha
    // https://api.github.com/repos/xfrenchy/battleship/commits
    profile_name = url.concat("users/").concat(username);
    repo = url.concat("users/").concat(username).concat("/repos");

    //open requests
    xhr.open('GET', repo, false);
    name.open('GET', profile_name, false);

    xhr.send();
    name.send();

    const data = JSON.parse(xhr.responseText);
    const data1 = JSON.parse(name.responseText);

    for (let i in data) {
        repo_names.push(data[i].name);
    }

    //retrieve name, bio, and image url
    profile_name = data1['name'];
    profile_bio = data1['bio'];
    profile_img = data1['avatar_url'];

    let commit_url = "";

    //for loop to retrieve user repo and commits
    for (let i in repo_names){
        commit_url = url.concat("repos/").concat(username).concat("/",repo_names[i]).concat("/commits");
        commits.open("GET", commit_url, false);
        commits.send();
        let data2 = JSON.parse(commits.responseText);
        // Inner for loop, responsible for pushing all commits for each repo into the commit_messages array

        //Things to improve here:
        //-Get rid of commit_messages and push elements directly into JSON array
        repo_n_commits['repo_name'] = repo_names[i];
        for (let x in data2){
            commit_messages.push(data2[x].commit.message);
        }
        repo_n_commits['commit_msg'] = commit_messages;
        var jsonCopy = Object.assign({}, repo_n_commits);   //need to deep copy so that next changes don't affect previous JSON objects (immutable vs mutable change)
        commit_messages = [];   //emptying array
        repo_arr.push(jsonCopy);
    }

    dict.set("name_key", profile_name);
    dict.set("bio_key", profile_bio);
    dict.set("img_key", profile_img);
    dict.set("repo_info", repo_arr);

    JSONObj = new Object();
    JSONObj = strMapToObj(dict);


    return JSONObj;
}

//Updates a specific value of a user by calling githubs API to fetch the data that needs to be updated
router.route('/update/:github_user/:variable/:repo_name?')
    .get(function(req, res) {
        //First thing first, we want to map out which path we have to take,
        // are we updating info about the name/bio/image(profile), or are we updating repo and commits?

        //API call = 1
        if(req.params.variable === "profile" && req.params.github_user){
            //call API to retrieve profile info (API call = 1)
        }
        //API call = 2n
        else if(req.params.variable === "repo" && req.params.github_user){
            //call API to retrieve all repos for this user (API call = n)
            //We will also retrieve commits for any new repo (API call = n)
        }
        //API call = 1
        else if(req.params.variable === "commit" && req.params.github_user){
            //call API on that specific repo to fetch all existing commits
            if(!req.params.repo_name){
                res.status(400).send({success: false, msg: "Please specify the repo name. Example: '/update/TrystanKaes/commit/ShamehubAPI'"})
            }
        }
        else{
            res.status(400).send({success: false, msg: "Could not understand what to update and/or for who.\n " +
                    "Please specify if it's 'profile', 'repo', or 'commit'. Ex: '/update/xFrenchy/profile'"})
        }




            let git_user = req.params.gitUser;
            if (!req.params.gitUser) {
                res.json({success: false, message: 'Please pass a Github username!'});
            } else {
                let dict = new Map();
                let repo_arr = [];
                let repo_n_commits = {
                    repo_name: '',
                    commit_msg: []
                };
                let repo_names = [];
                let commit_messages = [];
                let commit_dates = [];

                const xhr = new XMLHttpRequest();
                const name = new XMLHttpRequest();
                const commits = new XMLHttpRequest();


                let url = 'https://api.github.com/';
                let repo, commit;
                let profile_name, profile_bio, profile_img;

                // GET /repos/:owner/:repo/git/commits/:commit_sha
                // https://api.github.com/repos/xfrenchy/battleship/commits
                profile_name = url.concat(git_user);
                repo = url.concat("users/").concat(git_user).concat("/repos");

                //open requests
                xhr.open('GET', repo, false);
                name.open('GET', profile_name, false);

                xhr.send();
                name.send();

                const data = JSON.parse(xhr.responseText)
                const data1 = JSON.parse(name.responseText);

                for (let i in data) {
                    repo_names.push(data[i].name);
                }

                let commit_url = "";
                for (let i in repo_names){
                    commit_url = url.concat("repos/").concat(git_user).concat("/",repo_names[i]).concat("/commits");
                    commits.open("GET", commit_url, false);
                    commits.send();
                    let data2 = JSON.parse(commits.responseText);
                    // Inner for loop, responsible for pushing all commits for each repo into the commit_messages array

                    //Things to improve here:
                    //-Get rid of commit_messages and push elements directly into JSON array
                    repo_n_commits['repo_name'] = repo_names[i];
                    for (let x in data2){
                        commit_messages.push(data2[x].commit.message);
                    }
                    repo_n_commits['commit_msg'] = commit_messages;
                    var jsonCopy = Object.assign({}, repo_n_commits);   //need to deep copy so that next changes don't affect previous JSON objects (immutable vs mutable change)
                    commit_messages = [];   //emptying array
                    repo_arr.push(jsonCopy);
                }

                for (let key in data1){
                    if(key == "name") {
                        profile_name = data1[key];
                    }else if(key == "bio"){
                        profile_bio = data1[key];
                    }else if(key == "avatar_url"){
                        profile_img = data1[key];
                    }
                }

                dict.set("name_key", profile_name);
                dict.set("bio_key", profile_bio);
                dict.set("img_key", profile_img);
                dict.set("repo_info", repo_arr);
                // dict.set("repo_key", repo_names);
                // dict.set("commits_key", commit_messages);

                JSONObj = new Object();
                JSONObj = strMapToObj(dict);


                res.json({success: true, message: JSONObj});
            }
        }
    );

router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:username')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var username = req.params.username
        User.findOne({ username: username }).exec(function(err, user) {
            if (err) res.send(err);
                res.send(user._doc);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password || !req.body.github_username) {
        res.json({success: false, message: 'Please pass github username, username, and password.'});
    }
    else {
        var user = new User();
        //retrieve all github information about this specific user
        var jsonInfo = fetchAllUserData(req.body.github_username);
        user.name = jsonInfo['name_key'];
        user.username = req.body.username;
        user.password = req.body.password;
        user.github_username = req.body.github_username;
        user.profile_img = jsonInfo['img_key'];
        user.github_link = "https://github.com/" + req.body.github_username;
        user.bio = jsonInfo['bio_key'];
        user.new_repo_info = null;
        user.repo_info = jsonInfo['repo_info'];
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.status(400).send({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.route('/insults/:category')
    .get(function(req, res) {
        var insult = new Insult()
        insult.category = req.params.category;
        Insult.aggregate([{ $match: { category: req.params.category } }, { $sample: { size: 1 } }]).exec(function (err, insult) {
            if (insult[0]){
                res.status(200).send({msg: "get random insult", insult: insult[0]})
            }
            else res.status(400).send({msg: "no insults exist for this category"})
        })
    })

router.route('/insults')
    .get(function (req, res) {
        if (req.body.category){
            var insult = new Insult()
            insult.category = req.body.category;
            Insult.aggregate([{ $match: { category: req.body.category } }, { $sample: { size: 1 } }]).exec(function (err, insult) {
                if (insult[0]){
                    res.status(200).send({msg: "get random insult", insult: insult[0]})
                }
                else res.status(400).send({msg: "no insults exist for this category"})
            })
        }
        else {
            Insult.find().select('insult category').exec(function (err, insults) {
                if (err) res.send(err);
                res.status(200).send({msg: "GET insults", insults: insults});
            })
        }
    })
    .post(function (req, res) {
        console.log("called post function");
        var insult = new Insult();
        insult.insult = req.body.insult;
        insult.category = req.body.category;
        insult.save(function(err) {
            if (err) {
                // duplicate entry
                console.log("called save function");
                if (err.code == 11000)
                    return res.status(400).json({ success: false, message: 'That exact insult already exists'});
                else
                    return res.status(400).send(err);
            }
            res.json({ success: true, message: 'Insult created!' });
        });
    });

router.post('/signin', function(req, res) {
        var userNew = new User();
        userNew.name = req.body.name;
        userNew.username = req.body.username;
        userNew.password = req.body.password;

        User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
            if (err) res.send(err);
            if (user){
                user.comparePassword(userNew.password, function(isMatch){
                    if (isMatch) {
                        var userToken = {id: user._id, username: user.username};
                        var token = jwt.sign(userToken, process.env.SECRET_KEY);
                        res.json({success: true, token: 'JWT ' + token});
                    }
                    else {
                        res.status(401).send({success: false, message: 'incorrect-password'});
                    }
                });
            }
            else
                res.status(401).send({success: false, message: 'username-not-found'})
        });
    });



app.use('/', router);
app.listen(process.env.PORT || 8080);
