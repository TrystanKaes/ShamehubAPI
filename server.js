var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Insult = require('./Insults');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var btoa = require('btoa');
require('dotenv').config({ path: '.env' });
//var Github = require('github-api');
//var request = require('request');
//var https = require('https');

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
//TODO optimize and make code look pretty
//retrieves all information about a user, this is like initializing all the data of a user
function fetchAllUserData(username) {
    //create requests that we will be sending eventually
    const repo = new XMLHttpRequest();
    const profile = new XMLHttpRequest();
    const commits = new XMLHttpRequest();

    let url = 'https://api.github.com/';
    let profile_bio, profile_img;

    // GET /repos/:owner/:repo/git/commits/:commit_sha
    // https://api.github.com/repos/xFrenchy/Battleship/commits
    let profile_name = url.concat("users/").concat(username);
    let repo_path = url.concat("users/").concat(username).concat("/repos");

    //open requests
    repo.open('GET', repo_path, false);
    profile.open('GET', profile_name, false);
    //set authentication for open requests
    repo.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    profile.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send requests
    repo.send();
    profile.send();

    const repo_data = JSON.parse(repo.responseText);
    const profile_data = JSON.parse(profile.responseText);

    //retrieve name, bio, and image url
    profile_name = profile_data['name'];
    profile_bio = profile_data['bio'];
    profile_img = profile_data['avatar_url'];

    //JSON to store repos and commits
    let repo_info = {
        repo_names: [],
        posts: []
    };
    let commit_info = {
        commit_msg: '',
        commit_date: '',
        repo_name: '',
        author_name: '',
        login_name: ''
    };

    let repo_names = [];
    for (let i in repo_data) {
        repo_names.push(repo_data[i].name);
        repo_info['repo_names'].push(repo_data[i].name);
    }

    //for loop to retrieve commits from all repos of the user
    for (let i in repo_names){
        let commit_url = url.concat("repos/").concat(username).concat("/",repo_names[i]).concat("/commits");
        commits.open("GET", commit_url, false);
        commits.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
        commits.send();
        let commit_data = JSON.parse(commits.responseText);
        // Inner for loop, responsible for pushing all commits for each repo into the commit_messages array

        //Things to improve here:
        //-Get rid of commit_messages and push elements directly into JSON array
        for (let x in commit_data){
            commit_info['commit_msg'] = commit_data[x].commit.message;
            commit_info['commit_date'] = commit_data[x].commit.author.date;
            commit_info['repo_name'] = repo_names[i];
            commit_info['author_name'] = commit_data[x].commit.author.name;
            commit_info['login_name'] = commit_data[x].author.login;
            let jsonCopy2 = Object.assign({}, commit_info); //need to deep copy so that next changes don't affect previous JSON objects (immutable vs mutable change)
            repo_info['posts'].push(jsonCopy2);
        }
    }

    //map it all for the purpose of creating a new JSON object
    let dict = new Map();
    dict.set("name_key", profile_name);
    dict.set("bio_key", profile_bio);
    dict.set("img_key", profile_img);
    dict.set("repo_info", repo_info);
    //create new json object with dict keys
    let JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    //return our JSON
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
    profile.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
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
    commits.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send request
    commits.send();
    //parse response
    const commit_data = JSON.parse(commits.responseText);
    //JSON to store commits
    let posts = [];
    let new_commits = [];
    let commit_info = {
        commit_msg: '',
        commit_date: '',
        repo_name: '',
        author_name: '',
        login_name: ''
    };

    //retrieve commit messages
    for (let x in commit_data){
        commit_info['commit_msg'] = commit_data[x].commit.message;
        commit_info['commit_date'] = commit_data[x].commit.author.date;
        commit_info['repo_name'] = repo_name;
        commit_info['author_name'] = commit_data[x].commit.author.name;
        commit_info['login_name'] = commit_data[x].author.login;
        let jsonCopy2 = Object.assign({}, commit_info);
        posts.push(jsonCopy2);
    }

    //Figure out if there has been any new commits by checking if this commit exists
    for(let i = 0; i < posts.length; ++i){
        //That's a chunky if statement woo
        // https://stackoverflow.com/questions/8217419/how-to-determine-if-javascript-array-contains-an-object-with-an-attribute-that-e/8217584#8217584
        if(!current_commits.some(e => e.commit_msg === posts[i].commit_msg && e.commit_date === posts[i].commit_date)){
            new_commits.push(posts[i]);
        }
    }
    //if there was no new commits detected
    if(new_commits.length === 0){
        new_commits = null;
    }

    //map it all for the purpose of creating a new JSON object
    let dict = new Map();
    dict.set("new_commits", new_commits);
    dict.set("posts", posts);
    //create new json object with dict keys
    let JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    //return our JSON
    return JSONObj;
}
//retrieves all repos from a specific user and updates the schema
function fetchRepoData(username){
    //create XMLHttp object
    const repo = new XMLHttpRequest();
    //create path for request
    let repo_path = 'https://api.github.com/users/'.concat(username).concat('/repos');
    //open request
    repo.open('GET', repo_path, false);
    repo.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send request
    repo.send();
    //parse response
    const repo_data = JSON.parse(repo.responseText);
    //retrieve all repo names
    let repo_names = [];
    for (let i in repo_data) {
        repo_names.push(repo_data[i].name);
    }
    //return array of all repo names
    return repo_names;
}

