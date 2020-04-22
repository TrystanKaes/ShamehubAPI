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
//retrieves all information about the users profile such as name, bio, picture, and returns it
function fetchProfileData(username){
    //create XMLHttp object
    const profile = new XMLHttpRequest();
    //create path for request
    let profile_path = 'https://api.github.com/users/'.concat(username);
    //open request
    profile.open('GET', profile_path, false);
    //send request
    profile.send();
    //parse response
    const data = JSON.parse(profile.responseText);
    //retrieve name, bio, and image url
    let profile_name = data['name'];
    let profile_bio = data['bio'];
    let profile_img = data['avatar_url'];
    //return JSON
    let dict = new Map();
    dict.set("name_key", profile_name);
    dict.set("bio_key", profile_bio);
    dict.set("img_key", profile_img);
    JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    return JSONObj;
}
//retrieves all commits from a specific repo of a specific user and returns it
function fetchCommitData(username, repo_name, current_commits){
    //create XMLHttp object
    const commits = new XMLHttpRequest();
    //create path for request
    let commit_path = 'https://api.github.com/repos/'.concat(username).concat('/', repo_name).concat('/commits');
    //open request
    commits.open('GET', commit_path, false);
    //send request
    commits.send();
    //parse response
    const data = JSON.parse(commits.responseText);
    //retrieve commit messages
    let commit_messages = [];
    let recent_commits = [];
    let repo_n_commits = {
        repo_name: repo_name,
        commit_msg: [],
        new_commits: []
    };
    for (let x in data){
        commit_messages.push(data[x].commit.message);
    }
    //Figure out if there has been any new commits
    if(commit_messages.length > current_commits.length){
        //new commits detected, this must mean that commit messages must have a longer length
        let difference = commit_messages.length - current_commits.length;
        for(let i = 0; i < difference; ++i){
            //the first index is the most recent message
            recent_commits.push(commit_messages[i]);
        }
    }
    else{
        //nothing new
        recent_commits = null;
    }
    //update JSON
    repo_n_commits['commit_msg'] = commit_messages;
    repo_n_commits['new_commits'] = {repo_name: repo_name, commit_msg: recent_commits};
    //return JSON
    return repo_n_commits;
}

//TODO return user info after it's been updated instead of just a message saying it was successful
//Updates a specific value of a user by calling githubs API to fetch the data that needs to be updated
router.route('/update/:github_user/:variable/:repo_name?')
    .get(function(req, res) {
        //First thing first, we want to map out which path we have to take,
        // are we updating info about the name/bio/image(profile), or are we updating repo and commits?

        //API call = 1
        if (req.params.variable === "profile" && req.params.github_user) {
            //Find user in DB
            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //call API to retrieve profile info (API call = 1)
                    let jsonResult = fetchProfileData(req.params.github_user);
                    //try to update the user
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                name: jsonResult['name_key'],
                                profile_img: jsonResult['img_key'], bio: jsonResult['bio_key']
                            }
                        }).exec(function(err, result){
                            res.status(200).send({success: true, msg: 'User profile has been updated!'});
                        });
                    } catch (e) {
                        print(e);
                    }
                } else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        }
        //API call = 2n
        else if (req.params.variable === "repo" && req.params.github_user) {
            //call API to retrieve all repos for this user (API call = n)
            //We will also retrieve commits for any new repo (API call = n)

            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //TODO implement this
                    //call API to retrieve repo and commit info (API call = 2n)

                    /*let jsonResult = fetchProfileData(req.params.github_user);
                    try to update the user
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                name: jsonResult['name_key'],
                                profile_img: jsonResult['img_key'], bio: jsonResult['bio_key']
                            }
                        }).exec(function(err, result){
                            console.log(result);
                            res.status(200).send({success: true, msg: 'User profile has been updated!'});
                        });
                    } catch (e) {
                        print(e);
                    }*/
                } else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        }
        //API call = 1
        else if (req.params.variable === "commit" && req.params.github_user) {
            //call API on that specific repo to fetch all existing commits
            if (!req.params.repo_name) {
                res.status(400).send({
                    success: false,
                    msg: "Please specify the repo name. Example: '/update/TrystanKaes/commit/ShamehubAPI'"
                })
            }

            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //TODO implement this
                    //call API to retrieve commits of specific repo (API call = 1)

                    //Get the current repo_info field
                    let current_repo_field = user._doc.repo_info.slice();  //deep copy for immutable change later on
                    //Get the current commit history of that specific repo from our Database
                    let specific_commit = [];
                    let index = 0;
                    for(let i = 0; i < current_repo_field.length; ++i){
                        if(current_repo_field[i]['repo_name'] === req.params.repo_name){
                            specific_commit = current_repo_field[i]['commit_msg'];
                            index = i;
                            break;
                        }
                    }
                    let jsonResult = fetchCommitData(req.params.github_user, req.params.repo_name, specific_commit);
                    //update our commit history for that repo
                    current_repo_field[index]['commit_msg'] = jsonResult['commit_msg'];
                    //try to update the user repo info
                    //TODO get the $ifNull working
                    // (https://docs.mongodb.com/manual/reference/operator/aggregation/ifNull/)
                    // (https://docs.mongodb.com/manual/reference/method/db.collection.updateOne/)
                    if(jsonResult['new_commits']['commit_msg'] != null){
                        try {
                            User.updateOne({github_username: req.params.github_user}, {
                                $set: {
                                    repo_info: current_repo_field,
                                    new_repo_info: jsonResult['new_commits']
                                    //new_repo_info: {$ifNull: [jsonResult['new_commits']['commit_msg'] , null] }
                                }
                            }).exec(function(err, result){
                                res.status(200).send({success: true, msg: 'User commits for ' +req.params.repo_name + ' has been updated!'});
                            });
                        } catch (e) {
                            print(e);
                        }
                    }
                    else{
                        try {
                            User.updateOne({github_username: req.params.github_user}, {
                                $set: {
                                    repo_info: current_repo_field,
                                    new_repo_info: null
                                }
                            }).exec(function(err, result){
                                res.status(200).send({success: 'not really', msg: 'Nothing to update for ' +req.params.repo_name + '!'});
                            });
                        } catch (e) {
                            print(e);
                        }
                    }

                } else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        } else {
            res.status(400).send({
                success: false, msg: "Could not understand what to update and/or for who.\n " +
                    "Please specify if it's 'profile', 'repo', or 'commit'. Ex: '/update/xFrenchy/profile'"
            })
        }
    });

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