router.route('/limit')
    .get(function(req, res){
        const limit = new XMLHttpRequest();
        //create path for request
        let limit_path = 'https://api.github.com/rate_limit';
        //open request
        limit.open('GET', limit_path, false);
        //set header for authentication
        limit.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
        //send request
        limit.send();
        //send response
        res.status(limit.status).send(JSON.parse(limit.responseText));
    });

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
        //API call = 1
        else if (req.params.variable === "repo" && req.params.github_user) {
            //call API to retrieve all repos for this user (API call = 1)

            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //TODO give a richer messages when sending back to client

                    let repo_array = fetchRepoData(req.params.github_user);
                    let repo_info = {
                        repo_names: repo_array,
                        posts: user._doc.repo_info.posts
                    };
                    //try to update the user
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                repo_info: repo_info
                            }
                        }).exec(function(err, result){
                            res.status(200).send({success: true, msg: 'User repos has been updated!'});
                        });
                    } catch (e) {
                        print(e);
                    }
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
                    //call API to retrieve commits of specific repo (API call = 1)

                    //get commit array to pass into function
                    let commit_array = user._doc.repo_info.posts.slice();   //deep copy for immutable change later on
                    let jsonResult = fetchCommitData(req.params.github_user, req.params.repo_name, commit_array);
                    //update our commit history by adding any new commits into posts
                    //!----Dangerous code here, without this if statement, the for loop would break on trying to find the length of null
                    if(jsonResult['new_commits'] != null){
                        for(let i = 0; i < jsonResult['new_commits'].length; ++i){
                            commit_array.push(jsonResult['new_commits'][i]);
                        }
                    }
                    let repo_info = {
                        repo_names: user._doc.repo_info.repo_names,
                        posts: commit_array
                    };
                    //try to update the user repo info
                    //TODO get the $ifNull working
                    // (https://docs.mongodb.com/manual/reference/operator/aggregation/ifNull/)
                    // (https://docs.mongodb.com/manual/reference/method/db.collection.updateOne/)
                    if(jsonResult['new_commits'] != null){
                        try {
                            User.updateOne({github_username: req.params.github_user}, {
                                $set: {
                                    new_commits: jsonResult['new_commits'],
                                    repo_info: repo_info,
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
                                    new_commits: null,
                                    repo_info: repo_info
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
        }
        //API call = n + 1
        else if(req.params.variable === "repo_n_commit" && req.params.github_user){
            //fetch all repos and all commits from all repos (commits = n, repos = 1)
        }
        else {
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
        user.new_commits = null;
        user.repo_info = jsonInfo['repo_info']
        // user.new_repo_info = null;
        // user.repo_info = jsonInfo['repo_info'];
        // user.fe_repo_info = jsonInfo['fe_repo_info'];
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
